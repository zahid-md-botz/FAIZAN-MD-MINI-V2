const { cmd } = require('../command');
const axios = require('axios');
const config = require('../config');

const PAIR_API = 'https://paring-site-44t7.onrender.com/pair';

// =============== FAIZAN-MD STYLE ===============
function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🔗 ${title}:* ${value}
*│❀ ✨ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

// =============== FETCH WITH RETRY (Render free-tier cold-start safe) ===============
async function getPairingCode(phone, onColdStart) {
    // Render free tier can take ~30-50s to cold-start, so we use long timeouts
    const attempts = [
        { timeout: 40000 },
        { timeout: 55000, delay: 3000, notify: true },  // notify user on 2nd attempt
        { timeout: 60000, delay: 8000 },
        { timeout: 60000, delay: 12000 }
    ];

    for (let i = 0; i < attempts.length; i++) {
        const attempt = attempts[i];

        // Delay before retry
        if (i > 0 && attempt.delay) {
            await new Promise(r => setTimeout(r, attempt.delay));
        }

        // Notify user that server is cold-starting
        if (attempt.notify && onColdStart) {
            await onColdStart();
        }

        try {
            const res = await axios.get(PAIR_API, {
                params: { number: phone },
                timeout: attempt.timeout,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            const data = res.data;

            // Success check
            if (data?.success && data?.code) {
                return { ok: true, code: data.code };
            }

            // API replied but no code — no point retrying
            const msg = data?.message || 'Server returned no pairing code';
            return { ok: false, error: msg };

        } catch (err) {
            const isLast = i === attempts.length - 1;
            console.log(`[Pair] Attempt ${i + 1}/${attempts.length} failed: ${err.message}`);

            if (isLast) {
                if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                    return { ok: false, error: 'Server is not responding. Please try again in 1 minute.' };
                }
                if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
                    return { ok: false, error: 'Pairing server is offline. Try again later.' };
                }
                if (err.response?.status === 429) {
                    return { ok: false, error: 'Too many requests. Please wait a moment and try again.' };
                }
                return { ok: false, error: err.message || 'Unknown error occurred' };
            }
            // else continue to next attempt
        }
    }

    return { ok: false, error: 'All retry attempts exhausted. Please try again later.' };
}

// =============== .pair COMMAND ===============
cmd({
    pattern: 'pair',
    alias: ['getpair', 'paircode'],
    react: '🔗',
    desc: 'Get pairing code for Faizan-MD bot',
    category: 'main',
    use: '.pair 923XXXXXXXXXX',
    filename: __filename
}, async (conn, mek, m, { from, q, senderNumber, reply }) => {
    try {
        // ── Phone number parsing ──
        const raw = (q || senderNumber || '').trim();
        const phone = raw.replace(/[^0-9]/g, '');

        if (!phone || phone.length < 10 || phone.length > 15) {
            return reply(faizanStyle(
                'PAIRING CODE',
                'Provide a valid number without +\nExample: *.pair 923306137XXX*',
                '❌'
            ));
        }

        // ── Initial feedback ──
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply(faizanStyle(
            'PAIRING CODE',
            `Generating code for *+${phone}*...`,
            '🔍'
        ));

        // ── Cold-start notification ──
        let coldNotified = false;
        const notifyColdStart = async () => {
            if (coldNotified) return;
            coldNotified = true;
            await reply(faizanStyle(
                'PAIRING CODE',
                'Server is waking up *(Render cold start)*\nPlease wait ~30 seconds ⏳',
                '🔄'
            ));
        };

        // ── Fetch code ──
        const result = await getPairingCode(phone, notifyColdStart);

        if (!result.ok) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply(faizanStyle('PAIRING CODE', result.error, '❌'));
        }

        // ── Success ──
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

        await reply(faizanStyle(
            'PAIRING CODE',
            `📱 *Number:* +${phone}\n*│❀ 🔑 Code:* \`${result.code}\``,
            '✅ Successfully Generated'
        ));

        // Send code alone for easy copy-paste
        await new Promise(r => setTimeout(r, 1500));
        await reply(`*${result.code}*`);

    } catch (err) {
        console.error('[Pair] Fatal error:', err.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        await reply(faizanStyle(
            'PAIRING CODE',
            'Something went wrong. Please try again.',
            '❌'
        ));
    }
});
