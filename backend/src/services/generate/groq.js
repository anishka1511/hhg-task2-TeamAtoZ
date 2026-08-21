/**
 * Groq chat-completions client (no SDK).
 * Default model: openai/gpt-oss-20b (llama-3.1-8b-instant retired Aug 2026).
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function groqChat({
  apiKey,
  model,
  messages,
  maxTokens = 220,
  timeoutMs = 20000,
  jsonMode = true,
}) {
  async function once(useJson) {
    const body = {
      model,
      messages,
      temperature: 0.2,
      max_tokens: maxTokens,
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

  let { res, data } = await once(jsonMode);

  // Some Groq models reject json_object; retry as plain text.
  const msg = String(data.error?.message || '');
  if (!res.ok && jsonMode && /json|failed_generation|response_format/i.test(msg)) {
    ({ res, data } = await once(false));
  }

  if (!res.ok) {
    const detail = data.error?.message || `Groq HTTP ${res.status}`;
    const err = new Error(detail);
    err.statusCode = res.status >= 500 ? 503 : 502;
    throw err;
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    const err = new Error('Groq returned empty content');
    err.statusCode = 503;
    throw err;
  }

  return content;
}
