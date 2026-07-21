import { AiCandidate, AiProvider, UniverseAssetType } from '../types/correlation';
import { extractJsonPayload, validateAiCandidates } from './correlationAiValidation';

export { extractJsonPayload, validateAiCandidates } from './correlationAiValidation';

const SYSTEM_PROMPT =
  'You are a market-research assistant that only proposes candidate ticker symbols for a correlation study. ' +
  'You never calculate, estimate, or state a correlation value yourself — that is computed separately from market data. ' +
  'Respond with strict JSON only, matching exactly this schema and nothing else (no markdown fences, no commentary): ' +
  '{"candidates":[{"symbol":"QQQ","reason":"Technology-heavy growth ETF"}]}';

function buildUserPrompt(primaryTicker: string, allowedAssetTypes: UniverseAssetType[], count: number): string {
  const typesLabel = allowedAssetTypes.length === 2 ? 'stocks or ETFs' : allowedAssetTypes[0] === 'etf' ? 'ETFs' : 'stocks';
  return (
    `Primary ticker: ${primaryTicker}\n` +
    `Permitted asset types: ${typesLabel}\n` +
    `Requested number of candidates: ${count}\n\n` +
    `Suggest a balanced set of Yahoo Finance ${typesLabel} symbols worth testing for correlation against ${primaryTicker}: ` +
    'some likely positively correlated, some likely low/uncorrelated (diversifiers), and some likely negatively correlated. ' +
    'Give a short one-sentence reason for each. Return JSON only.'
  );
}

async function callGemini(prompt: string, apiKey?: string): Promise<string> {
  const key = apiKey?.trim() || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  const model = (import.meta as any).env?.VITE_GEMINI_MODEL ?? 'gemini-2.0-flash';
  const apiVersion = (import.meta as any).env?.VITE_GEMINI_API_VERSION ?? 'v1beta';
  const baseUrl = (import.meta as any).env?.VITE_GEMINI_API_BASE_URL ?? 'https://generativelanguage.googleapis.com';
  if (!key) throw new Error('Gemini API key is not configured. Enter your API key or set VITE_GEMINI_API_KEY.');

  const url = `${baseUrl}/${apiVersion}/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    }),
  });
  if (!response.ok) throw new Error(`Gemini request failed: ${response.status} ${response.statusText}`);
  const json = await response.json();
  const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
  return candidates
    .flatMap((c: any) => (Array.isArray(c?.content?.parts) ? c.content.parts : []))
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .filter(Boolean)
    .join('\n');
}

async function callChatGpt(prompt: string, apiKey?: string): Promise<string> {
  const key = apiKey?.trim() || (import.meta as any).env?.VITE_CHATGPT_API_KEY;
  const model = (import.meta as any).env?.VITE_CHATGPT_MODEL ?? 'gpt-4o-mini';
  const baseUrl = (import.meta as any).env?.VITE_CHATGPT_API_BASE_URL ?? 'https://api.openai.com';
  if (!key) throw new Error('ChatGPT API key is not configured. Enter your API key or set VITE_CHATGPT_API_KEY.');

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    }),
  });
  if (!response.ok) throw new Error(`ChatGPT request failed: ${response.status} ${response.statusText}`);
  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}

async function callClaude(prompt: string, apiKey?: string): Promise<string> {
  const key = apiKey?.trim() || (import.meta as any).env?.VITE_CLAUDE_API_KEY;
  const model = (import.meta as any).env?.VITE_CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
  const baseUrl = (import.meta as any).env?.VITE_CLAUDE_API_BASE_URL ?? '/api/claude';
  if (!key) throw new Error('Claude API key is not configured. Enter your API key or set VITE_CLAUDE_API_KEY.');

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Claude request failed: ${response.status} ${response.statusText}`);
  const json = await response.json();
  const content = Array.isArray(json?.content) ? json.content : [];
  return content
    .filter((b: any) => b?.type === 'text')
    .map((b: any) => b.text as string)
    .filter(Boolean)
    .join('\n');
}

/**
 * Fetches AI-suggested correlation candidates. Returns a validated, deduped, capped list of
 * { symbol, reason } — never a correlation value. Throws with a user-facing message on failure;
 * callers should treat AI discovery as optional and keep the deterministic universe scan working
 * regardless of the outcome.
 */
export async function fetchAiCandidates(options: {
  provider: AiProvider;
  primaryTicker: string;
  allowedAssetTypes: UniverseAssetType[];
  count: number;
  apiKey?: string;
}): Promise<AiCandidate[]> {
  const prompt = buildUserPrompt(options.primaryTicker, options.allowedAssetTypes, options.count);

  let raw: string;
  if (options.provider === 'chatgpt') raw = await callChatGpt(prompt, options.apiKey);
  else if (options.provider === 'claude') raw = await callClaude(prompt, options.apiKey);
  else raw = await callGemini(prompt, options.apiKey);

  const payload = extractJsonPayload(raw);
  return validateAiCandidates(payload, options.count);
}
