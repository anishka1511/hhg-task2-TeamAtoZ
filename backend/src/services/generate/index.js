/**
 * Grounded generation stub — Owner: Builder 2
 */

export async function generateAnswer({ question, contexts }) {
  return {
    ok: false,
    statusCode: 501,
    message:
      'TODO(Builder 2): call LLM with grounded prompt using contexts. question=' +
      String(question).slice(0, 40),
    answer: null,
    refuse: false,
    used_context_ids: [],
    // contexts length available for implementers
    _contextCount: Array.isArray(contexts) ? contexts.length : 0,
  };
}
