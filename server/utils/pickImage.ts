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

export interface PokeApiImageSource {
  types: { type: { name: string } }[]
  sprites: PokeApiSprites
}

export interface PokemonImage {
  /** null when PokeAPI has no image at all for this Pokemon. */
  url: string | null
  shiny: boolean
}

/** True when grass is in any type slot, so dual types such as water/grass count. */
export function isGrass(pokemon: Pick<PokeApiImageSource, 'types'>): boolean {
  return pokemon.types.some(t => t.type.name === 'grass')
}

/**
 * Grass Pokemon get the shiny image; everything else gets the default one.
 * Official artwork is preferred, with the plain sprite as the fallback.
 * `shiny` describes which image was requested for the type rule, and stays true even when the
 * shiny URL is missing and there is no image to show.
 */
export function pickImage(pokemon: PokeApiImageSource): PokemonImage {
  const shiny = isGrass(pokemon)
  const key = shiny ? 'front_shiny' : 'front_default'
  const artwork = pokemon.sprites.other?.['official-artwork']?.[key]
  return { url: artwork || pokemon.sprites[key] || null, shiny }
}
