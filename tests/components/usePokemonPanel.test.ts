import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => vi.restoreAllMocks())

describe('closing the details panel', () => {
  it('steps back when the visitor came from this same screen, leaving no extra history entry', async () => {
    const router = useRouter()
    await router.push('/?q=bulb')
    await router.push('/?q=bulb&pokemon=bulbasaur') // what clicking a card does
    const back = vi.spyOn(router, 'back').mockImplementation(() => {})
    const replace = vi.spyOn(router, 'replace')

    usePokemonPanel().close()

    expect(back).toHaveBeenCalledOnce()
    expect(replace).not.toHaveBeenCalled()
  })

  it('replaces the entry when there is nothing to go back to, as with a shared or reloaded link', async () => {
    const router = useRouter()
    await router.push('/somewhere-else')
    await router.push('/?q=bulb&pokemon=bulbasaur') // arrived from elsewhere
    const back = vi.spyOn(router, 'back').mockImplementation(() => {})
    const replace = vi.spyOn(router, 'replace')

    usePokemonPanel().close()

    expect(back).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith({ query: { q: 'bulb' } })
  })
})
