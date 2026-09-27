export interface PokemonListItem {
  id: number
  name: string
  imageUrl: string
  shiny: boolean
}

export interface PokemonList {
  total: number
  items: PokemonListItem[]
}

export interface PokemonDetails {
  id: number
  name: string
  height: number // decimetres, as PokeAPI returns it
  abilities: string[]
  types: string[]
  image: { url: string | null, shiny: boolean }
}
