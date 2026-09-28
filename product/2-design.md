# Design

Companion to `1-user-stories.md`.

## Decisions at a glance

| Area | Decision |
| --- | --- |
| Stack | Nuxt 4 (Vue), Nuxt UI, Nitro server routes as the API, one process |
| Identity | Anonymous visitor UUID in an `httpOnly` cookie. An identifier, not authentication |
| Storage | SQLite via `better-sqlite3` (prebuilt binaries, no compile step) |
| Timestamps | `caught_at` stored as an ISO 8601 UTC string (`2026-09-28T14:03:11.402Z`) |
| PokeAPI | Called only from the server, cached in memory for the life of the process |
| Shiny | Grass in *any* type slot shows the shiny image everywhere the Pokemon appears |
| Filters | Type (PokeAPI `/type/{name}`) and "Caught only", both server-side and combinable with search |
| Catch | Validated against PokeAPI, capped at 1,000 Pokemon per visitor |

## 1. What is a Pokemon in shiny form?

A shiny Pokemon is the same Pokemon in an alternate colour palette. Only the artwork differs;
name, height, abilities and types are unchanged. For us it is purely an image-selection concern.

**Decision:** show the shiny image when the Pokemon has `grass` as *any* of its types (not just
the primary type), otherwise show the default image. The brief says "if the Pokemon is a Grass
type"; a dual type such as Lotad (water/grass) is a Grass type, so this is the more literal
reading. It is called out in the README as an interpretation.

Show a "Shiny" badge on the image so the colour change reads as intentional.

**Scope:** details panel, list, search and filter results, and the collection screen.

**Image source (PokeAPI `GET /pokemon/{name}`), used by the details route:**

| | Preferred | Fallback |
| --- | --- | --- |
| Default | `sprites.other["official-artwork"].front_default` | `sprites.front_default` |
| Shiny | `sprites.other["official-artwork"].front_shiny` | `sprites.front_shiny` |

**List images:** list items need an image without one request per Pokemon, so `imageUrl` is
derived from the Pokemon `id` using the PokeAPI sprites repository URL pattern
(`official-artwork/{id}.png`, or `official-artwork/shiny/{id}.png` when shiny). Which Pokemon
are grass comes from one `GET /type/grass` call, cached as a set of names (it covers grass in
any slot).

**Fallback in the browser:** if a shiny image fails to load, the image component swaps to the
default URL and drops the badge. A server-rendered `<img>` can fail before Vue hydrates and misses
the `error` event, so the component also checks on mount for an image that has already failed.

## 2. How do we keep each user's collection separate without accounts?

Each browser is a "visitor" with its own private collection, identified by a cookie and stored in
SQLite.

**Identity:**

- On any request without a valid visitor cookie, a Nuxt server middleware
  (`server/middleware/visitor.ts`) generates a random UUID and sets it as the `pokeworld_visitor`
  cookie (`httpOnly`, `SameSite=Lax`, 1 year, `Secure` only when the request is https in
  production). A malformed value is treated as missing and replaced.
- **Not authentication.** Anyone holding the value can act as that visitor. Acceptable for a
  take-home; stated in the README.
- **Lazy creation.** There is no visitors table. A row is written only when the visitor catches
  something. Clearing cookies means a fresh, empty collection.
- **Same origin.** The API is Nuxt server routes in the same app, so there is no proxy, CORS or
  credentials setup.
- **Visibility.** The header shows a short label (first four characters of the ID, e.g.
  "Trainer #a3f9"). Because the cookie is `httpOnly`, the frontend reads it from `GET /api/me`.

**First-visit SSR.** The collection count and label are rendered on the server so the header
never flashes a wrong number. On a visitor's first request the cookie does not exist yet, so the
middleware also writes the new ID into the incoming request's `cookie` header. Server-side
sub-requests made with `useRequestFetch()` then see the same visitor as the document response.
This was verified against a production build: a first-visit page renders the same label as the
cookie it issues, and a returning visitor's own ID is used. Both are covered by tests.

