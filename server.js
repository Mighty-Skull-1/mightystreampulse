const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const tmi = require('tmi.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const ENV_PATH = path.join(__dirname, '.env');
const DATA_FILE = path.join(__dirname, 'dashboard_data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let twitchClient = null;
let botStatus = 'disconnected';
let currentConfig = {
    username: process.env.BOT_USERNAME || '',
    oauth: process.env.OAUTH_TOKEN || '',
    channel: process.env.CHANNEL || ''
};

// Active State
let timers = {};
let activeGiveaway = null; // { keyword, entrants: Set }
let activePoll = null; // { question, options: [{text, votes: Set}] }
let activeTrivia = null; // { question, answer, reward, solved: bool }

// Default Persistent Data
let appData = {
    timedAnnouncements: [
        {
            id: 'timer-discord',
            name: 'Discord Reminder',
            message: '💬 Looking for friendly gamers to squad up with? Join our Discord community: https://discord.gg/yourserver',
            intervalMinutes: 15,
            enabled: false
        },
        {
            id: 'timer-hydrate',
            name: 'Hydrate & Stretch Reminder',
            message: '💧 Hydrate Check! Drink some water and take a quick posture stretch, chat!',
            intervalMinutes: 30,
            enabled: false
        },
        {
            id: 'timer-follow',
            name: 'Follow / Prime Sub Reminder',
            message: '⭐ Enjoying the stream? Don\'t forget to hit the follow button or link your Amazon Prime for a free sub!',
            intervalMinutes: 20,
            enabled: false
        }
    ],
    customCommands: {
        '!discord': '💬 Join our Discord community here: https://discord.gg/yourserver',
        '!socials': '🌐 Check out my socials: Twitter @yourname | YouTube @yourname | TikTok @yourname',
        '!rules': '📜 1. Be respectful. 2. No spam or self-promo. 3. Have fun and be positive!',
        '!uptime': '⏱️ Stream has been live and rocking! Make sure to stay tuned for more plays!',
        '!game': '🎮 Currently grinding games with chat! Drop suggestions anytime.'
    },
    stats: {
        messagesSent: 0,
        messagesReceived: 0,
        activeChatters: {}
    }
};

if (fs.existsSync(DATA_FILE)) {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        appData = { ...appData, ...parsed };
    } catch (e) {
        console.error('Error loading dashboard_data.json:', e);
    }
}

function saveAppData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(appData, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving dashboard_data.json:', e);
    }
}

function broadcast(type, payload) {
    const data = JSON.stringify({ type, ...payload });
    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(data);
        }
    });
}

function updateEnvFile(config) {
    const content = `# Twitch Bot Configuration\nBOT_USERNAME=${config.username}\nOAUTH_TOKEN=${config.oauth}\nCHANNEL=${config.channel}\nPORT=${PORT}\n`;
    fs.writeFileSync(ENV_PATH, content, 'utf8');
}

// Timers Logic
function setupTimer(timerObj) {
    if (timers[timerObj.id]) {
        clearInterval(timers[timerObj.id]);
        delete timers[timerObj.id];
    }

    if (timerObj.enabled && botStatus === 'connected' && twitchClient) {
        const ms = Math.max(1, timerObj.intervalMinutes) * 60 * 1000;
        timers[timerObj.id] = setInterval(async () => {
            if (twitchClient && botStatus === 'connected' && currentConfig.channel) {
                try {
                    await twitchClient.say(currentConfig.channel, timerObj.message);
                    appData.stats.messagesSent++;
                    broadcast('stat_update', { stats: appData.stats });
                    broadcast('chat_message', {
                        channel: currentConfig.channel,
                        displayName: currentConfig.username + ' [BOT]',
                        color: '#00f0ff',
                        message: timerObj.message,
                        isSelf: true,
                        timestamp: new Date().toLocaleTimeString(),
                        isAutomated: true
                    });
                } catch (e) {
                    console.error(`[Timer] Failed to send ${timerObj.name}:`, e);
                }
            }
        }, ms);
    }
}

