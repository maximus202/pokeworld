import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isGrass, pickImage } from '../../server/utils/pickImage'

const load = (name: string) => JSON.parse(readFileSync(`tests/fixtures/pokemon/${name}.json`, 'utf8'))

describe('pickImage', () => {
  it('shows the shiny artwork for a grass primary type (bulbasaur)', () => {
    const p = load('bulbasaur')
    expect(pickImage(p)).toEqual({ url: p.sprites.other['official-artwork'].front_shiny, shiny: true })
  })

  it('shows the shiny artwork when grass is only the secondary type (lotad)', () => {
    const p = load('lotad')
    expect(p.types[0].type.name).toBe('water')
    expect(pickImage(p)).toEqual({ url: p.sprites.other['official-artwork'].front_shiny, shiny: true })
  })

  it('shows the default artwork for a non-grass Pokemon (charmander)', () => {
    const p = load('charmander')
    expect(pickImage(p)).toEqual({ url: p.sprites.other['official-artwork'].front_default, shiny: false })
  })

  it('falls back to the plain sprite when there is no official artwork', () => {
    const p = load('spriteonly')
    expect(pickImage(p)).toEqual({ url: p.sprites.front_default, shiny: false })
  })

  it('falls back to the shiny sprite for a grass Pokemon without artwork', () => {
    const p = { ...load('spriteonly'), types: [{ type: { name: 'grass' } }] }
    expect(pickImage(p)).toEqual({ url: p.sprites.front_shiny, shiny: true })
  })

  it('returns a null url when there is no image at all', () => {
    expect(pickImage({ types: [{ type: { name: 'fire' } }], sprites: {} })).toEqual({ url: null, shiny: false })
  })
})

describe('isGrass', () => {
  it('is true for grass in either slot and false otherwise', () => {
    expect(isGrass(load('bulbasaur'))).toBe(true)
    expect(isGrass(load('lotad'))).toBe(true)
    expect(isGrass(load('squirtle'))).toBe(false)
  })
})
