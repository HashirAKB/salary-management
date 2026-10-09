# ADR 0007: React, Vite, Mantine 9, TanStack Query, filters in the URL

- Status: Accepted
- Date: 2026-10-09

## Context

The user is an HR manager working in a data-dense admin tool:
- a paged and filtered list of 10,000 employees;
- detail and edit forms with date pickers;
- salary history;
- insight tables and charts.

All paging, sorting and filtering happen on the server (H3). Filters must live in the URL so views can be shared and reloaded (F2). The brief requires React or Next.js and a component library of our choice.

## Decision

- **React 19.2 with Vite.** Plain client-side app, served by the API (ADR 0002).
- **Mantine 9:**
  - `@mantine/core` for layout, tables, inputs and modals;
  - `@mantine/dates` for date pickers;
  - `@mantine/form` with a zod resolver for forms;
  - `@mantine/charts` for charts (built on Recharts 3).
- **TanStack Query** for server state: caching, loading and error states, and invalidation after an edit.
- **React Router** in declarative mode. List filters are read from and written to search params through a `useEmployeeFilters` hook that parses them with the shared zod schema.
- **No TanStack Table.** With server-side paging and sorting, a Mantine `Table` plus a pager component covers the list.

## Alternatives considered

- **shadcn/ui.** Good-looking and flexible, but it copies component source into the repo and needs Tailwind and Radix setup. That adds code to review and maintain, and takes time away from the product.
- **MUI.** Mature, but heavier styling system and a more verbose API for the same result.
- **Next.js.** Server rendering and file routing are of no value behind a login, and would complicate same-origin serving from Fastify.
- **TanStack Router.** Its typed, validated search params fit "filters in the URL" well. React Router plus a small zod-parsing hook gives the same result with a router I already know. Worth revisiting if the app grows.
- **Redux or Zustand.** No meaningful client-only state beyond the URL and the server cache.

## Consequences

- One library supplies tables, forms, dates and charts with a consistent look, so UI polish is cheap and can be cut first if time runs short.
- Mantine 9 requires React 19.2 or later, which pins the React version.
- Copying a URL reproduces the exact filtered view, which also serves CSV export (F7: the export uses the same query string).
