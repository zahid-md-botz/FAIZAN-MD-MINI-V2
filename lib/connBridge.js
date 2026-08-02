/**
 * Deferred `conn` bridge.
 *
 * Several helpers (lib/msg.js, lib/exif.js, lib/antidel.js, lib/groupevents.js,
 * data/converter.js, data/presence.js) reference a bare `conn`, which resolves to the
 * global scope. Those files are required while the process boots — long before the
 * WhatsApp socket exists — so the boot died with "Uncaught Exception: conn is not
 * defined" before the bot ever connected.
 *
 * install() puts a harmless stand-in on the global scope at boot: property reads return
 * no-op functions instead of throwing, and any event listener registered on it is
 * remembered. attach(realSocket) then swaps in the real socket and replays every
 * remembered listener onto it, so nothing registered during boot is lost.
 */

const pendingListeners = [];

function makeStub() {
    const ev = {
        on: (event, handler) => { pendingListeners.push([event, handler]); },
        once: (event, handler) => { pendingListeners.push([event, handler]); },
        off: () => {},
        removeAllListeners: () => {},
        emit: () => false,
    };
    const target = { ev, __isConnStub: true, user: null };
    return new Proxy(target, {
        get(obj, prop) {
            if (prop in obj) return obj[prop];
            return () => undefined;          // any method call is a no-op until attach()
        },
        set(obj, prop, value) { obj[prop] = value; return true; },
    });
}

/** Call once at the very top of the worker, before any helper is required. */
function install() {
    if (!global.conn) global.conn = makeStub();
    return global.conn;
}

/** Call as soon as makeWASocket() returns. Replays listeners captured on the stub. */
function attach(socket) {
    const replay = pendingListeners.splice(0, pendingListeners.length);
    global.conn = socket;
    for (const [event, handler] of replay) {
        try { socket.ev.on(event, handler); } catch (e) {
            console.error(`[⚠️] could not re-attach boot listener "${event}":`, e.message);
        }
    }
    if (replay.length) console.log(`[🔗] ${replay.length} boot listener(s) attached to the live socket`);
    return socket;
}

module.exports = { install, attach };
