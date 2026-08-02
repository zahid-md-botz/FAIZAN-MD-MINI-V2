const { cmd } = require('../command');
const config = require('../config');

// ================================================
// FAIZAN-MD - ANTI BAD WORD SYSTEM v3
// Fixes vs v2:
//   1. fromMe guard was unreliable in Faizan-MD serializer
//      -> Now uses dual check: mek.key.fromMe + bot JID compare
//   2. Infinite empty-message loop when bot's own warning
//      triggered the on:body handler recursively
//      -> Dual fromMe guard + cooldown breaks the loop
//   3. No cooldown -> bot spammed 1 warning per bad msg
//      -> Map-based 30s cooldown per user per group
//      -> Repeat offence within cooldown: silent delete only
// ================================================

// --- Bad words list (runtime-expandable) ---------
let BAD_WORDS = [
    // English
    'wtf', 'fuck', 'fucker', 'fucking', 'fucked', 'fck',
    'shit', 'bitch', 'bastard', 'asshole', 'ass', 'arse',
    'dick', 'pussy', 'cock', 'cunt', 'whore', 'slut',
    'nigga', 'nigger', 'rape', 'rapist', 'sex', 'xxx', 'porn',
    'nude', 'naked',
    // Urdu / Hindi
    'madarchod', 'mc', 'behenchod', 'bc', 'bsdk', 'bhosdike',
    'chutiya', 'chutiye', 'gandu', 'bhosdi', 'randi', 'haramzada',
    'harami', 'kaminay', 'kamina', 'gaand', 'lund', 'chut',
    // From original plugin
    'mia', 'huththa', 'pakaya', 'ponnaya', 'hutto'
];

// --- Per-user cooldown (30s): `groupJid:senderNum` -> timestamp
const warnCooldown = new Map();
const COOLDOWN_MS = 30 * 1000;

// --- Faizan-MD box formatter ----------------------
function box(title, rows) {
    const body = rows.map(([e, l, v]) =>
        `*| ${e} ${l}:* ${v ?? ''}`
    ).join('\n');
    return `*${config.BOT_NAME || 'FAIZAN-MD'}*\n*|-------|*\n*| ${title} |*\n${body}\n\n> *Powered By ${config.OWNER_NAME || 'FAIZAN-MD'}*`;
}

// ================================================
// AUTO-DETECTOR: runs on every incoming message
// ================================================
cmd({ on: 'body' }, async (conn, mek, m, {
    from, body, isGroup, isAdmins, isBotAdmins, sender, senderNumber
}) => {
    try {
        // GUARD 1: skip bot's own messages
        // Dual check: key.fromMe flag + JID comparison
        // Faizan-MD serializer sometimes clears fromMe, so check both
        if (mek.key?.fromMe) return;
        const botJid = (conn.user?.id || '').replace(/:\d+@/, '@');
        const msgSender = mek.key?.participant || mek.key?.remoteJid || '';
        if (botJid && msgSender === botJid) return;

        // GUARD 2: group + admin checks
        if (!isGroup)     return;
        if (!isBotAdmins) return;
        if (isAdmins)     return;

        // GUARD 3: feature toggle
        if (config.ANTI_BAD !== 'true') return;

        // GUARD 4: empty body
        const msgText = (body || '').toLowerCase().trim();
        if (!msgText) return;

        // BAD WORD CHECK
        const found = BAD_WORDS.find(w => msgText.includes(w));
        if (!found) return;

        // DELETE the offending message
        await conn.sendMessage(from, { delete: mek.key });

        // COOLDOWN CHECK
        const coolKey = `${from}:${senderNumber}`;
        const now      = Date.now();
        const lastWarn = warnCooldown.get(coolKey) || 0;

        if (now - lastWarn < COOLDOWN_MS) {
            // Still in cooldown: silent delete only, kick if enabled
            if (config.ANTI_BAD_KICK === 'true') {
                await conn.groupParticipantsUpdate(from, [sender], 'remove');
            }
            return;
        }

        // UPDATE cooldown timestamp
        warnCooldown.set(coolKey, now);

        // SEND WARNING
        await conn.sendMessage(from, {
            text: box('ANTI BAD WORD', [
                ['X', 'Action', 'Bad Word Detected & Deleted'],
                ['@', 'User',   `@${senderNumber}`],
                ['W', 'Word',   `*${found}*`],
                ['!', 'Note',   'Repeat violations will be removed!']
            ]),
            mentions: [sender]
        });

        // KICK if enabled
        if (config.ANTI_BAD_KICK === 'true') {
            await conn.groupParticipantsUpdate(from, [sender], 'remove');
            await conn.sendMessage(from, {
                text: box('KICKED', [
                    ['@', 'User',   `@${senderNumber}`],
                    ['X', 'Reason', 'Bad Word Usage'],
                    ['!', 'Status', 'Removed from group']
                ]),
                mentions: [sender]
            });
        }

    } catch (err) {
        console.error('anti-bad detector error:', err.message);
    }
});

