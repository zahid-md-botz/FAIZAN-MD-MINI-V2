/**
 * FAIZAN-MD MINI — Pairing Server + Multi-Number Worker Manager (FIXED)
 */

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const { fork } = require('child_process');
const {
    default: makeWASocket,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason,
    delay
} = require('@whiskeysockets/baileys');

const config = require('./config');
const { useDiskAuthState, hasSession, listNumbers, listNeedsRepair, deleteSession, getMongo } = require('./lib/sessionStore');
const { proxyOptions, PROXY_URL } = require('./lib/proxyAgent');

const app = express();
const PORT = process.env.PORT || 8000;
const MAX_BOTS = parseInt(process.env.MAX_BOTS || '3', 10);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'assets')));

// ════════════════════════════════════════════════════════════════
//  WORKER MANAGER
// ════════════════════════════════════════════════════════════════
const workers = new Map();

function startWorker(number) {
    number = String(number).replace(/[^0-9]/g, '');
    if (!number) return { ok: false, error: 'invalid number' };
    if (workers.has(number)) return { ok: true, already: true };
    if (workers.size >= MAX_BOTS) return { ok: false, error: `bot limit reached (${MAX_BOTS})` };

    const proc = fork(path.join(__dirname, 'main.js'), [], {
        env: { ...process.env, BOT_NUMBER: number },
        execArgv: ['--expose-gc'],
        stdio: 'inherit',
    });

    const entry = { proc, restarts: 0, startedAt: Date.now() };
    workers.set(number, entry);
    console.log(`[▶️] Bot started for ${number} (pid ${proc.pid}) — ${workers.size}/${MAX_BOTS} running`);

    proc.on('exit', (code) => {
        console.log(`[⏹️] Bot ${number} exited (code ${code})`);
        workers.delete(number);
        if (code === 0) return;
        const restarts = entry.restarts + 1;
        if (restarts > 5) {
            console.log(`[⛔] Bot ${number} crashed ${restarts}x — re-pair required.`);
            return;
        }
        const restartDelay = Math.min(60000, 5000 * restarts);
        console.log(`[🔄] Restarting bot ${number} in ${restartDelay / 1000}s...`);
        setTimeout(() => {
            const again = startWorker(number);
            const w = workers.get(number);
            if (again.ok && w) w.restarts = restarts;
        }, restartDelay);
    });

    return { ok: true };
}

function stopWorker(number) {
    const entry = workers.get(String(number));
    if (!entry) return false;
    try { entry.proc.kill('SIGTERM'); } catch (e) {}
    workers.delete(String(number));
    return true;
}

// ════════════════════════════════════════════════════════════════
//  PAIRING SYSTEM (Instant Notification & Smooth Handshake)
// ════════════════════════════════════════════════════════════════
const pairing = new Map();
const locks = new Set();

async function generatePairCode(number) {
    if (locks.has(number)) {
        const known = pairing.get(number);
        if (known) return { code: known.code, reused: true };
        return { inProgress: true };
    }
    locks.add(number);
    setTimeout(() => locks.delete(number), 180000);

    let { state, saveCreds, clear } = await useDiskAuthState(number);

    if (state.creds && state.creds.registered) {
        locks.delete(number);
        return { alreadyPaired: true };
    }

    await clear().catch(() => {});
    ({ state, saveCreds, clear } = await useDiskAuthState(number));

    const pairLogger = pino({ level: 'silent' });
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pairLogger),
        },
        printQRInTerminal: false,
        logger: pairLogger,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: false,
        fireInitQueries: true,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        browser: Browsers.macOS('Safari'),
        ...proxyOptions(),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log(`[✅] ${number} Paired Successfully! Finalizing keys...`);
            await saveCreds();
            
            // Allow 6 seconds for complete E2EE Key Exchange before transferring to main.js worker
            await delay(6000);
            await saveCreds();
            
            try { sock.ws.close(); } catch (e) {}
            pairing.delete(number);
            locks.delete(number);
            
            console.log(`[🚀] Launching Bot Worker for ${number}...`);
            startWorker(number);
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            locks.delete(number);
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                console.log(`[⚠️] Pairing failed for ${number} (${statusCode}) — clearing partial session`);
                await clear().catch(() => {});
            }
        }
    });

    // Request Pairing Code without heavy artificial delays
    if (!sock.authState.creds.registered) {
        await delay(1500); // minimal delay for socket state initialisation
        const rawCode = await sock.requestPairingCode(number);
        const formattedCode = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;
        pairing.set(number, { code: formattedCode, at: Date.now() });
        console.log(`[🔗] Instant Pairing Code generated for ${number}: ${formattedCode}`);
        return { code: formattedCode };
    }

    return { alreadyPaired: true };
}

