# AI expense advisor — Supabase setup

This project has no local migrations folder; existing tables (`profiles`,
`expenses`, `goals`, `goal_scenarios`, `progress_reviews`) were created
directly in the Supabase SQL editor. Do the same for the new cache table
below.

## 1. Create the `ai_insights` table

Run in the Supabase SQL editor:

```sql
create table ai_insights (
  user_id uuid primary key references auth.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  input_hash text not null,
  insights jsonb not null
);

alter table ai_insights enable row level security;

create policy "own insights" on ai_insights
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## 2. Get a free Gemini API key

Create one at https://aistudio.google.com/apikey (Google AI Studio, free tier).

## 3. Set the Edge Function secret

The key must never be an `EXPO_PUBLIC_*` variable (those ship in the client
bundle). Set it as a Supabase secret instead:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase secrets set GEMINI_API_KEY=<your-key>
# optional, defaults to gemini-3.8-flash:
npx supabase secrets set GEMINI_MODEL=gemini-3.8-flash
```

## 4. Deploy the function

```bash
npx supabase functions deploy ai-advisor --use-api
```

`--use-api` bundles the function on Supabase's servers instead of locally.
It's required here: Supabase CLI 2.118.0's local bundler has a known bug
("Error: entrypoint path does not exist") that misfires even when the file
is present and correct — see https://github.com/supabase/cli/pull/6087.
`--use-api` sidesteps it entirely.

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided automatically to every
Edge Function by the Supabase runtime — no need to set those secrets
yourself.

## 5. Try it

In the app, sign in (cloud sync must be configured — see the root
`.env.example`), go to Goals → Insights → the "AI" tab, and tap
"Generate insights". Each user gets a fresh result at most once every 6
hours (enforced server-side in the function, regardless of how many times
the client asks).
