import { describe, expect, it } from 'vitest'
import { mapLimit } from '../../server/utils/concurrency'

const tick = () => new Promise(resolve => setTimeout(resolve, 5))

describe('mapLimit', () => {
  it('never runs more than `limit` calls at once', async () => {
    let running = 0
    let peak = 0
    await mapLimit(Array.from({ length: 30 }, (_, i) => i), 4, async () => {
      running++
      peak = Math.max(peak, running)
      await tick()
      running--
    })
    expect(peak).toBe(4)
  })

  it('returns results in input order, whatever order the calls finish in', async () => {
    const out = await mapLimit([30, 1, 20, 2], 2, async (n) => {
      await new Promise(resolve => setTimeout(resolve, n))
      return n * 2
    })
    expect(out).toEqual([60, 2, 40, 4])
  })

  it('handles an empty list and a limit larger than the list', async () => {
    expect(await mapLimit([], 8, async () => 1)).toEqual([])
    expect(await mapLimit([1, 2], 8, async n => n + 1)).toEqual([2, 3])
  })

  it('rejects when a call rejects', async () => {
    await expect(mapLimit([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('boom')
      return n
    })).rejects.toThrow('boom')
  })
})
