const INCHES_PER_METRE = 39.3701

/** PokeAPI heights are decimetres: 7 -> "0.7 m (2′04″)" */
export function formatHeight(decimetres: number): string {
  const metres = decimetres / 10
  const totalInches = Math.round(metres * INCHES_PER_METRE)
  const inches = String(totalInches % 12).padStart(2, '0')

  return `${metres.toFixed(1)} m (${Math.floor(totalInches / 12)}′${inches}″)`
}

/**
 * "2026-09-28T02:00:00.000Z" -> "Sep 28, 2026", in the viewer's time zone (or
 * the one given). The stored value is UTC, so the day shown can differ from the
 * UTC date.
 */
export const formatCaughtDate = (iso: string, timeZone?: string) =>
  new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone })

/** The same instant with the time, for a tooltip: "Sep 28, 2026, 7:03 AM". */
export const formatCaughtDateTime = (iso: string, timeZone?: string) =>
  new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  })
