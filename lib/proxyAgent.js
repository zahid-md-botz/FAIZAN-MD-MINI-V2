/**
 * Optional proxy support for the WhatsApp connection.
 *
 * WhatsApp frequently refuses device-linking from datacenter IP ranges (Heroku, Koyeb,
 * Render, most VPS providers). The symptom is exactly what these logs show: the pairing
 * code is issued, but the socket is closed immediately with 405 or 401 and the freshly
 * linked device is invalidated. No amount of code changes fixes that — the connection has
 * to leave through an IP WhatsApp trusts.
 *
 * Set PROXY_URL to route both the pairing socket and the bot socket through a proxy:
 *   socks5://user:pass@host:1080     (recommended — residential or mobile SOCKS5)
 *   socks5h://user:pass@host:1080
 *   http://user:pass@host:8080
 * Leave it unset and everything behaves exactly as before.
 */

const PROXY_URL = (process.env.PROXY_URL || process.env.SOCKS_PROXY || '').trim();
let cached = null;
let warned = false;

function proxyOptions() {
    if (!PROXY_URL) return {};
    if (cached) return cached;

    try {
        let agent;
        if (/^socks/i.test(PROXY_URL)) {
            const { SocksProxyAgent } = require('socks-proxy-agent');
            agent = new SocksProxyAgent(PROXY_URL);
        } else {
            const { HttpsProxyAgent } = require('https-proxy-agent');
            agent = new HttpsProxyAgent(PROXY_URL);
        }
        const safe = PROXY_URL.replace(/\/\/[^@]*@/, '//***:***@');
        console.log(`[🌐] Routing WhatsApp through proxy: ${safe}`);
        cached = { agent, fetchAgent: agent };
        return cached;
    } catch (e) {
        if (!warned) {
            warned = true;
            console.error('[⚠️] PROXY_URL is set but the proxy agent could not be created:', e.message);
            console.error('     Run: npm i socks-proxy-agent https-proxy-agent');
        }
        return {};
    }
}

module.exports = { proxyOptions, PROXY_URL };
