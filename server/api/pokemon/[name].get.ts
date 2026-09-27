export default defineEventHandler(async (event) => {
  const name = requireName(getRouterParam(event, 'name'))
  const pokemon = await getPokemon(name)
  return {
    id: pokemon.id,
    name: pokemon.name,
    height: pokemon.height,
    abilities: pokemon.abilities.map(a => a.ability.name),
    types: pokemon.types.map(t => t.type.name),
    image: pickImage(pokemon)
  }
})
