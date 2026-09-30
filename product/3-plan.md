# Plan: Pokeworld MVP as reviewable PR phases

## Context

Build the Pokeworld MVP (Nuxt 4, Nuxt UI, Nitro routes, SQLite, PokeAPI) as a sequence of small
PRs so each slice gets code review and testing before the next starts. `implementation-rollup`
currently holds only `product/1-user-stories.md`, `product/2-design.md` and `standards/*.md`;
there is no code. The design (`product/2-design.md`) is the source of truth. This plan orders it
into phases; it does not change the design.

## Workflow (applies to every phase)

1. `git checkout implementation-rollup && git pull`, then `git checkout -b phase-N-<slug>`.
2. Build the phase chunk by chunk. One commit per chunk, each with its tests, each leaving
   `npm test` green.
3. Open a PR into `implementation-rollup`. Run the phase's **Exit checks**.
4. Run the code review (`/code-review`) and present the findings to you. **Do not fix any
   finding until you have reviewed them and given permission**; you may have other changes too.
   Then apply only what you approve, on the same branch.
5. **Do not merge into `implementation-rollup` without your explicit permission.** After you
   approve and merge, start the next phase from the updated rollup branch. Never start phase
   N+1 before N is merged.
6. When a phase makes a user story true, tick it in `1-user-stories.md` in that same PR.

Rules for all phases: tests never call live PokeAPI; a phase adds no code that a later phase
would need to undo; each PR stays reviewable (target under ~600 lines of non-test diff).

## Phase 1: Scaffold, test harness, SSR spike

Branch `phase-1-scaffold`. Goal: an app that boots, a test harness that works, and the riskiest
design assumption proven.

- **1.1 Scaffold.** `package.json`, `nuxt.config.ts`, `tsconfig.json`, `app/app.vue`, `.nvmrc`,
  `engines.node`, `.gitignore` (`node_modules`, `.nuxt`, `.output`, `.nuxtrc`, `data/`,
  `test-results/`, `playwright-report/`, `.vscode/`, `.DS_Store`, `.env`), `runtimeConfig`
  (`dbPath`/`DB_PATH`, `pokeapiBaseUrl`/`POKEAPI_BASE_URL`, `maxCollectionSize`). Deps per
  design: nuxt, @nuxt/ui, better-sqlite3; dev: vitest, @nuxt/test-utils, @vue/test-utils,
  happy-dom, @playwright/test, vue-tsc.
  Verify: `npm install && npm run dev` serves a page; `better-sqlite3` installs from a
  prebuilt binary; `npx nuxi typecheck` passes.
- **1.2 Shared types.** `shared/types/pokemon.ts` (`PokemonListItem`, `PokemonDetails`,
  `CollectionItem`, `CollectionResponse`). Verify: typecheck.
- **1.3 Vitest projects.** `vitest.config.ts` with `unit` (node), `api` (`@nuxt/test-utils`),
  `component` (happy-dom) and a trivial passing test in each. Verify: `npm test` green.
- **1.4 Fixture server.** `tests/fixtures/server.ts` serving recorded, trimmed PokeAPI JSON
  (`pokemon` index, `bulbasaur`, `charmander`, `lotad`, a sprite-only Pokemon, `type/grass`,
  `type/fire`, `type` list), with per-path request counters and `failNext(path)`/`failAll()`.
  `tests/api/helpers.ts` with `visitor()` (own cookie jar). Verify: a test that asserts counters
  and failure injection.
- **1.5 Spike: first-visit SSR cookie.** Tiny middleware and page proving the cookie issued on
  the first request is visible to `useRequestFetch()` sub-requests. Pass: SSR-rendered label
  equals the `Set-Cookie` ID; a second request with the cookie gets the same label. Keep as a
  real test (it becomes the Phase 2 middleware). Fail: switch to the design's fallback and
  update `2-design.md` in this PR.

Exit checks: `npm test` green offline; `npm run build` succeeds; spike test passes.
Reviewer focus: dependency choices, `.gitignore`, fixture fidelity to real PokeAPI shapes.

## Phase 2: Visitor identity and image picking

Branch `phase-2-identity`. Pure server logic, no UI.

- **2.1 `pickImage`** (`server/utils/pickImage.ts`): `isGrass` (any slot), artwork-to-sprite
  fallback. Unit tests: shiny for bulbasaur and lotad, default for charmander, sprite fallback,
  `null` when no image.
