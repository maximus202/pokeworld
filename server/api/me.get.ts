export default defineEventHandler((event) => {
  markPrivate(event)
  return { label: visitorLabel(requireVisitorId(event)) }
})