**Storage:** SQLite via `better-sqlite3`. It ships prebuilt binaries, so there is no compile
step, and it avoids requiring a very recent Node for `node:sqlite`. The file is created on first
use at `data/pokeworld.db` and is git-ignored. WAL mode is on.

```sql
CREATE TABLE IF NOT EXISTS collection (
  visitor_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  caught_at  TEXT NOT NULL,          -- ISO 8601 UTC, set by the store
  PRIMARY KEY (visitor_id, name)
);
```

**Timestamps.** The store sets `caught_at` with `new Date().toISOString()` (a `now()` function is
injectable, so tests control the clock). SQLite's `CURRENT_TIMESTAMP` is deliberately not used:
it yields `YYYY-MM-DD HH:MM:SS` with no zone, which browsers parse as local time and display on
the wrong day. The browser formats the ISO string in the visitor's local time zone.

**Store.** All SQL lives in `createCollectionStore(db, { now })`. Every query filters on
`visitor_id` and is parameterised.

```ts
interface CaughtEntry { name: string; caughtAt: string }   // ISO 8601 UTC
interface CollectionStore {
  list(visitorId: string): CaughtEntry[]                   // most recent first
  add(visitorId: string, name: string): CaughtEntry | 'full'
  remove(visitorId: string, name: string): void
  reset(visitorId: string): void
  close(): void
}
```

- `list` orders by `caught_at DESC, name`.
- `add` is idempotent: catching a Pokemon that is already caught returns the *existing* entry and
  keeps its original date. The check, the size cap and the insert run in one transaction.
- **Size cap:** 1,000 entries per visitor (`runtimeConfig.maxCollectionSize`, overridable with
  `NUXT_MAX_COLLECTION_SIZE`, which the API tests set to 4), so a single visitor cannot
  grow the database without bound. It is above the number of Pokemon that exist, so a normal user
  never hits it; `add` returns `'full'` and the route answers `409`. Adding an already-caught
  Pokemon while full is still a success.

### Visitor and collection API

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/me` | `{ label: "Trainer #a3f9" }` |
| `GET` | `/api/collection` | `{ count, items: [{ name, caughtAt, pokemon: ListItem \| null }] }`, most recent first |
| `PUT` | `/api/collection/:name` | Catch. `200 { name, caughtAt }`. Idempotent (keeps the original date). `404` for an unknown Pokemon, `409` if full, `400` for a malformed name, `502` if PokeAPI is down |
| `DELETE` | `/api/collection/:name` | Remove. `204`. Idempotent |
| `DELETE` | `/api/collection` | Reset. `204`. Deletes every row for this visitor |

- **Catch validation.** `PUT` resolves the name through `getPokemon(name)` (index check, then the
  cached details) before inserting, so unknown names are rejected and the header count can never include a Pokemon that
  cannot be displayed. Names are also lower-cased and checked against `^[a-z0-9-]{1,100}$`.
  Because a new catch is what the client wants to render next, this warms the cache for the
  details panel and the collection at no extra cost.
- **Collection resolves server-side.** `GET /api/collection` joins each caught name with its list
  item (`{ id, name, imageUrl, shiny }`, from the cached details) in one round trip, instead of N
  client requests, with at most 8 lookups in flight (`mapLimit`), so a large collection on a cold
  cache after a restart does not become that many simultaneous PokeAPI requests. If PokeAPI fails
  for one entry, that entry is returned with `pokemon: null`
  rather than dropped, so `count` always equals `items.length` and the UI can show a per-card error
  with a retry.
- **Why `200` with a body for catch.** The response carries the server-assigned `caughtAt`, so
  the API result is complete on its own (the web client then refreshes the collection).

**Tenancy at a glance:**

```text
Browser A (cookie a3f9...) ──► /api/collection ──► rows WHERE visitor_id = 'a3f9...'
Browser B (cookie 7c21...) ──► /api/collection ──► rows WHERE visitor_id = '7c21...'
```

## 3. Pokemon API (backed by PokeAPI, identical for every visitor)

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/pokemon?q=&type=&caught=&limit=&offset=` | `{ items: [{ id, name, imageUrl, shiny }], total }`, paginated. `q` is a case-insensitive substring match on name; `type` restricts to a type; `caught=true` restricts to the calling visitor's collection. All may be combined |
| `GET` | `/api/pokemon/:name` | `{ id, name, height, abilities, types, image: { url, shiny } }`. `404` for an unknown name |
| `GET` | `/api/types` | `{ types: ["bug", "dark", ...] }` for the filter control |

