import { ApiError } from '../api/transport'
import type { Language } from '../content'
export function emailCodeError(cause: unknown, language: Language): string {
  const code = cause instanceof ApiError ? cause.code : ''
  if (cause instanceof ApiError && cause.retryAfter > 0) {
    const seconds = cause.retryAfter
    const wait = seconds >= 60 ? (language === 'zh' ? `${Math.ceil(seconds / 60)} 分钟` : `${Math.ceil(seconds / 60)} minutes`) : (language === 'zh' ? `${seconds} 秒` : `${seconds} seconds`)
    return language === 'zh' ? `${code === 'mail-unavailable' ? '邮件发送失败' : '请求次数已达限制'}，请在 ${wait}后重试。` : `Please try again in ${wait}.`
  }
  const messages: Record<string, [string, string]> = {
    missing: ['当前连接的后端尚未部署验证码接口，请更新服务器后重试。', 'The connected backend needs the verification-code update.'],
    'mail-unavailable': ['邮件服务暂不可用，请检查服务器 SMTP 配置或稍后重试。', 'Email service unavailable. Check SMTP configuration or try later.'],
    'rate-limited': ['操作过于频繁，请稍后重试。', 'Too many requests. Try again later.'],
    'reset-code': ['验证码错误、已过期或尝试过多，请重新获取。', 'Invalid or expired code. Request a new code.'],
    email: ['请输入有效邮箱。', 'Enter a valid email.'], password: ['密码需为 8–128 个字符。', 'Use 8–128 characters for your password.'],
    network: ['网络连接失败，请检查本地服务和网络。', 'Check your connection and local server.'],
    timeout: ['请求超时，请稍后重试。', 'Request timed out. Try again later.'],
  }
  return (messages[code] ?? ['操作失败，请稍后重试。', 'Request failed. Try again later.'])[language === 'zh' ? 0 : 1]
}
