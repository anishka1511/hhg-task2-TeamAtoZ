/**
 * Translate helpers for Indic demo path.
 * Default: Sarvam /translate (fast). Fallback: Groq when Sarvam fails or TRANSLATE_PROVIDER=groq.
 */

import { groqChat } from '../generate/groq.js';
import { sarvamFromEnglish, sarvamToEnglish } from './sarvamTranslate.js';

const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-20b';

function translateProvider() {
  const p = String(process.env.TRANSLATE_PROVIDER || 'sarvam').trim().toLowerCase();
  return p === 'groq' ? 'groq' : 'sarvam';
}

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

function getGroqApiKey() {
  return process.env.LLM_API_KEY && String(process.env.LLM_API_KEY).trim();
}

function getGroqModel() {
  return (process.env.LLM_MODEL || GROQ_DEFAULT_MODEL).trim();
}

async function groqTranslateToEnglish(text) {
  const apiKey = getGroqApiKey();
  if (!apiKey) return null;

  const messages = [
    {
      role: 'system',
      content:
        'Translate the user text into clear English for a search engine. Keep meaning. No commentary. JSON only: {"english":"string"}',
    },
    { role: 'user', content: String(text).trim() },
  ];

  try {
    const content = await groqChat({
      apiKey,
      model: getGroqModel(),
      messages,
      maxTokens: 512,
      jsonMode: true,
    });
    return extractJsonField(content, 'english');
  } catch {
    return null;
  }
}

async function groqTranslateFromEnglish(text, target) {
  const apiKey = getGroqApiKey();
  if (!apiKey) return null;

  const langName = target === 'mr' ? 'मराठी (Marathi)' : 'हिंदी (Hindi)';
  const messages = [
    {
      role: 'system',
      content: [
        `Translate the English answer into ${langName}.`,
        'Use Devanagari only. Keep the same facts.',
        'JSON only: {"localized":"string"}',
      ].join(' '),
    },
    { role: 'user', content: String(text).trim() },
  ];

  try {
    const content = await groqChat({
      apiKey,
      model: getGroqModel(),
      messages,
      maxTokens: 768,
      jsonMode: true,
    });
    return extractJsonField(content, 'localized');
  } catch {
    return null;
  }
}

/**
 * @param {string} text
 * @param {'hi'|'mr'|undefined} [sourceLang]
 * @returns {Promise<string|null>}
 */
export async function translateToEnglish(text, sourceLang) {
  if (!String(text || '').trim()) return null;

  if (translateProvider() === 'sarvam') {
    const sarvam = await sarvamToEnglish(text, sourceLang);
    if (sarvam) return sarvam;
  }

  return groqTranslateToEnglish(text);
}

/**
 * @param {string} text
 * @param {'hi'|'mr'} target
 * @returns {Promise<string|null>}
 */
export async function translateFromEnglish(text, target) {
  if (!String(text || '').trim()) return null;
  if (target !== 'hi' && target !== 'mr') return null;

  if (translateProvider() === 'sarvam') {
    const sarvam = await sarvamFromEnglish(text, target);
    if (sarvam) return sarvam;
  }

  return groqTranslateFromEnglish(text, target);
}
