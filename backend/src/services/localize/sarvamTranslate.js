/**
 * Sarvam text translation — fast Indic ↔ English path.
 * POST https://api.sarvam.ai/translate
 * @see https://docs.sarvam.ai/api-reference/text/translate-text
 */

const SARVAM_TRANSLATE_URL = 'https://api.sarvam.ai/translate';
const DEFAULT_MODEL = process.env.SARVAM_TRANSLATE_MODEL || 'mayura:v1';
const TIMEOUT_MS = Number(process.env.SARVAM_TRANSLATE_TIMEOUT_MS || 15000);

function getApiKey() {
  return process.env.SARVAM_API_KEY && String(process.env.SARVAM_API_KEY).trim();
}

function langToSarvamSource(lang) {
  if (lang === 'mr') return 'mr-IN';
  if (lang === 'hi') return 'hi-IN';
  return 'auto';
}

function langToSarvamTarget(lang) {
  if (lang === 'mr') return 'mr-IN';
  if (lang === 'hi') return 'hi-IN';
  return 'en-IN';
}

/**
 * @param {{ input: string, source: string, target: string, mode?: string, output_script?: string|null }} args
 * @returns {Promise<string|null>}
 */
export async function sarvamTranslate({
  input,
  source,
  target,
  mode = 'formal',
  output_script = null,
}) {
  const apiKey = getApiKey();
  const text = String(input || '').trim();
  if (!apiKey || !text) return null;

  const body = {
    input: text,
    source_language_code: source,
    target_language_code: target,
    model: DEFAULT_MODEL,
    mode,
  };
  if (output_script) body.output_script = output_script;

  try {
    const res = await fetch(SARVAM_TRANSLATE_URL, {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const raw = await res.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }

    if (!res.ok) {
      return null;
    }

    const translated = data.translated_text;
    return typeof translated === 'string' && translated.trim() ? translated.trim() : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} text
 * @param {'hi'|'mr'|undefined} lang
 */
export async function sarvamToEnglish(text, lang) {
  return sarvamTranslate({
    input: text,
    source: langToSarvamSource(lang),
    target: 'en-IN',
    mode: 'code-mixed',
  });
}

/**
 * @param {string} text
 * @param {'hi'|'mr'} target
 */
export async function sarvamFromEnglish(text, target) {
  return sarvamTranslate({
    input: text,
    source: 'en-IN',
    target: langToSarvamTarget(target),
    mode: 'formal',
    output_script: 'fully-native',
  });
}
