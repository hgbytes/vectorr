# Vectorr — App Overview

Vectorr is a personal finance app built with Expo/React Native. It tracks day-to-day
expenses and turns them, together with a user-entered financial profile, into a
goal-planning tool: how much can you afford to save each month, which goals compete
for that budget, and what trade-offs close the gap. Data is stored locally on-device
and optionally synced to a Supabase backend when the user signs in.

## Tech stack

- **Expo SDK 57** / React Native 0.86, React 19
- **Expo Router is not used** — navigation is a single `@react-navigation/bottom-tabs`
  navigator defined in [App.tsx](App.tsx); screens live in `src/screens/` rather than
  `src/app/`
- **react-native-web** — the app also builds for web (`npm run web`,
  `npm run build` → `expo export --platform web`)
- **@react-native-async-storage/async-storage** — local persistence
- **@supabase/supabase-js** — optional cloud auth + sync
- TypeScript throughout, no test suite or ESLint config currently checked in

## Running it

```bash
npx expo install <package>   # add dependencies (not npm/yarn add)
npx expo start                # dev server (press w for web, i/a for iOS/Android)
npx expo start --web          # web only
npx tsc --noEmit              # typecheck
npx expo lint                 # lint (scaffolds an eslint config on first run)
```

`ios/` and `android/` directories don't exist in this repo — they're generated on
demand via Continuous Native Generation from `app.json`. A dev build
(`npx expo run:ios|android`) is required for any native module beyond what Expo Go
bundles.

## Data model (`src/types.ts`)

| Type | Purpose |
|---|---|
| `Expense` | `id`, `amount`, `category`, `note`, `date`, plus `updatedAt`/`deletedAt` for sync |
| `FinancialProfile` | Singleton per user: income, savings, debt, emergency fund target, goal contribution budget, and assumption rates (inflation, expected return, income/expense growth) |
| `FinancialGoal` | A savings goal: target amount/date, current progress, `priority` (Essential/Important/Optional), `category`, minimum monthly contribution, and `deadlineType` (Fixed vs Flexible) |
| `GoalScenario` | A saved "what-if" allocation snapshot — per-goal contributions and projected outcomes under a named prioritization strategy |
| `ProgressSnapshot` | A single "last reviewed" checkpoint used to show deltas since the last time the user reviewed their goals |

`Expense`, `FinancialGoal`, and `GoalScenario` all carry `updatedAt`/`deletedAt`
instead of being hard-deleted — this is what makes last-write-wins cloud sync and
soft deletes possible (see below).

## State management (`src/ExpensesContext.tsx`)

A single `ExpensesProvider` wraps the app and is the only source of truth for
screens (`useExpenses()` hook). It owns:

- `expenses`, `profile`, `goals`, `scenarios`, `lastReview` — the app's full state
- Supabase auth state (`authUser`, `authLoading`, `authEnabled`, `signIn`/`signUp`/`signOut`)
- `syncing` / `syncError` flags

Every mutation (`addExpense`, `updateGoal`, `deleteGoal`, `updateProfile`,
`saveScenario`, `recordReview`, …) follows the same pattern:

1. Update React state optimistically
2. Persist to AsyncStorage (`src/storage.ts`)
3. If signed in, push/pull against Supabase (`syncState` → `src/sync.ts`) and
   reconcile local state with whatever the merge returns

Deletes are soft: `deleteExpense`/`deleteGoal`/`deleteScenario` set `deletedAt`
rather than removing the row, so the tombstone can sync to other devices. The
context filters out `deletedAt` rows before exposing `expenses`/`goals`/`scenarios`
to screens.

## Local persistence (`src/storage.ts`)

Thin AsyncStorage wrapper, one JSON blob per concern:

| Key | Contents |
|---|---|
| `expenses` | `Expense[]` |
| `financial-profile` | `FinancialProfile` |
| `financial-goals` | `FinancialGoal[]` |
| `financial-review` | `ProgressSnapshot` |
| `financial-scenarios` | `GoalScenario[]` |

This is the only persistence layer when Supabase isn't configured — the app is
fully usable offline/local-only.

