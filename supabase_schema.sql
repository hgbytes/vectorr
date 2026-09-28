-- Run this migration in the Supabase SQL editor.
-- Every policy scopes rows to the authenticated Supabase user.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_income numeric not null default 0,
  current_savings numeric not null default 0,
  monthly_debt_payments numeric not null default 0,
  emergency_fund_target numeric not null default 0,
  goal_contribution_budget numeric not null default 0,
  actual_monthly_goal_contributions numeric not null default 0,
  inflation_rate numeric not null default 6,
  expected_annual_return numeric not null default 10,
  income_growth_rate numeric not null default 5,
  expense_growth_rate numeric not null default 6,
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  category text not null,
  note text not null default '',
  expense_date timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.goals (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  target_date date not null,
  priority text not null,
  category text not null default 'Custom',
  minimum_monthly_contribution numeric not null default 0,
  deadline_type text not null default 'Fixed',
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.goal_scenarios (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  priority_strategy text not null,
  goal_contributions jsonb not null default '{}'::jsonb,
  projected_results jsonb not null default '{}'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.progress_reviews (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reviewed_at timestamptz not null,
  available_goal_budget numeric not null default 0,
  monthly_expenses numeric not null default 0,
  total_saved numeric not null default 0,
  total_target numeric not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists expenses_user_date_idx on public.expenses(user_id, expense_date);
create index if not exists goals_user_date_idx on public.goals(user_id, target_date);
create index if not exists scenarios_user_updated_idx on public.goal_scenarios(user_id, updated_at desc);

alter table public.profiles enable row level security;
alter table public.expenses enable row level security;
alter table public.goals enable row level security;
alter table public.goal_scenarios enable row level security;
alter table public.progress_reviews enable row level security;

create policy "profiles own rows" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "expenses own rows" on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals own rows" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scenarios own rows" on public.goal_scenarios for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reviews own rows" on public.progress_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The client uses updated_at for last-write-wins conflict resolution.
-- Do not use client timestamps as authorization; RLS remains the security boundary.
