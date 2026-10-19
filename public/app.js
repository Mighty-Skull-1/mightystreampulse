// MightyStreamPulse Client Engine (Works BOTH locally with Node.js and publicly on Netlify / Vercel)
const defaultButtons = [
    { id: 'welcome', title: 'Welcome Chat', category: 'Greet', icon: 'fa-hand-wave', message: '👋 Welcome into the stream everyone! Make sure to say hi in chat and hit that follow button!' },
    { id: 'socials', title: 'Share Socials', category: 'Links', icon: 'fa-share-nodes', message: '🌐 Follow my socials! Twitter: @YourHandle | YouTube: @YourChannel | TikTok: @YourStream' },
    { id: 'discord', title: 'Discord Squad', category: 'Links', icon: 'fa-brands fa-discord', message: '💬 Looking for people to game with? Join our Discord community here: https://discord.gg/yourserver' },
    { id: 'hype', title: 'Hype Wave', category: 'Hype', icon: 'fa-fire-flame-curved', message: '🔥🔥🔥 HYPE IN THE CHAT! Drop your favorite emotes right now! LET\'S GOOO! 🔥🔥🔥' },
    { id: 'rules', title: 'Chat Rules', category: 'Mod', icon: 'fa-shield-halved', message: '📜 Chat Rules: 1. Be respectful to all. 2. No hate speech or harassment. 3. No links or self promo.' },
    { id: 'hydrate', title: 'Hydrate Check', category: 'Gaming', icon: 'fa-bottle-water', message: '💧 HYDRATE CHECK! Remember to drink water and do a quick stretch, chat fam!' },
    { id: 'gg', title: 'GG Big Play', category: 'Gaming', icon: 'fa-trophy', message: '🏆 GG! What an insane play! Drop some GGs in chat!' },
    { id: 'prime', title: 'Prime Gaming Sub', category: 'Support', icon: 'fa-crown', message: '👑 Did you know? You get a FREE channel subscription every month with Amazon Prime! Type !prime to support the stream!' }
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
}

// State
let deckButtons = defaultButtons;
let timedAnnouncements = defaultTimers;
let customCommands = defaultCommands;
loadProfileData();

let clientStats = { messagesSent: 0, messagesReceived: 0, activeChatters: {} };
let ttsEnabled = false;

// Client-side Browser IRC Mode
let clientTmi = null;
let clientTimers = {};
let activeGiveaway = null;
let activePoll = null;
let activeTrivia = null;

// Audio Synthesizer
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playFx(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'hype') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
    } else if (type === 'applause') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'ding') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.50, now);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.8);
    } else if (type === 'drum') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
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

