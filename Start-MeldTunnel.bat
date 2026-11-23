@echo off
title LightFeed - Meld tunnel
rem Double-click to start the Cloudflare tunnel for the phone Stream Deck.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-MeldTunnel.ps1"
echo.
pause
