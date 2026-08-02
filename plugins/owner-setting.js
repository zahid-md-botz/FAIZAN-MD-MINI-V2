const { cmd, commands } = require('../command');
const { exec } = require('child_process');
const config = require('../config');
const { sleep, getBuffer } = require('../lib/functions');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const Jimp = require('jimp').catch ? undefined : undefined;

function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ ⚙️ ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

// Helper to download quoted image
async function downloadQuotedImage(conn, mek, m) {
    // m.quoted from sms() serializer = inner content (has mtype, mediaKey, url, etc.)
    // It is NOT wrapped as {imageMessage: {...}} — it IS the imageMessage data directly
    const quoted = m.quoted;
    if (!quoted) return null;

    // Check mtype set by sms() serializer
    const mtype = quoted.mtype || '';
    const isImage = mtype === 'imageMessage' || mtype === 'stickerMessage';
    
    if (!isImage) {
        // Fallback: check raw quotedMessage from contextInfo (for edge cases)
        try {
            const rawQuoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (rawQuoted) {
                const mediaTypes = ['imageMessage', 'stickerMessage'];
                for (const t of mediaTypes) {
                    if (rawQuoted[t]) {
                        const stream = await downloadContentFromMessage(rawQuoted[t], t === 'imageMessage' ? 'image' : 'sticker');
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                        return buffer;
                    }
                }
            }
        } catch (e) { console.error('Fallback image download error:', e); }
        return null;
    }

    try {
        // quoted itself is the media message (has mediaKey, url, directPath, etc.)
        const mediaType = mtype === 'imageMessage' ? 'image' : 'sticker';
        const stream = await downloadContentFromMessage(quoted, mediaType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    } catch (e) {
        console.error('Download image error:', e);
        return null;
    }
}

// ============ 1. SHUTDOWN BOT ============
cmd({
    pattern: "shutdown",
    alias: ["stop", "exit"],
    desc: "Shutdown the bot",
    category: "owner",
    react: "🛑",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, reply }) => {
    if (!isOwner) return reply(faizanStyle('SHUTDOWN', 'Owner only command', '❌'));
    await reply(faizanStyle('SHUTDOWN', 'Bot is shutting down...', '🛑'));
    setTimeout(() => process.exit(), 2000);
});

// ============ 2. BROADCAST MESSAGE ============
cmd({
    pattern: "broadcast",
    alias: ["bc", "broad"],
    desc: "Broadcast message to all groups",
    category: "owner",
    react: "📢",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, args, reply }) => {
    if (!isOwner) return reply(faizanStyle('BROADCAST', 'Owner only command', '❌'));
    if (args.length === 0) return reply(faizanStyle('BROADCAST', 'Please provide a message to broadcast\nExample: .broadcast Hello everyone', '❌'));

    const message = args.join(' ');
    const groups = await conn.groupFetchAllParticipating();
    const groupIds = Object.keys(groups);

    if (groupIds.length === 0) {
        return reply(faizanStyle('BROADCAST', 'No groups found', '❌'));
    }

    await reply(faizanStyle('BROADCAST', `Sending to ${groupIds.length} groups...`, '📢'));

    let sent = 0;
    for (const groupId of groupIds) {
        try {
            await conn.sendMessage(groupId, { text: message });
            sent++;
            await sleep(1000);
        } catch (e) {
            console.log(`Failed to send to ${groupId}:`, e.message);
        }
    }

    await reply(faizanStyle('BROADCAST', `✅ Sent to ${sent}/${groupIds.length} groups`, '✅'));
});

// ============ 3. SET BOT PROFILE PICTURE (SETPP) ============
cmd({
    pattern: "setpp",
    alias: ["setprofile", "profilepic", "setbotpp"],
    desc: "Set bot profile picture (reply to image)",
    category: "owner",
    react: "🖼️",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, reply }) => {
    try {
        if (!isOwner) return reply(faizanStyle('SETPP', 'Owner only command', '❌'));

        const media = await downloadQuotedImage(conn, mek, m);
        if (!media) {
            return reply(faizanStyle('SETPP', 'Reply to an image to set as bot DP', '❌'));
        }

        await reply(faizanStyle('SETPP', 'Updating bot profile picture...', '⏳'));
        await conn.updateProfilePicture(conn.user.id, media);
        await reply(faizanStyle('SETPP', 'Bot profile picture updated! ✅', '✅'));

    } catch (error) {
        console.error('Setpp error:', error);
        await reply(faizanStyle('SETPP', error.message || 'Failed to update', '❌'));
    }
});

