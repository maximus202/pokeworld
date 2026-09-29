export interface PokemonListItem {
  id: number
  name: string
  /** null when PokeAPI has no image at all (only possible for a collection entry). */
  imageUrl: string | null
  shiny: boolean
}

export interface PokemonDetails {
  id: number
  name: string
  /** Decimetres, as returned by PokeAPI. The UI converts it. */
  height: number
  abilities: string[]
  types: string[]
  /** `url` is null when PokeAPI has no image for this Pokemon. */
  image: { url: string | null; shiny: boolean }
}

export interface PokemonListResponse {
  items: PokemonListItem[]
  total: number
}

export interface CollectionItem {
  name: string
  /** ISO 8601 UTC, e.g. 2026-09-28T14:03:11.402Z */
  caughtAt: string
  /** null when PokeAPI failed for this entry; it still counts. */
  pokemon: PokemonListItem | null
}

export interface CollectionResponse {
  count: number
  items: CollectionItem[]
}
