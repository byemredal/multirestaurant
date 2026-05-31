-- 0023 — Move store profile notes into the content model (MR-DB-HARDENING-01 Slice 7C).
--
-- Additive only. Adds a JSON bag on "StoreContentSetting" that holds the
-- per-noteType (profile / story / operational) profile copy + translations, so
-- the admin profile-note read/write path can leave the legacy
-- "StoreProfileNote"(+Translation) tables. StoreProfileNote is marketing/profile
-- content — NOT legal — so it belongs to the content model, not any legal
-- canonical table. See docs/architecture/legacy-legal-profile-migration.md.
--
-- Shape of "profileNotesJson" (keyed by noteType):
--   {
--     "profile":     { "isPublished": true,
--                      "translations": [ { "locale": "tr", "title": "...", "body": "..." } ],
--                      "updatedAt": "..." },
--     "story":       { ... },
--     "operational": { ... }
--   }
--
-- No data mutation, no DROP. The legacy tables stay in place (read-only
-- fallback in code for pre-migration rows) until a verified cleanup slice (7E).

ALTER TABLE "StoreContentSetting"
  ADD COLUMN IF NOT EXISTS "profileNotesJson" JSONB NOT NULL DEFAULT '{}'::jsonb;
