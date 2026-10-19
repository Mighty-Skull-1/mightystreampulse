// MightyStreamPulse Client Engine (Works BOTH locally with Node.js and publicly on Netlify / Vercel)
const defaultButtons = [
    { id: 'welcome', title: 'Welcome Chat', category: 'Greet', icon: 'fa-solid fa-hand', message: '👋 Welcome into the stream everyone! Make sure to say hi in chat and hit that follow button!' },
    { id: 'socials', title: 'Share Socials', category: 'Links', icon: 'fa-solid fa-share-nodes', message: '🌐 Follow my socials! Twitter: @YourHandle | YouTube: @YourChannel | TikTok: @YourStream' },
    { id: 'discord', title: 'Discord Squad', category: 'Links', icon: 'fa-brands fa-discord', message: '💬 Looking for people to game with? Join our Discord community here: https://discord.gg/yourserver' },
    { id: 'hype', title: 'Hype Wave', category: 'Hype', icon: 'fa-solid fa-fire', message: '🔥🔥🔥 HYPE IN THE CHAT! Drop your favorite emotes right now! LET\'S GOOO! 🔥🔥🔥' },
    { id: 'rules', title: 'Chat Rules', category: 'Mod', icon: 'fa-solid fa-shield-halved', message: '📜 Chat Rules: 1. Be respectful to all. 2. No hate speech or harassment. 3. No links or self promo.' },
    { id: 'hydrate', title: 'Hydrate Check', category: 'Gaming', icon: 'fa-solid fa-bottle-water', message: '💧 HYDRATE CHECK! Remember to drink water and do a quick stretch, chat fam!' },
    { id: 'gg', title: 'GG Big Play', category: 'Gaming', icon: 'fa-solid fa-trophy', message: '🏆 GG! What an insane play! Drop some GGs in chat!' },
    { id: 'prime', title: 'Prime Gaming Sub', category: 'Support', icon: 'fa-solid fa-crown', message: '👑 Did you know? You get a FREE channel subscription every month with Amazon Prime! Type !prime to support the stream!' }
];

const defaultTimers = [
    { id: 'timer-discord', name: 'Discord Reminder', message: '💬 Looking for friendly gamers to squad up with? Join our Discord community: https://discord.gg/yourserver', intervalMinutes: 15, enabled: false },
    { id: 'timer-hydrate', name: 'Hydrate & Stretch Reminder', message: '💧 Hydrate Check! Drink some water and take a quick posture stretch, chat!', intervalMinutes: 30, enabled: false },
    { id: 'timer-follow', name: 'Follow / Prime Sub Reminder', message: '⭐ Enjoying the stream? Don\'t forget to hit the follow button or link your Amazon Prime for a free sub!', intervalMinutes: 20, enabled: false }
];

const defaultCommands = {
    '!discord': '💬 Join our Discord community here: https://discord.gg/yourserver',
    '!socials': '🌐 Check out my socials: Twitter @yourname | YouTube @yourname | TikTok @yourname',
    '!rules': '📜 1. Be respectful. 2. No spam or self-promo. 3. Have fun and be positive!',
    '!uptime': '⏱️ Stream has been live and rocking! Make sure to stay tuned for more plays!',
    '!game': '🎮 Currently grinding games with chat! Drop suggestions anytime.'
};

const defaultSoundboard = [
    { id: 'sb_1', name: 'Airhorn', icon: '📢', type: 'preset', preset: 'airhorn' },
    { id: 'sb_2', name: 'Hype Fanfare', icon: '🎉', type: 'preset', preset: 'hype' },
    { id: 'sb_3', name: 'Applause', icon: '👏', type: 'preset', preset: 'applause' },
    { id: 'sb_4', name: 'Bell Chime', icon: '🔔', type: 'preset', preset: 'ding' },
    { id: 'sb_5', name: 'Ba-dum-tss', icon: '🥁', type: 'preset', preset: 'drum' },
    { id: 'sb_6', name: 'Victory', icon: '🏆', type: 'preset', preset: 'victory' },
    { id: 'sb_7', name: 'Game Over', icon: '💀', type: 'preset', preset: 'gameover' },
    { id: 'sb_8', name: 'Laser', icon: '⚡', type: 'preset', preset: 'laser' },
    { id: 'sb_9', name: 'Coin 1-Up', icon: '🪙', type: 'preset', preset: 'coin' },
    { id: 'sb_10', name: 'Bonk', icon: '💥', type: 'preset', preset: 'bonk' },
    { id: 'sb_11', name: 'Siren', icon: '🚨', type: 'preset', preset: 'siren' }
];

// Multi-Streamer Profile Authentication Check
let currentProfileId = localStorage.getItem('msp_active_profile');
let allProfiles = JSON.parse(localStorage.getItem('msp_profiles_list')) || [];

// If no active profile exists or user is unauthenticated, redirect to login page (unless an OAuth access token is in the URL hash)
const hasOAuthHash = window.location.hash && window.location.hash.includes('access_token=');
if (!hasOAuthHash && (!currentProfileId || allProfiles.length === 0 || !allProfiles.some(p => p.id === currentProfileId))) {
    window.location.href = 'login.html';
}

function getProfileKey(key) {
    return `msp_${currentProfileId}_${key}`;
}

// Load data strictly for the active profile
function loadProfileData() {
    deckButtons = JSON.parse(localStorage.getItem(getProfileKey('buttons'))) || defaultButtons;
    timedAnnouncements = JSON.parse(localStorage.getItem(getProfileKey('timers'))) || defaultTimers;
    customCommands = JSON.parse(localStorage.getItem(getProfileKey('commands'))) || defaultCommands;
    soundboardSounds = JSON.parse(localStorage.getItem(getProfileKey('soundboard'))) || defaultSoundboard;
    soundboardVolume = parseFloat(localStorage.getItem(getProfileKey('soundboard_vol')) || '0.7');
}

// State
let deckButtons = defaultButtons;
let timedAnnouncements = defaultTimers;
let customCommands = defaultCommands;
let soundboardSounds = defaultSoundboard;
let soundboardVolume = 0.7;
loadProfileData();

let clientStats = { messagesSent: 0, messagesReceived: 0, activeChatters: {} };
let ttsEnabled = false;

// Client-side Browser IRC Mode
let clientTmi = null;
let clientTimers = {};
let activeGiveaway = null;
let activePoll = null;
let activeTrivia = null;