function restartAllTimers() {
    Object.keys(timers).forEach(id => clearInterval(timers[id]));
    timers = {};
    if (botStatus === 'connected') {
        appData.timedAnnouncements.forEach(setupTimer);
    }
}

// Connect / Reconnect Twitch Client
async function connectTwitch(config) {
    if (twitchClient) {
        try {
            await twitchClient.disconnect();
        } catch (e) {
            console.error('Error disconnecting existing client:', e);
        }
        twitchClient = null;
    }

    if (!config.username || !config.oauth || !config.channel) {
        botStatus = 'unconfigured';
        broadcast('status', { status: botStatus, message: 'Bot credentials missing' });
        return { success: false, message: 'Please provide Username, OAuth Token, and Channel' };
    }

    let token = config.oauth.trim();
    if (!token.startsWith('oauth:')) {
        token = 'oauth:' + token;
    }

    const channelName = config.channel.trim().toLowerCase().replace('#', '');
    const botUser = config.username.trim().toLowerCase();

    twitchClient = new tmi.Client({
        options: { debug: false },
        identity: {
            username: botUser,
            password: token
        },
        channels: [channelName]
    });

    twitchClient.on('message', async (channel, tags, message, self) => {
        const user = tags['display-name'] || tags.username;
        appData.stats.messagesReceived++;
        if (user) {
            appData.stats.activeChatters[user] = (appData.stats.activeChatters[user] || 0) + 1;
        }

        const customRewardId = tags['custom-reward-id'] || null;
        const msgId = tags['msg-id'] || null;
        const isReward = !!customRewardId || msgId === 'highlighted-message' || msgId === 'custom-reward-redemption';

        const chatObj = {
            channel,
            displayName: user,
            color: tags.color || '#9146FF',
            message,
            badges: tags.badges || {},
            isMod: tags.mod || tags.badges?.broadcaster === '1',
            isSelf: self,
            isReward,
            customRewardId,
            timestamp: new Date().toLocaleTimeString()
        };

        // Broadcast to Dashboard and OBS Overlay
        broadcast('chat_message', chatObj);
        broadcast('stat_update', { stats: { ...appData.stats, chatterCount: Object.keys(appData.stats.activeChatters).length } });

        // If it's a Channel Point Redemption, send an OBS notification banner!
        if (isReward && !self) {
            broadcast('obs_alert', {
                title: '✨ CHANNEL POINTS REDEEMED!',
                message: `${user}: "${message || 'Redeemed custom reward'}"`,
                type: 'reward'
            });
        }

        const trimmed = message.trim();
        const lower = trimmed.toLowerCase();

        // 1. Check Giveaway Entry
        if (activeGiveaway && !self) {
            if (lower === activeGiveaway.keyword.toLowerCase()) {
                activeGiveaway.entrants.add(user);
                broadcast('giveaway_update', { count: activeGiveaway.entrants.size, keyword: activeGiveaway.keyword });
            }
        }

        // 2. Check Poll Vote (e.g. 1, 2, 3...)
        if (activePoll && !self) {
            const voteNum = parseInt(trimmed, 10);
            if (!isNaN(voteNum) && voteNum >= 1 && voteNum <= activePoll.options.length) {
                // remove previous vote if any
                activePoll.options.forEach(opt => opt.voters.delete(user));
                activePoll.options[voteNum - 1].voters.add(user);
                broadcast('poll_update', {
                    question: activePoll.question,
                    options: activePoll.options.map(o => ({ text: o.text, votes: o.voters.size }))
                });
            }
        }

        // 3. Check Trivia Answer
        if (activeTrivia && !activeTrivia.solved && !self) {
            if (lower.includes(activeTrivia.answer.toLowerCase())) {
                activeTrivia.solved = true;
                const winMsg = `🎉 BINGO! @${user} got the correct answer: "${activeTrivia.answer}"! Congratulations! 🧠`;
                try {
                    await twitchClient.say(channel, winMsg);
                    broadcast('chat_message', {
                        channel,
                        displayName: botUser + ' [BOT]',
                        color: '#00f0ff',
                        message: winMsg,
                        isSelf: true,
                        timestamp: new Date().toLocaleTimeString()
                    });
                    broadcast('obs_alert', { title: 'TRIVIA WINNER!', message: `${user} guessed correctly: ${activeTrivia.answer}`, type: 'trivia' });
                } catch (e) {
                    console.error('Trivia win error:', e);
                }
            }
        }

        // 4. Magic 8-Ball Command: !8ball <question>
        if (lower.startsWith('!8ball ') && !self) {
            const answers = [
                '🎱 It is certain!', '🎱 Without a doubt!', '🎱 Reply hazy, try again.',
                '🎱 Ask again later.', '🎱 Don\'t count on it.', '🎱 My sources say no.',
                '🎱 Outlook very good!', '🎱 Signs point to yes! 🔥', '🎱 Highly unlikely!'
            ];
            const answer = answers[Math.floor(Math.random() * answers.length)];
            try {
                await twitchClient.say(channel, `@${user} ${answer}`);
            } catch (e) {}
            return;
        }

        // 5. Custom Command Responses (e.g. !discord, !uptime)
        const cmdKey = trimmed.split(' ')[0].toLowerCase();
        if (!self && appData.customCommands && appData.customCommands[cmdKey]) {
            const reply = appData.customCommands[cmdKey];
            try {
                await twitchClient.say(channel, reply);
                appData.stats.messagesSent++;
                broadcast('chat_message', {
                    channel,
                    displayName: botUser + ' [BOT]',
                    color: '#00f0ff',
                    message: reply,
                    isSelf: true,
                    timestamp: new Date().toLocaleTimeString()
                });
            } catch (err) {
                console.error('[Bot Command Reply Error]:', err);
            }
        }
    });

    twitchClient.on('connected', (addr, port) => {
        botStatus = 'connected';
        console.log(`[Twitch] Connected to ${addr}:${port}`);
        broadcast('status', { status: 'connected', channel: channelName, username: botUser });
        restartAllTimers();
    });

    twitchClient.on('disconnected', (reason) => {
        botStatus = 'disconnected';
        console.log(`[Twitch] Disconnected: ${reason}`);
        broadcast('status', { status: 'disconnected', reason });
        restartAllTimers();
    });

    try {
        botStatus = 'connecting';
        broadcast('status', { status: 'connecting' });
        await twitchClient.connect();
        currentConfig = { username: botUser, oauth: token, channel: channelName };
        updateEnvFile(currentConfig);
        return { success: true };
    } catch (err) {
        botStatus = 'error';
        console.error('[Twitch] Connect error:', err);
        broadcast('status', { status: 'error', error: err.toString() });
        return { success: false, error: err.toString() };
    }
}

