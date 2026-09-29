import type { PokemonDetails, PokemonListItem, PokemonListResponse } from '#shared/types/pokemon'
import { pickImage } from './pickImage'
import { getPokemonIndex, getTypeMembers, getTypeNames, type PokeApiPokemon, type PokedexEntry } from './pokeapi'

const ARTWORK_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'

export function toDetails(pokemon: PokeApiPokemon): PokemonDetails {
  return {
    id: pokemon.id,
    name: pokemon.name,
    height: pokemon.height,
    abilities: pokemon.abilities.map(a => a.ability.name),
    types: pokemon.types.map(t => t.type.name),
    image: pickImage(pokemon),
  }
}

/** List items are built from the index alone, so a page needs no request per Pokemon. */
export function toListItem({ id, name }: PokedexEntry, grass: Set<string>): PokemonListItem {
  const shiny = grass.has(name)
  return { id, name, shiny, imageUrl: `${ARTWORK_URL}/${shiny ? 'shiny/' : ''}${id}.png` }
}

export interface PokemonQuery { q: string, type?: string, limit: number, offset: number }

/** One page of Pokemon matching the name search and type filter, in Pokedex order. */
export async function queryPokemon({ q, type, limit, offset }: PokemonQuery): Promise<PokemonListResponse> {
  if (type && !(await getTypeNames()).includes(type)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown type' })
  }
  const [index, grass, inType] = await Promise.all([
    getPokemonIndex(),
    getTypeMembers('grass'),
    type ? getTypeMembers(type) : undefined,
  ])
  const needle = q.trim().toLowerCase()
  const matches = index.filter(entry => entry.name.includes(needle) && (!inType || inType.has(entry.name)))
  return { total: matches.length, items: matches.slice(offset, offset + limit).map(entry => toListItem(entry, grass)) }
}