// Audio Synthesizer & Sound FX Engine
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSynthesizedSound(type, volume = 0.7) {
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;
        const masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), now);
        masterGain.connect(audioCtx.destination);

        if (type === 'airhorn') {
            // MLG Airhorn: 3 rapid bursts (short, short, long)
            const blasts = [
                { start: 0, dur: 0.11 },
                { start: 0.14, dur: 0.11 },
                { start: 0.28, dur: 0.42 }
            ];
            blasts.forEach(b => {
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(466.16, now + b.start);
                osc.frequency.setValueAtTime(587.33, now + b.start + 0.02);
                g.gain.setValueAtTime(0, now + b.start);
                g.gain.linearRampToValueAtTime(0.4, now + b.start + 0.01);
                g.gain.setValueAtTime(0.4, now + b.start + b.dur - 0.02);
                g.gain.exponentialRampToValueAtTime(0.001, now + b.start + b.dur);
                osc.connect(g);
                g.connect(masterGain);
                osc.start(now + b.start);
                osc.stop(now + b.start + b.dur);
            });
        } else if (type === 'hype') {
            // Brassy fanfare arpeggio
            const notes = [
                { f: 523.25, t: 0, d: 0.1 },     // C5
                { f: 659.25, t: 0.1, d: 0.1 },   // E5
                { f: 783.99, t: 0.2, d: 0.12 },  // G5
                { f: 1046.50, t: 0.32, d: 0.45 } // C6
            ];
            notes.forEach(n => {
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(n.f, now + n.t);
                g.gain.setValueAtTime(0.3, now + n.t);
                g.gain.exponentialRampToValueAtTime(0.01, now + n.t + n.d);
                osc.connect(g);
                g.connect(masterGain);
                osc.start(now + n.t);
                osc.stop(now + n.t + n.d);
            });
        } else if (type === 'applause') {
            // Crowd applause with bandpass noise
            const bufferSize = Math.floor(audioCtx.sampleRate * 1.4);
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.82 ? 1 : 0.2);
            }
            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1100, now);
            filter.Q.setValueAtTime(1.2, now);
            const g = audioCtx.createGain();
            g.gain.setValueAtTime(0.01, now);
            g.gain.linearRampToValueAtTime(0.4, now + 0.15);
            g.gain.setValueAtTime(0.4, now + 0.9);
            g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
            noise.connect(filter);
            filter.connect(g);
            g.connect(masterGain);
            noise.start(now);
        } else if (type === 'ding') {
            // Pure Bell Chime
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1046.50, now);
            g.gain.setValueAtTime(0.5, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
            osc.connect(g);
            g.connect(masterGain);
            osc.start(now);
            osc.stop(now + 1.0);
        } else if (type === 'drum') {
            // Ba-dum-tss: Kick -> Tom -> Cymbal
            const kick = audioCtx.createOscillator();
            const kickG = audioCtx.createGain();
            kick.frequency.setValueAtTime(160, now);
            kick.frequency.exponentialRampToValueAtTime(45, now + 0.15);
            kickG.gain.setValueAtTime(0.6, now);
            kickG.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            kick.connect(kickG);
            kickG.connect(masterGain);
            kick.start(now);
            kick.stop(now + 0.15);

            const tom = audioCtx.createOscillator();
            const tomG = audioCtx.createGain();
            tom.frequency.setValueAtTime(220, now + 0.18);
            tom.frequency.exponentialRampToValueAtTime(70, now + 0.32);
            tomG.gain.setValueAtTime(0.5, now + 0.18);
            tomG.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
            tom.connect(tomG);
            tomG.connect(masterGain);
            tom.start(now + 0.18);
            tom.stop(now + 0.32);

            const bufSize = Math.floor(audioCtx.sampleRate * 0.5);
            const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
            const cNoise = audioCtx.createBufferSource();
            cNoise.buffer = buf;
            const cFilter = audioCtx.createBiquadFilter();
            cFilter.type = 'highpass';
            cFilter.frequency.setValueAtTime(5000, now + 0.36);
            const cGain = audioCtx.createGain();
            cGain.gain.setValueAtTime(0.4, now + 0.36);
            cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
            cNoise.connect(cFilter);
            cFilter.connect(cGain);
            cGain.connect(masterGain);
            cNoise.start(now + 0.36);
        } else if (type === 'victory') {
            // Retro 8-bit Level Up Arpeggio
            const freqs = [330, 392, 523, 659, 784, 1046];
            freqs.forEach((f, i) => {
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(f, now + i * 0.08);
                g.gain.setValueAtTime(0.2, now + i * 0.08);
                const dur = i === freqs.length - 1 ? 0.35 : 0.08;
                g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + dur);
                osc.connect(g);
                g.connect(masterGain);
                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + dur);
            });
        } else if (type === 'gameover') {
            // Sad Trombone
            const notes = [
                { f: 293.66, t: 0, d: 0.22 },
                { f: 277.18, t: 0.25, d: 0.22 },
                { f: 261.63, t: 0.50, d: 0.22 },
                { f: 246.94, t: 0.75, d: 0.65, slide: 200 }
            ];
            notes.forEach(n => {
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(n.f, now + n.t);
                if (n.slide) {
                    osc.frequency.linearRampToValueAtTime(n.slide, now + n.t + n.d);
                }
                g.gain.setValueAtTime(0.35, now + n.t);
                g.gain.exponentialRampToValueAtTime(0.01, now + n.t + n.d);
                osc.connect(g);
                g.connect(masterGain);
                osc.start(now + n.t);
                osc.stop(now + n.t + n.d);
            });
        } else if (type === 'laser') {
            // Retro Laser Sweep
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1400, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);
            g.gain.setValueAtTime(0.4, now);
            g.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
            osc.connect(g);
            g.connect(masterGain);
            osc.start(now);
            osc.stop(now + 0.18);
        } else if (type === 'coin') {
            // Mario 1-Up Coin
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(987.77, now);
            osc.frequency.setValueAtTime(1318.51, now + 0.08);
            g.gain.setValueAtTime(0.25, now);
            g.gain.setValueAtTime(0.25, now + 0.08);
            g.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
            osc.connect(g);
            g.connect(masterGain);
            osc.start(now);
            osc.stop(now + 0.45);
        } else if (type === 'bonk') {
            // Bonk Cartoon Impact
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);
            g.gain.setValueAtTime(0.6, now);
            g.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.connect(g);
            g.connect(masterGain);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'siren') {
            // Emergency Police / Ambulance Siren
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(650, now);
            osc.frequency.linearRampToValueAtTime(1100, now + 0.25);
            osc.frequency.linearRampToValueAtTime(650, now + 0.50);
            osc.frequency.linearRampToValueAtTime(1100, now + 0.75);
            osc.frequency.linearRampToValueAtTime(650, now + 1.0);
            g.gain.setValueAtTime(0.35, now);
            g.gain.exponentialRampToValueAtTime(0.01, now + 1.05);
            osc.connect(g);
            g.connect(masterGain);
            osc.start(now);
            osc.stop(now + 1.05);
        } else {
            // Fallback Ping
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            g.gain.setValueAtTime(0.3, now);
            g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.connect(g);
            g.connect(masterGain);
            osc.start(now);
            osc.stop(now + 0.2);
        }
    } catch (err) {
        console.error('Audio synth error:', err);
    }
}

function playFx(type) {
    playSynthesizedSound(type, soundboardVolume);
}

function playSoundItem(item) {
    if (!item) return;
    if (item.type === 'preset') {
        playSynthesizedSound(item.preset || 'hype', soundboardVolume);
    } else if (item.type === 'upload' && item.audioData) {
        try {
            const audio = new Audio(item.audioData);
            audio.volume = Math.max(0, Math.min(1, soundboardVolume));
            audio.play().catch(e => console.warn('Audio play error:', e));
        } catch (e) {
            console.error('Failed to play custom audio file:', e);
        }
    } else if (item.type === 'url' && item.url) {
        try {
            const audio = new Audio(item.url);
            audio.volume = Math.max(0, Math.min(1, soundboardVolume));
            audio.play().catch(e => {
                console.warn('Audio URL play error:', e);
                alert('Could not play audio from URL. Please check the link or CORS policy.');
            });
        } catch (e) {
            console.error('Failed to play audio URL:', e);
        }
    } else {
        playSynthesizedSound('hype', soundboardVolume);
    }
}

// Text-to-Speech
function speakText(text) {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/(https?:\/\/[^\s]+)/g, 'a link').slice(0, 150);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}

// Confetti Effect
const canvas = document.getElementById('hypeCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function triggerConfetti() {
    playFx('hype');
    const colors = ['#9146ff', '#00f0ff', '#ff007f', '#ffd700', '#00e676'];
    for (let i = 0; i < 90; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 16,
            vy: (Math.random() - 0.5) * 16 - 3,
            size: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            life: 1
        });
    }
    animateParticles();
}

let animFrame = null;
function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25;
        p.rotation += 4;
        p.life -= 0.015;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();

        if (p.life <= 0) particles.splice(idx, 1);
    });

    if (particles.length > 0) {
        animFrame = requestAnimationFrame(animateParticles);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// DOM Elements
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const headerChannel = document.getElementById('headerChannel');
const sentCountEl = document.getElementById('sentCount');
const recvCountEl = document.getElementById('recvCount');
const chatterCountEl = document.getElementById('chatterCount');
const deckGrid = document.getElementById('deckGrid');
const chatFeed = document.getElementById('chatFeed');
const chatDrawer = document.getElementById('chatDrawer');
const btnToggleChat = document.getElementById('btnToggleChat');
const btnCloseChat = document.getElementById('btnCloseChat');
const btnClearChat = document.getElementById('btnClearChat');
const chatForm = document.getElementById('chatForm');
const customInput = document.getElementById('customInput');
const btnHypeTrain = document.getElementById('btnHypeTrain');
const ttsToggle = document.getElementById('ttsToggle');

// Settings Elements
const botUsernameInput = document.getElementById('botUsername');
const oauthTokenInput = document.getElementById('oauthToken');
const targetChannelInput = document.getElementById('targetChannel');
const btnConnect = document.getElementById('btnConnect');
const btnDisconnect = document.getElementById('btnDisconnect');

// Tab Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetTab = btn.getAttribute('data-tab');
        document.getElementById(targetTab).classList.add('active');
    });
});

// Sound Buttons (rendered dynamically via renderSoundboard)

ttsToggle.addEventListener('change', (e) => {
    ttsEnabled = e.target.checked;
    if (ttsEnabled) speakText('Text to speech activated!');
});

btnHypeTrain.addEventListener('click', () => {
    triggerConfetti();
    sendChatMessage('🎉🎉🎉 HYPE TRAIN / CELEBRATION ACTIVATED! Let\'s go chat! 🔥🔥🔥');
});

function updateStatusUI(status, channel) {
    statusIndicator.className = 'status-indicator ' + (status || 'disconnected');
    statusText.textContent = status ? (status.charAt(0).toUpperCase() + status.slice(1)) : 'Disconnected';
    headerChannel.textContent = channel ? '#' + channel : 'Not Connected';
}

function updateStatsUI(stats) {
    if (!stats) return;
    sentCountEl.textContent = stats.messagesSent || 0;
    recvCountEl.textContent = stats.messagesReceived || 0;
    chatterCountEl.textContent = stats.chatterCount || Object.keys(stats.activeChatters || {}).length || 0;
}

