/**
 * Maps `items` with `fn`, never running more than `limit` calls at once. Results keep the input order.
 * `fn` should handle its own errors: if one call rejects, the result rejects at once, but the
 * workers keep going through the remaining items and their results are discarded.
 */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
