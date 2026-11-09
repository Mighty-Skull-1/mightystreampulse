// LightFeed mod access
// - Streamers add/remove mods (by Twitch username)
// - Streamers share their deck + soundboard list + theme so their mods see the same setup
// - Mods send actions (press a deck button, play a sound, run a poll...) which the
//   streamer's own dashboard picks up and runs from the streamer's bot
// Every request needs a Twitch token; we ask Twitch who it belongs to.
import { getStore } from '@netlify/blobs';

const MAX_MODS = 25;
const MAX_PENDING = 40;
const MAX_SHARED_BYTES = 400 * 1024;
const ACTIVE_WINDOW_MS = 3 * 60 * 1000;
const ACTION_TYPES = ['deck', 'sound', 'hype', 'poll_start', 'poll_end', 'giveaway_start', 'giveaway_pick', 'giveaway_reset', 'trivia'];

const json = (status, body) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});
const cleanLogin = (s) => (s || '').toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '').slice(0, 25);
const str = (v, n) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

async function whoAmI(req) {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^(Bearer|OAuth)\s+/i, '').replace(/^oauth:/i, '').trim();
    if (!token) return null;
    const r = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: 'OAuth ' + token } });
    if (!r.ok) return null;
    const d = await r.json();
    return { login: cleanLogin(d.login), clientId: d.client_id, token };
}

async function getJSON(store, key, fallback) {
    const v = await store.get(key, { type: 'json' });
    return v == null ? fallback : v;
}

function cleanAction(a) {
    if (!a || !ACTION_TYPES.includes(a.type)) return null;
    const out = { type: a.type };
    if (a.type === 'deck') { out.id = str(a.id, 80); out.title = str(a.title, 80); }
    if (a.type === 'sound') { out.id = str(a.id, 80); out.name = str(a.name, 80); }
    if (a.type === 'poll_start') {
        out.question = str(a.question, 200);
        out.options = (Array.isArray(a.options) ? a.options : []).map(o => str(o, 60)).filter(Boolean).slice(0, 6);
        if (!out.question || out.options.length < 2) return null;
    }
    if (a.type === 'giveaway_start') { out.keyword = str(a.keyword, 30) || '!win'; }
    if (a.type === 'trivia') {
        out.question = str(a.question, 200); out.answer = str(a.answer, 80);
        if (!out.question || !out.answer) return null;
    }
    return out;
}

