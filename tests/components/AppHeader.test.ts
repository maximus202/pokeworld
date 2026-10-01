import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { UModal } from '#components'
import AppHeader from '~/components/AppHeader.vue'

let caught = ['bulbasaur', 'lotad']
let resetStatus = 204
let resets = 0
let resetGate: Promise<void> | undefined // holds the DELETE's response

registerEndpoint('/api/me', () => ({ label: 'Trainer #a3f9' }))
registerEndpoint('/api/collection', {
  method: 'GET',
  handler: () => ({ count: caught.length, items: caught.map(name => ({ name, caughtAt: '2026-09-28T14:00:00.000Z', pokemon: null })) }),
})
registerEndpoint('/api/collection', {
  method: 'DELETE',
  handler: async () => {
    resets++
    await resetGate
    if (resetStatus !== 204) throw createError({ statusCode: resetStatus })
    caught = []
    return null
  },
})

// The modal is teleported to <body>, so its buttons are found there.
const dialog = (testId: string) => document.body.querySelector<HTMLElement>(`[data-testid=${testId}]`)
const click = async (testId: string) => {
  dialog(testId)!.click()
  await flushPromises()
}

async function mountHeader() {
  const wrapper = await mountSuspended(AppHeader)
  await useCollection().refresh()
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  useState('collection-items').value = [] // not clearNuxtState: earlier tests' headers still read it
  document.body.innerHTML = ''
  caught = ['bulbasaur', 'lotad']
  resetStatus = 204
  resets = 0
  resetGate = undefined
})

describe('AppHeader', () => {
  it('shows the visitor label and the collection count', async () => {
    const wrapper = await mountHeader()
    expect(wrapper.find('[data-testid=visitor-label]').text()).toBe('Trainer #a3f9')
    expect(wrapper.find('[data-testid=collection-link]').text()).toBe('My Collection (2)')
  })

  it('links to the browse and collection screens', async () => {
    const wrapper = await mountHeader()
    expect(wrapper.findAll('nav a').map(a => a.attributes('href'))).toEqual(['/', '/collection'])
  })

  it('asks for confirmation before resetting, and cancelling changes nothing', async () => {
    const wrapper = await mountHeader()
    await wrapper.find('[data-testid=reset-button]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Reset your collection?')

    await click('reset-cancel')

    expect(resets).toBe(0)
    expect(wrapper.find('[data-testid=collection-link]').text()).toBe('My Collection (2)')
  })

  it('resets the collection when confirmed, closes the dialog and updates the count', async () => {
    const wrapper = await mountHeader()
    await wrapper.find('[data-testid=reset-button]').trigger('click')
    await flushPromises()

    await click('reset-confirm')

    await vi.waitFor(() => expect(wrapper.find('[data-testid=collection-link]').text()).toBe('My Collection (0)'))
    expect(resets).toBe(1)
    await vi.waitFor(() => expect(dialog('reset-confirm')).toBeNull())
  })

  it('shows an error in the dialog, keeps it open and leaves the count alone when the reset fails', async () => {
    resetStatus = 500
    const wrapper = await mountHeader()
    await wrapper.find('[data-testid=reset-button]').trigger('click')
    await flushPromises()

    await click('reset-confirm')

    await vi.waitFor(() => expect(dialog('reset-error')!.textContent).toContain('Nothing was changed'))
    expect(dialog('reset-confirm')).not.toBeNull()
    expect(wrapper.find('[data-testid=collection-link]').text()).toBe('My Collection (2)')
  })

  it('clears an earlier error when the dialog is opened again', async () => {
    resetStatus = 500
    const wrapper = await mountHeader()
    await wrapper.find('[data-testid=reset-button]').trigger('click')
    await flushPromises()
    await click('reset-confirm')
    await click('reset-cancel')

    await wrapper.find('[data-testid=reset-button]').trigger('click')
    await flushPromises()

    expect(dialog('reset-error')).toBeNull()
  })

  it('cannot be cancelled or dismissed while the reset is running, so its outcome is never hidden', async () => {
    let release!: () => void
    resetGate = new Promise(resolve => (release = resolve))
    const wrapper = await mountHeader()
    await wrapper.find('[data-testid=reset-button]').trigger('click')
    await flushPromises()
    const modal = wrapper.findComponent(UModal)
    expect(modal.props('dismissible')).toBe(true)
    expect(dialog('reset-cancel')!.hasAttribute('disabled')).toBe(false)

    await click('reset-confirm')

    expect(modal.props('dismissible')).toBe(false)
    expect(dialog('reset-cancel')!.hasAttribute('disabled')).toBe(true)
    release()
    await vi.waitFor(() => expect(dialog('reset-confirm')).toBeNull())
  })
})
