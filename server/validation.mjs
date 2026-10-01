export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code }
}
export function requireValue(condition, code = 'invalid-input', status = 400) {
  if (!condition) throw new HttpError(status, code)
}
export function string(value, code, min = 1, max = 200) {
  requireValue(typeof value === 'string' && value.trim().length >= min && value.trim().length <= max, code)
  return value.trim()
}
export function email(value) {
  const result = string(value, 'email', 3, 254).toLowerCase()
  requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result), 'email')
  return result
}
export function password(value) {
  requireValue(typeof value === 'string' && value.length >= 8 && value.length <= 128, 'password')
  return value
}
export function cents(value) {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100000 && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'amount')
  return Math.round(value * 100)
}
function text(value, code, max, min = 0) {
  requireValue(value && typeof value === 'object', code)
  return { zh: string(value.zh, code, min, max), en: string(value.en, code, min, max) }
}
function array(value, max, convert) {
  requireValue(Array.isArray(value) && value.length <= max)
  return value.map(convert)
}
function image(value) {
  const result = string(value, 'image', 1, 710000)
  requireValue(/^\/assets\/[a-zA-Z0-9_./%\-]+$/.test(result) || /^https:\/\/[^\s]+$/.test(result) || /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(result), 'image')
  return result
}
function sheet(value) {
  requireValue(value && typeof value === 'object', 'animation')
  const result = { dir: string(value.dir, 'animation', 1, 160) }
  for (const [key, min, max] of [['frames', 1, 64], ['frameWidth', 1, 4096], ['frameHeight', 1, 4096], ['duration', 100, 60000]]) {
    requireValue(Number.isInteger(value[key]) && value[key] >= min && value[key] <= max, 'animation')
    result[key] = value[key]
  }
  result.sources = array(value.sources, 64, image)
  requireValue(result.sources.length === result.frames, 'animation')
  if (value.durations !== undefined) {
    result.durations = array(value.durations, 64, duration => {
      requireValue(Number.isInteger(duration) && duration > 0 && duration <= 60000, 'animation')
      return duration
    })
    requireValue(result.durations.length === result.frames && result.durations.reduce((sum, duration) => sum + duration, 0) === result.duration, 'animation')
  }
  return result
}
export function listing(input) {
  requireValue(input && typeof input === 'object')
  if (input.priceCnyCents !== undefined) requireValue(Number.isSafeInteger(input.priceCnyCents) && input.priceCnyCents >= 0 && input.priceCnyCents <= 72000000, 'amount')
  const category = string(input.category, 'category')
  requireValue(['pets', 'assets', 'bundles', 'extensions', 'scripts'].includes(category), 'category')
  const result = {
    name: text(input.name, 'name', 120, 1), tagline: text(input.tagline, 'tagline', 300),
    body: text(input.body, 'body', 20000), category, price: input.priceCnyCents === undefined ? cents(input.price) / 100 : input.priceCnyCents / 100 / 7.2,
    ...(input.priceCnyCents === undefined ? {} : { priceCnyCents: input.priceCnyCents }),
    size: string(input.size, 'size', 0, 120),
    formats: array(input.formats, 20, item => string(item, 'formats', 1, 40)),
    tags: array(input.tags ?? [], 30, item => string(item, 'tags', 1, 60)),
    previews: array(input.previews ?? [], 6, image),
    includes: array(input.includes ?? [], 30, item => text(item, 'includes', 160)),
    packs: category === 'bundles' ? array(input.packs ?? [], 50, item => string(item, 'packs', 1, 100)) : [],
  }
  if (input.image) result.image = image(input.image)
  if (input.compatibleVersion) result.compatibleVersion = string(input.compatibleVersion, 'version', 1, 80)
  if (category === 'pets' && input.animations) {
    const source = input.animations
    const order = array(source.order, 40, item => string(item, 'animation', 1, 100))
    requireValue(new Set(order).size === order.length && order.length > 0, 'animation')
    const sheets = Object.fromEntries(order.map(id => [id, sheet(source.sheets?.[id])]))
    const labels = Object.fromEntries(order.map(id => [id, text(source.labels?.[id], 'animation', 60, 1)]))
    const idle = Object.values(sheets).find(item => item.dir === source.idle?.dir)
    requireValue(idle, 'animation')
    const triggers = array(source.triggers ?? [], 100, value => {
      requireValue(value && order.includes(value.id), 'animation')
      const trigger = { id: value.id, event: string(value.event, 'animation', 1, 100) }
      if (value.repeat !== undefined) { requireValue(typeof value.repeat === 'boolean', 'animation'); trigger.repeat = value.repeat }
      if (value.tool !== undefined) trigger.tool = string(value.tool, 'animation', 0, 100)
      for (const field of ['cooldownMs', 'idleSeconds']) if (value[field] !== undefined) {
        requireValue(Number.isFinite(value[field]) && value[field] >= 0 && value[field] <= 3600000, 'animation')
        trigger[field] = value[field]
      }
      return trigger
    })
    result.animations = { order, sheets, labels, idle, triggers }
  }
  requireValue(JSON.stringify(result).length <= 3_000_000, 'size')
  return result
}
