// MightyStreamPulse custom alert sounds
// Stores each streamer's uploaded clips in Netlify Blobs, keyed by their Twitch login.
//
//   GET    /.netlify/functions/sounds?owner=<login>&id=<id>   -> the audio file (public, used by OBS)
//   GET    /.netlify/functions/sounds?list=1                  -> your uploads   (needs Twitch token)
//   POST   /.netlify/functions/sounds  (raw audio body)        -> upload          (needs Twitch token)
//   DELETE /.netlify/functions/sounds?id=<id>                 -> delete          (needs Twitch token)
import { getStore } from '@netlify/blobs';

const MAX_BYTES = 4 * 1024 * 1024;   // 4 MB per clip
const MAX_SOUNDS = 50;               // per streamer (alerts + soundboard)
const ALLOWED = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];

const json = (status, body) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});
const cleanLogin = (s) => (s || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 25);
const cleanId = (s) => (/^[a-f0-9]{32}$/.test(s || '') ? s : '');

async function twitchLogin(req) {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^(Bearer|OAuth)\s+/i, '').replace(/^oauth:/i, '').trim();
    if (!token) return null;
    const r = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: 'OAuth ' + token } });
    if (!r.ok) return null;
    const d = await r.json();
    return cleanLogin(d.login);
}

export default async (req) => {
    const store = getStore('alert-sounds');
    const url = new URL(req.url);

    // ---- Public playback (OBS overlay + dashboard) ----
    if (req.method === 'GET' && !url.searchParams.get('list')) {
        const owner = cleanLogin(url.searchParams.get('owner'));
        const id = cleanId(url.searchParams.get('id'));
        if (!owner || !id) return json(400, { error: 'Missing owner or id' });
        const hit = await store.getWithMetadata(`${owner}/${id}`, { type: 'arrayBuffer' });
        if (!hit) return json(404, { error: 'Sound not found' });
        return new Response(hit.data, {
            status: 200,
            headers: {
                'Content-Type': (hit.metadata && hit.metadata.type) || 'audio/mpeg',
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    const login = await twitchLogin(req);
    if (!login) return json(401, { error: 'Log in with Twitch again, then retry.' });

    // ---- List my uploads ----
    if (req.method === 'GET') {
        const { blobs } = await store.list({ prefix: `${login}/` });
        const items = [];
        for (const b of blobs) {
            const meta = await store.getMetadata(b.key);
            const id = b.key.split('/')[1];
            items.push({ id, name: (meta && meta.metadata && meta.metadata.name) || 'Sound', url: `/.netlify/functions/sounds?owner=${login}&id=${id}` });
        }
        return json(200, { owner: login, sounds: items });
    }

    // ---- Upload ----
    if (req.method === 'POST') {
        const type = (req.headers.get('content-type') || '').split(';')[0].toLowerCase();
        if (!ALLOWED.includes(type)) return json(415, { error: 'Please upload an audio file (mp3, wav, ogg, m4a).' });
        const buf = await req.arrayBuffer();
        if (!buf.byteLength) return json(400, { error: 'The file is empty.' });
        if (buf.byteLength > MAX_BYTES) return json(413, { error: 'That file is too big. Keep clips under 4 MB.' });
        const { blobs } = await store.list({ prefix: `${login}/` });
        if (blobs.length >= MAX_SOUNDS) return json(409, { error: `You can keep up to ${MAX_SOUNDS} sounds. Delete one first.` });

        const rawName = decodeURIComponent(req.headers.get('x-file-name') || 'Sound');
        const name = rawName.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[^\w\s\-'!().]/g, '').trim().slice(0, 40) || 'Sound';
        const id = crypto.randomUUID().replace(/-/g, '');
        await store.set(`${login}/${id}`, buf, { metadata: { name, type, size: buf.byteLength, created: Date.now() } });
        return json(200, { id, name, url: `/.netlify/functions/sounds?owner=${login}&id=${id}` });
    }

    // ---- Delete ----
    if (req.method === 'DELETE') {
        const id = cleanId(url.searchParams.get('id'));
        if (!id) return json(400, { error: 'Missing id' });
        await store.delete(`${login}/${id}`);
        return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
};
