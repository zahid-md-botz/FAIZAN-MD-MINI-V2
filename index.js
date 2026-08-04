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
    const lockTimeout = setTimeout(() => locks.delete(number), 180000);

    let { state, saveCreds, clear } = await useDiskAuthState(number);

    // FIX 1: number already has a completed registration
    if (state.creds && state.creds.registered) {
        locks.delete(number);
        clearTimeout(lockTimeout);
        return { alreadyPaired: true };
    }

    // FIX 2: Clear any stale/half-baked credentials before requesting new code
    console.log(`[🧹] Cleaning incomplete/stale pairing cache for ${number}...`);
    await clear().catch(() => {});
    ({ state, saveCreds, clear } = await useDiskAuthState(number));

    // FIX 3: Baileys' bundled default WA Web version can lag behind and silently block
    // device linking (code is issued but the phone never gets the prompt, or "Couldn't
    // link device" — see WhiskeySockets/Baileys#2679, July 2026). fetchLatestBaileysVersion
    // was already imported here but never actually called.
    let version;
    try {
        ({ version } = await fetchLatestBaileysVersion());
        console.log(`[ℹ️] Using WA Web version ${version.join('.')}`);
    } catch (e) {
        console.error('[⚠️] fetchLatestBaileysVersion failed, using library default:', e.message);
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
        keepAliveIntervalMs: 10000,
        emitOwnEvents: false,
        fireInitQueries: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        browser: Browsers.macOS('Desktop'),
        ...proxyOptions(),
    });

    sock.ev.on('creds.update', saveCreds);

    let codeRequested = false;

    return await new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(lockTimeout);
            resolve(result);
        };

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // FIX 4 (root cause of "code generates but phone never rings"): the old code
            // called requestPairingCode() after a blind 2s setTimeout, guessing the raw
            // socket was open by then. On a slower host (Heroku/Railway dyno spin-up,
            // proxy hop) 2s isn't always enough — requestPairingCode is sent over a socket
            // that isn't actually ready, WhatsApp accepts the HTTP-level request but the
            // registration IQ never lands, so a code is returned to your UI but WhatsApp's
            // server never pushes the phone-side prompt. Official Baileys pattern instead:
            // request the code once the socket itself reports 'connecting' / hands you a qr
            // ref — i.e. once it's actually ready to accept the registration IQ.
            if ((connection === 'connecting' || qr) && !codeRequested && !state.creds.registered) {
                codeRequested = true;
                try {
                    const code = await sock.requestPairingCode(number);
                    const pretty = code?.match(/.{1,4}/g)?.join('-') || code;
                    pairing.set(number, { code: pretty, at: Date.now() });
                    console.log(`[🔗] Pairing code for ${number}: ${pretty}`);
                    finish({ code: pretty });
                } catch (e) {
                    console.error(`[❌] requestPairingCode failed for ${number}:`, e.message);
                    locks.delete(number);
                    pairing.delete(number);
                    try { sock.ws.close(); } catch (_) {}
                    finish({ error: e.message || 'Failed to request pairing code, try again' });
                }
            }

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
                // FIX 5: always drop the cached code + close the socket on ANY close, not
                // just loggedOut/401/403 — otherwise a stale code can be left sitting in
                // the `pairing` map (reused by the /pair route) after a silent mid-handshake
                // drop, which is exactly what "endless Linking Device..." looks like from
                // the phone's side — it's holding a code for a socket that already died.
                pairing.delete(number);
                try { sock.ws.close(); } catch (_) {}
                if (code === DisconnectReason.loggedOut || code === 401 || code === 403) {
                    console.log(`[⚠️] Pairing failed for ${number} (${code}) — clearing partial session`);
                    await clear().catch(() => {});
                }
                finish({ error: `Connection closed before pairing completed (status ${code || 'unknown'})` });
            }
        });
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
