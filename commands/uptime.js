import os from 'os';

// ==========================================
// HELPER
// ==========================================

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}s`);
  }

  return parts.join(' ');
}

function formatBytes(bytes) {
  const gb = bytes / (1024 ** 3);
  return gb.toFixed(2) + ' GB';
}

// ==========================================
// CPU REAL-TIME
// ==========================================

function getCpuSnapshot() {
  const cpus = os.cpus();

  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    idle += cpu.times.idle;

    total +=
      cpu.times.user +
      cpu.times.nice +
      cpu.times.sys +
      cpu.times.irq +
      cpu.times.idle;
  }

  return {
    idle,
    total
  };
}

async function getCPUUsage() {
  const start = getCpuSnapshot();

  // Sampling 1 detik supaya CPU usage lebih real
  await new Promise(resolve => setTimeout(resolve, 1000));

  const end = getCpuSnapshot();

  const idleDiff = end.idle - start.idle;
  const totalDiff = end.total - start.total;

  if (totalDiff <= 0) {
    return '0.0';
  }

  const usage = 100 * (1 - idleDiff / totalDiff);

  return Math.max(
    0,
    Math.min(100, usage)
  ).toFixed(1);
}

// ==========================================
// MEMORY BAR
// ==========================================

function getMemoryBar(percentage) {
  const filled = Math.max(
    0,
    Math.min(10, Math.round(percentage / 10))
  );

  const empty = 10 - filled;

  return '█'.repeat(filled) + '░'.repeat(empty);
}

// ==========================================
// PERFORMANCE
// ==========================================

function getPerformanceScore(cpuUsage, memUsage) {
  const avgUsage =
    (parseFloat(cpuUsage) + parseFloat(memUsage)) / 2;

  if (avgUsage < 30) return '✅ EXCELLENT';
  if (avgUsage < 50) return '🟢 GOOD';
  if (avgUsage < 70) return '🟡 MODERATE';
  if (avgUsage < 85) return '🟠 HIGH';

  return '🔴 CRITICAL';
}

// ==========================================
// LOAD AVERAGE
// ==========================================

function getLoadAverage() {
  if (os.platform() === 'win32') {
    return 'N/A';
  }

  return os
    .loadavg()
    .map(value => value.toFixed(2))
    .join(', ');
}

// ==========================================
// COMMAND
// ==========================================

const uptimeCommand = {
  command: '!uptime',
  description: 'Menampilkan status dan informasi sistem VPS',

  async execute(sock, msg) {
    const from = msg.key.remoteJid;

    try {

      // ========================================
      // SYSTEM INFO
      // ========================================

      const hostname = os.hostname();
      const platform = os.platform();
      const release = os.release();
      const arch = os.arch();
      const uptime = os.uptime();

      const cpus = os.cpus();
      const cpuModel = cpus[0]?.model || 'Unknown';
      const cpuCores = cpus.length;

      // ========================================
      // MEMORY
      // ========================================

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      const memUsagePercent =
        ((usedMem / totalMem) * 100).toFixed(1);

      // ========================================
      // CPU REAL-TIME
      // ========================================

      const cpuUsage = await getCPUUsage();

      const memBar = getMemoryBar(
        parseFloat(memUsagePercent)
      );

      const performanceScore =
        getPerformanceScore(
          cpuUsage,
          memUsagePercent
        );

      const loadAvg = getLoadAverage();

      // ========================================
      // OS
      // ========================================

      let osName = platform;

      if (platform === 'win32') {
        osName = `Windows ${release}`;
      } else if (platform === 'linux') {
        osName = `Linux ${release}`;
      } else if (platform === 'darwin') {
        osName = `macOS ${release}`;
      }

      // ========================================
      // WAKTU
      // ========================================

      const waktu = new Date().toLocaleString(
        'id-ID',
        {
          timeZone: 'Asia/Jakarta'
        }
      );

      // ========================================
      // MESSAGE
      // ========================================

      const message = `╔════ *VPS STATUS* ═════════╗
║
║ 🖥️ *SYSTEM*
║ Hostname : *${hostname}*
║ OS : *${osName}*
║ Arch : *${arch}*
║ Uptime : *${formatUptime(uptime)}*
║
║ 💻 *CPU*
║ Model : *${cpuModel}*
║ Cores : *${cpuCores}*
║ Usage : *${cpuUsage}%*
║ Load : *${loadAvg}*
║
║ 💾 *RAM*
║ Usage : *${memUsagePercent}%*
║ Bar : [${memBar}]
║ Used : *${formatBytes(usedMem)}*
║ Free : *${formatBytes(freeMem)}*
║ Total : *${formatBytes(totalMem)}*
║
║ 🎯 Status : ${performanceScore}
║
║ ⏰ ${waktu}
║
╚══════ *RKDO BOT V1* ═════╝`;

      // ========================================
      // SEND
      // ========================================

      await sock.sendMessage(
        from,
        {
          text: message
        },
        {
          quoted: msg
        }
      );

      console.log(
        `✅ Uptime report sent | CPU: ${cpuUsage}% | RAM: ${memUsagePercent}%`
      );

    } catch (error) {

      console.error(
        '❌ Error in uptime command:',
        error
      );

      await sock.sendMessage(
        from,
        {
          text: `╔════ *ERROR* ═══════════════╗
║
║ Gagal mengambil informasi
║ sistem VPS.
║
║ Error : ${error.message}
║
╚══════ *RKDO BOT V1* ═════╝`
        },
        {
          quoted: msg
        }
      );
    }
  }
};

export default uptimeCommand;