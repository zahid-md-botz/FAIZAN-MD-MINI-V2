const { cmd } = require('../command');
const os = require('os');
const moment = require('moment');
// ❌ const speed = require('performance-now'); - REMOVED
const { exec } = require('child_process');
const config = require('../config');

// FAIZAN style formatter
function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 📊 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

cmd({
    pattern: "sysinfo",
    alias: ["systeminfo", "serverinfo", "status", "stats"],
    desc: "Display detailed system information of the bot server",
    category: "info",
    react: "📊",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        // Loading message
        await reply(faizanStyle('System Info', 'Fetching...', '⏳'));
        
        // Calculate uptime in a readable format
        const uptimeSeconds = os.uptime();
        const uptimeDays = Math.floor(uptimeSeconds / (24 * 3600));
        const uptimeHours = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
        const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptimeString = `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`;
        
        // Calculate CPU usage (async) - NO performance-now
        const cpuUsage = await getCpuUsage();
        
        // Memory usage
        const totalMem = (os.totalmem() / (1024 ** 3)).toFixed(2);
        const freeMem = (os.freemem() / (1024 ** 3)).toFixed(2);
        const usedMem = (totalMem - freeMem).toFixed(2);
        const memPercent = Math.round((usedMem / totalMem) * 100);
        
        // CPU info
        const cpuModel = os.cpus()[0].model;
        const cpuCores = os.cpus().length;
        
        // Network info
        const networkInfo = os.networkInterfaces();
        let ipAddress = "N/A";
        let macAddress = "N/A";
        
        Object.keys(networkInfo).forEach(interface => {
            networkInfo[interface].forEach(details => {
                if (details.family === 'IPv4' && !details.internal) {
                    ipAddress = details.address;
                    macAddress = details.mac;
                }
            });
        });

        // Disk space (Linux/MacOS only)
        let diskSpace = "N/A";
        let diskUsed = "N/A";
        let diskTotal = "N/A";
        let diskPercent = "N/A";
        
        if (os.platform() !== 'win32') {
            const disk = await getDiskSpace();
            if (disk) {
                diskUsed = disk.used;
                diskTotal = disk.total;
                diskPercent = disk.percent;
                diskSpace = `${disk.used} / ${disk.total} (${disk.percent})`;
            }
        }

        // Bot info
        const botName = config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃';
        const botVersion = config.VERSION || '5.0.0';
        const ownerName = config.OWNER_NAME || 'FAIZAN';
        const ownerNumber = config.OWNER_NUMBER || '923061831014';
        
        // Platform info
        const platform = os.platform();
        const arch = os.arch();
        const release = os.release();
        const hostname = os.hostname();
        
        // Load average
        const loadAvg = os.loadavg().map(avg => avg.toFixed(2)).join(', ');

        // Build system info message in FAIZAN style
        const sysInfo = `
*│❀ 🤖 Bot:* ${botName} v${botVersion}
*│❀ 👑 Owner:* ${ownerName} (${ownerNumber})
*│❀ 💻 Host:* ${hostname}
*│❀ 🖥️ OS:* ${platform} (${arch}) ${release}
*│❀ ⏱️ Uptime:* ${uptimeString}
*│❀ 🔥 CPU:* ${cpuModel} (${cpuCores} Cores)
*│❀ ⚡ CPU Usage:* ${cpuUsage}%
*│❀ 📊 Load Avg:* ${loadAvg}
*│❀ 🧠 RAM:* ${usedMem}GB / ${totalMem}GB (${memPercent}%)
*│❀ 💾 Disk:* ${diskSpace}
*│❀ 🌐 IP:* ${ipAddress}
*│❀ 🔌 MAC:* ${macAddress}
`.trim();

        // Send system info with FAIZAN style
        await reply(faizanStyle('SYSTEM INFO', sysInfo, '✅ Online'));

        // React with success
        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (e) {
        console.error("Sysinfo Command Error:", e);
        await reply(faizanStyle('Error', e.message || 'Failed to fetch system info', '❌'));
        
        await conn.sendMessage(from, {
            react: { text: "❌", key: mek.key }
        });
    }
});

// Helper function to calculate CPU usage (FIXED - no performance-now)
async function getCpuUsage() {
    try {
        // Use Date.now() instead of performance-now
        const start = Date.now();
        const startCpu = os.cpus().map(cpu => cpu.times);

        await new Promise(resolve => setTimeout(resolve, 1000));

        const end = Date.now();
        const endCpu = os.cpus().map(cpu => cpu.times);

        const elapsed = (end - start) / 1000;
        const cpuUsage = endCpu.map((cpu, i) => {
            const startTotal = Object.values(startCpu[i]).reduce((a, b) => a + b, 0);
            const endTotal = Object.values(cpu).reduce((a, b) => a + b, 0);
            const totalDiff = endTotal - startTotal;
            const idleDiff = cpu.idle - startCpu[i].idle;
            return Math.round(100 - (idleDiff / totalDiff) * 100);
        });

        const avgCpu = cpuUsage.reduce((a, b) => a + b, 0) / cpuUsage.length;
        return avgCpu.toFixed(1);
    } catch (e) {
        return "N/A";
    }
}

// Helper function to get disk space
async function getDiskSpace() {
    return new Promise((resolve) => {
        exec("df -h /", (error, stdout) => {
            if (error) return resolve(null);
            try {
                const lines = stdout.trim().split("\n");
                if (lines.length > 1) {
                    const parts = lines[1].split(/\s+/);
                    return resolve({
                        used: parts[2],
                        total: parts[1],
                        percent: parts[4]
                    });
                }
            } catch (e) {}
            resolve(null);
        });
    });
}