- **2.2 Visitor middleware** (`server/middleware/visitor.ts`, `server/utils/visitor.ts`):
  UUID cookie `pokeworld_visitor` (`httpOnly`, `SameSite=Lax`, 1 year, `Secure` only on https in
  prod), malformed value replaced, incoming cookie-header injection, `requireVisitorId(event)`.
  API tests: cookie attributes, malformed replaced, stable across requests.
- **2.3 `GET /api/me`** returns `{ label: "Trainer #xxxx" }`. API test: label matches cookie.

Exit checks: `npm test` green; `curl -i localhost:3000/api/me` shows `Set-Cookie` and a label;
repeat with `-b` keeps the label.
Reviewer focus: cookie flags, that no visitor row is created eagerly.

## Phase 3: PokeAPI client and Pokemon routes

Branch `phase-3-pokemon-api`. Read-only, visitor-independent (the `caught` filter waits for
Phase 4).

- **3.1 PokeAPI client** (`server/utils/pokeapi.ts`): `cached()` memo that drops failures,
  index limited to ids < 10000, `getPokemonIndex`, `getGrassNames`, `getTypeNames` (excluding
  unknown/shadow/stellar), `getTypeMembers`, `getPokemon` (local 404 for names not in index),
  `listImageUrl`, 10 s timeout, upstream failure to `502`.
  Tests via the routes below: request counts prove caching; failure not cached; unknown name
  makes zero upstream calls.
- **3.2 `GET /api/types`.** Test: list content and exclusions.
- **3.3 `GET /api/pokemon/:name`.** `{ id, name, height, abilities, types, image }`. Tests: fields,
  height in decimetres, `404`, `502`, shiny for bulbasaur/lotad, default for charmander.
- **3.4 `GET /api/pokemon` list.** `q`, `type`, `limit` (clamp 1-100, default 24), `offset`.
  Tests: paging without gaps or repeats, case-insensitive substring, empty result, type filter
  including dual types, type plus `q`, unknown type `404`, list and details agree on `shiny`,
  `502`, forms (id >= 10000) excluded.

Exit checks: `npm test` green; `curl` the three routes against live PokeAPI once by hand.
Reviewer focus: cache correctness, error mapping, no per-Pokemon upstream fan-out in the list.

## Phase 4: Collection store, routes, caught filter

Branch `phase-4-collection`. Completes the API; after this the backend is usable with `curl`.

- **4.1 Store** (`server/utils/collectionStore.ts`, `db.ts`): schema, ISO `caught_at`, injectable
  `now`, `list` (recent first), transactional idempotent `add` with cap and `'full'`, `remove`,
  `reset`, WAL, lazy open from `dbPath`. Store tests: exact timestamps, ordering, idempotent
  add keeps first date, cap and re-add-when-full, persistence across close/reopen on a file,
  reset scoped to one visitor.
- **4.2 Write routes** (`PUT`/`DELETE /api/collection/:name`, `DELETE /api/collection`,
  `server/utils/name.ts`). Tests: `200 { name, caughtAt }`, `404` unknown, `400` malformed, `409`
  full, idempotent DELETE, timestamps end in `Z`.
- **4.3 `GET /api/collection`** joined with list items, `pokemon: null` per-entry failure,
  `count === items.length`, `mapLimit` of 8. Tests: only caller's items, failure entry still
  counts.
- **4.4 `caught=true`** on the list route. Tests: only caller's, correct `total`, combines with
  `q` and `type`, other visitor's catches never appear.
- **4.5 Tenancy suite.** Visitor A vs B: catch, remove, reset isolation.

Exit checks: `npm test` green; full catch/list/remove/reset cycle with `curl` and two cookie
jars; tick the backend-only stories (catch idempotent, validation, cap, caught date, tenancy).
Reviewer focus: every query filters on `visitor_id` and is parameterised; transaction correctness.

## Phase 5: App shell, header, shared components

Branch `phase-5-shell`. First UI; no screens yet beyond a smoke page.

- **5.1 Theme** (`app/assets/css/main.css`, `app/app.config.ts`): red 700 primary, yellow
  accent, WCAG AA contrast.