// REST APIs
app.get('/api/config', (req, res) => {
    res.json({
        username: currentConfig.username,
        hasOauth: !!currentConfig.oauth,
        channel: currentConfig.channel,
        status: botStatus,
        stats: {
            ...appData.stats,
            chatterCount: Object.keys(appData.stats.activeChatters).length
        },
        timedAnnouncements: appData.timedAnnouncements,
        customCommands: appData.customCommands,
        activeGiveaway: activeGiveaway ? { keyword: activeGiveaway.keyword, count: activeGiveaway.entrants.size } : null,
        activePoll: activePoll ? { question: activePoll.question, options: activePoll.options.map(o => ({ text: o.text, votes: o.voters.size })) } : null,
        activeTrivia: activeTrivia ? { question: activeTrivia.question, solved: activeTrivia.solved } : null
    });
});

app.post('/api/config', async (req, res) => {
    const { username, oauth, channel } = req.body;
    const finalOauth = oauth || currentConfig.oauth;
    const result = await connectTwitch({ username, oauth: finalOauth, channel });
    res.json(result);
});

app.post('/api/disconnect', async (req, res) => {
    if (twitchClient) {
        await twitchClient.disconnect();
        twitchClient = null;
    }
    botStatus = 'disconnected';
    restartAllTimers();
    broadcast('status', { status: 'disconnected' });
    res.json({ success: true });
});

