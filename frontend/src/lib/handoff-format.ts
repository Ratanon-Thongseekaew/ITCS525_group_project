function getDateParts(value: string) {
  const date = new Date(value)
  return {
    date,
    day: date.getDate(),
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    year: date.getFullYear(),
  }
}

export function formatTimeOfDay(hours: number, minutes: number) {
  const period = hours < 12 ? 'AM' : 'PM'
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${period}`
}

export function formatPickupDate(value: string) {
  const { day, month, year } = getDateParts(value)
  return `${day} ${month} ${year}`
}

export function formatPackedAt(value: string) {
  const { date, day, month, year } = getDateParts(value)
  const time = formatTimeOfDay(date.getHours(), date.getMinutes())
  return `${time}, ${day} ${month.toUpperCase()} ${year}`
}

export function formatCollectedAt(value: string) {
  const { date, day, month, year } = getDateParts(value)
  const time = formatTimeOfDay(date.getHours(), date.getMinutes())
  return `${day} ${month.toUpperCase()} ${year}, ${time}`
}

function formatWeightAmount(value: number) {
  const amount = value.toFixed(1)
  // Small negative values round to "-0.0", which reads as a real difference.
  return amount === '-0.0' ? '0.0' : amount
}

export function formatRecordedWeight(value: number) {
  return `${formatWeightAmount(value)}kg`
}

export function formatWeightKg(value: number) {
  return `${formatWeightAmount(value)} kg`
}

export function formatVarianceKg(value: number) {
  const amount = formatWeightAmount(value)
  return `${Number(amount) > 0 ? '+' : ''}${amount} kg`
}

export function formatVariancePercent(value: number) {
  return `${value.toFixed(2)}%`
}

/** For example "1.8 kg (4.39%)": the kg gap, then that gap as a percentage of the staff weight. */
export function formatWeightDifference(differenceKg: number, percent: number, suffix = '') {
  return `${formatWeightKg(differenceKg)} (${formatVariancePercent(percent)}${suffix})`
}

/** Combines a local date (YYYY-MM-DD) and time (HH:MM) into an ISO string with a UTC offset. */
export function toOffsetIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString()
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** Local date and the latest half-hour slot at or before `now`, for prefilling pickup fields. */
export function currentPickupSlot(now = new Date()) {
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${now.getMinutes() < 30 ? '00' : '30'}`,
  }
}
