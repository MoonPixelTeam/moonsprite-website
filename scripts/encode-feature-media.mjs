// Transcodes the homepage feature demos from GIF to H.264 MP4 plus a WebP poster.
//
// Why: the source GIFs are 2560x1375 with 300-700 frames each. A GIF always decodes at full
// source resolution no matter how small it is displayed, in software, with no inter-frame
// compression, so ten of them animating at once costs ~60 GB of decode work per pass and pins
// the CPU. H.264 is decoded on the GPU and stores only the differences between frames.
//
// Two sizes are produced on purpose:
//   <slug>-thumb.mp4  (~800w)  for the homepage masonry card, which is only ~280 CSS px wide
//   <slug>-full.mp4   (~1920w) for the zoom preview dialog, which can show up to ~1730 px
// Only the thumb is fetched on page load; the full file is fetched when a visitor opens a card.
//
// H.264 only, no WebM: VP9 measured ~20% smaller here, which does not justify doubling the
// asset count, and H.264 is the format that hardware-decodes on every machine we care about.
//
// Source of truth for the originals is res/rec/. Run from the repo root:
//   node scripts/encode-feature-media.mjs
// Requires ffmpeg on PATH, or set FFMPEG=/path/to/ffmpeg(.exe).

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const FFPROBE = process.env.FFPROBE ?? FFMPEG.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace('ffmpeg', 'ffprobe'))

// The originals live in res/rec/ under the names they were recorded with; only the web
// derivatives belong in public/, so nothing that ships is also an archival master.
const SOURCE_DIR = path.join('res', 'rec')
const OUTPUT_DIR = path.join('public', 'assets', 'features')
const THUMB_WIDTH = 800
const FULL_WIDTH = 1920
// A demo GIF usually opens on an empty canvas and fills in as it goes, so a poster taken from
// the first frame reads as a blank window. Sample most of the way through instead.
const POSTER_POSITION = 0.85

/** Source recording name in res/rec/ → slug used for the generated files and in content.ts. */
const SOURCES = {
  'per-frame-layer-mask': '逐帧图层蒙版.gif',
  'tween-single-frame': '补间动画1【单帧】.gif',
  'tween-deformation': '补间动画2【形变补间】.gif',
  'tween-loop': '补间动画3【循环节】.gif',
  'pattern-brush': '图案笔刷1（图案笔刷）.gif',
  'temporary-brush': '图案笔刷2（临时笔刷）.gif',
  'liquify': '液化.gif',
  'iso-drawing-guide': 'ISO绘制辅助.gif',
  'automatic-antialiasing': '自动抗锯齿.gif',
  'timelapse-recording': '缩时动画与导出.gif',
}

function run(bin, args) {
  const result = spawnSync(bin, args, { stdio: 'inherit' })
  if (result.error) throw new Error(`${bin} failed to start: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`${bin} exited with code ${result.status}`)
}

function probe(bin, args) {
  const result = spawnSync(bin, args, { encoding: 'utf8' })
  if (result.error) throw new Error(`${bin} failed to start: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`${bin} exited with code ${result.status}`)
  return result.stdout.trim()
}

function duration(file) {
  const value = probe(FFPROBE, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ])
  const seconds = Number.parseFloat(value)
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`could not read duration of ${file}`)
  return seconds
}

function encode(source, slug, { width, crf }) {
  const output = path.join(OUTPUT_DIR, `${slug}-${width === THUMB_WIDTH ? 'thumb' : 'full'}.mp4`)
  run(FFMPEG, [
    '-y', '-v', 'error',
    '-i', source,
    '-vf', `scale=${width}:-2:flags=lanczos`,
    // The GIFs have variable frame delays (~12.5-14.3 fps average). Keeping VFR preserves the
    // original timing instead of duplicating frames up to a constant rate.
    '-fps_mode', 'vfr',
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', String(crf),
    // Flat pixel-art regions with hard edges are what tune=animation optimises for.
    '-tune', 'animation',
    '-pix_fmt', 'yuv420p',
    // Puts the index at the front so playback can start before the file has fully arrived.
    '-movflags', '+faststart',
    '-an',
    output,
  ])
  return output
}

function poster(source, slug, seconds) {
  const output = path.join(OUTPUT_DIR, `${slug}-poster.webp`)
  run(FFMPEG, [
    '-y', '-v', 'error',
    '-ss', (seconds * POSTER_POSITION).toFixed(3),
    '-i', source,
    '-vf', `scale=${THUMB_WIDTH}:-2:flags=lanczos`,
    '-frames:v', '1',
    '-c:v', 'libwebp',
    '-quality', '82',
    output,
  ])
  return output
}

function kb(file) {
  return `${(statSync(file).size / 1024).toFixed(0)} KB`
}

function main() {
  for (const [slug, name] of Object.entries(SOURCES)) {
    if (!existsSync(path.join(SOURCE_DIR, name))) throw new Error(`missing source ${path.join(SOURCE_DIR, name)}`)
  }
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

  const entries = Object.entries(SOURCES)
  let thumbTotal = 0
  let fullTotal = 0
  let gifTotal = 0

  for (const [slug, name] of entries) {
    const source = path.join(SOURCE_DIR, name)
    const seconds = duration(source)
    const thumb = encode(source, slug, { width: THUMB_WIDTH, crf: 26 })
    const full = encode(source, slug, { width: FULL_WIDTH, crf: 24 })
    const still = poster(source, slug, seconds)

    thumbTotal += statSync(thumb).size
    fullTotal += statSync(full).size
    gifTotal += statSync(source).size
    console.log(`${slug}  ${seconds.toFixed(1)}s  thumb ${kb(thumb)}  full ${kb(full)}  poster ${kb(still)}`)
  }

  const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
  console.log(`\n${entries.length} demos`)
  console.log(`  gif   ${mb(gifTotal)}  (was: what the homepage fetched)`)
  console.log(`  thumb ${mb(thumbTotal)}  (now: homepage page load)`)
  console.log(`  full  ${mb(fullTotal)}  (now: only on opening a preview)`)
  console.log(`\nWritten to ${OUTPUT_DIR}. Keep the .gif originals out of public/ so they are not deployed.`)
}

main()
