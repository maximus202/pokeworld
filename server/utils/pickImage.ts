export interface PokeApiSprites {
  front_default?: string | null
  front_shiny?: string | null
  other?: {
    'official-artwork'?: {
      front_default?: string | null
      front_shiny?: string | null
    }
  }
}

export interface PokeApiPokemonImageSource {
  types: { type: { name: string } }[]
  sprites: PokeApiSprites
}

export interface PokemonImage {
  url: string | null
  shiny: boolean
}

/** True when grass is in any type slot, so dual types such as water/grass count. */
export function isGrass(pokemon: Pick<PokeApiPokemonImageSource, 'types'>): boolean {
  return pokemon.types.some(t => t.type.name === 'grass')
}

/**
 * Grass Pokemon get the shiny image; everything else gets the default one.
 * Official artwork is preferred, with the plain sprite as the fallback.
 */
export function pickImage(pokemon: PokeApiPokemonImageSource): PokemonImage {
  const shiny = isGrass(pokemon)
  const key = shiny ? 'front_shiny' : 'front_default'
  const artwork = pokemon.sprites.other?.['official-artwork']?.[key]
  const sprite = pokemon.sprites[key]
  return { url: artwork || sprite || null, shiny }
}
