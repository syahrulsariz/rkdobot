import handleReqInstruktur from '../puppeteer/gas-reqinstruktur.js';
import cabangMap from '../utils/cabang-map.js';

const validBranches = Object.keys(cabangMap);

export default {
  command: 'reqins',

  async execute(sock, msg, queue) {
    const rawText = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';

    // Buang prefix "!" biar konsisten dengan sistem command baru
    const text = rawText.trim().replace(/^!/, '');

    const textLower = text.trim().toLowerCase();

    if (textLower === 'reqins' || textLower === 'reqins ') {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: 'Contoh format:\n• Single  : reqins bgr BUDI cowok\n• Multi   : reqins bgr joko, surya, ilham'
      }, { quoted: msg });
    }

    if (textLower.startsWith('reqins ')) {
      const parts = text.trim().split(/\s+/);

      if (parts.length < 3) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: 'Format salah, contoh: reqins bgr NAMA atau reqins bgr nama1, nama2, nama3'
        }, { quoted: msg });
      }

      const cabang = parts[1].toLowerCase();

      if (!cabangMap[cabang]) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ Kode cabang tidak valid!\n\n*Kode cabang:* ${validBranches.join(', ')}`
        }, { quoted: msg });
      }

      // Ambil semua setelah cabang, split by koma
      const afterCabang = parts.slice(2).join(' ');
      const namaList = afterCabang
        .split(',')
        .map(n => n.trim())
        .filter(n => n.length > 0);

      if (namaList.length === 0) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: 'Format salah, nama tidak boleh kosong.'
        }, { quoted: msg });
      }

      // Default gender cowok
      // Kalau single nama, cek apakah kata terakhir adalah gender
      let gender = 'cowok';
      let finalNamaList = namaList;

      if (namaList.length === 1) {
        const words = namaList[0].split(/\s+/);
        const lastWord = words[words.length - 1].toLowerCase();
        const validGenders = ['cowok', 'cewek', 'cowo', 'cewe', 'laki', 'pria', 'perempuan', 'wanita'];
        if (validGenders.includes(lastWord)) {
          gender = lastWord;
          finalNamaList = [words.slice(0, -1).join(' ')];
        }
      }

      await sock.sendMessage(msg.key.remoteJid, {
        text: `⏳ Memproses ${finalNamaList.length} instruktur, tunggu sebentar...`
      }, { quoted: msg });

      queue.add(async () => {
        console.log('============================================');
        try {
          const results = await handleReqInstruktur(cabang, finalNamaList, gender);

          const successMsg = results.success.length
            ? `✅ Berhasil: ${results.success.join(', ')}` : '';
          const failedMsg = results.failed.length
            ? `❌ Gagal:\n${results.failed.map(f => `• ${f.nama}: ${f.error}`).join('\n')}` : '';

          await sock.sendMessage(msg.key.remoteJid, {
            text: [successMsg, failedMsg].filter(Boolean).join('\n\n')
          }, { quoted: msg });

        } catch (err) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ ${err.message}`
          }, { quoted: msg });
        }
        console.log('============================================');
      });
    }
  }
};