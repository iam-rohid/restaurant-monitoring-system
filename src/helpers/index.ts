export const sleep = (time: number) =>
  new Promise((resolve) => setTimeout(resolve, time))

export function localMinutes(timezone: string, at = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return get("hour") * 60 + get("minute")
}

export function formatMin(
  min: number,
  opts: { hour12?: boolean; markNextDay?: boolean } = {}
): string {
  const { hour12 = false, markNextDay = false } = opts
  const nextDay = min >= 1440
  const m = ((min % 1440) + 1440) % 1440 // normalize into 0..1439
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2, "0")

  let out: string
  if (hour12) {
    const period = h < 12 ? "AM" : "PM"
    const h12 = h % 12 === 0 ? 12 : h % 12
    out = `${h12}:${mm} ${period}`
  } else {
    out = `${String(h).padStart(2, "0")}:${mm}`
  }
  return markNextDay && nextDay ? `${out} +1` : out
}

export function formatInterval(iv: {
  opensAtMin: number
  closesAtMin: number
}): string {
  return `${formatMin(iv.opensAtMin)} – ${formatMin(iv.closesAtMin)}`
}
