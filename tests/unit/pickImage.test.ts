import { describe, expect, it } from 'vitest'
import { pickImage } from '../../server/utils/pickImage'

const sprites = {
  front_default: 'sprite-default',
  front_shiny: 'sprite-shiny',
  other: {
    'official-artwork': { front_default: 'art-default', front_shiny: 'art-shiny' }
  }
}
const types = (...names: string[]) => names.map(name => ({ type: { name } }))

describe('pickImage', () => {
  it('returns shiny artwork when grass is the primary type (bulbasaur)', () => {
    expect(pickImage({ types: types('grass', 'poison'), sprites })).toEqual({ url: 'art-shiny', shiny: true })
  })

  it('returns shiny artwork when grass is the secondary type (lotad)', () => {
    expect(pickImage({ types: types('water', 'grass'), sprites })).toEqual({ url: 'art-shiny', shiny: true })
  })

  it('returns the default artwork for non-grass Pokemon (charmander)', () => {
    expect(pickImage({ types: types('fire'), sprites })).toEqual({ url: 'art-default', shiny: false })
  })

  it('falls back to front_shiny when official-artwork is missing (grass)', () => {
    const { other: _other, ...plain } = sprites
    expect(pickImage({ types: types('grass'), sprites: plain })).toEqual({ url: 'sprite-shiny', shiny: true })
  })

  it('falls back to front_default when official-artwork is missing (non-grass)', () => {
    expect(pickImage({ types: types('normal'), sprites: { front_default: 'sprite-default', other: {} } }))
      .toEqual({ url: 'sprite-default', shiny: false })
  })

  it('falls back when only the artwork entry for the chosen key is null', () => {
    const partial = { ...sprites, other: { 'official-artwork': { front_default: 'art-default', front_shiny: null } } }
    expect(pickImage({ types: types('grass'), sprites: partial })).toEqual({ url: 'sprite-shiny', shiny: true })
  })

  it('returns a null url when there is no image at all', () => {
    expect(pickImage({ types: types('fire'), sprites: {} })).toEqual({ url: null, shiny: false })
  })
})