app.post('/api/send', async (req, res) => {
    const { message } = req.body;
    if (!twitchClient || botStatus !== 'connected') {
        return res.status(400).json({ success: false, error: 'Bot is not connected to Twitch chat.' });
    }
    if (!message || !message.trim()) {
        return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
    }

    try {
        await twitchClient.say(currentConfig.channel, message.trim());
        appData.stats.messagesSent++;
        broadcast('stat_update', { stats: appData.stats });
        res.json({ success: true, message: message.trim() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.toString() });
    }
});

// Twitch Moderation API (Say /clear, /slow, /emoteonly, /timeout)
app.post('/api/moderation', async (req, res) => {
    const { action, target, duration } = req.body;
    if (!twitchClient || botStatus !== 'connected') {
        return res.status(400).json({ success: false, error: 'Bot is not connected.' });
    }

    try {
        let cmd = '';
        if (action === 'clear') cmd = '/clear';
        else if (action === 'emoteonly_on') cmd = '/emoteonly';
        else if (action === 'emoteonly_off') cmd = '/emoteonlyoff';
        else if (action === 'slow_on') cmd = `/slow ${duration || 30}`;
        else if (action === 'slow_off') cmd = '/slowoff';
        else if (action === 'subscribers_on') cmd = '/subscribers';
        else if (action === 'subscribers_off') cmd = '/subscribersoff';
        else if (action === 'timeout' && target) cmd = `/timeout ${target} ${duration || 600}`;

        if (cmd) {
            await twitchClient.say(currentConfig.channel, cmd);
            res.json({ success: true, command: cmd });
        } else {
            res.status(400).json({ success: false, error: 'Unknown moderation action' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.toString() });
    }
});

// OBS Overlay Trigger Endpoint
app.post('/api/obs_alert', (req, res) => {
    const { title, message, type } = req.body;
    broadcast('obs_alert', { title, message, type: type || 'hype' });
    res.json({ success: true });
});

// Giveaway Endpoints
app.post('/api/giveaway/start', async (req, res) => {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ success: false, error: 'Keyword required' });

    activeGiveaway = { keyword: keyword.trim(), entrants: new Set() };
    if (twitchClient && botStatus === 'connected') {
        await twitchClient.say(currentConfig.channel, `🎁 GIVEAWAY STARTED! Type "${keyword}" in chat right now to enter! Good luck! 🎁`);
    }
    broadcast('giveaway_update', { count: 0, keyword });
    broadcast('obs_alert', { title: '🎁 GIVEAWAY STARTED!', message: `Type "${keyword}" in chat to enter!`, type: 'giveaway' });
    res.json({ success: true });
});

app.post('/api/giveaway/pick', async (req, res) => {
    if (!activeGiveaway || activeGiveaway.entrants.size === 0) {
        return res.status(400).json({ success: false, error: 'No entrants in giveaway.' });
    }
    const entrantsArray = Array.from(activeGiveaway.entrants);
    const winner = entrantsArray[Math.floor(Math.random() * entrantsArray.length)];

    if (twitchClient && botStatus === 'connected') {
        await twitchClient.say(currentConfig.channel, `🏆 AND THE GIVEAWAY WINNER IS... @${winner}!! Congratulations! 🎉🥳`);
    }
    broadcast('giveaway_winner', { winner });
    broadcast('obs_alert', { title: '🎉 GIVEAWAY WINNER!', message: `@${winner} won the giveaway!`, type: 'winner' });
    res.json({ success: true, winner });
});

app.post('/api/giveaway/end', (req, res) => {
    activeGiveaway = null;
    broadcast('giveaway_update', { count: 0, closed: true });
    res.json({ success: true });
});

