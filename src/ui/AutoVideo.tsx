import { useEffect, useRef } from 'react'

/** A muted, looping feature demo that only decodes while it is actually on screen.
 *
 * Why not a plain autoplaying <video>: the homepage shows up to ten of these at once. Left
 * alone they would each start fetching and decoding the moment they are mounted, and keep
 * going after the visitor has scrolled past — which is the cost we moved off GIF precisely to
 * get rid of. Playback is driven by an IntersectionObserver, and because the source is
 * preload="none" the file is not even requested until the card comes near the viewport.
 *
 * The poster frame carries the card on its own, so a visitor who never scrolls here, or who
 * has asked for reduced motion, still sees the feature. */
export function AutoVideo({ src, poster, className }: { src: string; poster: string; className?: string }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const element = video.current
    if (!element) return
    let cancelled = false

    const play = () => {
      // Autoplay of a muted clip is allowed, but the promise still rejects if playback is
      // interrupted or the element unmounts mid-request; that is not an error worth surfacing.
      const started = element.play()
      if (started) void started.catch(() => {})
    }

    // Honour a stated preference for less motion: leave the poster showing.
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (media.matches) return

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (cancelled) return
        if (entry.isIntersecting) play()
        else element.pause()
      }
    // Start a little before the card is visible so playback is already running when it arrives.
    }, { rootMargin: '200px' })

    observer.observe(element)
    return () => { cancelled = true; observer.disconnect(); element.pause() }
  }, [])

  return <video ref={video} className={className} src={src} poster={poster} muted loop playsInline preload="none" />
}
