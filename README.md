# Pokeworld

Browse Pokemon from [PokeAPI](https://pokeapi.co/docs/v2), search by name, open a details side
panel, and keep your own private collection, all without signing up.

Built with Nuxt 4, Vue, Nuxt UI and SQLite (`better-sqlite3`). The API is Nuxt server routes in
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

For a production build (`npm run build`), override at runtime with `NUXT_DB_PATH` and
`NUXT_POKEAPI_BASE_URL`.

## How it works

- **Shiny:** Pokemon with `grass` as *any* type show their shiny image, with a "Shiny" badge, in the
  list, search results, collection and details panel. See `server/utils/pickImage.ts`.
- **Private collections without login:** each browser gets a random UUID in an `httpOnly`
  `pokeworld_visitor` cookie; the collection is stored in SQLite keyed by that ID. The header shows
  a short label like "Trainer #a3f9".
- **The cookie is an identifier, not authentication.** Anyone who holds the value can act as that
  visitor. That is acceptable for a take-home and is not meant to be secure. Clearing cookies gives
  you a fresh, empty collection.
- **PokeAPI is only called server-side** and cached in memory for the life of the process.

The full design is in [`product/2-design.md`](product/2-design.md).

## Tests

```bash
npm test                              # unit + API + component (Vitest); API tests build and boot Nuxt
npx playwright install chromium       # once
npm run test:e2e                      # end-to-end (Playwright, Chromium)
```

Tests never call the live PokeAPI: they use the fixture server in `tests/fixtures/` and a
throwaway database.
