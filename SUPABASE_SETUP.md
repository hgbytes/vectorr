# Supabase Setup

1. Create a Supabase project and enable Email authentication.
2. Run [supabase_schema.sql](supabase_schema.sql) in the Supabase SQL Editor. Re-run it after app updates; it is written to be migration-safe and adds sync tombstones/triggers to existing tables.
3. Copy the project URL and public anon key into `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

4. Restart Expo after changing `.env`.
5. Create an account from the Profile tab.

The app keeps using AsyncStorage while signed out or offline. After authentication, it synchronizes profiles, expenses, goals, saved goal scenarios, and progress reviews. Conflicting updates use last-write-wins based on `updated_at`. Row Level Security policies scope every row to `auth.uid()`.

The schema must be applied before cloud sync can succeed. If it has not been applied, the app silently keeps local data available and retries on the next authenticated session.
