@echo off
chcp 65001 >nul
title Dota Floral - Khởi động ứng dụng
cd /d "%~dp0"

echo ============================================================
echo   🌸 DOTA FLORAL - HỆ THỐNG QUẢN LÝ TIỆM HOA HANDMADE
echo ============================================================
echo.

:: 1. Kiểm tra Docker
echo [1/4] Đang kiểm tra cơ sở dữ liệu (PostgreSQL)...
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo    ⚠️ Docker Desktop chưa bật. Đang khởi động Docker Desktop...
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    )
    echo    Vui lòng đợi khoảng 15-20 giây để Docker Desktop sẵn sàng...
    :wait_docker
    timeout /t 5 /nobreak >nul
    docker info >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo    ...vẫn đang đợi Docker khởi động...
        goto wait_docker
    )
)

echo    Khởi động database container...
docker compose up -d >nul 2>&1
echo    ✅ Database đã sẵn sàng!
echo.

:: 2. Khởi động Web Server (Next.js)
echo [2/4] Đang khởi động Web App...
start "Dota Floral Web Server" /min cmd /c "npm run dev"
echo    ✅ Web Server đang chạy tại http://localhost:3000
echo.

:: 3. Khởi động Cloudflare Tunnel (Cho điện thoại)
echo [3/4] Đang tạo đường link truy cập cho điện thoại...
if exist "cloudflared.exe" (
    start "Dota Floral - Link Cho Điện Thoại" cmd /k "node scripts/tunnel.js"
    echo    ✅ Cửa sổ đường link và mã QR cho điện thoại đã được mở!
) else (
    echo    (Không tìm thấy cloudflared.exe, bỏ qua link online)
)
echo.

:: 4. Mở trình duyệt trên máy tính
echo [4/4] Đang mở trình duyệt trên máy tính...
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo.
echo ============================================================
echo   🌸 KHỞI ĐỘNG HOÀN TẤT!
echo   - Trên máy tính: http://localhost:3000
echo   - Trên điện thoại: Xem cửa sổ "Dota Floral - Link Cho Điện Thoại"
echo   - Tài khoản: anh@dotafloral.com hoặc chi@dotafloral.com
echo   - Mật khẩu : dotafloral2024
echo.
echo   Để tắt ứng dụng, bạn chỉ cần bấm đúp vào file 'stop.bat'.
echo ============================================================
echo.
pause
