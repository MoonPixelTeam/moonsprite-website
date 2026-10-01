import type { PackAnimations } from '../market/catalog'

const labels: Record<string, [string, string]> = {
  IDLE: ['待机', 'Idle'], SHOW: ['出场', 'Entrance'], idle: ['闲置反应', 'Idle reaction'],
  'pet.click': ['点击', 'Click'], 'pet.hover': ['抚摸', 'Hover'], 'pet.drag-start': ['提起', 'Pick up'],
  'pet.dragging': ['拖动', 'Dragging'], 'pet.drag-end': ['放下', 'Put down'], 'pet.enter': ['出场', 'Entrance'], 'pet.leave': ['离开', 'Leave'],
}
function check(condition: unknown): asserts condition { if (!condition) throw new Error('宠物包格式不受支持或动画数据无效，请使用 MoonSprite 导出的 v1 宠物包。') }
const bytes = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0))
export async function importPet(file: File) {
  check(file.size <= 50 * 1024 * 1024)
  const data = JSON.parse((await file.text()).replace(/^\uFEFF/, ''))
  check(data.format === 'moonsprite-pet' && data.version === 1)
  const pet = data.pet
  check(pet && typeof pet.name === 'string' && Array.isArray(pet.durations))
  for (const value of [pet.frameWidth, pet.frameHeight, pet.frameCount]) check(Number.isInteger(value) && value > 0)
  check(pet.frameWidth <= 4096 && pet.frameHeight <= 4096 && pet.frameCount <= 2048 && pet.frameWidth * pet.frameHeight * pet.frameCount <= 32_000_000)
  const actions = Object.entries(pet.animations ?? {}).filter((entry): entry is [string, number[]] => Array.isArray(entry[1]) && entry[1].length > 0)
  check(actions.length > 0 && actions.length <= 40)
  for (const [id, frames] of actions) {
    check(id.length <= 100 && frames.length <= 64)
    for (const frame of frames) check(Number.isInteger(frame) && frame >= 0 && frame < pet.frameCount && Number.isInteger(pet.durations[frame]) && pet.durations[frame] > 0)
    const duration = frames.reduce((sum, frame) => sum + pet.durations[frame], 0)
    check(duration >= 100 && duration <= 60000)
  }
  let sprite = data.sprite
  if (!sprite) {
    const encrypted = data.spriteEncrypted
    check(encrypted?.algorithm === 'AES-GCM' && typeof encrypted.data === 'string' && typeof encrypted.iv === 'string')
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('MoonSpritePetKey-v1-20260926-123'), 'AES-GCM', false, ['decrypt'])
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(encrypted.iv) }, key, bytes(encrypted.data))
    sprite = URL.createObjectURL(new Blob([plain], { type: 'image/png' }))
  } else check(typeof sprite === 'string' && sprite.startsWith('data:image/png;base64,'))
  const image = new Image()
  image.src = sprite
  try {
    await image.decode()
    check(image.width === pet.frameWidth && image.height === pet.frameHeight * pet.frameCount)
    const canvas = document.createElement('canvas')
    canvas.width = pet.frameWidth; canvas.height = pet.frameHeight
    const ctx = canvas.getContext('2d')!
    const cache = new Map<number, string>()
    const frameSource = (frame: number) => {
      if (!cache.has(frame)) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, frame * canvas.height, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
        const source = canvas.toDataURL('image/png'); check(source.length <= 710000); cache.set(frame, source)
      }
      return cache.get(frame)!
    }
    const sheets = Object.fromEntries(actions.map(([id, frames]) => [id, { dir: `imported-${id}`, sources: frames.map(frameSource), frames: frames.length,
      frameWidth: pet.frameWidth, frameHeight: pet.frameHeight, durations: frames.map(frame => pet.durations[frame]), duration: frames.reduce((sum, frame) => sum + pet.durations[frame], 0) }]))
    const triggers: NonNullable<PackAnimations['triggers']> = Array.isArray(pet.triggerSlots) ? pet.triggerSlots.filter((slot: { id: string; event: string }) => slot && Object.hasOwn(sheets, slot.id) && typeof slot.event === 'string').map((slot: NonNullable<PackAnimations['triggers']>[number]) => ({ id: slot.id, event: slot.event, repeat: Boolean(slot.repeat), cooldownMs: slot.cooldownMs, tool: slot.tool, idleSeconds: slot.idleSeconds })) : []
    const animations: PackAnimations = { order: actions.map(([id]) => id), sheets, triggers, idle: sheets.IDLE ?? sheets[actions[0][0]],
      labels: Object.fromEntries(actions.map(([id], index) => { const label = labels[id] ?? labels[triggers.find(slot => slot.id === id)?.event ?? ''] ?? [`动作 ${index + 1}`, `Action ${index + 1}`]; return [id, { zh: label[0], en: label[1] }] })) }
    if (JSON.stringify(animations).length > 2_000_000) throw new Error('宠物动画预览超过 2 MB，请精简动画或缩小画布后重新导出。')
    return { name: pet.name.slice(0, 48), size: `${pet.frameWidth} × ${pet.frameHeight}`, animations, image: animations.idle.sources![0],
      tagline: `${actions.length} 组动画，${pet.frameCount} 帧像素宠物`,
      body: `${pet.name}包含 ${actions.length} 组动画，共 ${pet.frameCount} 帧。\n下载后，将 .mspet 文件导入 MoonSprite 的宠物功能即可使用。`,
      includes: [{ zh: '可安装的 .mspet 宠物包', en: 'Installable .mspet pet package' }, { zh: `${actions.length} 组宠物动画`, en: `${actions.length} pet animations` }] }
  } finally { if (sprite.startsWith('blob:')) URL.revokeObjectURL(sprite) }
}
