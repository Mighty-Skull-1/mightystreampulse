# LightFeed - Meld Studio tunnel
# Starts a Cloudflare quick tunnel to Meld Studio's WebChannel API so the phone
# Stream Deck (https://lightfeed.netlify.app/streamdeck.html) can reach it.
#
# What it does:
#   1. Finds cloudflared (offers to install it with winget if missing)
#   2. Waits for Meld Studio's API on port 13376
#   3. Starts the tunnel and waits until its address is reachable
#   4. Shows the address and copies it to the clipboard
#   5. Keeps running until you press Ctrl+C or close the window (that closes the tunnel)
#
# Run it with Start-MeldTunnel.bat (double-click), or:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-MeldTunnel.ps1

param(
    [int]$Port = 13376
)

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'LightFeed - Meld tunnel'

function Say([string]$text, [string]$color = 'Gray') { Write-Host $text -ForegroundColor $color }

function Find-Cloudflared {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($p in @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe", "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe")) {
        if ($p -and (Test-Path $p)) { return $p }
    }
    return $null
}

function Test-MeldListening {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

Say ''
Say '  LightFeed - Meld Studio tunnel' 'Magenta'
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

# 2. Meld Studio
if (-not (Test-MeldListening)) {
    Say "  Waiting for Meld Studio... (open Meld, and make sure its WebChannel API is on, port $Port)" 'Yellow'
    Say '  Press Ctrl+C to cancel.' 'DarkGray'
    while (-not (Test-MeldListening)) { Start-Sleep -Seconds 2 }
}
Say "  Meld Studio: found on port $Port" 'DarkGray'

# 3. Start the tunnel (cloudflared writes its log to stderr)
$log = Join-Path $env:TEMP ("lightfeed-meld-tunnel-{0}.log" -f $PID)
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
    Say '   READY. Paste this into the Stream Deck settings on your phone:' 'Green'
    Say ''
    Say "     $url" 'White'
    Say ''
    if ($copied) { Say '   (It is also copied to your clipboard.)' 'Green' }
    Say '   Phone page: https://lightfeed.netlify.app/streamdeck.html  ->  gear icon' 'Green'
    Say '  =====================================================================' 'Green'
    Say ''
    Say '  Keep this window open while you stream.' 'Yellow'
    Say '  Anyone with this address can control Meld, so do not show it on stream.' 'Yellow'
    Say '  Press Ctrl+C or close this window to stop the tunnel.' 'Yellow'
    Say ''

    # 4. Stay running; warn if Meld closes
    $meldUp = $true
    while (-not $proc.HasExited) {
        Start-Sleep -Seconds 3
        $now = Test-MeldListening
        if ($meldUp -and -not $now) { Say ("  [{0}] Meld Studio closed. The phone will reconnect when you open it again." -f (Get-Date -Format 'HH:mm')) 'Yellow' }
        elseif (-not $meldUp -and $now) { Say ("  [{0}] Meld Studio is back." -f (Get-Date -Format 'HH:mm')) 'Green' }
        $meldUp = $now
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
