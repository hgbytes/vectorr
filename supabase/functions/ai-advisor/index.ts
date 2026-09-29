// Supabase Edge Function: ai-advisor
//
// Proxies a summarized snapshot of the user's finances to the Gemini API
// (free tier) and returns a small set of plain-language insights. The
// Gemini API key lives only in this function's environment (set via
// `supabase secrets set GEMINI_API_KEY=...`) and is never sent to the
// client.
//
// Deploy: supabase functions deploy ai-advisor
// Secrets: supabase secrets set GEMINI_API_KEY=<key> [GEMINI_MODEL=gemini-3.8-flash]
//
// Requires a table (see supabase/README.md in this repo for the SQL):
//   create table ai_insights (
//     user_id uuid primary key references auth.users(id) on delete cascade,
//     generated_at timestamptz not null default now(),
//     input_hash text not null,
//     insights jsonb not null
//   );

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_INSIGHTS = 5;
const ALLOWED_SEVERITIES = new Set(['info', 'warning', 'positive']);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function hashInput(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function buildPrompt(summary: unknown) {
  return [
    'You are a plain-spoken personal finance advisor inside a budgeting app.',
    'You will receive a JSON summary of one user\'s monthly income, expenses, savings, debt, and financial goals.',
    'Using ONLY the numbers given (never invent data), write 3 to 5 short, specific, actionable insights about their finances.',
    'Each insight must be genuinely useful: point out a real risk, an opportunity, or progress worth acknowledging. Avoid generic advice ("save more", "budget carefully").',
    'severity: "warning" for risks (overspending, debt, missed goals), "positive" for things going well, "info" for neutral observations.',
    'Keep each detail under 200 characters. Do not include disclaimers or mention that you are an AI.',
    '',
    'User financial summary (JSON):',
    JSON.stringify(summary),
  ].join('\n');
}

function sanitizeInsights(raw: unknown): { title: string; detail: string; severity: string }[] {
  if (!Array.isArray(raw)) return [];
  const cleaned = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 80) : '';
    const detail = typeof item.detail === 'string' ? item.detail.trim().slice(0, 300) : '';
    const severity = ALLOWED_SEVERITIES.has(item.severity) ? item.severity : 'info';
    if (title && detail) cleaned.push({ title, detail, severity });
    if (cleaned.length >= MAX_INSIGHTS) break;
  }
  return cleaned;
}

async function callGemini(summary: unknown) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('AI advisor is not configured on the server.');
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(summary) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                detail: { type: 'STRING' },
                severity: { type: 'STRING', enum: ['info', 'warning', 'positive'] },
              },
              required: ['title', 'detail', 'severity'],
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Gemini request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('AI advisor returned an empty response.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('AI advisor returned an unreadable response.');
  }

  const insights = sanitizeInsights(parsed);
  if (insights.length === 0) throw new Error('AI advisor had nothing to report.');
  return insights;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) return json({ error: 'Server misconfigured.' }, 500);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return json({ error: 'Not authenticated.' }, 401);
  const userId = userData.user.id;

  let summary: unknown;
  try {
    summary = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  try {
    const inputHash = await hashInput(summary);

    const { data: cached } = await supabase
      .from('ai_insights')
      .select('generated_at, input_hash, insights')
      .eq('user_id', userId)
      .maybeSingle();

    // Server-side cooldown guard, independent of the client: a cached
    // result younger than COOLDOWN_MS is always served as-is, even if the
    // input changed, so a single user can't burn through the free-tier
    // quota faster than this regardless of what the client sends.
    if (cached && Date.now() - new Date(cached.generated_at).getTime() < COOLDOWN_MS) {
      return json({ insights: cached.insights, generatedAt: cached.generated_at });
    }

    const insights = await callGemini(summary);
    const generatedAt = new Date().toISOString();

    await supabase.from('ai_insights').upsert({
      user_id: userId,
      generated_at: generatedAt,
      input_hash: inputHash,
      insights,
    });

    return json({ insights, generatedAt });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'AI advisor failed.' }, 502);
  }
});