// Stream Deck
function renderDeck() {
    deckGrid.innerHTML = '';
    deckButtons.forEach((btn, index) => {
        const card = document.createElement('div');
        card.className = 'action-card';

        let iconClass = btn.icon || 'fa-solid fa-bolt';
        if (iconClass === 'fa-hand-wave') iconClass = 'fa-solid fa-hand';
        if (iconClass === 'fa-fire-flame-curved') iconClass = 'fa-solid fa-fire';
        if (!iconClass.startsWith('fa-')) iconClass = 'fa-solid ' + iconClass;
        if (!iconClass.includes(' ')) iconClass = 'fa-solid ' + iconClass;

        card.innerHTML = `
            <div class="card-top">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="card-icon ${iconClass}"></i>
                    <span class="card-badge">${escapeHtml(btn.category || 'Chat')}</span>
                </div>
                <div class="card-actions">
                    <button class="card-btn card-edit" title="Edit Button" data-index="${index}"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="card-btn card-delete" title="Delete Button" data-index="${index}"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
            <div class="card-title">${escapeHtml(btn.title)}</div>
            <div class="card-desc" title="${escapeHtml(btn.message)}">${escapeHtml(btn.message)}</div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-actions')) return;
            sendChatMessage(btn.message);
            playFx('ding');
        });

        card.querySelector('.card-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openDeckModal(index);
        });

        card.querySelector('.card-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete the "${btn.title}" button?`)) {
                deckButtons.splice(index, 1);
                localStorage.setItem(getProfileKey('buttons'), JSON.stringify(deckButtons));
                renderDeck();
            }
        });

        deckGrid.appendChild(card);
    });
}

// Send Message (Direct Browser Client or Backend Fallback)
async function sendChatMessage(message) {
    if (!message || !message.trim()) return;

    if (clientTmi && clientTmi.readyState() === 'OPEN') {
        const channel = targetChannelInput.value.trim().toLowerCase().replace('#', '');
        try {
            await clientTmi.say(channel, message.trim());
            clientStats.messagesSent++;
            updateStatsUI(clientStats);
            appendChatMessage({
                displayName: 'MightyStreamPulse Bot',
                color: '#00f0ff',
                message: message.trim(),
                isSelf: true,
                timestamp: new Date().toLocaleTimeString()
            });
        } catch (e) {
            alert('Failed to send: ' + e.message);
        }
        return;
    }

    // Backend Node.js fallback
    try {
        const res = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message.trim() })
        });
        const result = await res.json();
        if (!result.success) alert('Error sending: ' + result.error);
    } catch (e) {
        alert('Bot is not connected to Twitch yet. Click "Switch / Exit" in the top-right corner to log in with your account.');
    }
}

// Message Deduplication Cache (blocks identical duplicate echoes within 3 seconds)
let recentMessagesCache = [];
function isDuplicateMessage(displayName, message) {
    const now = Date.now();
    const cleanMsg = (message || '').trim();
    recentMessagesCache = recentMessagesCache.filter(m => now - m.time < 3000);
    const isDup = recentMessagesCache.some(m => (m.user || '').toLowerCase() === (displayName || '').toLowerCase() && m.msg === cleanMsg);
    if (!isDup) {
        recentMessagesCache.push({ user: displayName || '', msg: cleanMsg, time: now });
    }
    return isDup;
}

// Append Chat Message
function appendChatMessage(data) {
    if (isDuplicateMessage(data.displayName, data.message)) {
        return;
    }

    const emptyState = chatFeed.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const row = document.createElement('div');
    const rewardClass = data.isReward ? ' is-reward' : '';
    row.className = 'chat-message-row' + (data.isSelf ? ' is-bot' : '') + rewardClass;
    const rewardBadge = data.isReward ? '<span class="reward-tag"><i class="fa-solid fa-coins"></i> Channel Points</span>' : '';

    row.innerHTML = `
        ${rewardBadge}
        <span class="time">${data.timestamp}</span>
        <span class="user" style="color: ${data.color}">${escapeHtml(data.displayName)}:</span>
        <span class="text">${escapeHtml(data.message)}</span>
    `;

    chatFeed.appendChild(row);
    chatFeed.scrollTop = chatFeed.scrollHeight;

    if (data.isReward) playFx('ding');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Client-Side Timers
function startClientTimers() {
    Object.values(clientTimers).forEach(id => clearInterval(id));
    clientTimers = {};

    timedAnnouncements.forEach(t => {
        if (t.enabled && clientTmi && clientTmi.readyState() === 'OPEN') {
            const ms = Math.max(1, t.intervalMinutes) * 60 * 1000;
            clientTimers[t.id] = setInterval(() => {
                sendChatMessage(t.message);
            }, ms);
        }
    });
}

// ==========================================
// 🛡️ Always-Active Background Shield Engine
// Prevents tab sleeping, browser throttling & background disconnection
// ==========================================
let userExplicitlyDisconnected = false;
let keepAliveAudioNode = null;
let heartbeatWorker = null;
let watchdogInterval = null;

// 1. Silent Web Audio Anchor: tells Edge & Chrome that this tab has active media and MUST NOT SLEEP
function startBackgroundAudioAnchor() {
    try {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        if (keepAliveAudioNode) return;

        // Inaudible 100Hz sine wave through 0.00001 gain (inaudible to human ear)
        const silentOsc = audioCtx.createOscillator();
        const silentGain = audioCtx.createGain();
        silentGain.gain.setValueAtTime(0.00001, audioCtx.currentTime);
        silentOsc.frequency.setValueAtTime(100, audioCtx.currentTime);
        silentOsc.connect(silentGain);
        silentGain.connect(audioCtx.destination);
        silentOsc.start();
        keepAliveAudioNode = silentOsc;
    } catch (e) {
        console.warn('Background audio anchor warning:', e);
    }
}

// 2. Web Worker Heartbeat: Web Workers run on a background OS thread and are NOT throttled like window timers
function startHeartbeatWorker() {
    if (heartbeatWorker) return;
    try {
        const workerBlob = new Blob([`
            let interval = null;
            self.onmessage = function(e) {
                if (e.data === 'start') {
                    if (!interval) {
                        interval = setInterval(function() {
                            self.postMessage('tick');
                        }, 12000); // Check every 12 seconds
                    }
                } else if (e.data === 'stop') {
                    if (interval) { clearInterval(interval); interval = null; }
                }
            };
        `], { type: 'application/javascript' });

        const blobUrl = URL.createObjectURL(workerBlob);
        heartbeatWorker = new Worker(blobUrl);
        heartbeatWorker.onmessage = function(e) {
            if (e.data === 'tick') {
                runKeepAliveWatchdog();
            }
        };
        heartbeatWorker.postMessage('start');
    } catch (err) {
        console.warn('Web Worker unavailable, falling back to window interval:', err);
        if (!watchdogInterval) {
            watchdogInterval = setInterval(runKeepAliveWatchdog, 12000);
        }
    }
}

// 3. Keep-Alive Watchdog: checks socket state, sends IRC pings, and auto-revives connection if dropped
async function runKeepAliveWatchdog() {
    if (userExplicitlyDisconnected || isConnectingTmi) return;

    const savedUser = localStorage.getItem(getProfileKey('user')) || '';
    const savedOauth = localStorage.getItem(getProfileKey('oauth')) || '';
    const savedChan = localStorage.getItem(getProfileKey('channel')) || '';
    if (!savedUser || !savedOauth || !savedChan) return;

    // Check if client is ALREADY OPEN or in the middle of CONNECTING
    if (clientTmi && typeof clientTmi.readyState === 'function') {
        const state = clientTmi.readyState();
        if (state === 'OPEN' || state === 'CONNECTING') {
            if (state === 'OPEN') {
                try {
                    if (typeof clientTmi.ping === 'function') clientTmi.ping().catch(() => {});
                } catch (e) {}
            }
            return;
        }
    }

    console.log('[MightyStreamPulse Shield] Connection dropped. Auto-reviving chat connection...');
    updateStatusUI('connecting', savedChan);
    try {
        await connectClientTmi(savedUser, savedOauth, savedChan, true);
    } catch (e) {
        console.warn('[MightyStreamPulse Shield] Auto-revive attempt error:', e);
    }
}

// 4. Screen Wake Lock (keeps display / session awake if supported)
async function requestScreenWakeLock() {
    try {
        if ('wakeLock' in navigator && navigator.wakeLock) {
            await navigator.wakeLock.request('screen');
        }
    } catch (e) {}
}

// 5. Unified Start Function
function startBackgroundKeepAlive() {
    startBackgroundAudioAnchor();
    startHeartbeatWorker();
    requestScreenWakeLock();
}

// 6. Immediate Auto-Heal on Tab Visibility, Window Focus, or Network Online
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        runKeepAliveWatchdog();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
    }
});

window.addEventListener('focus', () => {
    runKeepAliveWatchdog();
});

window.addEventListener('online', () => {
    console.log('[MightyStreamPulse] Network online detected. Verifying chat connection...');
    runKeepAliveWatchdog();
});

