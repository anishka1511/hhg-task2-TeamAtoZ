/**
 * Groq chat-completions client (no SDK).
 * Default model: openai/gpt-oss-20b — a reasoning model; short max_tokens
 * often yields HTTP 200 with empty message.content (all tokens spent thinking).
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function isReasoningModel(model) {
  return /gpt-oss|o1|o3|reasoning/i.test(String(model || ''));
}

export async function groqChat({
  apiKey,
  model,
  messages,
  maxTokens = 220,
  timeoutMs = 45000,
  jsonMode = true,
}) {
  // Reasoning models need a large completion budget (thinking + answer).
  const budget = isReasoningModel(model)
    ? Math.max(Number(maxTokens) || 0, 1024)
    : Math.max(Number(maxTokens) || 220, 64);

  async function once(useJson, completionBudget) {
    const body = {
      model,
      messages,
      temperature: isReasoningModel(model) ? 0.6 : 0.2,
      // Prefer max_completion_tokens for gpt-oss; keep max_tokens for older models.
      max_completion_tokens: completionBudget,
      max_tokens: completionBudget,
    };
    if (useJson) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const raw = await res.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: { message: raw.slice(0, 200) } };
    }

    return { res, data };
  }

  let useJson = jsonMode;
  let completionBudget = budget;
  let { res, data } = await once(useJson, completionBudget);

  const errMsg = () => String(data.error?.message || '');

  // Some Groq models reject json_object; retry as plain text.
  if (!res.ok && useJson && /json|failed_generation|response_format/i.test(errMsg())) {
    useJson = false;
    ({ res, data } = await once(false, completionBudget));
  }

  // Rate limit — brief wait + one retry.
  if (!res.ok && (res.status === 429 || /rate limit/i.test(errMsg()))) {
    await new Promise((r) => setTimeout(r, 2500));
    ({ res, data } = await once(useJson, completionBudget));
  }

  if (!res.ok) {
    const detail = data.error?.message || `Groq HTTP ${res.status}`;
    const err = new Error(detail);
    err.statusCode = res.status >= 500 || res.status === 429 ? 503 : 502;
    throw err;
  }

  let content = data.choices?.[0]?.message?.content;
  const finish = data.choices?.[0]?.finish_reason;
  const reasoningTokens = data.usage?.completion_tokens_details?.reasoning_tokens;

  // Empty content with finish_reason=length → reasoning ate the budget; retry bigger.
  if ((!content || typeof content !== 'string' || !content.trim()) && isReasoningModel(model)) {
    completionBudget = Math.max(completionBudget * 2, 2048);
    console.log(
      JSON.stringify({
        event: 'groq_empty_retry',
        finish_reason: finish || null,
        reasoning_tokens: reasoningTokens ?? null,
        next_budget: completionBudget,
      }),
    );
    ({ res, data } = await once(useJson, completionBudget));
    if (!res.ok) {
      const detail = data.error?.message || `Groq HTTP ${res.status}`;
      const err = new Error(detail);
      err.statusCode = 503;
      throw err;
    }
    content = data.choices?.[0]?.message?.content;
  }

  if (!content || typeof content !== 'string' || !String(content).trim()) {
    const err = new Error(
      finish === 'length'
        ? 'Groq ran out of tokens while reasoning. Retry, or raise GENERATE budget.'
        : 'Groq returned empty content',
    );
    err.statusCode = 503;
    throw err;
  }

  return content;
}
