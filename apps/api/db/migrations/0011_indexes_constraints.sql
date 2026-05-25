-- 0011 — Cross-cutting indexes + constraints.
--
-- Each table file (0002–0009) ships its primary indexes inline with the
-- CREATE TABLE. This file is reserved for cross-cutting indexes that depend
-- on multiple domains, or extra performance indexes added after profiling.
--
-- Today the baseline has none — keeping the file as an explicit, numbered
-- slot makes it easy to land a "performance pass" migration later without
-- inflating the per-domain files or invalidating the existing numbering.

-- no-op
SELECT 1 WHERE FALSE;
