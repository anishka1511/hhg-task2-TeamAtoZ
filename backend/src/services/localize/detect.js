/**
 * Lightweight language detect for Indic demo path.
 * Returns: 'en' | 'hi' | 'mr'
 */

function hasDevanagari(q) {
  try {
    return /\p{Script=Devanagari}/u.test(q);
  } catch {
    return /[\u0900-\u097F]/.test(q);
  }
}

const MR_DEV = /आहे|काय|कसे|कुठे|कोण|मला|तुम्ही|आम्ही|नाही|होय|करा|सांगा|म्हणजे|काही/;
const MR_ROMAN =
  /\b(kay|ahe|kahi|kuthe|kon|mala|tumhi|amhi|sang|mhant|marathi|maharashtra)\b/i;

const HI_ROMAN =
  /\b(kya|hai|hain|kaise|kyun|kyu|nahi|nahin|mujhe|batao|samjhao|matlb|matlab|hindi)\b/i;

/**
 * @param {string} question
 * @returns {'en'|'hi'|'mr'}
 */
export function detectLanguage(question) {
  const q = String(question || '').trim();
  if (!q) return 'en';

  const deavanagari = hasDevanagari(q);
  const mrRoman = MR_ROMAN.test(q);
  const hiRoman = HI_ROMAN.test(q);
  const mrDev = deavanagari && MR_DEV.test(q);

  if (mrDev || (mrRoman && !hiRoman)) return 'mr';
  if (mrRoman && hiRoman) {
    // Mixed roman cues — prefer Marathi if Devanagari Marathi markers, else Hindi
    return mrDev ? 'mr' : 'hi';
  }
  if (deavanagari || hiRoman) return 'hi';
  return 'en';
}

export function needsQueryTranslate(lang) {
  return lang === 'hi' || lang === 'mr';
}
