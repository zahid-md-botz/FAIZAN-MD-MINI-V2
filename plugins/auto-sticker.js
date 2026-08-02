const fs = require('fs');
const path = require('path');
const config = require('../config');
const { cmd } = require('../command');

const filePath = path.join(__dirname, '../assets/autosticker.json');

// Cache loaded once at startup — avoids blocking disk I/O on every message
let _stickerMapCache = null;
function getStickerMap() {
    if (_stickerMapCache) return _stickerMapCache;
    try {
        _stickerMapCache = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        _stickerMapCache = {};
    }
    return _stickerMapCache;
}
// Invalidate when file changes
try { fs.watchFile(filePath, { interval: 15000 }, () => { _stickerMapCache = null; }); } catch (_) {}

// Sticker buffers cached by filename — avoid re-reading same sticker from disk repeatedly
const _stickerBufferCache = new Map();
function getStickerBuffer(stickerPath) {
    if (_stickerBufferCache.has(stickerPath)) return _stickerBufferCache.get(stickerPath);
    if (!fs.existsSync(stickerPath)) return null;
    const buf = fs.readFileSync(stickerPath);
    _stickerBufferCache.set(stickerPath, buf);
    return buf;
}

cmd({ on: 'body' },
async (conn, mek, m, { from, body }) => {
    if (config.AUTO_STICKER !== 'true') return;
    const data = getStickerMap();
    const key = body.toLowerCase();
    for (const text in data) {
        if (key === text.toLowerCase()) {
            const stickerPath = path.join(__dirname, '../assets/autosticker', data[text]);
            const buf = getStickerBuffer(stickerPath);
            if (!buf) { console.warn(`Sticker not found: ${stickerPath}`); return; }
            await conn.sendMessage(from, { sticker: buf, packname: 'FAIZAN-MD', author: 'AUTO-STICKER' }, { quoted: mek });
            break;
        }
    }
});
