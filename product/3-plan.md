# Plan

Implementation plan for `1-user-stories.md` and `2-design.md`. Work happens on the
`implementation` branch, in small commits, each leaving the tests green.

## Context

Pokeworld is a Pokemon reference app for a take-home assessment: browse and search Pokemon, open
details (name, height, abilities, shiny image for Grass types), and keep a private collection with
the date each Pokemon was caught. The stack is Nuxt 4, Nuxt UI, Nitro server routes as the API,
and SQLite. The design is settled; this plan turns it into ordered, testable steps. The branch
starts from `master`, which contains only `product/`, `standards/` and `.cursorindexingignore`.

Guiding rules:

- Server logic first, behind tests, then UI. Every user story maps to at least one named test
  (coverage table in `2-design.md` section 5).
- Write the test with the feature, not at the end.
- Tests never call the live PokeAPI.
- Fixtures are recorded from the live PokeAPI once, trimmed to the fields the app uses, and
  committed under `tests/fixtures/`.

## Phase 0: Scaffold and de-risk

**0.1 Scaffold** (commit: `chore: scaffold Nuxt 4 app`)
- `package.json`, `nuxt.config.ts`, `tsconfig.json`, `app/app.vue`. Dependencies: `nuxt`, `vue`,
  `vue-router`, `@nuxt/ui`, `tailwindcss`, `better-sqlite3`. Dev: `vitest`, `@nuxt/test-utils`,
  `@vue/test-utils`, `happy-dom`, `@playwright/test`, `typescript`, `vue-tsc`,
  `@types/better-sqlite3`.
- `engines.node`, `.nvmrc`. Check `better-sqlite3` installs from a prebuilt binary on the pinned
  Node.
- `.gitignore`: `node_modules`, `.nuxt`, `.output`, `.nuxtrc`, `data/`, `test-results/`,
  `playwright-report/`, `.vscode/`, `.DS_Store`, `.env`.
- Delete `.cursorindexingignore` (editor tooling, not project content).
- `runtimeConfig`: `dbPath` (`DB_PATH`) and `pokeapiBaseUrl` (`POKEAPI_BASE_URL`).
- `shared/types/pokemon.ts`: `PokemonListItem`, `PokemonDetails`, `CollectionItem`,
  `CollectionResponse`.

**0.2 Spike: first-visit SSR cookie** (throwaway, then folded into 1.1)
The design's riskiest assumption is that the visitor middleware can inject a newly issued cookie
into the incoming request so `useRequestFetch()` sub-requests share one visitor ID. Prove it with
a tiny page and route before building on it.
- Pass: on a request with no cookie, the SSR-rendered `/api/me` label equals the `Set-Cookie`
  visitor ID, and a follow-up request with that cookie gives the same label.
- Fail: adopt the design's fallback (label fetched client-side; count rendered only for returning
  visitors) and note the change in `2-design.md`.

**0.3 Test harness** (commit: `test: fixture server and Vitest projects`)
- `vitest.config.ts` with projects: `unit` (node), `api` (`@nuxt/test-utils` e2e, boots the built
  server), `component` (happy-dom).
- `tests/fixtures/server.ts`: HTTP server that serves recorded JSON (`pokemon-index`,
  `pokemon/{bulbasaur,charmander,lotad,spriteonly}`, `type/{grass,fire,...}`, `type` list), counts
  requests per path, and has `failNext(path)` / `failAll()` controls for error-path tests.
- `tests/api/helpers.ts`: start the fixture server, set `POKEAPI_BASE_URL` and
  `DB_PATH=:memory:`, and a `visitor()` helper that keeps its own cookie.

## Phase 1: Server

Each step lists the tests written alongside it.

**1.1 Visitor identity** (`server/middleware/visitor.ts`, `server/utils/visitor.ts`,
`server/api/me.get.ts`)
- Middleware per the design, including the cookie-header injection proven in 0.2, `Secure` only
  for https in production, and skipping `/_` asset paths. `requireVisitorId(event)`.
- `GET /api/me` returns `{ label }`.
- Tests (API): cookie issued with `httpOnly` and `SameSite=Lax`; malformed cookie replaced; same
  cookie keeps the same label.

