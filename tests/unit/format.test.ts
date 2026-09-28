import { describe, expect, it } from 'vitest'
import { defaultImageFallback, displayName, formatCaughtDate, formatCaughtDateTime, formatHeight } from '../../app/utils/format'

describe('displayName', () => {
  it('capitalises each hyphen-separated word', () => {
    expect(displayName('bulbasaur')).toBe('Bulbasaur')
    expect(displayName('mr-mime')).toBe('Mr Mime')
  })
})

describe('formatHeight', () => {
  it('converts decimetres to metres and feet/inches', () => {
    expect(formatHeight(7)).toBe('0.7 m (2′04″)')
    expect(formatHeight(17)).toBe('1.7 m (5′07″)')
  })
})

describe('formatCaughtDate', () => {
  const iso = '2026-09-28T02:00:00.000Z'

  it('formats a UTC instant as a date', () => {
    expect(formatCaughtDate(iso, 'en-US', 'UTC')).toBe('Sep 28, 2026')
  })

  it('shows the viewer\'s local day, which can differ from the UTC day', () => {
    expect(formatCaughtDate(iso, 'en-US', 'America/Los_Angeles')).toBe('Sep 27, 2026')
    expect(formatCaughtDate(iso, 'en-US', 'Pacific/Auckland')).toBe('Sep 28, 2026')
  })

  it('includes the time in the detailed form', () => {
    expect(formatCaughtDateTime(iso, 'en-US', 'UTC')).toBe('Sep 28, 2026, 2:00 AM')
  })
})

describe('defaultImageFallback', () => {
  it('drops the shiny path segment', () => {
    expect(defaultImageFallback('https://x/official-artwork/shiny/1.png')).toBe('https://x/official-artwork/1.png')
  })

  it('has no fallback for a non-shiny image', () => {
    expect(defaultImageFallback('https://x/official-artwork/1.png')).toBeNull()
  })
})
