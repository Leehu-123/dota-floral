const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');

const rootDir = path.resolve(__dirname, '..');
const cloudflaredPath = path.join(rootDir, 'cloudflared.exe');
const tunnelUrlFile = path.join(rootDir, '.tunnel-url');

if (!fs.existsSync(cloudflaredPath)) {
  console.error('❌ Không tìm thấy cloudflared.exe tại:', cloudflaredPath);
  process.exit(1);
}

console.log('🌸 Đang kết nối Cloudflare Tunnel...');

const child = spawn(cloudflaredPath, ['tunnel', '--url', 'http://localhost:3000'], {
  cwd: rootDir,
});

let foundUrl = false;

function handleOutput(data) {
  const text = data.toString();
  if (foundUrl) return;

  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match) {
    foundUrl = true;
    const url = match[0];
    
    // Save to file for web app to read
    try {
      fs.writeFileSync(tunnelUrlFile, JSON.stringify({ url, updatedAt: new Date().toISOString() }), 'utf8');
      const publicQr = path.join(rootDir, 'public', 'mobile-qr.png');
      qrcode.toFile(publicQr, url, { width: 350, margin: 2 }, () => {});
    } catch (e) {}

    qrcode.toString(url, { type: 'terminal', small: true }, (err, qrText) => {
      console.clear();
      console.log('\n====================================================================');
      console.log('  🌸 DOTA FLORAL - ĐƯỜNG LINK & MÃ QR CHO ĐIỆN THOẠI 📱');
      console.log('====================================================================\n');
      console.log('  👉 Link truy cập trực tiếp:');
      console.log(`     \x1b[36m\x1b[1m${url}\x1b[0m\n`);
      console.log('  👉 Hướng dẫn:');
      console.log('     1. Mở Camera trên điện thoại (iPhone hoặc Android).');
      console.log('     2. Quét mã QR dưới đây để vào thẳng ứng dụng.');
      console.log('     3. Đăng nhập: anh@dotafloral.com (mật khẩu: dotafloral2024)\n');
      console.log('--------------------------------------------------------------------');
      if (!err && qrText) {
        console.log(qrText);
      }
      console.log('--------------------------------------------------------------------');
      console.log('  ⚠️ Vui lòng GIỮ NGUYÊN CỬA SỔ NÀY để duy trì kết nối cho điện thoại!');
      console.log('====================================================================\n');
    });
  }
}

child.stdout.on('data', handleOutput);
child.stderr.on('data', handleOutput);

child.on('error', (err) => {
  console.error('❌ Lỗi chạy Cloudflare Tunnel:', err.message);
});

child.on('close', (code) => {
  console.log(`Cloudflare Tunnel đã dừng (mã thoát: ${code})`);
  try {
    if (fs.existsSync(tunnelUrlFile)) fs.unlinkSync(tunnelUrlFile);
  } catch (e) {}
});

process.on('SIGINT', () => {
  child.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  child.kill();
  process.exit();
});
