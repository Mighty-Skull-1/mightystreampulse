// Default Stream Deck Quick Action Buttons
const defaultButtons = [
    {
        id: 'welcome',
        title: 'Welcome Chat',
        category: 'Greet',
        icon: 'fa-hand-wave',
        message: '👋 Welcome into the stream everyone! Make sure to say hi in chat and hit that follow button!'
    },
    {
        id: 'socials',
        title: 'Share Socials',
        category: 'Links',
        icon: 'fa-share-nodes',
        message: '🌐 Follow my socials! Twitter: @YourHandle | YouTube: @YourChannel | TikTok: @YourStream'
    },
    {
        id: 'discord',
        title: 'Discord Squad',
        category: 'Links',
        icon: 'fa-brands fa-discord',
        message: '💬 Looking for people to game with? Join our Discord community here: https://discord.gg/yourserver'
    },
    {
        id: 'hype',
        title: 'Hype Wave',
        category: 'Hype',
        icon: 'fa-fire-flame-curved',
        message: '🔥🔥🔥 HYPE IN THE CHAT! Drop your favorite emotes right now! LET\'S GOOO! 🔥🔥🔥'
    },
    {
        id: 'rules',
        title: 'Chat Rules',
        category: 'Mod',
        icon: 'fa-shield-halved',
        message: '📜 Chat Rules: 1. Be respectful to all. 2. No hate speech or harassment. 3. No links or self promo.'
    },
    {
        id: 'hydrate',
        title: 'Hydrate Check',
        category: 'Gaming',
        icon: 'fa-bottle-water',
        message: '💧 HYDRATE CHECK! Remember to drink water and do a quick stretch, chat fam!'
    },
    {
        id: 'gg',
        title: 'GG Big Play',
        category: 'Gaming',
        icon: 'fa-trophy',
        message: '🏆 GG! What an insane play! Drop some GGs in chat!'
    },
    {
        id: 'prime',
        title: 'Prime Gaming Sub',
        category: 'Support',
        icon: 'fa-crown',
        message: '👑 Did you know? You get a FREE channel subscription every month with Amazon Prime! Type !prime to support the stream!'
    }
];

let deckButtons = JSON.parse(localStorage.getItem('streampulse_buttons')) || defaultButtons;
let timedAnnouncements = [];
let customCommands = {};
let ttsEnabled = false;

// Audio Synthesizer (Local Sound FX without external files)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playFx(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
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

// Text-to-Speech (TTS)
function speakText(text) {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/(https?:\/\/[^\s]+)/g, 'a link').slice(0, 150);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}

// Confetti Particle Effect
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
    btn.addEventListener('click', () => {
        const sound = btn.getAttribute('data-sound');
        playFx(sound);
    });
});

// TTS Toggle
ttsToggle.addEventListener('change', (e) => {
    ttsEnabled = e.target.checked;
    if (ttsEnabled) {
        speakText('Text to speech activated!');
    }
});

btnHypeTrain.addEventListener('click', async () => {
    triggerConfetti();
    sendChatMessage('🎉🎉🎉 HYPE TRAIN / CELEBRATION ACTIVATED! Let\'s go chat! 🔥🔥🔥');
    await fetch('/api/obs_alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '🔥 HYPE TRAIN ACTIVATED!', message: 'Drop those emotes in chat right now!' })
    });
});

// WebSocket Setup
let ws;
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'init') {
            updateStatusUI(data.status, data.channel);
            if (data.stats) updateStatsUI(data.stats);
            if (data.timedAnnouncements) renderTimers(data.timedAnnouncements);
            if (data.customCommands) renderCommands(data.customCommands);
            if (data.giveaway) updateGiveawayUI(data.giveaway);
            if (data.poll) updatePollPreview(data.poll.question, data.poll.options);
        } else if (data.type === 'status') {
            updateStatusUI(data.status, data.channel);
        } else if (data.type === 'stat_update') {
            updateStatsUI(data.stats);
        } else if (data.type === 'chat_message') {
            appendChatMessage(data);
            if (ttsEnabled && !data.isSelf) {
                speakText(`${data.displayName} says: ${data.message}`);
            }
        } else if (data.type === 'giveaway_update') {
            document.getElementById('giveawayEntrantsCount').textContent = data.count || 0;
        } else if (data.type === 'giveaway_winner') {
            const winnerBox = document.getElementById('giveawayWinnerBox');
            winnerBox.style.display = 'block';
            document.getElementById('winnerName').textContent = data.winner;
            triggerConfetti();
        } else if (data.type === 'poll_update') {
            updatePollPreview(data.question, data.options);
        } else if (data.type === 'poll_end') {
            document.getElementById('pollLiveDisplay').style.display = 'none';
        }
    };

    ws.onclose = () => setTimeout(initWebSocket, 2000);
}

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
            <div class="card-title">${btn.title}</div>
            <div class="card-desc" title="${btn.message}">${btn.message}</div>
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
            localStorage.setItem('streampulse_buttons', JSON.stringify(deckButtons));
            renderDeck();
        });

        deckGrid.appendChild(card);
    });
}

