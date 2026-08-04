/**
 * FAIZAN-MD MINI — pairing server + multi-number worker manager.
 *
 * PAIRING FIX (transplanted from Reference Bot / KADIYA-MD):
 *  - Replaced event-driven requestPairingCode() (waiting for 'connecting' event)
 *    with the Reference bot's proven direct-call approach:
 *    delay(1500) → requestPairingCode() with 3-retry loop → return code immediately.
 *  - Browser fingerprint changed to Browsers.ubuntu('Chrome') — same as Reference bot.
 *  - fireInitQueries kept false during pairing socket (lighter, faster handshake).
 *  - Post-pairing 'connection.update' handler kept for open/close lifecycle only.
 *  - All worker manager, routes, session imports and boot logic UNCHANGED.
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

// ── small helper so we can await a plain setTimeout ──────────────────────────
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
        const delayMs = Math.min(60000, 5000 * restarts);
        console.log(`[🔄] Restarting bot ${number} in ${delayMs / 1000}s (attempt ${restarts})`);
        setTimeout(() => {
            const again = startWorker(number);
            const w = workers.get(number);
            if (again.ok && w) w.restarts = restarts;
        }, delayMs);
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
//  PAIRING — transplanted from Reference Bot (KADIYA-MD / EmpirePair)
//
//  KEY CHANGE: instead of waiting for the Baileys 'connecting' event
//  before calling requestPairingCode(), we use the Reference bot's
//  proven pattern: create the socket, wait a fixed 1500 ms for the
//  WebSocket handshake to settle, then call requestPairingCode()
//  directly with a 3-retry loop.  This avoids the race condition where
//  the 'connecting' event fires before the socket's internal signal-key
//  store is fully initialised, which caused "code returned to UI but
//  phone never gets the prompt" or endless spinner on slower hosts.
// ════════════════════════════════════════════════════════════════
const pairing = new Map();  // number -> { code, at }
const locks = new Set();

async function generatePairCode(number) {
    // ── duplicate-request guard ───────────────────────────────────
    if (locks.has(number)) {
        const known = pairing.get(number);
        if (known) return { code: known.code, reused: true };
        return { inProgress: true };
    }
    locks.add(number);
    // Safety valve: drop the lock after 3 minutes regardless
    const lockTimeout = setTimeout(() => locks.delete(number), 180000);

    // ── fetch current auth state ──────────────────────────────────
    let { state, saveCreds, clear } = await useDiskAuthState(number);

    // Already fully registered — no new code needed
    if (state.creds && state.creds.registered) {
        locks.delete(number);
        clearTimeout(lockTimeout);
        return { alreadyPaired: true };
    }

    // Clear any stale/half-baked credentials before requesting a new code
    // (Reference bot FIX: avoids "unavailable" pairing-code error)
    console.log(`[🧹] Cleaning incomplete/stale pairing cache for ${number}...`);
    await clear().catch(() => {});
    ({ state, saveCreds, clear } = await useDiskAuthState(number));

    // Always fetch the latest WA Web version (Reference bot + FAIZAN fix)
    let version;
    try {
        ({ version } = await fetchLatestBaileysVersion());
        console.log(`[ℹ️] Using WA Web version ${version.join('.')}`);
    } catch (e) {
        console.error('[⚠️] fetchLatestBaileysVersion failed, using library default:', e.message);
    }

    const pairLogger = pino({ level: 'silent' });

    // ── create the pairing socket ─────────────────────────────────
    // Browser: Browsers.ubuntu('Chrome') — matches the Reference bot exactly.
    // fireInitQueries: false — lighter handshake; we only need the pairing IQ.
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pairLogger),
        },
        ...(version ? { version } : {}),
        printQRInTerminal: false,
        logger: pairLogger,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 30000,
        emitOwnEvents: false,
        fireInitQueries: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        browser: Browsers.ubuntu('Chrome'),   // ← Reference bot value (was macOS Desktop)
        ...proxyOptions(),
    });

    sock.ev.on('creds.update', saveCreds);

    // ── TRANSPLANTED PAIRING LOGIC (from Reference Bot EmpirePair) ─
    //  Wait 1500 ms for the socket WebSocket to fully open, then call
    //  requestPairingCode() directly — no event listener needed.
    //  3 retries with exponential back-off mirror the Reference bot's
    //  config.MAX_RETRIES = 3 loop.
    const MAX_RETRIES = 3;
    try {
        await delay(1500);  // let the WS handshake settle (Reference bot pattern)

        let code;
        let retries = MAX_RETRIES;
        while (retries > 0) {
            try {
                code = await sock.requestPairingCode(number);
                break;
            } catch (err) {
                retries--;
                console.warn(`[⚠️] requestPairingCode attempt failed for ${number} (${MAX_RETRIES - retries}/${MAX_RETRIES}):`, err.message);
                if (retries === 0) throw err;
                await delay(2000 * (MAX_RETRIES - retries));
            }
        }

        const pretty = code?.match(/.{1,4}/g)?.join('-') || code;
        pairing.set(number, { code: pretty, at: Date.now() });
        console.log(`[🔗] Pairing code for ${number}: ${pretty}`);

        // ── post-pairing lifecycle listener ──────────────────────
        // Only handles 'open' (session ready → start worker) and
        // 'close' (cleanup).  Code delivery already done above.
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log(`[✅] ${number} paired successfully — finishing session sync...`);
                await saveCreds();
                setTimeout(async () => {
                    try { await saveCreds(); } catch (_) {}
                    console.log(`[💾] ${number} session stored — starting bot`);
                    try { sock.ws.close(); } catch (_) {}
                    pairing.delete(number);
                    locks.delete(number);
                    startWorker(number);
                }, 5000);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                locks.delete(number);
                pairing.delete(number);
                try { sock.ws.close(); } catch (_) {}
                if (statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403) {
                    console.log(`[⚠️] Pairing socket closed (${statusCode}) for ${number} — clearing partial session`);
                    await clear().catch(() => {});
                }
            }
        });

        clearTimeout(lockTimeout);
        return { code: pretty };

    } catch (e) {
        console.error(`[❌] requestPairingCode failed for ${number}:`, e.message);
        locks.delete(number);
        pairing.delete(number);
        clearTimeout(lockTimeout);
        try { sock.ws.close(); } catch (_) {}
        return { error: e.message || 'Failed to request pairing code, try again' };
    }
}

// ════════════════════════════════════════════════════════════════
//  ROUTES  (UNCHANGED from original FAIZAN-MD-MINI index.js)
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
        // Validate if session is actually REGISTERED before blocking user
        const { state } = await useDiskAuthState(number);
        const isRegistered = state?.creds?.registered || false;

        if (isRegistered) {
            startWorker(number);
            return res.json({ status: 'already_paired', message: 'This number is already linked — bot is running.' });
        } else if (await hasSession(number)) {
            // Unregistered/stale session found — delete it so a fresh code can generate
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
        if (result.error) {
            return res.status(502).json({ error: result.error });
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
//  BOOT — restore every saved session  (UNCHANGED)
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
