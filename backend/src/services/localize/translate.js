/**
 * Groq-backed translate helpers for Indic demo path.
 * Fail soft: callers fall back to original / omit localized answer.
 */

import { groqChat } from '../generate/groq.js';

/** Only model confirmed on current Groq free tier (llama-* ids are decommissioned). */
const DEFAULT_MODEL = 'openai/gpt-oss-20b';

function extractJsonField(text, field) {
  const trimmed = String(text || '').trim();
  try {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    const slice = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
    const parsed = JSON.parse(slice);
    if (typeof parsed[field] === 'string' && parsed[field].trim()) {
      return parsed[field].trim();
    }
  } catch {
    /* fall through */
  }
  const m = trimmed.match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (m) {
    return m[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .trim();
  }
  return null;
}

function getApiKey() {
  return process.env.LLM_API_KEY && String(process.env.LLM_API_KEY).trim();
}

function getModel() {
  return (process.env.LLM_MODEL || DEFAULT_MODEL).trim();
}

function plainEnglishFallback(content) {
  const trimmed = String(content || '').trim();
  if (!trimmed) return null;
  // If model returned plain text instead of JSON, use it when it looks like English.
  if (/^[\x20-\x7E\u00A0-\u024F]+$/.test(trimmed.replace(/\s/g, '')) || /[a-zA-Z]/.test(trimmed)) {
    return trimmed.replace(/^["']|["']$/g, '').trim();
  }
  return null;
}

async function callGroq(messages, maxTokens) {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  try {
    return await groqChat({
      apiKey,
      model: getModel(),
      messages,
      maxTokens,
      jsonMode: true,
    });
  } catch {
    try {
      return await groqChat({
        apiKey,
        model: getModel(),
        messages,
        maxTokens,
        jsonMode: false,
      });
    } catch {
      return null;
    }
  }
}

/**
 * @param {string} text
 * @returns {Promise<string|null>} English text or null on failure
 */
export async function translateToEnglish(text) {
  if (!String(text || '').trim()) return null;

  const messages = [
    {
      role: 'system',
      content:
        'Translate the user text into clear English for a search engine. Keep meaning. No commentary. JSON only: {"english":"string"}',
    },
    { role: 'user', content: String(text).trim() },
  ];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const content = await callGroq(messages, 512);
    if (!content) continue;
    const english = extractJsonField(content, 'english') || plainEnglishFallback(content);
    if (english) return english;
  }
  return null;
}

/**
 * @param {string} text English answer
 * @param {'hi'|'mr'} target
 * @returns {Promise<string|null>}
 */
export async function translateFromEnglish(text, target) {
  if (!String(text || '').trim()) return null;
  if (target !== 'hi' && target !== 'mr') return null;

  const langName = target === 'mr' ? 'मराठी (Marathi)' : 'हिंदी (Hindi)';
  const scriptNote =
    target === 'mr'
      ? 'Use शुद्ध मराठी in Devanagari only (no English words, no Roman script).'
      : 'Use शुद्ध हिंदी in Devanagari only (no English words, no Roman script).';

  const messages = [
    {
      role: 'system',
      content: [
        `Translate the English answer into ${langName}.`,
        scriptNote,
        'Keep the SAME facts — do not add or drop information.',
        'JSON only: {"localized":"string"}',
      ].join(' '),
    },
    { role: 'user', content: String(text).trim() },
  ];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const content = await callGroq(messages, 768);
    if (!content) continue;
    const localized = extractJsonField(content, 'localized');
    if (localized) return localized;
  }
  return null;
}
