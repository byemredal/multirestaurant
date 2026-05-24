# Customer Discovery — Frontend Integration

The customer-side **address → discovery → restaurant listing** experience,
built on the backend discovery engine. This layer is backend-driven: it never
fetches all restaurants and filters locally, and never duplicates discovery or
ranking logic.

## Layered architecture

```
 components/discovery/*          ← presentation (no fetching)
   LocationInput · RestaurantCard · RestaurantList · AddressSwitcherModal
        │
 lib/discovery/use-discovery.ts  ← DISCOVERY state machine (restaurant results)
 lib/discovery/discovery-context ← ADDRESS state machine (resolved location)
        │
 lib/discovery/discovery-api.ts  ← API contract layer (the only DTO-aware file)
 lib/discovery/location-provider ← autocomplete provider seam
 lib/discovery/discovery-storage ← localStorage persistence
        │
 backend  /public/discovery/* · /customer/addresses/*
```

Each layer depends only on the one below it and on the domain types in
`discovery-types.ts`. Backend DTO shapes never leak above `discovery-api.ts`.

## Two-part state machine

Discovery has two independent concerns, modelled as two explicit unions — never
collapsed into booleans.

**Address state** — owned by `DiscoveryProvider`:

| State | Meaning |
|---|---|
| `NO_ADDRESS_SELECTED` | Anonymous, no location chosen |
| `ADDRESS_LOADING` | Resolving (hydration / address fetch in flight) |
| `SESSION_ADDRESS` | Anonymous, location resolved from a session address |
| `AUTH_USER_NO_ADDRESS` | Authenticated, no saved address yet |
| `AUTH_USER_DEFAULT_ADDRESS` | Authenticated, active location is a saved address |

**Discovery state** — owned by `useDiscovery`:

| State | Meaning |
|---|---|
| `DISCOVERY_IDLE` | No location → no discovery request |
| `DISCOVERY_LOADING` | Request in flight |
| `DISCOVERY_EMPTY` | Resolved, no covering restaurants (no-coverage) |
| `DISCOVERY_READY` | Resolved with results |
| `DISCOVERY_ERROR` | Request failed |

Keeping them separate means a saved-address fetch failure never masquerades as
"no restaurants", and address switching is orthogonal to result rendering.

## Routing — the URL is authoritative

Canonical routes:

| Route | Renders |
|---|---|
| `/` | Marketing landing + location entry |
| `/{mode}/food/{region}` | Discovery for that postal code |

`region` is a postal-first slug — `8001-zurich` or the bare `8001`
(`home-discovery.ts` → `slugifyRegion` / `findRegionBySlug` /
`buildDiscoveryPath`). The route segment is parsed in `HomeExperience` and
passed to `DiscoveryProvider` as `routePostalCode` — the provider never reads
`window.location`.

There is exactly one source of truth for the active location: **the URL**.
Selecting a location (landing search, address switcher, saved address, mode
toggle) only calls `router.push` / `router.replace`; the provider re-resolves
from the new route. No component holds a competing copy of the active address.

## Data flow

**Anonymous:** landing → `LocationInput` → `router.push('/delivery/food/8001')`
→ `DiscoveryProvider` resolves `routePostalCode` → `POST .../session-address`
(or reuses a stored token) → `useDiscovery` → `RestaurantList`.

**Authenticated:** login → `DiscoveryProvider` reads the auth session →
`GET /customer/addresses/default`; on `/` `HomeExperience` `router.replace`s to
the default address's discovery URL → discovery runs.

**Address switch:** `AddressSwitcherModal` (opened from the header — the single
location control) → `router.push` the new discovery URL → provider re-resolves.

**Refresh / deep link / shareable URL:** the postal code lives in the URL, so a
refresh or a pasted link re-renders the same discovery state server-side. The
localStorage snapshot only speeds the first paint and lets the same session
token be reused.

**Back / forward:** browser navigation changes the route segment →
`routePostalCode` changes → the provider re-resolves. URL ↔ state stay in sync
because state changes are *expressed as* navigation, never applied directly.

**Login/logout:** `auth-session.ts` dispatches `lieferzonen:auth-changed`
(same-tab) and the `storage` event covers cross-tab; `DiscoveryProvider`
re-resolves on both.

## localStorage lifecycle

Keys: `discovery.session-token`, `discovery.location-snapshot`. They represent
the **anonymous working location** and are authoritative *only while logged
out*.

| Event | Behaviour |
|---|---|
| Resolve a postal code | If a stored token's snapshot matches the postal code, the token is re-validated and reused; otherwise a new session address is created and stored. |
| Stale / expired token | `GET .../session-address/:token` returns 404 → storage cleared → a fresh session is created. |
| Login (account has saved addresses) | Account address context takes over; stale anonymous storage is cleared. |
| Login (account has no saved address) | The session location is kept as the transitional working location; the "save your address" nudge is shown. |
| Logout | Anonymous storage is cleared; resolution falls back to the URL. |

**Decision — anonymous vs. authenticated state never compete.** When
authenticated, resolution authority is URL → account default; the session
token is only ever used as the handle for a postal code that is not a saved
address (a transient working location), and is never allowed to override the
account default on `/`.

## Coverage vs. availability

A restaurant can match coverage yet be unavailable. `availability.ts` maps the
backend's machine-readable reasons (`closed_now`, `not_accepting_orders`,
`store_inactive`/`store_unpublished`) into never-hidden UI states — unavailable
restaurants are dimmed and badged, not removed.

## Future extensibility

- **Geocoding providers.** Implement `LocationSearchProvider` (Swisstopo /
  Google Places / Mapbox / Nominatim) and pass it to `LocationInput`. No UI or
  state changes. The default proxies the app's `/api/location-search` route.
- **Radius / polygon discovery.** `CustomerLocation` already carries
  `latitude`/`longitude`; the API layer sends them when no postal code exists.
- **Mobile reuse.** `lib/discovery/*` is framework-light — only
  `discovery-context`/`use-discovery` touch React. The API, storage, types and
  provider layers are portable to a React Native app.
- **Saved-address management.** `discovery-api.ts` already exposes the address
  endpoints; a full CRUD screen can build on `fetchCustomerAddresses`.

## Discovery query contract

`GET /public/discovery/restaurants` (all filtering is backend-driven):

| Param | Purpose |
|---|---|
| `sessionToken` / `postalCode`+`countryCode` / `latitude`+`longitude` | location |
| `openNow`, `freeDelivery`, `maxMinimumOrder` | availability / economics filters |
| `category` | store / merchant type (single) |
| `cuisines` | comma-separated cuisine slugs (matches ANY) |
| `sort` | `best_match` · `eta` · `distance` · `delivery_fee` · `min_order` · `rating` |
| `limit`, `offset` | pagination |

The response carries `facets.categories` / `facets.cuisines` (with counts,
computed from the full coverage set so a filter never hides other options) and
`meta.total` for pagination. The frontend only passes params and renders —
ranking and filtering stay on the server.

## Known scope boundary

Delivery-mode (`pickup`) discovery is not yet a server capability: the coverage
engine matches delivery zones. Pickup matching (store-postal-area based) is a
separate path, deliberately deferred — fulfillment mode currently lives only in
the URL/header. Polygon/radius matching ships when those matchers are enabled
server-side.
