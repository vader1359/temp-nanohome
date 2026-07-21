# Supabase (local)

Local Supabase stack config lives in `./config.toml`. To run the local stack:
`supabase start`. Teardown: `supabase stop`.

## Plan 00 clean reset

The tracked migration history intentionally does not contain the historical
catalog baseline migration. A native reset of the tracked directory therefore
fails when later migrations first reference `public.variants`.

Run the local-only recovery harness from the repository root:

```sh
supabase/plan00-local/run-clean-reset.sh
```

The harness copies the tracked migrations into a temporary Supabase workdir,
prepends the c680c8f catalog baseline from
`supabase/plan00-local/00000000000000_catalog_baseline.sql`, and runs
`supabase db reset --local --no-seed`. It then runs the pgTAP test, which loads
`fixtures.sql` and `seed.sql` exactly once. It never accepts or invokes
`--linked`, and it does not modify tracked migrations, seed data, generated
types, or the repository environment.
