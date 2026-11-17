// Match the existing rainbow artwork, including its warm/cool intermediate colours.
const rainbowStops = ["#df5045", "#f0a944", "#f4e94c", "#72ce48", "#499cbf", "#3431d9"]

export function rainbowColor(position: number) {
  const scaled = Math.max(0, Math.min(100, position)) / 100 * (rainbowStops.length - 1)
  const index = Math.min(Math.floor(scaled), rainbowStops.length - 2)
  const mix = scaled - index
  const channels = [1, 3, 5].map((offset) => {
    const start = parseInt(rainbowStops[index].slice(offset, offset + 2), 16)
    const end = parseInt(rainbowStops[index + 1].slice(offset, offset + 2), 16)
    return Math.round(start + (end - start) * mix).toString(16).padStart(2, "0")
  })
  return `#${channels.join("")}`
}