// Connect Logic (Direct Browser Client Mode)
let isConnectingTmi = false;
async function connectClientTmi(username, oauth, channel, isAutoReconnect = false) {
    if (isConnectingTmi) {
        console.log('[MightyStreamPulse] Connection already in progress. Skipping duplicate connect call.');
        return false;
    }

    userExplicitlyDisconnected = false;
    startBackgroundKeepAlive();

    // Properly tear down and remove all listeners from any previous client instance
    if (clientTmi) {
        try {
            if (typeof clientTmi.removeAllListeners === 'function') {
                clientTmi.removeAllListeners();
            }
            await clientTmi.disconnect();
        } catch (e) {}
        clientTmi = null;
    }

    isConnectingTmi = true;

    let token = (oauth || '').trim();
    if (!token) {
        token = localStorage.getItem(getProfileKey('oauth')) || '';
    }
    if (!token) {
        updateStatusUI('disconnected');
        if (!isAutoReconnect) {
            alert('Please enter your Twitch OAuth Token first!\nYou can click "Verify & Connect With Twitch API" or visit https://twitchapps.com/tmi/ to generate one.');
        }
        return false;
    }
    if (!token.startsWith('oauth:')) token = 'oauth:' + token;

    let chan = sanitizeChannelName((channel || '').trim());
    if (!chan) {
        chan = sanitizeChannelName(localStorage.getItem(getProfileKey('channel')) || '');
    }

    let user = sanitizeChannelName((username || '').trim());
    if (!user) {
        user = sanitizeChannelName(localStorage.getItem(getProfileKey('user')) || chan);
    }

    if (!user || !chan) {
        updateStatusUI('disconnected');
        if (!isAutoReconnect) {
            alert('Please provide your Twitch username and target channel.');
        }
        return false;
    }

    updateStatusUI('connecting', chan);

    let authFailed = false;
    let authRejectFn = null;
    const authPromise = new Promise((_, reject) => {
        authRejectFn = reject;
    });

    const tmiLib = window.tmi || (typeof tmi !== 'undefined' ? tmi : null);
    if (!tmiLib || !tmiLib.Client) {
        updateStatusUI('disconnected', chan);
        if (!isAutoReconnect) {
            alert('Twitch Chat engine (TMI) is not loaded. Please hard refresh (Ctrl+F5) to load the latest files.');
        }
        return false;
    }

    clientTmi = new tmiLib.Client({
        options: {
            debug: false,
            skipUpdatingEmotesets: true
        },
        connection: {
            reconnect: true,
            maxReconnectAttempts: Infinity,
            maxReconnectInterval: 10000,
            reconnectInterval: 2000,
            reconnectDecay: 1.2,
            secure: true
        },
        identity: { username: user, password: token },
        channels: [chan]
    });

    clientTmi.on('reconnect', () => {
        updateStatusUI('connecting', chan);
        console.log('[MightyStreamPulse] TMI reconnecting...');
    });

    clientTmi.on('connected', () => {
        updateStatusUI('connected', chan);
        startClientTimers();
        startBackgroundKeepAlive();
    });

    clientTmi.on('join', (channelName, username, self) => {
        if (self) {
            updateStatusUI('connected', chan);
        }
    });

    clientTmi.on('disconnected', (reason) => {
        Object.values(clientTimers).forEach(id => clearInterval(id));
        if (userExplicitlyDisconnected) {
            updateStatusUI('disconnected', chan);
        } else {
            updateStatusUI('connecting', chan);
        }
    });

    // Capture Twitch authentication failure notices from raw messages
    clientTmi.on('raw_message', (msg1, msg2) => {
        const msg = (msg2 && (msg2.command || msg2.params)) ? msg2 : msg1;
        if (msg) {
            const rawText = (msg.params ? msg.params.join(' ') : (msg.raw || '')).toLowerCase();
            if (rawText.includes('login authentication failed') || rawText.includes('improperly formatted auth') || rawText.includes('login unsuccessful') || rawText.includes('notice * :login')) {
                authFailed = true;
                userExplicitlyDisconnected = true;
                updateStatusUI('disconnected', chan);
                try { clientTmi.disconnect(); } catch (e) {}
                if (authRejectFn) {
                    authRejectFn(new Error(`Login authentication failed. Twitch rejected the OAuth credentials for "${user}".`));
                }
            }
        }
    });

    clientTmi.on('notice', (channel, msgid, message) => {
        if (msgid === 'msg_channel_suspended' || msgid === 'login_unsuccessful') {
            authFailed = true;
            userExplicitlyDisconnected = true;
            updateStatusUI('disconnected', chan);
            try { clientTmi.disconnect(); } catch (e) {}
            if (authRejectFn) {
                authRejectFn(new Error(`Twitch error: ${message}`));
            }
        }
    });

    clientTmi.on('message', async (channelName, tags, message, self) => {
        const chatter = tags['display-name'] || tags.username;
        const chatterLower = (tags.username || tags['display-name'] || '').toLowerCase();
        const botUserLower = (user || '').toLowerCase();

        // Skip echo if sent by our own bot/dashboard (already added once as MightyStreamPulse Bot)
        if (self || chatterLower === botUserLower) return;
        clientStats.messagesReceived++;
        if (chatter) clientStats.activeChatters[chatter] = (clientStats.activeChatters[chatter] || 0) + 1;
        updateStatsUI(clientStats);

        const customRewardId = tags['custom-reward-id'] || null;
        const msgId = tags['msg-id'] || null;
        const isReward = !!customRewardId || msgId === 'highlighted-message' || msgId === 'custom-reward-redemption';

        appendChatMessage({
            channel: channelName,
            displayName: chatter,
            color: tags.color || '#9146FF',
            message,
            isReward,
            isSelf: self,
            timestamp: new Date().toLocaleTimeString()
        });

        if (ttsEnabled && !self) speakText(`${chatter} says: ${message}`);

        const trimmed = message.trim();
        const lower = trimmed.toLowerCase();

        // 1. Giveaway check
        if (activeGiveaway && !self && lower === activeGiveaway.keyword.toLowerCase()) {
            activeGiveaway.entrants.add(chatter);
            document.getElementById('giveawayEntrantsCount').textContent = activeGiveaway.entrants.size;
        }

        // 2. Poll check
        if (activePoll && !self) {
            const vNum = parseInt(trimmed, 10);
            if (!isNaN(vNum) && vNum >= 1 && vNum <= activePoll.options.length) {
                activePoll.options.forEach(o => o.voters.delete(chatter));
                activePoll.options[vNum - 1].voters.add(chatter);
                updatePollPreview(activePoll.question, activePoll.options.map(o => ({ text: o.text, votes: o.voters.size })));
            }
        }

        // 3. Trivia check
        if (activeTrivia && !activeTrivia.solved && !self) {
            if (lower.includes(activeTrivia.answer.toLowerCase())) {
                activeTrivia.solved = true;
                const winMsg = `🎉 BINGO! @${chatter} got the correct answer: "${activeTrivia.answer}"! Congratulations! 🧠`;
                await sendChatMessage(winMsg);
            }
        }

        // 4. 8-Ball
        if (lower.startsWith('!8ball ') && !self) {
            const answers = ['🎱 It is certain!', '🎱 Without a doubt!', '🎱 Reply hazy, try again.', '🎱 Signs point to yes! 🔥', '🎱 Very doubtful!'];
            const ans = answers[Math.floor(Math.random() * answers.length)];
            await sendChatMessage(`@${chatter} ${ans}`);
            return;
        }

        // 5. Custom Commands
        const cmdKey = trimmed.split(' ')[0].toLowerCase();
        if (!self && customCommands && customCommands[cmdKey]) {
            await sendChatMessage(customCommands[cmdKey]);
        }
    });

    const connectPromise = clientTmi.connect();
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timed out (10s). Twitch did not respond. Check your credentials.')), 10000);
    });

    try {
        await Promise.race([connectPromise, timeoutPromise, authPromise]);

        if (authFailed) {
            throw new Error('Authentication rejected by Twitch.');
        }

        updateStatusUI('connected', chan);
        startClientTimers();
        startBackgroundKeepAlive();

        localStorage.setItem(getProfileKey('user'), user);
        localStorage.setItem(getProfileKey('oauth'), token);
        localStorage.setItem(getProfileKey('channel'), chan);

        // Update profile in list
        const pIdx = allProfiles.findIndex(p => p.id === currentProfileId);
        if (pIdx !== -1) {
            allProfiles[pIdx].channel = chan;
            localStorage.setItem('msp_profiles_list', JSON.stringify(allProfiles));
        }

        return true;
    } catch (err) {
        updateStatusUI('disconnected', chan);
        try { await clientTmi.disconnect(); } catch (e) {}
        clientTmi = null;
        if (!isAutoReconnect) {
            alert(`Twitch Bot Connection Failed:\n${err.message || err}\n\nTroubleshooting:\n1. Click "Switch / Exit" in the top-right corner.\n2. Reconnect with Twitch or use "Quick Token" with your token from twitchapps.com/tmi/`);
        } else {
            console.warn('[MightyStreamPulse Shield] Background reconnect attempt:', err.message || err);
        }
        return false;
    } finally {
        isConnectingTmi = false;
    }
}

// Interactive Games & Polls
document.getElementById('btnStartPoll').addEventListener('click', async () => {
    const q = document.getElementById('pollQuestionInput').value.trim();
    const optsStr = document.getElementById('pollOptionsInput').value.trim();
    if (!q || !optsStr) return alert('Provide question and options');
    const options = optsStr.split(',').map(s => s.trim()).filter(Boolean);

    activePoll = { question: q, options: options.map(t => ({ text: t, voters: new Set() })) };
    updatePollPreview(q, activePoll.options.map(o => ({ text: o.text, votes: 0 })));

    let msg = `📊 POLL: ${q} | Vote with a number: ` + options.map((opt, i) => `[${i + 1}] ${opt}`).join(' ');
    sendChatMessage(msg);
});

document.getElementById('btnEndPoll').addEventListener('click', () => {
    activePoll = null;
    document.getElementById('pollLiveDisplay').style.display = 'none';
});

