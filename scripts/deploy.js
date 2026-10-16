const { spawnSync } = require('child_process');

console.clear();
console.log('============================================================');
console.log('  🌸 DOTA FLORAL - TRIỂN KHAI LÊN VERCEL ONLINE 24/7');
console.log('============================================================\n');

console.log('👉 [BƯỚC 1/2] Đăng nhập Vercel:');
console.log('   Ở menu hiện ra, bạn chọn ngay dòng đầu tiên:');
console.log('   👉 [ Continue with GitHub ] rồi bấm phím [ENTER].');
console.log('   (Trình duyệt web sẽ mở ra để bạn xác nhận bằng GitHub trong 2 giây)\n');

const loginResult = spawnSync('npx', ['vercel', 'login'], {
  stdio: 'inherit',
  shell: true,
});

console.log('\n============================================================');
console.log('👉 [BƯỚC 2/2] Đang triển khai dự án lên Vercel:');
console.log('   Khi hiện các câu hỏi, bạn CHỈ CẦN BẤM PHÍM [ENTER] để chọn mặc định.');
console.log('============================================================\n');

spawnSync('npx', ['vercel', '--prod'], {
  stdio: 'inherit',
  shell: true,
});

console.log('\n============================================================');
console.log('  🌸 HOÀN TẤT TRIỂN KHAI!');
console.log('  Hãy copy đường link "Production:" ở trên để mở trên điện thoại.');
console.log('============================================================\n');
