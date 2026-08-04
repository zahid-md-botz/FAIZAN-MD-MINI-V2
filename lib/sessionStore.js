/**
 * Disk-based Baileys auth state with MongoDB as the backup store.
 * FIXED: Auto-wipes incomplete/stale sessions from MongoDB so re-pairing never gets blocked.
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
        { 
          $set: { number: sanitize(number), creds: credsText, registered, updatedAt: new Date() },
          $unset: { needsRepair: '', repairReason: '', flaggedAt: '' } 
        },
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

/** 
 * Strict Check: True ONLY when a COMPLETED, VALID registration exists without any repair flags.
 */
async function hasSession(number) {
    const doc = await getSessionFromMongoDB(number);
    if (!doc) return false;
    
    // Check if flagged as broken or needs repair
    if (doc.needsRepair) {
        console.log(`[🧹] Session for ${number} was flagged as broken. Removing...`);
        await deleteSession(number);
        return false;
    }

    // Verify actual WhatsApp registration state
    let isRegistered = doc.registered === true;
    if (!isRegistered && doc.creds) {
        try { isRegistered = !!JSON.parse(doc.creds).registered; } catch (e) { isRegistered = false; }
    }

    // If session file exists in DB but is NOT registered, delete it automatically!
    if (!isRegistered) {
        console.log(`[🧹] Incomplete/Unregistered session found in MongoDB for ${number}. Purging...`);
        await deleteSession(number);
        return false;
    }

    return true;
}

/** Numbers with a completed login, used to auto-start bots on boot. */
async function listNumbers() {
    const col = await getMongo();
    const docs = await col.find({ registered: true, needsRepair: { $ne: true } })
        .project({ number: 1 }).toArray();
    return [...new Set(docs.map(d => d.number).filter(Boolean))];
}

/** Numbers WhatsApp refused — kept on disk, reported at boot, never auto-started. */
async function listNeedsRepair() {
    const col = await getMongo();
    const docs = await col.find({ needsRepair: true }).project({ number: 1 }).toArray();
    return [...new Set(docs.map(d => d.number).filter(Boolean))];
}

async function markNeedsRepair(number, reason) {
    const col = await getMongo();
    await col.updateOne(
        { _id: sanitize(number) },
        { $set: { needsRepair: true, repairReason: reason || 'rejected by WhatsApp', flaggedAt: new Date() } }
    );
}

// ── the auth state itself ──────────────────────────────────────────────────────

/** Pull the backed-up creds.json onto disk so Baileys can resume the session. */
async function restoreToDisk(number, dir) {
    const doc = await getSessionFromMongoDB(number).catch(() => null);
    if (!doc) {
        await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
        await fsp.mkdir(dir, { recursive: true });
        return false;
    }

    // If MongoDB backup contains an unregistered/corrupted session, wipe it right away!
    let isRegistered = doc.registered === true;
    try { if (!isRegistered && doc.creds) isRegistered = !!JSON.parse(doc.creds).registered; } catch (e) {}

    if (!isRegistered || doc.needsRepair) {
        console.log(`[🧹] Invalid session in MongoDB for ${number}. Wiping from disk and MongoDB...`);
        await deleteSession(number);
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
    try {
        const text = await fsp.readFile(file, 'utf8');
        await saveSessionToMongoDB(number, text);
    } catch (e) {
        console.error(`[⚠️] Mirror read failed for ${number}:`, e.message);
    }
}

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
    listNeedsRepair,
    markNeedsRepair,
    deleteSession,
    saveSessionToMongoDB,
    getSessionFromMongoDB,
    sessionDir,
};