function updatePollPreview(question, options) {
    const container = document.getElementById('pollLiveDisplay');
    container.style.display = 'block';
    document.getElementById('previewPollQ').textContent = question;
    const optsDiv = document.getElementById('previewPollOpts');
    optsDiv.innerHTML = '';
    options.forEach((opt, idx) => {
        const line = document.createElement('div');
        line.style.cssText = 'font-size: 0.85rem; margin-top: 6px;';
        line.textContent = `[${idx + 1}] ${opt.text} - ${opt.votes || 0} votes`;
        optsDiv.appendChild(line);
    });
}

// Giveaway
document.getElementById('btnStartGiveaway').addEventListener('click', () => {
    const keyword = document.getElementById('giveawayKeyword').value.trim();
    if (!keyword) return;
    activeGiveaway = { keyword, entrants: new Set() };
    document.getElementById('giveawayEntrantsCount').textContent = '0';
    document.getElementById('giveawayWinnerBox').style.display = 'none';
    sendChatMessage(`🎁 GIVEAWAY STARTED! Type "${keyword}" in chat right now to enter! 🎁`);
});

document.getElementById('btnPickWinner').addEventListener('click', () => {
    if (!activeGiveaway || activeGiveaway.entrants.size === 0) return alert('No entrants in giveaway.');
    const arr = Array.from(activeGiveaway.entrants);
    const winner = arr[Math.floor(Math.random() * arr.length)];
    const box = document.getElementById('giveawayWinnerBox');
    box.style.display = 'block';
    document.getElementById('winnerName').textContent = winner;
    triggerConfetti();
    sendChatMessage(`🏆 AND THE WINNER IS... @${winner}!! Congratulations! 🎉`);
});

document.getElementById('btnEndGiveaway').addEventListener('click', () => {
    activeGiveaway = null;
    document.getElementById('giveawayWinnerBox').style.display = 'none';
    document.getElementById('giveawayEntrantsCount').textContent = '0';
});

// Trivia
document.getElementById('btnStartTrivia').addEventListener('click', () => {
    const q = document.getElementById('triviaQuestion').value.trim();
    const a = document.getElementById('triviaAnswer').value.trim();
    if (!q || !a) return alert('Provide question and answer');
    activeTrivia = { question: q, answer: a, solved: false };
    sendChatMessage(`🧠 CHAT TRIVIA TIME! "${q}" (Type your guess in chat!)`);
    alert('Trivia broadcast to Twitch chat!');
});

// Moderation Controls
async function execModeration(cmd) {
    if (clientTmi && clientTmi.readyState() === 'OPEN') {
        const chan = targetChannelInput.value.trim().toLowerCase().replace('#', '');
        await clientTmi.say(chan, cmd);
        alert(`Executed ${cmd} in Twitch chat!`);
        return;
    }
    // Node backend fallback
    await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: cmd.replace('/', '') })
    });
}

document.querySelectorAll('.mod-card').forEach(card => {
    const action = card.getAttribute('data-action');
    if (action === 'clear') {
        card.querySelector('button').addEventListener('click', () => execModeration('/clear'));
    } else {
        card.querySelectorAll('.btn-sub').forEach(btn => {
            btn.addEventListener('click', () => {
                const sub = btn.getAttribute('data-sub');
                if (sub === 'emoteonly_on') execModeration('/emoteonly');
                else if (sub === 'emoteonly_off') execModeration('/emoteonlyoff');
                else if (sub === 'slow_on') {
                    const sec = document.getElementById('slowSecondsInput') ? document.getElementById('slowSecondsInput').value : '30';
                    execModeration('/slow ' + sec);
                }
                else if (sub === 'slow_off') execModeration('/slowoff');
                else if (sub === 'subscribers_on') execModeration('/subscribers');
                else if (sub === 'subscribers_off') execModeration('/subscribersoff');
            });
        });
    }
});

const btnRunCustomMod = document.getElementById('btnRunCustomMod');
if (btnRunCustomMod) {
    btnRunCustomMod.addEventListener('click', () => {
        const input = document.getElementById('customModCmdInput');
        let cmd = input.value.trim();
        if (!cmd) return alert('Enter a mod command to execute (e.g. /followers 10m)');
        if (!cmd.startsWith('/')) cmd = '/' + cmd;
        execModeration(cmd);
        input.value = '';
    });
}

document.getElementById('btnExecuteTimeout').addEventListener('click', () => {
    const target = document.getElementById('timeoutUsername').value.trim();
    const duration = document.getElementById('timeoutSeconds').value;
    if (!target) return alert('Enter a username');
    execModeration(`/timeout ${target} ${duration}`);
    document.getElementById('timeoutUsername').value = '';
});

// OBS Overlay Copy
document.getElementById('btnCopyOverlay').addEventListener('click', () => {
    const copyText = document.getElementById('overlayUrlInput');
    copyText.value = window.location.origin + '/overlay.html';
    copyText.select();
    navigator.clipboard.writeText(copyText.value);
    alert('OBS Overlay URL copied to clipboard!');
});

document.getElementById('btnTestObsAlert').addEventListener('click', () => {
    alert('OBS test alert triggered!');
});

// Timers Management
const timerModal = document.getElementById('timerModal');
const timerModalTitle = document.getElementById('timerModalTitle');
const modalTimerIndex = document.getElementById('modalTimerIndex');
const modalTimerName = document.getElementById('modalTimerName');
const modalTimerInterval = document.getElementById('modalTimerInterval');
const modalTimerMsg = document.getElementById('modalTimerMsg');
const btnCloseTimerModal = document.getElementById('btnCloseTimerModal');
const btnCancelTimerModal = document.getElementById('btnCancelTimerModal');
const btnSaveTimerModal = document.getElementById('btnSaveTimerModal');

function openTimerModal(index = -1) {
    modalTimerIndex.value = index;
    if (index >= 0 && timedAnnouncements[index]) {
        const t = timedAnnouncements[index];
        timerModalTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Timed Announcement';
        modalTimerName.value = t.name;
        modalTimerInterval.value = t.intervalMinutes;
        modalTimerMsg.value = t.message;
    } else {
        timerModalTitle.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Add Timed Announcement';
        modalTimerName.value = '';
        modalTimerInterval.value = 15;
        modalTimerMsg.value = '';
    }
    timerModal.classList.add('open');
}

function closeTimerModal() {
    timerModal.classList.remove('open');
}

btnCloseTimerModal.addEventListener('click', closeTimerModal);
btnCancelTimerModal.addEventListener('click', closeTimerModal);

btnSaveTimerModal.addEventListener('click', async () => {
    const idx = parseInt(modalTimerIndex.value, 10);
    const name = modalTimerName.value.trim();
    const intervalMinutes = parseInt(modalTimerInterval.value, 10);
    const message = modalTimerMsg.value.trim();

    if (!name || !message || !intervalMinutes || intervalMinutes < 1) {
        return alert('Please fill in a valid title, message, and positive interval in minutes.');
    }

    if (idx >= 0 && timedAnnouncements[idx]) {
        timedAnnouncements[idx].name = name;
        timedAnnouncements[idx].intervalMinutes = intervalMinutes;
        timedAnnouncements[idx].message = message;
    } else {
        timedAnnouncements.push({
            id: 'timer-' + Date.now(),
            name,
            intervalMinutes,
            message,
            enabled: true
        });
    }

    localStorage.setItem(getProfileKey('timers'), JSON.stringify(timedAnnouncements));
    renderTimers(timedAnnouncements);
    startClientTimers();
    closeTimerModal();
});

function renderTimers(timers) {
    timedAnnouncements = timers;
    const container = document.getElementById('timersList');
    container.innerHTML = '';

    timers.forEach((t, idx) => {
        const card = document.createElement('div');
        card.className = 'timer-card';
        card.innerHTML = `
            <div class="timer-details">
                <div class="timer-header-line">
                    <span class="timer-name">${escapeHtml(t.name)}</span>
                    <span class="timer-cadence"><i class="fa-regular fa-clock"></i> Every ${t.intervalMinutes} min</span>
                </div>
                <div class="timer-msg">${escapeHtml(t.message)}</div>
            </div>
            <div class="timer-controls">
                <button class="timer-btn edit-btn" title="Edit this timer" data-index="${idx}">
                    <i class="fa-solid fa-pen-to-square"></i> Edit
                </button>
                <button class="timer-btn del-btn" title="Delete timer" data-index="${idx}">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
                <label class="switch" title="Toggle active/inactive">
                    <input type="checkbox" ${t.enabled ? 'checked' : ''} data-index="${idx}">
                    <span class="slider"></span>
                </label>
            </div>
        `;

        card.querySelector('.edit-btn').addEventListener('click', () => openTimerModal(idx));
        card.querySelector('.del-btn').addEventListener('click', () => {
            if (confirm(`Delete the "${t.name}" reminder?`)) {
                timedAnnouncements.splice(idx, 1);
                localStorage.setItem(getProfileKey('timers'), JSON.stringify(timedAnnouncements));
                renderTimers(timedAnnouncements);
                startClientTimers();
            }
        });

        const toggle = card.querySelector('input[type="checkbox"]');
        toggle.addEventListener('change', (e) => {
            timedAnnouncements[idx].enabled = e.target.checked;
            localStorage.setItem(getProfileKey('timers'), JSON.stringify(timedAnnouncements));
            startClientTimers();
        });

        container.appendChild(card);
    });
}

