export default defineEventHandler(event => getPokemon(getRouterParam(event, 'name')!.toLowerCase()))