**1.2 Image picking** (`server/utils/pickImage.ts`)
- `isGrass`, `pickImage` with the artwork-to-sprite fallback.
- Tests (unit): shiny for bulbasaur (grass primary) and lotad (grass secondary); default for
  charmander; sprite fallback when `official-artwork` is missing; `null` when there is no image.

**1.3 PokeAPI client** (`server/utils/pokeapi.ts`)
- `cached()` memo that drops failed promises. `getPokemonIndex()`, `getGrassNames()`,
  `getTypeNames()`, `getTypeMembers(type)`, `getPokemon(name)`, `listImageUrl(id, shiny)`.
- Every upstream failure becomes a `502`; upstream 404 becomes `404`.
- Tests (API, via 1.4 and 1.5): request counts prove caching; a failure is not cached and the next
  call retries.

**1.4 Pokemon routes** (`server/api/pokemon/index.get.ts`, `[name].get.ts`,
`server/api/types.get.ts`)
- List: `q`, `type`, `caught`, `limit` (clamped 1-100, default 24), `offset`. Filters compose by
  intersecting name sets over the index. `caught=true` reads the visitor's names from the store
  (added in 1.5, so this step is finished after 1.5). An unknown `type` returns `404`.
- Details: `{ id, name, height, abilities, types, image }` via `pickImage`.
- Types: `{ types }` excluding `unknown` and `shadow`.
- Tests (API): paging without gaps or repeats; case-insensitive substring; empty result; type
  filter including dual types; type plus `q`; unknown type is `404`; details fields and `404`;
  shiny flag in list and details agree; `502` on upstream failure.

**1.5 Collection store and routes** (`server/utils/collectionStore.ts`, `db.ts`, `name.ts`,
`server/api/collection/*`)
- `createCollectionStore(db, { now })` with the schema from the design, ISO `caught_at`,
  `list` (most recent first), transactional `add` that returns the existing entry when already
  caught and `'full'` at `MAX_COLLECTION_SIZE = 1000`, `remove`, `reset`.
- `useCollectionStore()` opens the DB lazily from `runtimeConfig.dbPath`, WAL mode.
- Routes: `GET /api/collection` (joined with list data, `pokemon: null` on per-entry failure,
  `count`), `PUT` (validate through `getPokemon`, returns `{ name, caughtAt }`), `DELETE` one,
  `DELETE` all. `requireName()` enforces `^[a-z0-9-]{1,100}$` and lower-cases.
- Tests (store): injected clock gives exact `caughtAt`; ordering; idempotent add keeps the first
  date; cap and re-add-when-full; persistence across close and reopen on a file DB; reset scoped
  to one visitor.
- Tests (API): tenancy (A's catch invisible to B; B's remove/reset never touches A); catch
  validation (`404`, `400`); `409` when full; timestamps end in `Z`; `pokemon: null` entry still
  counts; `caught=true` filtering (finishes 1.4).

Checkpoint: `npm test` green and the API is fully usable with `curl` before any UI exists.

## Phase 2: Frontend

**2.1 App shell** (`app/app.vue`, `app/components/AppHeader.vue`, `app/composables/useCollection.ts`,
`app/utils/format.ts`, `app/assets/css/main.css`, `app/app.config.ts`)
- Palette close to pokemon.com (red primary, yellow accent) through Nuxt UI tokens.
- `useCollection()`: shared `items`, filled server-side with `useRequestFetch`; `has`, `caughtAt`,
  `catchPokemon` (stores the returned `caughtAt`), `removePokemon`, `reset`; errors surface as
  toasts. Header shows the label, the count, and reset with the confirm modal (error shown in the
  modal on failure).
- `format.ts`: `displayName`, `formatHeight`, `formatCaughtDate` (`Intl.DateTimeFormat`, local
  zone), `defaultImageFallback`.
- Tests (unit): the format helpers, including a UTC ISO string that lands on a different local day.

**2.2 Shared components** (`PokemonImage.vue`, `PokemonCard.vue`, `usePokemonPanel.ts`)
- `PokemonImage`: shiny badge only when shown, fallback to the default image on error, "No image"
  state, alt text.
- `PokemonCard`: number, name, "Caught" badge, optional caught date and remove button (used by
  the collection screen), link to `?pokemon=name`.
- Tests (component): badge only when shiny; fallback drops the badge; card variants.