- **Search.** PokeAPI has no search endpoint, so the server fetches the full name list once
  (`GET /pokemon?limit=100000`), keeps it in memory, and filters and paginates it itself.
- **Pokedex entries only.** PokeAPI numbers alternate forms (mega evolutions, regional variants,
  and so on) from id 10001 upwards; they would be a third of the list (326 of 1,351) and show as
  `#10033`. The index keeps only ids below 10000, so forms are not browsed, searched, caught or
  opened.
- **Unknown names never reach PokeAPI.** `getPokemon(name)` checks the name against the cached
  index first and answers `404` locally. A made-up name therefore costs no upstream request, and
  failed lookups (which are not cached) cannot be used to hammer PokeAPI.
- **Type filter.** `GET /type/{type}` lists every Pokemon with that type in any slot. The server
  caches that per type as a set of names and intersects it with the search result. `type` values
  are validated against `GET /api/types` (which excludes PokeAPI's `unknown`, `shadow` and
  `stellar` types, none of which has Pokemon to browse); an unrecognised value returns `404`.
- **Caught-only filter.** With `caught=true` the route reads the visitor's names from the store
  and intersects them with the index, so pagination and `total` stay correct alongside `q` and
  `type`. This is the one list parameter that depends on the visitor; the cache holds only
  visitor-independent PokeAPI data, so nothing per-visitor is ever cached. The order is the
  Pokedex order of the index.
- **Caching.** Successful upstream responses are cached in memory for the life of the process
  (the data is effectively static). Failures are not cached, so the next request retries. The
  cache has no size limit or TTL, a stated tradeoff: the largest cached set is the ~1,300-entry
  index plus one record per Pokemon actually viewed.
- **Errors.** Every upstream failure is converted to a clean `502 PokeAPI request failed`, in the
  list, details, types and collection routes alike, so the UI always gets a predictable error it
  can render with a retry. The server makes one attempt with a 10 s timeout; the browser's
  `$fetch` retries a failed GET once on its own.
- **Units.** `height` is passed through in decimetres; the UI converts it (`0.7 m (2′04″)`).
- **Pure image picker.** `pickImage(pokemon)` takes the PokeAPI response and returns
  `{ url, shiny }`. It holds the grass-in-any-slot rule and the artwork-to-sprite fallback and is
  unit tested without a browser.

## 4. Frontend

**Screens**

- **Pokemon** (`/`): search box, type filter, "Caught only" toggle, card grid, "Load more (N left)".
- **My Collection** (`/collection`): card grid with the caught date on each card and a remove
  control.
- **Details side panel:** a slide-over driven by the `?pokemon=name` query parameter, on either
  screen. Because it lives in the URL, closing returns to the same screen, and a link can be
  shared or reloaded.
- **Header:** logo, navigation with the collection count, visitor label, "Reset my collection".

**State and data flow**

- `useCollection()` holds the visitor's `items` in shared state, filled on the server (see
  first-visit SSR) and re-fetched from `GET /api/collection` after every catch, remove and reset,
  so the client never drifts from the server (responses come from the PokeAPI cache and are
  cheap). `caughtAt` for the panel and cards comes from here, so the details route stays
  identical for every visitor.
- The list uses `useFetch` keyed on `q`, `type` and `caught`. Search is debounced (250 ms) and,
  with the type and toggle, mirrored into the URL query (`?q=&type=&caught=true`) so the view
  survives a reload (filter changes replace the history entry rather than adding one). Catching or removing while "Caught only" is on refreshes the
  list.
- The details panel fetches `/api/pokemon/:name` client-side and ignores stale responses when the
  visitor clicks quickly between Pokemon.

**States that must exist (each has a test)**

