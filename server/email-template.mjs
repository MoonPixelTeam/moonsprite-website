const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

/** Inline CSS and presentation tables work without scripts or external fonts. Use a hosted logo to avoid SES rejecting CID multipart mail. */
export function verificationEmail({ to, code, purpose, publicOrigin }) {
  if (!/^\d{6}$/.test(code) || !['register', 'reset'].includes(purpose)) throw new Error('Invalid verification email')
  const origin = new URL(publicOrigin).origin
  const registering = purpose === 'register'
  const title = registering ? '完成邮箱验证' : '重置登录密码'
  const subtitle = registering ? '欢迎注册 MoonSprite' : 'MoonSprite 账户安全'
  const description = registering ? '请在注册页面输入以下验证码，完成注册并绑定邮箱。' : '请在密码重置页面输入以下验证码，然后设置新密码。'
  const note = registering ? '绑定后，你可以使用此邮箱登录、接收账户通知和找回密码。' : '重置成功后，所有设备上的原登录状态将失效，请使用新密码重新登录。'
  const subject = registering ? 'MoonSprite 注册验证码' : 'MoonSprite 重置密码验证码'
  const website = escape(origin + '/')
  const help = escape(origin + '/#/faq')
  // Tencent SES requires Base64 body parts; Nodemailer's automatic choice can be quoted-printable for HTML.
  return { to, subject, textEncoding: 'base64',
    text: `${title}\n${subtitle}\n\n${description}\n\n验证码：${code}\n\n10 分钟内有效，仅用于本次${registering ? '注册' : '密码重置'}。重新获取后，请使用最新的验证码。\n${note}\n\n请勿向任何人透露验证码，MoonSprite 不会主动向你索取验证码或密码。若非本人操作，请忽略此邮件。\n\n此邮件由系统自动发送，请勿直接回复。\nMoonSprite 官网：${origin}/\n帮助中心：${origin}/#/faq`,
    html: `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#eef1f5;color:#edf1f7;font-family:Arial,'Microsoft YaHei','PingFang SC',sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${subtitle}。验证码 10 分钟内有效，请返回网站完成操作。</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eef1f5"><tr><td align="center" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
<tr><td bgcolor="#2979ff" height="4" style="height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td align="center" bgcolor="#14171c" style="padding:36px 24px 24px;">
<a href="${website}" style="text-decoration:none;color:#edf1f7;"><img src="${escape(origin + '/assets/moonsprite-wordmark.png')}" width="258" height="39" alt="MoonSprite" style="display:block;width:258px;max-width:100%;height:auto;border:0;image-rendering:pixelated;color:#edf1f7;font-size:24px;"></a>
<p style="margin:14px 0 0;color:#97a5b8;font-size:12px;line-height:20px;">像素绘画 · 动画创作</p>
</td></tr>
<tr><td align="center" bgcolor="#14171c" style="padding:8px 24px 0;">
<p style="margin:0 0 10px;color:#97a5b8;font-size:13px;line-height:22px;">${subtitle}</p>
<h1 style="margin:0;color:#edf1f7;font-size:22px;line-height:32px;font-weight:600;">${title}</h1>
<p style="margin:20px 0 24px;color:#b8c3d2;font-size:15px;line-height:26px;text-align:center;">${description}</p>
</td></tr>
<tr><td align="center" bgcolor="#14171c" style="padding:0 24px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#202f48" style="max-width:360px;border:1px solid #373f4b;">
<tr><td align="center" style="padding:16px 8px 4px;color:#b8c3d2;font-size:12px;line-height:20px;">${registering ? '注册验证码' : '重置密码验证码'}</td></tr>
<tr><td align="center" style="padding:0 8px 18px;font-family:'Courier New',monospace;font-size:38px;line-height:50px;font-weight:bold;letter-spacing:6px;color:#6ba3ff;white-space:nowrap;">${escape(code)}</td></tr>
</table>
<p style="margin:16px 0 0;font-size:13px;line-height:24px;color:#b8c3d2;"><strong style="color:#edf1f7;">10 分钟内有效</strong> · 仅用于本次操作</p>
<p style="margin:4px 0 0;font-size:12px;line-height:22px;color:#97a5b8;">重新获取后，请使用最新的验证码。</p>
</td></tr>
<tr><td bgcolor="#14171c" style="padding:28px 24px 32px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-top:1px solid #373f4b;padding-top:20px;">
<p style="margin:0 0 12px;color:#b8c3d2;font-size:14px;line-height:24px;">${note}</p>
<p style="margin:0;color:#97a5b8;font-size:12px;line-height:22px;">请勿向任何人透露验证码。MoonSprite 不会主动向你索取验证码或密码。如果这不是你本人的操作，请忽略此邮件。</p>
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:24px 16px 8px;color:#667389;font-size:12px;line-height:22px;">
<p style="margin:0 0 10px;">此邮件由 MoonSprite 系统自动发送，请勿直接回复。</p>
<a href="${website}" style="color:#245fc4;text-decoration:underline;">MoonSprite 官网</a><span style="padding:0 12px;color:#8995a7;">·</span><a href="${help}" style="color:#245fc4;text-decoration:underline;">帮助中心</a>
<p style="margin:14px 0 0;font-size:12px;color:#667389;">MoonSprite · 像素绘画与动画编辑器</p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>` }
}