document.getElementById('btnAddTimer').addEventListener('click', () => openTimerModal(-1));

// Commands Management
const cmdModal = document.getElementById('cmdModal');
const modalOrigCmd = document.getElementById('modalOrigCmd');
const modalCmdName = document.getElementById('modalCmdName');
const modalCmdResp = document.getElementById('modalCmdResp');
const btnCloseCmdModal = document.getElementById('btnCloseCmdModal');
const btnCancelCmdModal = document.getElementById('btnCancelCmdModal');
const btnSaveCmdModal = document.getElementById('btnSaveCmdModal');

function openCmdModal(cmd = '', currentReply = '') {
    modalOrigCmd.value = cmd;
    modalCmdName.value = cmd;
    modalCmdResp.value = currentReply;
    cmdModal.classList.add('open');
}

function closeCmdModal() { cmdModal.classList.remove('open'); }
btnCloseCmdModal.addEventListener('click', closeCmdModal);
btnCancelCmdModal.addEventListener('click', closeCmdModal);

btnSaveCmdModal.addEventListener('click', () => {
    const origCmd = modalOrigCmd.value.trim().toLowerCase();
    let newCmd = modalCmdName.value.trim().toLowerCase();
    const newResp = modalCmdResp.value.trim();

    if (!newCmd || !newResp) return alert('Provide both command and response');
    if (!newCmd.startsWith('!')) newCmd = '!' + newCmd;

    if (origCmd && origCmd !== newCmd) delete customCommands[origCmd];
    customCommands[newCmd] = newResp;
    localStorage.setItem(getProfileKey('commands'), JSON.stringify(customCommands));
    renderCommands(customCommands);
    closeCmdModal();
});

function renderCommands(commands) {
    customCommands = commands;
    const tbody = document.getElementById('cmdTableBody');
    tbody.innerHTML = '';

    Object.keys(commands).forEach(cmd => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><code>${cmd}</code></td>
            <td>${escapeHtml(commands[cmd])}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button class="icon-btn edit-cmd" title="Edit command" data-cmd="${cmd}"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="icon-btn del-cmd" title="Delete command" data-cmd="${cmd}"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;

        row.querySelector('.edit-cmd').addEventListener('click', () => openCmdModal(cmd, commands[cmd]));
        row.querySelector('.del-cmd').addEventListener('click', () => {
            if (confirm(`Delete ${cmd}?`)) {
                delete customCommands[cmd];
                localStorage.setItem(getProfileKey('commands'), JSON.stringify(customCommands));
                renderCommands(customCommands);
            }
        });

        tbody.appendChild(row);
    });
}

document.getElementById('btnSaveCmd').addEventListener('click', () => {
    let cmd = document.getElementById('newCmdName').value.trim();
    const resp = document.getElementById('newCmdResp').value.trim();
    if (!cmd || !resp) return alert('Provide both command and response');
    if (!cmd.startsWith('!')) cmd = '!' + cmd;

    customCommands[cmd] = resp;
    localStorage.setItem(getProfileKey('commands'), JSON.stringify(customCommands));
    renderCommands(customCommands);
    document.getElementById('newCmdName').value = '';
    document.getElementById('newCmdResp').value = '';
});

// Chat Drawer Controls
btnToggleChat.addEventListener('click', () => {
    chatDrawer.classList.toggle('hidden');
    document.querySelector('.quick-sender-dock').style.right = chatDrawer.classList.contains('hidden') ? '28px' : '390px';
});
btnCloseChat.addEventListener('click', () => {
    chatDrawer.classList.add('hidden');
    document.querySelector('.quick-sender-dock').style.right = '28px';
});
btnClearChat.addEventListener('click', () => {
    chatFeed.innerHTML = '<div class="empty-state"><i class="fa-regular fa-comments"></i><p>Chat cleared.</p></div>';
});

// Quick Chat Form
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = customInput.value.trim();
    if (text) {
        sendChatMessage(text);
        customInput.value = '';
    }
});

// Add & Edit Deck Button Modal
const addBtnModal = document.getElementById('addBtnModal');
const modalDeckTitle = document.getElementById('modalDeckTitle');
const modalBtnIndex = document.getElementById('modalBtnIndex');
const modalBtnTitle = document.getElementById('modalBtnTitle');
const modalBtnCategory = document.getElementById('modalBtnCategory');
const modalBtnIcon = document.getElementById('modalBtnIcon');
const modalBtnMsg = document.getElementById('modalBtnMsg');

function openDeckModal(index = -1) {
    if (!modalBtnIndex) return;
    modalBtnIndex.value = index;
    if (index >= 0 && deckButtons[index]) {
        const btn = deckButtons[index];
        if (modalDeckTitle) modalDeckTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Stream Deck Button';
        modalBtnTitle.value = btn.title || '';
        modalBtnCategory.value = btn.category || 'Hype';
        modalBtnIcon.value = btn.icon || 'fa-solid fa-bolt';
        modalBtnMsg.value = btn.message || '';
    } else {
        if (modalDeckTitle) modalDeckTitle.innerHTML = '<i class="fa-solid fa-bolt"></i> Create Stream Deck Button';
        modalBtnTitle.value = '';
        modalBtnCategory.value = 'Hype';
        modalBtnIcon.value = 'fa-solid fa-bolt';
        modalBtnMsg.value = '';
    }
    addBtnModal.classList.add('open');
}

document.getElementById('btnOpenAddModal').addEventListener('click', () => openDeckModal(-1));
document.getElementById('btnCloseModal').addEventListener('click', () => addBtnModal.classList.remove('open'));
document.getElementById('btnCancelModal').addEventListener('click', () => addBtnModal.classList.remove('open'));

document.getElementById('btnConfirmAdd').addEventListener('click', () => {
    const index = parseInt(modalBtnIndex.value, 10);
    const title = modalBtnTitle.value.trim();
    const category = modalBtnCategory.value;
    const icon = modalBtnIcon.value;
    const message = modalBtnMsg.value.trim();

    if (!title || !message) return alert('Please fill in both the button title and the chat message.');

    if (index >= 0 && deckButtons[index]) {
        deckButtons[index].title = title;
        deckButtons[index].category = category;
        deckButtons[index].icon = icon;
        deckButtons[index].message = message;
    } else {
        deckButtons.push({ id: 'btn_' + Date.now(), title, category, icon, message });
    }

    localStorage.setItem(getProfileKey('buttons'), JSON.stringify(deckButtons));
    renderDeck();
    addBtnModal.classList.remove('open');
});

// ==========================================
// Custom Soundboard Studio & Volume Controls
// ==========================================
let sbTempUploadedData = null;

function renderSoundboard() {
    const grid = document.getElementById('soundboardGrid');
    if (!grid) return;
    grid.innerHTML = '';

    soundboardSounds.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.className = 'fx-btn';
        btn.setAttribute('data-sound-index', index);
        btn.title = item.name + (item.type === 'preset' ? ` (${item.preset})` : ` (${item.type})`);
        btn.innerHTML = `<span style="margin-right: 4px;">${escapeHtml(item.icon || '🔊')}</span>${escapeHtml(item.name)}`;

        btn.addEventListener('click', () => {
            playSoundItem(item);
            btn.style.transform = 'scale(0.93)';
            setTimeout(() => { btn.style.transform = ''; }, 120);
        });

        grid.appendChild(btn);
    });

    const volSlider = document.getElementById('soundboardVolume');
    if (volSlider) {
        volSlider.value = soundboardVolume;
    }
}

function updateSbTypeView(type) {
    const grpPreset = document.getElementById('sbGroupPreset');
    const grpUpload = document.getElementById('sbGroupUpload');
    const grpUrl = document.getElementById('sbGroupUrl');
    if (grpPreset) grpPreset.style.display = type === 'preset' ? 'block' : 'none';
    if (grpUpload) grpUpload.style.display = type === 'upload' ? 'block' : 'none';
    if (grpUrl) grpUrl.style.display = type === 'url' ? 'block' : 'none';
}

function resetSbForm() {
    const editIdx = document.getElementById('sbEditIndex');
    const titleEl = document.getElementById('sbFormTitle');
    const nameEl = document.getElementById('sbInputName');
    const iconEl = document.getElementById('sbInputIcon');
    const typeEl = document.getElementById('sbSelectType');
    const presetEl = document.getElementById('sbSelectPreset');
    const fileEl = document.getElementById('sbFileInput');
    const statusEl = document.getElementById('sbUploadStatus');
    const urlEl = document.getElementById('sbUrlInput');

    if (editIdx) editIdx.value = '-1';
    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Add Sound Button';
    if (nameEl) nameEl.value = '';
    if (iconEl) iconEl.value = '🔊';
    if (typeEl) typeEl.value = 'preset';
    if (presetEl) presetEl.value = 'airhorn';
    if (fileEl) fileEl.value = '';
    if (statusEl) statusEl.textContent = '';
    if (urlEl) urlEl.value = '';
    sbTempUploadedData = null;
    updateSbTypeView('preset');
}

