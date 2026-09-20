export function parseHorizonDays(
  raw: string,
): { ok: true; days: number } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return { ok: false, error: 'Enter a horizon between 1 and 30 days.' }
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: 'Horizon must be a whole number of days (1–30).' }
  }
  const days = Number(trimmed)
  if (days < 1 || days > 30) {
    return { ok: false, error: 'Horizon must be between 1 and 30 days.' }
  }
  return { ok: true, days }
}
