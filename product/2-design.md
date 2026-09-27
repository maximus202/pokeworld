# Design

## Open Questions

## 1. What is a Pokemon in shiny form?

A shiny Pokemon is the same Pokemon in an alternate colour palette. Only the artwork
differs; name, height, abilities and types are unchanged. For us it is purely an
image-selection concern (see `1-questions.md` for detail).

**Decision:** in the details side panel, show the shiny image when the Pokemon has `grass`
as *any* of its types (not just the primary type), otherwise show the default image.
Show a "Shiny" badge next to the image so the colour change reads as intentional.

**Image source (PokeAPI `GET /pokemon/{name}`):**

| | Preferred | Fallback |
| --- | --- | --- |
| Default | `sprites.other["official-artwork"].front_default` | `sprites.front_default` |
| Shiny | `sprites.other["official-artwork"].front_shiny` | `sprites.front_shiny` |

**Scope:** The details panel, list, search results and collection screens should show the shiny image when the Pokemon has `grass` as *any* of its types (not just the primary type), otherwise show the default image.

## 2. How do we keep each user's collection separate without accounts?

The app has no login. To show multi-user tenancy anyway, each browser is a "visitor" with
its own private collection, identified by a cookie and stored in SQLite.

**Decision:**

- **Identity:** on any request without a valid visitor cookie, a Nuxt server middleware
  (`server/middleware/visitor.ts`) generates a random UUID and sets it as the
  `pokeworld_visitor` cookie (`httpOnly`, `SameSite=Lax`, 1 year, `Secure` in production
  only). A malformed cookie value is treated as missing and replaced.
- **Not authentication:** the cookie is an identifier, not a credential. Anyone holding
  the value can act as that visitor. This is acceptable for a take-home and is stated in
  the README.
- **Lazy creation:** there is no users/visitors table. The cookie is issued on first
  contact, and a database row is only written when the visitor catches a Pokemon. Clearing
  cookies simply means a fresh, empty collection.
- **Wiring:** the API is Nuxt server routes (`server/api/`) in the same app as the
  frontend, so there is one process, one origin and one `npm run dev`. The cookie is
  first-party and needs no proxy, CORS or credentials setup.
- **PokeAPI access:** PokeAPI is only called from Nuxt server routes, never from the
  browser. The browser talks to `/api/*` only.
- **Storage:** SQLite via the built-in `node:sqlite` module (no native build step). It
  needs **Node >= 22.13** (earlier 22.x versions require an experimental flag or do not
  ship it). Pin this in `engines` and `.nvmrc`, and note it in the README. The database
  file is created on startup (`data/pokeworld.db`) and is git-ignored.
- **Visibility:** the header shows a short label derived from the visitor ID (first four
  characters, e.g. "Trainer #a3f9") and a "Reset my collection" button. Because the cookie
  is `httpOnly`, the frontend gets the label from `GET /api/me`.

**Visitor and collection API (scoped to the visitor in the cookie):**

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/me` | Returns the visitor label, e.g. `{ "label": "Trainer #a3f9" }` |
| `GET` | `/api/collection` | Lists the visitor's caught Pokemon names |
| `PUT` | `/api/collection/:name` | Catch. Idempotent: catching twice is a no-op |
| `DELETE` | `/api/collection/:name` | Remove. Idempotent: removing a missing Pokemon is a no-op |
| `DELETE` | `/api/collection` | Reset. Deletes every row for this visitor |

Every query filters on `visitor_id` and uses parameterised statements. The collection
stores only the Pokemon name; display data (image, etc.) comes from the Pokemon API below.

**Pokemon API (backed by PokeAPI, identical for every visitor):**

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/pokemon?q=&limit=&offset=` | Lists Pokemon as `{ id, name, imageUrl }` (default image), paginated. `q` filters by name (case-insensitive substring), so it serves both the list and search stories |
| `GET` | `/api/pokemon/:name` | Details: `{ id, name, height, abilities, types, image: { url, shiny } }`. The image comes from `pickImage`, so the grass-shiny rule lives server-side. Returns `404` for an unknown name |

- **Search:** PokeAPI has no search endpoint. The server fetches the full name list once
  (`GET /pokemon?limit=100000`), keeps it in memory, and filters and paginates it itself.
- **List images:** list items need a default image without one request per Pokemon, so
  `imageUrl` is derived from the Pokemon `id` (the PokeAPI sprites repository URL pattern).
- **Caching:** PokeAPI responses are cached in memory for the life of the server process,
  since the data is effectively static. This also means a collection of N Pokemon does not
  cost N upstream requests on every view.
- **Collection view:** `GET /api/collection` returns names only, so the collection screen
  resolves each name through `GET /api/pokemon/:name` (served from cache).
- **Units:** `height` is passed through as PokeAPI returns it (decimetres); the UI converts
  it for display.