**2.3 Details panel** (`PokemonPanel.vue`)
- Slide-over driven by `?pokemon=`. Loading skeleton; error with "Try again"; ignores stale
  responses; shows name, height, types, abilities, image, and "Caught <date>" plus Remove, or
  Catch.
- Tests (component): required fields render; error and retry; Catch/Remove toggle; date shown only
  when caught.

**2.4 Browse screen** (`app/pages/index.vue`)
- Search (debounced), type select (from `/api/types`), "Caught only" toggle, all mirrored into
  the URL; grid; "Load more (N left)"; skeleton, error with retry, "No matches" with "Clear
  filters", and the "Caught only" empty state. Refresh when catch/remove changes the list under
  "Caught only".

**2.5 Collection screen** (`app/pages/collection.vue`)
- Cards with caught date and a labelled remove button; error card with retry for
  `pokemon: null` entries; skeleton and empty states.

## Phase 3: End-to-end and polish

**3.1 Playwright** (`playwright.config.ts`, `tests/e2e/pokeworld.spec.ts`)
- Web server: the app with `POKEAPI_BASE_URL` pointed at the fixture server and a throwaway DB
  file (global setup starts the fixture server; teardown deletes the DB).
- Scenarios, one or more per story: browse and load more; search and clear; type filter; caught
  only; open and close panel; shared panel link reload; shiny badge on bulbasaur and lotad but not
  charmander; catch, see the date on the card and in the panel; remove from panel and from the
  grid; reset with cancel, confirm, and failure; two isolated contexts prove tenancy and
  persistence; label matches the server-rendered one; failure states via the fixture server's
  fail controls; phone-width run of the main flow; keyboard reach of cards and the catch button.

**3.2 README and docs** (commit: `docs: README with decisions, tradeoffs and next steps`)
- Run, test, env vars, how it works. "Decisions and tradeoffs": grass in any type slot, cookie
  identity instead of auth, SQLite with `better-sqlite3`, ISO timestamps, server-side PokeAPI,
  unbounded in-memory cache, the 1,000-entry cap. "Next": real auth, shared cache with a TTL,
  rate limiting, CI.
- Tick the checkboxes in `1-user-stories.md` as each story is verified. Save this plan as
  `product/3-plan.md`.

**3.3 Final review**
- Run the full suite and a manual pass in a real browser (see Verification). Walk the story list
  and confirm each has a passing named test. Clean untracked leftovers and check `git status`.

## Commit order

1. scaffold, 2. fixture server and Vitest projects, 3. visitor identity, 4. pickImage,
5. PokeAPI client and Pokemon routes, 6. collection store and routes, 7. app shell and
composables, 8. shared components, 9. details panel, 10. browse screen, 11. collection screen,
12. Playwright suite, 13. README and docs. Each commit includes its tests.

## Verification

- `npm test`: unit, API and component suites pass with no network access (unplug or block
  `pokeapi.co` once to confirm).
- `npx playwright install chromium && npm run test:e2e`: passes.
- `npm run build && npm run preview` (production build): the visitor cookie works over http on
  localhost and the label matches the server-rendered one.
- Manual pass against live PokeAPI with `npm run dev`:
  1. Browse, load more, search "bulb", filter by grass; Bulbasaur and Lotad show the shiny badge.
  2. Open a Pokemon (URL gets `?pokemon=`), reload, close.
  3. Catch two Pokemon; the count updates, cards show "Caught <today>"; the panel shows the date.
  4. Toggle "Caught only" with search and a type filter.
  5. Remove one from the collection grid; reset with cancel then confirm.
  6. Open the app in a private window: a different Trainer label and an empty collection.
  7. Restart the dev server: the collection is still there.
  8. Go offline: the list shows an error, "Try again" recovers when back online.
  9. Narrow the window to phone width and tab through the main flow.
- Coverage check: every row of the design's coverage table has a named passing test.

## Risks

- **SSR cookie injection** (0.2). Mitigated by the spike and a named fallback.
- **Nuxt API test startup time.** Booting a built server per suite is slow; share one server per
  file and reset the database between tests.
- **PokeAPI outage during the manual pass.** The fixture server can also back `npm run dev` via
  `POKEAPI_BASE_URL` for a demo without the network.
