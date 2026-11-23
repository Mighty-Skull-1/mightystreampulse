@echo off
title LightFeed - Meld tunnel
rem Double-click to start the Cloudflare tunnel for the LightFeed phone Stream Deck.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-StreamDeckTunnel.ps1" -App meld
echo.
pause
