# LightFeed ⚡
> **All-in-One Twitch Streamer Deck, Chatbot, Moderation Suite & OBS Overlay**

[![Live Demo](https://img.shields.io/badge/Live%20App-mightystreampulse.netlify.app-9146ff?style=for-the-badge&logo=twitch&logoColor=white)](https://mightystreampulse.netlify.app)
[![Netlify Status](https://img.shields.io/badge/Hosted%20On-Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)]([https://mightystreampulse.netlify.app](https://lightfeed.netlify.app/))
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

**LightFeed** is a lightweight, responsive, and browser-first Twitch command center designed for content creators, streamers, and moderators. It combines a 1-click Stream Deck action pad, automated chatbot engine (**LightFeed Bot**), live moderation controls, custom soundboard, viewer engagement minigames, and animated OBS Studio browser overlays into a single dashboard.

---

## ✨ Key Features

### 🤖 LightFeed Bot (Twitch Chatbot Integration)
- **Direct Twitch IRC Connectivity:** Connects directly via WebSocket IRC using client-side `tmi.js`—no server required!
- **Auto-Reply Commands:** Comes preconfigured with `!discord`, `!socials`, `!rules`, `!uptime`, `!game`, and allows creating unlimited custom commands with real-time in-browser management.
- **Timed Chat Announcements:** Set up recurring broadcast messages (Discord community links, hydration/stretch checks, follow & sub reminders) on configurable minute intervals.
- **Broadcaster & Bot Echo:** Streamers can type chat messages directly from the dashboard and view the real-time channel chat feed with colored user badges.

### 🎮 1-Click Action Pad (Stream Deck)
- Instant customizable broadcast buttons for chat interactions:
  - 👋 **Welcome Chat**
  - 🌐 **Share Socials**
  - 💬 **Discord Squad**
  - 🔥 **Hype Wave**
  - 📜 **Chat Rules**
  - 💧 **Hydrate Check**
  - 🏆 **GG Big Play**
  - 👑 **Prime Gaming Sub Reminder**
- **Full Customizability:** Edit any button's title, category badge, FontAwesome icon, and message payload directly from the UI.

### 🛡️ Streamer Moderation Deck
- **1-Click Chat Cleanup:**
  - 🧹 `/clear` nukes and clears chat history.
  - 😊 `/emoteonly` toggle (enable/disable emote-only chat mode).
  - ⏱️ `/slow` mode with selectable durations (5s, 10s, 30s, 60s).
  - ⭐ `/followers` only and `/subscribers` only chat restrictions.
  - ⚡ **Custom Mod Command Runner:** Execute any native Twitch moderator command (`/timeout`, `/ban`, `/commercial`, `/raid`) directly from the desk.

### 🔊 Custom Soundboard FX Studio
- **Built-in Audio Synthesis Presets (Zero-Latency Web Audio API):**
  - 📢 *MLG Airhorn Blast*
  - 🎉 *Hype Fanfare*
  - 👏 *Crowd Applause*
  - 🔔 *Bell Chime*
  - 🥁 *Ba-dum-tss / Drumroll*
  - 🏆 *Level Up / Victory Arpeggio*
  - 💀 *Game Over / Sad Trombone*
  - ⚡ *Retro Laser Blaster*
  - 🪙 *Mario 1-Up Coin*
  - 💥 *Cartoon Bonk*
  - 🚨 *Emergency Siren Alert*
- **Custom Audio File Uploads:** Upload your own `.mp3`, `.wav`, `.ogg`, or `.m4a` sound files directly from your computer (stored in browser `localStorage`).
- **Direct Audio URLs:** Stream sounds from any web audio link.
- **Master Soundboard Volume Slider:** Dynamically scale volume to match your stream audio mix.
- **Studio Manager:** Add, preview, reorder (move up/down), edit, delete, or reset soundboard buttons.

### 🎁 Interactive Viewer Minigames & Chat Engagement
- **Chat Giveaways:** Launch keyword-entry giveaways (`!enter`), track unique participant entries, display countdown timers, and randomly pick verified winners with confetti animations.
- **Live Channel Polls:** Create multiple-choice chat polls. Viewers vote with `!vote 1`, `!vote 2`, etc., with live percentage bars and real-time tallying.
- **Chat Trivia Challenge:** Broadcast trivia questions to chat; the first viewer to answer correctly in chat wins!
- **Magic 8-Ball:** Viewers can ask the mystical 8-ball anytime using `!8ball [question]`.

### 🎵 YouTube Song Requests & Live Jukebox
- **Interactive Chat Song Requests:** Viewers can request songs in Twitch chat using `!song <youtube-link>` or `!sr <link>` (supports standard YouTube URLs, `youtu.be`, `/shorts/`, embeds, and raw video IDs).
- **Sequential Auto-Play Jukebox:** Embedded responsive 16:9 YouTube player that auto-plays tracks in sequence and automatically transitions to the next queued song when finished (`YT.PlayerState.ENDED`).
- **Live Now Playing Bar:** Displays the active video title, YouTube channel/artist, and which chatter requested it. Viewers can check what's playing in chat via `!song`, `!np`, or `!currentsong`.
- **Streamer Jukebox Controls:** Complete deck with Play/Pause, Replay current song, Skip next (`!skip` or UI button), and a dedicated player volume slider.
- **Up Next Queue & Streamer Quick-Queue:** Streamers can paste links directly to queue tracks, remove specific songs, or clear the queue. Viewers can preview the upcoming songs with `!queue` or `!songqueue`.
- **Zero API Keys Required:** Automatic CORS metadata fetching via `noembed.com` for title and thumbnail lookup without requiring Google Cloud or YouTube Data API keys.
- **Auto-Skip Error Handling:** If a video is region-restricted or copyright-blocked from embedding, the jukebox alerts chat and automatically moves to the next song without getting stuck.

### 🖥️ OBS Studio / Streamlabs Overlay
- Dedicated **Browser Source Overlay** (`overlay.html`).
- Displays animated top banners, live poll graphs, giveaway winner announcements, and stream milestones directly onto your OBS canvas.

### 👤 Multi-Streamer Profile Management
- Switch between multiple streamer profiles or bot accounts.
- Each profile maintains isolated `localStorage` storage for buttons, timers, custom commands, soundboard buttons, and channel settings.
- Seamless Twitch OAuth Implicit Grant authorization.

### 🎙️ Text-to-Speech (TTS) & Confetti FX
- Browser-native speech synthesis reads out incoming chat messages in real time.
- Interactive full-screen canvas confetti cannon for hype trains, raids, and celebration moments.

---

## 🚀 Quick Start

### Option A: Use the Live Web App (No Setup Required)
Simply navigate to:
👉 **[https://mightystreampulse.netlify.app](https://mightystreampulse.netlify.app)**

### Option B: Run Locally with Node.js

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Mighty-Skull-1/mightystreampulse.git
   cd mightystreampulse
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local server:**
   ```bash
   npm start
   ```

4. **Open in your browser:**
   Open [http://localhost:3000](http://localhost:3000) in Chrome, Edge, or Firefox.

---

## ⚙️ Connecting to Twitch

1. Open **LightFeed**.
2. Click **Connect Twitch Account** or authorize with Twitch OAuth:
   - Generate your OAuth token using the Twitch Token Generator link provided in the dashboard.
   - Required scopes: `chat:read`, `chat:edit`, `channel:moderate`.
3. Enter your **Bot Username** (or channel name) and **Channel to Join**.
4. Click **Connect Bot** — the status light will turn green (**Connected**), and **LightFeed Bot** will enter your chat room!

---

## 🎥 Setting Up OBS Studio / Streamlabs Overlay

1. In OBS Studio or Streamlabs, navigate to your **Sources** panel.
2. Click **+ (Add Source)** and choose **Browser**.
3. Name the source `LightFeed Overlay`.
4. Enter the URL:
   - **Hosted:** `https://mightystreampulse.netlify.app/overlay.html`
   - **Local:** `http://localhost:3000/overlay.html`
5. Set Width to `1920` and Height to `1080` (or match your canvas resolution).
6. Check **"Shutdown source when not visible"** and click **OK**.

---

## 📱 Phone Stream Deck (Meld Studio)

`streamdeck.html` is a phone-friendly control pad for **Meld Studio**. Open it at **https://lightfeed.netlify.app/streamdeck.html** (or tap **Stream Deck** next to your account name on the dashboard).

It gives you big tiles for:
- **Scenes**: loaded from Meld automatically. The scene that's on air is highlighted.
- **Mic**: mute / unmute your mic track, with its current state.
- **Go Live / End Stream**: needs a second tap within a few seconds, so you can't end the stream by accident.
- **Soundboard**: your dashboard's sounds. They play **on your PC** through the LightFeed dashboard, so keep the dashboard open while you stream.
- **Quick Mod Desk**: emote-only, slow mode, sub-only, clear chat (two taps), timeouts and custom mod commands.

Only the Twitch accounts listed in `DECK_OWNERS` (in `public/streamdeck.js` **and** `netlify/functions/team.mjs`) can open it. Everyone else, including your LightFeed mods, sees "This page is private." Log in to LightFeed with that Twitch account on your phone first.

### How the phone reaches Meld

Meld Studio has a remote-control API (its *WebChannel* API) on your PC at `127.0.0.1:13376`. LightFeed is an `https://` site, and phones can only open secure (`wss://`) connections from it, so you run a free **Cloudflare Tunnel** on the PC that gives Meld a temporary secure address.

### 1. Turn on Meld's API

In Meld Studio's settings, make sure the WebChannel (remote control) API is enabled. Integrations like Streamer.bot and Bitfocus Companion use the same setting. The default port is **13376**.

### 2. Install cloudflared on Windows

Open PowerShell and run:

```powershell
winget install --id Cloudflare.cloudflared
```

Close and reopen PowerShell, then check it worked:

```powershell
cloudflared --version
```

(No winget? Download `cloudflared-windows-amd64.exe` from https://github.com/cloudflare/cloudflared/releases/latest, rename it to `cloudflared.exe`, and run it from the folder you saved it in.)

### 3. Start the tunnel (every time you stream)

With Meld Studio open, run:

```powershell
cloudflared tunnel --url http://127.0.0.1:13376
```

After a few seconds it prints an address like `https://random-words-here.trycloudflare.com`. Leave that window open while you stream. Closing it closes the tunnel.

### 4. Connect your phone

1. On your phone, open `https://lightfeed.netlify.app/streamdeck.html` and log in with Twitch if asked.
2. Tap the ⚙️ settings button, paste the `https://…trycloudflare.com` address, and tap **Save & connect**.
3. Pick your mic under **Mic track** (it picks a track with "mic" in its name by default).

The address is saved on that phone only (never in the code or on the LightFeed server). The status pill shows **Connected**, **Reconnecting…** or **Offline**, and the page reconnects by itself if the connection drops or your phone wakes up.

**Quick tunnels get a new address every time you start them**, so paste the new one in settings each stream.

### ⚠️ Keep the tunnel address private

Meld's API has no password. **Anyone who knows your tunnel address can control Meld** (switch scenes, mute you, end your stream) for as long as the tunnel is running. So:
- Don't show the cloudflared window or the settings screen on stream.
- Close the tunnel (Ctrl+C in that window) when you finish streaming.
- If the address leaks, close the tunnel and start a new one to get a new address.

The LightFeed login only hides the page; it can't lock Meld itself. For a permanent address with a login in front of it, you can set up a named Cloudflare Tunnel with Cloudflare Access instead (needs a domain on Cloudflare).

---

## 🛠️ Project Architecture

```
mightystreampulse/
├── public/
│   ├── index.html       # Main streamer dashboard & command deck
│   ├── login.html       # Streamer authentication & profile picker
│   ├── overlay.html     # OBS Studio browser source overlay
│   ├── mod.html/mod.js  # Mod Panel for your LightFeed mods
│   ├── streamdeck.html  # Phone Stream Deck for Meld Studio (streamdeck.js)
│   ├── meld-client.js   # Meld Studio WebChannel client with auto-reconnect
│   ├── lf-shared.js     # Shared helpers: theme + Quick Mod Desk engine
│   ├── app.js           # Core client application & Twitch IRC engine
│   ├── style.css        # Cyberpunk neon UI, animations & responsive grid
│   ├── tmi.min.js       # Bundled local Twitch Messaging Interface library
│   └── favicon.svg      # Pulse logo icon
├── server.js            # Optional Express.js & WebSocket server for local runs
├── package.json         # Project metadata and dependencies
└── README.md            # Documentation and setup guide
```

---

## 🔒 Privacy & Security

- **100% Client-Side Credentials:** Your Twitch OAuth tokens and channel names are stored exclusively in your browser's private `localStorage`.
- **Zero Third-Party Database Tracking:** No external databases, tracking telemetry, or third-party servers store your tokens or chat logs.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  Built with ❤️ for the Twitch Streaming Community by <strong>LightFeed</strong>
</p>
