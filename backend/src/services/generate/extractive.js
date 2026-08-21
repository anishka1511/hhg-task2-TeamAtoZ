/**
 * Extractive grounded answer — assemble a short answer from retrieved passages
 * without an LLM round-trip (VANI-style "evidence answer" path).
 * Target: tens of ms after retrieve, not hundreds.
 */

const STOP = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'been', 'of', 'to',
  'in', 'on', 'for', 'and', 'or', 'what', 'who', 'when', 'where', 'why', 'how',
  'do', 'does', 'did', 'can', 'could', 'would', 'should', 'with', 'from', 'by',
  'it', 'its', 'this', 'that', 'these', 'those', 'as', 'at', 'into', 'about',
]);

function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function scoreSentence(sentence, queryTokens) {
  if (!queryTokens.length) return 0;
  const st = new Set(tokens(sentence));
  let hit = 0;
  for (const t of queryTokens) {
    if (st.has(t)) hit += 1;
  }
  return hit / queryTokens.length;
}

/**
 * @param {{ question: string, contexts: Array<{id?: string, text?: string, score?: number}> }} args
 */
export function assembleExtractiveAnswer({ question, contexts }) {
  const list = Array.isArray(contexts) ? contexts : [];
  if (list.length === 0) {
    return { ok: true, answer: '', refuse: true, used_context_ids: [], mode: 'extractive' };
  }

  const qTokens = tokens(question);
  const candidates = [];

  for (const ctx of list.slice(0, 3)) {
    const sentences = splitSentences(ctx.text);
    const pool = sentences.length > 0 ? sentences : [String(ctx.text || '').slice(0, 280)];
    for (const sentence of pool.slice(0, 6)) {
      const overlap = scoreSentence(sentence, qTokens);
      const retrievalBoost = typeof ctx.score === 'number' ? Math.max(0, ctx.score) * 0.35 : 0;
      candidates.push({
        text: sentence,
        score: overlap + retrievalBoost,
        id: ctx.id,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const minOverlap = Number(process.env.EXTRACTIVE_MIN_OVERLAP || 0.15);

  if (!best || best.score < minOverlap) {
    // Fall back to leading sentences of top hit if retrieval score is strong
    const top = list[0];
    const topScore = typeof top?.score === 'number' ? top.score : 0;
    const minRetrieve = Number(process.env.EXTRACTIVE_MIN_RETRIEVE_SCORE || 0.45);
    if (topScore < minRetrieve) {
      return { ok: true, answer: '', refuse: true, used_context_ids: [], mode: 'extractive' };
    }
    const fallback = splitSentences(top.text).slice(0, 2).join(' ') || String(top.text || '').slice(0, 220);
    return {
      ok: true,
      answer: fallback.trim(),
      refuse: !fallback.trim(),
      used_context_ids: [String(top.id)].filter(Boolean),
      mode: 'extractive',
    };
  }

  const second = candidates[1];
  let answer = best.text;
  if (second && second.score >= minOverlap && second.id !== best.id) {
    answer = `${best.text} ${second.text}`;
  }
  // Cap length for voice UX
  if (answer.length > 320) answer = `${answer.slice(0, 317).trim()}…`;

  return {
    ok: true,
    answer: answer.trim(),
    refuse: false,
    used_context_ids: [...new Set(candidates.slice(0, 2).map((c) => String(c.id)).filter(Boolean))],
    mode: 'extractive',
  };
}
