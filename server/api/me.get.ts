export default defineEventHandler((event) => {
  const id = requireVisitorId(event)
  return { label: `Trainer #${id.slice(0, 4)}` }
})
