@echo off
title MightyStreamPulse Launcher
cd /d "%~dp0"
echo ===================================================
echo   Starting MightyStreamPulse Twitch Bot Suite...
echo ===================================================
timeout /t 1 >nul
start http://localhost:3000
MightyStreamPulse.exe
pause
