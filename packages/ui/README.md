# @lieferzonen/ui

Shared React UI components for the Lieferzonen frontend apps.

## Scope

This package is the home for **reusable, app-agnostic UI components**. New
shared components must be added here instead of being re-implemented inside
each app.

Current components:

- **Actions** — `Button` (`shimmer`, `loading`, icon slots), `IconButton`
- **Surfaces** — `Card` (`interactive`, `flat`), `Divider`
- **Data display** — `Badge`, `Avatar`, `Spinner`, `Skeleton`, `Progress`, `Rating`
- **Feedback & overlays** — `Alert`, `Tooltip`, `Modal`
- **Navigation & disclosure** — `Tabs`, `Accordion`
- **Form controls** — `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`,
  `Switch`, `FileDropzone`
- **Branding** — `Logo` / `PlatformLogo`
- Plus the `cn` class-name helper.

Interactive components (`Tabs`, `Accordion`, `Modal`, `Rating`, `FileDropzone`)
are `'use client'`. The rest are shared components usable in server or client
trees. `Checkbox`, `Radio` and `Switch` are styled native inputs (no JS state),
so they work controlled or uncontrolled.

`Logo` and `PlatformLogo` render the platform logo uploaded in the setup
wizard (`GET /config/branding`). They are styling-agnostic (inline styles
only) so they work in **every** app, including the CSS-variable admin
design system — no Tailwind theme tokens required.

## Consuming the package

An app that uses `@lieferzonen/ui` must:

1. Add the workspace dependency:
   `"@lieferzonen/ui": "workspace:*"`
2. Transpile it in `next.config.mjs`:
   `transpilePackages: ['@lieferzonen/ui']`
3. Include it in `tailwind.config.js` `content`:
   `'../../packages/ui/**/*.{js,ts,jsx,tsx}'`

The components are Tailwind-class based and currently expect the green brand
theme tokens (`primary`, `ink`, `brand`, `success`, `danger`, …) to be
defined in the consuming app's Tailwind config. `apps/tenant` and `apps/web`
already define them; `apps/admin` and `apps/setup` use a different
(CSS-variable) design system and are **not** consumers yet — adopting the
package there is a styling change, not just a move.

## Usage

```tsx
import { Button, Input } from '@lieferzonen/ui';
```
