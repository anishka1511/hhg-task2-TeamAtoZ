/**
 * Grounded generation — Owner: Builder 2
 * Answers only from retrieved contexts via Groq (English).
 * Indic localization (answer_hi / answer_mr) happens in the pipeline after guardrails.
 */

import { groqChat } from './groq.js';

const DEFAULT_MODEL = 'openai/gpt-oss-20b';

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
  const blocks = contexts
    .map((c, i) => {
      const id = c.id ?? `ctx-${i}`;
      const score = typeof c.score === 'number' ? c.score.toFixed(3) : 'n/a';
      const text = String(c.text || '').slice(0, 800);
      return `[${i + 1}] id=${id} score=${score}\n${text}`;
    })
    .join('\n\n');

  return {
    system: [
      'You are a retrieval-grounded assistant for a voice RAG demo.',
      'Answer ONLY using the supplied contexts. Do not use outside knowledge.',
      'Keep answers to 2–4 short sentences in clear English.',
      'If the contexts are empty, unrelated, or too weak to answer, set refuse=true and answer="".',
      'Respond with JSON only: {"answer":"string","refuse":boolean}. Keep answer under 80 words.',
    ].join(' '),
    user: `Question: ${question}\n\nContexts:\n${blocks || '(none)'}`,
  };
}

export async function generateAnswer({ question, contexts }) {
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
    };
  }

  const list = Array.isArray(contexts) ? contexts : [];
  if (list.length === 0) {
    return {
      ok: true,
      answer: '',
      refuse: true,
      used_context_ids: [],
    };
  }

  const model = (process.env.LLM_MODEL || DEFAULT_MODEL).trim();
  const { system, user } = buildPrompt(question, list);

  try {
    const content = await groqChat({
      apiKey,
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      maxTokens: 384,
    });

    let parsed;
    try {
      parsed = parseGroundedJson(content);
    } catch {
      return {
        ok: true,
        answer: String(content).trim().slice(0, 600),
        refuse: false,
        used_context_ids: list.map((c) => String(c.id)).filter(Boolean),
      };
    }

    if (parsed.refuse || !parsed.answer) {
      return {
        ok: true,
        answer: '',
        refuse: true,
        used_context_ids: parsed.used_context_ids,
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
    };
  }
}