function editSbItem(index) {
    const item = soundboardSounds[index];
    if (!item) return;

    const editIdx = document.getElementById('sbEditIndex');
    const titleEl = document.getElementById('sbFormTitle');
    const nameEl = document.getElementById('sbInputName');
    const iconEl = document.getElementById('sbInputIcon');
    const typeEl = document.getElementById('sbSelectType');
    const presetEl = document.getElementById('sbSelectPreset');
    const statusEl = document.getElementById('sbUploadStatus');
    const urlEl = document.getElementById('sbUrlInput');

    if (editIdx) editIdx.value = index;
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit "${escapeHtml(item.name)}"`;
    if (nameEl) nameEl.value = item.name || '';
    if (iconEl) iconEl.value = item.icon || '🔊';
    if (typeEl) typeEl.value = item.type || 'preset';

    updateSbTypeView(item.type || 'preset');

    if (item.type === 'preset' && presetEl) {
        presetEl.value = item.preset || 'airhorn';
    } else if (item.type === 'upload') {
        sbTempUploadedData = item.audioData || null;
        if (statusEl) statusEl.textContent = item.audioData ? '✓ Custom audio file is attached' : '';
    } else if (item.type === 'url' && urlEl) {
        urlEl.value = item.url || '';
    }

    if (titleEl) titleEl.scrollIntoView({ behavior: 'smooth' });
}

function renderSoundListManager() {
    const listEl = document.getElementById('sbSoundList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (soundboardSounds.length === 0) {
        listEl.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 12px;">No sound buttons configured yet.</p>';
        return;
    }

    soundboardSounds.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'sound-row-item';

        let badgeText = item.type === 'preset' ? `Preset: ${item.preset}` : (item.type === 'upload' ? 'Uploaded File' : 'URL Link');

        row.innerHTML = `
            <div class="sound-info">
                <span style="font-size: 1.2rem; min-width: 24px; text-align: center;">${escapeHtml(item.icon || '🔊')}</span>
                <div>
                    <div style="font-weight: 600; font-size: 0.85rem; color: #fff;">${escapeHtml(item.name)}</div>
                    <span class="sound-badge">${escapeHtml(badgeText)}</span>
                </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
                <button class="btn btn-secondary btn-sm btn-sb-test" title="Test Play" style="padding: 4px 8px;"><i class="fa-solid fa-play"></i></button>
                <button class="btn btn-secondary btn-sm btn-sb-up" title="Move Up" style="padding: 4px 8px;" ${index === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button class="btn btn-secondary btn-sm btn-sb-down" title="Move Down" style="padding: 4px 8px;" ${index === soundboardSounds.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button class="btn btn-secondary btn-sm btn-sb-edit" title="Edit" style="padding: 4px 8px;"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn btn-secondary btn-sm btn-sb-del" title="Delete" style="padding: 4px 8px; color: #ef4444;"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;

        row.querySelector('.btn-sb-test').addEventListener('click', () => playSoundItem(item));

        row.querySelector('.btn-sb-up').addEventListener('click', () => {
            if (index > 0) {
                const temp = soundboardSounds[index];
                soundboardSounds[index] = soundboardSounds[index - 1];
                soundboardSounds[index - 1] = temp;
                localStorage.setItem(getProfileKey('soundboard'), JSON.stringify(soundboardSounds));
                renderSoundboard();
                renderSoundListManager();
            }
        });

        row.querySelector('.btn-sb-down').addEventListener('click', () => {
            if (index < soundboardSounds.length - 1) {
                const temp = soundboardSounds[index];
                soundboardSounds[index] = soundboardSounds[index + 1];
                soundboardSounds[index + 1] = temp;
                localStorage.setItem(getProfileKey('soundboard'), JSON.stringify(soundboardSounds));
                renderSoundboard();
                renderSoundListManager();
            }
        });

        row.querySelector('.btn-sb-edit').addEventListener('click', () => editSbItem(index));

        row.querySelector('.btn-sb-del').addEventListener('click', () => {
            if (confirm(`Delete the "${item.name}" sound button?`)) {
                soundboardSounds.splice(index, 1);
                localStorage.setItem(getProfileKey('soundboard'), JSON.stringify(soundboardSounds));
                renderSoundboard();
                renderSoundListManager();
                const curEdit = parseInt(document.getElementById('sbEditIndex').value, 10);
                if (curEdit === index) resetSbForm();
            }
        });

        listEl.appendChild(row);
    });
}

// Soundboard Event Listeners Setup
const soundboardModal = document.getElementById('soundboardModal');
const btnOpenSoundModal = document.getElementById('btnOpenSoundModal');
const btnCloseSoundModal = document.getElementById('btnCloseSoundModal');
const btnCancelSoundModal = document.getElementById('btnCancelSoundModal');
const btnSbResetDefaults = document.getElementById('btnSbResetDefaults');
const soundboardVolumeInput = document.getElementById('soundboardVolume');
const sbSelectTypeEl = document.getElementById('sbSelectType');
const sbFileInputEl = document.getElementById('sbFileInput');
const btnSbPreviewEl = document.getElementById('btnSbPreview');
const btnSbSaveEl = document.getElementById('btnSbSave');

if (btnOpenSoundModal) {
    btnOpenSoundModal.addEventListener('click', () => {
        resetSbForm();
        renderSoundListManager();
        if (soundboardModal) soundboardModal.classList.add('open');
    });
}

function closeSoundModal() {
    if (soundboardModal) soundboardModal.classList.remove('open');
    resetSbForm();
}

if (btnCloseSoundModal) btnCloseSoundModal.addEventListener('click', closeSoundModal);
if (btnCancelSoundModal) btnCancelSoundModal.addEventListener('click', closeSoundModal);

if (sbSelectTypeEl) {
    sbSelectTypeEl.addEventListener('change', (e) => updateSbTypeView(e.target.value));
}

if (sbFileInputEl) {
    sbFileInputEl.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) {
            alert('Audio file exceeds 8MB. Please choose a smaller sound file.');
            sbFileInputEl.value = '';
            return;
        }
        const status = document.getElementById('sbUploadStatus');
        if (status) status.textContent = 'Reading file...';
        const reader = new FileReader();
        reader.onload = (ev) => {
            sbTempUploadedData = ev.target.result;
            if (status) status.textContent = `✓ Loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        };
        reader.onerror = () => {
            alert('Failed to read audio file.');
            if (status) status.textContent = 'Upload failed';
        };
        reader.readAsDataURL(file);
    });
}

if (btnSbPreviewEl) {
    btnSbPreviewEl.addEventListener('click', () => {
        const type = document.getElementById('sbSelectType').value;
        if (type === 'preset') {
            const preset = document.getElementById('sbSelectPreset').value;
            playSynthesizedSound(preset, soundboardVolume);
        } else if (type === 'upload') {
            const editIdx = parseInt(document.getElementById('sbEditIndex').value, 10);
            const audioData = sbTempUploadedData || (editIdx >= 0 && soundboardSounds[editIdx]?.audioData);
            if (!audioData) {
                alert('Please choose an audio file first!');
                return;
            }
            const audio = new Audio(audioData);
            audio.volume = soundboardVolume;
            audio.play().catch(e => alert('Cannot play audio: ' + e.message));
        } else if (type === 'url') {
            const url = document.getElementById('sbUrlInput').value.trim();
            if (!url) {
                alert('Please enter an audio URL first!');
                return;
            }
            const audio = new Audio(url);
            audio.volume = soundboardVolume;
            audio.play().catch(e => alert('Cannot play audio URL: ' + e.message));
        }
    });
}

if (btnSbSaveEl) {
    btnSbSaveEl.addEventListener('click', () => {
        const name = document.getElementById('sbInputName').value.trim();
        const icon = document.getElementById('sbInputIcon').value.trim() || '🔊';
        const type = document.getElementById('sbSelectType').value;
        const editIdx = parseInt(document.getElementById('sbEditIndex').value, 10);

        if (!name) {
            alert('Please give your sound button a name.');
            document.getElementById('sbInputName').focus();
            return;
        }

        const soundItem = {
            id: editIdx >= 0 && soundboardSounds[editIdx] ? soundboardSounds[editIdx].id : 'sb_' + Date.now(),
            name,
            icon,
            type
        };

        if (type === 'preset') {
            soundItem.preset = document.getElementById('sbSelectPreset').value;
        } else if (type === 'upload') {
            const audioData = sbTempUploadedData || (editIdx >= 0 && soundboardSounds[editIdx]?.audioData);
            if (!audioData) {
                alert('Please upload an audio file first!');
                return;
            }
            soundItem.audioData = audioData;
        } else if (type === 'url') {
            const url = document.getElementById('sbUrlInput').value.trim();
            if (!url) {
                alert('Please enter a valid audio URL!');
                document.getElementById('sbUrlInput').focus();
                return;
            }
            soundItem.url = url;
        }

        if (editIdx >= 0 && editIdx < soundboardSounds.length) {
            soundboardSounds[editIdx] = soundItem;
        } else {
            soundboardSounds.push(soundItem);
        }

        localStorage.setItem(getProfileKey('soundboard'), JSON.stringify(soundboardSounds));
        renderSoundboard();
        renderSoundListManager();
        resetSbForm();
    });
}

if (btnSbResetDefaults) {
    btnSbResetDefaults.addEventListener('click', () => {
        if (confirm('Reset all soundboard buttons back to default presets?')) {
            soundboardSounds = JSON.parse(JSON.stringify(defaultSoundboard));
            localStorage.setItem(getProfileKey('soundboard'), JSON.stringify(soundboardSounds));
            renderSoundboard();
            renderSoundListManager();
            resetSbForm();
        }
    });
}

if (soundboardVolumeInput) {
    soundboardVolumeInput.addEventListener('input', (e) => {
        soundboardVolume = parseFloat(e.target.value);
        localStorage.setItem(getProfileKey('soundboard_vol'), soundboardVolume.toString());
    });
}

// Credentials & Connections
btnConnect.addEventListener('click', async () => {
    let username = botUsernameInput.value.trim();
    let oauth = oauthTokenInput.value.trim() || localStorage.getItem(getProfileKey('oauth')) || '';
    let channel = targetChannelInput.value.trim() || localStorage.getItem(getProfileKey('channel')) || '';

    if (!username) {
        username = localStorage.getItem(getProfileKey('user')) || channel;
        botUsernameInput.value = username;
    }

    if (!username || !channel) return alert('Please enter Bot Username and Channel name!');
    if (!oauth) return alert('Please enter your Twitch OAuth Token! Click the Twitch API link to generate one.');

    btnConnect.disabled = true;
    const origHtml = btnConnect.innerHTML;
    btnConnect.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';

    try {
        // First try client-side WebSocket IRC
        const ok = await connectClientTmi(username, oauth, channel);
        if (!ok) {
            // Fallback to local server API if running on localhost
            try {
                await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, oauth, channel })
                });
            } catch (e) {}
        }
    } finally {
        btnConnect.disabled = false;
        btnConnect.innerHTML = origHtml;
    }
});

btnDisconnect.addEventListener('click', async () => {
    userExplicitlyDisconnected = true;
    if (clientTmi) {
        await clientTmi.disconnect();
        clientTmi = null;
        updateStatusUI('disconnected');
    }
    try { await fetch('/api/disconnect', { method: 'POST' }); } catch (e) {}
});

// Profile Switcher Modal & Account Management
const accountModal = document.getElementById('accountModal');
const btnSwitchAccount = document.getElementById('btnSwitchAccount');
const btnCloseAccountModal = document.getElementById('btnCloseAccountModal');
const btnCancelAccountModal = document.getElementById('btnCancelAccountModal');
const profileSelectDropdown = document.getElementById('profileSelectDropdown');
const btnLoadProfile = document.getElementById('btnLoadProfile');
const newProfileName = document.getElementById('newProfileName');
const newProfileChannel = document.getElementById('newProfileChannel');
const btnCreateProfile = document.getElementById('btnCreateProfile');
const activeAccountName = document.getElementById('activeAccountName');

function updateProfilesDropdown() {
    if (profileSelectDropdown) {
        profileSelectDropdown.innerHTML = '';
        allProfiles.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name + (p.channel ? ` (#${p.channel})` : '');
            if (p.id === currentProfileId) opt.selected = true;
            profileSelectDropdown.appendChild(opt);
        });
    }

    const active = allProfiles.find(p => p.id === currentProfileId);
    if (active && activeAccountName) {
        activeAccountName.textContent = active.name;
    } else if (activeAccountName) {
        activeAccountName.textContent = 'Streamer';
    }
}

