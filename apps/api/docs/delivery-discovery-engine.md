# Delivery Coverage & Restaurant Discovery Engine

> Architecture & implementation reference for the Lieferzonen discovery backbone.
> Status: **Phase 1 implemented** · Phase 2 / Phase 3 designed.

---

## 1. Purpose & scope

This system answers one question, fast and explainably:

> *"Given where a customer is, which restaurants can deliver to them, are they
> available right now, and in what order should they be shown?"*

It is **not** a restaurant filter. It is the long-term delivery-intelligence
backbone: address normalization, coverage matching, availability resolution,
ranking, and full traceability. Every decision the engine makes is logged so it
can be debugged, replayed, and later fed into ML ranking and logistics routing.

### Naming bridge (brief → codebase)

The brief uses generic names; the codebase has canonical names. This engine
uses the **codebase** names:

| Brief term                   | Codebase entity                |
|-------------------------------|--------------------------------|
| `restaurants`                 | `Store`                        |
| `restaurant_delivery_zones`   | `StoreServiceArea` (new)       |
| `restaurant_postal_codes`     | `StoreCoveragePostalCode` (new)|
| `customers`                   | `CustomerAccount`              |
| `customer_addresses`          | `CustomerAddress` (new)        |
| `temporary_session_addresses` | `SessionAddress` (new)         |
| `discovery_logs`              | `DiscoveryLog` (new)           |

The legacy `StoreDeliveryZone` table (postal codes as a JSON-text array) is
**kept and backfilled from**, not dropped — see §9.

---

## 2. Phased matching strategy

The engine never hardcodes "postal code". Coverage is resolved by a set of
**pluggable matchers**, each implementing one strategy. Adding a strategy is
adding a class — no rewrite of the pipeline.

| Phase | Strategy      | Mechanism                                  | Status        |
|-------|---------------|--------------------------------------------|---------------|
| 1     | `postal_code` | Exact `(countryCode, postalCode)` lookup   | **Implemented** |
| 2     | `radius`      | Haversine great-circle distance in SQL     | **Implemented** (data-gated) |
| 3     | `polygon`     | PostGIS `ST_Contains(area, point)`         | Designed (stub) |

A `StoreServiceArea` row carries a `matchStrategy` discriminator. One store can
own many service areas of mixed strategies (e.g. a tight polygon downtown plus
a wide radius for the suburbs). The matcher that owns a strategy only ever sees
rows of that strategy.

```
                       ┌─────────────────────────┐
   MatchContext  ─────▶ │   CoverageService       │
   {country,            │   (matcher registry)    │
    postalCode,         └───────────┬─────────────┘
    lat, lng}                       │  fan-out to supports()==true
                ┌───────────────────┼────────────────────┐
                ▼                   ▼                    ▼
        PostalCodeMatcher      RadiusMatcher        PolygonMatcher
        (Phase 1)              (Phase 2)            (Phase 3)
                └───────────────────┼────────────────────┘
                                    ▼
                       merge → best CoverageMatch per store
```

Merge rule: when several service areas of one store match, the engine keeps the
one with the **lowest `priority`**, breaking ties by lowest `distanceKm`, then
lowest `deliveryFee`.

---

## 3. Data model

All tables follow existing project conventions: quoted PascalCase table names,
quoted camelCase columns, `UUID` PKs, `TIMESTAMPTZ`, `CHK_/UQ_/_fkey` naming.
See migration `0017_delivery_discovery_engine.sql`.

### 3.1 Address tables

A single canonical **address shape** is shared by saved and session addresses:

```
country (countryCode)  ·  canton/state  ·  city  ·  postalCode
street  ·  houseNumber  ·  addressLine2
latitude / longitude   ·  formattedAddress
```

**`CustomerAddress`** — persistent, owned by a `CustomerAccount`.
- `isDefault` with a *partial unique index* (`WHERE isDefault = TRUE`) → at most
  one default per customer, enforced by the database, not application code.
- `label`, `recipientName`, `contactPhone`, `deliveryNotes` for checkout reuse.

**`SessionAddress`** — anonymous / pre-login.
- Keyed by an opaque `sessionToken` (random, in a cookie or returned to the SPA).
- `expiresAt` TTL (30 days) → janitor job / `DELETE ... WHERE expiresAt < now()`.
- `claimedByCustomerAccountId` records when an anonymous address was later saved
  by a logged-in user — this is the anonymous→authenticated bridge and a
  conversion-analytics signal.
- `source` (`postal_code` | `autocomplete` | `geolocation` | `manual`).

