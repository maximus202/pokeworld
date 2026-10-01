/**
 * How a Pokemon, type or ability name is shown: "mr-mime" -> "Mr Mime". Shared
 * so the server can search the name exactly as the visitor sees it.
 */
export function displayName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