**Assumption:** names are lower-cased and checked against `^[a-z0-9-]{1,100}$` but not
verified against PokeAPI on write.

**Tenancy at a glance:**

```text
Browser A (cookie a3f9...) ──► /api/collection ──► rows WHERE visitor_id = 'a3f9...'
Browser B (cookie 7c21...) ──► /api/collection ──► rows WHERE visitor_id = '7c21...'
```

## 3. How do we validate the app automatically?

**Decision:** a test pyramid, with every user story covered by at least one named test.
Tests never call the live PokeAPI, and there is no CI workflow. Reviewers run the tests
locally using the commands below.

| Layer | Tool | Command |
| --- | --- | --- |
| Unit | Vitest | `npm test` |
| API | Vitest + `@nuxt/test-utils` (boots the Nuxt server), in-memory SQLite (`:memory:`) | `npm test` |
| Component | Vitest + Vue Test Utils | `npm test` |
| E2E | Playwright (Chromium) | `npm run test:e2e` |

E2E is a separate command because Playwright downloads a browser
(`npx playwright install chromium`). `npm test` stays dependency-light and fast.

**Testability requirements on the design:**

- **Injectable database:** the database path comes from `DB_PATH`. API tests set it to
  `:memory:` and E2E runs use a throwaway file, so neither touches `data/pokeworld.db`.
  The SQL lives in a store, `createCollectionStore(db)` in `server/utils/`, which server
  routes call and which tests can also exercise directly against a temp file.
- **Pure image picker:** shiny selection is a pure function, `pickImage(pokemon)`, that
  takes the PokeAPI response and returns `{ url, shiny }`. It holds the "grass as any type"
  rule and the artwork-to-sprite fallback, and it is unit tested without a browser.
- **Configurable PokeAPI base URL:** `POKEAPI_BASE_URL` (default `https://pokeapi.co/api/v2`).
  It is read through Nuxt `runtimeConfig`. Tests point it at a small fixture server that
  serves JSON from `tests/fixtures/`. Because PokeAPI is only called server-side, browser
  request interception would not work, so the fixture server is used for API and E2E runs.

**Fixtures** (recorded PokeAPI responses, trimmed to the fields we use):

| Pokemon | Types | Used for |
| --- | --- | --- |
| `bulbasaur` | grass / poison | Grass as primary type, so it shows shiny |
| `lotad` | water / grass | Grass as *secondary* type, so it still shows shiny |
| `charmander` | fire | Non-grass, so it shows the default image |
| a Pokemon with no `official-artwork` | any | The sprite fallback |

**Test coverage by user story:**

| Story | Layer | Test |
| --- | --- | --- |
| List all Pokemon | API, E2E | `GET /api/pokemon` returns `{ id, name, imageUrl }` items; `limit` and `offset` page through the list without gaps or repeats; the list renders fixture Pokemon |
| Search by name | API, E2E | `q` is a case-insensitive substring match (`BULB` finds `bulbasaur`); an unmatched `q` returns an empty list; typing filters the list, a bad name shows "no matches", and clearing restores the list |
| Details: name, height, abilities, image | API, Component, E2E | `GET /api/pokemon/:name` returns `id`, `name`, `height` (decimetres, unconverted), `abilities`, `types` and `image`; `404` for an unknown name; required fields render in the side panel |
| Grass shows shiny | Unit, API, Component, E2E | `pickImage` returns shiny for `bulbasaur` and `lotad`, default for `charmander`; the details route reports `image.shiny` accordingly; the badge shows only when shiny |
| Image fallback | Unit | Missing `official-artwork` falls back to `sprites.front_*` |
| Side panel | E2E | Selecting a Pokemon opens the panel; closing returns to the previous screen |
| Catch | API, Component, E2E | `PUT` stores a row; the button flips to Remove; the Pokemon appears in My Collection |
| Remove | API, Component, E2E | `DELETE` removes the row; the button flips to Catch |
| Reset | API, E2E | `DELETE /api/collection` empties only this visitor's rows; cancelling the confirm does nothing |
| View collection | API, E2E | `GET /api/collection` returns only the caller's Pokemon; the collection screen shows each one with its details resolved |
| PokeAPI caching | API | A repeated `GET /api/pokemon/:name` and repeated list/search calls hit the fixture server once (it counts requests) |
| Private collection, no login | API, E2E | See the tenancy tests below |

**Tenancy tests** (the core multi-user proof):

- **API:** the first request with no cookie gets a `pokeworld_visitor` cookie with
  `httpOnly` and `SameSite=Lax`. A malformed cookie is replaced with a new UUID.
- **API:** visitor A catches `bulbasaur`, and visitor B's `GET /api/collection` is empty.
  B removing or resetting never changes A's rows.