### 3.2 Coverage tables

**`StoreServiceArea`** — one delivery rule for one store.
- `matchStrategy` discriminator (`postal_code` | `radius` | `polygon`).
- Radius fields: `centerLatitude`, `centerLongitude`, `radiusKm`
  (CHECK: present iff strategy is `radius`).
- **Delivery economics live here, per area**: `minimumOrderAmount`,
  `deliveryFee`, `freeDeliveryThreshold`, `estimatedDeliveryMinutes`.
- `priority` for overlap resolution; `isActive` for soft toggling.
- `legacyDeliveryZoneId` → traceability back to `StoreDeliveryZone`.

**`StoreCoveragePostalCode`** — one row per (service area, postal code).
- `storeId` is **denormalized** here so the Phase-1 hot path is a single
  index-only scan on `(countryCode, postalCode)` with no join to resolve the
  store. `UNIQUE (serviceAreaId, countryCode, postalCode)`.

**`StoreCoveragePolygon`** — Phase 3.
- Ships now storing raw **GeoJSON in `JSONB`** (usable for display today).
- The PostGIS migration adds a `geometry(MultiPolygon, 4326)` column + GiST
  index; see §8.

### 3.3 Observability

**`DiscoveryLog`** — one row per discovery request: resolved context, which
strategies ran, candidate/eligible/returned/unavailable counts, ranking version,
and `durationMs`. No FKs (logs must survive entity deletion). This is the raw
material for funnel analytics ("postal code X returns 0 restaurants"), ranking
A/B evaluation, and replay.

### 3.4 Store additions

`Store` gains three columns used by availability + ranking:
`acceptingOrders` (manual kill-switch, distinct from open hours),
`isPromoted`, `discoveryWeight`.

---

## 4. Coverage vs. availability — a hard architectural split

A restaurant can **match coverage** yet be **unavailable**. The engine keeps
these orthogonal and reports both:

| Dimension      | Source of truth                                              |
|----------------|--------------------------------------------------------------|
| **Coverage**   | `StoreServiceArea` + coverage tables — *can it reach you?*    |
| **Availability** | `Store.status`, `Store.isActive`, `Store.acceptingOrders`, `StoreOpeningHour` — *will it serve you now?* |

Discovery returns covered-but-unavailable restaurants too, tagged with
`availability.available = false` and machine-readable `reasons[]`
(`store_inactive`, `not_accepting_orders`, `closed_now`, `store_unpublished`).
The UI can grey them out / show "opens at 11:00" instead of hiding them — and
the distinction is preserved in `DiscoveryLog.unavailableCount`.

Future scheduling ("order for 19:00") slots in here: a pre-order check would
test availability against a *future* timestamp instead of `now()`, with no
change to coverage matching.

---

## 5. Discovery pipeline

```
  request
    │
 1. Resolve MatchContext
    ├── sessionToken  → SessionAddress
    ├── explicit postalCode / lat,lng
    └── (auth flow) customer default CustomerAddress, resolved client-side
    │
 2. Normalize  (AddressNormalizationService)
    └── countryCode upper, postalCode validated per country, formattedAddress
    │
 3. Coverage match  (CoverageService → matchers)
    └── Map<storeId, CoverageMatch>     ← candidate set
    │
 4. Hydrate stores  (1 batched SQL: Store + review summary + open-now)
    │
 5. Resolve availability  (status/isActive/acceptingOrders/openNow → reasons[])
    │
 6. Apply filters  (openNow, freeDelivery, maxMinimumOrder, …)
    │
 7. Rank  (RankingService, weighted signals → score)
    │
 8. Log  (DiscoveryLog, best-effort, never blocks the response)
    │
    ▼
  { context, restaurants[], meta }
```

Steps 3 and 4 are the only DB-bound steps; both are single batched queries
(`ANY($ids::uuid[])`). The pipeline is O(matched stores), not O(all stores).

---

## 6. Ranking architecture

`RankingService` is **signal-based and versioned** (`RANKING_VERSION`, logged
per request so historical results stay explainable). The score is a weighted
sum of normalized (0..1) signals:

| Signal        | Phase 1 source                              | Direction |
|---------------|---------------------------------------------|-----------|
| distance      | `CoverageMatch.distanceKm` (radius/polygon) | closer ↑  |
| ETA           | `estimatedDeliveryMinutes`                  | faster ↑  |
| rating        | `StoreReview` avg                           | higher ↑  |
| popularity    | review volume (proxy; see below)            | higher ↑  |
| promoted      | `Store.isPromoted` + `discoveryWeight`      | boost     |
| availability  | available vs. covered-but-unavailable       | hard demotion |

