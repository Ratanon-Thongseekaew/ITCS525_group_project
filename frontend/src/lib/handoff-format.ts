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
