@echo off
chcp 65001 >nul
title Dota Floral - Tắt ứng dụng
cd /d "%~dp0"

echo ============================================================
echo   🌸 DOTA FLORAL - DỪNG HỆ THỐNG
echo ============================================================
echo.

echo [1/3] Đang tắt Cloudflare Tunnel...
taskkill /f /im cloudflared.exe >nul 2>&1
echo    ✅ Đã tắt link điện thoại.

echo [2/3] Đang tắt Web Server (Next.js)...
taskkill /f /im node.exe >nul 2>&1
echo    ✅ Đã tắt Web Server.

echo [3/3] Đang dừng cơ sở dữ liệu Docker...
docker compose stop >nul 2>&1
echo    ✅ Đã dừng database an toàn (dữ liệu được giữ nguyên).

echo.
echo ============================================================
echo   ✅ HỆ THỐNG ĐÃ TẮT HOÀN TOÀN!
echo ============================================================
echo.
timeout /t 3 >nul
