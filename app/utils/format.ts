/** "mr-mime" -> "Mr Mime" */
export function displayName(name: string): string {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/** PokeAPI heights are decimetres: 7 -> "0.7 m (2′04″)" */
export function formatHeight(decimetres: number): string {
  const metres = decimetres / 10
  const totalInches = Math.round(metres * 39.3701)
  const feet = Math.floor(totalInches / 12)
  const inches = totalInches % 12
  return `${metres.toFixed(1)} m (${feet}′${String(inches).padStart(2, '0')}″)`
}

/**
 * "2026-09-28T02:00:00.000Z" -> "Sep 28, 2026", in the viewer's local time zone (or the given one).
 * The stored value is UTC, so the day shown can differ from the UTC date.
 */
export function formatCaughtDate(iso: string, locale?: string, timeZone?: string): string {
  return new Date(iso).toLocaleDateString(locale ?? 'en-US', { dateStyle: 'medium', timeZone })
}

/** The same instant with the time, for a tooltip: "Sep 28, 2026, 7:03 AM". */
export function formatCaughtDateTime(iso: string, locale?: string, timeZone?: string): string {
  return new Date(iso).toLocaleString(locale ?? 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone })
}

/** The non-shiny counterpart of a sprites-repo image URL, used when a shiny image fails to load. */
export function defaultImageFallback(url: string): string | null {
  return url.includes('/shiny/') ? url.replace('/shiny/', '/') : null
}
