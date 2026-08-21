/**
 * Guardrails — Owner: Builder 2
 * Order: unsafe → weak/empty retrieval → off-topic (low score) → ungrounded → allow
 *
 * Score calibration (Builder 1): in-corpus ~0.62–0.70, nonsense ~0.25–0.29.
 * Weak-retrieval cutoff: 0.4 (override with GUARDRAIL_MIN_SCORE).
 */

const FALLBACK =
  "I don't have enough information in the knowledge base to answer that.";

const MIN_SCORE = Number(process.env.GUARDRAIL_MIN_SCORE || 0.4);

const STOPWORDS = new Set(
  `a an the and or but if in on at to for of is are was were be been being
   it this that these those i you he she we they them my your his her our their
   as with from by not no yes do does did have has had can could would should
   will just so than then there here what which who how when where why about
   into over after before between out up down more most other some such only
   own same too very also`.split(/\s+/).filter(Boolean),
);

/** Obvious unsafe / inappropriate patterns (question + answer). */
const UNSAFE_PATTERNS = [
  /\b(how\s+to\s+)?(make|build|create)\s+(a\s+)?(bomb|explosive|weapon)\b/i,
  /\b(kill|murder|assassinate)\s+(someone|people|him|her|them)\b/i,
  /\b(child\s*porn|csam|sexual\s+content\s+involving\s+(a\s+)?(minor|child))\b/i,
  /\b(suicide\s+method|how\s+to\s+kill\s+myself)\b/i,
  /\b(credit\s+card\s+fraud|make\s+fake\s+(id|passport))\b/i,
  /\b(hack\s+into|steal\s+password|phishing\s+kit)\b/i,
];

function makeRefusal(reason) {
  return {
    allowed: false,
    reason,
    fallbackAnswer: FALLBACK,
  };
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function topScore(contexts) {
  if (!Array.isArray(contexts) || contexts.length === 0) return 0;
  return Math.max(...contexts.map((c) => Number(c.score) || 0));
}

function isUnsafe(text) {
  const s = String(text || '');
  return UNSAFE_PATTERNS.some((re) => re.test(s));
}

/**
 * Simple grounding: enough answer content tokens must appear in retrieved text.
 */
function isUngrounded(answer, contexts) {
  const answerTokens = tokenize(answer);
  if (answerTokens.length === 0) return true;

  const corpus = new Set(
    tokenize((contexts || []).map((c) => c.text || '').join(' ')),
  );
  if (corpus.size === 0) return true;

  let hits = 0;
  for (const t of answerTokens) {
    if (corpus.has(t)) hits += 1;
  }
  const ratio = hits / answerTokens.length;
  // Short answers need at least 1 hit; longer need ~20% overlap.
  if (answerTokens.length <= 6) return hits < 1;
  return ratio < 0.2;
}

/**
 * @param {{ question: string, answer: string|null, contexts: Array<{score?: number, text?: string}>, refuse?: boolean }} args
 */
export async function applyGuardrails({ question, answer, contexts, refuse }) {
  if (isUnsafe(question) || isUnsafe(answer)) {
    return makeRefusal('unsafe');
  }

  const list = Array.isArray(contexts) ? contexts : [];
  const score = topScore(list);

  if (list.length === 0) {
    return makeRefusal('weak_retrieval');
  }

  if (score < MIN_SCORE) {
    // Low cosine match ≈ not in corpus / off-topic (Builder 1 calibration).
    return makeRefusal('off_topic');
  }

  if (refuse) {
    return makeRefusal('generator_refused');
  }

  if (isUngrounded(answer, list)) {
    return makeRefusal('ungrounded');
  }

  return {
    allowed: true,
    reason: null,
    fallbackAnswer: null,
  };
}