| Situation | What the visitor sees |
| --- | --- |
| List loading | Skeleton grid |
| List/filter failed | Error alert with "Try again" |
| No search or filter results | "No matches" with the query, and a "Clear filters" action |
| "Caught only" with nothing caught | "You haven't caught any Pokemon yet" with a "Show all Pokemon" action |
| Panel loading / failed | Skeleton / error alert with "Try again" |
| Collection loading | Skeleton grid |
| Collection empty | Prompt with a "Browse Pokemon" button |
| One collection entry cannot load | An error card with retry; it still counts and can be removed |
| Catch or remove fails | Toast with the error; the button and count are unchanged |
| Reset fails | Error shown in the confirm dialog; the collection is unchanged |
| Collection full (409) | Toast saying the collection is full |

**Caught date display.** "Caught Sep 28, 2026" on collection cards and in the panel, with the
exact date and time in a tooltip. Formatted in the visitor's local zone.

**Removing from the grid.** Each collection card has a remove button (with an accessible label,
"Remove Bulbasaur"), so a Pokemon does not have to be opened first. Removal is immediate and
reversible by catching again, so it needs no confirm; Reset keeps its confirm dialog.

**Caught-only toggle.** My Collection is the view for caught dates and removal; the toggle on
the browse screen is for searching and filtering *within* what has been caught, using the same
grid and controls. Caught Pokemon are marked with a "Caught" badge in the browse grid either way.

**Look and feel.** Nuxt UI components, with a palette close to pokemon.com (red primary, yellow
accent). Mobile-first grid (2 columns up to 6), visible focus rings, buttons and links reachable
by keyboard, images with alt text, and colour never the only indicator (the "Shiny" and
"Caught" badges carry text).

**Contrast.** Nuxt UI's default red (`red-500`) gives white text 3.8:1, under the 4.5:1 that WCAG AA
needs for small text. The light theme uses the 700 shade (6.4:1 for white on red, 5.4:1 for red
text on a light tint), set in `app/assets/css/main.css`. An axe-core scan of the browse, panel,
collection and reset screens reports no contrast violations.

## 5. How do we validate the app automatically?

**Decision:** a test pyramid; every user story has at least one named test. Tests never call the
live PokeAPI, and there is no CI workflow. Reviewers run the tests locally.

| Layer | Tool | Command |
| --- | --- | --- |
| Unit | Vitest | `npm test` |
| API | Vitest + `@nuxt/test-utils` (boots the Nuxt server), in-memory SQLite | `npm test` |
| Component | Vitest + Vue Test Utils | `npm test` |
| E2E | Playwright (Chromium) | `npm run test:e2e` |

E2E is separate because Playwright downloads a browser (`npx playwright install chromium`).

**Testability requirements on the design:**

- **Injectable database and clock.** The path comes from `DB_PATH` (`:memory:` for API tests, a
  throwaway file for E2E). `createCollectionStore(db, { now })` takes a clock so tests assert
  exact `caughtAt` values and ordering without sleeping.
- **Configurable PokeAPI base URL.** `POKEAPI_BASE_URL` is read through `runtimeConfig`. Tests
  point it at a fixture server (`tests/fixtures/`) that also counts requests and can be told to
  fail (to exercise the 502 and error-state paths). PokeAPI is only called server-side, so
  browser request interception would not work; the fixture server is used for API and E2E runs.
- **Pure image picker** (see section 3).

**Fixtures** (recorded PokeAPI responses, trimmed to the fields used):

| Pokemon | Types | Used for |
| --- | --- | --- |
| `bulbasaur` | grass / poison | Grass as primary type: shiny |
| `lotad` | water / grass | Grass as secondary type: shiny |
| `charmander` | fire | Non-grass: default image |
| a Pokemon with no `official-artwork` | any | The sprite fallback |
| `type/grass`, `type/fire`, `type` list | n/a | The type filter and `GET /api/types` |

**Test coverage by user story:**