- **5.2 Format helpers** (`app/utils/format.ts`, and `shared/utils/displayName.ts` for `displayName`,
  which the server's search also uses): `displayName`, `formatHeight`, `formatCaughtDate`. Unit tests, including a UTC ISO string landing on a different local day.
- **5.3 `useCollection()`** with SSR fill via `useRequestFetch`, `has`, `caughtAt`, `catchPokemon`,
  `removePokemon`, `reset`, toast errors. Component tests with mocked `$fetch`.
- **5.4 `AppHeader`**: logo, nav with count, visitor label, Reset with confirm modal (error in
  modal on failure). Component tests: confirm/cancel/failure. API/SSR test: count and label
  correct in server-rendered HTML on first visit.
- **5.5 `PokemonImage` and `PokemonCard`**: badge only when shiny, fallback on error incl. the
  already-failed-before-hydration check, "No image" state, alt text; card with number, name,
  Caught badge, optional caught date and remove button. Component tests.

Exit checks: `npm test` green; in `npm run dev` the header shows the correct count on first paint
(view-source) and reset works; keyboard focus rings visible.
Reviewer focus: hydration behaviour, accessible names, contrast.

## Phase 6: Browse screen and details panel

Branch `phase-6-browse`.

- **6.1 Browse grid** (`app/pages/index.vue`): `useFetch` list, skeleton, error with retry,
  "Load more (N left)", Caught badge on caught cards.
- **6.2 Search, type filter, Caught-only** mirrored into the URL (`?q=&type=&caught=true`),
  250 ms debounce, replace-not-push history, empty states ("No matches" + Clear filters, "You
  haven't caught any" + Show all), refresh on catch/remove under Caught only. Component tests
  per state.
- **6.3 Details panel** (`PokemonPanel.vue`, `usePokemonPanel.ts`): slide-over via `?pokemon=`,
  skeleton, error with retry, ignores stale responses, fields, shiny image, Catch/Remove and
  caught date. Component tests: required fields, error and retry, toggle, date only when caught,
  stale response ignored.

Exit checks: `npm test` green; manual pass in a browser against the fixture server
(`POKEAPI_BASE_URL`) and once against live PokeAPI: browse, load more, search "bulb", filter
grass, open/close/reload panel, catch and remove from panel.
Reviewer focus: URL state handling, race handling, empty-state coverage.

## Phase 7: Collection screen

Branch `phase-7-collection-screen`.

- **7.1 `app/pages/collection.vue`**: card grid ordered recent first, caught date, labelled
  remove buttons ("Remove Bulbasaur"), skeleton, empty prompt with Browse button.
- **7.2 Failure entries**: `pokemon: null` renders an error card with retry that still counts and
  can be removed.
- **7.3 Panel from collection**: opening and closing returns to the collection.

Exit checks: `npm test` green; manual: catch three, see order and dates, remove from grid,
reset with cancel then confirm.

## Phase 8: End-to-end, accessibility, responsive

Branch `phase-8-e2e`.

- **8.1 Playwright harness**: config, global setup (fixture server + throwaway DB), teardown.
- **8.2 Story scenarios** per the design's coverage table: browse/load more, search/clear, type
  filter, caught only, panel open/close and shared link, shiny on bulbasaur and lotad but not
  charmander (incl. fallback), catch/date, remove (panel and grid), reset (cancel, confirm,
  failure), failure states via fixture fail controls.
- **8.3 Tenancy and persistence**: two isolated contexts, different labels, isolated catches,
  reload keeps own collection, label matches SSR.
- **8.4 Phone width and keyboard** run of the main flow; axe-core scan for contrast.

Exit checks: `npm run test:e2e` green; `npm test` green; tick any remaining stories.

## Phase 9: README and final review

Branch `phase-9-docs`.

- README: run, test, env vars, "Decisions and tradeoffs", "Next steps" per design section 7.
- Confirm all boxes in `1-user-stories.md` are ticked and each story has a named passing test
  (walk the design's coverage table).

Exit checks: fresh clone, `npm install && npm run dev` works with no other setup; full test
suites green; `git status` clean.

## Cross-phase verification

- After every merge: on `implementation-rollup`, `npm ci && npm test` is green offline.
- After Phase 4: backend acceptance via `curl` with two cookie jars.
- After Phase 8: `npm run build && npm run preview` and repeat the tenancy check on the
  production build.

## Risks

- **SSR cookie injection** (Phase 1.5): spiked first, with a named fallback.
- **API test startup time**: one server per test file, reset the DB between tests.
- **PokeAPI outage during manual checks**: the fixture server can back `npm run dev` via
  `POKEAPI_BASE_URL`.
- **Cross-phase drift**: if a later phase needs to change an earlier API, fix it in a small
  follow-up PR on the rollup branch rather than editing inside the later phase.
