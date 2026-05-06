export function adjustColor(hex: string, amount: number): string {
  const cleaned = hex.replace('#', '').padStart(6, '0')
  const num = parseInt(cleaned, 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount))
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
}
