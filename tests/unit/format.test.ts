import { describe, expect, it } from 'vitest'
import { displayName, formatCaughtDate, formatCaughtDateTime, formatHeight } from '../../app/utils/format'

describe('displayName', () => {
  it.each([
    ['bulbasaur', 'Bulbasaur'],
    ['mr-mime', 'Mr Mime'],
    ['porygon-z', 'Porygon Z'],
  ])('%s -> %s', (name, expected) => {
    expect(displayName(name)).toBe(expected)
  })
})

describe('formatHeight', () => {
  it.each([
    [7, '0.7 m (2′04″)'],
    [17, '1.7 m (5′07″)'],
    [1, '0.1 m (0′04″)'],
    [100, '10.0 m (32′10″)'],
  ])('%s decimetres -> %s', (decimetres, expected) => {
    expect(formatHeight(decimetres)).toBe(expected)
  })
})

describe('caught date', () => {
  const caught = '2026-09-28T02:00:00.000Z'

  it('is shown in the viewer time zone, which can be a different day than UTC', () => {
    expect(formatCaughtDate(caught, 'UTC')).toBe('Sep 28, 2026')
    expect(formatCaughtDate(caught, 'America/Los_Angeles')).toBe('Sep 27, 2026')
    expect(formatCaughtDate(caught, 'Pacific/Auckland')).toBe('Sep 28, 2026')
  })

  it('adds the time for the tooltip', () => {
    expect(formatCaughtDateTime(caught, 'UTC')).toBe('Sep 28, 2026, 2:00 AM')
    expect(formatCaughtDateTime(caught, 'America/Los_Angeles')).toBe('Sep 27, 2026, 7:00 PM')
  })
})
