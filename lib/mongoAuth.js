/**
 * MongoDB-backed Baileys auth state (mini-bot style, multi-number).
 *
 * Each WhatsApp number gets its own document set inside one MongoDB collection,
 * keyed by `${number}:${type}:${id}`. This replaces useMultiFileAuthState so the
 * session survives Heroku/Koyeb/Render restarts (no more SESSION_ID pasting).
 *
 * Usage:
 *   const { getMongo, useMongoDBAuthState, listNumbers, deleteSession } = require('./lib/mongoAuth');
 *   const { state, saveCreds, clear } = await useMongoDBAuthState(number);
 */

const { MongoClient } = require('mongodb');
const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const config = require('../config');

const MONGODB_URI = process.env.MONGODB_URI || config.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'faizan_md_mini';
const COLLECTION = 'auth_state';

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
    const db = client.db(DB_NAME);
    collection = db.collection(COLLECTION);
    await collection.createIndex({ _id: 1 });
    console.log('[✅] MongoDB session store connected');
    return collection;
}

/** Mongo-safe key: dots/dollars are illegal at the start of field names, not _id, but keep it clean. */
const keyOf = (number, type, id) => `${number}:${type}:${String(id).replace(/\//g, '__')}`;

async function readData(number, type, id) {
    const col = await getMongo();
    const doc = await col.findOne({ _id: keyOf(number, type, id) });
    if (!doc || typeof doc.value !== 'string') return null;
    return JSON.parse(doc.value, BufferJSON.reviver);
}

async function writeData(number, type, id, value) {
    const col = await getMongo();
    await col.updateOne(
        { _id: keyOf(number, type, id) },
        { $set: { number, type, value: JSON.stringify(value, BufferJSON.replacer), updatedAt: new Date() } },
        { upsert: true }
    );
}

async function removeData(number, type, id) {
    const col = await getMongo();
    await col.deleteOne({ _id: keyOf(number, type, id) });
}

/** Baileys AuthenticationState backed by MongoDB. */
async function useMongoDBAuthState(number) {
    const creds = (await readData(number, 'creds', 'creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(number, type, id);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        if (value) data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            tasks.push(value ? writeData(number, type, id, value) : removeData(number, type, id));
                        }
                    }
                    await Promise.all(tasks);
                },
            },
        },
        saveCreds: async () => { await writeData(number, 'creds', 'creds', creds); },
        clear: async () => {
            const col = await getMongo();
            await col.deleteMany({ number });
        },
    };
}

/** True when this number already has a stored login. */
async function hasSession(number) {
    // A pairing attempt writes creds as soon as Baileys fires creds.update, long
    // before the number is actually linked. Treating that partial doc as a live
    // session made /pair start the bot instead of issuing a code -> instant 401.
    // Only a completed registration counts as a session.
    const creds = await readData(number, 'creds', 'creds');
    return !!(creds && creds.registered);
}

/** Every number that has a stored session (used to auto-start bots on boot). */
async function listNumbers() {
    const col = await getMongo();
    const docs = await col.find({ type: 'creds' }).project({ number: 1 }).toArray();
    return [...new Set(docs.map(d => d.number).filter(Boolean))];
}

/** Wipe one number's session completely (logout / corrupted session recovery). */
async function deleteSession(number) {
    const col = await getMongo();
    const res = await col.deleteMany({ number });
    return res.deletedCount;
}

module.exports = { getMongo, useMongoDBAuthState, hasSession, listNumbers, deleteSession };
