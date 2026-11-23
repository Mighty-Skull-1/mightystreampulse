// LightFeed phone Stream Deck
// Controls Meld Studio (through a Cloudflare Tunnel to Meld's WebChannel API), plays the
// soundboard on the PC through the LightFeed dashboard, and runs the Quick Mod Desk.
// Only the Twitch logins in DECK_OWNERS can use it (the server checks this too).
(function () {
    const DECK_OWNERS = ['mightyttv0'];
    const TEAM_API = '/.netlify/functions/team';
    const KEY = { url: 'lf_deck_tunnel_url', mic: 'lf_deck_mic_track', haptics: 'lf_deck_haptics', wake: 'lf_deck_wake' };
    const $ = (id) => document.getElementById(id);
    const esc = LF.esc;

    const profileId = localStorage.getItem('msp_active_profile');
    const token = profileId ? (localStorage.getItem(`msp_${profileId}_oauth`) || '').replace(/^oauth:/i, '').trim() : '';
    const state = { me: '', auth: null, shared: null, pcOnline: false, modes: null };

    // ---------- Small helpers ----------
    function toast(text, isErr) {
        const t = document.createElement('div');
        t.className = 'sd-toast' + (isErr ? ' err' : '');
        t.textContent = text;
        $('sdToasts').appendChild(t);
        setTimeout(() => t.remove(), 3200);
    }
    function haptic(pattern) {
        if (localStorage.getItem(KEY.haptics) === 'off') return;
        if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; // phones ignore it before the first tap
        try { if (navigator.vibrate) navigator.vibrate(pattern || 12); } catch (e) {}
    }
    function gate(html) {
        $('sdApp').style.display = 'none';
        $('sdGate').style.display = '';
        $('sdGate').innerHTML = `<div class="sd-msg">${html}</div>`;
    }
    // Two-tap confirm: first tap arms the button, a second tap within `ms` runs it
    function armable(el, armedHtml, ms, run) {
        let timer = null, saved = null;
        const disarm = () => { clearTimeout(timer); timer = null; el.classList.remove('armed'); if (saved != null) { el.innerHTML = saved; saved = null; } };
        el.addEventListener('click', () => {
            if (timer) { disarm(); haptic([20, 40, 20]); run(); return; }
            haptic(30);
            saved = el.innerHTML;
            el.innerHTML = armedHtml;
            el.classList.add('armed');
            timer = setTimeout(disarm, ms);
        });
        return { disarm, isArmed: () => !!timer };
    }

    // ---------- Login gate ----------
    async function checkLogin() {
        if (!token) return null;
        const r = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: 'OAuth ' + token } });
        if (!r.ok) return null;
        return r.json();
    }

    async function teamApi(path, opts) {
        opts = opts || {};
        opts.headers = Object.assign({ Authorization: 'Bearer ' + token }, opts.body ? { 'Content-Type': 'application/json' } : {});
        const r = await fetch(TEAM_API + path, opts);
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { const e = new Error(d.error || 'Something went wrong.'); e.status = r.status; throw e; }
        return d;
    }

    // ---------- Meld connection ----------
    const meld = new LFMeld.Connection({ onChange: renderMeld });
    let wakeLock = null;

    async function updateWakeLock() {
        const want = meld.status === 'connected' && localStorage.getItem(KEY.wake) !== 'off' && !document.hidden;
        try {
            if (want && !wakeLock && navigator.wakeLock) {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLock.addEventListener('release', () => { wakeLock = null; });
            } else if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; }
        } catch (e) { wakeLock = null; }
    }
    document.addEventListener('visibilitychange', updateWakeLock);

    function micTrack() {
        const saved = localStorage.getItem(KEY.mic);
        return meld.tracks.find(t => t.id === saved)
            || meld.tracks.find(t => /\bmic|microphone/i.test(t.name))
            || null;
    }

    let lastStatus = '';
    function renderMeld() {
        const connected = meld.status === 'connected';
        const pill = $('sdStatus');
        pill.className = 'sd-status ' + meld.status;
        $('sdStatusText').textContent = connected ? 'Connected' : (meld.status === 'reconnecting' ? 'Reconnecting…' : 'Offline');
        $('sdReason').textContent = connected ? '' : meld.reason;
        if (lastStatus && lastStatus !== meld.status) {
            if (connected) { haptic(15); toast('✓ Connected to Meld'); }
            else if (lastStatus === 'connected') { haptic([60, 60, 60]); toast('Lost Meld. Reconnecting…', true); }
        }
        lastStatus = meld.status;
        updateWakeLock();

        // Stream button
        const sb = $('sdStream');
        if (!streamConfirm.isArmed()) {
            sb.classList.toggle('disabled', !connected);
            sb.classList.toggle('live', connected && meld.isStreaming);
            sb.innerHTML = !connected
                ? '<i class="fa-solid fa-tower-broadcast"></i><span class="label">Go Live</span><span class="sub">Meld offline</span>'
                : meld.isStreaming
                    ? '<i class="fa-solid fa-stop"></i><span class="label">End Stream</span><span class="sub"><span class="sd-live-dot"></span>LIVE · tap twice</span>'
                    : '<i class="fa-solid fa-tower-broadcast"></i><span class="label">Go Live</span><span class="sub">Tap twice to start</span>';
        }

        // Mic button
        const mb = $('sdMic');
        const mic = connected ? micTrack() : null;
        mb.classList.toggle('disabled', !mic);
        mb.classList.toggle('muted', !!mic && mic.muted);
        mb.classList.toggle('live', !!mic && !mic.muted);
        mb.innerHTML = !connected
            ? '<i class="fa-solid fa-microphone"></i><span class="label">Mic</span><span class="sub">Meld offline</span>'
            : !mic
                ? '<i class="fa-solid fa-microphone"></i><span class="label">Mic</span><span class="sub">Pick a mic in settings</span>'
                : mic.muted
                    ? `<i class="fa-solid fa-microphone-slash"></i><span class="label">Muted</span><span class="sub">${esc(mic.name)} · tap to unmute</span>`
                    : `<i class="fa-solid fa-microphone"></i><span class="label">Mic Live</span><span class="sub">${esc(mic.name)} · tap to mute</span>`;

        renderScenes();
        renderAudio();
        renderLayers();
        renderButtons();
        renderMicOptions();
    }

    function renderScenes() {
        const grid = $('sdScenes');
        if (meld.status !== 'connected') {
            grid.innerHTML = `<div class="sd-empty" style="grid-column:1/-1"><i class="fa-solid fa-plug-circle-xmark"></i>${meld.url ? 'Waiting for Meld Studio…' : 'Add your Meld tunnel address in settings to load your scenes.'}</div>`;
            return;
        }
        if (!meld.scenes.length) { grid.innerHTML = '<div class="sd-empty" style="grid-column:1/-1"><i class="fa-solid fa-clapperboard"></i>No scenes in Meld yet.</div>'; return; }
        // Re-render only when something changed, so taps aren't interrupted
        const sig = JSON.stringify(meld.scenes);
        if (grid.dataset.sig === sig) return;
        grid.dataset.sig = sig;
        grid.innerHTML = '';
        meld.scenes.forEach(s => {
            const b = document.createElement('button');
            b.className = 'tile scene' + (s.current ? ' current' : '') + (s.staged ? ' staged' : '');
            b.innerHTML = `<i class="fa-solid ${s.current ? 'fa-video' : 'fa-clapperboard'}"></i><span class="label">${esc(s.name)}</span>${s.current ? '<span class="onair">ON AIR</span>' : ''}`;
            b.addEventListener('click', async () => {
                if (s.current) { haptic(8); return; }
                haptic(15);
                b.classList.add('busy');
                try { await meld.call('showScene', s.id); } catch (e) { toast(e.message, true); }
                setTimeout(() => b.classList.remove('busy'), 600);
            });
            grid.appendChild(b);
        });
    }
    function clearSceneCache() { document.querySelectorAll('[data-sig]').forEach(el => { delete el.dataset.sig; }); }

    function renderMicOptions() {
        const sel = $('sdMicSel');
        if (document.activeElement === sel) return;
        const cur = micTrack();
        if (!meld.tracks.length) { sel.innerHTML = `<option value="">${meld.status === 'connected' ? 'No audio tracks in Meld' : 'Connect to Meld to pick'}</option>`; return; }
        sel.innerHTML = meld.tracks.map(t => `<option value="${esc(t.id)}">${esc(t.name)}${t.global ? '' : ' (layer)'}</option>`).join('');
        if (cur) sel.value = cur.id;
        else sel.insertAdjacentHTML('afterbegin', '<option value="" selected>Pick your mic…</option>');
    }

    const streamConfirm = armable($('sdStream'),
        '<i class="fa-solid fa-triangle-exclamation"></i><span class="label">Tap again</span><span class="sub">to confirm</span>', 3500,
        async () => {
            const ending = meld.isStreaming;
            try {
                await meld.call('toggleStream');
                toast(ending ? 'Ending stream…' : 'Going live…');
            } catch (e) { toast(e.message, true); }
            renderMeld();
        });
    // Show what the second tap will do
    $('sdStream').addEventListener('click', () => {
        if (!streamConfirm.isArmed()) return;
        $('sdStream').querySelector('.label').textContent = meld.isStreaming ? 'Tap to END' : 'Tap to GO LIVE';
    });

    $('sdMic').addEventListener('click', async () => {
        const mic = micTrack();
        if (!mic) return;
        haptic(mic.muted ? 15 : [15, 30, 15]);
        try { await meld.call('toggleMute', mic.id); } catch (e) { toast(e.message, true); }
    });

    // ---------- Soundboard (plays on the PC via the dashboard) ----------
    function renderSounds() {
        const grid = $('sdSounds');
        const sounds = (state.shared && state.shared.soundboard) || [];
        $('sdPcNote').textContent = state.pcOnline
            ? 'Sounds play on your PC through your LightFeed dashboard.'
            : "Your LightFeed dashboard isn't open on your PC, so sounds won't play until it is.";
        $('sdPcNote').classList.toggle('warn', !state.pcOnline);
        if (!sounds.length) {
            grid.innerHTML = '<div class="sd-empty" style="grid-column:1/-1"><i class="fa-solid fa-volume-xmark"></i>No sounds yet. Open your LightFeed dashboard on your PC once so your soundboard syncs here.</div>';
            return;
        }
        const sig = JSON.stringify(sounds);
        if (grid.dataset.sig === sig) return;
        grid.dataset.sig = sig;
        grid.innerHTML = '';
        sounds.forEach(s => {
            const b = document.createElement('button');
            b.className = 'tile sound';
            b.innerHTML = `<span class="emoji">${esc(s.icon || '🔊')}</span><span class="label">${esc(s.name)}</span><span class="sub">${esc(s.category || 'Custom')}</span>`;
            b.addEventListener('click', () => {
                haptic(12);
                b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
                setTimeout(() => b.classList.remove('hit'), 400);
                playSound(s);
            });
            grid.appendChild(b);
        });
    }
    let soundBusy = false;
    async function playSound(s) {
        if (soundBusy) return;
        soundBusy = true;
        try {
            const d = await teamApi('', { method: 'POST', body: JSON.stringify({ op: 'deck_relay', action: { type: 'sound', id: s.id, name: s.name } }) });
            state.pcOnline = !!d.streamerOnline; renderSounds();
            toast(state.pcOnline ? `✓ ${s.name}` : `Queued ${s.name}, but your dashboard looks closed.`, !state.pcOnline);
        } catch (e) { toast(e.message, true); }
        finally { setTimeout(() => { soundBusy = false; }, 250); }
    }
    async function loadShared() {
        try {
            const d = await teamApi('?deck=1');
            const changed = JSON.stringify(d.shared) !== JSON.stringify(state.shared);
            state.shared = d.shared || {};
            state.pcOnline = !!d.streamerOnline;
            if (changed) LF.applyTheme(state.shared.theme);
            renderSounds();
            syncButtons(d.buttons);
        } catch (e) {
            if (e.status === 403) { gate(`<i class="fa-solid fa-lock"></i>${esc(e.message)}`); return false; }
        }
        return true;
    }

    // ---------- Quick Mod Desk (shared engine in lf-shared.js) ----------
    function renderModes() {
        const m = state.modes;
        document.querySelectorAll('.tile.mod[data-mode]').forEach(t => {
            const key = { emote: 'emote_mode', slow: 'slow_mode', sub: 'subscriber_mode' }[t.dataset.mode];
            const on = !!(m && m[key]);
            t.classList.toggle('on', on);
            let label = !m ? '—' : on ? 'ON · tap to turn off' : 'OFF · tap to turn on';
            if (t.dataset.mode === 'slow' && on) label = `ON · ${m.slow_mode_wait_time}s · tap to turn off`;
            t.querySelector('[data-state]').textContent = label;
        });
    }
    async function refreshModes() {
        try { state.modes = await LF.moderation.chatSettings(state.auth); } catch (e) {}
        renderModes();
    }
    async function runMod(cmd, extra, el) {
        if (el) el.classList.add('busy');
        try {
            const r = await LF.moderation.run(cmd, state.auth, extra);
            if (r.ok) { haptic(15); toast(r.message); }
            else { haptic([40, 40, 40]); toast(r.unsupported ? "That command isn't supported from the phone. Use the dashboard for it." : LF.moderation.errorText(r), true); }
            return r.ok;
        } catch (e) { toast(e.message, true); return false; }
        finally { if (el) el.classList.remove('busy'); refreshModes(); }
    }
    function wireModDesk() {
        document.querySelectorAll('.tile.mod[data-mode]').forEach(t => t.addEventListener('click', () => {
            const m = state.modes || {};
            const mode = t.dataset.mode;
            haptic(10);
            if (mode === 'emote') runMod(m.emote_mode ? '/emoteonlyoff' : '/emoteonly', {}, t);
            if (mode === 'sub') runMod(m.subscriber_mode ? '/subscribersoff' : '/subscribers', {}, t);
            if (mode === 'slow') { const sec = $('sdSlowSec').value; runMod(m.slow_mode ? '/slowoff' : '/slow ' + sec, { seconds: sec }, t); }
        }));
        armable($('sdClear'), '<i class="fa-solid fa-triangle-exclamation"></i><span class="label">Tap again</span><span class="sub">to clear ALL chat</span>', 3000,
            () => runMod('/clear', {}, $('sdClear')));
        $('sdTimeout').addEventListener('click', async () => {
            const target = $('sdToUser').value.trim().replace(/^@/, '');
            if (!target) { toast('Type a username first.', true); return; }
            const duration = $('sdToDur').value;
            if (await runMod(`/timeout ${target} ${duration}`, { action: 'timeout', target, duration }, $('sdTimeout'))) $('sdToUser').value = '';
        });
        const runCmd = async () => {
            let cmd = $('sdCmd').value.trim();
            if (!cmd) { toast('Type a mod command first, like /followers 10', true); return; }
            if (!cmd.startsWith('/')) cmd = '/' + cmd;
            if (await runMod(cmd, {}, $('sdCmdRun'))) $('sdCmd').value = '';
        };
        $('sdCmdRun').addEventListener('click', runCmd);
        $('sdCmd').addEventListener('keydown', e => { if (e.key === 'Enter') runCmd(); });
    }

    // ---------- Shared tile helpers ----------
    const KIND_ICON = { camera: 'fa-video', browser: 'fa-globe', media: 'fa-film', image: 'fa-image', other: 'fa-layer-group' };
    const sceneName = (id) => (meld.scenes.find(s => s.id === id) || {}).name || 'Scene';
    const layerById = (id) => meld.layers.find(l => l.id === id);
    const offlineHtml = (what) => `<div class="sd-empty" style="grid-column:1/-1"><i class="fa-solid fa-plug-circle-xmark"></i>${meld.url ? 'Waiting for Meld Studio…' : `Add your Meld tunnel address in settings to load your ${what}.`}</div>`;
    // Re-render a grid only when its data changed, so taps aren't interrupted
    function fillGrid(grid, sig, build) {
        if (grid.dataset.sig === sig) return;
        grid.dataset.sig = sig;
        grid.innerHTML = '';
        build(grid);
    }
    function tile(cls, html, onTap) {
        const b = document.createElement('button');
        b.className = 'tile ' + cls;
        b.innerHTML = html;
        if (onTap) b.addEventListener('click', () => onTap(b));
        return b;
    }
    function groupTitle(text) { const d = document.createElement('div'); d.className = 'sd-group-title'; d.textContent = text; return d; }
    async function meldTap(b, fn) {
        haptic(14);
        b.classList.add('busy');
        try { await fn(); } catch (e) { toast(e.message, true); }
        setTimeout(() => b.classList.remove('busy'), 500);
    }

    // ---------- Audio tab: every Meld audio track ----------
    function renderAudio() {
        const grid = $('sdAudio');
        if (meld.status !== 'connected') { delete grid.dataset.sig; grid.innerHTML = offlineHtml('audio'); return; }
        if (!meld.tracks.length) { delete grid.dataset.sig; grid.innerHTML = '<div class="sd-empty" style="grid-column:1/-1"><i class="fa-solid fa-volume-xmark"></i>No audio tracks in Meld.</div>'; return; }
        const live = meld.scenes.find(s => s.current);
        const groups = [['Main audio', meld.tracks.filter(t => t.global)]];
        const byScene = {};
        meld.tracks.filter(t => !t.global).forEach(t => { const l = layerById(t.layerId); const sid = l ? l.sceneId : ''; (byScene[sid] = byScene[sid] || []).push(t); });
        const order = meld.scenes.map(s => s.id).sort((a, b) => (live && b === live.id) - (live && a === live.id));
        order.forEach(sid => { if (byScene[sid]) groups.push([`${sceneName(sid)}${live && sid === live.id ? ' · on air' : ''}`, byScene[sid]]); });
        fillGrid(grid, JSON.stringify([groups, live && live.id]), (g) => {
            groups.forEach(([title, tracks]) => {
                if (!tracks.length) return;
                g.appendChild(groupTitle(title));
                tracks.forEach(t => g.appendChild(tile('toggle ' + (t.muted ? 'muted' : 'on'),
                    `<i class="fa-solid ${t.muted ? 'fa-volume-xmark' : (/\bmic|microphone/i.test(t.name) ? 'fa-microphone' : 'fa-volume-high')}"></i><span class="label">${esc(t.name)}</span><span class="sub">${t.muted ? 'Muted · tap to unmute' : 'Live · tap to mute'}</span>`,
                    (b) => meldTap(b, () => meld.call('toggleMute', t.id)))));
            });
        });
    }

    // ---------- Layers tab: cameras, overlays, captures per scene ----------
    let layerScene = '';   // scene picked in the Layers tab ('' = follow the live scene)
    function renderLayers() {
        const chips = $('sdLayerScenes'), grid = $('sdLayers');
        if (meld.status !== 'connected') { chips.innerHTML = ''; delete chips.dataset.sig; delete grid.dataset.sig; grid.innerHTML = offlineHtml('layers and cameras'); return; }
        const live = meld.scenes.find(s => s.current);
        if (layerScene && !meld.scenes.some(s => s.id === layerScene)) layerScene = '';
        const sid = layerScene || (live && live.id) || (meld.scenes[0] && meld.scenes[0].id);
        fillGrid(chips, JSON.stringify([meld.scenes, sid]), (c) => {
            meld.scenes.forEach(s => {
                const b = document.createElement('button');
                b.className = 'sd-chip' + (s.id === sid ? ' active' : '');
                b.innerHTML = `${esc(s.name)}${s.current ? '<span class="live">●</span>' : ''}`;
                b.addEventListener('click', () => { haptic(6); layerScene = s.id; renderLayers(); });
                c.appendChild(b);
            });
        });
        const layers = meld.layers.filter(l => l.sceneId === sid);
        const effects = meld.effects.filter(e => layers.some(l => l.id === e.layerId));
        if (!layers.length) { delete grid.dataset.sig; grid.innerHTML = '<div class="sd-empty" style="grid-column:1/-1"><i class="fa-solid fa-layer-group"></i>This scene has no layers.</div>'; return; }
        fillGrid(grid, JSON.stringify([layers, effects]), (g) => {
            layers.forEach(l => g.appendChild(tile('toggle ' + (l.visible ? 'on' : 'off'),
                `<i class="fa-solid ${l.visible ? KIND_ICON[l.kind] : (l.kind === 'camera' ? 'fa-video-slash' : 'fa-eye-slash')}"></i><span class="label">${esc(l.name)}</span><span class="sub">${l.visible ? 'On · tap to hide' : 'Off · tap to show'}</span>`,
                (b) => meldTap(b, () => meld.call('toggleLayer', l.sceneId, l.id)))));
            if (effects.length) g.appendChild(groupTitle('Effects'));
            effects.forEach(e => { const l = layerById(e.layerId); g.appendChild(tile('toggle ' + (e.enabled ? 'on' : 'off'),
                `<i class="fa-solid fa-wand-magic-sparkles"></i><span class="label">${esc(e.name)}</span><span class="sub">${esc(l ? l.name : '')} · ${e.enabled ? 'On' : 'Off'}</span>`,
                (b) => meldTap(b, () => meld.call('toggleEffect', l.sceneId, l.id, e.id)))); });
        });
    }

    // ---------- My Buttons: custom, multi-step buttons ----------
    const STEP_DEFS = {
        scene: { label: 'Switch scene', icon: 'fa-clapperboard' },
        mute: { label: 'Mute / unmute audio', icon: 'fa-microphone' },
        layer: { label: 'Camera / layer on or off', icon: 'fa-video' },
        effect: { label: 'Effect on or off', icon: 'fa-wand-magic-sparkles' },
        record: { label: 'Recording', icon: 'fa-circle-dot' },
        stream: { label: 'Go live / end stream', icon: 'fa-tower-broadcast' },
        clip: { label: 'Save a clip', icon: 'fa-scissors' },
        screenshot: { label: 'Take a screenshot', icon: 'fa-camera' },
        vcam: { label: 'Virtual camera on/off', icon: 'fa-camera-rotate' },
        marker: { label: 'Recording chapter marker', icon: 'fa-bookmark' },
        sound: { label: 'Play a soundboard sound', icon: 'fa-volume-high' },
        chat: { label: 'Post a chat message button', icon: 'fa-comment' },
        wait: { label: 'Wait', icon: 'fa-hourglass-half' }
    };
    const MODES = {
        mute: [['toggle', 'Toggle'], ['mute', 'Mute'], ['unmute', 'Unmute']],
        layer: [['toggle', 'Toggle'], ['show', 'Turn on'], ['hide', 'Turn off']],
        effect: [['toggle', 'Toggle'], ['show', 'Turn on'], ['hide', 'Turn off']],
        record: [['toggle', 'Start / stop'], ['start', 'Start recording'], ['stop', 'Stop recording']],
        stream: [['toggle', 'Go live / end'], ['start', 'Go live'], ['stop', 'End stream']]
    };
    const ICONS = ['fa-star', 'fa-bolt', 'fa-video', 'fa-video-slash', 'fa-camera', 'fa-microphone', 'fa-microphone-slash', 'fa-volume-high', 'fa-volume-xmark', 'fa-music', 'fa-clapperboard', 'fa-mug-hot', 'fa-gamepad', 'fa-comments', 'fa-headphones', 'fa-moon', 'fa-door-open', 'fa-scissors', 'fa-circle-dot', 'fa-tower-broadcast', 'fa-face-smile', 'fa-fire', 'fa-heart', 'fa-bell'];
    const COLORS = ['#9146ff', '#00f0ff', '#22c55e', '#f59e0b', '#ef4444', '#ff5aad', '#3b82f6', '#a1a1aa'];
    const BTN_CACHE = 'lf_deck_buttons_cache';

    state.buttons = [];
    state.buttonsDirty = false;
    let editing = false;

    const findScene = (s) => meld.scenes.find(x => x.id === s.sceneId) || meld.scenes.find(x => x.name === s.sceneName);
    const findTrack = (s) => meld.tracks.find(x => x.id === s.trackId) || meld.tracks.find(x => x.name === s.trackName);
    function findLayer(s) {
        const byId = meld.layers.find(x => x.id === s.layerId);
        if (byId) return byId;
        const sc = findScene(s);
        return sc ? meld.layers.find(x => x.sceneId === sc.id && x.name === s.layerName) : null;
    }
    function findEffect(s) {
        const byId = meld.effects.find(x => x.id === s.effectId);
        if (byId) return byId;
        const l = findLayer(s);
        return l ? meld.effects.find(x => x.layerId === l.id && x.name === s.effectName) : null;
    }
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const needMeld = () => { if (meld.status !== 'connected') throw new Error('Meld is offline.'); };
    async function relay(action) {
        const d = await teamApi('', { method: 'POST', body: JSON.stringify({ op: 'deck_relay', action }) });
        state.pcOnline = !!d.streamerOnline;
        if (!state.pcOnline) toast("Sent, but your LightFeed dashboard looks closed on your PC.", true);
    }
    const cmd = (c) => meld.call('sendCommand', c);

    async function runStep(s) {
        switch (s.type) {
            case 'scene': { needMeld(); const sc = findScene(s); if (!sc) throw new Error(`Scene "${s.sceneName}" isn't in Meld.`); if (!sc.current) await meld.call('showScene', sc.id); break; }
            case 'mute': { needMeld(); const t = findTrack(s); if (!t) throw new Error(`Audio "${s.trackName}" isn't in Meld.`);
                const want = s.mode === 'mute' ? true : s.mode === 'unmute' ? false : !t.muted;
                if (t.muted !== want) await meld.call('toggleMute', t.id); break; }
            case 'layer': { needMeld(); const l = findLayer(s); if (!l) throw new Error(`Layer "${s.layerName}" isn't in Meld.`);
                const want = s.mode === 'show' ? true : s.mode === 'hide' ? false : !l.visible;
                if (l.visible !== want) await meld.call('toggleLayer', l.sceneId, l.id); break; }
            case 'effect': { needMeld(); const e = findEffect(s); const l = e && layerById(e.layerId); if (!e || !l) throw new Error(`Effect "${s.effectName}" isn't in Meld.`);
                const want = s.mode === 'show' ? true : s.mode === 'hide' ? false : !e.enabled;
                if (e.enabled !== want) await meld.call('toggleEffect', l.sceneId, l.id, e.id); break; }
            case 'record': needMeld(); await cmd({ start: 'meld.startRecordingAction', stop: 'meld.stopRecordingAction' }[s.mode] || 'meld.toggleRecordingAction'); break;
            case 'stream': needMeld(); await cmd({ start: 'meld.startStreamingAction', stop: 'meld.stopStreamingAction' }[s.mode] || 'meld.toggleStreamingAction'); break;
            case 'clip': needMeld(); await cmd('meld.recordClip'); break;
            case 'screenshot': needMeld(); await cmd('meld.screenshot'); break;
            case 'vcam': needMeld(); await cmd('meld.toggleVirtualCameraAction'); break;
            case 'marker': needMeld(); await cmd('meld.insertRecordingChapterMarker'); break;
            case 'sound': await relay({ type: 'sound', id: s.soundId, name: s.soundName }); break;
            case 'chat': await relay({ type: 'deck', id: s.deckId, title: s.deckTitle }); break;
            case 'wait': await sleep(Math.max(100, Math.min(10000, +s.ms || 500))); break;
        }
        // Give Meld a moment to send back the new state before the next step reads it
        if (!['wait', 'sound', 'chat'].includes(s.type)) await sleep(150);
    }

    let running = false;
    async function runButton(btn, el) {
        if (running) return;
        running = true;
        el.classList.add('busy');
        haptic(18);
        let done = 0;
        try {
            for (const s of btn.steps) { await runStep(s); done++; }
            if (btn.steps.length > 1) toast(`✓ ${btn.label || 'Done'}`);
        } catch (e) {
            haptic([40, 40, 40]);
            toast(btn.steps.length > 1 ? `Step ${done + 1}: ${e.message}` : e.message, true);
        } finally {
            el.classList.remove('busy');
            running = false;
        }
    }

    // What a one-step button should show (on/off etc.), or null
    function buttonState(btn) {
        if (btn.steps.length !== 1 || meld.status !== 'connected') return null;
        const s = btn.steps[0];
        if (s.type === 'scene') { const sc = findScene(s); return sc ? { on: sc.current, text: sc.current ? 'On air' : 'Tap to switch' } : null; }
        if (s.type === 'mute') { const t = findTrack(s); return t ? { on: !t.muted, text: t.muted ? 'Muted' : 'Live' } : null; }
        if (s.type === 'layer') { const l = findLayer(s); return l ? { on: l.visible, text: l.visible ? 'On' : 'Off' } : null; }
        if (s.type === 'effect') { const e = findEffect(s); return e ? { on: e.enabled, text: e.enabled ? 'On' : 'Off' } : null; }
        if (s.type === 'record') return { on: meld.isRecording, text: meld.isRecording ? 'Recording' : 'Not recording' };
        if (s.type === 'stream') return { on: meld.isStreaming, text: meld.isStreaming ? 'Live' : 'Offline' };
        return null;
    }
    function stepSummary(s) {
        const m = (MODES[s.type] || []).find(x => x[0] === (s.mode || 'toggle'));
        const mode = m ? m[1] : '';
        switch (s.type) {
            case 'scene': return `Switch to ${s.sceneName || 'scene'}`;
            case 'mute': return `${mode}: ${s.trackName || 'audio'}`;
            case 'layer': return `${mode}: ${s.layerName || 'layer'}${s.sceneName ? ` (${s.sceneName})` : ''}`;
            case 'effect': return `${mode}: ${s.effectName || 'effect'}`;
            case 'record': case 'stream': return mode;
            case 'sound': return `Play ${s.soundName || 'sound'}`;
            case 'chat': return `Chat: ${s.deckTitle || 'message'}`;
            case 'wait': return `Wait ${(+s.ms || 500) / 1000}s`;
            default: return STEP_DEFS[s.type] ? STEP_DEFS[s.type].label : s.type;
        }
    }
    const needsConfirm = (btn) => btn.steps.some(s => s.type === 'stream');

    function renderButtons() {
        const grid = $('sdButtons');
        grid.parentElement.classList.toggle('editing', editing);
        $('sdEditToggle').innerHTML = editing ? '<i class="fa-solid fa-check"></i> Done' : '<i class="fa-solid fa-pen"></i> Edit';
        $('sdEditToggle').classList.toggle('on', editing);
        $('sdBtnNote').textContent = editing ? 'Tap a button to change it.' : 'Your own buttons. Each one can do several things in a row.';
        const states = state.buttons.map(buttonState);
        fillGrid(grid, JSON.stringify([state.buttons, states, editing, meld.status === 'connected']), (g) => {
            if (!state.buttons.length && !editing) {
                const empty = document.createElement('div');
                empty.className = 'sd-empty'; empty.style.gridColumn = '1/-1';
                empty.innerHTML = '<i class="fa-solid fa-table-cells-large"></i>No buttons yet. Make your own, like an Elgato Stream Deck:<br>one button can switch a scene, mute your mic and turn a camera off in one tap.<div class="sd-row" style="margin-top:14px;justify-content:center"><button class="sd-btn primary" data-act="new"><i class="fa-solid fa-plus"></i> New button</button><button class="sd-btn" data-act="starter"><i class="fa-solid fa-wand-magic-sparkles"></i> Add starter buttons</button></div>';
                empty.querySelector('[data-act=new]').addEventListener('click', () => openEditor(-1));
                empty.querySelector('[data-act=starter]').addEventListener('click', addStarterButtons);
                g.appendChild(empty);
                return;
            }
            state.buttons.forEach((btn, i) => {
                const st = states[i];
                const firstIcon = btn.steps[0] && STEP_DEFS[btn.steps[0].type] ? STEP_DEFS[btn.steps[0].type].icon : 'fa-star';
                const sub = st ? st.text : (btn.steps.length > 1 ? `<span class="steps">${btn.steps.length} STEPS</span>` : esc(btn.steps[0] ? stepSummary(btn.steps[0]) : 'No steps'));
                const el = tile('custom' + (st ? (st.on ? ' state-on' : ' state-off') : ''),
                    `<span class="edit-badge"><i class="fa-solid fa-pen"></i></span><i class="fa-solid ${esc(btn.icon || firstIcon)}"></i><span class="label">${esc(btn.label || 'Button')}</span><span class="sub">${sub}</span>`);
                el.style.setProperty('--btn', btn.color || '#9146ff');
                if (editing) el.addEventListener('click', () => { haptic(8); openEditor(i); });
                else if (needsConfirm(btn)) {
                    armable(el, `<i class="fa-solid fa-triangle-exclamation"></i><span class="label">Tap again</span><span class="sub">${esc(btn.label || '')} · changes your stream</span>`, 3500, () => runButton(btn, el));
                } else el.addEventListener('click', () => runButton(btn, el));
                g.appendChild(el);
            });
            if (editing) g.appendChild(tile('add', '<i class="fa-solid fa-plus"></i><span class="label">New button</span>', () => openEditor(-1)));
        });
    }

    function saveButtonsLocal() { try { localStorage.setItem(BTN_CACHE, JSON.stringify(state.buttons)); } catch (e) {} }
    async function saveButtons() {
        saveButtonsLocal();
        state.buttonsDirty = true;
        try {
            const d = await teamApi('', { method: 'POST', body: JSON.stringify({ op: 'deck_buttons', buttons: state.buttons }) });
            state.buttons = d.buttons || state.buttons;
            state.buttonsDirty = false;
            saveButtonsLocal();
        } catch (e) { toast("Saved on this phone. Couldn't save to your account yet; I'll retry.", true); }
        renderButtons();
    }
    // Called from loadShared with what the server has
    function syncButtons(serverButtons) {
        if (state.buttonsDirty) { saveButtons(); return; }
        if (Array.isArray(serverButtons)) state.buttons = serverButtons;
        else { try { state.buttons = JSON.parse(localStorage.getItem(BTN_CACHE)) || []; } catch (e) { state.buttons = []; } if (state.buttons.length) saveButtons(); }
        saveButtonsLocal();
        if (!$('sdEditor').classList.contains('open')) renderButtons();
    }

    function addStarterButtons() {
        if (meld.status !== 'connected') { toast('Connect to Meld first, so the buttons can use your scenes, mic and cameras.', true); return; }
        const out = [];
        const mic = micTrack();
        const id = () => 'b' + Math.random().toString(36).slice(2, 9);
        if (mic) out.push({ id: id(), label: 'Mic', icon: 'fa-microphone', color: '#22c55e', steps: [{ type: 'mute', trackId: mic.id, trackName: mic.name, mode: 'toggle' }] });
        const live = meld.scenes.find(s => s.current);
        const seen = new Set();
        // Cameras on air first, then ones that are showing in other scenes
        const rank = (l) => (live && l.sceneId === live.id ? 2 : 0) + (l.visible ? 1 : 0);
        meld.layers.filter(l => l.kind === 'camera').sort((a, b) => rank(b) - rank(a)).forEach(l => {
            if (seen.has(l.name) || seen.size >= 3) return; seen.add(l.name);
            out.push({ id: id(), label: l.name.split('/').pop(), icon: 'fa-video', color: '#00f0ff', steps: [{ type: 'layer', sceneId: l.sceneId, sceneName: sceneName(l.sceneId), layerId: l.id, layerName: l.name, mode: 'toggle' }] });
        });
        const brb = meld.scenes.find(s => /\bbrb\b|be right back/i.test(s.name));
        if (brb) {
            const steps = [{ type: 'scene', sceneId: brb.id, sceneName: brb.name }];
            if (mic) steps.push({ type: 'mute', trackId: mic.id, trackName: mic.name, mode: 'mute' });
            out.push({ id: id(), label: 'BRB', icon: 'fa-mug-hot', color: '#f59e0b', steps });
        }
        out.push({ id: id(), label: 'Save Clip', icon: 'fa-scissors', color: '#ff5aad', steps: [{ type: 'clip' }] });
        out.push({ id: id(), label: 'Screenshot', icon: 'fa-camera', color: '#3b82f6', steps: [{ type: 'screenshot' }] });
        out.push({ id: id(), label: 'Record', icon: 'fa-circle-dot', color: '#ef4444', steps: [{ type: 'record', mode: 'toggle' }] });
        state.buttons = state.buttons.concat(out);
        haptic(20);
        toast(`Added ${out.length} buttons. Tap Edit to change them.`);
        saveButtons();
    }

    // ---------- Button editor ----------
    let draft = null, draftIndex = -1;
    function openEditor(i) {
        draftIndex = i;
        draft = i >= 0 ? JSON.parse(JSON.stringify(state.buttons[i])) : { id: 'b' + Math.random().toString(36).slice(2, 9), label: '', icon: 'fa-star', color: COLORS[0], steps: [] };
        $('sdEdTitle').innerHTML = i >= 0 ? '<i class="fa-solid fa-pen"></i> Edit button' : '<i class="fa-solid fa-plus"></i> New button';
        $('sdEdLabel').value = draft.label || '';
        $('sdEdDelete').style.display = i >= 0 ? '' : 'none';
        $('sdEdMoveRow').style.display = i >= 0 && state.buttons.length > 1 ? '' : 'none';
        $('sdEdAddType').innerHTML = Object.entries(STEP_DEFS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
        renderEditor();
        $('sdEditorBg').classList.add('open'); $('sdEditor').classList.add('open');
        document.body.classList.add('sheet-open');
    }
    function closeEditor() { $('sdEditorBg').classList.remove('open'); $('sdEditor').classList.remove('open'); document.body.classList.remove('sheet-open'); draft = null; renderButtons(); }

    function options(list, value, emptyLabel) {
        const has = list.some(o => o.value === value);
        return (has || !value ? '' : `<option value="${esc(value)}" selected>${esc(emptyLabel)} (not in Meld right now)</option>`) +
            list.map(o => o.group != null ? o.html : `<option value="${esc(o.value)}"${o.value === value ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
    }
    function groupedOptions(items, value, label) {
        // items: [{ value, label, sceneId }] grouped by scene
        let html = '';
        meld.scenes.forEach(sc => {
            const inScene = items.filter(x => x.sceneId === sc.id);
            if (!inScene.length) return;
            html += `<optgroup label="${esc(sc.name)}">` + inScene.map(o => `<option value="${esc(o.value)}"${o.value === value ? ' selected' : ''}>${esc(o.label)}</option>`).join('') + '</optgroup>';
        });
        const has = items.some(o => o.value === value);
        return (value && !has ? `<option value="${esc(value)}" selected>${esc(label)} (not in Meld right now)</option>` : (!value ? '<option value="" selected>Pick one…</option>' : '')) + html;
    }

    function stepFields(s, idx) {
        const sel = (field, html) => `<select class="sd-select" data-f="${field}" data-i="${idx}">${html}</select>`;
        const modeSel = MODES[s.type] ? sel('mode', MODES[s.type].map(([v, l]) => `<option value="${v}"${(s.mode || 'toggle') === v ? ' selected' : ''}>${l}</option>`).join('')) : '';
        const offline = meld.status !== 'connected' && ['scene', 'mute', 'layer', 'effect'].includes(s.type) ? '<span class="sd-note" style="margin:0">Connect to Meld to pick from your setup.</span>' : '';
        switch (s.type) {
            case 'scene': return sel('sceneId', (!s.sceneId ? '<option value="" selected>Pick a scene…</option>' : '') + options(meld.scenes.map(x => ({ value: x.id, label: x.name })), s.sceneId, s.sceneName || 'Scene')) + offline;
            case 'mute': {
                const list = meld.tracks.map(t => { const l = layerById(t.layerId); return { value: t.id, label: t.global ? t.name : `${t.name} (${l ? sceneName(l.sceneId) : 'layer'})` }; });
                return sel('trackId', (!s.trackId ? '<option value="" selected>Pick audio…</option>' : '') + options(list, s.trackId, s.trackName || 'Audio')) + modeSel + offline;
            }
            case 'layer': return sel('layerId', groupedOptions(meld.layers.map(l => ({ value: l.id, label: `${l.kind === 'camera' ? '📷 ' : ''}${l.name}`, sceneId: l.sceneId })), s.layerId, s.layerName || 'Layer')) + modeSel + offline;
            case 'effect': return sel('effectId', groupedOptions(meld.effects.map(e => { const l = layerById(e.layerId); return { value: e.id, label: `${e.name} (${l ? l.name : 'layer'})`, sceneId: l ? l.sceneId : '' }; }), s.effectId, s.effectName || 'Effect')) + modeSel + offline;
            case 'record': case 'stream': return modeSel + (s.type === 'stream' ? '<span class="sd-note warn" style="margin:0">Buttons with this step need two taps.</span>' : '');
            case 'sound': { const list = ((state.shared && state.shared.soundboard) || []).map(x => ({ value: x.id, label: `${x.icon || '🔊'} ${x.name}` }));
                return sel('soundId', (!s.soundId ? '<option value="" selected>Pick a sound…</option>' : '') + options(list, s.soundId, s.soundName || 'Sound')) + '<span class="sd-note" style="margin:0">Plays on your PC through the dashboard.</span>'; }
            case 'chat': { const list = ((state.shared && state.shared.deck) || []).map(x => ({ value: x.id, label: x.title }));
                return sel('deckId', (!s.deckId ? '<option value="" selected>Pick a chat button…</option>' : '') + options(list, s.deckId, s.deckTitle || 'Chat button')) + '<span class="sd-note" style="margin:0">Your bot posts it, so the dashboard must be open.</span>'; }
            case 'wait': return sel('ms', [500, 1000, 2000, 3000, 5000, 10000].map(ms => `<option value="${ms}"${(+s.ms || 1000) === ms ? ' selected' : ''}>${ms / 1000} second${ms === 1000 ? '' : 's'}</option>`).join(''));
            default: return '<span class="sd-note" style="margin:0">No settings needed.</span>';
        }
    }

    function renderEditor() {
        if (!draft) return;
        $('sdEdIcons').innerHTML = ICONS.map(ic => `<button class="sd-iconpick${draft.icon === ic ? ' sel' : ''}" data-icon="${ic}" aria-label="${ic.replace('fa-', '')}"><i class="fa-solid ${ic}"></i></button>`).join('');
        $('sdEdColors').innerHTML = COLORS.map(c => `<button class="sd-swatch${draft.color === c ? ' sel' : ''}" data-color="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('');
        const box = $('sdEdSteps');
        if (!draft.steps.length) { box.innerHTML = '<p class="sd-note" style="margin:6px 0 0">No steps yet. Pick one below and tap <b>Add step</b>.</p>'; return; }
        box.innerHTML = draft.steps.map((s, i) => `
            <div class="sd-step">
                <span class="num">${i + 1}</span>
                <div class="fields"><b style="font-size:.85rem"><i class="fa-solid ${STEP_DEFS[s.type].icon}" style="color:var(--accent)"></i> ${esc(STEP_DEFS[s.type].label)}</b>${stepFields(s, i)}</div>
                <div class="tools">
                    <button data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up"><i class="fa-solid fa-arrow-up"></i></button>
                    <button data-down="${i}" ${i === draft.steps.length - 1 ? 'disabled' : ''} aria-label="Move down"><i class="fa-solid fa-arrow-down"></i></button>
                    <button data-del="${i}" aria-label="Remove step"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>`).join('');
    }

    function setStepField(i, field, value) {
        const s = draft.steps[i];
        if (field === 'mode') s.mode = value;
        else if (field === 'ms') s.ms = +value;
        else if (field === 'sceneId') { const x = meld.scenes.find(y => y.id === value); s.sceneId = value; s.sceneName = x ? x.name : s.sceneName; }
        else if (field === 'trackId') { const x = meld.tracks.find(y => y.id === value); s.trackId = value; s.trackName = x ? x.name : s.trackName; }
        else if (field === 'layerId') { const x = layerById(value); s.layerId = value; if (x) { s.layerName = x.name; s.sceneId = x.sceneId; s.sceneName = sceneName(x.sceneId); } }
        else if (field === 'effectId') { const x = meld.effects.find(y => y.id === value); s.effectId = value; if (x) { const l = layerById(x.layerId); s.effectName = x.name; if (l) { s.layerId = l.id; s.layerName = l.name; s.sceneId = l.sceneId; s.sceneName = sceneName(l.sceneId); } } }
        else if (field === 'soundId') { const x = ((state.shared && state.shared.soundboard) || []).find(y => y.id === value); s.soundId = value; s.soundName = x ? x.name : s.soundName; }
        else if (field === 'deckId') { const x = ((state.shared && state.shared.deck) || []).find(y => y.id === value); s.deckId = value; s.deckTitle = x ? x.title : s.deckTitle; }
    }
    function stepIncomplete(s) {
        return (s.type === 'scene' && !s.sceneId) || (s.type === 'mute' && !s.trackId) || (s.type === 'layer' && !s.layerId) ||
            (s.type === 'effect' && !s.effectId) || (s.type === 'sound' && !s.soundId) || (s.type === 'chat' && !s.deckId);
    }

    function wireButtons() {
        $('sdEditToggle').addEventListener('click', () => { haptic(8); editing = !editing; renderButtons(); });
        $('sdEditorBg').addEventListener('click', closeEditor);
        $('sdEdCancel').addEventListener('click', closeEditor);
        $('sdEdLabel').addEventListener('input', () => { if (draft) draft.label = $('sdEdLabel').value; });
        $('sdEdIcons').addEventListener('click', (e) => { const b = e.target.closest('[data-icon]'); if (!b || !draft) return; haptic(6); draft.icon = b.dataset.icon; renderEditor(); });
        $('sdEdColors').addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (!b || !draft) return; haptic(6); draft.color = b.dataset.color; renderEditor(); });
        $('sdEdSteps').addEventListener('change', (e) => { const f = e.target.closest('[data-f]'); if (!f || !draft) return; setStepField(+f.dataset.i, f.dataset.f, f.value); });
        $('sdEdSteps').addEventListener('click', (e) => {
            if (!draft) return;
            const up = e.target.closest('[data-up]'), down = e.target.closest('[data-down]'), del = e.target.closest('[data-del]');
            const swap = (a, b) => { const t = draft.steps[a]; draft.steps[a] = draft.steps[b]; draft.steps[b] = t; };
            if (up) swap(+up.dataset.up, +up.dataset.up - 1);
            else if (down) swap(+down.dataset.down, +down.dataset.down + 1);
            else if (del) draft.steps.splice(+del.dataset.del, 1);
            else return;
            haptic(6); renderEditor();
        });
        $('sdEdAddStep').addEventListener('click', () => {
            if (!draft) return;
            if (draft.steps.length >= 12) { toast('A button can have up to 12 steps.', true); return; }
            const type = $('sdEdAddType').value;
            const s = { type };
            if (MODES[type]) s.mode = 'toggle';
            if (type === 'wait') s.ms = 1000;
            if (type === 'mute') { const mic = micTrack(); if (mic) { s.trackId = mic.id; s.trackName = mic.name; } }
            draft.steps.push(s);
            haptic(8); renderEditor();
        });
        $('sdEdSave').addEventListener('click', () => {
            if (!draft) return;
            if (!draft.steps.length) { toast('Add at least one step.', true); return; }
            const bad = draft.steps.findIndex(stepIncomplete);
            if (bad >= 0) { toast(`Step ${bad + 1} needs something picked.`, true); return; }
            draft.label = ($('sdEdLabel').value || '').trim() || stepSummary(draft.steps[0]).slice(0, 40);
            if (draftIndex >= 0) state.buttons[draftIndex] = draft; else state.buttons.push(draft);
            haptic(18);
            closeEditor();
            saveButtons();
        });
        $('sdEdDelete').addEventListener('click', () => {
            if (draftIndex < 0 || !confirm(`Delete the "${state.buttons[draftIndex].label}" button?`)) return;
            state.buttons.splice(draftIndex, 1);
            closeEditor();
            saveButtons();
        });
        const move = (dir) => {
            const j = draftIndex + dir;
            if (draftIndex < 0 || j < 0 || j >= state.buttons.length) return;
            const t = state.buttons[draftIndex]; state.buttons[draftIndex] = state.buttons[j]; state.buttons[j] = t;
            draftIndex = j; haptic(8); saveButtons();
            toast(dir < 0 ? 'Moved earlier' : 'Moved later');
        };
        $('sdEdLeft').addEventListener('click', () => move(-1));
        $('sdEdRight').addEventListener('click', () => move(1));
    }

    // ---------- Tabs ----------
    function showTab(sec) {
        const t = document.querySelector(`.sd-tab[data-sec="${sec}"]`) || document.querySelector('.sd-tab');
        document.querySelectorAll('.sd-tab').forEach(x => x.classList.toggle('active', x === t));
        document.querySelectorAll('.sd-section').forEach(s => s.classList.toggle('active', s.id === 'sec-' + t.dataset.sec));
        try { localStorage.setItem('lf_deck_tab', t.dataset.sec); } catch (e) {}
    }
    document.querySelectorAll('.sd-tab').forEach(t => t.addEventListener('click', () => {
        haptic(6);
        showTab(t.dataset.sec);
        if (t.dataset.sec === 'mod') refreshModes();
        if (t.dataset.sec === 'sounds') loadShared();
    }));

    // ---------- Settings sheet ----------
    function openSheet() {
        $('sdUrl').value = localStorage.getItem(KEY.url) || '';
        $('sdUrlErr').style.display = 'none';
        $('sdHaptics').checked = localStorage.getItem(KEY.haptics) !== 'off';
        $('sdWake').checked = localStorage.getItem(KEY.wake) !== 'off';
        renderMicOptions();
        $('sdSheetBg').classList.add('open'); $('sdSheet').classList.add('open');
        document.body.classList.add('sheet-open');
    }
    function closeSheet() { $('sdSheetBg').classList.remove('open'); $('sdSheet').classList.remove('open'); document.body.classList.remove('sheet-open'); }
    function wireSettings() {
        $('sdSettingsBtn').addEventListener('click', () => { haptic(8); openSheet(); });
        $('sdStatus').addEventListener('click', () => { if (meld.status === 'connected') return; haptic(8); if (!meld.url) openSheet(); else { meld.kick(); toast('Trying to reconnect…'); } });
        $('sdSheetBg').addEventListener('click', closeSheet);
        $('sdSheetClose').addEventListener('click', closeSheet);
        $('sdUrlSave').addEventListener('click', () => {
            let url;
            try { url = LFMeld.normalizeUrl($('sdUrl').value); }
            catch (e) { $('sdUrlErr').textContent = e.message; $('sdUrlErr').style.display = ''; haptic([40, 40, 40]); return; }
            if (!url) { $('sdUrlErr').textContent = 'Paste your tunnel address first.'; $('sdUrlErr').style.display = ''; return; }
            localStorage.setItem(KEY.url, url);
            $('sdUrl').value = url;
            $('sdUrlErr').style.display = 'none';
            haptic(15);
            clearSceneCache();
            meld.setUrl(url);
            closeSheet();
        });
        $('sdUrlForget').addEventListener('click', () => {
            localStorage.removeItem(KEY.url);
            $('sdUrl').value = '';
            clearSceneCache();
            meld.setUrl('');
            toast('Tunnel address removed from this phone.');
        });
        $('sdMicSel').addEventListener('change', () => {
            if ($('sdMicSel').value) localStorage.setItem(KEY.mic, $('sdMicSel').value);
            renderMeld();
        });
        $('sdHaptics').addEventListener('change', () => { localStorage.setItem(KEY.haptics, $('sdHaptics').checked ? 'on' : 'off'); haptic(15); });
        $('sdWake').addEventListener('change', () => { localStorage.setItem(KEY.wake, $('sdWake').checked ? 'on' : 'off'); updateWakeLock(); });
    }

    // Remember to come back here after logging in
    document.addEventListener('click', (e) => { if (e.target.closest('[data-decklogin]')) localStorage.setItem('lf_after_login', 'deck'); });

    // ---------- Start ----------
    async function start() {
        const loginBtn = (text) => `<br><a class="sd-btn primary" href="login.html" data-decklogin="1"><i class="fa-brands fa-twitch"></i> ${text}</a>`;
        if (!token) { $('sdWho').textContent = 'NOT LOGGED IN'; return gate('<i class="fa-brands fa-twitch"></i>Log in to LightFeed with Twitch first.' + loginBtn('Log in with Twitch')); }
        let v;
        try { v = await checkLogin(); }
        catch (e) { return gate('<i class="fa-solid fa-wifi"></i>Couldn\'t reach Twitch. Check your connection and refresh.'); }
        if (!v) { $('sdWho').textContent = 'LOGIN EXPIRED'; return gate('<i class="fa-brands fa-twitch"></i>Your Twitch login has expired.' + loginBtn('Log in again')); }
        const login = (v.login || '').toLowerCase();
        if (!DECK_OWNERS.includes(login)) {
            $('sdWho').textContent = 'PRIVATE';
            return gate('<i class="fa-solid fa-lock"></i>This page is private.<br><br><a class="sd-btn" href="index.html"><i class="fa-solid fa-arrow-left"></i> Back to LightFeed</a>');
        }
        state.me = login;
        state.auth = { token, clientId: v.client_id, userId: v.user_id, broadcasterId: v.user_id };
        $('sdWho').textContent = 'LOGGED IN AS ' + login.toUpperCase();

        if (!(await loadShared())) return;
        $('sdGate').style.display = 'none';
        $('sdApp').style.display = '';
        $('sdStatus').style.display = '';
        $('sdSettingsBtn').style.display = '';
        wireSettings(); wireModDesk(); wireButtons();
        showTab(localStorage.getItem('lf_deck_tab') || 'buttons');
        renderModes();

        const url = localStorage.getItem(KEY.url) || '';
        meld.setUrl(url);
        renderMeld();
        if (!url) openSheet();

        setInterval(() => { if (!document.hidden) loadShared(); }, 30000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) loadShared(); });
    }
    start();
})();