- **API:** catching or removing twice is a no-op, and names failing `^[a-z0-9-]{1,100}$`
  are rejected with `400`.
- **Store:** a visitor's collection is still there after the store is closed and reopened
  on the same database file, which covers persistence across restarts.
- **E2E:** two Playwright browser contexts (two isolated cookie jars) show different
  "Trainer #xxxx" labels. A catch in one context does not appear in the other, and
  reloading either context keeps its own collection.

**Out of scope:** visual regression, load testing, and cross-browser E2E (Chromium only).

## Flow Chart

Text-based flow of the user actions from `1-user-stories.md`. Split into four parts:
screen navigation, the details side panel, catching/removing, and resetting.

### 1. Screen navigation

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
│ Nuxt server  │ │
│ sets cookie  │ │
└──────┬───────┘ │
       └────┬────┘
            ▼
  Header shows "Trainer #a3f9"
  and [Reset my collection]
            │
            ▼
┌───────────────────┐    type a name     ┌───────────────────┐
│   POKEMON LIST    │───────────────────►│  SEARCH RESULTS   │
│  (all Pokemon)    │◄───────────────────│ (or "no matches") │
└──┬─────────────┬──┘   clear search     └─────────┬─────────┘
   │             │                                 │
   │             │ open "My Collection"            │
   │             ▼                                 │
   │   ┌───────────────────┐                       │
   │   │   MY COLLECTION   │                       │
   │   │ (caught Pokemon)  │                       │
   │   └─────────┬─────────┘                       │
   │             │                                 │
   │ select a    │ select a           select a     │
   │ Pokemon     │ Pokemon            Pokemon      │
   ▼             ▼                                 ▼
┌────────────────────────────────────────────────────────┐
│               DETAILS SIDE PANEL  (see 2)              │
└───────────────────────────┬────────────────────────────┘
                            │ close panel
                            ▼
              back to the screen you came from
```

### 2. Details side panel

```text
  Select a Pokemon
         │
         ▼
┌──────────────────────────┐
│ Open side panel, fetch   │
│ GET /pokemon/{name}      │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ Show Name, Height,       │
│ Abilities                │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ Does it have `grass` as  │
│ ANY of its types?        │
└──────┬─────────────┬─────┘
    Yes│             │No
       ▼             ▼
┌─────────────┐ ┌─────────────┐
│ Shiny image │ │ Default     │
│ + "Shiny"   │ │ image       │
│ badge       │ │             │
└──────┬──────┘ └──────┬──────┘
       └───────┬───────┘
               ▼
   (image falls back to the plain sprite
    if official-artwork is missing)
               │
               ▼
┌──────────────────────────┐
│ Is it already in         │
│ My Collection?           │
└──────┬─────────────┬─────┘
    No │             │ Yes
       ▼             ▼
┌─────────────┐ ┌─────────────┐
│ Show        │ │ Show        │
│ [Catch]     │ │ [Remove]    │
└──────┬──────┘ └──────┬──────┘
       └───────┬───────┘
               ▼
   see 3 (or close the panel)
```

### 3. Catch and remove

```text
   ┌─────────────┐                          ┌──────────────┐
   │ Click Catch │                          │ Click Remove │
   └──────┬──────┘                          └──────┬───────┘
          ▼                                        ▼
┌───────────────────────┐                ┌───────────────────────┐
│ Save Pokemon to       │                │ Delete Pokemon from   │
│ My Collection         │                │ My Collection         │
└──────────┬────────────┘                └───────────┬───────────┘
           ▼                                         ▼
┌───────────────────────┐                ┌───────────────────────┐
│ Button becomes        │                │ Button becomes        │
│ [Remove]              │                │ [Catch]               │
└──────────┬────────────┘                └───────────┬───────────┘
           └────────────────────┬────────────────────┘
                                ▼
                 My Collection reflects the change
```

Catch is `PUT /api/collection/:name` and remove is `DELETE /api/collection/:name`; both
only touch the current visitor's rows.

**Assumption:** the stories don't say where catch/remove live. The chart puts both in the
details side panel, so a Pokemon can be removed by opening it from My Collection.

### 4. Reset my collection

```text
┌──────────────────────────┐
│ Click                    │
│ [Reset my collection]    │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ Confirm reset?           │
└──────┬─────────────┬─────┘
    No │             │ Yes
       ▼             ▼
┌─────────────┐ ┌──────────────────────────┐
│ Do nothing  │ │ DELETE /api/collection   │
│             │ │ (this visitor's rows)    │
└─────────────┘ └────────────┬─────────────┘
                             ▼
              ┌──────────────────────────┐
              │ My Collection is empty;  │
              │ open panel shows [Catch] │
              └──────────────────────────┘
```

The reset only affects the current visitor; other visitors' collections are untouched.