export default async (req) => {
    const me = await whoAmI(req);
    if (!me || !me.login) return json(401, { error: 'Log in with Twitch again, then retry.' });

    const store = getStore({ name: 'team', consistency: 'strong' });
    const url = new URL(req.url);
    const now = Date.now();

    // ================= GET =================
    if (req.method === 'GET') {
        // Streamer: my mods + whether any are active
        if (url.searchParams.get('mine')) {
            const mods = await getJSON(store, `owner/${me.login}/mods`, []);
            const modBeat = await getJSON(store, `beat/${me.login}/mods`, {});
            return json(200, { owner: me.login, mods, modsActive: Object.values(modBeat).some(t => now - t < ACTIVE_WINDOW_MS), modBeat });
        }

        // Streamer: collect actions sent by mods
        if (url.searchParams.get('relay')) {
            await store.setJSON(`beat/${me.login}/streamer`, now);
            const { blobs } = await store.list({ prefix: `relay/${me.login}/` });
            const keys = blobs.map(b => b.key).sort();
            const actions = [];
            for (const k of keys) {
                const a = await getJSON(store, k, null);
                if (a) actions.push(a);
                await store.delete(k);
            }
            const modBeat = await getJSON(store, `beat/${me.login}/mods`, {});
            return json(200, { actions, modsActive: Object.values(modBeat).some(t => now - t < ACTIVE_WINDOW_MS) });
        }

        // Mod: which channels can I manage?
        if (url.searchParams.get('managed')) {
            const owners = await getJSON(store, `modof/${me.login}`, []);
            const valid = [];
            for (const o of owners) {
                const mods = await getJSON(store, `owner/${o}/mods`, []);
                if (mods.includes(me.login)) valid.push(o);
            }
            return json(200, { me: me.login, channels: valid });
        }

        // Mod: load a channel's shared setup
        const channel = cleanLogin(url.searchParams.get('channel'));
        if (channel) {
            const mods = await getJSON(store, `owner/${channel}/mods`, []);
            if (!mods.includes(me.login)) return json(403, { error: `You're not a LightFeed mod for ${channel}.` });
            const beat = await getJSON(store, `beat/${channel}/mods`, {});
            beat[me.login] = now;
            await store.setJSON(`beat/${channel}/mods`, beat);
            const shared = await getJSON(store, `owner/${channel}/shared`, {});
            const streamerBeat = await getJSON(store, `beat/${channel}/streamer`, 0);
            return json(200, { channel, me: me.login, shared, streamerOnline: now - streamerBeat < 90 * 1000 });
        }
        return json(400, { error: 'Bad request' });
    }

    // ================= POST =================
    if (req.method === 'POST') {
        let body;
        try { body = await req.json(); } catch (e) { return json(400, { error: 'Bad request' }); }
        const op = body && body.op;

        // Streamer adds a mod
        if (op === 'add_mod') {
            const login = cleanLogin(body.login);
            if (!login || login.length < 3) return json(400, { error: 'Type a Twitch username.' });
            if (login === me.login) return json(400, { error: "That's you! Add someone else." });
            // Make sure the account exists
            const u = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, {
                headers: { 'Client-ID': me.clientId, Authorization: 'Bearer ' + me.token }
            });
            if (u.ok) {
                const d = await u.json();
                if (!d.data || !d.data.length) return json(404, { error: `No Twitch account called "${login}".` });
            }
            const mods = await getJSON(store, `owner/${me.login}/mods`, []);
            if (!mods.includes(login)) {
                if (mods.length >= MAX_MODS) return json(409, { error: `You can have up to ${MAX_MODS} LightFeed mods.` });
                mods.push(login);
                await store.setJSON(`owner/${me.login}/mods`, mods);
            }
            const of = await getJSON(store, `modof/${login}`, []);
            if (!of.includes(me.login)) { of.push(me.login); await store.setJSON(`modof/${login}`, of); }
            return json(200, { mods });
        }

        // Streamer removes a mod
        if (op === 'remove_mod') {
            const login = cleanLogin(body.login);
            const mods = (await getJSON(store, `owner/${me.login}/mods`, [])).filter(m => m !== login);
            await store.setJSON(`owner/${me.login}/mods`, mods);
            const of = (await getJSON(store, `modof/${login}`, [])).filter(o => o !== me.login);
            await store.setJSON(`modof/${login}`, of);
            return json(200, { mods });
        }

        // Streamer shares their setup with their mods
        if (op === 'shared') {
            const raw = JSON.stringify(body.data || {});
            if (raw.length > MAX_SHARED_BYTES) return json(413, { error: 'Setup too large to share.' });
            const d = body.data || {};
            const shared = {
                deck: (Array.isArray(d.deck) ? d.deck : []).slice(0, 100).map(b => ({
                    id: str(b.id, 80), title: str(b.title, 80), category: str(b.category, 30), icon: str(b.icon, 60), message: str(b.message, 500)
                })),
                soundboard: (Array.isArray(d.soundboard) ? d.soundboard : []).slice(0, 100).map(s => ({
                    id: str(s.id, 80), name: str(s.name, 60), icon: str(s.icon, 16), category: str(s.category, 30)
                })),
                theme: d.theme && typeof d.theme === 'object' ? { primary: str(d.theme.primary, 9), accent: str(d.theme.accent, 9), bg: str(d.theme.bg, 20) } : null,
                updated: now
            };
            await store.setJSON(`owner/${me.login}/shared`, shared);
            return json(200, { ok: true });
        }

        // Mod sends an action to the streamer's dashboard
        if (op === 'relay') {
            const channel = cleanLogin(body.channel);
            const mods = await getJSON(store, `owner/${channel}/mods`, []);
            if (!mods.includes(me.login)) return json(403, { error: `You're not a LightFeed mod for ${channel}.` });
            const action = cleanAction(body.action);
            if (!action) return json(400, { error: 'That action isn\'t allowed.' });
            const { blobs } = await store.list({ prefix: `relay/${channel}/` });
            if (blobs.length >= MAX_PENDING) return json(429, { error: 'Slow down! The streamer\'s dashboard is catching up.' });
            const key = `relay/${channel}/${String(now).padStart(15, '0')}-${crypto.randomUUID().slice(0, 8)}`;
            await store.setJSON(key, { ...action, by: me.login, at: now });
            const beat = await getJSON(store, `beat/${channel}/mods`, {});
            beat[me.login] = now;
            await store.setJSON(`beat/${channel}/mods`, beat);
            const streamerBeat = await getJSON(store, `beat/${channel}/streamer`, 0);
            return json(200, { queued: true, streamerOnline: now - streamerBeat < 90 * 1000 });
        }

        return json(400, { error: 'Unknown request' });
    }

    return json(405, { error: 'Method not allowed' });
};
