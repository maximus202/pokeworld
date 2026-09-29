import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import App from '~/app.vue'

describe('component project', () => {
  it('mounts the app in a Nuxt environment', async () => {
    const wrapper = await mountSuspended(App)
    expect(wrapper.text()).toContain('Pokeworld')
  })
})
