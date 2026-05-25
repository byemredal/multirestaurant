# ADR — Catalog / Menu UX Organization

- Status: Proposed
- Date: 2026-05-25
- Sprint: MR-ARCH-06
- Related: `ADR-architecture-reset-track.md`, migrations 0001 (menu), 0009 (cuisines)

## 1. Context

- `apps/tenant/src/components/tenant/TenantStudio.tsx` is **2267 lines** and
  is the sole component behind the `dashboard/studio` route page. It mixes
  category, menu item, modifier group, and option editing in one mega-tab UI.
- DB model is already sensible: `MenuCategory` → `MenuItem` →
  `MenuOptionGroup` → `MenuOptionItem` (0001), with `Cuisine` + `StoreCuisine`
  (0009) for platform taxonomy.
- The partner panel already has solid route structure for orders
  (`orders/`, `orders/[orderId]`) and dashboard. Catalog is the outlier.
- Customer storefront productization is the current product priority — but
  partner-side catalog editing must be usable for that storefront to have
  realistic data.

## 2. Decision

Split the studio into **route pages + drawers + modals**, separating the
**store catalog** (tenant-owned) from **platform taxonomy** (admin-owned).
Mobile behavior is in-scope from day one.

### 2.1 Tenant routes (replaces `dashboard/studio`)

```
apps/tenant/src/app/
  catalog/
    page.tsx                              # default redirect → /catalog/menu
    layout.tsx                            # shared shell (tabs row, store switcher)
    menu/
      page.tsx                            # categories list
      [categoryId]/
        page.tsx                          # items in category
        items/[itemId]/page.tsx           # item detail (heavy edit)
    modifiers/
      page.tsx                            # modifier groups list
      [groupId]/page.tsx                  # options inside group
    availability/
      page.tsx                            # bulk availability / scheduling
    pricing/
      page.tsx                            # bulk pricing changes (CSV import later)
```

### 2.2 Interaction pattern

- **List pages are routes.** Each list view is its own page with its own URL,
  loading/empty/error/mobile states.
- **Create / quick-edit** lives in a **right-side drawer** opened from the
  list. The URL gets a query param (`?edit=<id>` or `?new=category`) so the
  drawer is shareable and deep-linkable. Closing the drawer pops back to the
  list.
- **Heavy detail** flows (e.g. menu item with image, options, allergens,
  schedule) use a **dedicated route** at `items/[itemId]/page.tsx`. A drawer
  is too cramped for that.
- **Destructive actions** (delete category, delete item with active modifier
  references) go through a confirmation **modal** that names the entity and
  warns about cascades.
- **Reorder** uses inline drag-handles on the list, persisted via a small
  `PATCH .../order` endpoint that takes the new array order.

### 2.3 Component split

Each route page imports small components — none over ~250 lines.

```
apps/tenant/src/components/catalog/
  menu/
    CategoryList.tsx
    CategoryListItem.tsx
    CategoryDrawer.tsx          # create/edit
    ItemList.tsx
    ItemListItem.tsx
    ItemDrawer.tsx              # quick edit
    ItemDetailForm.tsx          # heavy form for the detail route
  modifiers/
    GroupList.tsx
    GroupDrawer.tsx
    OptionList.tsx
    OptionDrawer.tsx
  shared/
    ListSearchInput.tsx
    ListEmptyState.tsx
    ListErrorState.tsx
    ListLoadingSkeleton.tsx
    DeleteConfirmModal.tsx
    ReorderHandle.tsx
```

Component names are scoped by their directory — `CategoryDrawer.tsx`, not
`CatalogMenuCategoryDrawer.tsx`. The directory `catalog/menu` already gives
context.

Shared, **cross-app** UI primitives (Drawer, Modal, ConfirmDialog, Skeleton)
go into `@lieferzonen/ui` per project rules.

### 2.4 Platform taxonomy (admin-owned)

These already have system-level data; they get their own admin routes,
**separate** from tenant catalog:

```
apps/admin/src/app/
  taxonomy/
    cuisines/page.tsx              # already partially exists
    dietary-tags/page.tsx          # new
    allergens/page.tsx             # new
    marketplace-categories/page.tsx # new
```

Tenants reference platform taxonomy from drop-downs on menu items, but
cannot create new taxonomy entries.

### 2.5 Required state coverage (per project rules)

Every list page must implement:

- **Loading** — skeleton list of N rows, not a spinner block.
- **Empty** — explanatory empty state with a primary CTA (create first item).
- **Error** — inline retry, not a toast that disappears.
- **Mobile** — single column, list rows with primary + secondary line; drawer
  becomes a full-screen sheet below `md`.

### 2.6 What the existing `TenantStudio.tsx` becomes

- Deleted at the end of MR-ARCH-06.
- Behavior fully migrated to the new routes/components.
- During migration, the old route stays behind a feature flag so we can flip
  per-tenant or per-env.

## 3. API surface

The DB model already supports this UI. New endpoints needed:

| Endpoint | Purpose |
|---|---|
| `PATCH /v1/stores/:id/menu/categories/order` | Persist drag-reorder. |
| `PATCH /v1/stores/:id/menu/categories/:catId/items/order` | Items reorder. |
| `PATCH /v1/stores/:id/menu/option-groups/order` | Modifier reorder. |
| `GET /v1/platform/taxonomy/cuisines` (already exists) | Tenant dropdowns. |
| `GET /v1/platform/taxonomy/dietary` (new) | Tenant dropdowns. |
| `GET /v1/platform/taxonomy/allergens` (new) | Tenant dropdowns. |

All added to `api-groups.ts` in the same PR that adds the controller.

## 4. Sprint scope

MR-ARCH-06 ships in two slices:

- **Slice A** — Routes + categories + items list/drawer. Keeps studio behind
  flag.
- **Slice B** — Modifiers, options, availability, pricing pages. Removes
  studio.

Anything more (CSV import, multi-store apply, bulk variant editing) is
out-of-scope for this sprint and goes into the backlog.

## 5. Risks

- **Migrating the existing 2267-line component without regressions.**
  Mitigation: list/drawer pattern is mechanical; ship behind a flag; ask a
  real tenant to dual-run for a day.
- **Drawer URL params conflicting with other query state.** Mitigation:
  namespace the params (`catalog_edit`, `catalog_new`).
- **Mobile drawer becoming unusable on small screens.** Mitigation: full
  sheet pattern below `md` — same as customer storefront's cart drawer.

## 6. What we explicitly do not build

- A drag-to-reorder UX across categories (only within).
- An AI menu writer or recipe importer.
- A no-code form builder for custom item attributes.
- A real-time multi-editor presence layer.
