// Existing public files only. No new assets or dependency on the image-list API.
// Add paths here when new drawing assets are supplied.
const characterFiles = ["20220728_125054.png", "Untitled128_20261017210110.png", "Untitled47_20240711030917.png", "Untitled47_20240711031924.png", "Untitled92_20260320204339.png", "Untitled95_20260320204611.png"]
const propFiles = ["Untitled48_20240711083849.png", "Untitled48_20240711102837.png", "Untitled48_20240711102842.png", "Untitled48_20240711102844.png", "Untitled48_20240713232210.png", "Untitled96_20260326001950.png", "Untitled96_20260402132903.png"]
const backgroundFiles = ["Untitled103_20260424135732.png", "Untitled103_20260424135815.png", "Untitled116.png", "Untitled48_20240711082655.png", "Untitled48_20240711120258.png", "Untitled90_20260213150211.png", "Untitled96_20260325145211.png"]
const inFolder = (folder: string, files: string[]) => files.map((name) => ({ name, src: `/images/${folder}/${name}` }))

export const drawingAssets = {
  shapes: [],
  stamps: [...inFolder("character", characterFiles), ...inFolder("props", propFiles)],
  background: inFolder("background", backgroundFiles),
}