| Story | Layer | Test |
| --- | --- | --- |
| List all Pokemon | API, E2E | Items are `{ id, name, imageUrl, shiny }`; `limit`/`offset` page without gaps or repeats; "Load more" shows the remaining count |
| List failure | API, E2E | Upstream failure returns `502`; the UI shows an error and "Try again" recovers |
| Search | API, E2E | Case-insensitive substring (`BULB` finds `bulbasaur`); no match returns an empty list and shows "No matches"; clearing restores the list; the query survives reload |
| Type filter | API, E2E | `type=grass` returns only grass Pokemon, including dual types; combined with `q`; unknown type is `404`; the filter survives reload |
| Caught only | API, E2E | `caught=true` returns only the caller's Pokemon with a correct `total`; combines with `q` and `type`; another visitor's catches never appear; the empty state shows when nothing is caught; the toggle survives reload |
| Details | API, Component, E2E | Required fields returned and rendered; height in decimetres over the API and converted in the UI; `404` for an unknown name; panel error state and "Try again" recovery |
| Side panel | E2E | Selecting opens it, closing returns to the previous screen; a shared link reloads into the panel |
| Grass shows shiny | Unit, API, Component, E2E | `pickImage` shiny for `bulbasaur` and `lotad`, default for `charmander`; list and details agree; badge only when shiny; shiny load failure falls back |
| Image fallback | Unit | Missing `official-artwork` falls back to `sprites.front_*` |
| Catch | API, Component, E2E | `PUT` stores a row and returns `{ name, caughtAt }`; button flips to Remove; appears in My Collection |
| Catch idempotent | Store, API | Catching twice keeps the original `caughtAt` |
| Catch validation | API | Unknown Pokemon is `404` and stores nothing; malformed name is `400` |
| Collection cap | Store, API | The 1,001st distinct catch returns `409`; re-catching an existing one when full succeeds |
| Caught date | Store, API, Component, E2E | Timestamps are ISO 8601 UTC with `Z`; shown on cards and in the panel; ordered most recent first; formatted in the local zone |
| View collection | API, E2E | Only the caller's Pokemon; count equals items; header count is correct on first render (no flash); empty and loading states |
| Collection entry failure | API, Component | A Pokemon whose details fail returns `pokemon: null`, still counts, and renders an error card with retry |
| Remove | API, Component, E2E | `DELETE` removes the row; the button flips to Catch; the grid remove control works without opening the panel |
| Reset | API, E2E | Empties only this visitor's rows; cancel does nothing; a failure shows an error and keeps the collection |
| PokeAPI caching | API | Repeated details, list, search and type calls hit the fixture server once; failures are retried |
| Private collection, no login | API, E2E | See the tenancy tests below |
| Responsive and keyboard | E2E | The main flow works at phone width; the catch button and cards are reachable by keyboard |

**Tenancy tests** (the core multi-user proof):

- **API:** the first request with no cookie gets a `pokeworld_visitor` cookie with `httpOnly` and
  `SameSite=Lax`. A malformed cookie is replaced with a new UUID.
- **API:** visitor A catches `bulbasaur`; visitor B's `GET /api/collection` is empty. B removing
  or resetting never changes A's rows.
- **API:** removing twice is a no-op.
- **Store:** a visitor's collection, including `caughtAt`, survives closing and reopening the
  store on the same file (persistence across restarts).
- **E2E:** two Playwright browser contexts (two isolated cookie jars) show different
  "Trainer #xxxx" labels; a catch in one does not appear in the other; reloading either context
  keeps its own collection and the label matches the server-rendered one.

**Out of scope:** visual regression, load testing, cross-browser E2E (Chromium only).

## 6. Flow charts

### 6.1 Screen navigation

