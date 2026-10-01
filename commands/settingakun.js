import cabangMap from '../utils/cabang-map.js';
import { setAkunCabang } from '../utils/cabang-akun.js';

const validBranches = Object.keys(cabangMap);

// Password ditampilin sebagian aja pas konfirmasi, biar gak full ke-expose di chat
function maskPassword(password) {
  if (password.length <= 2) return '*'.repeat(password.length);
  return password.slice(0, 2) + '*'.repeat(Math.max(password.length - 2, 3));
}

export default {
  command: 'settingakun',

  async execute(sock, msg, queue, adminList = []) {
    const rawText = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';

    // Buang prefix "!" biar konsisten dengan sistem command lain
    const text = rawText.trim().replace(/^!/, '');
    const parts = text.trim().split(/\s+/);

    // parts[0] = "settingakun", parts[1] = cabang, parts[2] = username, parts[3] = password
    if (parts.length < 4) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: `Format salah!\n\nContoh: !settingakun rnj bayyu bayyu12h\n\n*Kode cabang:* ${validBranches.join(', ')}`
      }, { quoted: msg });
    }

    const cabang = parts[1].toLowerCase();
    const username = parts[2];
    const password = parts[3];

    if (!cabangMap[cabang]) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Kode cabang tidak valid!\n\n*Kode cabang:* ${validBranches.join(', ')}`
      }, { quoted: msg });
    }

    try {
      const { isReplace } = setAkunCabang(cabang, username, password);

      await sock.sendMessage(msg.key.remoteJid, {
        text: `✅ Akun cabang *${cabang.toUpperCase()}* berhasil ${isReplace ? 'di-update' : 'disimpan'}!\n\nUsername: ${username}\nPassword: ${maskPassword(password)}`
      }, { quoted: msg });
    } catch (err) {
      console.error('❌ Error settingakun:', err.message);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Gagal menyimpan akun: ${err.message}`
      }, { quoted: msg });
    }
  }
};