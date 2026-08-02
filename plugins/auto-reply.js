const fs = require('fs');
const path = require('path');
const config = require('../config');
const { cmd } = require('../command');

const filePath = path.join(__dirname, '../assets/autoreply.json');

// Cache loaded once at startup — avoids blocking disk I/O on every message
let _cache = null;
function getReplyData() {
    if (_cache) return _cache;
    try {
        _cache = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        _cache = {};
    }
    return _cache;
}

// Invalidate cache when the file changes (in case owner edits it via .setreply etc.)
try {
    fs.watchFile(filePath, { interval: 10000 }, () => { _cache = null; });
} catch (_) {}

cmd({ on: 'body' },
async (conn, mek, m, { from, body, isOwner }) => {
    if (config.AUTO_REPLY !== 'true') return;
    const data = getReplyData();
    const key = body.toLowerCase();
    for (const text in data) {
        if (key === text.toLowerCase()) {
            await m.reply(data[text]);
            break;
        }
    }
});
