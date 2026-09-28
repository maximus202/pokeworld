export default defineEventHandler(async () => {
  return { types: await getTypeNames() }
})
