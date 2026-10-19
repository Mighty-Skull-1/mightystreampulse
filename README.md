# MightyStreamPulse ⚡
> **All-in-One Twitch Streamer Deck, Chatbot, Moderation Suite & OBS Overlay**

[![Live Demo](https://img.shields.io/badge/Live%20App-mightystreampulse.netlify.app-9146ff?style=for-the-badge&logo=twitch&logoColor=white)](https://mightystreampulse.netlify.app)
[![Netlify Status](https://img.shields.io/badge/Hosted%20On-Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://mightystreampulse.netlify.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

**MightyStreamPulse** is a lightweight, responsive, and browser-first Twitch command center designed for content creators, streamers, and moderators. It combines a 1-click Stream Deck action pad, automated chatbot engine (**MightyStreamPulse Bot**), live moderation controls, custom soundboard, viewer engagement minigames, and animated OBS Studio browser overlays into a single dashboard.

---

## ✨ Key Features

### 🤖 MightyStreamPulse Bot (Twitch Chatbot Integration)
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

1. Open **MightyStreamPulse**.
2. Click **Connect Twitch Account** or authorize with Twitch OAuth:
   - Generate your OAuth token using the Twitch Token Generator link provided in the dashboard.
   - Required scopes: `chat:read`, `chat:edit`, `channel:moderate`.
3. Enter your **Bot Username** (or channel name) and **Channel to Join**.
4. Click **Connect Bot** — the status light will turn green (**Connected**), and **MightyStreamPulse Bot** will enter your chat room!

---

## 🎥 Setting Up OBS Studio / Streamlabs Overlay

1. In OBS Studio or Streamlabs, navigate to your **Sources** panel.
2. Click **+ (Add Source)** and choose **Browser**.
3. Name the source `MightyStreamPulse Overlay`.
4. Enter the URL:
   - **Hosted:** `https://mightystreampulse.netlify.app/overlay.html`
   - **Local:** `http://localhost:3000/overlay.html`
5. Set Width to `1920` and Height to `1080` (or match your canvas resolution).
6. Check **"Shutdown source when not visible"** and click **OK**.

---

## 🛠️ Project Architecture

```
mightystreampulse/
├── public/
│   ├── index.html       # Main streamer dashboard & command deck
│   ├── login.html       # Streamer authentication & profile picker
│   ├── overlay.html     # OBS Studio browser source overlay
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
  Built with ❤️ for the Twitch Streaming Community by <strong>MightyStreamPulse</strong>
</p>