// ============================================================
// AI provider helpers for FusionOps API Worker
// ============================================================
// Wraps Gemini + Anthropic message APIs with shared JSON
// extraction and Gemini-first / Anthropic-fallback logic.
//
// Extracted from worker.js (Phase 1: utility extraction).
//
// Gemini key passed via x-goog-api-key header (not URL query) so it does not
// leak into logs, edge proxies, or Referer.
// ============================================================

/** Pull a JSON object or array from model text (markdown fences, prose, etc.). */
export function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  // Strip markdown code fences (```json ... ``` or ``` ... ```) that
  // Gemini/Claude sometimes wrap JSON in despite "no markdown" instructions.
  let s = text.trim()
    .replace(/^```(?:json|javascript|js)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  // Array first — generate-reviews expects [{...},{...}]. Do not use first `[` alone (e.g. "up to $500 [T&C]").
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '[') continue;
    let j = i + 1;
    while (j < s.length && /\s/.test(s[j])) j++;
    if (j >= s.length || s[j] !== '{') continue;
    const a1 = s.lastIndexOf(']');
    if (a1 <= i) continue;
    const sub = s.slice(i, a1 + 1);
    try {
      JSON.parse(sub);
      return sub;
    } catch (_e) {
      /* try next "[" that starts an object array */
    }
  }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  const sub = s.slice(start, end + 1);
  try {
    JSON.parse(sub);
    return sub;
  } catch (_e) {
    return null;
  }
}

export async function callGemini(apiKey, prompt, maxTokens = 512) {
  // Pass key via x-goog-api-key header, never the URL query string. URLs leak
  // into Cloudflare logs, edge proxies, and Referer headers; the header form
  // stays in TLS. Generative Language API supports both.
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.95 },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${data?.error?.message || JSON.stringify(data).slice(0, 100)}`);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

export async function callAnthropic(apiKey, prompt, maxTokens = 512) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${data?.error?.message || JSON.stringify(data).slice(0, 100)}`);
  const text = data?.content?.[0]?.text || '';
  if (!text) throw new Error('Anthropic returned empty response');
  return text;
}

export async function callAI(env, body, prompt, maxTokens = 512) {
  // Key priority: request body → env secret
  const geminiKey = body.geminiKey || env.GEMINI_API_KEY || '';
  const anthropicKey = body.anthropicKey || env.ANTHROPIC_API_KEY || '';
  let lastError = '';
  // Primary: Gemini
  if (geminiKey) {
    try {
      const text = await callGemini(geminiKey, prompt, maxTokens);
      if (text) return text;
    } catch (e) { lastError = `Gemini: ${e.message}`; }
  }
  // Backup: Anthropic
  if (anthropicKey) {
    try {
      return await callAnthropic(anthropicKey, prompt, maxTokens);
    } catch (e) { lastError += ` | Anthropic: ${e.message}`; }
  }
  const hasKeys = !!(geminiKey || anthropicKey);
  if (hasKeys) throw new Error(`AI providers failed: ${lastError}`);
  throw new Error('No AI API key configured. Add Gemini API Key or Anthropic API Key in Settings.');
}