## Cloud sync (`src/supabase.ts`, `src/sync.ts`, `supabase_schema.sql`)

- `src/supabase.ts` creates a Supabase client only if `EXPO_PUBLIC_SUPABASE_URL`
  and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set (`.env`); otherwise `supabase` is
  `null` and the whole app runs in local-only mode (`authEnabled: false`).
- `supabase_schema.sql` defines five tables — `profiles`, `expenses`, `goals`,
  `goal_scenarios`, `progress_reviews` — each row-level-secured to the
  authenticated `user_id`.
- `syncUserData()` in `src/sync.ts` runs on sign-in and after every mutation while
  signed in: it fetches the remote rows, merges them against local state by
  **row id, keeping whichever side has the newer `updatedAt`** (`mergeRows`), then
  upserts the merged result back to Supabase and returns it so the context can
  persist it locally too. See `SUPABASE_SETUP.md` for the setup walkthrough.

## Screens (`src/screens/`)

Navigation is a bottom-tab navigator (`App.tsx`) with four tabs:

- **Home** (`HomeScreen.tsx`) — expense list with category filter, a collapsible
  month calendar (daily totals, unusual-spend highlighting), and a collapsible
  category breakdown with percentage bars. Shows total/monthly spend at the top.
- **Add** (`AddExpenseScreen.tsx`) — single-purpose form: amount, category picker,
  optional note; navigates back to Home on save.
- **Goals** (`GoalsScreen.tsx`, ~1500 lines — by far the most complex screen) —
  goal planning and projection engine:
  - Computes available monthly budget from the profile (income − expenses − debt −
    emergency-fund contribution) and projects each goal's required monthly
    contribution, completion date, and surplus/shortfall (compound growth math).
  - **Insights panel**: a single collapsible section with three tabs —
    **Conflicts** (budget overload, deadline collisions, emergency-fund gaps,
    debt/goal competition), **Fixes** (actionable recommendations like "increase
    contribution" or "extend deadline", each with a one-tap apply action), and
    **Plans** (five priority strategies — essentials-first, earliest-deadline,
    long-term-growth, balanced, user-order — compared side by side and savable as
    a `GoalScenario`).
  - **Add-goal form** is collapsed behind a "+ ADD GOAL" trigger.
  - Each goal renders as a card with progress bar and headline stats; a
    "VIEW DETAILS" toggle reveals a feasibility/sensitivity breakdown (surplus
    under +10% income, −10% expenses, +10% savings, +2pt return scenarios).
  - A dashboard section tracks status counts (on track/at risk/unrealistic/
    complete), upcoming deadlines, and deltas since the last saved review.
- **Profile** (`ProfileScreen.tsx`) — edits the `FinancialProfile` (income,
  savings, debt, emergency fund, assumption rates), shows derived metrics
  (savings rate, debt/income ratio, emergency-fund coverage in months), and hosts
  Supabase sign-in/sign-up/sign-out when cloud sync is configured.
- **Stats** (`StatsScreen.tsx`) — a category breakdown view. **Defined but not
  wired into the tab navigator** — currently unreachable from the UI.

## Visual style

All screens share a consistent "retro terminal" aesthetic: monospace type,
hard-edged (non-rounded) borders, hard drop shadows, and a fixed palette (purple
`#5B2DB8`, pink `#D6009A`/`#FF4FD8`, teal `#00F5D4`, off-white `#F8F6FF`
background). Content is capped at a `maxWidth` (680–760px) and centered, which
also makes the layout read reasonably on the web build.

## Known gaps

- No automated tests.
- No ESLint config checked in (`npx expo lint` scaffolds one on demand but it's
  not committed); running it currently surfaces a handful of pre-existing
  `react-hooks`/purity warnings in `GoalsScreen.tsx` and `ProfileScreen.tsx`.
- `StatsScreen` exists but has no route pointing to it.
- `Alert.alert(...)` is a no-op under `react-native-web` — any web-facing
  confirmation flow needs a `Platform.OS === 'web'` branch to `window.confirm`
  instead (see the delete-goal confirmation in `GoalsScreen.tsx` for the pattern).
