# LightFeed - Stream Deck tunnel
# Starts a Cloudflare quick tunnel to your streaming app's remote-control port so the
# phone Stream Deck (https://lightfeed.netlify.app/streamdeck.html) can reach it.
#   Meld Studio        port 13376  (WebChannel API, on by default)
#   OBS Studio         port 4455   (Tools > WebSocket Server Settings)
#   Streamlabs Desktop port 59650  (Settings > Remote Control)
#
# What it does:
#   1. Finds cloudflared (offers to install it with winget if missing)
#   2. Finds which app is running (or waits for the one you picked)
#   3. Starts the tunnel and waits until its address is reachable
#   4. Shows the address and copies it to the clipboard
#   5. Keeps running until you press Ctrl+C or close the window (that closes the tunnel)
#
# Run it with Start-StreamDeckTunnel.bat (double-click), or:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-StreamDeckTunnel.ps1 [-App auto|meld|obs|streamlabs]

param(
    [ValidateSet('auto', 'meld', 'obs', 'streamlabs')]
    [string]$App = 'auto',
    [int]$Port = 0
)

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'LightFeed - Stream Deck tunnel'
$Apps = [ordered]@{
    meld       = @{ Name = 'Meld Studio'; Port = 13376; Hint = 'open Meld Studio (its WebChannel API is on by default)' }
    obs        = @{ Name = 'OBS Studio'; Port = 4455; Hint = 'in OBS: Tools > WebSocket Server Settings > Enable WebSocket server' }
    streamlabs = @{ Name = 'Streamlabs Desktop'; Port = 59650; Hint = 'in Streamlabs: Settings > Remote Control, turn it on' }
}

function Say([string]$text, [string]$color = 'Gray') { Write-Host $text -ForegroundColor $color }

function Find-Cloudflared {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($p in @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe", "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe")) {
        if ($p -and (Test-Path $p)) { return $p }
    }
    return $null
}

function Test-Listening([int]$p) {
    return [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
}
function Test-AppListening { return Test-Listening $Port }

Say ''
Say '  LightFeed - Stream Deck tunnel' 'Magenta'
Say '  ------------------------------' 'Magenta'
Say ''

# 1. cloudflared
$cloudflared = Find-Cloudflared
if (-not $cloudflared) {
    Say '  cloudflared is not installed.' 'Yellow'
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Say '  Install it from https://github.com/cloudflare/cloudflared/releases/latest and run this again.' 'Yellow'
        exit 1
    }
    $answer = Read-Host '  Install it now with winget? (Y/N)'
    if ($answer -notmatch '^[Yy]') { Say '  OK, not installing. Nothing was started.'; exit 1 }
    winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
    $cloudflared = Find-Cloudflared
    if (-not $cloudflared) { Say '  cloudflared still was not found. Close this window, open a new one and try again.' 'Red'; exit 1 }
}
Say "  cloudflared: found" 'DarkGray'

# 2. Which app?
if ($App -eq 'auto') {
    $running = @($Apps.Keys | Where-Object { Test-Listening $Apps[$_].Port })
    if ($running.Count -eq 1) { $App = $running[0] }
    else {
        if ($running.Count -gt 1) { Say '  More than one streaming app is running. Which one should the phone control?' 'Yellow' }
        else { Say '  Which app do you stream with?' 'Yellow' }
        Say '    1) Meld Studio    2) OBS Studio    3) Streamlabs Desktop'
        $pick = Read-Host '  Type 1, 2 or 3'
        $App = @{ '1' = 'meld'; '2' = 'obs'; '3' = 'streamlabs' }[$pick.Trim()]
        if (-not $App) { Say '  OK, nothing was started.'; exit 1 }
    }
}
$AppName = $Apps[$App].Name
if ($Port -le 0) { $Port = $Apps[$App].Port }
$Host.UI.RawUI.WindowTitle = "LightFeed - $AppName tunnel"
if (-not (Test-AppListening)) {
    Say "  Waiting for $AppName on port $Port..." 'Yellow'
    Say ("  ({0})" -f $Apps[$App].Hint) 'Yellow'
    Say '  Press Ctrl+C to cancel.' 'DarkGray'
    while (-not (Test-AppListening)) { Start-Sleep -Seconds 2 }
}
Say "  $AppName is running on port $Port" 'DarkGray'

