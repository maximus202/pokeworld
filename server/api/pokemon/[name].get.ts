export default defineEventHandler(event => {
  const name = getRouterParam(event, 'name')!.toLowerCase()

  return getPokemon(name)
})
