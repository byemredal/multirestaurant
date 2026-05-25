# Legacy migrations — archived for MR-ARCH-01 rebase

These files are the pre-rebase migration history (0001–0025).
They are **not applied** by `pnpm db:migrate` — the runner only reads
`*.sql` files at the top level of `apps/api/db/migrations/` and stops at
this directory.

Kept for reference so we can:

- Audit what the original schema looked like before the rebase.
- Re-derive intent (comments, backfill SQL) when extending the new baseline.

The clean baseline lives at the top level of `apps/api/db/migrations/`:

```
0001_core_extensions.sql
0002_identity_and_auth.sql
0003_tenancy_and_stores.sql
0004_country_platform_schema.sql
0005_legal_documents.sql
0006_onboarding.sql
0007_catalog_taxonomy.sql
0008_menu_and_store_catalog.sql
0009_cart_ordering_payment.sql
0010_commission_billing_baseline.sql
0011_indexes_constraints.sql
0012_dev_seed_data.sql
```

See `docs/architecture/adr/ADR-architecture-reset-track.md` and
`docs/planning/mr-architecture-reset-track.md` for the rationale.
