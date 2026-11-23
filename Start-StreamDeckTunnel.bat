@echo off
title LightFeed - Stream Deck tunnel
rem Double-click to start the Cloudflare tunnel for the LightFeed phone Stream Deck.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-StreamDeckTunnel.ps1"
echo.
pause