async function sendChatMessage(message) {
    if (!message || !message.trim()) return;
    try {
        const res = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message.trim() })
        });
        const result = await res.json();
        if (!result.success) {
            alert('Error sending message: ' + (result.error || 'Unknown error'));
        }
    } catch (e) {
        console.error('Send error:', e);
    }
}

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
        <span class="user" style="color: ${data.color}">${data.displayName}:</span>
        <span class="text">${escapeHtml(data.message)}</span>
    `;

    chatFeed.appendChild(row);
    chatFeed.scrollTop = chatFeed.scrollHeight;

    if (data.isReward) {
        playFx('ding');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Interactive Games & Polls
document.getElementById('btnStartPoll').addEventListener('click', async () => {
    const q = document.getElementById('pollQuestionInput').value.trim();
    const optsStr = document.getElementById('pollOptionsInput').value.trim();
    if (!q || !optsStr) {
        alert('Please provide a question and comma-separated options.');
        return;
    }
    const options = optsStr.split(',').map(s => s.trim()).filter(Boolean);
    if (options.length < 2) {
        alert('Provide at least 2 options.');
        return;
    }

    await fetch('/api/poll/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, options })
    });
});

document.getElementById('btnEndPoll').addEventListener('click', async () => {
    await fetch('/api/poll/end', { method: 'POST' });
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
document.getElementById('btnStartGiveaway').addEventListener('click', async () => {
    const keyword = document.getElementById('giveawayKeyword').value.trim();
    if (!keyword) return;
    document.getElementById('giveawayWinnerBox').style.display = 'none';
    await fetch('/api/giveaway/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword })
    });
});

document.getElementById('btnPickWinner').addEventListener('click', async () => {
    const res = await fetch('/api/giveaway/pick', { method: 'POST' });
    const data = await res.json();
    if (!data.success) alert(data.error);
});

document.getElementById('btnEndGiveaway').addEventListener('click', async () => {
    await fetch('/api/giveaway/end', { method: 'POST' });
    document.getElementById('giveawayWinnerBox').style.display = 'none';
    document.getElementById('giveawayEntrantsCount').textContent = '0';
});

// Trivia
document.getElementById('btnStartTrivia').addEventListener('click', async () => {
    const question = document.getElementById('triviaQuestion').value.trim();
    const answer = document.getElementById('triviaAnswer').value.trim();
    if (!question || !answer) {
        alert('Provide question and answer');
        return;
    }
    await fetch('/api/trivia/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer })
    });
    alert('Trivia broadcast to Twitch chat!');
});

// Moderation Controls
async function execModeration(action, subAction = null) {
    const act = subAction || action;
    const res = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: act })
    });
    const result = await res.json();
    if (result.success) {
        alert(`Executed ${result.command} on Twitch chat!`);
    } else {
        alert(`Error: ${result.error}`);
    }
}

document.querySelectorAll('.mod-card').forEach(card => {
    const action = card.getAttribute('data-action');
    if (action === 'clear') {
        card.querySelector('button').addEventListener('click', () => execModeration('clear'));
    } else {
        card.querySelectorAll('.btn-sub').forEach(btn => {
            btn.addEventListener('click', () => {
                const sub = btn.getAttribute('data-sub');
                execModeration(action, sub);
            });
        });
    }
});

document.getElementById('btnExecuteTimeout').addEventListener('click', async () => {
    const target = document.getElementById('timeoutUsername').value.trim();
    const duration = document.getElementById('timeoutSeconds').value;
    if (!target) {
        alert('Enter a username to timeout');
        return;
    }
    const res = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'timeout', target, duration })
    });
    const data = await res.json();
    if (data.success) {
        alert(`Timed out ${target} for ${duration}s!`);
        document.getElementById('timeoutUsername').value = '';
    }
});

// OBS Overlay Controls
document.getElementById('btnCopyOverlay').addEventListener('click', () => {
    const copyText = document.getElementById('overlayUrlInput');
    copyText.select();
    navigator.clipboard.writeText(copyText.value);
    alert('OBS Overlay URL copied to clipboard!');
});

document.getElementById('btnTestObsAlert').addEventListener('click', async () => {
    await fetch('/api/obs_alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'TEST BROADCAST ALERT', message: 'StreamPulse Overlay is connected and looking crisp!' })
    });
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
        alert('Please fill in a valid title, message, and positive interval in minutes.');
        return;
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

    await fetch('/api/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timedAnnouncements })
    });

    renderTimers(timedAnnouncements);
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

        const editBtn = card.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => {
            openTimerModal(idx);
        });

        const delBtn = card.querySelector('.del-btn');
        delBtn.addEventListener('click', async () => {
            if (confirm(`Are you sure you want to delete the "${t.name}" reminder?`)) {
                timedAnnouncements.splice(idx, 1);
                await fetch('/api/timers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ timedAnnouncements })
                });
                renderTimers(timedAnnouncements);
            }
        });

        const toggle = card.querySelector('input[type="checkbox"]');
        toggle.addEventListener('change', async (e) => {
            timedAnnouncements[idx].enabled = e.target.checked;
            await fetch('/api/timers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timedAnnouncements })
            });
        });

        container.appendChild(card);
    });
}

document.getElementById('btnAddTimer').addEventListener('click', () => {
    openTimerModal(-1);
});

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

function closeCmdModal() {
    cmdModal.classList.remove('open');
}

btnCloseCmdModal.addEventListener('click', closeCmdModal);
btnCancelCmdModal.addEventListener('click', closeCmdModal);

btnSaveCmdModal.addEventListener('click', async () => {
    const origCmd = modalOrigCmd.value.trim().toLowerCase();
    let newCmd = modalCmdName.value.trim().toLowerCase();
    const newResp = modalCmdResp.value.trim();

    if (!newCmd || !newResp) {
        alert('Please provide both the command trigger and the reply!');
        return;
    }
    if (!newCmd.startsWith('!')) newCmd = '!' + newCmd;

    // If command trigger renamed, delete old key first
    if (origCmd && origCmd !== newCmd) {
        await fetch(`/api/commands/${encodeURIComponent(origCmd)}`, { method: 'DELETE' });
        delete customCommands[origCmd];
    }

    const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: newCmd, response: newResp })
    });
    const data = await res.json();
    if (data.success) {
        renderCommands(data.customCommands);
        closeCmdModal();
    }
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

        row.querySelector('.edit-cmd').addEventListener('click', () => {
            openCmdModal(cmd, commands[cmd]);
        });

        row.querySelector('.del-cmd').addEventListener('click', async () => {
            if (confirm(`Are you sure you want to delete the ${cmd} command?`)) {
                await fetch(`/api/commands/${encodeURIComponent(cmd)}`, { method: 'DELETE' });
                delete customCommands[cmd];
                renderCommands(customCommands);
            }
        });

        tbody.appendChild(row);
    });
}

document.getElementById('btnSaveCmd').addEventListener('click', async () => {
    let cmd = document.getElementById('newCmdName').value.trim();
    const resp = document.getElementById('newCmdResp').value.trim();

    if (!cmd || !resp) {
        alert('Please provide both the command trigger and the reply!');
        return;
    }
    if (!cmd.startsWith('!')) cmd = '!' + cmd;

    const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, response: resp })
    });
    const data = await res.json();
    if (data.success) {
        renderCommands(data.customCommands);
        document.getElementById('newCmdName').value = '';
        document.getElementById('newCmdResp').value = '';
    }
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

// Modal Controls
const addBtnModal = document.getElementById('addBtnModal');
document.getElementById('btnOpenAddModal').addEventListener('click', () => addBtnModal.classList.add('open'));
document.getElementById('btnCloseModal').addEventListener('click', () => addBtnModal.classList.remove('open'));
document.getElementById('btnCancelModal').addEventListener('click', () => addBtnModal.classList.remove('open'));

document.getElementById('btnConfirmAdd').addEventListener('click', () => {
    const title = document.getElementById('modalBtnTitle').value.trim();
    const category = document.getElementById('modalBtnCategory').value;
    const message = document.getElementById('modalBtnMsg').value.trim();

    if (!title || !message) {
        alert('Fill in both title and message.');
        return;
    }

    deckButtons.push({
        id: 'btn_' + Date.now(),
        title,
        category,
        icon: 'fa-solid fa-bolt',
        message
    });

    localStorage.setItem('streampulse_buttons', JSON.stringify(deckButtons));
    renderDeck();
    addBtnModal.classList.remove('open');
    document.getElementById('modalBtnTitle').value = '';
    document.getElementById('modalBtnMsg').value = '';
});

// Credentials & Connections
btnConnect.addEventListener('click', async () => {
    const username = botUsernameInput.value.trim();
    const oauth = oauthTokenInput.value.trim();
    const channel = targetChannelInput.value.trim();

    if (!username || !channel) {
        alert('Please fill in your Bot Username and Channel name!');
        return;
    }

    statusIndicator.className = 'status-indicator connecting';
    statusText.textContent = 'Connecting...';

    const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, oauth, channel })
    });
    const result = await res.json();
    if (!result.success) {
        alert('Connection error: ' + (result.error || result.message));
    }
});

btnDisconnect.addEventListener('click', async () => {
    await fetch('/api/disconnect', { method: 'POST' });
});

// Initial Load
async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (data.username) botUsernameInput.value = data.username;
        if (data.channel) targetChannelInput.value = data.channel;
        if (data.hasOauth) oauthTokenInput.placeholder = 'oauth:•••••••• (saved in .env)';
        updateStatusUI(data.status, data.channel);
        if (data.stats) updateStatsUI(data.stats);
        if (data.timedAnnouncements) renderTimers(data.timedAnnouncements);
        if (data.customCommands) renderCommands(data.customCommands);
    } catch (e) {
        console.error('Failed to load config:', e);
    }
}

renderDeck();
loadConfig();
initWebSocket();
