const { cmd } = require('../command');
const config = require('../config');
const { exec } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════
// FAIZAN-MD SMART UPDATER v3.2
// fix v3.2: typo BLANCH -> BRANCH (caused /branches/undefined 404)
// fix v3.1: /commits/main was 404 — switched to /branches/main
// ═══════════════════════════════════════════════════

const REPO_OWNER = 'Faizan-MD007';
const REPO_NAME  = 'Faizan-MD';
const BRANCH     = 'main';
const ROOT_DIR   = path.join(__dirname, '..');
const SHA_FILE   = path.join(ROOT_DIR, 'data', 'last-sha.txt');
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const RAW_BASE   = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`;

// ─── Box formatter ─────────────────────────────────────────────────────────
function box(rows) {
    const body = rows.map(([e, l, v]) => `*| ${e} ${l}:* ${v ?? ''}`).join('\n');
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || 'FAIZAN-MD'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
${body}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> *Powered By ${config.OWNER_NAME || 'FAIZAN-MD'}* ✅`;
}

// ─── React helper ──────────────────────────────────────────────────────────
function sendReact(conn, mek, emoji) {
    return conn.sendMessage(mek.key.remoteJid, { react: { text: emoji, key: mek.key } });
}

// ─── Run shell command ─────────────────────────────────────────────────────
function runCmd(command) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd: ROOT_DIR }, (err, stdout, stderr) => {
            if (err) return reject(stderr || err.message);
            resolve(stdout.trim());
        });
    });
}

// ─── Get latest commit SHA from /branches/main ────────────────────────────
async function getRemoteSha() {
    const res = await axios.get(`${GITHUB_API}/branches/${BRANCH}`, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        timeout: 15000
    });
    // Response shape: { commit: { sha: '...' }, ... }
    return res.data.commit.sha;
}

// ─── Local SHA ─────────────────────────────────────────────────────────────
function getLocalSha() {
    try {
        if (fs.existsSync(SHA_FILE)) return fs.readFileSync(SHA_FILE, 'utf8').trim();
    } catch (_) {}
    return null;
}

function saveLocalSha(sha) {
    try {
        const dir = path.dirname(SHA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SHA_FILE, sha, 'utf8');
    } catch (_) {}
}

// ─── Get changed files between two SHAs ───────────────────────────────────
async function getChangedFiles(localSha, remoteSha) {
    try {
        const res = await axios.get(`${GITHUB_API}/compare/${localSha}...${remoteSha}`, {
            headers: { 'Accept': 'application/vnd.github.v3+json' },
            timeout: 15000
        });
        const files = res.data.files || [];
        return {
            added:      files.filter(f => f.status === 'added').map(f => f.filename),
            modified:   files.filter(f => f.status === 'modified').map(f => f.filename),
            removed:    files.filter(f => f.status === 'removed').map(f => f.filename),
            newPlugins: files.filter(f => f.status === 'added' && f.filename.startsWith('plugins/')).map(f => f.filename.replace('plugins/', '')),
            total:      files.length
        };
    } catch (_) {
        return { added: [], modified: [], removed: [], newPlugins: [], total: 0 };
    }
}

// ─── Download a file from GitHub raw ──────────────────────────────────────
async function downloadFile(filePath) {
    const url = `${RAW_BASE}/${filePath}`;
    const localPath = path.join(ROOT_DIR, filePath);
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const res = await axios.get(url, { timeout: 20000, responseType: 'arraybuffer' });
    fs.writeFileSync(localPath, res.data);
}

async function tryGitPull() {
    try { await runCmd(`git pull origin ${BRANCH}`); return true; } catch (_) { return false; }
}

function restartBot() {
    setTimeout(async () => {
        try { await runCmd('pm2 restart FAIZAN-AI'); return; } catch (_) {}
        try { await runCmd('pm2 restart all'); return; } catch (_) {}
        process.exit(0);
    }, 3000);
}

