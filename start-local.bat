@echo off
chcp 65001 >nul
title Dota Floral - Khởi động (Chỉ máy tính)
cd /d "%~dp0"

echo ============================================================
echo   🌸 DOTA FLORAL - KHỞI ĐỘNG (CHẾ ĐỘ MÁY TÍNH LOCAL)
echo ============================================================
echo.

echo [1/3] Đang kiểm tra cơ sở dữ liệu...
docker compose up -d >nul 2>&1
echo    ✅ Database đã sẵn sàng!

echo [2/3] Đang khởi động Web App...
start "Dota Floral Web Server" /min cmd /c "npm run dev"
echo    ✅ Web Server đang chạy tại http://localhost:3000

echo [3/3] Đang mở trình duyệt...
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo.
echo ============================================================
echo   🌸 KHỞI ĐỘNG THÀNH CÔNG!
echo   - Mở tại: http://localhost:3000
echo   - Tài khoản: anh@dotafloral.com hoặc chi@dotafloral.com
echo   - Mật khẩu : dotafloral2024
echo ============================================================
echo.
pause
