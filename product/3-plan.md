# Pokeworld implementation plan

## Context

`product/2-design.md` specifies a Pokemon browser: list, search, details side panel, per-browser
collection (cookie-identified "visitor", no login), and a shiny image for grass types. The repo is
greenfield (only `product/` and `standards/` exist, not a git repo). Standards: Nuxt + Vue + Nuxt UI,
Nitro server routes as the API, Pokemon-website-like palette.

Decisions made while planning (design doc to be updated to match):

1. **SQLite via `better-sqlite3`, not `node:sqlite`.** Users must not need to install or upgrade Node
   (local is v22.0.0). `better-sqlite3` ships prebuilt binaries, so no compile step. Remove the
   "Node >= 22.13 / `.nvmrc` / `engines`" requirement from the Storage bullet.
2. **Shiny everywhere.** List, search results, collection and details all show shiny for any grass-typed
   Pokemon. This replaces the design's "list shows default image only" and changes `/api/pokemon` (see step 4).

## Steps

### 1. Scaffold
- `npx nuxi init` in `/Users/maxratto/Herd/pokeworld` (Nuxt 4, TypeScript), then add `@nuxt/ui`,
  `better-sqlite3` (+ `@types/better-sqlite3`), and dev deps: `vitest`, `@nuxt/test-utils`,
  `@vue/test-utils`, `happy-dom`, `@playwright/test`.
- `.gitignore`: `data/`, `node_modules`, `.nuxt`, `.output`, test artefacts.
- Scripts: `dev`, `build`, `test` (vitest), `test:e2e` (playwright).
- Nuxt UI theme: override primary colour tokens to Pokemon-site palette (red `#EE1515`-family primary,
  yellow `#FFCB05` accent, dark grey text, white surfaces) in `app.config.ts` / CSS variables.
- `runtimeConfig`: `pokeapiBaseUrl` (env `POKEAPI_BASE_URL`, default `https://pokeapi.co/api/v2`),
  `dbPath` (env `DB_PATH`, default `data/pokeworld.db`).

### 2. Server foundations (`server/`)
- `utils/pickImage.ts`: pure `pickImage(pokemon) -> { url, shiny }`. Shiny if `types` includes `grass` in
  any slot; prefers `sprites.other["official-artwork"].front_(shiny|default)`, falls back to
  `sprites.front_(shiny|default)`.
- `utils/collectionStore.ts`: `createCollectionStore(db)` with `list / add / remove / reset` (all filtered
  on `visitor_id`, parameterised, `INSERT OR IGNORE` for idempotent catch). Table
  `collection(visitor_id TEXT, name TEXT, PRIMARY KEY(visitor_id, name))`, created if missing.
- `utils/db.ts`: lazy singleton opening `better-sqlite3` at `runtimeConfig.dbPath` (creates `data/` dir;
  `:memory:` allowed), wrapped by `createCollectionStore`.
- `utils/pokeapi.ts`: fetch wrapper with an in-process `Map` cache. Provides `getPokemon(name)`,
  `getNameIndex()` (one `GET /pokemon?limit=100000`, ids parsed from result URLs) and
  `getGrassNames()` (one `GET /type/grass` -> a `Set` of names with grass in any slot).
- `utils/name.ts`: lower-case + validate `^[a-z0-9-]{1,100}$` (400 on failure).
- `middleware/visitor.ts`: if `pokeworld_visitor` cookie is not a valid UUID, generate one and set
  it (`httpOnly`, `SameSite=Lax`, 1 year, `Secure` in production only); store id on `event.context.visitorId`.

### 3. Collection + visitor routes (`server/api/`)
- `me.get.ts` -> `{ label: "Trainer #" + first 4 chars }`
- `collection/index.get.ts` (names), `collection/index.delete.ts` (reset)
- `collection/[name].put.ts`, `collection/[name].delete.ts` (idempotent, validated)