```text
  ┌──────────┐
  │ Open app │
  └────┬─────┘
       ▼
┌───────────────────┐
│ Visitor cookie    │
│ present?          │
└──┬─────────────┬──┘
No │             │ Yes
   ▼             │
┌──────────────┐ │
│ Server sets  │ │
│ cookie       │ │
└──────┬───────┘ │
       └────┬────┘
            ▼
  Header shows "Trainer #a3f9", collection
  count and [Reset my collection]
            │
            ▼
┌───────────────────┐  search / type filter  ┌────────────────────┐
│   POKEMON LIST    │───────────────────────►│  FILTERED RESULTS  │
│  (all Pokemon)    │◄───────────────────────│ (or "No matches")  │
└──┬─────────────┬──┘     clear filters      └─────────┬──────────┘
   │             │                                     │
   │             │ open "My Collection"                │
   │             ▼                                     │
   │   ┌───────────────────┐                           │
   │   │   MY COLLECTION   │                           │
   │   │ (with caught date)│── remove from grid        │
   │   └─────────┬─────────┘                           │
   │ select      │ select                    select    │
   ▼             ▼                                     ▼
┌────────────────────────────────────────────────────────┐
│             DETAILS SIDE PANEL  (see 6.2)              │
└───────────────────────────┬────────────────────────────┘
                            │ close panel
                            ▼
              back to the screen you came from
```

### 6.2 Details side panel

```text
  Select a Pokemon (?pokemon=name)
         │
         ▼
┌──────────────────────────┐   fails   ┌──────────────────┐
│ Open panel, fetch        │──────────►│ Error + Try again│
│ GET /api/pokemon/{name}  │           └──────────────────┘
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ Show Name, Height, Types,│
│ Abilities                │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ `grass` in ANY type?     │
└──────┬─────────────┬─────┘
    Yes│             │No
       ▼             ▼
┌─────────────┐ ┌─────────────┐
│ Shiny image │ │ Default     │
│ + badge     │ │ image       │
└──────┬──────┘ └──────┬──────┘
       └───────┬───────┘
               ▼
┌──────────────────────────┐
│ In My Collection?        │
└──────┬─────────────┬─────┘
    No │             │ Yes
       ▼             ▼
┌─────────────┐ ┌──────────────────────┐
│ [Catch]     │ │ "Caught Sep 28, 2026"│
│             │ │ [Remove]             │
└─────────────┘ └──────────────────────┘
```

### 6.3 Catch and remove

```text
   ┌─────────────┐                          ┌──────────────┐
   │ Click Catch │                          │ Click Remove │
   └──────┬──────┘                          └──────┬───────┘
          ▼                                        ▼
┌───────────────────────┐                ┌───────────────────────┐
│ PUT /api/collection/  │                │ DELETE /api/          │
│ :name                 │                │ collection/:name      │
└──────────┬────────────┘                └───────────┬───────────┘
           ▼                                         ▼
┌───────────────────────┐                ┌───────────────────────┐
│ Unknown Pokemon → 404 │                │ Row deleted           │
│ Full → 409 (toast)    │                │ (no-op if missing)    │
│ Else store caught_at  │                └───────────┬───────────┘
└──────────┬────────────┘                            │
           ▼                                         │
┌───────────────────────┐                            │
│ Button → [Remove],    │                            │
│ show caught date      │                            │
└──────────┬────────────┘                            │
           └────────────────────┬────────────────────┘
                                ▼
            Count and My Collection reflect the change
```

Remove is also available directly on each card in My Collection.

### 6.4 Reset my collection

```text
┌──────────────────────────┐
│ Click [Reset my          │
│ collection]              │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ Confirm reset?           │
└──────┬─────────────┬─────┘
    No │             │ Yes
       ▼             ▼
┌─────────────┐ ┌──────────────────────────┐   fails   ┌─────────────────┐
│ Do nothing  │ │ DELETE /api/collection   │──────────►│ Error in dialog,│
└─────────────┘ │ (this visitor's rows)    │           │ nothing changed │
                └────────────┬─────────────┘           └─────────────────┘
                             ▼
              ┌──────────────────────────┐
              │ My Collection is empty;  │
              │ open panel shows [Catch] │
              └──────────────────────────┘
```

Reset only affects the current visitor.

## 7. README tradeoffs and next steps

The README will carry a short "Decisions and tradeoffs" section, drawn from this document:
grass in any type slot, cookie identity instead of auth, SQLite and `better-sqlite3`, ISO
timestamps, server-side PokeAPI with an unbounded in-memory cache, and the 1,000-entry cap.
It will also list what we would do next: real authentication, a shared cache with a TTL, rate
limiting, and CI.
