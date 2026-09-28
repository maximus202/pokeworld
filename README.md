# Pokeworld

Browse Pokemon from [PokeAPI](https://pokeapi.co/docs/v2), search and filter them, open a details
side panel, and keep your own private collection, with the date you caught each one, all without
signing up.

Built with Nuxt 4 (Vue), Nuxt UI and SQLite (`better-sqlite3`). The API is Nuxt server routes in
the same app as the frontend, so there is one process and one `npm run dev`.

## Run it

Requires **Node >= 22.19** (Nuxt 4 needs it; `.nvmrc` pins Node 24).

```bash
nvm use          # optional, picks Node 24 from .nvmrc
npm install
npm run dev      # http://localhost:3000
```

The SQLite file is created on first use at `data/pokeworld.db` (git-ignored). `better-sqlite3`
ships prebuilt binaries, so there is no compile step.

| Env var | Default | Purpose |
| --- | --- | --- |
| `DB_PATH` | `data/pokeworld.db` | SQLite file (`:memory:` works) |
| `POKEAPI_BASE_URL` | `https://pokeapi.co/api/v2` | Upstream API (tests point this at a fixture server) |

For a production build (`npm run build`, then `npm run preview`), set the runtime equivalents:
`NUXT_DB_PATH`, `NUXT_POKEAPI_BASE_URL`, and optionally `NUXT_MAX_COLLECTION_SIZE` (default 1000).

## What it does

- **Browse and search:** the full Pokemon list with "Load more", a case-insensitive name search,
  a type filter, and a "Caught only" toggle. All three combine, and they are kept in the URL so a
  filtered view survives a reload.
- **Details side panel:** name, height, types, abilities and artwork. It is driven by
  `?pokemon=name`, so closing it returns you to where you were and a link opens it directly.
- **Shiny Grass Pokemon:** anything with grass as a type shows its shiny form, with a "Shiny"
  badge, in the list, filters, collection and panel.
- **Collection:** catch and remove from the panel, remove straight from the collection grid, or
  reset everything (with a confirmation). Each Pokemon shows **when you caught it**, in your local
  time, and the collection is ordered most recent first.
- **Private, no login:** each browser gets its own collection and a label like "Trainer #a3f9".
- **Failure states:** loading skeletons, empty states, and errors with a retry for the list, the
  panel and the collection.
- **Accessible colours:** text meets WCAG AA contrast (checked with axe-core), and everything works
  by keyboard and at phone width.

## Decisions and tradeoffs

- **Shiny means "grass in any type slot".** The brief says "if the Pokemon is a Grass type". A
  dual type such as Lotad (water/grass) is a Grass type, so it shows shiny too. Changing this to
  primary-type-only is a one-line change in `server/utils/pickImage.ts`.
- **A cookie identifies the visitor; it is not authentication.** Each browser gets a random UUID
  in an `httpOnly` cookie, and the collection is stored against it. Anyone who holds the cookie
  value can act as that visitor, and clearing cookies gives you a fresh, empty collection. That
  meets "independent of other users" with no signup, and real auth is the first item below.
- **SQLite via `better-sqlite3`.** Zero setup and a real relational store. It ships prebuilt
  binaries, and it avoids requiring a very recent Node for the built-in `node:sqlite`.
- **Catch times are ISO 8601 UTC strings**, written by the app rather than SQLite's
  `CURRENT_TIMESTAMP`, which has no time zone and would show the wrong day in some zones. The
  browser formats them in the visitor's local zone.
- **PokeAPI is only called from the server**, and never from the browser. Search and the type
  filter are done server-side because PokeAPI has no search endpoint: the name list is fetched
  once, and the type lists once per type.
- **Responses are cached in memory for the life of the process,** with no size limit or expiry.
  PokeAPI data is effectively static and the cache holds at most the index, the type lists and the
  Pokemon actually viewed. Failed requests are never cached.
- **Only the 1,025 Pokedex Pokemon are included, not alternate forms.** PokeAPI also lists
  mega evolutions and regional variants as separate entries (326 of them, numbered from 10001).
  They would clutter the list, so they are left out of browsing, search and catching.
- **Catching validates the Pokemon** against the cached name list first, so the collection can
  only hold real Pokemon, the count always matches what the grid can show, and a made-up name
  never costs a request to PokeAPI.
- **Each visitor is capped at 1,000 Pokemon,** so one visitor cannot grow the database without
  bound. It is above the number of Pokemon that exist, so normal use never reaches it.
- **The collection is joined on the server.** `GET /api/collection` returns each caught Pokemon
  with what the grid needs in one request, looking them up at most 8 at a time. If PokeAPI is down after a restart, entries still come
  back (marked as unloadable) so the count and dates are right and the UI can offer a retry.
- **The header count is rendered on the server,** so it is correct on the first paint. The
  visitor middleware writes a newly issued ID into the request's cookie header so the server-side
  requests made while rendering see the same visitor as the browser will.

The full design is in [`product/2-design.md`](product/2-design.md), with the user stories in
[`product/1-user-stories.md`](product/1-user-stories.md) and the build plan in
[`product/3-plan.md`](product/3-plan.md).

## What I would do next

- Real authentication, so a collection follows you across browsers and devices.
- A shared cache (for example Redis) with a TTL, instead of a per-process in-memory one.
- Rate limiting on the write routes.
- CI to run the unit, API, component and end-to-end suites on every push.
- Sorting the collection (by number or name) and a per-Pokemon "notes" field.

## Tests

```bash
npm test                              # unit + API + component (Vitest); the API tests build and boot the app
npx playwright install chromium       # once
npm run test:e2e                      # end-to-end (Playwright, Chromium)
npm run typecheck
```

Tests never call the live PokeAPI: they use recorded fixtures in `tests/fixtures/`, served by a
small stand-in server that can also be told to fail, and a throwaway database.

| Layer | What it covers |
| --- | --- |
| Unit | the shiny image rule, the collection store (catch dates, ordering, cap, persistence), formatting |
| API | every route against a real running server: tenancy between visitors, catch validation, filters, caching, upstream failures, catching after a restart |
| Component | image fallback, cards, and the details panel (catch and remove, caught date, error and retry) |
| End-to-end | the user flows in a real browser: browse, search, filter, panel, catch, remove, reset, "Caught only", two isolated visitors, phone width and keyboard use |
