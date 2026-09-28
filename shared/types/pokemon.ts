export interface PokemonListItem {
  id: number
  name: string
  imageUrl: string
  shiny: boolean
}

export interface PokemonDetails {
  id: number
  name: string
  /** Decimetres, as PokeAPI returns it. */
  height: number
  abilities: string[]
  types: string[]
  image: { url: string | null, shiny: boolean }
}

export interface PokemonList {
  items: PokemonListItem[]
  total: number
}

export interface CollectionItem {
  name: string
  /** ISO 8601 UTC, e.g. 2026-09-28T14:03:11.402Z */
  caughtAt: string
  /** null when the Pokemon's details could not be loaded from PokeAPI. */
  pokemon: PokemonListItem | null
}

export interface CollectionResponse {
  count: number
  items: CollectionItem[]
}
