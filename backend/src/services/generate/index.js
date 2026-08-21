/**
 * Grounded generation — Owner: Builder 2
 * Default path prefers a fast Groq chat model (not reasoning gpt-oss).
 * Optional ANSWER_MODE=extractive|hybrid|llm:
 *   extractive — passages only (VANI-style evidence path, ~tens of ms after retrieve)
 *   hybrid     — extractive when top score is high, else LLM
 *   llm        — always Groq
 */

import { groqChat } from './groq.js';
import { assembleExtractiveAnswer } from './extractive.js';

/** Fast Groq chat model — avoid openai/gpt-oss-* (reasoning; hundreds of ms). */
const DEFAULT_MODEL = 'llama-3.1-8b-instant';

function answerMode() {
  const m = String(process.env.ANSWER_MODE || 'hybrid').trim().toLowerCase();
  if (m === 'extractive' || m === 'llm' || m === 'hybrid') return m;
  return 'hybrid';
}

function parseGroundedJson(text) {
  const trimmed = String(text).trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  let candidate = fenced ? fenced[1].trim() : trimmed;
  if (!candidate.startsWith('{')) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      candidate = candidate.slice(start, end + 1);
    }
  }

  const extractField = (name) => {
    const m = candidate.match(new RegExp(`"${name}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
    if (!m) return '';
    return m[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .trim();
  };

  try {
    const parsed = JSON.parse(candidate);
    return {
      answer: typeof parsed.answer === 'string' ? parsed.answer.trim() : '',
      refuse: Boolean(parsed.refuse),
      used_context_ids: Array.isArray(parsed.used_context_ids)
        ? parsed.used_context_ids.map(String)
        : [],
    };
  } catch {
    const answer = extractField('answer');
    if (answer) {
      const refuse = /"refuse"\s*:\s*true/.test(candidate);
      return { answer, refuse, used_context_ids: [] };
    }
    throw new Error('ungrounded_json');
  }
}

function buildPrompt(question, contexts) {
  const maxChars = Number(process.env.CONTEXT_CHAR_LIMIT || 400);
  const blocks = contexts
    .map((c, i) => {
      const id = c.id ?? `ctx-${i}`;
      const score = typeof c.score === 'number' ? c.score.toFixed(3) : 'n/a';
      const text = String(c.text || '').slice(0, maxChars);
      return `[${i + 1}] id=${id} score=${score}\n${text}`;
    })
    .join('\n\n');

  return {
    system: [
      'Answer ONLY from the contexts. No outside knowledge.',
      'Reply with 1–2 short English sentences.',
      'If contexts cannot answer, refuse=true and answer="".',
      'JSON only: {"answer":"string","refuse":boolean}',
    ].join(' '),
    user: `Question: ${question}\n\nContexts:\n${blocks || '(none)'}`,
  };
}

function topScore(contexts) {
  const list = Array.isArray(contexts) ? contexts : [];
  let best = 0;
  for (const c of list) {
    if (typeof c.score === 'number' && c.score > best) best = c.score;
  }
  return best;
}

async function generateWithLlm({ question, contexts }) {
  const apiKey = process.env.LLM_API_KEY && String(process.env.LLM_API_KEY).trim();
  if (!apiKey) {
    return {
      ok: false,
      statusCode: 501,
      error: 'llm_not_configured',
      message: 'Set LLM_API_KEY in .env (Groq) to enable grounded generation.',
      answer: null,
      refuse: false,
      used_context_ids: [],
      mode: 'llm',
    };
  }

  const list = Array.isArray(contexts) ? contexts : [];
  if (list.length === 0) {
    return {
      ok: true,
      answer: '',
      refuse: true,
      used_context_ids: [],
      mode: 'llm',
    };
  }

  const model = (process.env.LLM_MODEL || DEFAULT_MODEL).trim();
  const maxTokens = Number(process.env.GENERATE_MAX_TOKENS || 96);
  const { system, user } = buildPrompt(question, list);

  try {
    const content = await groqChat({
      apiKey,
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      maxTokens,
      jsonMode: true,
      timeoutMs: Number(process.env.GENERATE_TIMEOUT_MS || 15000),
    });

    let parsed;
    try {
      parsed = parseGroundedJson(content);
    } catch {
      return {
        ok: true,
        answer: String(content).trim().slice(0, 400),
        refuse: false,
        used_context_ids: list.map((c) => String(c.id)).filter(Boolean),
        mode: 'llm',
      };
    }

    if (parsed.refuse || !parsed.answer) {
      return {
        ok: true,
        answer: '',
        refuse: true,
        used_context_ids: parsed.used_context_ids,
        mode: 'llm',
      };
    }

    return {
      ok: true,
      answer: parsed.answer,
      refuse: false,
      used_context_ids:
        parsed.used_context_ids.length > 0
          ? parsed.used_context_ids
          : list.map((c) => String(c.id)).filter(Boolean),
      mode: 'llm',
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: err.statusCode || 503,
      error: 'generate_failed',
      message: err.message || 'Groq generation failed',
      answer: null,
      refuse: false,
      used_context_ids: [],
      mode: 'llm',
    };
  }
}

export async function generateAnswer({ question, contexts }) {
  const mode = answerMode();
  const list = Array.isArray(contexts) ? contexts : [];

  if (mode === 'extractive') {
    return assembleExtractiveAnswer({ question, contexts: list });
  }

  if (mode === 'hybrid') {
    const threshold = Number(process.env.HYBRID_EXTRACTIVE_MIN_SCORE || 0.55);
    const extracted = assembleExtractiveAnswer({ question, contexts: list });
    if (extracted.ok && !extracted.refuse && extracted.answer && topScore(list) >= threshold) {
      return extracted;
    }
    // Fall through to LLM when extractive is weak
  }

  return generateWithLlm({ question, contexts: list });
}
