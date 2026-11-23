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
    function clearSceneCache() { delete $('sdScenes').dataset.sig; }

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

    // ---------- Tabs ----------
    document.querySelectorAll('.sd-tab').forEach(t => t.addEventListener('click', () => {
        haptic(6);
        document.querySelectorAll('.sd-tab').forEach(x => x.classList.toggle('active', x === t));
        document.querySelectorAll('.sd-section').forEach(s => s.classList.toggle('active', s.id === 'sec-' + t.dataset.sec));
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
    }
    function closeSheet() { $('sdSheetBg').classList.remove('open'); $('sdSheet').classList.remove('open'); }
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
        wireSettings(); wireModDesk();
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
