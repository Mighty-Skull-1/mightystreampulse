// LightFeed shared helpers, used by the dashboard (app.js), the Mod Panel (mod.js)
// and the phone Stream Deck (streamdeck.js).
(function () {
    const LF = window.LF = window.LF || {};

    LF.esc = (t) => { const d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; };

    // ---------- Theme ----------
    const BGS = {
        charcoal: ['#09090b', '#121215', '#18181c', '#222228', '#27272f', '#3f3f4e'],
        midnight: ['#070b16', '#0d1324', '#121a30', '#19233d', '#1f2a44', '#33415f'],
        black: ['#000000', '#0a0a0a', '#111111', '#1a1a1a', '#222222', '#3a3a3a'],
        plum: ['#0d0710', '#150c1a', '#1c1022', '#26162e', '#2e1c38', '#4a2e5a']
    };
    function rgb(hex) { const n = parseInt((hex || '').replace('#', ''), 16); return isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    // Apply a shared theme ({ primary, accent, bg }) to the page
    LF.applyTheme = function (t) {
        if (!t) return;
        const r = document.documentElement.style;
        if (/^#[0-9a-f]{6}$/i.test(t.primary || '')) { r.setProperty('--primary', t.primary); r.setProperty('--primary-rgb', rgb(t.primary).join(', ')); }
        if (/^#[0-9a-f]{6}$/i.test(t.accent || '')) { r.setProperty('--accent', t.accent); r.setProperty('--accent-rgb', rgb(t.accent).join(', ')); }
        const b = BGS[t.bg];
        if (b) ['--bg-base', '--bg-surface', '--bg-card', '--bg-card-hover', '--border-subtle', '--border-bright'].forEach((v, i) => r.setProperty(v, b[i]));
    };

    // ---------- Quick Mod Desk engine (official Twitch Helix API) ----------
    // auth = { token, clientId, userId (the moderator), broadcasterId }
    // Returns { ok, message } on success. On failure: { ok:false, status, error, label } for Twitch
    // errors, { ok:false, message } for input problems, or { ok:false, unsupported:true }.
    async function helix(auth, method, path, body) {
        const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
            method,
            headers: Object.assign({ 'Client-ID': auth.clientId, 'Authorization': 'Bearer ' + auth.token }, body ? { 'Content-Type': 'application/json' } : {}),
            body: body ? JSON.stringify(body) : undefined
        });
        if (res.status === 204 || res.ok) return { ok: true, data: res.status === 204 ? null : await res.json().catch(() => null) };
        return { ok: false, status: res.status, error: await res.json().catch(() => ({})) };
    }
    async function userId(auth, login) {
        try {
            const clean = (login || '').trim().toLowerCase().replace('@', '');
            const r = await helix(auth, 'GET', `users?login=${encodeURIComponent(clean)}`);
            return (r.ok && r.data && r.data.data && r.data.data[0]) ? r.data.data[0].id : null;
        } catch (e) { return null; }
    }
    const ids = (auth) => `broadcaster_id=${auth.broadcasterId}&moderator_id=${auth.userId}`;
    async function patchSettings(auth, body, okMessage, label) {
        const r = await helix(auth, 'PATCH', `chat/settings?${ids(auth)}`, body);
        return r.ok ? { ok: true, message: okMessage } : { ok: false, status: r.status, error: r.error, label };
    }

    async function run(cmd, auth, extraParams) {
        extraParams = extraParams || {};
        const cleanCmd = (cmd || '').trim().toLowerCase();

        // 1. Clear Chat (/clear)
        if (cleanCmd === '/clear') {
            const r = await helix(auth, 'DELETE', `moderation/chat?${ids(auth)}`);
            return r.ok ? { ok: true, cleared: true, message: '🧹 Chat was cleared successfully on Twitch!' } : { ok: false, status: r.status, error: r.error, label: 'Clear Chat' };
        }

        // 2. Emote-Only Mode (/emoteonly and /emoteonlyoff)
        if (cleanCmd === '/emoteonly' || cleanCmd === '/emoteonlyoff') {
            const enabled = cleanCmd === '/emoteonly';
            return patchSettings(auth, { emote_mode: enabled }, enabled ? '😊 Emote-Only chat enabled on Twitch!' : '💬 Emote-Only chat disabled on Twitch!', 'Emote-Only Mode');
        }

        // 3. Slow Mode (/slow <seconds> and /slowoff)
        if (cleanCmd.startsWith('/slow') || cleanCmd === '/slowoff') {
            const enabled = cleanCmd !== '/slowoff';
            let seconds = 30;
            if (enabled) {
                const parts = cleanCmd.split(' ');
                if (parts.length > 1 && !isNaN(parseInt(parts[1], 10))) seconds = parseInt(parts[1], 10);
                else if (extraParams.seconds) seconds = parseInt(extraParams.seconds, 10);
            }
            return patchSettings(auth, enabled ? { slow_mode: true, slow_mode_wait_time: seconds } : { slow_mode: false },
                enabled ? `⏱️ Slow mode enabled (${seconds}s) on Twitch!` : '⚡ Slow mode disabled on Twitch!', 'Slow Mode');
        }

        // 4. Sub-Only Chat (/subscribers and /subscribersoff)
        if (cleanCmd === '/subscribers' || cleanCmd === '/subscribersoff' || cleanCmd === '/subonly' || cleanCmd === '/subonlyoff') {
            const enabled = cleanCmd === '/subscribers' || cleanCmd === '/subonly';
            return patchSettings(auth, { subscriber_mode: enabled }, enabled ? '⭐ Sub-Only chat enabled on Twitch!' : '⭐ Sub-Only chat disabled on Twitch!', 'Sub-Only Chat');
        }

        // 5. Follower-Only Chat (/followers <duration> and /followersoff)
        if (cleanCmd.startsWith('/followers') || cleanCmd === '/followersoff') {
            const enabled = cleanCmd !== '/followersoff';
            let durationMin = 0;
            if (enabled) { const m = cleanCmd.match(/\/followers\s+(\d+)/); if (m) durationMin = parseInt(m[1], 10); }
            return patchSettings(auth, enabled ? { follower_mode: true, follower_mode_duration: durationMin } : { follower_mode: false },
                enabled ? `Follower-Only mode enabled (${durationMin}m) on Twitch!` : 'Follower-Only mode disabled on Twitch!', 'Follower-Only Mode');
        }

        // 6. User Timeout (/timeout <user> [duration] [reason])
        if (cleanCmd.startsWith('/timeout ') || extraParams.action === 'timeout') {
            let targetUser = extraParams.target || '';
            let durationSec = extraParams.duration ? parseInt(extraParams.duration, 10) : 600;
            let reason = extraParams.reason || 'Timed out via LightFeed';
            if (!targetUser && cleanCmd.startsWith('/timeout ')) {
                const parts = cmd.trim().split(/\s+/);
                targetUser = parts[1] ? parts[1].replace('@', '') : '';
                if (parts[2] && !isNaN(parseInt(parts[2], 10))) durationSec = parseInt(parts[2], 10);
                if (parts.length > 3) reason = parts.slice(3).join(' ');
            }
            if (!targetUser) return { ok: false, message: 'Please provide a username to timeout.' };
            const targetId = await userId(auth, targetUser);
            if (!targetId) return { ok: false, message: `Could not find Twitch user "${targetUser}". Check username spelling.` };
            const r = await helix(auth, 'POST', `moderation/bans?${ids(auth)}`, { data: { user_id: targetId, duration: durationSec, reason } });
            return r.ok ? { ok: true, message: `🚫 Timed out @${targetUser} for ${durationSec}s!` } : { ok: false, status: r.status, error: r.error, label: `Timeout @${targetUser}` };
        }

        // 7. Ban User (/ban <user> [reason])
        if (cleanCmd.startsWith('/ban ')) {
            const parts = cmd.trim().split(/\s+/);
            const targetUser = parts[1] ? parts[1].replace('@', '') : '';
            const reason = parts.length > 2 ? parts.slice(2).join(' ') : 'Banned via LightFeed';
            if (!targetUser) return { ok: false, message: 'Provide username to ban' };
            const targetId = await userId(auth, targetUser);
            if (!targetId) return { ok: false, message: `User "${targetUser}" not found.` };
            const r = await helix(auth, 'POST', `moderation/bans?${ids(auth)}`, { data: { user_id: targetId, reason } });
            return r.ok ? { ok: true, message: `🔨 Permanently banned @${targetUser} from channel!` } : { ok: false, status: r.status, error: r.error, label: `Ban @${targetUser}` };
        }

        // 8. Unban User (/unban <user>)
        if (cleanCmd.startsWith('/unban ')) {
            const parts = cmd.trim().split(/\s+/);
            const targetUser = parts[1] ? parts[1].replace('@', '') : '';
            if (!targetUser) return { ok: false, message: 'Provide username to unban' };
            const targetId = await userId(auth, targetUser);
            if (!targetId) return { ok: false, message: `User "${targetUser}" not found.` };
            const r = await helix(auth, 'DELETE', `moderation/bans?${ids(auth)}&user_id=${targetId}`);
            return r.ok ? { ok: true, message: `Unbanned @${targetUser}!` } : { ok: false, status: r.status, error: r.error, label: `Unban @${targetUser}` };
        }

        return { ok: false, unsupported: true };
    }

    // Current chat modes ({ emote_mode, slow_mode, slow_mode_wait_time, subscriber_mode, ... }) or null
    async function chatSettings(auth) {
        const r = await helix(auth, 'GET', `chat/settings?broadcaster_id=${auth.broadcasterId}`);
        return (r.ok && r.data && r.data.data && r.data.data[0]) || null;
    }

    // Friendly text for a failed run() result
    function errorText(r) {
        if (!r || r.ok) return '';
        if (r.message) return r.message;
        if (r.unsupported) return "That command isn't supported here.";
        const msg = (r.error && (r.error.message || r.error.error)) || 'Unknown Twitch API error';
        if (r.status === 401 || r.status === 403 || /scope/i.test(msg)) return `Twitch needs updated permissions for ${r.label}. Log out and back in to LightFeed.`;
        return `${r.label}: ${msg}`;
    }

    LF.moderation = { run, chatSettings, errorText };
})();
