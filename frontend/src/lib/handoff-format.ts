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
