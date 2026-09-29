import { useEffect, useRef, useState } from 'react'
import type { PackAnimations } from './catalog'
import type { Language } from '../content'
import { PetSpriteStrip } from './PixelArt'

type Gesture = { id: number; x: number; y: number; left: number; top: number; moved: boolean }
export function PetPlayground({ animations, language, name }: { animations: PackAnimations; language: Language; name: string }) {
  const [action, setAction] = useState('IDLE')
  const [run, setRun] = useState(0)
  const [position, setPosition] = useState({ x: 50, y: 62 })
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<Gesture | null>(null)
  const hover = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cooldowns = useRef(new Map<string, number>())
  const suppressClick = useRef(false)
  const zh = language === 'zh'
  const triggers = animations.triggers ?? (animations.sheets.TRIGGER_TOUCH ? [{ id: 'TRIGGER_TOUCH', event: 'pet.click' }] : [])
  const sheet = animations.sheets[action] ?? animations.idle
  const clear = () => { clearTimeout(timer.current) }
  const play = (id: string, repeat = false, done?: () => void) => {
    clear()
    setAction(id); setRun(value => value + 1)
    if (!repeat) timer.current = setTimeout(() => { if (done) done(); else settle() }, (animations.sheets[id] ?? animations.idle).duration)
  }
  const trigger = (event: string, done?: () => void) => {
    const slot = triggers.find(slot => slot.event === event && animations.sheets[slot.id] && Date.now() - (cooldowns.current.get(slot.id) ?? 0) >= (slot.cooldownMs ?? 0))
    if (!slot) return false
    cooldowns.current.set(slot.id, Date.now())
    play(slot.id, slot.repeat ?? event === 'pet.dragging', done)
    return true
  }
  const settle = () => {
    if (drag.current?.moved) { if (trigger('pet.dragging')) return }
    else if (hover.current && trigger('pet.hover')) return
    play('IDLE', true)
  }
  const finish = () => {
    const moved = drag.current?.moved
    drag.current = null
    suppressClick.current = Boolean(moved)
    if (moved && trigger('pet.drag-end')) return
    settle()
  }
  useEffect(() => {
    const blur = () => { hover.current = false; if (drag.current) finish(); else play('IDLE', true) }
    window.addEventListener('blur', blur)
    return () => { clear(); window.removeEventListener('blur', blur) }
  }, [animations])
  return <div className="pet-playground">
    <div className="pet-playground-stage" ref={stage}>
      <p className="pet-playground-hint">{zh ? '点一点、摸一摸，或拖动它。每只宠物都有自己的反应。' : 'Click, hover, or drag. Each pet has its own reactions.'}</p>
      <button type="button" className="pet-playground-pet" style={{ left: position.x+'%', top: position.y+'%' }} aria-label={zh ? name+'：点击互动，方向键移动' : name+': click to interact, arrow keys to move'}
        onPointerEnter={() => { hover.current = true; if (!drag.current) { if (!trigger('pet.enter', settle)) settle() } }}
        onPointerLeave={() => { hover.current = false; if (!drag.current && !trigger('pet.leave')) play('IDLE', true) }}
        onPointerDown={event => {
          if (event.button !== 0 || drag.current) return
          suppressClick.current = false
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: position.x, top: position.y, moved: false }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={event => {
          const gesture = drag.current
          if (!gesture || gesture.id !== event.pointerId || !stage.current) return
          if (!gesture.moved && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 5) {
            gesture.moved = true
            if (!trigger('pet.drag-start', () => { if (drag.current === gesture) settle() })) settle()
          }
          if (!gesture.moved) return
          const bounds = stage.current.getBoundingClientRect(), pet = event.currentTarget.getBoundingClientRect()
          const x = gesture.left / 100 * bounds.width + event.clientX - gesture.x
          const y = gesture.top / 100 * bounds.height + event.clientY - gesture.y
          setPosition({ x: Math.max(pet.width/2, Math.min(bounds.width-pet.width/2,x))/bounds.width*100, y: Math.max(pet.height/2,Math.min(bounds.height-pet.height/2,y))/bounds.height*100 })
        }}
        onPointerUp={event => {
          if (drag.current?.id !== event.pointerId) return
          const moved = drag.current.moved
          if (moved) finish(); else drag.current = null
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => finish()}
        onLostPointerCapture={() => { if (drag.current) finish() }}
        onClick={event => { if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; return }; if (!trigger('pet.click')) settle() }}
        onKeyDown={event => {
          const directions: Record<string, [number, number]> = { ArrowLeft: [-5,0], ArrowRight: [5,0], ArrowUp: [0,-5], ArrowDown: [0,5] }
          const delta = directions[event.key]
          if (delta) { event.preventDefault(); setPosition(pos => ({ x: Math.max(25,Math.min(75,pos.x+delta[0])), y: Math.max(30,Math.min(70,pos.y+delta[1])) })) }
        }}>
        <PetSpriteStrip key={run} sheet={sheet} zoom={4} />
      </button>
    </div>
    <div className="pet-playground-controls">
      <span>{zh ? '动作试玩 · 编辑器事件可在这里模拟' : 'Try actions · simulate editor events here'}</span>
      <div role="group" aria-label={zh ? '宠物动作' : 'Pet actions'}>
        {animations.order.filter(id => animations.sheets[id]).map(id => <button type="button" key={id} aria-pressed={action === id} onClick={() => {
          const slot = triggers.find(slot => slot.id === id)
          if (slot && !slot.event.startsWith('pet.')) trigger(slot.event)
          else play(id, id === 'IDLE')
        }}>{animations.labels[id]?.[language] ?? id}</button>)}
        <button type="button" onClick={() => { drag.current = null; hover.current = false; setPosition({ x:50,y:62 }); play('IDLE',true) }}>{zh ? '回到中间' : 'Reset position'}</button>
      </div>
    </div>
  </div>
}