// Sound Buttons
document.querySelectorAll('.fx-btn').forEach(btn => {
    btn.addEventListener('click', () => playFx(btn.getAttribute('data-sound')));
});

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
        card.innerHTML = `
            <div class="card-top">
                <i class="card-icon ${btn.icon || 'fa-solid fa-comment-dots'}"></i>
                <span class="card-badge">${btn.category || 'Chat'}</span>
            </div>
            <div class="card-title">${escapeHtml(btn.title)}</div>
            <div class="card-desc" title="${escapeHtml(btn.message)}">${escapeHtml(btn.message)}</div>
            <button class="card-delete" title="Delete" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-delete')) return;
            sendChatMessage(btn.message);
            playFx('ding');
        });

        const delBtn = card.querySelector('.card-delete');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deckButtons.splice(index, 1);
            localStorage.setItem(getProfileKey('buttons'), JSON.stringify(deckButtons));
            renderDeck();
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
                displayName: (botUsernameInput.value.trim() || 'You') + ' [BOT]',
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

// Append Chat Message
function appendChatMessage(data) {
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

// Connect Logic (Direct Browser Client Mode)
async function connectClientTmi(username, oauth, channel) {
    if (clientTmi) {
        try { await clientTmi.disconnect(); } catch (e) {}
        clientTmi = null;
    }

    let token = (oauth || '').trim();
    if (!token) {
        token = localStorage.getItem(getProfileKey('oauth')) || '';
    }
    if (!token) {
        updateStatusUI('disconnected');
        alert('Please enter your Twitch OAuth Token first!\nYou can click "Verify & Connect With Twitch API" or visit https://twitchapps.com/tmi/ to generate one.');
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
        alert('Please provide your Twitch username and target channel.');
        return false;
    }

    updateStatusUI('connecting', chan);

    let authFailed = false;

    clientTmi = new tmi.Client({
        options: { debug: false },
        connection: {
            reconnect: false, // Prevent infinite hanging retry loop during auth check
            secure: true
        },
        identity: { username: user, password: token },
        channels: [chan]
    });

    clientTmi.on('connected', () => {
        updateStatusUI('connected', chan);
        startClientTimers();
    });

    clientTmi.on('join', (channelName, username, self) => {
        if (self) {
            updateStatusUI('connected', chan);
        }
    });

    clientTmi.on('disconnected', (reason) => {
        updateStatusUI('disconnected', chan);
        Object.values(clientTimers).forEach(id => clearInterval(id));
    });

    // Capture Twitch authentication failure notices from raw messages
    clientTmi.on('raw_message', (msgCloned, msg) => {
        if (msg && msg.command === 'NOTICE' && msg.params) {
            const rawText = msg.params.join(' ');
            if (rawText.toLowerCase().includes('login authentication failed') || rawText.toLowerCase().includes('improperly formatted auth') || rawText.toLowerCase().includes('login unsuccessful')) {
                authFailed = true;
                updateStatusUI('disconnected', chan);
                alert(`Twitch Login Failed: ${rawText}\n\nTroubleshooting tips:\n1. Your Bot Username must be in all-lowercase (e.g. "${user}").\n2. The Bot Username must match the exact Twitch account that generated the OAuth token.\n3. Verify your token at https://twitchapps.com/tmi/`);
            }
        }
    });

    clientTmi.on('notice', (channel, msgid, message) => {
        if (msgid === 'msg_channel_suspended' || msgid === 'login_unsuccessful') {
            authFailed = true;
            updateStatusUI('disconnected', chan);
            alert('Twitch Login Error: ' + message);
        }
    });

    clientTmi.on('message', async (channelName, tags, message, self) => {
        const chatter = tags['display-name'] || tags.username;
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
        await Promise.race([connectPromise, timeoutPromise]);

        if (authFailed) {
            throw new Error('Authentication rejected by Twitch.');
        }

        updateStatusUI('connected', chan);
        startClientTimers();

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
        updateStatusUI('disconnected');
        try { await clientTmi.disconnect(); } catch (e) {}
        clientTmi = null;
        if (!authFailed) {
            alert('Failed to connect to Twitch: ' + (err.message || err));
        }
        return false;
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
                else if (sub === 'slow_on') execModeration('/slow 30');
                else if (sub === 'slow_off') execModeration('/slowoff');
                else if (sub === 'subscribers_on') execModeration('/subscribers');
                else if (sub === 'subscribers_off') execModeration('/subscribersoff');
            });
        });
    }
});

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

// Add Deck Button Modal
const addBtnModal = document.getElementById('addBtnModal');
document.getElementById('btnOpenAddModal').addEventListener('click', () => addBtnModal.classList.add('open'));
document.getElementById('btnCloseModal').addEventListener('click', () => addBtnModal.classList.remove('open'));
document.getElementById('btnCancelModal').addEventListener('click', () => addBtnModal.classList.remove('open'));

document.getElementById('btnConfirmAdd').addEventListener('click', () => {
    const title = document.getElementById('modalBtnTitle').value.trim();
    const category = document.getElementById('modalBtnCategory').value;
    const message = document.getElementById('modalBtnMsg').value.trim();

    if (!title || !message) return alert('Fill in both title and message.');

    deckButtons.push({ id: 'btn_' + Date.now(), title, category, icon: 'fa-solid fa-bolt', message });
    localStorage.setItem(getProfileKey('buttons'), JSON.stringify(deckButtons));
    renderDeck();
    addBtnModal.classList.remove('open');
    document.getElementById('modalBtnTitle').value = '';
    document.getElementById('modalBtnMsg').value = '';
});

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
            return;
        }
        alert(`Twitch Notice: ${errDesc}\n\nPlease verify that your Twitch Developer Console has "${window.location.origin}" in OAuth Redirect URLs.`);
        return;
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

                    connectClientTmi(username, formattedToken, username);
                    return;
                }
            } catch (e) {}

            oauthTokenInput.value = 'oauth:' + token;
            localStorage.setItem(getProfileKey('oauth'), 'oauth:' + token);
            alert('Twitch Token imported! Click Connect Bot to activate.');
        }
    }
}

// Load Saved LocalStorage Credentials
function initApp() {
    checkOAuthRedirect();
    loadProfileData();
    renderDeck();
    renderTimers(timedAnnouncements);
    renderCommands(customCommands);

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

initApp();
