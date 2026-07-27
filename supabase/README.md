# Supabase (local)

Local Supabase stack config lives in `./config.toml`. To run the local stack:
`supabase start`. Teardown: `supabase stop`.

## Plan 00 clean reset

The tracked migration history intentionally does not contain the historical
catalog baseline migration. A native reset of the tracked directory therefore
fails when later migrations first reference `public.variants`.

Run the local-only recovery harness from the repository root:

```sh
supabase/plan00-local/run-clean-reset.sh --target foundation
supabase/plan00-local/run-clean-reset.sh --full
# Runs reset and lint, then only the direct local Instagram pg_prove suite.
supabase/plan00-local/run-clean-reset.sh --target instagram
```

The harness copies the tracked migrations into a temporary Supabase workdir,
prepends the c680c8f catalog baseline from
`supabase/plan00-local/00000000000000_catalog_baseline.sql`, and runs
`supabase db reset --local --no-seed`. The Foundation target runs only
Foundation-named suites; the full target discovers every non-helper SQL suite
under `supabase/tests/`. It normalizes copied suite seed includes to one canonical disposable path. It never accepts or invokes
`--linked`, and it does not modify tracked migrations, seed data, generated
types, or the repository environment. The full target runs the Instagram suite
only after the normal suites pass, in a local `pg_prove` image connected directly
to the verified disposable database container; it fails closed if that image is
not already available locally. `--target instagram` is an explicit local-only
Foundation harness seam for isolating that direct runner after reset and lint;
it bypasses the normal suites and is not the full validation mode. Each run uses
a unique temporary workdir basename and accepts only the newly created database
container whose exact Supabase and Docker Compose project labels match it.