// ════════════════════════════════════════════════════════════════
//  ROUTES
// ════════════════════════════════════════════════════════════════
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/pair', async (req, res) => {
    const number = String(req.query.number || '').replace(/[^0-9]/g, '');
    if (number.length < 10 || number.length > 15) {
        return res.status(400).json({ error: 'Enter a valid number with country code (e.g. 923266105873)' });
    }
    if (workers.size >= MAX_BOTS && !workers.has(number)) {
        return res.status(429).json({ error: `Bot limit reached (${MAX_BOTS}). Remove a number first.` });
    }
    try {
        if (await hasSession(number)) {
            startWorker(number);
            return res.json({ status: 'already_paired', message: 'This number is already linked — bot is running.' });
        }
        const result = await generatePairCode(number);
        if (result.inProgress) {
            return res.json({ status: 'pending', message: 'Pairing in progress — check your phone notification or enter the code.' });
        }
        if (result.alreadyPaired) {
            startWorker(number);
            return res.json({ status: 'already_paired', message: 'Already linked — bot started.' });
        }
        return res.json({ status: 'ok', code: result.code });
    } catch (err) {
        console.error('[❌] Pair error:', err);
        return res.status(500).json({ error: err.message || 'Pairing failed, try again' });
    }
});

app.get('/status', async (req, res) => {
    let saved = [];
    try { saved = await listNumbers(); } catch (e) {}
    res.json({
        bot: config.BOT_NAME || 'FAIZAN-MD MINI',
        running: [...workers.keys()],
        saved_sessions: saved,
        limit: MAX_BOTS,
        uptime_seconds: Math.floor(process.uptime()),
    });
});

app.get('/delete', async (req, res) => {
    const number = String(req.query.number || '').replace(/[^0-9]/g, '');
    if (!number) return res.status(400).json({ error: 'number required' });
    stopWorker(number);
    try {
        const removed = await deleteSession(number);
        res.json({ status: 'ok', message: `Session and MongoDB store removed for ${number}.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════
//  SERVER BOOT
// ════════════════════════════════════════════════════════════════
app.listen(PORT, async () => {
    console.log(`\n🚀 FAIZAN-MD MINI pairing server running on port ${PORT}`);
    try {
        await getMongo();
        const numbers = await listNumbers();
        if (!numbers.length) {
            console.log('[ℹ️] No saved sessions found — open the pairing page to link a number.');
        } else {
            console.log(`[♻️] Restoring ${numbers.length} saved session(s): ${numbers.join(', ')}`);
            numbers.slice(0, MAX_BOTS).forEach((n, i) => setTimeout(() => startWorker(n), i * 3000));
        }
    } catch (err) {
        console.error('[❌] MongoDB Connection Error:', err.message);
    }
});

process.on('uncaughtException', (err) => console.error('[⚠️] Uncaught exception:', err.message));
process.on('unhandledRejection', (reason) => console.error('[⚠️] Unhandled rejection:', reason?.message || reason));
process.on('SIGTERM', () => {
    for (const n of [...workers.keys()]) stopWorker(n);
    process.exit(0);
});