### 4. Pokemon routes (`server/api/pokemon/`)
- `index.get.ts` (`q`, `limit`, `offset`): filter name index (case-insensitive substring), paginate, return
  `{ items: [{ id, name, imageUrl, shiny }], total }`. `shiny` comes from `getGrassNames()`; `imageUrl` is
  derived from the id with the PokeAPI sprites-repo pattern, using the `official-artwork/shiny/{id}.png`
  path when shiny and `official-artwork/{id}.png` otherwise. No per-Pokemon upstream request.
  (Design deviation: `total` added so the UI can paginate; `shiny` added for the badge.)
- `[name].get.ts`: `{ id, name, height, abilities, types, image: { url, shiny } }` via `pickImage`; 404 for unknown.
- Collection screen resolves each caught name through `/api/pokemon/:name` (cached), so it uses the
  details image and shiny rule directly.

### 5. Frontend (`app/`)
- `app.vue` + layout: header with "Trainer #xxxx" (`GET /api/me`), nav (Pokemon / My Collection), search
  input, and "Reset my collection" (Nuxt UI modal confirm -> `DELETE /api/collection`).
- `pages/index.vue`: list + search (debounced `q`), Nuxt UI cards/grid, "Load more" or pagination,
  empty state "no matches".
- `pages/collection.vue`: resolves caught names to cards.
- `components/PokemonCard.vue`: image + name, shows "Shiny" badge when `shiny`; `@error` image fallback.
- `components/PokemonPanel.vue`: Nuxt UI `USlideover` side panel. Name, height (dm -> m and ft), abilities,
  image + "Shiny" badge, Catch/Remove button. Driven by a `?pokemon=name` query param so closing returns to
  the previous screen and the panel is deep-linkable.
- `composables/useCollection.ts`: shared reactive set of caught names, `catch/remove/reset`, refetched on load.

### 6. Tests (per design section 3)
- `tests/fixtures/`: trimmed PokeAPI JSON for `bulbasaur`, `lotad`, `charmander`, a no-artwork Pokemon,
  the name list, and `type/grass`. `tests/fixtures/server.ts`: tiny HTTP fixture server that counts requests.
- Unit: `pickImage` (grass primary, grass secondary, non-grass, artwork fallback).
- API (`@nuxt/test-utils`, `DB_PATH=:memory:`, `POKEAPI_BASE_URL` -> fixture server): list/paging/search,
  details + 404, shiny in list items, caching (fixture request counts), collection catch/remove/reset
  idempotency, name validation 400, cookie issue/replace, two-visitor isolation.
- Store: persistence after close/reopen on a temp file.
- Component: card/panel shiny badge, Catch/Remove button flip.
- E2E (Playwright, Chromium, throwaway DB, fixture server): list, search, panel open/close, catch/remove,
  reset with cancel, two browser contexts with different labels and isolated collections, reload persistence.

### 7. Docs
- `README.md`: run instructions, cookie-is-not-auth note, `better-sqlite3` note, test commands
  (`npx playwright install chromium` for E2E).
- Update `product/2-design.md`: Storage bullet (better-sqlite3, no Node pin), Section 1 scope and list API
  (shiny + `getGrassNames`), and Node requirement removal.

## Critical files
`nuxt.config.ts`, `app.config.ts`, `server/middleware/visitor.ts`, `server/utils/{pickImage,collectionStore,db,pokeapi,name}.ts`,
`server/api/**`, `app/pages/{index,collection}.vue`, `app/components/{PokemonCard,PokemonPanel}.vue`,
`app/composables/useCollection.ts`, `tests/**`, `playwright.config.ts`, `vitest.config.ts`.

## Verification
1. `npm install` on the current Node 22.0.0 succeeds (better-sqlite3 prebuilt binary loads).
2. `npm test` passes (unit, API, component).
3. `npm run test:e2e` passes against the fixture server.
4. Manual: `npm run dev`, then check list, search "bulb", open bulbasaur (shiny + badge) and charmander
   (default), catch/remove, reset, and a private window showing a different Trainer label.
5. `curl -i localhost:3000/api/me` shows `Set-Cookie: pokeworld_visitor=...; HttpOnly; SameSite=Lax`.
