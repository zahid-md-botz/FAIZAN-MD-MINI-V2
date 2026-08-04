/**
 * FAIZAN-MD MINI — pairing server + multi-number worker manager.
 * FIXED: Endless loading & false "already linked" issue for failed pairing attempts.
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
//  WORKER MANAGER — one child process per WhatsApp number
// ════════════════════════════════════════════════════════════════
const workers = new Map();   // number -> { proc, restarts, startedAt }

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
            console.log(`[⛔] Bot ${number} crashed ${restarts}x — not restarting. Re-pair from the pairing page.`);
            return;
        }
        const delay = Math.min(60000, 5000 * restarts);
        console.log(`[🔄] Restarting bot ${number} in ${delay / 1000}s (attempt ${restarts})`);
        setTimeout(() => {
            const again = startWorker(number);
            const w = workers.get(number);
            if (again.ok && w) w.restarts = restarts;
        }, delay);
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
//  PAIRING — generate an 8-digit code for a number
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

    // FIX 1: Jeśli numer jest w pełni zarejestrowany w WhatsApp
    if (state.creds && state.creds.registered) {
        locks.delete(number);
        return { alreadyPaired: true };
    }

    // FIX 2: Clear any stale/half-baked credentials before requesting new code
    console.log(`[🧹] Cleaning incomplete/stale pairing cache for ${number}...`);
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
        fireInitQueries: false,
        markOnlineOnConnect: false,
        syncFullHistory: false, // FIX 3: Prevents endless loading screen on phone
        browser: Browsers.macOS('Desktop'), // FIX 4: Stable macOS desktop agent prevents rejection
        ...proxyOptions(),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(`[✅] ${number} paired successfully — finishing session sync...`);
            await saveCreds();
            setTimeout(async () => {
                try { await saveCreds(); } catch (e) {}
                console.log(`[💾] ${number} session stored — starting bot`);
                try { sock.ws.close(); } catch (e) {}
                pairing.delete(number);
                locks.delete(number);
                startWorker(number);
            }, 5000);
        }
        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            locks.delete(number);
            if (code === DisconnectReason.loggedOut || code === 401 || code === 403) {
                console.log(`[⚠️] Pairing failed for ${number} (${code}) — clearing partial session`);
                await clear().catch(() => {});
            }
        }
    });

    await new Promise(r => setTimeout(r, 2000));
    const code = await sock.requestPairingCode(number);
    const pretty = code?.match(/.{1,4}/g)?.join('-') || code;
    pairing.set(number, { code: pretty, at: Date.now() });
    console.log(`[🔗] Pairing code for ${number}: ${pretty}`);
    return { code: pretty };
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
        // FIX 5: Validate if session is actually REGISTERED before blocking user
        const { state } = await useDiskAuthState(number);
        const isRegistered = state?.creds?.registered || false;

        if (isRegistered) {
            startWorker(number);
            return res.json({ status: 'already_paired', message: 'This number is already linked — bot is running.' });
        } else if (await hasSession(number)) {
            // Unregistered/stale session found on disk/mongo — delete it so fresh code can generate
            console.log(`[⚠️] Unregistered session found for ${number}. Resetting for new pairing...`);
            stopWorker(number);
            await deleteSession(number).catch(() => {});
        }

        const result = await generatePairCode(number);
        if (result.inProgress) {
            return res.json({ status: 'pending', message: 'Pairing already in progress — wait for the code to appear.' });
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
        res.json({ status: 'ok', message: `Session removed (${removed} keys). Re-pair anytime.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════
//  BOOT — restore every saved session
// ════════════════════════════════════════════════════════════════
app.listen(PORT, async () => {
    console.log(`\n🚀 FAIZAN-MD MINI pairing server on port ${PORT}`);
    console.log(`   Pairing page: http://localhost:${PORT}/`);
    try {
        await getMongo();
        const numbers = await listNumbers();
        if (!numbers.length) {
            console.log('[ℹ️] No saved sessions yet — open the pairing page to link a number.');
        } else {
            console.log(`[♻️] Restoring ${numbers.length} saved session(s): ${numbers.join(', ')}`);
            numbers.slice(0, MAX_BOTS).forEach((n, i) => setTimeout(() => startWorker(n), i * 8000));
        }
        const broken = await listNeedsRepair().catch(() => []);
        if (broken.length) {
            console.log(`[⚠️] Needs re-pairing (not auto-started): ${broken.join(', ')}`);
            console.log('    Open the pairing page for these numbers to link them again.');
        }
        if (PROXY_URL) console.log('[🌐] PROXY_URL is set — WhatsApp traffic will use the proxy.');
    } catch (err) {
        console.error('[❌] MongoDB not reachable — check MONGODB_URI:', err.message);
    }
});

process.on('uncaughtException', (err) => {
    console.error('[⚠️] Uncaught exception in pairing server:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('[⚠️] Unhandled rejection in pairing server:', reason?.message || reason);
});

process.on('SIGTERM', () => {
    console.log('[🛑] Shutting down all bots...');
    for (const n of [...workers.keys()]) stopWorker(n);
    process.exit(0);
});
