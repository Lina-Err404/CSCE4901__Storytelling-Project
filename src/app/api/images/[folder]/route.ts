import { readdir } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

const ALLOWED_FOLDERS = ["character", "props", "background"]
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ folder: string }> }
) {
  const { folder } = await params

  // Whitelist folders so nobody can request ../../something
  if (!ALLOWED_FOLDERS.includes(folder)) {
    return NextResponse.json([], { status: 404 })
  }

  const dir = path.join(process.cwd(), "public", "images", folder)
  const files = await readdir(dir)

  return NextResponse.json(
    files
      .filter((f) => IMAGE_EXT.test(f))
      .map((f) => ({ name: f, src: `/images/${folder}/${f}` }))
  )
}