# LightFeed ⚡
> **All-in-one Twitch dashboard: Stream Deck, chatbot, soundboard, alerts, mod tools, OBS overlay and a phone deck for Meld Studio.**

[![Live App](https://img.shields.io/badge/Live%20App-lightfeed.netlify.app-9146ff?style=for-the-badge&logo=twitch&logoColor=white)](https://lightfeed.netlify.app)
[![Hosted on Netlify](https://img.shields.io/badge/Hosted%20On-Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://lightfeed.netlify.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

**LightFeed** runs in your browser. Log in with Twitch and you get a 1-click Stream Deck, a chatbot (**LightFeed Bot**), a soundboard, sub and bits alerts, chat moderation, polls and giveaways, YouTube song requests and an animated OBS overlay. Your mods can help from their own login, and you can run Meld Studio from your phone.

👉 **Open it at [lightfeed.netlify.app](https://lightfeed.netlify.app)**

---

## 📚 Contents

- [Features](#-features)
- [Getting Started](#-getting-started)
- [OBS / Streamlabs Overlay](#-obs--streamlabs-overlay)
- [Sub, Bits & Channel Point Alerts](#-sub-bits--channel-point-alerts)
- [Mods & the Mod Panel](#-mods--the-mod-panel)
- [Phone Stream Deck (Meld Studio)](#-phone-stream-deck-meld-studio)
- [Running Locally](#-running-locally)
- [Project Structure](#-project-structure)
- [Privacy & Security](#-privacy--security)
- [License](#-license)

---

## ✨ Features

The dashboard has a tab for each of these.

### 🎮 Stream Deck (1-Click Action Pad)
- Big buttons that post a message to your chat in one click.
- Comes with 8 starter buttons: Welcome Chat, Share Socials, Discord Squad, Hype Wave, Chat Rules, Hydrate Check, GG Big Play and Prime Gaming Sub.
- Add your own, or edit any button's title, category, icon and message.
- **Hype Train Alert** button in the header fires a hype message with confetti.

### 🔊 Soundboard
- Tap a pad to play it. Number keys **1–0** work as hotkeys, and **Stop All** cuts every sound.
- 11 built-in sounds made in the browser (no files needed): Airhorn, Hype Fanfare, Applause, Bell Chime, Ba-dum-tss, Victory, Game Over, Laser, Coin 1-Up, Bonk and Siren.
- Add your own sounds from a file or a web link, sort them into categories, and search them.
- Master volume slider. Viewers hear the soundboard when OBS captures your desktop audio.

### 🎵 Song Requests & Jukebox
- Viewers request YouTube songs in chat with `!song <link>` or `!sr <link>` (normal links, `youtu.be`, Shorts and video IDs all work).
- Built-in player plays the queue in order, with play/pause, replay, skip and volume.
- Chat commands: `!song` / `!np` (what's playing), `!queue` / `!songqueue` (what's next), `!skip` (mods and streamer only).
- Queue songs yourself, remove songs, or clear the queue. Turn requests on or off.
- Blocked or region-locked videos are skipped automatically. No YouTube API key needed.

### 🎁 Mini-Games & Polls
- **Live Chat Poll:** viewers vote by typing `1`, `2`, `3`… in chat, with live results.
- **Chat Giveaway:** pick a keyword (like `!win`); everyone who types it is entered. Pick a random winner with confetti.
- **Chat Trivia:** the bot asks a question and the first correct answer wins.
- **Magic 8-Ball:** always on. Viewers type `!8ball <question>`.

### 🛡️ Quick Mod Desk
Uses Twitch's official moderation API:
- Clear chat (asks first)
- Emote-only, slow mode (5s to 2 min) and sub-only, with an ON/OFF badge for each
- Timeout a chatter (1 minute to 1 hour)
- Custom commands: `/followers [minutes]`, `/followersoff`, `/timeout <user> [seconds] [reason]`, `/ban <user> [reason]`, `/unban <user>` and more

### ⏰ Timed Announcements
- Messages the bot posts every X minutes, like Discord links, follow reminders or hydrate checks. Turn each one on or off.

### 🤖 Bot Chat Commands
- Auto-replies when viewers type a command. Comes with `!discord`, `!socials`, `!rules`, `!uptime` and `!game`, and you can add as many as you like.

### 🔔 Sub & Bits Alerts
- Big on-screen alerts with sound for subs, gifted subs, bits, raids and channel point redemptions. See [Sub, Bits & Channel Point Alerts](#-sub-bits--channel-point-alerts).

### 🎨 Theme
- Pick your main and highlight colours (presets or custom) and a background (Charcoal, Midnight Blue, Pure Black or Deep Plum).
- Each profile keeps its own theme, and your OBS overlay, Mod Panel and phone Stream Deck match it.

### 👥 Mods
- Let trusted mods use your Stream Deck, soundboard, polls, giveaways, trivia and Mod Desk from their own Twitch login. See [Mods & the Mod Panel](#-mods--the-mod-panel).

### 💬 Live Chat, TTS & Stats
- Live chat panel with coloured names. Type messages to chat from the dashboard.
- **Chat Speech (TTS):** reads incoming chat messages out loud.
- Counters for messages sent, received and active chatters.

### 💾 Backup & Profiles
- **Export / Import** saves your buttons, timers, commands, soundboard, song settings, theme and alert settings to a file and brings them back.
- **Profiles:** switch between several Twitch accounts. Each profile keeps its own settings in your browser.

---

## 🚀 Getting Started

1. Go to **[lightfeed.netlify.app](https://lightfeed.netlify.app)**.
2. Click **Connect with Twitch** and approve the permissions. LightFeed asks for:
   - `chat:read`, `chat:edit`: read and post chat as your bot
   - `channel:moderate`, `moderator:manage:chat_settings`, `moderator:manage:chat_messages`, `moderator:manage:banned_users`: the Quick Mod Desk
   - `channel:read:redemptions`: channel point alerts
   - `user:read:email`: part of the Twitch login
3. You land on the dashboard and **LightFeed Bot** joins your chat automatically. The **Connection Status** light turns green when it's connected.

Other ways to log in (on the login page):
- **Quick Token:** connect with a channel name and an `oauth:` chat token.
- **Settings:** use your own Twitch Developer Client ID for the 1-click login (the page shows the redirect URL to register).
- **Saved Profiles:** switch accounts.

> If you add a feature that needs a new Twitch permission (for example channel point alerts), log out with **Switch / Exit** and log in again so Twitch grants it.

---

## 🎥 OBS / Streamlabs Overlay

1. In the dashboard, open **OBS Overlay Setup** and click **Copy** to copy your overlay link. It looks like `https://lightfeed.netlify.app/overlay.html?channel=yourchannel` plus your settings.
2. In OBS or Streamlabs, under **Sources**, click **+** and choose **Browser**. Name it `LightFeed Overlay`.
3. Paste the link, set **Width 1920** and **Height 1080** (or your canvas size).
4. Tick **Control audio via OBS** so alert sounds go out on stream.
5. Tick **Shutdown source when not visible** and click **OK**.
6. Click **Send Test Banner Alert** in the dashboard to check it works.

The overlay shows banners, poll results, giveaway winners, alerts and confetti, plus an on-screen chat feed. It reads your chat directly, so it works from the hosted site with nothing running on your PC.

**Copy the link again** whenever you change your theme or alert settings, because those settings are saved in the link.

---

## 🔔 Sub, Bits & Channel Point Alerts

Open the **Sub & Bits Alerts** tab.

- **Test buttons:** Test Sub, Test Bits, Test Gift Bomb, Test Raid and Test Channel Points. Tick the box to show the test on your overlay too.
- **Alert sounds:** pick a sound for each alert type, or **Upload from my PC** (mp3, wav, ogg or m4a, up to 4 MB). Uploads are saved to your Twitch account so they work on any computer, and only play on your channel.
- **Dashboard vs stream:** set the sound and volume you hear on the dashboard separately from what viewers hear on the overlay. You can also have sub and cheer messages read out loud on stream.
- **Channel points:** get an alert on the dashboard when someone redeems a reward, and optionally show it on your overlay. You need to be logged in as the channel owner.
- **Supporters this session** lists everyone who subbed or cheered while the dashboard was open.

---

## 👥 Mods & the Mod Panel

Let your mods press your buttons without giving them your login.

1. In the dashboard, open **Mods**, type a mod's Twitch username and click **Add**.
2. Send them the link shown (`https://lightfeed.netlify.app/mod.html`).
3. They log in with **their own** Twitch account (the login page has a **Log in to the Mod Panel** link) and pick your channel.

From the Mod Panel they can use your Stream Deck, soundboard, polls, giveaways, trivia and Hype Train. Their presses are sent to your open dashboard, which runs them through your bot. You see each one in **Mod activity**.

- **Keep your dashboard open while you stream**, or their presses won't run.
- The Mod Desk on their panel uses their own Twitch mod powers, so they must also be a mod in your Twitch chat.
- Mods can't change your settings. Remove a mod any time from the **Mods** tab.

---

## 📱 Phone Stream Deck (Meld Studio)

`streamdeck.html` is a phone control pad for **Meld Studio**. Open **https://lightfeed.netlify.app/streamdeck.html**, or tap **Stream Deck** next to your account name on the dashboard.

It gives you big tiles that work in portrait and landscape. **Go Live / End Stream** and **Mic** are always at the top (Go Live needs a second tap within a few seconds, so you can't end the stream by accident). Below them are six tabs:
- **Buttons:** your own Stream Deck buttons (see below).
- **Scenes:** loaded from Meld automatically. The scene that's on air is highlighted.
- **Audio:** every audio track in Meld (Mic, Discord, game audio…) with mute / unmute and its current state.
- **Layers:** pick a scene, then turn any layer on or off: cameras, overlays, game capture. Effects on those layers show here too.
- **Sounds:** your dashboard's soundboard. Sounds play **on your PC** through the LightFeed dashboard, so keep the dashboard open while you stream.
- **Mod:** the Quick Mod Desk (emote-only, slow mode, sub-only, clear chat with two taps, timeouts and custom commands).

It vibrates on taps (on phones that support it) and keeps the screen on while connected. Both can be turned off in settings.

### My Buttons (like an Elgato Stream Deck)

On the **Buttons** tab, tap **Edit** → **New button** (or **Add starter buttons** to get Mic, your cameras, BRB, Save Clip, Screenshot and Record made for you). Give it a name, icon and colour, then add **steps**. One tap runs every step in order, for example *BRB = switch to the BRB scene → mute Mic → turn off Webcam*.

| Step | What it does |
|---|---|
| Switch scene | Shows a scene |
| Mute / unmute audio | Toggle, mute or unmute any audio track |
| Camera / layer on or off | Toggle, show or hide any layer in any scene |
| Effect on or off | Toggle, turn on or turn off an effect |
| Recording | Start / stop recording |
| Go live / end stream | Buttons with this step always need two taps |
| Save a clip, Take a screenshot | Meld's replay clip and screenshot |
| Virtual camera on/off, Recording chapter marker | Meld commands |
| Play a soundboard sound | Plays on your PC through the dashboard |
| Post a chat message button | Posts one of your dashboard's Stream Deck chat messages |
| Wait | Pauses 0.5–10 seconds before the next step |

Buttons with one step show their live state (e.g. *Muted*, *On*, *On air*). Tap **Edit** to change, delete or reorder buttons. Your buttons are saved to your LightFeed account, so they're still there if you clear your browser or use another phone. Each step remembers both the item and its name, so it still finds the right camera or track if you re-create it in Meld with the same name.

**Who can use it:** only the Twitch accounts listed in `DECK_OWNERS` (in `public/streamdeck.js` **and** `netlify/functions/team.mjs`). Everyone else, including your LightFeed mods, sees "This page is private." Log in to LightFeed with that Twitch account on your phone first.

### How the phone reaches Meld

Meld Studio has a remote-control API (its *WebChannel* API) on your PC at `127.0.0.1:13376`. LightFeed is an `https://` site, and phones can only open secure (`wss://`) connections from it, so you run a free **Cloudflare Tunnel** on the PC that gives Meld a temporary secure address.

### 1. Turn on Meld's API

In Meld Studio's settings, make sure the WebChannel (remote control) API is turned on. Integrations like Streamer.bot and Bitfocus Companion use the same setting. The default port is **13376**.

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

**Easy way:** double-click **`Start-MeldTunnel.bat`** in the LightFeed folder. It:
- checks cloudflared is installed (and offers to install it if not)
- waits for Meld Studio if it isn't open yet
- starts the tunnel and waits until the address is live (so your phone doesn't get "address not found")
- shows the address in big letters and copies it to your clipboard
- warns you if Meld closes while the tunnel is running

Leave that window open while you stream. Press **Ctrl+C** (then **Y**) or close the window to stop the tunnel.

**Manual way:** with Meld Studio open, run:

```powershell
cloudflared tunnel --url http://127.0.0.1:13376
```

After a few seconds it prints an address like `https://random-words-here.trycloudflare.com`. Wait about 30 seconds before using it. Leave that window open while you stream. Closing it closes the tunnel.

### 4. Connect your phone

1. On your phone, open `https://lightfeed.netlify.app/streamdeck.html` and log in with Twitch if asked.
2. Tap the ⚙️ settings button, paste the `https://…trycloudflare.com` address, and tap **Save & connect**.
3. Pick your mic under **Mic track** (it picks a track with "mic" in its name by default).

The address is saved on that phone only (never in the code or on the LightFeed server). The status pill shows **Connected**, **Reconnecting…** or **Offline**, and the page reconnects by itself if the connection drops or your phone wakes up. Tap the pill to retry straight away.

**Quick tunnels get a new address every time you start them**, so paste the new one in settings each stream.

### 🔐 Keep the tunnel address private

Meld's API has no password. **Anyone who knows your tunnel address can control Meld** (switch scenes, mute you, end your stream) for as long as the tunnel is running. So:
- Don't show the cloudflared window or the settings screen on stream.
- Close the tunnel (Ctrl+C in that window) when you finish streaming.
- If the address leaks, close the tunnel and start a new one to get a new address.

The LightFeed login only hides the page; it can't lock Meld itself. For a permanent address with a login in front of it, you can set up a named Cloudflare Tunnel with Cloudflare Access instead (needs a domain on Cloudflare).

---

## 💻 Running Locally

You don't need to run anything to use LightFeed; the hosted site has everything. Running it yourself is for development.

```bash
git clone https://github.com/Mighty-Skull-1/mightystreampulse.git
cd mightystreampulse
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000). To use a different port, copy `.env.example` to `.env` and change `PORT`.

`npm start` runs `server.js`, a small Express server that serves the `public/` folder and has an older set of local bot APIs. It does **not** run the Netlify functions, so **Mods, uploaded alert sounds and the phone Stream Deck's soundboard only work on the Netlify site** (or with `netlify dev` from the [Netlify CLI](https://docs.netlify.com/cli/get-started/)).

**Windows app:** `npm run build-exe` packages the local server into `LightFeed.exe`. Put it next to `Start-LightFeed.bat` and double-click the `.bat` to start it and open the dashboard.

### Deploying your own copy

Connect the repo to Netlify. `netlify.toml` already sets the publish folder (`public`) and the functions folder (`netlify/functions`). The functions use Netlify Blobs, which works on Netlify with no extra setup. For the 1-click Twitch login, register your site's URL as a redirect URL in your Twitch Developer app and add its Client ID on the login page under **Settings**.

---

## 📁 Project Structure

```
mightystreampulse/
├── public/                   # The website (published by Netlify)
│   ├── index.html            # Streamer dashboard
│   ├── app.js                # Dashboard logic: bot, deck, soundboard, alerts, mods relay…
│   ├── login.html            # Twitch login, quick token, saved profiles
│   ├── overlay.html          # OBS / Streamlabs browser source overlay
│   ├── mod.html, mod.js      # Mod Panel for your LightFeed mods
│   ├── streamdeck.html       # Phone Stream Deck for Meld Studio
│   ├── streamdeck.js         #   …its logic
│   ├── meld-client.js        # Meld Studio WebChannel client with auto-reconnect
│   ├── lf-shared.js          # Shared helpers: theme + Quick Mod Desk engine
│   ├── style.css             # Dark theme and layout
│   └── tmi.min.js            # Twitch chat library (tmi.js), bundled locally
├── netlify/functions/
│   ├── team.mjs              # Mods, shared setup, mod/phone → dashboard relay
│   └── sounds.mjs            # Uploaded alert & soundboard sounds
├── netlify.toml              # Netlify build settings
├── server.js                 # Optional local Express server
├── Start-LightFeed.bat       # Starts LightFeed.exe on Windows
├── Start-MeldTunnel.bat      # Starts the Meld tunnel for the phone Stream Deck
├── Start-MeldTunnel.ps1      #   …the script it runs
├── .env.example              # Settings for the local server
└── package.json
```

---

## 🔒 Privacy & Security

- **Your Twitch login stays in your browser.** Your token is saved in your browser's `localStorage`. When LightFeed's server functions need to know who you are, your browser sends the token, the server checks it with Twitch, and it isn't stored.
- **What LightFeed stores on its server (Netlify Blobs), keyed by your Twitch username:**
  - your mods list
  - the setup your mods and phone deck see: Stream Deck buttons, soundboard names and theme
  - button presses waiting for your dashboard to run them (deleted once they run)
  - sounds you upload for alerts and the soundboard
- **No chat logs, analytics or tracking.**
- **Phone Stream Deck:** the Cloudflare Tunnel address is saved only on your phone. Anyone with that address can control Meld while the tunnel runs, so keep it private (see [above](#-keep-the-tunnel-address-private)).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  Built with ❤️ for the Twitch streaming community by <strong>Mighty</strong>
</p>
