import { enableAutoDelete, disableAutoDelete, isAutoDeleteActive } from '../utils/autoDeleteGroups.js';

export default {
  command: ['autodelete', '!autodelete'],

  async execute(sock, msg, queue, ADMIN_LIST) {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');

    if (!isGroup) {
      await sock.sendMessage(from, { text: '❌ Command ini cuma bisa dipake di dalam grup.' }, { quoted: msg });
      return;
    }

    const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
    const arg = text.split(' ')[1]?.toLowerCase();

    if (arg === 'on') {
      enableAutoDelete(from);
      await sock.sendMessage(from, {
        text: 'aktif'
      }, { quoted: msg });
    } else if (arg === 'off') {
      disableAutoDelete(from);
      await sock.sendMessage(from, { text: 'nonaktif' }, { quoted: msg });
    } else {
      const status = isAutoDeleteActive(from) ? 'AKTIF ✅' : 'NONAKTIF 🔴';
      await sock.sendMessage(from, {
        text: `⚙️ *Auto-hapus Gambar/Stiker*\n\nStatus saat ini: ${status}\n\nGunakan:\n\`!autodelete on\` - aktifkan\n\`!autodelete off\` - nonaktifkan`
      }, { quoted: msg });
    }
  }
};