// ============ 4. SET GROUP PROFILE PICTURE (GPP) ============
cmd({
    pattern: "gpp",
    alias: ["setgrouppp", "setgroupdp", "groupdp"],
    desc: "Set group profile picture (reply to image)",
    category: "group",
    react: "🖼️",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, isGroup, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return reply(faizanStyle('GPP', 'Groups only', '❌'));
        if (!isOwner && !isAdmins) return reply(faizanStyle('GPP', 'Admin/Owner only', '❌'));
        if (!isBotAdmins) return reply(faizanStyle('GPP', 'Bot must be admin', '❌'));

        const media = await downloadQuotedImage(conn, mek, m);
        if (!media) {
            return reply(faizanStyle('GPP', 'Reply to an image to set as group DP', '❌'));
        }

        await reply(faizanStyle('GPP', 'Updating group profile picture...', '⏳'));
        await conn.updateProfilePicture(from, media);
        await reply(faizanStyle('GPP', 'Group profile picture updated! ✅', '✅'));

    } catch (error) {
        console.error('GPP error:', error);
        await reply(faizanStyle('GPP', error.message || 'Failed to update', '❌'));
    }
});

// ============ 5. SET FULL PROFILE PICTURE (FULLPP) ============
cmd({
    pattern: "fullpp",
    alias: ["fulldp", "fullprofile"],
    desc: "Set full-size bot profile picture (no crop)",
    category: "owner",
    react: "🖼️",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, reply }) => {
    try {
        if (!isOwner) return reply(faizanStyle('FULLPP', 'Owner only command', '❌'));

        const media = await downloadQuotedImage(conn, mek, m);
        if (!media) {
            return reply(faizanStyle('FULLPP', 'Reply to an image for full-size DP', '❌'));
        }

        await reply(faizanStyle('FULLPP', 'Setting full-size profile picture...', '⏳'));

        // Use the full image update method (Baileys supports this via query)
        await conn.query({
            tag: 'iq',
            attrs: {
                to: '@s.whatsapp.net',
                type: 'set',
                xmlns: 'w:profile:picture',
            },
            content: [
                {
                    tag: 'picture',
                    attrs: { type: 'image' },
                    content: media,
                },
            ],
        });

        await reply(faizanStyle('FULLPP', 'Full-size profile picture set! ✅', '✅'));

    } catch (error) {
        console.error('Fullpp error:', error);
        // Fallback to normal setpp
        try {
            await conn.updateProfilePicture(conn.user.id, media);
            await reply(faizanStyle('FULLPP', 'Profile picture updated (standard crop) ✅', '✅'));
        } catch {
            await reply(faizanStyle('FULLPP', error.message || 'Failed to update', '❌'));
        }
    }
});

// ============ 6. SET BOT NAME (SETNAME) ============
cmd({
    pattern: "setname",
    alias: ["botname", "setbotname"],
    desc: "Set bot display name",
    category: "owner",
    react: "📛",
    use: ".setname New Bot Name",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, args, reply }) => {
    try {
        if (!isOwner) return reply(faizanStyle('SETNAME', 'Owner only command', '❌'));
        if (!args.length) return reply(faizanStyle('SETNAME', 'Please provide a name\nExample: .setname Faizan-MD', '❌'));

        const newName = args.join(' ');
        await conn.updateProfileName(newName);
        await reply(faizanStyle('SETNAME', `Bot name changed to: ${newName}`, '✅'));

    } catch (error) {
        console.error('Setname error:', error);
        await reply(faizanStyle('SETNAME', error.message || 'Failed to update name', '❌'));
    }
});

// ============ 7. SET BOT BIO (SETBIO) ============
cmd({
    pattern: "setbio",
    alias: ["botbio", "setstatus", "setabout"],
    desc: "Set bot bio/about status",
    category: "owner",
    react: "📝",
    use: ".setbio New bio text",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, args, reply }) => {
    try {
        if (!isOwner) return reply(faizanStyle('SETBIO', 'Owner only command', '❌'));
        if (!args.length) return reply(faizanStyle('SETBIO', 'Please provide bio text\nExample: .setbio Powered by Faizan-MD', '❌'));

        const newBio = args.join(' ');
        await conn.updateProfileStatus(newBio);
        await reply(faizanStyle('SETBIO', `Bio updated to: ${newBio}`, '✅'));

    } catch (error) {
        console.error('Setbio error:', error);
        await reply(faizanStyle('SETBIO', error.message || 'Failed to update bio', '❌'));
    }
});

// ============ 8. CLEAR ALL CHATS ============
cmd({
    pattern: "c",
    alias: ["clearchat", "deletechats"],
    desc: "Clear all chats from the bot",
    category: "owner",
    react: "🧹",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, reply }) => {
    if (!isOwner) return reply(faizanStyle('CLEAR CHATS', 'Owner only command', '❌'));

    try {
        await reply(faizanStyle('CLEAR CHATS', 'Clearing all chats...', '⏳'));

        const chats = conn.chats?.all?.() || [];
        let cleared = 0;

        for (const chat of chats) {
            try {
                await conn.modifyChat(chat.jid || chat.id, 'delete');
                cleared++;
                await sleep(500);
            } catch (e) {}
        }

        await reply(faizanStyle('CLEAR CHATS', `✅ Cleared ${cleared} chats`, '✅'));

    } catch (error) {
        await reply(faizanStyle('CLEAR CHATS', error.message || 'Failed to clear', '❌'));
    }
});

