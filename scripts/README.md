Backfill script: `backfill_roles.js`

Purpose
- Set `user_metadata.role` for existing Supabase users that were created before `role` was added to the registration flow.
- The script derives `role` from existing `user_metadata.summary_mode` when present, otherwise defaults to `dokter_patologi`.

Usage
1. Install dependencies (if you haven't already):

```bash
npm install @supabase/supabase-js
```

2. Dry run (preview only):

```bash
SUPABASE_URL=https://<your-project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> \
node scripts/backfill_roles.js --dry
```

3. Apply updates (perform writes):

```bash
SUPABASE_URL=https://<your-project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> \
node scripts/backfill_roles.js --apply
```

Security
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret. Do not commit it to the repo.
- Run `--dry` first to verify the changes the script will make.

Notes
- The script uses the Supabase Admin API (`auth.admin.listUsers` / `auth.admin.updateUserById`). It is idempotent (it only updates users missing `role`).
- If your user base is large, you may want to run the script in smaller batches or add rate-limiting.
