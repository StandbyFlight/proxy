// Shared date/time display helpers for pass and history rendering.

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

// "JUL 04" from an ISO timestamp, or null if unparseable.
export function passDate(iso: string): string | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

// "14:35" from an ISO timestamp, or null if unparseable.
export function passTime(iso: string): string | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