Each result carries a `scoreBreakdown` so ranking is auditable per restaurant.
Weights are constants now; the next step is moving them to `platform_config`
for tuning without deploys.

**Future AI ranking** drops in as one more signal: a model emits a per-(context,
store) score, the service blends it at a configured weight, and `DiscoveryLog` +
`scoreBreakdown` provide the labelled training/eval data. Popularity should
graduate from "review count proxy" to a nightly `StorePopularityDaily`
materialized aggregate (orders, conversion, cancels) — schema-compatible swap.

---

## 7. API surface (Phase 1)

All routes are under the global prefix `api/v1`.

### Public — anonymous flow

`POST /public/discovery/session-address` — store a postal code / address for an
anonymous visitor; returns `{ sessionToken, address }`.

```jsonc
// request
{ "postalCode": "6300", "countryCode": "CH" }
// response 201
{ "sessionToken": "h7Qx…", "address": { "countryCode": "CH", "postalCode": "6300",
  "city": null, "formattedAddress": "6300", "source": "postal_code", "expiresAt": "…" } }
```

`GET /public/discovery/session-address/:token` — re-read a session address.

`GET /public/discovery/restaurants` — the discovery call. Accepts
`sessionToken` **or** `postalCode`(+`countryCode`) **or** `latitude`+`longitude`,
plus `openNow`, `freeDelivery`, `maxMinimumOrder`, `sort`, `limit`.

```jsonc
// GET /public/discovery/restaurants?postalCode=6300&countryCode=CH&sort=best_match
{
  "context": { "countryCode": "CH", "postalCode": "6300", "matchStrategies": ["postal_code"] },
  "restaurants": [
    {
      "id": "b000…", "name": "Zug Kitchen", "slug": "zug-kitchen",
      "coverage": { "matched": true, "serviceAreaName": "Zug Merkez",
                    "deliveryFee": 2.90, "minimumOrderAmount": 12.00,
                    "estimatedDeliveryMinutes": 28, "distanceKm": null },
      "availability": { "available": true, "openNow": true, "reasons": [] },
      "ranking": { "position": 1, "score": 0.83,
                   "breakdown": { "eta": 0.7, "rating": 0.96, "promoted": 0 } },
      "reviewSummary": { "averageRating": 4.8, "totalReviews": 120 }
    }
  ],
  "meta": { "candidateCount": 5, "eligibleCount": 5, "returnedCount": 5,
            "unavailableCount": 1, "rankingVersion": "v1", "durationMs": 11 }
}
```

### Customer — authenticated flow (`AuthTypes('customer')`)

```
GET    /customer/addresses              list saved addresses
GET    /customer/addresses/default      the default address (discovery entry point)
POST   /customer/addresses              create (first one auto-default)
GET    /customer/addresses/:id          read
PATCH  /customer/addresses/:id          update
POST   /customer/addresses/:id/default  promote to default
DELETE /customer/addresses/:id          delete
```

Authenticated discovery = the SPA reads `/customer/addresses/default`, then
calls `GET /public/discovery/restaurants` with that address's
`postalCode`/`lat,lng`. Keeping discovery auth-free keeps it cacheable at the
edge and identical for both flows.

> Frontend note: when `apps/web` starts calling these, register them in
> `apps/web/src/lib/api/api-groups.ts` per the project rule.

---

## 8. SQL & PostGIS examples

**Phase 1 — postal-code match (the hot path):**

```sql
SELECT sa."storeId", sa."id" AS "serviceAreaId", sa."deliveryFee",
       sa."minimumOrderAmount", sa."estimatedDeliveryMinutes", sa."priority"
FROM "StoreCoveragePostalCode" cpc
JOIN "StoreServiceArea" sa ON sa."id" = cpc."serviceAreaId"
WHERE cpc."countryCode" = 'CH'
  AND cpc."postalCode"  = '6300'
  AND sa."isActive" = TRUE
  AND sa."matchStrategy" = 'postal_code';
-- served by idx "IDX_StoreCoveragePostalCode_lookup" (countryCode, postalCode)
```

**Phase 2 — radius match (Haversine, no PostGIS needed):**

