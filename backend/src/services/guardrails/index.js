/**
 * Guardrails stub — Owner: Builder 2
 * Off-topic / unsafe / weak retrieval / ungrounded → refuse
 */

export async function applyGuardrails({ question, answer, contexts, refuse }) {
  // Scaffold default: allow through once generation exists; real checks TBD.
  if (refuse) {
    return {
      allowed: false,
      reason: 'generator_refused',
      fallbackAnswer: "I don't have enough information in the knowledge base to answer that.",
    };
  }

  void question;
  void answer;
  void contexts;

  return {
    allowed: true,
    reason: null,
    fallbackAnswer: null,
    // TODO(Builder 2): implement off-topic, unsafe, weak-retrieval, grounding checks
  };
}
