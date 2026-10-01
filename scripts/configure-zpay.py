#!/usr/bin/env python3
"""Run with sudo on the server. Credentials never enter shell history."""
import getpass
import os
from pathlib import Path
import re
import tempfile

def main():
    if os.geteuid() != 0:
        raise SystemExit('请使用 sudo python3 scripts/configure-zpay.py')
    path = Path('/etc/moonsprite/moonsprite.env')
    current = path.read_text(encoding='utf-8')
    print('在 ZPAY 商户后台查看商户 ID 和密钥。此工具仅更新支付配置，不修改邮件和数据库。')
    pid = input('商户 ID：').strip()
    key = getpass.getpass('商户密钥（输入不显示）：').strip()
    cid = input('通道 ID（没有则直接回车）：').strip()
    if not re.fullmatch(r'[0-9]+', pid) or not re.fullmatch(r'[A-Za-z0-9]+', key) or (cid and not cid.isdigit()):
        raise SystemExit('格式不正确，未修改配置。请复制后台的商户信息。')
    updated = '\n'.join(line for line in current.splitlines() if not re.match(r'^\s*(ZPAY_PID|ZPAY_KEY|ZPAY_CID)\s*=', line))
    updated += f'\nZPAY_PID={pid}\nZPAY_KEY={key}\nZPAY_CID={cid}\n'
    descriptor, temporary = tempfile.mkstemp(prefix='.zpay-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as output:
            output.write(updated)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print('配置已保存。请执行 sudo systemctl restart moonsprite 使其生效。')
    print('还需在 ZPAY 开通对应支付渠道，并用真实小额订单验证付款及到账回调。')

if __name__ == '__main__':
    main()
