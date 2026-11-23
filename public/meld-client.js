// LightFeed Meld Studio client
// Talks to Meld Studio's WebChannel API (Qt QWebChannel over a WebSocket, default port 13376).
// API reference: https://github.com/MeldStudio/streamdeck/blob/main/WebChannelAPI.md
//
// LFMeld.MiniWebChannel  - a small QWebChannel client (same wire protocol as Qt's qwebchannel.js)
// LFMeld.Connection      - connects to Meld, keeps scenes / audio tracks / stream state, reconnects on its own
(function () {
    const T = { signal: 1, propertyUpdate: 2, init: 3, idle: 4, debug: 5, invokeMethod: 6, connectToSignal: 7, disconnectFromSignal: 8, setProperty: 9, response: 10 };

    class QObj {
        constructor(name, data, channel) {
            this.__id__ = name;
            this._ch = channel;
            this._cache = {};
            this._cbs = {};
            (data.methods || []).forEach(([methodName, idx]) => {
                // Like Qt 6's qwebchannel.js: fully specified names go by index, plain names by name
                const invoked = String(methodName).endsWith(')') ? idx : methodName;
                this[methodName] = (...args) => new Promise((resolve) => {
                    channel.exec({ type: T.invokeMethod, object: name, method: invoked, args }, resolve);
                });
            });
            (data.properties || []).forEach(([idx, propName, notify, value]) => {
                this._cache[idx] = value;
                if (notify) {
                    let [sigName, sigIdx] = notify;
                    if (sigName === 1) sigName = propName + 'Changed'; // Qt shortens "<prop>Changed" to 1
                    this._addSignal(sigName, sigIdx, true);
                }
                Object.defineProperty(this, propName, { get: () => this._cache[idx], enumerable: true, configurable: true });
            });
            (data.signals || []).forEach(([sigName, sigIdx]) => this._addSignal(sigName, sigIdx, false));
        }
        _addSignal(sigName, sigIdx, isNotify) {
            if (this[sigName] && this[sigName].connect) return;
            this[sigName] = {
                connect: (fn) => {
                    const list = this._cbs[sigIdx] = this._cbs[sigIdx] || [];
                    list.push(fn);
                    // Property-change signals arrive with property updates; others must be subscribed
                    if (!isNotify && list.length === 1) this._ch.exec({ type: T.connectToSignal, object: this.__id__, signal: sigIdx });
                    return fn;
                },
                disconnect: (fn) => {
                    const list = this._cbs[sigIdx] || [];
                    const i = list.indexOf(fn);
                    if (i >= 0) list.splice(i, 1);
                    if (!isNotify && i >= 0 && !list.length) this._ch.exec({ type: T.disconnectFromSignal, object: this.__id__, signal: sigIdx });
                }
            };
        }
        _emit(sigIdx, args) {
            (this._cbs[sigIdx] || []).forEach((fn) => { try { fn.apply(null, args || []); } catch (e) { console.error('[Meld] signal handler error', e); } });
        }
        _propertyUpdate(signals, props) {
            for (const i in (props || {})) this._cache[i] = props[i];
            for (const s in (signals || {})) this._emit(s, signals[s]);
        }
    }

    class MiniWebChannel {
        constructor(socket, onReady) {
            this.socket = socket;
            this.callbacks = {};
            this.nextId = 0;
            this.objects = {};
            socket.addEventListener('message', (e) => {
                let msg;
                try { msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (err) { return; }
                this.handle(msg);
            });
            this.exec({ type: T.init }, (data) => {
                for (const name in (data || {})) this.objects[name] = new QObj(name, data[name], this);
                this.exec({ type: T.idle });
                onReady(this);
            });
        }
        exec(msg, cb) {
            if (cb) { msg.id = this.nextId++; this.callbacks[msg.id] = cb; }
            if (this.socket.readyState === 1) this.socket.send(JSON.stringify(msg));
        }
        handle(msg) {
            if (!msg) return;
            if (msg.type === T.response) {
                const cb = this.callbacks[msg.id];
                delete this.callbacks[msg.id];
                if (cb) cb(msg.data);
            } else if (msg.type === T.signal) {
                const o = this.objects[msg.object];
                if (o) o._emit(msg.signal, msg.args);
            } else if (msg.type === T.propertyUpdate) {
                (msg.data || []).forEach((u) => { const o = this.objects[u.object]; if (o) o._propertyUpdate(u.signals, u.properties); });
                this.exec({ type: T.idle });
            }
        }
    }

    // Turn what the user pastes into a WebSocket URL. Throws a friendly Error if it can't be used.
    function normalizeUrl(raw) {
        let u = (raw || '').trim();
        if (!u) return '';
        if (!/^[a-z]+:\/\//i.test(u)) u = 'wss://' + u;
        u = u.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
        let url;
        try { url = new URL(u); } catch (e) { throw new Error("That doesn't look like a web address."); }
        if (url.protocol !== 'wss:' && url.protocol !== 'ws:') throw new Error('Use the https:// or wss:// address from Cloudflare.');
        const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (url.protocol === 'ws:' && !local) throw new Error('Use the secure (https:// or wss://) tunnel address.');
        let out = url.toString();
        if (url.pathname === '/' && !url.search) out = out.replace(/\/$/, '');
        return out;
    }

    const BACKOFF = [1000, 2000, 4000, 8000, 15000];
    const OFFLINE_AFTER_MS = 60000;   // keep saying "reconnecting" for this long before "offline"
    const CONNECT_TIMEOUT_MS = 10000;

    class Connection {
        // opts.onChange(conn) is called whenever status or Meld state changes
        constructor(opts) {
            this.onChange = (opts && opts.onChange) || (() => {});
            this.url = '';
            this.status = 'offline';      // connected | reconnecting | offline
            this.reason = 'No tunnel address set.';
            this.attempt = 0;
            this.meld = null;
            this.socket = null;
            this.retryTimer = null;
            this.timeoutTimer = null;
            this.lostAt = 0;
            this.scenes = []; this.tracks = []; this.isStreaming = false; this.isRecording = false;
            window.addEventListener('online', () => this.kick());
            window.addEventListener('offline', () => { if (this.url) this._drop('Your phone is offline.'); });
            document.addEventListener('visibilitychange', () => { if (!document.hidden) this.kick(); });
        }

        setUrl(url) {
            this.url = url || '';
            this._teardown();
            this.attempt = 0;
            this.lostAt = Date.now();
            if (!this.url) { this._set('offline', 'No tunnel address set.'); return; }
            this._open();
        }

        // Reconnect right away if we're not connected (e.g. phone woke up)
        kick() {
            if (!this.url || this.status === 'connected') return;
            if (this.socket && this.socket.readyState === 0) return;
            clearTimeout(this.retryTimer);
            this._open();
        }

        _set(status, reason) {
            this.status = status; this.reason = reason || '';
            this.onChange(this);
        }

        _teardown() {
            clearTimeout(this.retryTimer); clearTimeout(this.timeoutTimer);
            if (this.socket) {
                const s = this.socket; this.socket = null;
                s.onopen = s.onclose = s.onerror = null;
                try { s.close(); } catch (e) {}
            }
            this.meld = null;
        }

        _open() {
            this._teardown();
            if (!navigator.onLine) { this._drop('Your phone is offline.'); return; }
            this.attempt++;
            if (this.status !== 'connected') this._set(this._failingTooLong() ? 'offline' : 'reconnecting', this.attempt > 1 ? `Trying again (attempt ${this.attempt})…` : 'Connecting to Meld…');
            let socket;
            try { socket = new WebSocket(this.url); } catch (e) { this._drop("Couldn't open that address."); return; }
            this.socket = socket;
            this.timeoutTimer = setTimeout(() => { if (this.socket === socket) this._drop('Meld did not answer in time.'); }, CONNECT_TIMEOUT_MS);
            socket.onopen = () => {
                new MiniWebChannel(socket, (channel) => {
                    if (this.socket !== socket) return;
                    const meld = channel.objects.meld;
                    if (!meld) { this._drop("Connected, but this isn't Meld's WebChannel."); return; }
                    clearTimeout(this.timeoutTimer);
                    this.meld = meld;
                    this.attempt = 0;
                    const refresh = () => { if (this.meld === meld) { this._read(); this.onChange(this); } };
                    ['sessionChanged', 'isStreamingChanged', 'isRecordingChanged'].forEach((s) => { if (meld[s]) meld[s].connect(refresh); });
                    this._read();
                    this._set('connected', 'Connected to Meld Studio.');
                });
            };
            socket.onerror = () => { /* onclose follows */ };
            socket.onclose = () => { if (this.socket === socket) this._drop(this.status === 'connected' ? 'Lost the connection to Meld.' : "Couldn't reach Meld through the tunnel."); };
        }

        _failingTooLong() { return this.lostAt && Date.now() - this.lostAt > OFFLINE_AFTER_MS; }

        _drop(reason) {
            const wasConnected = this.status === 'connected';
            this._teardown();
            if (wasConnected) this.lostAt = Date.now();
            if (!this.url) { this._set('offline', 'No tunnel address set.'); return; }
            const offline = !navigator.onLine || this._failingTooLong();
            this._set(offline ? 'offline' : 'reconnecting', reason);
            const wait = BACKOFF[Math.min(this.attempt, BACKOFF.length - 1)];
            this.retryTimer = setTimeout(() => this._open(), wait);
        }

        _read() {
            const m = this.meld;
            const items = (m && m.session && m.session.items) || {};
            const scenes = [], tracks = [];
            Object.keys(items).forEach((id) => {
                const it = items[id] || {};
                if (it.type === 'scene') scenes.push({ id, name: it.name || 'Scene', index: it.index || 0, current: !!it.current, staged: !!it.staged });
                else if (it.type === 'track') tracks.push({ id, name: it.name || 'Audio', muted: !!it.muted, global: !it.parent });
            });
            scenes.sort((a, b) => a.index - b.index);
            tracks.sort((a, b) => (b.global - a.global) || a.name.localeCompare(b.name));
            this.scenes = scenes; this.tracks = tracks;
            this.isStreaming = !!(m && m.isStreaming);
            this.isRecording = !!(m && m.isRecording);
        }

        // Call a Meld method, e.g. call('showScene', id)
        call(method, ...args) {
            if (!this.meld || typeof this.meld[method] !== 'function') return Promise.reject(new Error('Not connected to Meld.'));
            return this.meld[method](...args);
        }
    }

    window.LFMeld = { MiniWebChannel, Connection, normalizeUrl };
})();
