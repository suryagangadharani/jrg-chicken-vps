# Vercel Deployment Guide — JRG Chicken

## Required Environment Variables

Add these in your Vercel project settings (Environment Variables):

```
SUPABASE_URL=https://sntqkbaqghjtufvzmanp.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNudHFrYmFxZ2hqdHVmdnptYW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTkzMDMsImV4cCI6MjA5OTY5NTMwM30.WhnCbUM9JHgRpPnIhxqz063PBNnlxHT7_emBXev4CZg
SUPABASE_PUBLISHABLE_KEY=<same as SUPABASE_ANON_KEY>
SUPABASE_PROJECT_ID=sntqkbaqghjtufvzmanp
VITE_SUPABASE_URL=<same as SUPABASE_URL>
VITE_SUPABASE_ANON_KEY=<same as SUPABASE_ANON_KEY>
VITE_SUPABASE_PUBLISHABLE_KEY=<same as SUPABASE_ANON_KEY>
VITE_SUPABASE_PROJECT_ID=<same as SUPABASE_PROJECT_ID>
```

> If you have a custom Supabase project, replace the values with yours.

## Deploy Steps

1. Make sure Vercel is connected to this Git repository.
2. Ensure Vercel is set to deploy the `main` branch.
3. Merge your latest Lovable edit branch into `main` and push.
4. Vercel will auto-build with `bun run build` and output to `.vercel/output`.
5. Open the deployed URL and hard-refresh (Ctrl+Shift+R or Cmd+Shift+R) to clear cache.

## Troubleshooting

- **Changes not visible**: Check that `main` has the latest commit. Vercel deploys from `main`, not the Lovable preview branch.
- **Build fails**: Verify all environment variables above are set in Vercel.
- **Blank page / 404**: Make sure `vercel.json` is committed and Vercel is using the TanStack Start framework preset.
