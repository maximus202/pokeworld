export default defineEventHandler(async () => ({ types: await getTypeNames() }))
