const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { cmd, commands } = require('../command');
const { runtime } = require('../lib/functions');

cmd({
  pattern: 'version',
  alias: ["changelog", "cupdate", "checkupdate"],
  react: '🚀',
  desc: "Check bot's version, system stats, and update info.",
  category: 'info',
  filename: __filename
}, async (conn, mek, m, {
  from, sender, pushname, reply
}) => {
  try {
    // Read local version data
    const localVersionPath = path.join(__dirname, '../data/version.json');
    let localVersion = 'Unknown';
    let changelog = 'No changelog available.';
    let lastUpdate = 'Unknown';

    if (fs.existsSync(localVersionPath)) {
      const localData = JSON.parse(fs.readFileSync(localVersionPath));
      localVersion = localData.version || 'Unknown';
      changelog = localData.changelog || 'No changelog available.';
      try {
        lastUpdate = fs.statSync(localVersionPath).mtime.toLocaleString();
      } catch (_) {}
    }

    // Fetch latest version data from GitHub (correct repo)
    const rawVersionUrl = 'https://raw.githubusercontent.com/Faizan-MD007/Faizan-MD/main/data/version.json';
    let latestVersion = 'Unknown';
    let latestChangelog = 'No changelog available.';
    try {
      const { data } = await axios.get(rawVersionUrl, { timeout: 8000 });
      latestVersion = data.version || 'Unknown';
      latestChangelog = data.changelog || 'No changelog available.';
    } catch (error) {
      console.error('Failed to fetch latest version:', error.message);
    }

    // Count total plugins
    const pluginPath = path.join(__dirname, '../plugins');
    const pluginCount = fs.readdirSync(pluginPath).filter(file => file.endsWith('.js')).length;

    // Count total registered commands
    const totalCommands = commands.length;

    // System info
    const uptime = runtime(process.uptime());
    const ramUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalRam = (os.totalmem() / 1024 / 1024).toFixed(2);
    const hostName = os.hostname();

    // GitHub repo (correct)
    const githubRepo = 'https://github.com/Faizan-MD007/Faizan-MD';

    // Check update status
    let updateMessage = `✅ Your *FAIZAN-MD* bot is up-to-date!`;
    if (localVersion !== 'Unknown' && latestVersion !== 'Unknown' && localVersion !== latestVersion) {
      updateMessage = `🚀 *Update Available!*\n📌 *Current Version:* ${localVersion}\n📌 *Latest Version:* ${latestVersion}\n\nUse *.update* to update now.`;
    }

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    const statusMessage =
      `🌟 *${greeting}, ${pushname}!* 🌟\n\n` +
      `🤖 *Bot Name:* FAIZAN-MD\n` +
      `📌 *Current Version:* ${localVersion}\n` +
      `🆕 *Latest Version:* ${latestVersion}\n` +
      `🔌 *Total Plugins:* ${pluginCount}\n` +
      `📜 *Total Commands:* ${totalCommands}\n\n` +
      `💻 *System Info:*\n` +
      `⏱ *Uptime:* ${uptime}\n` +
      `🧠 *RAM Usage:* ${ramUsage}MB / ${totalRam}MB\n` +
      `🖥 *Host:* ${hostName}\n` +
      `🕐 *Last Update:* ${lastUpdate}\n\n` +
      `📋 *Changelog:*\n${latestChangelog}\n\n` +
      `⭐ *GitHub Repo:* ${githubRepo}\n` +
      `👤 *Owner:* [FAIZAN-MD](https://github.com/Faizan-MD007)\n\n` +
      `${updateMessage}\n\n` +
      `🚀 *Don't forget to fork & star the repo!*`;

    // Send with image
    await conn.sendMessage(from, {
      image: { url: 'https://files.catbox.moe/ejufwa.jpg' },
      caption: statusMessage,
      contextInfo: {
        mentionedJid: [m.sender],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363421896999345@newsletter',
          newsletterName: 'FAIZAN-MD',
          serverMessageId: 143
        }
      }
    }, { quoted: mek });

  } catch (error) {
    console.error('Error fetching version info:', error);
    reply('❌ An error occurred while checking the bot version.');
  }
});