```sql
SELECT * FROM (
  SELECT sa."storeId", sa."id" AS "serviceAreaId", sa."radiusKm",
         6371 * acos(LEAST(1,
           cos(radians(:lat)) * cos(radians(sa."centerLatitude")) *
           cos(radians(sa."centerLongitude") - radians(:lng)) +
           sin(radians(:lat)) * sin(radians(sa."centerLatitude")))) AS "distanceKm"
  FROM "StoreServiceArea" sa
  WHERE sa."matchStrategy" = 'radius' AND sa."isActive" = TRUE
    AND sa."countryCode" = :country
) m
WHERE m."distanceKm" <= m."radiusKm"
ORDER BY m."distanceKm";
```

**Phase 3 — polygon match (PostGIS).** Enable + index:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "StoreCoveragePolygon"
  ADD COLUMN "area" geometry(MultiPolygon, 4326);
-- one-off backfill from the JSONB GeoJSON already stored:
UPDATE "StoreCoveragePolygon"
  SET "area" = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON("geojson"::text), 4326));

CREATE INDEX "IDX_StoreCoveragePolygon_area"
  ON "StoreCoveragePolygon" USING GIST ("area");
```

Match query:

```sql
SELECT cp."storeId", cp."serviceAreaId"
FROM "StoreCoveragePolygon" cp
JOIN "StoreServiceArea" sa ON sa."id" = cp."serviceAreaId"
WHERE sa."isActive" = TRUE AND sa."matchStrategy" = 'polygon'
  AND ST_Contains(cp."area", ST_SetSRID(ST_MakePoint(:lng, :lat), 4326));
