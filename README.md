# Pokeworld

Browse and search Pokemon, open a Pokemon's details, and keep a private collection of the ones you have caught, each with the date you caught it. No signup: your collection belongs to your browser.

Built with Nuxt 4 (Vue), Nuxt UI, Nitro server routes as the API, SQLite, and [PokeAPI](https://pokeapi.co/docs/v2) for the Pokemon data. One app, one process.

## Quick start

You need Node 22.19 or newer (`.nvmrc` pins 22).

```bash
npm install
npm run dev
```

Open http://localhost:3000. There is nothing else to set up. The SQLite database is created at `data/pokeworld.db` the first time the app runs, and PokeAPI needs no key. The first page load fetches the Pokemon list from PokeAPI, so you need a network connection.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` then `npm run preview` | Production build, served locally |
| `npm run typecheck` | Type check (`nuxt typecheck`) |
| `npm test` | Unit, API and component tests |
| `npm run test:e2e` | End-to-end tests in a real browser (see below) |

## Configuration

All optional. They are read through Nuxt's `runtimeConfig`, so these environment variables override the defaults in `nuxt.config.ts`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `NUXT_DB_PATH` | `data/pokeworld.db` | SQLite file. `:memory:` works for throwaway runs |
| `NUXT_POKEAPI_BASE_URL` | `https://pokeapi.co/api/v2` | Where Pokemon data comes from |
| `NUXT_MAX_COLLECTION_SIZE` | `1000` | Most Pokemon one visitor can hold |
| `PORT` | `3000` | Port for the production server (`node .output/server/index.mjs`) |

## How it works

- **Your collection follows your browser.** The first request with no cookie gets a random ID in an `httpOnly` cookie (`pokeworld_visitor`, one year). Every collection query is scoped to that ID. The header shows a short label such as `Trainer #a3f9` so you can tell which collection is yours. Clearing cookies starts you with an empty collection.
- **The API is part of the app.** Nitro routes under `server/api/`:

  | Route | Does |
  | --- | --- |
  | `GET /api/pokemon?q=&type=&caught=&limit=&offset=` | Paged list. Search, type and "caught only" combine |
  | `GET /api/pokemon/:name` | Details: name, number, height, abilities, types, image |
  | `GET /api/types` | The types to filter by |
  | `GET /api/collection` | Your collection, most recent first, with caught dates |
  | `PUT /api/collection/:name` | Catch. Idempotent: catching twice keeps the first date |
  | `DELETE /api/collection/:name` | Remove one |
  | `DELETE /api/collection` | Reset |
  | `GET /api/me` | Your label |

- **PokeAPI is only called from the server**, and answers are cached in memory for the life of the process. Search, paging and the type filter are done on the server over the cached list, because PokeAPI has no search endpoint.
- **Search, filters and the details panel live in the URL** (`?q=&type=&caught=true&pokemon=name`). A reload or a shared link shows the same view, and closing the panel returns you to the screen you came from.
- **Grass types show their shiny image**, with a "Shiny" badge, everywhere the Pokemon appears: the list, search results, your collection, and the details panel.

More detail is in `product/`: `1-user-stories.md`, `2-design.md` and `3-plan.md`.

## Tests

Nothing calls the live PokeAPI. Tests use a small fixture server with recorded, trimmed PokeAPI responses.

| Layer | What it covers | Run with |
| --- | --- | --- |
| Unit (Vitest) | Pure logic: image choice, collection store with an injected clock, formatting, request helpers | `npm test` |
| API (Vitest) | The real production server, over HTTP: routes, validation, tenancy, caching, cookies | `npm test` |
| Component (Vitest, Nuxt environment) | Screens, states, the collection composable | `npm test` |
| End to end (Playwright, Chromium) | Whole flows in a browser: browse, search, catch, reset, two visitors, keyboard, phone width, axe accessibility scans in light and dark | `npm run test:e2e` |

The end-to-end suite needs a browser once: `npx playwright install chromium`. It builds the app and runs it against the fixture server and a throwaway database, so it does not touch `data/pokeworld.db`.

Every user story in `product/1-user-stories.md` has at least one named test.

## Decisions and tradeoffs

- **"Grass type" means grass in any type slot**, not only the first. A dual type such as Lotad (water/grass) is a Grass type, so it shows shiny. This is the more literal reading of the brief.
- **A cookie identifies a visitor; it is not authentication.** Anyone who holds the cookie value can act as that visitor. That is fine here because there is nothing sensitive to protect, and it keeps the app signup-free. It also means the per-visitor cap is per visitor, not global: someone could mint new visitors to grow the database.
- **SQLite through `better-sqlite3`.** It ships prebuilt binaries, so `npm install` needs no compiler, and it does not require a very recent Node the way `node:sqlite` does. Write-ahead logging is on.
- **Caught times are ISO 8601 UTC** and are shown in your local time zone. SQLite's own `CURRENT_TIMESTAMP` is avoided because it has no zone and browsers would show it on the wrong day.
- **The PokeAPI cache has no size limit or expiry.** The data is effectively static, and the biggest thing cached is the Pokemon list (about 1,000 entries) plus one small record per Pokemon you open. Failures are not cached, so the next request retries. The server makes one attempt with a 10 second timeout; the browser retries a failed GET once.
- **Only Pokedex entries are browsable** (ids below 10,000). PokeAPI lists alternate forms such as megas and regional variants as separate entries from 10,001 up; showing them would add about a third more entries and unfamiliar numbers.
- **A collection is capped at 1,000 Pokemon per visitor**, above the number of Pokemon that exist, so a normal visitor never hits it.
- **Your collection is resolved from each Pokemon's details** so one that fails to load shows an error card with a retry and still counts. The cost is speed: on a cold cache, a very large collection does one PokeAPI lookup per Pokemon (eight at a time).
