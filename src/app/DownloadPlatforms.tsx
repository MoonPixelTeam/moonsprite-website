import type { Language } from '../content'
import { SITE_CONFIG } from '../config'
import { PixelArrowRight } from '../ui/icons'

export function DownloadPlatforms({ language }: { language: Language }) {
  const zh = language === 'zh'
  const platforms = [
    { name: 'App Store', icon: 'apple', device: 'iOS', available: false },
    { name: 'Google Play', icon: 'google', device: 'Android', available: false },
    { name: 'Steam', icon: 'steam', device: 'Windows', available: true },
    { name: zh ? '安卓版' : 'Android APK', icon: 'android', device: zh ? '直接下载' : 'Direct download', available: false },
  ]
  return <section className="download-platforms" aria-labelledby="download-platforms-title">
    <div className="content-wrap">
      <h2 id="download-platforms-title">{zh ? '面向桌面端（其它端加急开发中）的像素艺术专业编辑器' : 'A professional pixel art editor for desktop (other platforms in active development)'}</h2>
      <div className="download-platform-grid">
        {platforms.map(platform => {
          const content = <><span className={`download-platform-icon ${platform.icon}`} aria-hidden="true" /><span className="download-platform-copy"><small>{platform.device}</small><strong>{platform.name}</strong></span><span className="download-platform-status">{platform.available ? <PixelArrowRight /> : zh ? '敬请期待' : 'Coming soon'}</span></>
          return platform.available
            ? <a key={platform.name} className="download-platform available" href={SITE_CONFIG.steamUrl} target="_blank" rel="noopener noreferrer" aria-label={zh ? '前往 Steam 商店' : 'View on Steam'}>{content}</a>
            : <button key={platform.name} className="download-platform" type="button" disabled>{content}</button>
        })}
      </div>
    </div>
  </section>
}

