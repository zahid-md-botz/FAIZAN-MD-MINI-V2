/**
 * Disk-based Baileys auth state with MongoDB as the backup store.
 *
 * WHY THIS REPLACES lib/mongoAuth.js AS THE AUTH PATH
 * ---------------------------------------------------
 * The old store made every signal-key read/write a MongoDB round trip. During
 * pairing-code linking WhatsApp performs dozens of key reads and creds writes inside a
 * tight window right after the user submits the code — from Heroku to Atlas each one is
 * a network hop, the handshake runs out of time, and the login dies ("Logging in..."
 * spinning forever, then 401).
 *
 * The working ArslanMD mini bot avoids this entirely: it uses Baileys' own
 * useMultiFileAuthState (local disk = instant) and treats MongoDB purely as a backup of
 * creds.json so sessions survive dyno restarts. This module does exactly that, while
 * keeping the same { state, saveCreds, clear } shape the old module exposed, so index.js
 * and main.js only swap the import.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { MongoClient } = require('mongodb');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const config = require('../config');

const MONGODB_URI = process.env.MONGODB_URI || config.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'faizan_md_mini';
const COLLECTION = 'sessions';
const SESSION_ROOT = path.join(__dirname, '..', 'sessions');

let client = null;
let collection = null;

async function getMongo() {
    if (collection) return collection;
    if (!MONGODB_URI) throw new Error('MONGODB_URI is not set — cannot store sessions');
    client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
    });
    await client.connect();
    collection = client.db(DB_NAME).collection(COLLECTION);
    console.log('[✅] MongoDB session store connected');
    return collection;
}

const sanitize = (number) => String(number).replace(/[^0-9]/g, '');
const sessionDir = (number) => path.join(SESSION_ROOT, sanitize(number));

// ── MongoDB backup of creds.json (stored as raw text: lossless, no BSON coercion) ──

async function saveSessionToMongoDB(number, credsText) {
    const col = await getMongo();
    let registered = false;
    try { registered = !!JSON.parse(credsText).registered; } catch (e) {}
    await col.updateOne(
        { _id: sanitize(number) },
        { $set: { number: sanitize(number), creds: credsText, registered, updatedAt: new Date() } },
        { upsert: true }
    );
}

async function getSessionFromMongoDB(number) {
    const col = await getMongo();
    const doc = await col.findOne({ _id: sanitize(number) });
    return doc && typeof doc.creds === 'string' ? doc : null;
}

async function deleteSession(number) {
    const col = await getMongo();
    const res = await col.deleteOne({ _id: sanitize(number) });
    await fsp.rm(sessionDir(number), { recursive: true, force: true }).catch(() => {});
    return res.deletedCount;
}

/** True only when a COMPLETED registration is stored — a half-finished pairing is not a session. */
async function hasSession(number) {
    const doc = await getSessionFromMongoDB(number);
    if (!doc) return false;
    if (typeof doc.registered === 'boolean') return doc.registered;
    try { return !!JSON.parse(doc.creds).registered; } catch (e) { return false; }
}

/** Numbers with a completed login, used to auto-start bots on boot. */
async function listNumbers() {
    const col = await getMongo();
    const docs = await col.find({ registered: true }).project({ number: 1 }).toArray();
    return [...new Set(docs.map(d => d.number).filter(Boolean))];
}

// ── the auth state itself ──────────────────────────────────────────────────────

/** Pull the backed-up creds.json onto disk so Baileys can resume the session. */
async function restoreToDisk(number, dir) {
    const doc = await getSessionFromMongoDB(number).catch(() => null);
    if (!doc) {
        // No backup: make sure no stale local creds linger, or the login is refused.
        await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
        await fsp.mkdir(dir, { recursive: true });
        return false;
    }
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(path.join(dir, 'creds.json'), doc.creds, 'utf8');
    return true;
}

/** Mirror the on-disk creds.json back into MongoDB after Baileys updates it. */
async function mirrorToMongo(number, dir) {
    const file = path.join(dir, 'creds.json');
    if (!fs.existsSync(file)) return;
    const text = await fsp.readFile(file, 'utf8');
    await saveSessionToMongoDB(number, text);
}

/**
 * Drop-in replacement for the old useMongoDBAuthState(number).
 * Returns { state, saveCreds, clear } — keys live on local disk (fast), creds are
 * mirrored to MongoDB on every update (durable).
 */
async function useDiskAuthState(number) {
    const num = sanitize(number);
    const dir = sessionDir(num);
    const restored = await restoreToDisk(num, dir);
    if (restored) console.log(`[♻️] ${num}: session restored from MongoDB`);

    const { state, saveCreds } = await useMultiFileAuthState(dir);

    return {
        state,
        saveCreds: async () => {
            await saveCreds();
            await mirrorToMongo(num, dir).catch(e => console.error('[⚠️] session backup failed:', e.message));
        },
        clear: async () => { await deleteSession(num).catch(() => {}); },
        sessionPath: dir,
    };
}

module.exports = {
    getMongo,
    useDiskAuthState,
    hasSession,
    listNumbers,
    deleteSession,
    saveSessionToMongoDB,
    getSessionFromMongoDB,
    sessionDir,
};