// ============ 9. GROUP JIDS LIST ============
cmd({
    pattern: "gjid",
    alias: ["grouplist", "groups", "listgroups"],
    desc: "Get list of all group JIDs",
    category: "owner",
    react: "📝",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, reply }) => {
    if (!isOwner) return reply(faizanStyle('GROUPS', 'Owner only command', '❌'));

    try {
        const groups = await conn.groupFetchAllParticipating();
        const groupIds = Object.keys(groups);

        let groupList = `📝 *GROUP JIDS (${groupIds.length})*\n\n`;
        groupIds.forEach((id, i) => {
            const name = groups[id]?.subject || 'Unknown';
            groupList += `${i+1}. ${id}\n   📛 ${name}\n\n`;
        });

        await reply(faizanStyle('GROUPS', groupList, '✅'));

    } catch (error) {
        await reply(faizanStyle('GROUPS', error.message || 'Failed to fetch', '❌'));
    }
});

// ============ 10. DELETE MESSAGE ============
cmd({
    pattern: "delete",
    alias: ["del", "rm"],
    react: "❌",
    desc: "Delete a message (reply to message)",
    category: "group",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, isAdmins, reply }) => {
    try {
        if (!isOwner && !isAdmins) {
            return reply(faizanStyle('DELETE', 'Admin/Owner only command', '❌'));
        }

        const quoted = mek.quoted || m.quoted;
        if (!quoted) {
            return reply(faizanStyle('DELETE', 'Please reply to a message to delete', '❌'));
        }

        const key = {
            remoteJid: from,
            fromMe: quoted.key?.fromMe || false,
            id: quoted.key.id,
            participant: quoted.key.participant || quoted.key.remoteJid
        };

        await conn.sendMessage(from, { delete: key });

    } catch (error) {
        console.error('Delete error:', error);
        await reply(faizanStyle('DELETE', error.message || 'Failed to delete', '❌'));
    }
});

// ============ 11. RESTART BOT ============
cmd({
    pattern: "restart",
    alias: ["reboot"],
    desc: "Restart the bot",
    category: "owner",
    react: "🔄",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, reply }) => {
    if (!isOwner) return reply(faizanStyle('RESTART', 'Owner only command', '❌'));

    await reply(faizanStyle('RESTART', 'Bot is restarting...', '🔄'));
    setTimeout(() => {
        process.exit(1);
    }, 2000);
});

// ============ 12. LEAVE GROUP ============
cmd({
    pattern: "leave",
    alias: ["leavegroup"],
    desc: "Bot leave the group",
    category: "owner",
    react: "🚪",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, isGroup, reply }) => {
    if (!isOwner) return reply(faizanStyle('LEAVE', 'Owner only command', '❌'));
    if (!isGroup) return reply(faizanStyle('LEAVE', 'This command only works in groups', '❌'));

    await reply(faizanStyle('LEAVE', 'Bot is leaving the group...', '🚪'));
    await sleep(2000);
    await conn.groupLeave(from);
});

// ============ 13. GET BOT INFO ============
cmd({
    pattern: "botinfo",
    alias: ["info", "stats"],
    desc: "Get bot information",
    category: "owner",
    react: "🤖",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, reply }) => {
    try {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        const memUsage = process.memoryUsage();
        const usedMem = (memUsage.heapUsed / 1024 / 1024).toFixed(2);

        const info = `
🤖 *Bot Information*
━━━━━━━━━━━━━━━━
📛 *Name:* ${config.BOT_NAME}
🔣 *Prefix:* ${config.PREFIX}
🌐 *Mode:* ${config.MODE}
⏱️ *Uptime:* ${hours}h ${minutes}m
🧠 *Memory:* ${usedMem} MB
📦 *Commands:* ${Object.keys(commands).length}
👑 *Owner:* ${config.OWNER_NAME}
━━━━━━━━━━━━━━━━
`;

        await reply(faizanStyle('BOT INFO', info, '✅'));

    } catch (error) {
        await reply(faizanStyle('BOT INFO', error.message, '❌'));
    }
});

// ============ 14. EXECUTE COMMAND ============
cmd({
    pattern: "exec",
    alias: ["cmd", "run"],
    desc: "Execute shell command",
    category: "owner",
    react: "💻",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, args, reply }) => {
    if (!isOwner) return reply(faizanStyle('EXEC', 'Owner only command', '❌'));
    if (!args.length) return reply(faizanStyle('EXEC', 'Please provide a command\nExample: .exec ls -la', '❌'));

    const command = args.join(' ');

    exec(command, (error, stdout, stderr) => {
        if (error) {
            return reply(faizanStyle('EXEC', `Error: ${error.message}`, '❌'));
        }
        const output = stdout || stderr || 'No output';
        reply(faizanStyle('EXEC', `${command}\n\n${output.slice(0, 1000)}`, '✅'));
    });
});
