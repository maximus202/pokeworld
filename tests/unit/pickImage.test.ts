import { describe, expect, it } from 'vitest'
import { isGrass, pickImage, type PokeApiImageSource } from '../../server/utils/pickImage'
import bulbasaur from '../fixtures/pokemon/bulbasaur.json'
import charmander from '../fixtures/pokemon/charmander.json'
import lotad from '../fixtures/pokemon/lotad.json'
import spriteonly from '../fixtures/pokemon/spriteonly.json'

const artwork = (p: PokeApiImageSource, key: 'front_default' | 'front_shiny') =>
  p.sprites.other?.['official-artwork']?.[key]

describe('isGrass', () => {
  it('is true when grass is the primary type (bulbasaur)', () => {
    expect(isGrass(bulbasaur)).toBe(true)
  })

  it('is true when grass is the secondary type (lotad, water/grass)', () => {
    expect(isGrass(lotad)).toBe(true)
  })

  it('is false for a non-grass Pokemon (charmander)', () => {
    expect(isGrass(charmander)).toBe(false)
  })
})

describe('pickImage', () => {
  it('shows the shiny artwork for a primary grass type', () => {
    expect(pickImage(bulbasaur)).toEqual({ url: artwork(bulbasaur, 'front_shiny'), shiny: true })
  })

  it('shows the shiny artwork for a secondary grass type', () => {
    expect(pickImage(lotad)).toEqual({ url: artwork(lotad, 'front_shiny'), shiny: true })
  })

  it('shows the default artwork for a non-grass Pokemon', () => {
    expect(pickImage(charmander)).toEqual({ url: artwork(charmander, 'front_default'), shiny: false })
  })

  it('falls back to the plain sprite when the official artwork is null', () => {
    expect(pickImage(spriteonly)).toEqual({ url: spriteonly.sprites.front_default, shiny: false })
  })

  it('falls back to the plain shiny sprite for a grass Pokemon without shiny artwork', () => {
    const grassSpriteOnly = { ...spriteonly, types: [{ type: { name: 'grass' } }] }
    expect(pickImage(grassSpriteOnly)).toEqual({ url: spriteonly.sprites.front_shiny, shiny: true })
  })

  it('shows the default image, without shiny, for a grass Pokemon that has no shiny image', () => {
    const noShiny = {
      types: bulbasaur.types,
      sprites: {
        front_default: 'https://example.test/default.png',
        front_shiny: null,
        other: { 'official-artwork': { front_default: 'https://example.test/art.png', front_shiny: null } },
      },
    }
    expect(pickImage(noShiny)).toEqual({ url: 'https://example.test/art.png', shiny: false })
  })

  it('uses the default sprite when a grass Pokemon has only a default sprite', () => {
    const onlyDefault = { types: lotad.types, sprites: { front_default: 'https://example.test/default.png' } }
    expect(pickImage(onlyDefault)).toEqual({ url: 'https://example.test/default.png', shiny: false })
  })

  it('falls back to the sprite when there is no official-artwork key at all', () => {
    const noArtwork = { types: charmander.types, sprites: { front_default: 'https://example.test/x.png' } }
    expect(pickImage(noArtwork)).toEqual({ url: 'https://example.test/x.png', shiny: false })
  })

  it('returns a null url when there is no image at all', () => {
    expect(pickImage({ types: charmander.types, sprites: {} })).toEqual({ url: null, shiny: false })
    expect(pickImage({ types: bulbasaur.types, sprites: {} })).toEqual({ url: null, shiny: false })
  })
})
