export default defineEventHandler(async (event) => {
  return toDetails(await getPokemon(getRouterParam(event, 'name')!.toLowerCase()))
})
