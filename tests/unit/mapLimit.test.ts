import { describe, expect, it } from 'vitest'
import { mapLimit } from '../../server/utils/mapLimit'

describe('mapLimit', () => {
  it('never runs more than `limit` calls at once, and keeps the input order', async () => {
    let running = 0
    let peak = 0
    const results = await mapLimit([5, 1, 4, 2, 3, 6, 7], 3, async (n) => {
      peak = Math.max(peak, ++running)
      await new Promise(r => setTimeout(r, n))
      running--
      return n * 10
    })
    expect(peak).toBe(3)
    expect(results).toEqual([50, 10, 40, 20, 30, 60, 70])
  })

  it('handles an empty list and a limit larger than the list', async () => {
    expect(await mapLimit([], 8, async n => n)).toEqual([])
    expect(await mapLimit([1, 2], 8, async n => n)).toEqual([1, 2])
  })

  it('rejects as soon as one call fails, while calls already started keep running', async () => {
    const started: number[] = []
    const failing = mapLimit([1, 2, 3, 4], 2, async (n) => {
      started.push(n)
      if (n === 1) throw new Error('boom')
      await new Promise(r => setTimeout(r, 20))
      return n
    })
    await expect(failing).rejects.toThrow('boom')
    await new Promise(r => setTimeout(r, 60))
    expect(started).toContain(2) // documented: fn should handle its own errors
  })
})
