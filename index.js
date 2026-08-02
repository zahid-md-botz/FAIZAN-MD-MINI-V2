/**
 * FAIZAN-MD MINI — pairing server + multi-number worker manager.
 *
 * What this file does (the "mini" part):
 *   1. Serves the pairing page (pair.html) — user enters their number, gets an 8-digit
 *      WhatsApp pairing code. No SESSION_ID, no QR scanning.
 *   2. Stores every login in MongoDB (lib/mongoAuth.js), so sessions survive restarts.
 *   3. Runs ONE child process per paired number (main.js = the full FAIZAN-MD bot).
 *      Process isolation is deliberate: all 162 plugins keep their own in-memory state
 *      (antilink Maps, antidelete cache, warn counters), so numbers never mix data.
 *
 * The bot logic itself lives in main.js and is unchanged from FAIZAN-MD.
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
    Browsers,
    DisconnectReason,
} = require('@whiskeysockets/baileys');

const config = require('./config');
const { useMongoDBAuthState, hasSession, listNumbers, deleteSession, getMongo } = require('./lib/mongoAuth');

const app = express();
const PORT = process.env.PORT || 8000;
// Each bot process needs ~200MB. Keep this low on free hosting (512MB = 1-2 numbers).
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
        // code 0 = session cleared / logged out on purpose -> do not restart
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
const pairing = new Map();  // number -> { code, at }

async function generatePairCode(number) {
    let { state, saveCreds, clear } = await useMongoDBAuthState(number);

    if (state.creds.registered) {
        return { alreadyPaired: true };
    }

    // Leftover keys from an abandoned/failed attempt make WhatsApp reject the new
    // pairing immediately, so drop them and re-init before asking for a code.
    await clear().catch(() => {});
    ({ state, saveCreds, clear } = await useMongoDBAuthState(number));

    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS('Safari'),
        auth: state,
        version,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(`[✅] ${number} paired successfully — session saved to MongoDB`);
            await saveCreds();
            setTimeout(() => {
                try { sock.ws.close(); } catch (e) {}
                startWorker(number);   // hand over to the real bot process
            }, 2000);
        }
        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code === DisconnectReason.loggedOut || code === 401) {
                console.log(`[⚠️] Pairing failed for ${number} (${code}) — clearing partial session`);
                await clear().catch(() => {});
            }
        }
    });

    // WhatsApp needs a moment before it will issue a pairing code
    await new Promise(r => setTimeout(r, 3000));
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
        if (await hasSession(number)) {
            startWorker(number);
            return res.json({ status: 'already_paired', message: 'This number is already linked — bot is running.' });
        }
        const result = await generatePairCode(number);
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
    } catch (err) {
        console.error('[❌] MongoDB not reachable — check MONGODB_URI:', err.message);
    }
});

// A crash in this process kills the live pairing socket, and the user's freshly
// entered code then has nothing listening for it. Log and keep serving instead.
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