// ═══════════════════════════════════════════════════
cmd({
    pattern: 'update',
    alias: ['updater', 'gitpull', 'botupdate'],
    desc: 'Smart updater — only updates when files change on GitHub',
    category: 'owner',
    react: '📦',
    filename: __filename
},
async (conn, mek, m, { from, reply, isOwner }) => {

    if (!isOwner) return reply('*❌ Owner only command!*');

    try {
        await sendReact(conn, mek, '⏳');

        // STEP 1: Remote SHA
        let remoteSha;
        try {
            remoteSha = await getRemoteSha();
        } catch (e) {
            await sendReact(conn, mek, '❌');
            return reply(box([
                ['❌', 'GitHub Error', 'Could not reach GitHub API'],
                ['📡', 'Detail', (e.message || 'Network error').slice(0, 60)],
                ['💡', 'Fix', 'Check internet & try again']
            ]));
        }

        // STEP 2: Local SHA
        let localSha = getLocalSha();
        if (!localSha) {
            try { localSha = await runCmd('git rev-parse HEAD'); } catch (_) {}
        }

        const shortLocal  = localSha ? localSha.slice(0, 7) : 'fresh';
        const shortRemote = remoteSha.slice(0, 7);

        // STEP 3: Already up to date?
        if (localSha && localSha === remoteSha) {
            await sendReact(conn, mek, '✅');
            return reply(box([
                ['✅', 'Status',  'Already up to date!'],
                ['🔖', 'Version', shortLocal],
                ['🌿', 'Branch',  BRANCH],
                ['🔒', 'Action',  'No restart needed']
            ]));
        }

        // STEP 4: Changed files
        let diff = { added: [], modified: [], removed: [], newPlugins: [], total: 0 };
        if (localSha) diff = await getChangedFiles(localSha, remoteSha);

        const newPluginsList = diff.newPlugins.length
            ? diff.newPlugins.slice(0, 5).join(', ') + (diff.newPlugins.length > 5 ? ` +${diff.newPlugins.length - 5} more` : '')
            : 'None';

        await conn.sendMessage(from, { text: box([
            ['🔔', 'Update Found', ''],
            ['📌', 'Local',       shortLocal],
            ['🆕', 'Remote',      shortRemote],
            ['✴', 'New Plugins', newPluginsList],
            ['✏️', 'Modified',   `${diff.modified.length} file(s)`],
            ['🗑️', 'Removed',   `${diff.removed.length} file(s)`],
            ['⏳', 'Status',     'Downloading...']
        ]) }, { quoted: mek });

        // STEP 5: Download
        const toDownload = [...diff.added, ...diff.modified];
        let downloaded = 0, failed = 0;

        const gitWorked = await tryGitPull();
        if (!gitWorked && toDownload.length > 0) {
            for (const fp of toDownload) {
                try { await downloadFile(fp); downloaded++; } catch (_) { failed++; }
            }
        } else if (gitWorked) {
            downloaded = toDownload.length;
        }

        for (const fp of diff.removed) {
            try { const lp = path.join(ROOT_DIR, fp); if (fs.existsSync(lp)) fs.unlinkSync(lp); } catch (_) {}
        }

        if (diff.modified.includes('package.json') || diff.added.includes('package.json')) {
            try { await runCmd('npm install --production'); } catch (_) {}
        }

        // STEP 6: Save + Restart
        saveLocalSha(remoteSha);
        await sendReact(conn, mek, '✅');
        await reply(box([
            ['✅', 'Update Done',   ''],
            ['🔖', 'New Version',  shortRemote],
            ['✴', 'New Plugins',  newPluginsList],
            ['✅', 'Updated',      `${downloaded} file(s)`],
            ...(failed > 0 ? [['⚠️', 'Failed', `${failed} file(s)`]] : []),
            ['📦', 'Restarting',  'Bot restart in 3s...']
        ]));

        restartBot();

    } catch (e) {
        await sendReact(conn, mek, '❌');
        console.error('Updater v3.2 error:', e);
        reply(box([['❌', 'Error', (e.message || 'Unknown error').slice(0, 80)]]));
    }
});
