/**
 * FAIZAN-MD MINI — pairing server + multi-number worker manager.
 *
 * ROOT CAUSE FIX (both bugs solved):
 *
 * BUG 1 — Race condition in generatePairCode (main cause of "bot never sends notification"):
 *   The old code attached the connection.update listener AFTER requestPairingCode() returned.
 *   If the user entered the code quickly, connection === 'open' fired BEFORE the listener was
 *   attached → startWorker() was never called → bot never started → no welcome message.
 *   FIX: Attach ALL event listeners first, then request the code inside a Promise.
 *
 * BUG 2 — Pairing code timing (cause of "code generated but phone never gets prompt"):
 *   The old delay(1500) was a blind wait. If the server was slow, the socket wasn't ready.
 *   FIX: Use the 'qr' event as the trigger (socket is 100% ready when qr fires) with a
 *   3-second fallback timer in case qr doesn't fire on this Baileys version.
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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
            console.log(`[⛔] Bot ${number} crashed ${restarts}x — not restarting.`);
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
//  PAIRING — complete rewrite fixing both race conditions
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
    const lockTimeout = setTimeout(() => {
        locks.delete(number);
        pairing.delete(number);
    }, 180000);

    // ── load auth state ───────────────────────────────────────────
    let { state, saveCreds, clear } = await useDiskAuthState(number);

    if (state.creds && state.creds.registered) {
        locks.delete(number);
        clearTimeout(lockTimeout);
        return { alreadyPaired: true };
    }

    // Clear any stale/incomplete pairing state before starting fresh
    console.log(`[🧹] Clearing stale pairing state for ${number}...`);
    await clear().catch(() => {});
    ({ state, saveCreds, clear } = await useDiskAuthState(number));

    // Always use latest WA Web version
    let version;
    try {
        ({ version } = await fetchLatestBaileysVersion());
        console.log(`[ℹ️] WA Web version: ${version.join('.')}`);
    } catch (e) {
        console.error('[⚠️] fetchLatestBaileysVersion failed:', e.message);
    }

    const pairLogger = pino({ level: 'silent' });
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
        browser: Browsers.ubuntu('Chrome'),
        ...proxyOptions(),
    });

    sock.ev.on('creds.update', saveCreds);

    // ════════════════════════════════════════════════════════════
    //  BUG 1 FIX: Attach connection.update listener HERE, BEFORE
    //  requestPairingCode is called.  The old code attached it
    //  after requestPairingCode returned, creating a window where
    //  connection === 'open' could fire and be missed entirely,
    //  so startWorker was never called and the bot never started.
    // ════════════════════════════════════════════════════════════
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log(`[✅] ${number} paired — storing session...`);
            try { await saveCreds(); } catch (_) {}
            setTimeout(async () => {
                try { await saveCreds(); } catch (_) {}
                console.log(`[💾] ${number} session saved — launching bot worker`);
                try { sock.ws.close(); } catch (_) {}
                pairing.delete(number);
                locks.delete(number);
                clearTimeout(lockTimeout);
                startWorker(number);
            }, 5000);
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            locks.delete(number);
            pairing.delete(number);
            clearTimeout(lockTimeout);
            try { sock.ws.close(); } catch (_) {}
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403) {
                console.log(`[⚠️] Pairing socket closed (${statusCode}) for ${number} — clearing session`);
                await clear().catch(() => {});
            }
        }
    });

    // ════════════════════════════════════════════════════════════
    //  BUG 2 FIX: Use 'qr' event as primary trigger for
    //  requestPairingCode.  When 'qr' fires, Baileys has completed
    //  the noise handshake and WhatsApp is ready to auth — this is
    //  the correct and reliable moment to call requestPairingCode.
    //  Fallback: if qr doesn't fire within 3s (some Baileys versions
    //  skip qr when printQRInTerminal=false), try directly anyway.
    // ════════════════════════════════════════════════════════════
    return new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            if (result.code) {
                pairing.set(number, { code: result.code, at: Date.now() });
                console.log(`[🔗] Pairing code for ${number}: ${result.code}`);
            }
            resolve(result);
        };

        let codeRequested = false;

        async function doRequestCode() {
            if (codeRequested) return;
            codeRequested = true;
            clearTimeout(fallbackTimer);

            const MAX_RETRIES = 3;
            let retries = MAX_RETRIES;
            while (retries > 0) {
                try {
                    const code = await sock.requestPairingCode(number);
                    const pretty = code?.match(/.{1,4}/g)?.join('-') || code;
                    finish({ code: pretty });
                    return;
                } catch (err) {
                    retries--;
                    console.warn(`[⚠️] requestPairingCode attempt ${MAX_RETRIES - retries}/${MAX_RETRIES} for ${number}: ${err.message}`);
                    if (retries === 0) {
                        locks.delete(number);
                        pairing.delete(number);
                        clearTimeout(lockTimeout);
                        try { sock.ws.close(); } catch (_) {}
                        finish({ error: err.message || 'Failed to generate pairing code — try again' });
                        return;
                    }
                    await delay(2000 * (MAX_RETRIES - retries));
                }
            }
        }

        // Primary: request code when qr fires (socket is confirmed ready)
        sock.ev.on('connection.update', (update) => {
            if (update.qr && !codeRequested) {
                doRequestCode();
            }
        });

        // Fallback: try after 3s if qr event never fires
        const fallbackTimer = setTimeout(() => {
            if (!codeRequested) {
                console.log(`[⏱️] qr event not fired for ${number} — using fallback timer`);
                doRequestCode();
            }
        }, 3000);

        // Hard timeout: give up after 60s
        setTimeout(() => {
            if (!settled) {
                clearTimeout(fallbackTimer);
                locks.delete(number);
                pairing.delete(number);
                clearTimeout(lockTimeout);
                try { sock.ws.close(); } catch (_) {}
                finish({ error: 'Pairing timed out — please try again' });
            }
        }, 60000);
    });
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
        const { state } = await useDiskAuthState(number);
        const isRegistered = state?.creds?.registered || false;

        if (isRegistered) {
            startWorker(number);
            return res.json({ status: 'already_paired', message: 'This number is already linked — bot is running.' });
        } else if (await hasSession(number)) {
            console.log(`[⚠️] Stale session for ${number} — resetting...`);
            stopWorker(number);
            await deleteSession(number).catch(() => {});
        }

        const result = await generatePairCode(number);
        if (result.inProgress) {
            return res.json({ status: 'pending', message: 'Pairing already in progress — wait for the code.' });
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
//  BOOT — restore saved sessions
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
            console.log(`[♻️] Restoring ${numbers.length} session(s): ${numbers.join(', ')}`);
            numbers.slice(0, MAX_BOTS).forEach((n, i) => setTimeout(() => startWorker(n), i * 8000));
        }
        const broken = await listNeedsRepair().catch(() => []);
        if (broken.length) {
            console.log(`[⚠️] Needs re-pairing: ${broken.join(', ')}`);
        }
        if (PROXY_URL) console.log('[🌐] PROXY_URL set — using proxy for WhatsApp traffic.');
    } catch (err) {
        console.error('[❌] MongoDB not reachable — check MONGODB_URI:', err.message);
    }
});

process.on('uncaughtException', (err) => {
    console.error('[⚠️] Uncaught exception in pairing server:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('[⚠️] Unhandled rejection:', reason?.message || reason);
});
process.on('SIGTERM', () => {
    console.log('[🛑] Shutting down...');
    for (const n of [...workers.keys()]) stopWorker(n);
    process.exit(0);
});