// ================================================
// TOGGLE: .antibad on / off / add / remove / list
// ================================================
cmd({
    pattern: 'antibad',
    alias: ['antibadword', 'setantibad', 'antib'],
    desc: 'Toggle anti-bad word filter on/off, manage word list',
    category: 'group',
    react: '\uD83D\uDEAB',
    filename: __filename
}, async (conn, mek, m, { from, args, reply, isAdmins, isOwner }) => {
    try {
        if (!isAdmins && !isOwner) {
            return reply('*X Error:* Group admins or owner only!');
        }

        const sub = (args[0] || '').toLowerCase();

        if (sub === 'on') {
            config.ANTI_BAD = 'true';
            return reply(box('ANTI BAD WORD', [
                ['V', 'Status', 'ENABLED'],
                ['i', 'Tip',    'Set ANTI_BAD=true in ENV for permanent']
            ]));
        }

        if (sub === 'off') {
            config.ANTI_BAD = 'false';
            return reply(box('ANTI BAD WORD', [
                ['X', 'Status', 'DISABLED'],
                ['i', 'Tip',    'Set ANTI_BAD=false in ENV for permanent']
            ]));
        }

        if (sub === 'add') {
            const word = args[1]?.toLowerCase();
            if (!word) return reply('*X Usage:* .antibad add <word>');
            if (BAD_WORDS.includes(word)) return reply(`*! "${word}" already in list!*`);
            BAD_WORDS.push(word);
            return reply(box('WORD ADDED', [
                ['V', 'Word',  `*${word}*`],
                ['#', 'Total', `${BAD_WORDS.length} bad words`]
            ]));
        }

        if (sub === 'remove' || sub === 'del') {
            const word = args[1]?.toLowerCase();
            if (!word) return reply('*X Usage:* .antibad remove <word>');
            const idx = BAD_WORDS.indexOf(word);
            if (idx === -1) return reply(`*! "${word}" not in list!*`);
            BAD_WORDS.splice(idx, 1);
            return reply(box('WORD REMOVED', [
                ['V', 'Word',  `*${word}*`],
                ['#', 'Total', `${BAD_WORDS.length} words remain`]
            ]));
        }

        if (sub === 'list') {
            const list = BAD_WORDS.map((w, i) => `${i + 1}. ${w}`).join('\n');
            return reply(box('BAD WORDS LIST', [
                ['#', 'Total', `${BAD_WORDS.length} words`],
                ['L', 'List',  `\n${list}`]
            ]));
        }

        return reply(box('ANTI BAD WORD', [
            ['S', 'Status',   config.ANTI_BAD === 'true'      ? 'ENABLED'  : 'DISABLED'],
            ['K', 'Kick',     config.ANTI_BAD_KICK === 'true' ? 'ON'       : 'OFF'],
            ['T', 'Cooldown', '30 seconds per user'],
            ['#', 'Words',    `${BAD_WORDS.length} bad words`],
            ['1', 'ON',       '.antibad on'],
            ['0', 'OFF',      '.antibad off'],
            ['+', 'Add',      '.antibad add <word>'],
            ['-', 'Remove',   '.antibad remove <word>'],
            ['L', 'List',     '.antibad list']
        ]));

    } catch (err) {
        console.error('antibad cmd error:', err.message);
        reply('*X Error:* ' + (err.message || 'Unknown error').slice(0, 80));
    }
});