```

For radius at scale, the same `geometry` column lets you replace Haversine with
`ST_DWithin(centroid::geography, point::geography, radiusKm * 1000)`, which a
GiST index can accelerate.

---

## 9. Migration strategy

`0017_delivery_discovery_engine.sql` is **additive and non-breaking**:

1. Creates the seven new tables + indexes.
2. Adds three `Store` columns with safe defaults.
3. **Backfills** `StoreServiceArea` + `StoreCoveragePostalCode` from every
   `StoreDeliveryZone` row: one `postal_code` service area per zone (carrying
   `legacyDeliveryZoneId`), and one coverage row per element of the JSON
   `postalCodes` array (`jsonb_array_elements_text`). Country is normalized
   to ISO-2 (`CH` default for the Swiss market).
4. `StoreDeliveryZone` is **untouched** — the existing
   `StoresService.listPublic` keeps working unchanged.

Migrations are forward-only, applied in filename order by `scripts/db-init.mjs`
inside one transaction each, tracked in `schema_migrations`.

### 9.1 Dual-write transition layer (implemented)

`DeliveryCoverageSyncService` (`apps/api/src/modules/discovery/`) mirrors every
legacy `StoreDeliveryZone` write into the normalized model so the two
representations cannot drift.

**Write paths.** `StoreDeliveryZone` is written from exactly one place —
`StoresService` (`create()` and `update()`). A repo-wide grep confirms no other
module touches the table; tenant onboarding and store-settings updates flow
through `StoresService`, so wiring those two methods covers every coverage,
postal-code and zone-config write path.

**How it works.** After the legacy write, still inside the **same
transaction**, `StoresService` calls
`coverageSync.syncFromLegacyZones(storeId, zones, country, timestamp)`:

1. Deletes the store's legacy-derived service areas
   (`legacyDeliveryZoneId IS NOT NULL`) — the FK cascade clears their postal
   rows. Independently-authored radius/polygon areas are **preserved**.
2. Recreates one `postal_code` `StoreServiceArea` per legacy zone (carrying
   `legacyDeliveryZoneId`) plus its `StoreCoveragePostalCode` rows.

`update()` also re-syncs when `Store.country` changes (it drives the normalized
`countryCode`) even if the zones themselves did not.

**Safety guards against partial writes / drift:**

- Both writes share one transaction → atomic. If the sync throws, the legacy
  write rolls back too — the two never diverge.
- `syncFromLegacyZones` calls `DatabaseService.isTransactionActive()` and
  **throws** if invoked outside a transaction — a non-atomic sync is rejected,
  not silently half-applied.
- Postal codes are trimmed, upper-cased, de-duplicated; the unique constraint
  + `ON CONFLICT DO NOTHING` makes re-runs idempotent.
- `DeliveryCoverageSyncService.resyncStore(storeId)` re-derives a store's
  normalized coverage from its current legacy zones in its own transaction —
  the drift-repair / backfill-reconcile tool.

**Source of truth.** The normalized tables are the long-term source of truth;
discovery reads them exclusively. `StoreDeliveryZone` is kept only for backward
compatibility (legacy `StoresService.listPublic`) and is still written so
nothing breaks. Note: the new availability/ranking columns (`acceptingOrders`,
`isPromoted`, `discoveryWeight`) exist only in the normalized schema and have no
legacy counterpart, so they need no dual-write.

**Next (separate phase, not done here):** migrate `listPublic` onto the
normalized tables, make the new model the *only* write target, then a later
migration drops `StoreDeliveryZone`.

---

## 10. Indexing strategy

| Index                                          | Serves                             |
|-------------------------------------------------|------------------------------------|
| `StoreCoveragePostalCode (countryCode, postalCode)` | Phase-1 match (primary hot path) |
| `StoreCoveragePostalCode (storeId)`             | store-scoped reads / cascades      |
| `StoreServiceArea (storeId)`                    | tenant zone management             |
| `StoreServiceArea (matchStrategy) WHERE isActive` | matcher scans (radius/polygon)   |
| `CustomerAddress (customerAccountId)`           | address list                       |
| `CustomerAddress (customerAccountId) WHERE isDefault` UNIQUE | one-default rule        |
| `SessionAddress (sessionToken)` UNIQUE          | session lookup                     |
| `SessionAddress (expiresAt)`                    | TTL janitor sweep                  |
| `DiscoveryLog (createdAt)` / `(countryCode, postalCode)` | analytics queries         |

Phase 3 adds the GiST index on `StoreCoveragePolygon.area`.

---

## 11. Scaling strategy

- **Read scaling.** Discovery is read-only and idempotent → cache
  `GET /public/discovery/restaurants` at the edge keyed by the normalized
  context; serve replicas. Coverage tables are small and change rarely → good
  candidates for an in-process LRU or Redis cache invalidated on zone edits.
- **Hot path.** Phase-1 match is one index-only scan; even millions of coverage
  rows stay sub-millisecond.
- **Service extraction.** `discovery` is already an isolated NestJS module with
  no cross-service imports — it owns its tables and talks to `Store` only by id.
  It can be lifted into a standalone Discovery Service behind the same HTTP
  contract with no caller changes.
- **Geo at scale.** Phase 3's PostGIS geometry + GiST handles nationwide polygon
  sets; partition `DiscoveryLog` by month and ship it to a warehouse.
- **Write path.** Coverage edits are low-frequency and tenant-scoped — no
  contention concern; the partial unique index handles the only race
  (concurrent "set default address").

---

## 12. Search input & geocoding providers

Phase 1 normalization is deterministic (no network): trim, upper-case the
country, validate the postal code per country (CH = `[1-9]\d{3}`), build
`formattedAddress`. Autocomplete and address→coordinates geocoding are a
documented extension point — `AddressNormalizationService` exposes a seam for a
`GeocodingProvider`.

| Provider                | Fit for Switzerland                                       |
|-------------------------|-----------------------------------------------------------|
| **Swisstopo / GeoAdmin API** | Official Swiss federal geocoder + address search; free, authoritative CH coverage. **Recommended primary for CH.** |
| **OpenPLZ / Swiss Post PLZ** | Canonical postal-code ↔ locality dataset for CH; ideal to seed a local `PostalCode` reference table. |
| Google Places           | Best-in-class autocomplete UX; paid, ToS-restricted on storage. |
| Mapbox                  | Good autocomplete + maps; paid; generous geocoding tier.  |
| Nominatim / OSM         | Free, self-hostable; rate-limited on the public endpoint — fine as a fallback or self-hosted. |

Recommended: Swisstopo as the primary CH geocoder, a locally-seeded Swiss postal
table for instant offline postal validation/autocomplete, with Google/Mapbox as
an optional premium autocomplete layer. The provider stays behind the interface
so swapping it never touches the discovery pipeline.

---

## 13. Future-proofing checklist

- [x] Strategy-pluggable matching (postal → radius → polygon, no rewrite).
- [x] Coverage / availability kept orthogonal; future scheduling fits in.
- [x] Versioned, signal-based ranking → AI ranking is one more signal.
- [x] Full per-request traceability (`DiscoveryLog`) → analytics + ML labels.
- [x] Module is self-contained → extractable as a microservice.
- [x] Schema PostGIS-ready (GeoJSON in JSONB now → geometry column later).
- [ ] Move ranking weights to `platform_config`.
- [ ] `StorePopularityDaily` materialized aggregate.
- [ ] Tenant write-path migration off `StoreDeliveryZone`, then drop it.
- [ ] Seeded Swiss `PostalCode` reference table + autocomplete endpoint.
```