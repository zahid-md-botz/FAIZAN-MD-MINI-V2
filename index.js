/**
FAIZAN-MD MINI — pairing server + multi-number worker manager.
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
const { useDiskAuthState, hasSession, listNumbers, listNeedsRepair, deleteSession, markNeedsRepair, getMongo } = require('./lib/sessionStore');
const { proxyOptions, PROXY_URL } = require('./lib/proxyAgent');

const app = express();
const PORT = process.env.PORT || 8000;
const MAX_BOTS = parseInt(process.env.MAX_BOTS || '3', 10);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'assets')));

// ════════════════════════════════════════════════════════════════
// WORKER MANAGER
// ════════════════════════════════════════════════════════════════
const workers = new Map();

function startWorker(number) {
number = String(number).replace(/[^0-9]/g, '');
if (!number) return { ok: false, error: 'invalid number' };
if (workers.has(number)) return { ok: true, already: true };
if (workers.size >= MAX_BOTS) return { ok: false, error: `Bot limit reached (${MAX_BOTS})` };

const proc = fork(path.join(__dirname, 'main.js'), [], { 
    env: { ...process.env, BOT_NUMBER: number }, 
    execArgv: ['--expose-gc'], 
    stdio: 'inherit' 
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
    const delay = Math.min(60000, 5000 * restarts);
    console.log(`[🔄] Restarting bot ${number} in ${delay/1000}s (attempt ${restarts})`);
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
// PAIRING — IMPROVED WITH BETTER TIMING
// ════════════════════════════════════════════════════════════════
const pairing = new Map();
const locks = new Set();

async function generatePairCode(number) {
// Clear any existing lock/pairing for this number
if (locks.has(number)) {
    const known = pairing.get(number);
    if (known && Date.now() - known.at < 120000) {
        return { code: known.code, reused: true };
    }
    // Lock is stale (older than 2 mins) — clear it
    locks.delete(number);
    pairing.delete(number);
}

locks.add(number);
// Auto-clear lock after 2 minutes (WhatsApp code expires in 5 mins)
setTimeout(() => locks.delete(number), 120000);

try {
    // Check if already paired
    if (await hasSession(number)) {
        locks.delete(number);
        return { alreadyPaired: true };
    }

    // Get fresh auth state — clear any partial session first
    let { state, saveCreds, clear } = await useDiskAuthState(number);
    if (state.creds.registered) {
        locks.delete(number);
        return { alreadyPaired: true };
    }

    // Clear partial session to avoid conflicts
    await clear().catch(() => {});
    ({ state, saveCreds, clear } = await useDiskAuthState(number));

    // Get latest Baileys version
    let waVersion;
    try {
        const { version } = await fetchLatestBaileysVersion();
        waVersion = version;
        console.log(`[ℹ️] Using WA version: ${version.join('.')}`);
    } catch (e) {
        console.warn('[⚠️] Could not fetch latest version, using default');
    }

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
        browser: ['Mac OS', 'Safari', '10.15.7'],
        ...(waVersion ? { version: waVersion } : {}),
        ...proxyOptions(),
    });

    // Track connection state
    let isPaired = false;
    let pairingCode = null;

    sock.ev.on('creds.update', async () => {
        await saveCreds();
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log(`[✅] ${number} connected successfully!`);
            isPaired = true;
            
            // Wait for creds to be fully saved
            await new Promise(r => setTimeout(r, 2000));
            await saveCreds();
            
            // Close socket gracefully
            try { await sock.ws.close(); } catch (e) {}
            
            // Start worker
            startWorker(number);
            pairing.delete(number);
            locks.delete(number);
            console.log(`[✅] ${number} paired and worker started!`);
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code === DisconnectReason.loggedOut || code === 401) {
                console.log(`[⚠️] ${number} pairing failed (${code}) — clearing session`);
                await clear().catch(() => {});
            }
            // Don't clear lock here — let the pairing complete or timeout
        }
    });

    // Give socket time to initialize
    await new Promise(r => setTimeout(r, 5000));

    // Request pairing code
    try {
        console.log(`[🔗] Requesting pairing code for ${number}...`);
        const code = await sock.requestPairingCode(number);
        pairingCode = code?.match(/.{1,4}/g)?.join('-') || code;
        pairing.set(number, { code: pairingCode, at: Date.now() });
        console.log(`[🔗] Pairing code for ${number}: ${pairingCode}`);
        
        // Keep socket open for 2 minutes to handle the pairing
        setTimeout(async () => {
            if (!isPaired) {
                console.log(`[⏰] ${number} pairing timed out — closing socket`);
                try { await sock.ws.close(); } catch (e) {}
                locks.delete(number);
                pairing.delete(number);
            }
        }, 120000);

        return { code: pairingCode };
    } catch (err) {
        console.error(`[❌] Failed to get pairing code for ${number}:`, err.message);
        locks.delete(number);
        pairing.delete(number);
        throw err;
    }

} catch (err) {
    console.error('[❌] Pair error:', err);
    locks.delete(number);
    pairing.delete(number);
    throw err;
}
}

// ════════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════════
app.get('/', (req, res) => {
res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/pair', async (req, res) => {
const number = String(req.query.number || '').replace(/[^0-9]/g, '');
if (number.length < 10 || number.length > 15) {
    return res.status(400).json({ error: 'Enter a valid number with country code (e.g. 923266105873)' });
}

// Check bot limit
if (workers.size >= MAX_BOTS && !workers.has(number)) {
    return res.status(429).json({ error: `Bot limit reached (${MAX_BOTS}). Remove a number first.` });
}

try {
    // Check if already paired
    if (await hasSession(number)) {
        startWorker(number);
        return res.json({ status: 'already_paired', message: 'This number is already linked — bot is running.' });
    }

    // Generate pairing code
    const result = await generatePairCode(number);
    if (result.alreadyPaired) {
        startWorker(number);
        return res.json({ status: 'already_paired', message: 'Already linked — bot started.' });
    }
    if (result.reused) {
        return res.json({ status: 'pending', code: result.code, message: 'Pairing already in progress. Enter the code in WhatsApp.' });
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
    // Also clear any pending pairing
    pairing.delete(number);
    locks.delete(number);
    res.json({ status: 'ok', message: `Session removed (${removed} keys). Re-pair anytime.` });
} catch (err) {
    res.status(500).json({ error: err.message });
}
});

// ════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════
app.listen(PORT, async () => {
console.log(`\n🚀 FAIZAN-MD MINI pairing server on port ${PORT}`);
console.log(`📱 Pairing page: http://localhost:${PORT}/`);

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
        console.log(`[⚠️] Needs re-pairing: ${broken.join(', ')}`);
    }
    if (PROXY_URL) console.log('[🌐] PROXY_URL is set');
} catch (err) {
    console.error('[❌] MongoDB error:', err.message);
}
});

process.on('uncaughtException', (err) => {
console.error('[⚠️] Uncaught exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
console.error('[⚠️] Unhandled rejection:', reason?.message || reason);
});

process.on('SIGTERM', () => {
console.log('[🛑] Shutting down...');
for (const n of [...workers.keys()]) stopWorker(n);
process.exit(0);
});
