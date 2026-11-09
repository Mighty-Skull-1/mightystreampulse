@echo off
title LightFeed Launcher
cd /d "%~dp0"
echo ===================================================
echo   Starting LightFeed Twitch Bot Suite...
echo ===================================================
timeout /t 1 >nul
start http://localhost:3000
LightFeed.exe
pause
