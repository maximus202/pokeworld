export default defineEventHandler((event) => {
  return { label: visitorLabel(requireVisitorId(event)) }
})
