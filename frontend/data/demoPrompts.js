export const PROMPT_LANGS = [
  { id: 'en', label: 'EN' },
  { id: 'hi', label: 'HI' },
  { id: 'mr', label: 'MR' },
];

export const PROMPT_CATALOG = {
  en: [
    {
      id: 'en-manhattan',
      title: 'Manhattan Project',
      question: 'What was the Manhattan Project?',
      hint: 'History',
    },
    {
      id: 'en-paris',
      title: 'Capital of France',
      question: 'What is the capital of France?',
      hint: 'Geography',
    },
    {
      id: 'en-net-gain',
      title: 'Net gain and loss',
      question: 'What is the net gain and loss?',
      hint: 'Finance',
    },
  ],
  hi: [
    {
      id: 'hi-paris',
      title: 'पेरिस राजधानी',
      question: 'पेरिस फ्रांस की राजधानी है?',
      hint: 'भूगोल',
    },
    {
      id: 'hi-gold-hardness',
      title: 'सोने की कठोरता',
      question: 'मोह्स पैमाने पर सोने की कठोरता कितनी होती है?',
      hint: 'विज्ञान',
    },
    {
      id: 'hi-manhattan',
      title: 'मैनहट्टन प्रोजेक्ट',
      question: 'मैनहट्टन प्रोजेक्ट क्या था?',
      hint: 'इतिहास',
    },
  ],
  mr: [
    {
      id: 'mr-manhattan',
      title: 'मॅनहट्टन प्रकल्प',
      question: 'मॅनहट्टन प्रकल्प काय होता?',
      hint: 'इतिहास',
    },
    {
      id: 'mr-paris',
      title: 'पॅरिस राजधानी',
      question: 'पॅरिस कोणत्या देशाची राजधानी आहे?',
      hint: 'भूगोल',
    },
    {
      id: 'mr-capital',
      title: 'फ्रान्सची राजधानी',
      question: 'फ्रान्सची राजधानी कोणती?',
      hint: 'भूगोल',
    },
  ],
};

export const REFUSAL_PROMPTS = [
  {
    id: 'refusal-tokyo',
    title: 'Off-topic weather',
    question: "What's the weather in Tokyo?",
    hint: 'Refusal demo',
    isRefusal: true,
  },
  {
    id: 'refusal-who',
    title: 'Meta question',
    question: 'Who are you?',
    hint: 'Refusal demo',
    isRefusal: true,
  },
];

const DEVANAGARI_RE = /[\u0900-\u097F]/;
const MARATHI_MARKERS_RE = /(आहे|काय|म्हण|नाही|होता|होती)/;

export function detectScriptLang(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;
  if (!DEVANAGARI_RE.test(trimmed)) return 'en';
  if (MARATHI_MARKERS_RE.test(trimmed)) return 'mr';
  return 'hi';
}

export function getPromptsForLang(lang, query = '') {
  const langPrompts = PROMPT_CATALOG[lang] || [];
  const q = query.trim().toLowerCase();

  const filtered = langPrompts.filter((item) => {
    if (!q) return true;
    const haystack = `${item.title} ${item.question}`.toLowerCase();
    return haystack.includes(q);
  });

  const refusals = REFUSAL_PROMPTS.filter((item) => {
    if (!q) return true;
    const haystack = `${item.title} ${item.question}`.toLowerCase();
    return haystack.includes(q);
  });

  return [...filtered, ...refusals];
}

export function getRandomPrompt() {
  const pool = Object.values(PROMPT_CATALOG).flat();
  return pool[Math.floor(Math.random() * pool.length)];
}
