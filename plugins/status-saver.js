const { cmd } = require("../command");

const SUPPORTED = ["imageMessage","videoMessage","audioMessage","stickerMessage","documentMessage"];

cmd({
    pattern: "save",
    alias: ["send","sendme"],
    react: "💾",
    desc: "Save / forward a quoted status or media to your DM.",
    category: "utility",
    filename: __filename
}, async (client, message, match, { from }) => {
    try {
        if (!match.quoted) return client.sendMessage(from, { text: "❗ Reply to a status or media message." }, { quoted: message });
        const { mtype } = match.quoted;
        if (!SUPPORTED.includes(mtype)) return client.sendMessage(from, { text: `❌ Unsupported: *${mtype}*\nSupported: image, video, audio, sticker, document.` }, { quoted: message });
        const buffer = await match.quoted.download();
        if (!buffer) return client.sendMessage(from, { text: "❌ Download failed — media may have expired." }, { quoted: message });
        const caption  = match.quoted.text || match.quoted.caption || "";
        const mime     = match.quoted.mimetype || "";
        let payload;
        switch (mtype) {
            case "imageMessage":    payload = { image: buffer, caption, mimetype: mime || "image/jpeg" }; break;
            case "videoMessage":    payload = { video: buffer, caption, mimetype: mime || "video/mp4"  }; break;
            case "audioMessage":    payload = { audio: buffer, mimetype: mime || "audio/mp4", ptt: match.quoted.ptt || false }; break;
            case "stickerMessage":  payload = { sticker: buffer }; break;
            case "documentMessage": payload = { document: buffer, mimetype: mime || "application/octet-stream", fileName: match.quoted.fileName || "file", caption }; break;
        }
        await client.sendMessage(from, payload, { quoted: message });
    } catch (err) {
        console.error("[status-saver]", err);
        client.sendMessage(from, { text: "❌ Failed: " + err.message }, { quoted: message });
    }
});
