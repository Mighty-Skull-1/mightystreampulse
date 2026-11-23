// LightFeed Stream Deck connection
// Talks straight from the phone to the streamer's own streaming app, through a tunnel
// (Cloudflare Tunnel) to the app's remote-control WebSocket:
//   Meld Studio        - WebChannel API (Qt QWebChannel), port 13376, no password
//                        https://github.com/MeldStudio/streamdeck/blob/main/WebChannelAPI.md
//   OBS Studio         - obs-websocket 5, port 4455, password
//                        https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
//   Streamlabs Desktop - Remote Control API (JSON-RPC over SockJS), port 59650, API token
//                        https://streamlabs.github.io/streamlabs-desktop-api-docs/docs/index.html
// Passwords and tokens stay on the phone. They are only sent to the app itself, never to LightFeed.
//
// LFDeck.Connection keeps one normalised picture of the app:
//   scenes  [{ id, name, current }]
//   tracks  [{ id, name, muted, global, layerId, sceneId }]
//   layers  [{ id, name, sceneId, visible, kind }]          kind: camera | browser | media | image | other
//   effects [{ id, name, layerId, enabled }]
//   isStreaming, isRecording
// and the same actions for every app: showScene, setMute, setLayer, setEffect, stream, record, run.
(function () {
    const APPS = {
        meld: { key: 'meld', name: 'Meld Studio', short: 'Meld', port: 13376, secret: '' },
        obs: { key: 'obs', name: 'OBS Studio', short: 'OBS', port: 4455, secret: 'OBS WebSocket password' },
        streamlabs: { key: 'streamlabs', name: 'Streamlabs Desktop', short: 'Streamlabs', port: 59650, secret: 'Streamlabs API token' }
    };
    // What each app can do from the deck (sound / chat / wait go through LightFeed and work everywhere)
    const CAPS = {
        meld: ['scene', 'mute', 'layer', 'effect', 'record', 'stream', 'clip', 'screenshot', 'vcam', 'marker'],
        obs: ['scene', 'mute', 'layer', 'effect', 'record', 'stream', 'clip', 'vcam', 'marker'],
        streamlabs: ['scene', 'mute', 'layer', 'record', 'stream', 'clip']
    };

    class FatalError extends Error {}   // wrong password etc.: stop retrying until settings change
    const fatal = (msg) => new FatalError(msg);
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const byName = (a, b) => a.name.localeCompare(b.name);

    // ======================================================================
    // Meld Studio: a small QWebChannel client (same wire protocol as Qt's qwebchannel.js)
    // ======================================================================
    const T = { signal: 1, propertyUpdate: 2, init: 3, idle: 4, invokeMethod: 6, connectToSignal: 7, disconnectFromSignal: 8, response: 10 };

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
                }
            };
        }
        _emit(sigIdx, args) {
            (this._cbs[sigIdx] || []).forEach((fn) => { try { fn.apply(null, args || []); } catch (e) { console.error('[Deck] signal handler error', e); } });
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

    function meldLayerKind(it) {
        if ('backgroundEffectEnabled' in it) return 'camera';   // only camera layers have this
        if (it.url) return 'browser';
        if (it.mediaSource) return 'media';
        if (it.source) return 'image';
        return 'other';
    }

    class MeldDriver {
        constructor(conn) { this.conn = conn; this.meld = null; }
        wsUrl(base) { return base; }
        // Resolves once Meld has sent its state
        start(socket) {
            return new Promise((resolve, reject) => {
                const channel = new MiniWebChannel(socket, (ch) => {
                    const meld = ch.objects.meld;
                    if (!meld) { reject(fatal("Connected, but that address isn't Meld Studio's WebChannel. Check the app you picked in settings.")); return; }
                    this.meld = meld;
                    ['sessionChanged', 'isStreamingChanged', 'isRecordingChanged'].forEach((s) => { if (meld[s]) meld[s].connect(() => this.read()); });
                    this.read(true);
                    resolve();
                });
                this.onMessage = (data) => { let m; try { m = JSON.parse(data); } catch (e) { return; } channel.handle(m); };
            });
        }
        read(quiet) {
            const m = this.meld;
            const items = (m && m.session && m.session.items) || {};
            const scenes = [], tracks = [], layers = [], effects = [];
            Object.keys(items).forEach((id) => {
                const it = items[id] || {};
                if (it.type === 'scene') scenes.push({ id, name: it.name || 'Scene', index: it.index || 0, current: !!it.current });
                else if (it.type === 'track') tracks.push({ id, name: it.name || 'Audio', muted: !!it.muted, global: !it.parent, layerId: it.parent || '', sceneId: '' });
                else if (it.type === 'layer') layers.push({ id, name: it.name || 'Layer', sceneId: it.parent || '', index: it.index || 0, visible: !!it.visible, kind: meldLayerKind(it) });
                else if (it.type === 'effect') effects.push({ id, name: it.name || 'Effect', layerId: it.parent || '', enabled: !!it.enabled });
            });
            scenes.sort((a, b) => a.index - b.index);
            layers.sort((a, b) => a.index - b.index);
            tracks.forEach(t => { const l = layers.find(x => x.id === t.layerId); if (l) t.sceneId = l.sceneId; });
            this.conn._update({ scenes, tracks, layers, effects, isStreaming: !!(m && m.isStreaming), isRecording: !!(m && m.isRecording) }, quiet);
        }
        call(method, ...args) {
            if (!this.meld || typeof this.meld[method] !== 'function') return Promise.reject(new Error('Not connected to Meld.'));
            return this.meld[method](...args);
        }
        showScene(s) { return this.call('showScene', s.id); }
        setMute(t, want) { return t.muted === want ? null : this.call('toggleMute', t.id); }
        setLayer(l, want) { return l.visible === want ? null : this.call('toggleLayer', l.sceneId, l.id); }
        setEffect(e, want, l) { return e.enabled === want ? null : this.call('toggleEffect', l.sceneId, l.id, e.id); }
        stream(mode) { return mode === 'toggle' ? this.call('toggleStream') : this.call('sendCommand', mode === 'start' ? 'meld.startStreamingAction' : 'meld.stopStreamingAction'); }
        record(mode) { return this.call('sendCommand', { start: 'meld.startRecordingAction', stop: 'meld.stopRecordingAction' }[mode] || 'meld.toggleRecordingAction'); }
        run(kind) {
            const c = { clip: 'meld.recordClip', screenshot: 'meld.screenshot', vcam: 'meld.toggleVirtualCameraAction', marker: 'meld.insertRecordingChapterMarker' }[kind];
            return this.call('sendCommand', c);
        }
        closeInfo() { return null; }
    }

    // ======================================================================
    // OBS Studio: obs-websocket 5
    // ======================================================================
    const OBS_OP = { hello: 0, identify: 1, identified: 2, event: 5, request: 6, response: 7 };
    // Scenes (4) | Inputs (8) | Filters (32) | Outputs (64) | SceneItems (128)
    const OBS_EVENTS = 4 | 8 | 32 | 64 | 128;
    const OBS_REFRESH_ON = ['SceneCreated', 'SceneRemoved', 'SceneNameChanged', 'SceneListChanged', 'InputCreated', 'InputRemoved', 'InputNameChanged',
        'SceneItemCreated', 'SceneItemRemoved', 'SceneItemListReindexed', 'SourceFilterCreated', 'SourceFilterRemoved', 'SourceFilterNameChanged',
        'CurrentSceneCollectionChanged', 'ReplayBufferStateChanged'];

    async function sha256b64(text) {
        if (!(window.crypto && crypto.subtle)) throw fatal('This browser cannot sign in to OBS (it needs a secure https page).');
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        let s = ''; new Uint8Array(buf).forEach(b => { s += String.fromCharCode(b); });
        return btoa(s);
    }
    function obsKind(inputKind, sourceType) {
        const k = String(inputKind || '');
        if (sourceType === 'OBS_SOURCE_TYPE_SCENE') return 'other';
        if (/dshow_input|av_capture_input|v4l2_input|camera|webcam/i.test(k)) return 'camera';
        if (/browser_source/.test(k)) return 'browser';
        if (/ffmpeg_source|vlc_source|media/.test(k)) return 'media';
        if (/image_source|slideshow/.test(k)) return 'image';
        return 'other';
    }

    class ObsDriver {
        constructor(conn, secret) {
            this.conn = conn; this.secret = secret || ''; this.socket = null;
            this.pending = {}; this.nextId = 1; this.replay = false;
            this.refreshTimer = null;
        }
        wsUrl(base) { return base; }
        get protocols() { return ['obswebsocket.json']; }
        start(socket) {
            this.socket = socket;
            return new Promise((resolve, reject) => {
                this.onMessage = async (data) => {
                    let m; try { m = JSON.parse(data); } catch (e) { return; }
                    const d = m.d || {};
                    if (m.op === OBS_OP.hello) {
                        const ident = { rpcVersion: 1, eventSubscriptions: OBS_EVENTS };
                        this.conn.warning = d.authentication ? '' : 'OBS has no WebSocket password, so anyone with your tunnel address can control OBS. Turn on "Enable Authentication" in OBS.';
                        if (d.authentication) {
                            if (!this.secret) { reject(fatal('OBS needs its WebSocket password. Add it in settings.')); return; }
                            try { ident.authentication = await sha256b64((await sha256b64(this.secret + d.authentication.salt)) + d.authentication.challenge); }
                            catch (e) { reject(e); return; }
                        }
                        this.send(OBS_OP.identify, ident);
                    } else if (m.op === OBS_OP.identified) {
                        try { await this.refresh(true); resolve(); } catch (e) { reject(e); }
                    } else if (m.op === OBS_OP.response) {
                        const p = this.pending[d.requestId];
                        if (!p) return;
                        delete this.pending[d.requestId];
                        const st = d.requestStatus || {};
                        if (st.result) p.resolve(d.responseData || {});
                        else { const e = new Error(st.comment || `OBS said no (code ${st.code}).`); e.code = st.code; p.reject(e); }
                    } else if (m.op === OBS_OP.event) this.onEvent(d.eventType, d.eventData || {});
                };
            });
        }
        send(op, d) { if (this.socket && this.socket.readyState === 1) this.socket.send(JSON.stringify({ op, d })); }
        req(requestType, requestData) {
            return new Promise((resolve, reject) => {
                const requestId = 'r' + (this.nextId++);
                this.pending[requestId] = { resolve, reject };
                this.send(OBS_OP.request, { requestType, requestId, requestData: requestData || {} });
                setTimeout(() => { if (this.pending[requestId]) { delete this.pending[requestId]; reject(new Error('OBS did not answer.')); } }, 10000);
            });
        }
        async refresh(quiet) {
            const [sceneList, inputList, special, streamSt, recSt, replaySt] = await Promise.all([
                this.req('GetSceneList'), this.req('GetInputList'), this.req('GetSpecialInputs').catch(() => ({})),
                this.req('GetStreamStatus').catch(() => ({})), this.req('GetRecordStatus').catch(() => ({})), this.req('GetReplayBufferStatus').catch(() => null)
            ]);
            this.replay = !!(replaySt && replaySt.outputActive);
            // OBS lists scenes bottom-up; show them in the same order as the OBS window
            const rawScenes = (sceneList.scenes || []).slice().sort((a, b) => b.sceneIndex - a.sceneIndex);
            const scenes = rawScenes.map(s => ({ id: s.sceneName, name: s.sceneName, current: s.sceneName === sceneList.currentProgramSceneName }));
            const items = await Promise.all(rawScenes.map(s => this.req('GetSceneItemList', { sceneName: s.sceneName }).catch(() => ({ sceneItems: [] }))));
            const layers = [];
            rawScenes.forEach((s, i) => {
                (items[i].sceneItems || []).slice().sort((a, b) => b.sceneItemIndex - a.sceneItemIndex).forEach(it => layers.push({
                    id: `${s.sceneName}::${it.sceneItemId}`, name: it.sourceName || 'Source', sceneId: s.sceneName, itemId: it.sceneItemId,
                    source: it.sourceName, visible: !!it.sceneItemEnabled, kind: obsKind(it.inputKind, it.sourceType)
                }));
            });
            // Audio: every input that answers GetInputMute has audio
            const globalNames = Object.values(special || {}).filter(Boolean);
            const inputs = inputList.inputs || [];
            const mutes = await Promise.all(inputs.map(inp => this.req('GetInputMute', { inputName: inp.inputName }).then(r => r.inputMuted, () => null)));
            const tracks = [];
            inputs.forEach((inp, i) => {
                if (mutes[i] === null) return;
                const l = layers.find(x => x.source === inp.inputName);
                tracks.push({ id: inp.inputName, name: inp.inputName, muted: !!mutes[i], global: globalNames.includes(inp.inputName) || !l, layerId: l ? l.id : '', sceneId: l ? l.sceneId : '' });
            });
            tracks.sort((a, b) => (b.global - a.global) || byName(a, b));
            // Filters on video sources become effects
            const sources = [...new Set(layers.filter(l => l.kind !== 'other').map(l => l.source))].slice(0, 40);
            const filterLists = await Promise.all(sources.map(src => this.req('GetSourceFilterList', { sourceName: src }).then(r => r.filters || [], () => [])));
            const effects = [];
            sources.forEach((src, i) => filterLists[i].forEach(f => layers.filter(l => l.source === src).forEach(l => effects.push({
                id: `${l.id}::${f.filterName}`, name: f.filterName, layerId: l.id, source: src, enabled: !!f.filterEnabled
            }))));
            this.conn._update({ scenes, tracks, layers, effects, isStreaming: !!streamSt.outputActive, isRecording: !!recSt.outputActive }, quiet);
        }
        refreshSoon() {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = setTimeout(() => this.refresh().catch(() => {}), 400);
        }
        onEvent(type, d) {
            const c = this.conn;
            if (type === 'CurrentProgramSceneChanged') { c.scenes.forEach(s => { s.current = s.name === d.sceneName; }); c._changed(); }
            else if (type === 'InputMuteStateChanged') { const t = c.tracks.find(x => x.id === d.inputName); if (t) { t.muted = !!d.inputMuted; c._changed(); } }
            else if (type === 'SceneItemEnableStateChanged') { const l = c.layers.find(x => x.sceneId === d.sceneName && x.itemId === d.sceneItemId); if (l) { l.visible = !!d.sceneItemEnabled; c._changed(); } }
            else if (type === 'SourceFilterEnableStateChanged') { c.effects.filter(x => x.source === d.sourceName && x.name === d.filterName).forEach(x => { x.enabled = !!d.filterEnabled; }); c._changed(); }
            else if (type === 'StreamStateChanged') { c.isStreaming = !!d.outputActive; c._changed(); }
            else if (type === 'RecordStateChanged') { c.isRecording = !!d.outputActive; c._changed(); }
            else if (type === 'ReplayBufferStateChanged') { this.replay = !!d.outputActive; }
            else if (OBS_REFRESH_ON.includes(type)) this.refreshSoon();
        }
        showScene(s) { return this.req('SetCurrentProgramScene', { sceneName: s.name }); }
        setMute(t, want) { return this.req('SetInputMute', { inputName: t.id, inputMuted: want }); }
        setLayer(l, want) { return this.req('SetSceneItemEnabled', { sceneName: l.sceneId, sceneItemId: l.itemId, sceneItemEnabled: want }); }
        setEffect(e, want) { return this.req('SetSourceFilterEnabled', { sourceName: e.source, filterName: e.name, filterEnabled: want }); }
        stream(mode) { return this.req({ start: 'StartStream', stop: 'StopStream' }[mode] || 'ToggleStream'); }
        record(mode) { return this.req({ start: 'StartRecord', stop: 'StopRecord' }[mode] || 'ToggleRecord'); }
        async run(kind) {
            if (kind === 'clip') {
                if (!this.replay) throw new Error('Turn on the Replay Buffer in OBS first (Start Replay Buffer).');
                return this.req('SaveReplayBuffer');
            }
            if (kind === 'vcam') return this.req('ToggleVirtualCam');
            if (kind === 'marker') return this.req('CreateRecordChapter').catch(() => { throw new Error('Chapter markers need OBS 30.2+ recording to Hybrid MP4.'); });
            throw new Error("OBS can't do that from the deck.");
        }
        closeInfo(ev) {
            if (ev.code === 4009) return fatal('Wrong OBS WebSocket password. Fix it in settings.');
            if (ev.code === 4010) return fatal('Your OBS WebSocket is too old. Update OBS to version 28 or newer.');
            if (ev.code >= 4000 && ev.reason) return new Error('OBS closed the connection: ' + ev.reason);
            return null;
        }
        stop() { clearTimeout(this.refreshTimer); Object.values(this.pending).forEach(p => p.reject(new Error('Disconnected.'))); this.pending = {}; }
    }

    // ======================================================================
    // Streamlabs Desktop: JSON-RPC over SockJS (websocket transport)
    // ======================================================================
    const SL_EVENTS = [
        ['ScenesService', 'sceneSwitched'], ['ScenesService', 'sceneAdded'], ['ScenesService', 'sceneRemoved'],
        ['ScenesService', 'itemAdded'], ['ScenesService', 'itemRemoved'], ['ScenesService', 'itemUpdated'],
        ['SourcesService', 'sourceAdded'], ['SourcesService', 'sourceRemoved'], ['SourcesService', 'sourceUpdated'],
        ['StreamingService', 'streamingStatusChange'], ['StreamingService', 'recordingStatusChange'], ['StreamingService', 'replayBufferStatusChange']
    ];
    function slKind(type) {
        const k = String(type || '');
        if (k === 'scene') return 'other';
        if (/dshow_input|av_capture_input|v4l2_input|camera/i.test(k)) return 'camera';
        if (/browser_source/.test(k)) return 'browser';
        if (/ffmpeg_source|vlc_source|media/.test(k)) return 'media';
        if (/image_source|slideshow/.test(k)) return 'image';
        return 'other';
    }
    const slOn = (status) => !!status && status !== 'offline';

    class StreamlabsDriver {
        constructor(conn, secret) {
            this.conn = conn; this.secret = (secret || '').trim(); this.socket = null;
            this.pending = {}; this.promises = {}; this.nextId = 1; this.replay = 'offline';
            this.refreshTimer = null; this.pollTimer = null;
        }
        // SockJS session URL: <base>/api/<server>/<session>/websocket
        wsUrl(base) {
            const server = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
            const session = Math.random().toString(36).slice(2, 10);
            return base.replace(/\/+$/, '') + `/api/${server}/${session}/websocket`;
        }
        start(socket) {
            this.socket = socket;
            return new Promise((resolve, reject) => {
                const ready = async () => {
                    if (!this.secret) { reject(fatal('Streamlabs needs its API token. Add it in settings.')); return; }
                    try {
                        await this.call('TcpServerService', 'auth', [this.secret]);
                    } catch (e) {
                        reject(/token|auth/i.test(e.message) ? fatal('Wrong Streamlabs API token. Copy it again from Settings > Remote Control.') : e);
                        return;
                    }
                    try {
                        await Promise.all(SL_EVENTS.map(([res, ev]) => this.call(res, ev, []).catch(() => null)));
                        await this.refresh(true);
                        this.pollTimer = setInterval(() => { if (!document.hidden) this.refresh().catch(() => {}); }, 20000);
                        resolve();
                    } catch (e) { reject(e); }
                };
                this.onMessage = (data) => {
                    const f = String(data);
                    if (f === 'o') { ready(); return; }
                    if (f[0] === 'h') return;
                    if (f[0] === 'c') { try { const [code, why] = JSON.parse(f.slice(1)); reject(new Error(`Streamlabs closed the connection (${why || code}).`)); } catch (e) {} return; }
                    if (f[0] !== 'a') return;
                    let list; try { list = JSON.parse(f.slice(1)); } catch (e) { return; }
                    list.forEach(chunk => String(chunk).split('\n').forEach(line => {
                        if (!line.trim()) return;
                        let m; try { m = JSON.parse(line); } catch (e) { return; }
                        this.handle(m);
                    }));
                };
            });
        }
        handle(m) {
            const r = m.result;
            if (m.id != null && this.pending[m.id]) {
                const p = this.pending[m.id]; delete this.pending[m.id];
                if (m.error) { p.reject(new Error((m.error && m.error.message) || 'Streamlabs said no.')); return; }
                // Async methods answer with a promise id, then an EVENT with the outcome
                if (r && r._type === 'SUBSCRIPTION' && r.emitter === 'PROMISE') {
                    this.promises[r.resourceId] = p;
                    setTimeout(() => { if (this.promises[r.resourceId]) { delete this.promises[r.resourceId]; p.resolve(null); } }, 15000);
                    return;
                }
                p.resolve(r);
                return;
            }
            if (r && r._type === 'EVENT') {
                if (r.emitter === 'PROMISE') {
                    const p = this.promises[r.resourceId]; if (!p) return;
                    delete this.promises[r.resourceId];
                    if (r.isRejected) p.reject(new Error((r.data && (r.data.message || r.data)) || 'Streamlabs said no.'));
                    else p.resolve(r.data);
                    return;
                }
                this.onEvent(r.resourceId, r.data);
            }
        }
        call(resource, method, args) {
            return new Promise((resolve, reject) => {
                const id = this.nextId++;
                this.pending[id] = { resolve, reject };
                const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params: { resource, args: args || [] } });
                if (this.socket && this.socket.readyState === 1) this.socket.send(JSON.stringify([msg]));
                setTimeout(() => { if (this.pending[id]) { delete this.pending[id]; reject(new Error('Streamlabs did not answer.')); } }, 10000);
            });
        }
        async refresh(quiet) {
            const [rawScenes, sources, audio, model] = await Promise.all([
                this.call('ScenesService', 'getScenes'), this.call('SourcesService', 'getSources').catch(() => []),
                this.call('AudioService', 'getSources').catch(() => []), this.call('StreamingService', 'getModel').catch(() => ({}))
            ]);
            let activeId = '';
            try { activeId = await this.call('ScenesService', 'activeSceneId'); } catch (e) {}
            if (typeof activeId !== 'string' || !activeId) { try { const a = await this.call('ScenesService', 'activeScene'); activeId = (a && a.id) || ''; } catch (e) {} }
            const sceneList = Array.isArray(rawScenes) ? rawScenes : [];
            const scenes = sceneList.map(s => ({ id: s.id, name: s.name || 'Scene', current: s.id === activeId }));
            const srcById = {}; (Array.isArray(sources) ? sources : []).forEach(s => { srcById[s.sourceId || s.id] = s; });
            const itemLists = await Promise.all(sceneList.map(s => this.call(s.resourceId || `Scene["${s.id}"]`, 'getItems').catch(() => [])));
            const layers = [];
            sceneList.forEach((s, i) => (Array.isArray(itemLists[i]) ? itemLists[i] : []).forEach(it => {
                const src = srcById[it.sourceId] || {};
                layers.push({ id: it.sceneItemId, name: it.name || src.name || 'Source', sceneId: s.id, sourceId: it.sourceId, res: it.resourceId, visible: !!it.visible, kind: slKind(src.type) });
            }));
            const tracks = (Array.isArray(audio) ? audio : []).map(a => {
                const src = srcById[a.sourceId] || {};
                const l = layers.find(x => x.sourceId === a.sourceId);
                return { id: a.sourceId, name: a.name || src.name || 'Audio', muted: !!a.muted, res: a.resourceId || `AudioSource["${a.sourceId}"]`, global: src.channel != null || !l, layerId: l ? l.id : '', sceneId: l ? l.sceneId : '' };
            }).sort((a, b) => (b.global - a.global) || byName(a, b));
            this.replay = model.replayBufferStatus || 'offline';
            this.conn._update({ scenes, tracks, layers, effects: [], isStreaming: slOn(model.streamingStatus), isRecording: slOn(model.recordingStatus) }, quiet);
        }
        refreshSoon() {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = setTimeout(() => this.refresh().catch(() => {}), 400);
        }
        onEvent(resourceId, data) {
            const c = this.conn;
            if (resourceId === 'ScenesService.sceneSwitched' && data && data.id) { c.scenes.forEach(s => { s.current = s.id === data.id; }); c._changed(); }
            else if (resourceId === 'StreamingService.streamingStatusChange') { c.isStreaming = slOn(data); c._changed(); return; }
            else if (resourceId === 'StreamingService.recordingStatusChange') { c.isRecording = slOn(data); c._changed(); return; }
            else if (resourceId === 'StreamingService.replayBufferStatusChange') { this.replay = data || 'offline'; return; }
            this.refreshSoon();
        }
        showScene(s) { return this.call('ScenesService', 'makeSceneActive', [s.id]); }
        setMute(t, want) { return this.call(t.res, 'setMuted', [want]).then(r => { t.muted = want; this.refreshSoon(); return r; }); }
        setLayer(l, want) { return this.call(l.res, 'setVisibility', [want]); }
        setEffect() { throw new Error("Streamlabs can't switch filters from the deck."); }
        stream(mode) { if ((mode === 'start' && this.conn.isStreaming) || (mode === 'stop' && !this.conn.isStreaming)) return null; return this.call('StreamingService', 'toggleStreaming'); }
        record(mode) { if ((mode === 'start' && this.conn.isRecording) || (mode === 'stop' && !this.conn.isRecording)) return null; return this.call('StreamingService', 'toggleRecording'); }
        run(kind) {
            if (kind === 'clip') {
                if (this.replay !== 'running') throw new Error('Start the Replay Buffer in Streamlabs first.');
                return this.call('StreamingService', 'saveReplay');
            }
            throw new Error("Streamlabs can't do that from the deck.");
        }
        closeInfo() { return null; }
        stop() {
            clearTimeout(this.refreshTimer); clearInterval(this.pollTimer);
            [...Object.values(this.pending), ...Object.values(this.promises)].forEach(p => p.reject(new Error('Disconnected.')));
            this.pending = {}; this.promises = {};
        }
    }

    const DRIVERS = { meld: MeldDriver, obs: ObsDriver, streamlabs: StreamlabsDriver };

    // ======================================================================
    // Address check: what the user pastes -> a WebSocket URL
    // ======================================================================
    function normalizeUrl(raw) {
        let u = (raw || '').trim();
        if (!u) return '';
        if (!/^[a-z]+:\/\//i.test(u)) u = 'wss://' + u;
        u = u.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
        let url;
        try { url = new URL(u); } catch (e) { throw new Error("That doesn't look like a web address."); }
        if (url.protocol !== 'wss:' && url.protocol !== 'ws:') throw new Error('Use the https:// or wss:// address from Cloudflare.');
        if (url.username || url.password) throw new Error("Don't put a password in the address. Use the password box instead.");
        const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (url.protocol === 'ws:' && !local) throw new Error('Use the secure (https:// or wss://) tunnel address.');
        let out = url.toString();
        if (url.pathname === '/' && !url.search) out = out.replace(/\/$/, '');
        return out;
    }

    // ======================================================================
    // The connection: picks the driver, reconnects on its own
    // ======================================================================
    const BACKOFF = [1000, 2000, 4000, 8000, 15000];
    const OFFLINE_AFTER_MS = 60000;   // keep saying "reconnecting" for this long before "offline"
    const CONNECT_TIMEOUT_MS = 12000;

    class Connection {
        // opts.onChange(conn) is called whenever status or app state changes
        constructor(opts) {
            this.onChange = (opts && opts.onChange) || (() => {});
            this.app = APPS.meld; this.url = ''; this.secret = '';
            this.status = 'offline';      // connected | reconnecting | offline
            this.reason = 'No tunnel address set.';
            this.stopped = false;         // true after a fatal error (wrong password...) until settings change or the user taps
            this.attempt = 0; this.socket = null; this.driver = null;
            this.retryTimer = null; this.timeoutTimer = null; this.lostAt = 0;
            this._clear();
            window.addEventListener('online', () => this.kick());
            window.addEventListener('offline', () => { if (this.url) this._drop(new Error('Your phone is offline.')); });
            document.addEventListener('visibilitychange', () => { if (!document.hidden) this.kick(); });
        }
        _clear() { this.scenes = []; this.tracks = []; this.layers = []; this.effects = []; this.isStreaming = false; this.isRecording = false; }
        get caps() { return CAPS[this.app.key]; }
        can(type) { return !CAPS.meld.includes(type) || this.caps.includes(type); }

        configure({ app, url, secret }) {
            this.app = APPS[app] || APPS.meld;
            this.warning = '';
            this.url = url || ''; this.secret = secret || '';
            this._teardown(); this._clear();
            this.status = 'offline';      // a new app/address starts from scratch
            this.attempt = 0; this.stopped = false; this.lostAt = Date.now();
            if (!this.url) { this._set('offline', 'No tunnel address set.'); return; }
            this._open();
        }

        // Reconnect right away if we're not connected (phone woke up, user tapped the status)
        kick(byUser) {
            if (!this.url || this.status === 'connected') return;
            if (this.stopped && !byUser) return;
            if (this.socket && this.socket.readyState === 0) return;
            this.stopped = false;
            clearTimeout(this.retryTimer);
            this._open();
        }

        _set(status, reason) { this.status = status; this.reason = reason || ''; this.onChange(this); }
        _changed() { if (this.status === 'connected') this.onChange(this); }
        _update(s, quiet) { Object.assign(this, s); if (!quiet) this._changed(); }

        _teardown() {
            clearTimeout(this.retryTimer); clearTimeout(this.timeoutTimer);
            if (this.driver && this.driver.stop) this.driver.stop();
            this.driver = null;
            if (this.socket) {
                const s = this.socket; this.socket = null;
                s.onopen = s.onclose = s.onerror = s.onmessage = null;
                try { s.close(); } catch (e) {}
            }
        }

        _open() {
            this._teardown();
            if (!navigator.onLine) { this._drop(new Error('Your phone is offline.')); return; }
            this.attempt++;
            const name = this.app.name;
            if (this.status !== 'connected') this._set(this._failingTooLong() ? 'offline' : 'reconnecting', this.attempt > 1 ? `Trying again (attempt ${this.attempt})…` : `Connecting to ${name}…`);
            const driver = new DRIVERS[this.app.key](this, this.secret);
            let socket;
            try { socket = driver.protocols ? new WebSocket(driver.wsUrl(this.url), driver.protocols) : new WebSocket(driver.wsUrl(this.url)); }
            catch (e) { this._drop(new Error("Couldn't open that address.")); return; }
            this.socket = socket; this.driver = driver;
            const mine = () => this.socket === socket;
            this.timeoutTimer = setTimeout(() => { if (mine()) this._drop(new Error(`${name} did not answer in time.`)); }, CONNECT_TIMEOUT_MS);
            socket.onmessage = (e) => { if (mine() && driver.onMessage) driver.onMessage(e.data); };
            socket.onopen = () => {
                driver.start(socket).then(() => {
                    if (!mine()) return;
                    clearTimeout(this.timeoutTimer);
                    this.attempt = 0;
                    this._set('connected', `Connected to ${name}.`);
                }, (err) => { if (mine()) this._drop(err); });
            };
            socket.onerror = () => { /* onclose follows */ };
            socket.onclose = (ev) => {
                if (!mine()) return;
                const info = driver.closeInfo(ev);
                this._drop(info || new Error(this.status === 'connected' ? `Lost the connection to ${name}.` : `Couldn't reach ${name} through the tunnel. Is the tunnel running, and is ${this.app.short} open with remote control turned on?`));
            };
        }

        _failingTooLong() { return this.lostAt && Date.now() - this.lostAt > OFFLINE_AFTER_MS; }

        _drop(err) {
            const wasConnected = this.status === 'connected';
            this._teardown();
            if (wasConnected) { this.lostAt = Date.now(); }
            if (!this.url) { this._set('offline', 'No tunnel address set.'); return; }
            if (err instanceof FatalError) { this.stopped = true; this._set('offline', err.message); return; }
            const offline = !navigator.onLine || this._failingTooLong();
            this._set(offline ? 'offline' : 'reconnecting', err.message);
            const wait = BACKOFF[Math.min(this.attempt, BACKOFF.length - 1)];
            this.retryTimer = setTimeout(() => this._open(), wait);
        }

        // ---------- Actions (want = true/false, or null/undefined to flip) ----------
        _need(type) {
            if (this.status !== 'connected' || !this.driver) throw new Error(`${this.app.short} is offline.`);
            if (type && !this.can(type)) throw new Error(`${this.app.short} can't do that from the deck.`);
        }
        async showScene(id) { this._need('scene'); const s = this.scenes.find(x => x.id === id); if (!s) throw new Error('That scene is gone.'); if (!s.current) await this.driver.showScene(s); }
        async setMute(id, want) { this._need('mute'); const t = this.tracks.find(x => x.id === id); if (!t) throw new Error('That audio source is gone.'); want = want == null ? !t.muted : !!want; if (t.muted !== want) await this.driver.setMute(t, want); }
        async setLayer(id, want) { this._need('layer'); const l = this.layers.find(x => x.id === id); if (!l) throw new Error('That layer is gone.'); want = want == null ? !l.visible : !!want; if (l.visible !== want) await this.driver.setLayer(l, want); }
        async setEffect(id, want) {
            this._need('effect');
            const e = this.effects.find(x => x.id === id); const l = e && this.layers.find(x => x.id === e.layerId);
            if (!e || !l) throw new Error('That effect is gone.');
            want = want == null ? !e.enabled : !!want;
            if (e.enabled !== want) await this.driver.setEffect(e, want, l);
        }
        async stream(mode) { this._need('stream'); await this.driver.stream(mode || 'toggle'); }
        async record(mode) { this._need('record'); await this.driver.record(mode || 'toggle'); }
        async run(kind) { this._need(kind); await this.driver.run(kind); }
    }

    window.LFDeck = { APPS, CAPS, Connection, normalizeUrl, sleep };
})();