// Trivia Endpoints
app.post('/api/trivia/start', async (req, res) => {
    const { question, answer } = req.body;
    if (!question || !answer) return res.status(400).json({ success: false, error: 'Question and answer required' });

    activeTrivia = { question, answer: answer.trim(), solved: false };
    if (twitchClient && botStatus === 'connected') {
        await twitchClient.say(currentConfig.channel, `🧠 CHAT TRIVIA TIME! Question: "${question}" (Type your guess in chat!)`);
    }
    broadcast('obs_alert', { title: '🧠 CHAT TRIVIA!', message: question, type: 'trivia' });
    broadcast('trivia_start', { question });
    res.json({ success: true });
});

// Live Poll Endpoints
app.post('/api/poll/start', async (req, res) => {
    const { question, options } = req.body; // options: ['Option A', 'Option B']
    if (!question || !options || options.length < 2) return res.status(400).json({ success: false, error: 'Question and at least 2 options required' });

    activePoll = {
        question,
        options: options.map(opt => ({ text: opt, voters: new Set() }))
    };

    let chatPollMsg = `📊 POLL: ${question} | Vote by typing a number in chat: `;
    activePoll.options.forEach((opt, idx) => {
        chatPollMsg += `[${idx + 1}] ${opt.text} `;
    });

    if (twitchClient && botStatus === 'connected') {
        await twitchClient.say(currentConfig.channel, chatPollMsg);
    }
    broadcast('poll_update', {
        question: activePoll.question,
        options: activePoll.options.map(o => ({ text: o.text, votes: 0 }))
    });
    broadcast('obs_alert', { title: '📊 LIVE CHAT POLL!', message: question, type: 'poll' });
    res.json({ success: true });
});

app.post('/api/poll/end', (req, res) => {
    activePoll = null;
    broadcast('poll_end', {});
    res.json({ success: true });
});

// Timers management
app.post('/api/timers', (req, res) => {
    const { timedAnnouncements } = req.body;
    if (Array.isArray(timedAnnouncements)) {
        appData.timedAnnouncements = timedAnnouncements;
        saveAppData();
        restartAllTimers();
        res.json({ success: true, timedAnnouncements: appData.timedAnnouncements });
    } else {
        res.status(400).json({ success: false, error: 'Invalid payload' });
    }
});

// Commands management
app.post('/api/commands', (req, res) => {
    const { command, response } = req.body;
    if (!command || !command.startsWith('!') || !response) {
        return res.status(400).json({ success: false, error: 'Commands must start with ! and have a response' });
    }
    appData.customCommands[command.toLowerCase()] = response;
    saveAppData();
    res.json({ success: true, customCommands: appData.customCommands });
});

app.delete('/api/commands/:cmd', (req, res) => {
    const cmd = req.params.cmd.toLowerCase();
    delete appData.customCommands[cmd];
    saveAppData();
    res.json({ success: true, customCommands: appData.customCommands });
});

wss.on('connection', (ws) => {
    ws.send(JSON.stringify({
        type: 'init',
        status: botStatus,
        channel: currentConfig.channel,
        username: currentConfig.username,
        stats: {
            ...appData.stats,
            chatterCount: Object.keys(appData.stats.activeChatters).length
        },
        timedAnnouncements: appData.timedAnnouncements,
        customCommands: appData.customCommands,
        giveaway: activeGiveaway ? { keyword: activeGiveaway.keyword, count: activeGiveaway.entrants.size } : null,
        poll: activePoll ? { question: activePoll.question, options: activePoll.options.map(o => ({ text: o.text, votes: o.voters.size })) } : null,
        trivia: activeTrivia ? { question: activeTrivia.question, solved: activeTrivia.solved } : null
    }));
});

server.listen(PORT, () => {
    console.log(`[Dashboard] MightyStreamPulse Pro Suite running at http://localhost:${PORT}`);
    console.log(`[OBS Overlay] OBS Browser Source URL: http://localhost:${PORT}/overlay.html`);
    if (currentConfig.username && currentConfig.oauth && currentConfig.channel) {
        connectTwitch(currentConfig);
    }
});
