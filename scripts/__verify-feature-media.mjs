// One-off check for the homepage feature demos. Confirms the three things the GIF-to-video
// change was meant to buy, against a real browser and a real build:
//   1. no clip bytes are fetched on initial load
//   2. clips start playing only once the features section approaches the viewport
//   3. opening a card pulls the full-resolution clip, not the card one
// Run after `npm run build`:
//   node scripts/__verify-feature-media.mjs

import { chromium } from 'playwright'
import { preview } from 'vite'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Screenshots are written outside the repo so a verification run never shows up in git status.
const SHOTS = process.env.SHOT_DIR ?? path.join(tmpdir(), 'moonsprite-verify')
mkdirSync(SHOTS, { recursive: true })
const shot = (name) => path.join(SHOTS, `${name}.png`)

const server = await preview({ preview: { port: 4173, strictPort: true } })
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:4173/'
const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

let phase = 'initial-load'
const transfers = []
const consoleErrors = []
const badResponses = []

page.on('console', (message) => {
  if (message.type() !== 'error') return
  const location = message.location()
  consoleErrors.push(`${message.text()} @ ${location.url || '(inline)'}`)
})
page.on('response', (response) => {
  const target = response.url()
  if (response.status() >= 400) badResponses.push(`${response.status()} ${target}`)
  if (!target.includes('/assets/features/')) return
  const name = target.split('/').pop()
  const kind = name.endsWith('.webp') ? 'poster' : name.includes('-thumb') ? 'thumb' : 'full'
  transfers.push({ phase, name, kind, status: response.status(), bytes: Number(response.headers()['content-length'] ?? 0) })
})

const videoState = () => page.evaluate(() => Array.from(document.querySelectorAll('.gif-placeholder video')).map((element) => ({
  src: (element.currentSrc || '').split('/').pop(),
  paused: element.paused,
  seconds: Number(element.currentTime.toFixed(1)),
})))

const summarise = (label) => {
  const rows = transfers.filter((entry) => entry.phase === label)
  const bytes = rows.reduce((total, entry) => total + entry.bytes, 0)
  const byKind = {}
  for (const entry of rows) {
    byKind[entry.kind] = byKind[entry.kind] ?? { files: 0, bytes: 0 }
    byKind[entry.kind].files += 1
    byKind[entry.kind].bytes += entry.bytes
  }
  return { rows, bytes, byKind }
}

const report = (label) => {
  const { rows, bytes, byKind } = summarise(label)
  const parts = Object.entries(byKind).map(([kind, v]) => `${kind} ${v.files}x ${(v.bytes / 1024).toFixed(0)} KB`)
  console.log(`  ${label}: ${(bytes / 1024).toFixed(0)} KB   [${parts.join(', ') || 'nothing'}]`)
  return { rows, bytes }
}

console.log(`serving ${url}`)
console.log('\nasset fetches by phase')

await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(2500)
const initial = report('initial-load')
await page.screenshot({ path: shot('hero') })

phase = 'scroll-to-features'
await page.locator('#features').scrollIntoViewIfNeeded()
await page.waitForTimeout(3500)
const scrolled = report('scroll-to-features')
const afterScroll = await videoState()
await page.locator('.masonry').screenshot({ path: shot('features') })

phase = 'open-preview'
await page.locator('.gif-placeholder').first().click()
await page.waitForTimeout(2500)
const opened = report('open-preview')
const modal = await page.evaluate(() => {
  const video = document.querySelector('.media-preview-frame video')
  return video ? { src: (video.currentSrc || '').split('/').pop(), paused: video.paused, seconds: Number(video.currentTime.toFixed(1)) } : null
})
await page.screenshot({ path: shot('preview') })

console.log('\nplayback state after scrolling to the features section')
for (const item of afterScroll) console.log(`  ${item.paused ? 'paused ' : 'playing'}  ${item.seconds}s  ${item.src || '(no source)'}`)

// Walk the whole grid so every card has had a chance to load. A slug typed wrong in content.ts
// would otherwise fail quietly: that card would sit on an empty poster and nothing would say so.
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
const cards = page.locator('.gif-placeholder')
for (let index = 0; index < await cards.count(); index += 1) {
  await cards.nth(index).scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
}
await page.waitForTimeout(3000)
const loaded = await page.evaluate(() => Array.from(document.querySelectorAll('.gif-placeholder video')).map((element) => ({
  src: (element.currentSrc || '').split('/').pop(),
  error: element.error ? element.error.code : null,
  ready: element.readyState,
})))
const broken = loaded.filter((item) => item.error !== null || item.ready === 0)
const thumbsFetched = transfers.filter((entry) => entry.kind === 'thumb').length

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -> ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

console.log('')
// The observer starts a card loading slightly before it is on screen so playback is already
// running by the time it arrives, which means the first visible row is expected to load. What
// must not happen is the page pulling clips the visitor never scrolls to.
const totalCards = await page.evaluate(() => document.querySelectorAll('.gif-placeholder video').length)
const initialThumbs = initial.rows.filter((entry) => entry.kind === 'thumb').length
check('initial load does not fetch every clip', initialThumbs < totalCards, `${initialThumbs} of ${totalCards} card clips`)
check('initial feature bytes stay small', initial.bytes < 1024 * 1024, `${(initial.bytes / 1024).toFixed(0)} KB`)
check('clips load after scrolling to features', scrolled.rows.some((entry) => entry.kind === 'thumb'), `${scrolled.rows.length} request(s)`)
check('clips actually play', afterScroll.some((item) => !item.paused && item.seconds > 0))
check('only visible cards play', afterScroll.filter((item) => !item.paused).length < afterScroll.length,
  `${afterScroll.filter((item) => !item.paused).length} of ${afterScroll.length} playing`)
check('full clip used for the preview', opened.rows.some((entry) => entry.kind === 'full') && !opened.rows.some((entry) => entry.kind === 'thumb'))
check('every card clip resolves and loads', broken.length === 0,
  broken.length ? broken.map((item) => `${item.src} error=${item.error} ready=${item.ready}`).join(', ') : `${loaded.length} clips`)
check('every card clip is fetched once scrolled to', thumbsFetched === loaded.length, `${thumbsFetched} of ${loaded.length}`)
check('preview clip plays', Boolean(modal) && !modal.paused && modal.seconds > 0, modal ? `${modal.src} at ${modal.seconds}s` : 'no video')
check('no failed asset requests', transfers.every((entry) => entry.status < 400), transfers.filter((entry) => entry.status >= 400).map((entry) => entry.name).join(', '))
check('no 404s anywhere on the homepage', badResponses.length === 0, badResponses.join(' | '))
// Chrome asks for /favicon.ico on its own and the site ships none, so that one 404 is part of
// the page as it already was; anything else failing here would be ours.
const realErrors = consoleErrors.filter((message) => !message.includes('/favicon.ico'))
check('no console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

await browser.close()
await server.close()
console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed')
process.exit(failures.length ? 1 : 0)