if (btnSwitchAccount && accountModal) {
    btnSwitchAccount.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'login.html';
    });
}
if (btnCloseAccountModal && accountModal) btnCloseAccountModal.addEventListener('click', () => accountModal.classList.remove('open'));
if (btnCancelAccountModal && accountModal) btnCancelAccountModal.addEventListener('click', () => accountModal.classList.remove('open'));

btnLoadProfile.addEventListener('click', async () => {
    const selectedId = profileSelectDropdown.value;
    if (selectedId === currentProfileId) {
        accountModal.classList.remove('open');
        return;
    }

    if (clientTmi) {
        try { await clientTmi.disconnect(); } catch (e) {}
        clientTmi = null;
        updateStatusUI('disconnected');
    }

    currentProfileId = selectedId;
    localStorage.setItem('msp_active_profile', currentProfileId);
    loadProfileData();
    accountModal.classList.remove('open');
    initApp();
});

// Helper function to extract channel name if user pastes full twitch.tv/username URL
function sanitizeChannelName(input) {
    if (!input) return '';
    let val = input.trim().toLowerCase();
    val = val.replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '');
    val = val.replace(/^#/, '');
    val = val.split('/')[0].split('?')[0];
    return val;
}

btnCreateProfile.addEventListener('click', () => {
    const name = newProfileName.value.trim();
    const chan = sanitizeChannelName(newProfileChannel.value);
    if (!name) return alert('Please enter a profile name');

    const newId = 'prof_' + Date.now();
    allProfiles.push({ id: newId, name, channel: chan });
    localStorage.setItem('msp_profiles_list', JSON.stringify(allProfiles));

    currentProfileId = newId;
    localStorage.setItem('msp_active_profile', currentProfileId);

    if (chan) {
        localStorage.setItem(getProfileKey('channel'), chan);
    }

    loadProfileData();
    newProfileName.value = '';
    newProfileChannel.value = '';
    accountModal.classList.remove('open');
    initApp();
});

// Check URL Hash for Twitch OAuth Redirects (e.g. #access_token=...)
async function checkOAuthRedirect() {
    const hash = window.location.hash;
    const search = window.location.search;

    if ((hash && hash.includes('error=')) || (search && search.includes('error='))) {
        const queryStr = hash && hash.includes('error=') ? hash.substring(1) : search.substring(1);
        const errParams = new URLSearchParams(queryStr);
        const errType = errParams.get('error');
        const errDesc = errParams.get('error_description') || errType;
        window.history.replaceState(null, null, window.location.pathname);
        if (errType === 'access_denied') {
            window.location.href = 'login.html';
            return true;
        }
        alert(`Twitch Notice: ${errDesc}\n\nPlease verify that your Twitch Developer Console has "${window.location.origin}" in OAuth Redirect URLs.`);
        return true;
    }

    if (hash && hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        if (token) {
            window.history.replaceState(null, null, window.location.pathname);
            try {
                const valRes = await fetch('https://id.twitch.tv/oauth2/validate', {
                    headers: { 'Authorization': 'OAuth ' + token }
                });
                if (valRes.ok) {
                    const valData = await valRes.json();
                    const username = valData.login.toLowerCase();
                    const userId = valData.user_id;
                    const formattedToken = 'oauth:' + token;
                    
                    const profileId = 'prof_' + userId;
                    currentProfileId = profileId;
                    localStorage.setItem('msp_active_profile', profileId);

                    let pIdx = allProfiles.findIndex(p => p.id === profileId || p.channel === username);
                    if (pIdx !== -1) {
                        allProfiles[pIdx].id = profileId;
                        allProfiles[pIdx].name = username;
                        allProfiles[pIdx].channel = username;
                    } else {
                        allProfiles.push({ id: profileId, name: username, channel: username });
                    }
                    localStorage.setItem('msp_profiles_list', JSON.stringify(allProfiles));
                    if (activeAccountName) activeAccountName.textContent = username;

                    localStorage.setItem(getProfileKey('user'), username);
                    localStorage.setItem(getProfileKey('channel'), username);
                    localStorage.setItem(getProfileKey('oauth'), formattedToken);

                    botUsernameInput.value = username;
                    targetChannelInput.value = username;
                    oauthTokenInput.value = '';
                    oauthTokenInput.placeholder = 'oauth:•••••••• (saved for this profile)';

                    loadProfileData();
                    renderDeck();
                    renderTimers(timedAnnouncements);
                    renderCommands(customCommands);
                    renderSoundboard();

                    await connectClientTmi(username, formattedToken, username);
                    return true;
                }
            } catch (e) {
                console.error('Validate error:', e);
            }

            oauthTokenInput.value = 'oauth:' + token;
            localStorage.setItem(getProfileKey('oauth'), 'oauth:' + token);
            alert('Twitch Token imported! Click Connect Bot to activate.');
            return true;
        }
    }
    return false;
}

// Load Saved LocalStorage Credentials
async function initApp() {
    const oauthHandled = await checkOAuthRedirect();
    if (oauthHandled) {
        return;
    }

    loadProfileData();
    renderDeck();
    renderTimers(timedAnnouncements);
    renderCommands(customCommands);
    renderSoundboard();

    const active = allProfiles.find(p => p.id === currentProfileId);
    if (active) {
        activeAccountName.textContent = active.name;
    }

    const savedChan = localStorage.getItem(getProfileKey('channel')) || (active ? active.channel : '');
    const savedUser = localStorage.getItem(getProfileKey('user')) || savedChan || '';
    const savedOauth = localStorage.getItem(getProfileKey('oauth')) || '';

    botUsernameInput.value = savedUser;
    targetChannelInput.value = savedChan;
    oauthTokenInput.value = '';
    oauthTokenInput.placeholder = savedOauth ? 'oauth:•••••••• (saved for this profile)' : 'oauth:••••••••••••••••';

    // Auto-connect if credentials exist for this profile
    if (savedUser && savedOauth && savedChan) {
        connectClientTmi(savedUser, savedOauth, savedChan);
    }
}

// Ensure background keep-alive audio anchor activates on first click
window.addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    startBackgroundKeepAlive();
}, { once: true });

initApp();