# 3. Start the tunnel (cloudflared writes its log to stderr)
$log = Join-Path $env:TEMP ("lightfeed-deck-tunnel-{0}.log" -f $PID)
$logOut = "$log.out"
$proc = Start-Process -FilePath $cloudflared `
    -ArgumentList @('tunnel', '--no-autoupdate', '--url', "http://127.0.0.1:$Port") `
    -RedirectStandardError $log -RedirectStandardOutput $logOut -NoNewWindow -PassThru

try {
    Say '  Starting the tunnel...' 'Gray'
    $url = $null
    $deadline = (Get-Date).AddSeconds(45)
    while (-not $url -and (Get-Date) -lt $deadline -and -not $proc.HasExited) {
        Start-Sleep -Milliseconds 500
        if (Test-Path $log) {
            $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($m) { $url = $m.Matches[0].Value }
        }
    }
    if (-not $url) {
        Say '  The tunnel did not start. Last lines from cloudflared:' 'Red'
        if (Test-Path $log) { Get-Content $log -Tail 15 | ForEach-Object { Say "    $_" 'DarkGray' } }
        exit 1
    }

    # Wait until public DNS knows the address. Looking it up too early makes
    # phones and routers remember "not found" for a while.
    $hostName = ([Uri]$url).Host
    Say '  Waiting for the address to go live...' 'Gray'
    $live = $false
    $deadline = (Get-Date).AddSeconds(90)
    while (-not $live -and (Get-Date) -lt $deadline -and -not $proc.HasExited) {
        $ok = 0
        foreach ($server in @('1.1.1.1', '8.8.8.8')) {
            try { if (Resolve-DnsName $hostName -Server $server -Type A -DnsOnly -ErrorAction Stop | Where-Object { $_.IPAddress }) { $ok++ } } catch {}
        }
        if ($ok -eq 2) { $live = $true } else { Start-Sleep -Seconds 3 }
    }
    if ($live) { Start-Sleep -Seconds 5 } else { Say '  The address is taking a while to go live. Give it a minute before pasting it.' 'Yellow' }

    try { Set-Clipboard -Value $url; $copied = $true } catch { $copied = $false }

    Say ''
    Say '  =====================================================================' 'Green'
    Say "   READY. On your phone pick $AppName and paste this address:" 'Green'
    Say ''
    Say "     $url" 'White'
    Say ''
    if ($copied) { Say '   (It is also copied to your clipboard.)' 'Green' }
    Say '   Phone page: https://lightfeed.netlify.app/streamdeck.html  ->  gear icon' 'Green'
    Say '  =====================================================================' 'Green'
    Say ''
    Say '  Keep this window open while you stream.' 'Yellow'
    if ($App -eq 'meld') { Say '  Meld has no password: anyone with this address can control it. Do not show it on stream.' 'Yellow' }
    else { Say "  Do not show this address on stream. $AppName still asks for its password/token." 'Yellow' }
    Say '  Press Ctrl+C or close this window to stop the tunnel.' 'Yellow'
    Say ''

    # 4. Stay running; warn if the app closes
    $appUp = $true
    while (-not $proc.HasExited) {
        Start-Sleep -Seconds 3
        $now = Test-AppListening
        if ($appUp -and -not $now) { Say ("  [{0}] {1} closed. The phone will reconnect when you open it again." -f (Get-Date -Format 'HH:mm'), $AppName) 'Yellow' }
        elseif (-not $appUp -and $now) { Say ("  [{0}] {1} is back." -f (Get-Date -Format 'HH:mm'), $AppName) 'Green' }
        $appUp = $now
    }
    Say '  The tunnel stopped. Last lines from cloudflared:' 'Red'
    if (Test-Path $log) { Get-Content $log -Tail 10 | ForEach-Object { Say "    $_" 'DarkGray' } }
}
finally {
    if ($proc -and -not $proc.HasExited) {
        try { Stop-Process -Id $proc.Id -Force -ErrorAction Stop } catch {}
        Say '  Tunnel closed.' 'Gray'
    }
    Remove-Item -Path $log, $logOut -Force -ErrorAction SilentlyContinue
}
