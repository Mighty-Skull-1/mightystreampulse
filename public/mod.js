// LightFeed Mod Panel
// Mods log in with their own Twitch account, pick a channel they've been added to,
// and press the streamer's buttons. Presses are sent to the streamer's open dashboard,
// which runs them through the streamer's bot. Mod Desk uses the mod's own Twitch powers.
(function () {
    const API = '/.netlify/functions/team';
    const $ = (id) => document.getElementById(id);
    const esc = (t) => { const d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; };

    const profileId = localStorage.getItem('msp_active_profile');
    const token = profileId ? (localStorage.getItem(`msp_${profileId}_oauth`) || '').replace(/^oauth:/, '') : '';
    const state = { me: '', channel: '', shared: null, online: false, refreshTimer: null, helix: null };

    function toast(text, isErr) {
        const t = document.createElement('div');
        t.className = 'mp-toast' + (isErr ? ' err' : '');
        t.textContent = text;
        $('mpToasts').appendChild(t);
        setTimeout(() => t.remove(), 3200);
    }
    function showMessage(html) {
        $('mpMain').style.display = 'none';
        $('mpBody').style.display = '';
        $('mpBody').innerHTML = `<div class="mp-msg">${html}</div>`;
    }

    async function api(path, opts) {
        opts = opts || {};
        opts.headers = Object.assign({ Authorization: 'Bearer ' + token }, opts.body ? { 'Content-Type': 'application/json' } : {});
        const r = await fetch(API + path, opts);
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { const e = new Error(d.error || 'Something went wrong.'); e.status = r.status; throw e; }
        return d;
    }

    // ---------- Theme ----------
    const BGS = {
        charcoal: ['#09090b', '#121215', '#18181c', '#222228', '#27272f', '#3f3f4e'],
        midnight: ['#070b16', '#0d1324', '#121a30', '#19233d', '#1f2a44', '#33415f'],
        black: ['#000000', '#0a0a0a', '#111111', '#1a1a1a', '#222222', '#3a3a3a'],
        plum: ['#0d0710', '#150c1a', '#1c1022', '#26162e', '#2e1c38', '#4a2e5a']
    };
    function rgb(hex) { const n = parseInt((hex || '').replace('#', ''), 16); return isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function applyTheme(t) {
        if (!t) return;
        const r = document.documentElement.style;
        if (/^#[0-9a-f]{6}$/i.test(t.primary || '')) { r.setProperty('--primary', t.primary); r.setProperty('--primary-rgb', rgb(t.primary).join(', ')); }
        if (/^#[0-9a-f]{6}$/i.test(t.accent || '')) { r.setProperty('--accent', t.accent); r.setProperty('--accent-rgb', rgb(t.accent).join(', ')); }
        const b = BGS[t.bg];
        if (b) ['--bg-base', '--bg-surface', '--bg-card', '--bg-card-hover', '--border-subtle', '--border-bright'].forEach((v, i) => r.setProperty(v, b[i]));
    }

    // ---------- Render ----------
    function iconClass(icon) {
        let c = icon || 'fa-solid fa-bolt';
        if (c === 'fa-hand-wave') c = 'fa-solid fa-hand';
        if (!c.startsWith('fa-')) c = 'fa-solid ' + c;
        if (!c.includes(' ')) c = 'fa-solid ' + c;
        return c.replace(/[^a-z0-9\- ]/gi, '');
    }
    function renderDeck() {
        const grid = $('mpDeck');
        const deck = (state.shared && state.shared.deck) || [];
        if (!deck.length) { grid.innerHTML = '<p class="muted-note">The streamer has no Stream Deck buttons yet.</p>'; return; }
        grid.innerHTML = '';
        deck.forEach(b => {
            const card = document.createElement('div');
            card.className = 'action-card';
            card.tabIndex = 0;
            card.innerHTML = `
                <div class="card-top"><div style="display:flex;align-items:center;gap:8px;">
                    <i class="card-icon ${iconClass(b.icon)}"></i>
                    <span class="card-badge" data-cat="${esc((b.category || 'chat').toLowerCase())}">${esc(b.category || 'Chat')}</span>
                </div></div>
                <div class="card-title">${esc(b.title)}</div>
                <div class="card-desc">${esc(b.message)}</div>`;
            const go = () => send({ type: 'deck', id: b.id, title: b.title }, `Sent "${b.title}"`);
            card.addEventListener('click', go);
            card.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
            grid.appendChild(card);
        });
    }
    function renderSounds() {
        const grid = $('mpSounds');
        const sounds = (state.shared && state.shared.soundboard) || [];
        if (!sounds.length) { grid.innerHTML = '<p class="muted-note">No sounds yet.</p>'; return; }
        grid.innerHTML = '';
        sounds.forEach(s => {
            const pad = document.createElement('div');
            pad.className = 'sb-pad';
            pad.dataset.cat = (s.category || 'Custom').toLowerCase();
            pad.tabIndex = 0;
            pad.innerHTML = `<span class="sb-emoji">${esc(s.icon || '🔊')}</span><span class="sb-name">${esc(s.name)}</span><span class="sb-cat">${esc(s.category || 'Custom')}</span>`;
            const go = () => { pad.classList.remove('hit'); void pad.offsetWidth; pad.classList.add('hit'); send({ type: 'sound', id: s.id, name: s.name }, `Played "${s.name}"`); };
            pad.addEventListener('click', go);
            pad.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
            grid.appendChild(pad);
        });
    }
    function renderOnline() {
        const pill = $('mpOnline');
        pill.textContent = state.online ? '● Streamer online' : '● Streamer offline';
        pill.className = 'mp-pill ' + (state.online ? 'ok' : 'off');
        $('mpOffline').style.display = state.online ? 'none' : 'block';
    }

    // ---------- Send actions to the streamer ----------
    let sending = false;
    async function send(action, okText) {
        if (sending) return;
        if (!state.online) { toast("The streamer's dashboard is offline, so nothing was sent.", true); return; }
        sending = true;
        try {
            const d = await api('', { method: 'POST', body: JSON.stringify({ op: 'relay', channel: state.channel, action }) });
            state.online = !!d.streamerOnline; renderOnline();
            toast('✓ ' + okText);
        } catch (e) {
            toast(e.message, true);
        } finally {
            setTimeout(() => { sending = false; }, 400);
        }
    }

    // ---------- Load a channel ----------
    async function loadChannel(ch, quiet) {
        try {
            const d = await api('?channel=' + encodeURIComponent(ch));
            const changed = JSON.stringify(d.shared) !== JSON.stringify(state.shared);
            state.channel = ch; state.shared = d.shared || {}; state.online = !!d.streamerOnline;
            localStorage.setItem('lf_mod_last_channel', ch);
            if (changed) { applyTheme(state.shared.theme); renderDeck(); renderSounds(); }
            renderOnline();
            $('mpBody').style.display = 'none';
            $('mpMain').style.display = '';
            document.title = `Mod Panel · ${ch} - LightFeed`;
        } catch (e) {
            if (!quiet) showMessage(`<i class="fa-solid fa-lock"></i>${esc(e.message)}`);
        }
    }
    function startRefresh() {
        clearInterval(state.refreshTimer);
        state.refreshTimer = setInterval(() => { if (state.channel) { loadChannel(state.channel, true); refreshModState(); } }, 30000);
    }

    // ---------- Mod Desk (mod's own Twitch powers) ----------
    async function helixCtx() {
        if (state.helix && state.helix.channel === state.channel) return state.helix;
        const v = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: 'OAuth ' + token } }).then(r => r.json());
        const u = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(state.channel)}`, {
            headers: { 'Client-ID': v.client_id, Authorization: 'Bearer ' + token }
        }).then(r => r.json());
        const b = u.data && u.data[0];
        if (!b) throw new Error("Couldn't find that channel on Twitch.");
        state.helix = { channel: state.channel, clientId: v.client_id, modId: v.user_id, bId: b.id };
        return state.helix;
    }
    async function helix(method, path, body) {
        const h = await helixCtx();
        const sep = path.includes('?') ? '&' : '?';
        const r = await fetch(`https://api.twitch.tv/helix/${path}${sep}broadcaster_id=${h.bId}&moderator_id=${h.modId}`, {
            method, headers: Object.assign({ 'Client-ID': h.clientId, Authorization: 'Bearer ' + token }, body ? { 'Content-Type': 'application/json' } : {}),
            body: body ? JSON.stringify(body) : undefined
        });
        if (r.status === 204) return {};
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
            if (r.status === 401 || r.status === 403) throw new Error(`You need to be a mod in ${state.channel}'s Twitch chat for this. If you are, log out and back in to LightFeed.`);
            throw new Error(d.message || 'Twitch said no.');
        }
        return d;
    }
    function setPill(id, on, label) { const p = $(id); if (!p) return; p.textContent = label || (on ? 'ON' : 'OFF'); p.classList.toggle('on', !!on); }
    async function refreshModState() {
        try {
            const d = await helix('GET', 'chat/settings');
            const s = (d.data || [])[0];
            if (!s) return;
            setPill('stEmote', s.emote_mode); setPill('stSub', s.subscriber_mode);
            setPill('stSlow', s.slow_mode, s.slow_mode ? `ON · ${s.slow_mode_wait_time}s` : 'OFF');
        } catch (e) { ['stEmote', 'stSlow', 'stSub'].forEach(id => setPill(id, false, '—')); }
    }
    function wireModDesk() {
        document.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', async () => {
            const [key, val] = b.dataset.set.split(':');
            const body = { [key]: val === 'true' };
            if (key === 'slow_mode' && val === 'true') body.slow_mode_wait_time = parseInt($('mpSlowSec').value, 10);
            try { await helix('PATCH', 'chat/settings', body); toast('✓ Chat settings updated'); refreshModState(); } catch (e) { toast(e.message, true); }
        }));
        $('mpTimeout').addEventListener('click', async () => {
            const login = $('mpToUser').value.trim().replace(/^@/, '').toLowerCase();
            if (!login) return toast('Type a username first.', true);
            try {
                const h = await helixCtx();
                const u = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, { headers: { 'Client-ID': h.clientId, Authorization: 'Bearer ' + token } }).then(r => r.json());
                const user = u.data && u.data[0];
                if (!user) return toast(`No Twitch user called ${login}.`, true);
                await helix('POST', 'moderation/bans', { data: { user_id: user.id, duration: parseInt($('mpToDur').value, 10), reason: `Timed out by ${state.me} via LightFeed` } });
                toast(`✓ ${login} timed out`); $('mpToUser').value = '';
            } catch (e) { toast(e.message, true); }
        });
        $('mpClear').addEventListener('click', async () => {
            if (!confirm(`Clear ALL messages in ${state.channel}'s chat? This can't be undone.`)) return;
            try { await helix('DELETE', 'moderation/chat'); toast('✓ Chat cleared'); } catch (e) { toast(e.message, true); }
        });
    }

    // ---------- Games ----------
    function wireGames() {
        $('mpPollStart').addEventListener('click', () => {
            const q = $('mpPollQ').value.trim();
            const opts = $('mpPollO').value.split(',').map(s => s.trim()).filter(Boolean);
            if (!q || opts.length < 2) return toast('Add a question and at least 2 options.', true);
            send({ type: 'poll_start', question: q, options: opts }, 'Poll started');
        });
        $('mpPollEnd').addEventListener('click', () => send({ type: 'poll_end' }, 'Poll ended'));
        $('mpGiveStart').addEventListener('click', () => send({ type: 'giveaway_start', keyword: $('mpGiveKey').value.trim() || '!win' }, 'Giveaway started'));
        $('mpGivePick').addEventListener('click', () => send({ type: 'giveaway_pick' }, 'Picking a winner'));
        $('mpGiveReset').addEventListener('click', () => send({ type: 'giveaway_reset' }, 'Giveaway reset'));
        $('mpTrivStart').addEventListener('click', () => {
            const q = $('mpTrivQ').value.trim(), a = $('mpTrivA').value.trim();
            if (!q || !a) return toast('Add a question and an answer.', true);
            send({ type: 'trivia', question: q, answer: a }, 'Trivia started');
        });
        $('mpHype').addEventListener('click', () => send({ type: 'hype' }, 'Hype Train fired'));
    }

    // ---------- Tabs ----------
    document.querySelectorAll('.mp-tab').forEach(t => t.addEventListener('click', () => {
        document.querySelectorAll('.mp-tab').forEach(x => x.classList.toggle('active', x === t));
        document.querySelectorAll('.mp-section').forEach(s => s.classList.toggle('active', s.id === 'sec-' + t.dataset.sec));
        if (t.dataset.sec === 'mod') refreshModState();
    }));

    // Remember to come back here after logging in
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-modlogin]')) localStorage.setItem('lf_after_login', 'mod');
    });

    // ---------- Start ----------
    async function start() {
        if (!token) {
            $('mpWho').textContent = 'NOT LOGGED IN';
            return showMessage('<i class="fa-brands fa-twitch"></i>Log in with your own Twitch account first.<br><br><a class="btn btn-primary" href="login.html" data-modlogin="1">Log in with Twitch</a>');
        }
        let managed;
        try { managed = await api('?managed=1'); }
        catch (e) {
            if (e.status === 401) return showMessage('<i class="fa-brands fa-twitch"></i>Your Twitch login has expired.<br><br><a class="btn btn-primary" href="login.html" data-modlogin="1">Log in again</a>');
            return showMessage(`<i class="fa-solid fa-triangle-exclamation"></i>${esc(e.message)}`);
        }
        state.me = managed.me;
        $('mpWho').textContent = 'LOGGED IN AS ' + state.me.toUpperCase();
        const chans = managed.channels || [];
        if (!chans.length) {
            return showMessage(`<i class="fa-solid fa-user-shield"></i>No streamer has added you as a LightFeed mod yet.<br><br>Ask them to add <code>${esc(state.me)}</code> on their <b>Mods</b> page, then refresh.`);
        }
        const sel = $('mpChannel');
        sel.innerHTML = chans.map(c => `<option value="${esc(c)}">Managing: ${esc(c)}</option>`).join('');
        const last = localStorage.getItem('lf_mod_last_channel');
        sel.value = chans.includes(last) ? last : chans[0];
        sel.addEventListener('change', () => { state.shared = null; state.helix = null; loadChannel(sel.value); });
        $('mpRight').style.display = '';
        wireGames(); wireModDesk();
        await loadChannel(sel.value);
        startRefresh();
    }
    start();
})();
