import { AiCandidate, AiProvider } from '../types/correlation';
import { parseTickerListResponse, validateAiTickers } from './correlationAiValidation';

export { parseTickerListResponse, validateAiTickers } from './correlationAiValidation';

const SYSTEM_PROMPT =
  'You are a market-research assistant that only proposes candidate ticker symbols for a correlation study. ' +
  'You never calculate, estimate, or state a correlation value yourself — that is computed separately from market data. ' +
  'Every symbol you return MUST be exactly as Yahoo Finance identifies it, because it will be looked up on Yahoo Finance ' +
  'verbatim with no correction. For any company listed on a non-U.S. exchange, you MUST append the correct Yahoo Finance ' +
  'exchange suffix — a bare symbol with no suffix is assumed to be a U.S. listing and will resolve to the wrong ' +
  'instrument (or nothing at all) if the company is not actually U.S.-listed. Common suffixes: ' +
  'India NSE ".NS" (e.g. TCS.NS, INFY.NS, HCLTECH.NS), India BSE ".BO", UK London ".L", Japan Tokyo ".T", ' +
  'Hong Kong ".HK", Germany Xetra ".DE", France Paris ".PA", Canada Toronto ".TO", Australia ASX ".AX", ' +
  'China Shanghai ".SS", China Shenzhen ".SZ", South Korea ".KS". Use no suffix only for U.S.-listed symbols ' +
  '(including U.S.-listed ADRs, which are a different instrument from the home-market listing — prefer the ' +
  'home-market suffixed symbol whenever the request is about the home market rather than the ADR). ' +
  'Respond with ONLY a comma-separated list of ticker symbols and nothing else: no explanations, no markdown, ' +
  'no headings, no numbering, no bullet points, no surrounding sentences, no code fences. ' +
  'Example of the exact response format expected when the request is for Indian NSE-listed companies:\n' +
  'TCS.NS, INFY.NS, HCLTECH.NS, WIPRO.NS, LTIM.NS';

function buildUserPrompt(options: {
  primaryTicker: string;
  startDate: string;
  endDate: string;
  frequency: string;
  count: number;
  instructions?: string;
}): string {
  const lines = [
    `Primary ticker: ${options.primaryTicker}`,
    `Start date: ${options.startDate}`,
    `End date: ${options.endDate}`,
    `Frequency: ${options.frequency}`,
  ];
  if (options.instructions && options.instructions.trim()) {
    lines.push(`User instructions: ${options.instructions.trim()}`);
  }
  lines.push(
    '',
    `Suggest up to ${options.count} ticker symbols worth testing for correlation against the primary ticker over ` +
      'that date range, following the user instructions if given. Every symbol must be the exact, correctly-suffixed ' +
      'form Yahoo Finance uses for that listing (see system instructions) — do not guess a bare U.S.-style symbol for ' +
      'a company listed on a non-U.S. exchange. ' +
      'Return ONLY a comma-separated list of ticker symbols — no explanations, no markdown, no additional text.'
  );
  return lines.join('\n');
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
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
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
  if (!key) throw new Error('OpenAI API key is not configured. Enter your API key or set VITE_CHATGPT_API_KEY.');

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
      max_tokens: 512,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
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
      max_tokens: 512,
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
 * Fetches AI-suggested correlation candidate tickers for the given primary ticker, date range,
 * frequency, and optional free-text instructions. Returns a validated, deduped, capped list of
 * { symbol, reason: '' } — never a correlation value; the AI only ever supplies ticker symbols,
 * which are then run through the existing deterministic correlation engine. Throws with a
 * user-facing message on failure; callers should treat AI discovery as optional.
 */
export async function fetchAiCandidates(options: {
  provider: AiProvider;
  primaryTicker: string;
  startDate: string;
  endDate: string;
  frequency: string;
  instructions?: string;
  count: number;
  apiKey?: string;
}): Promise<AiCandidate[]> {
  const prompt = buildUserPrompt(options);

  let raw: string;
  if (options.provider === 'chatgpt') raw = await callChatGpt(prompt, options.apiKey);
  else if (options.provider === 'claude') raw = await callClaude(prompt, options.apiKey);
  else raw = await callGemini(prompt, options.apiKey);

  const tickers = parseTickerListResponse(raw);
  return validateAiTickers(tickers, options.count);
}
