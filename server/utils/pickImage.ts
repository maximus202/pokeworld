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

/**
 * True when grass is in any type slot, so dual types such as water/grass count.
 */
export function isGrass(pokemon: Pick<PokeApiImageSource, 'types'>): boolean {
  return pokemon.types.some(t => t.type.name === 'grass')
}

/**
 * Grass Pokemon get the shiny image; everything else gets the default one.
 * Official artwork is preferred, with the plain sprite as the fallback. If a
 * grass Pokemon has no shiny image at all, the default image is shown and
 * `shiny` is false, so the badge is not shown on an image that is not shiny.
 */
export function pickImage(pokemon: PokeApiImageSource): PokemonImage {
  const artwork = pokemon.sprites.other?.['official-artwork']

  const urlFor = (key: 'front_default' | 'front_shiny') =>
    artwork?.[key] || pokemon.sprites[key] || null

  if (isGrass(pokemon)) {
    const shinyUrl = urlFor('front_shiny')
    if (shinyUrl) return { url: shinyUrl, shiny: true }
  }

  return { url: urlFor('front_default'), shiny: false }
}
