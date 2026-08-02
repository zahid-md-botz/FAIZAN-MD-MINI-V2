const { cmd } = require("../command");

const SUPPORTED = ["imageMessage","videoMessage","audioMessage","stickerMessage","documentMessage"];

function buildPayload(mtype, buffer, q) {
    const caption = q.text || q.caption || "";
    const mime    = q.mimetype || "";
    switch (mtype) {
        case "imageMessage":    return { image:    buffer, caption, mimetype: mime || "image/jpeg" };
        case "videoMessage":    return { video:    buffer, caption, mimetype: mime || "video/mp4"  };
        case "audioMessage":    return { audio:    buffer, mimetype: mime || "audio/mp4", ptt: q.ptt || false };
        case "stickerMessage":  return { sticker:  buffer };
        case "documentMessage": return { document: buffer, mimetype: mime || "application/octet-stream", fileName: q.fileName || "file", caption };
        default:                return null;
    }
}

// .vv — owner only ────────────────────────────────────────────────────────────
cmd({
    pattern: "vv",
    alias: ["viewonce","retrive"],
    react: "👀",
    desc: "Retrieve a view-once message (owner only)",
    category: "owner",
    filename: __filename
}, async (client, message, match, { from, isCreator }) => {
    try {
        if (!isCreator) return client.sendMessage(from, { text: "*📛 Owner only command.*" }, { quoted: message });
        if (!match.quoted) return client.sendMessage(from, { text: "*🍁 Reply to a view-once message!*" }, { quoted: message });
        const { mtype } = match.quoted;
        if (!SUPPORTED.includes(mtype)) return client.sendMessage(from, { text: `❌ Unsupported: ${mtype}` }, { quoted: message });
        const buffer = await match.quoted.download();
        if (!buffer) return client.sendMessage(from, { text: "❌ Download failed — media may have expired." }, { quoted: message });
        await client.sendMessage(from, buildPayload(mtype, buffer, match.quoted), { quoted: message });
    } catch (e) {
        console.error("[vv]", e);
        client.sendMessage(from, { text: "❌ Error: " + e.message }, { quoted: message });
    }
});

// .vv2 — all users, sends to DM ───────────────────────────────────────────────
cmd({
    pattern: "vv2",
    alias: ["viewonce2","savevv"],
    react: "💾",
    desc: "Save view-once to your DM",
    category: "utility",
    filename: __filename
}, async (client, message, match, { from, sender }) => {
    try {
        if (!match.quoted) return client.sendMessage(from, { text: "*🍁 Reply to a view-once message!*" }, { quoted: message });
        const { mtype } = match.quoted;
        if (!SUPPORTED.includes(mtype)) return client.sendMessage(from, { text: `❌ Unsupported: ${mtype}` }, { quoted: message });
        const buffer = await match.quoted.download();
        if (!buffer) return client.sendMessage(from, { text: "❌ Download failed — media may have expired." }, { quoted: message });
        await client.sendMessage(sender, buildPayload(mtype, buffer, match.quoted));
        await client.sendMessage(from, { text: "✅ Sent to your DM!" }, { quoted: message });
    } catch (e) {
        console.error("[vv2]", e);
        client.sendMessage(from, { text: "❌ Error: " + e.message }, { quoted: message });
    }
});

// .vv3 — all users, forwards in current chat ──────────────────────────────────
cmd({
    pattern: "vv3",
    alias: ["viewonce3","openvv"],
    react: "🔓",
    desc: "Open view-once in current chat",
    category: "utility",
    filename: __filename
}, async (client, message, match, { from }) => {
    try {
        if (!match.quoted) return client.sendMessage(from, { text: "*🍁 Reply to a view-once message!*" }, { quoted: message });
        const { mtype } = match.quoted;
        if (!SUPPORTED.includes(mtype)) return client.sendMessage(from, { text: `❌ Unsupported: ${mtype}` }, { quoted: message });
        const buffer = await match.quoted.download();
        if (!buffer) return client.sendMessage(from, { text: "❌ Download failed — media may have expired." }, { quoted: message });
        await client.sendMessage(from, buildPayload(mtype, buffer, match.quoted), { quoted: message });
    } catch (e) {
        console.error("[vv3]", e);
        client.sendMessage(from, { text: "❌ Error: " + e.message }, { quoted: message });
    }
});
