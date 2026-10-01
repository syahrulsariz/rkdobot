import handleReqKelas from '../puppeteer/gas-reqkelas.js';
import cabangMap from '../utils/cabang-map.js';

const ALLOWED_GROUPS = [];

function getMessageText(msg) {
  const raw = msg.message?.conversation ||
         msg.message?.extendedTextMessage?.text ||
         msg.message?.imageMessage?.caption ||
         msg.message?.videoMessage?.caption ||
         '';
  // Buang prefix "!" biar konsisten dengan sistem command baru
  return raw.trim().replace(/^!/, '');
}

function isGroupAllowed(msg) {
  if (!msg.key.remoteJid.endsWith('@g.us')) return true;
  if (ALLOWED_GROUPS.length === 0) return true;
  return ALLOWED_GROUPS.includes(msg.key.remoteJid);
}

export default {
  command: 'reqkelas',
  description: 'Request tambah kelas (DANCE, BOXING, KARATE, dll) - support multi',

  async execute(sock, msg, queue) {
    const text = getMessageText(msg).trim().toLowerCase();
    const from = msg.key.remoteJid;

    // ================== HELP ==================
    if (text === 'reqkelas' || text === 'reqkelas ') {
      return await sock.sendMessage(from, {
        text: `📋 *CARA PAKAI REQKELAS*\n\n` +
              `*Single kelas:*\n` +
              `reqkelas bgr DANCE\n\n` +
              `*Multi kelas (pisah koma):*\n` +
              `reqkelas bgr ZUMBA, PILATES, TRX\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `*JENIS KELAS:*\n` +
              `• DANCE\n` +
              `• BOXING\n` +
              `• KARATE\n` +
              `• MUAYTHAI\n` +
              `• GYMNASTIC\n` +
              `• ZUMBA, PILATES, TRX, dll\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `*CABANG TERSEDIA:*\n` +
              Object.keys(cabangMap).join(', ').toUpperCase()
      }, { quoted: msg });
    }

    // ================== PROCESS ==================
    if (text.startsWith('reqkelas ')) {
      if (!isGroupAllowed(msg)) {
        return await sock.sendMessage(from, {
          text: '❌ Bot tidak aktif di group ini untuk command `reqkelas`'
        }, { quoted: msg });
      }

      const fullText = getMessageText(msg).trim();
      const parts = fullText.split(' ');

      if (parts.length < 3) {
        return await sock.sendMessage(from, {
          text: '❌ *Format salah!*\n\n' +
                'Format:\nreqkelas [cabang] [nama kelas]\n\n' +
                'Contoh:\nreqkelas bgr DANCE\nreqkelas bgr ZUMBA, PILATES, TRX'
        }, { quoted: msg });
      }

      const cabang = parts[1].toLowerCase();

      // Semua setelah cabang digabung, lalu split koma → kelasList
      const kelasRaw = parts.slice(2).join(' ');
      const kelasList = kelasRaw.split(',').map(k => k.trim().toUpperCase()).filter(k => k);

      if (!cabangMap[cabang]) {
        return await sock.sendMessage(from, {
          text: `❌ *Kode cabang tidak valid!*\n\n` +
                `Cabang tersedia:\n${Object.keys(cabangMap).join(', ').toUpperCase()}\n\n` +
                `Yang kamu input: \`${cabang}\``
        }, { quoted: msg });
      }

      const isMulti = kelasList.length > 1;
      const kelasInfo = isMulti
        ? `${kelasList.length} kelas: [${kelasList.join(', ')}]`
        : `${kelasList[0]}`;

      await sock.sendMessage(from, {
        text: `⏳ *MEMPROSES TAMBAH KELAS*\n\n` +
              `🏢 Cabang : ${cabang.toUpperCase()}\n` +
              `🎯 Kelas  : ${kelasInfo}\n\n` +
              `_Mohon tunggu sebentar..._`
      }, { quoted: msg });

      queue.add(async () => {
        console.log('============================================');
        console.log(`[REQKELAS] ${cabang.toUpperCase()} - [${kelasList.join(', ')}]`);

        try {
          const results = await handleReqKelas(cabang, kelasList);

          if (!isMulti) {
            // Single — pesan simpel
            if (results.success.length > 0) {
              await sock.sendMessage(from, {
                text: `✅ *KELAS BERHASIL DITAMBAHKAN*\n\n` +
                      `🏢 Cabang: ${cabang.toUpperCase()}\n` +
                      `🎯 Kelas : ${kelasList[0]}\n\n` +
                      `✨ Kelas sudah tersedia di sistem`
              }, { quoted: msg });
            } else {
              await sock.sendMessage(from, {
                text: `❌ *GAGAL TAMBAH KELAS*\n\n` +
                      `🏢 Cabang: ${cabang.toUpperCase()}\n` +
                      `🎯 Kelas : ${kelasList[0]}\n\n` +
                      `🚫 Error: ${results.failed[0]?.error || 'Unknown error'}`
              }, { quoted: msg });
            }
          } else {
            // Multi — detail per kelas
            let detailMsg = `🎉 *HASIL TAMBAH KELAS*\n\n`;
            detailMsg += `🏢 Cabang: ${cabang.toUpperCase()}\n\n`;

            if (results.success.length > 0) {
              detailMsg += `✅ *Berhasil (${results.success.length}):*\n`;
              results.success.forEach(k => { detailMsg += `• ${k}\n`; });
              detailMsg += '\n';
            }

            if (results.failed.length > 0) {
              detailMsg += `❌ *Gagal (${results.failed.length}):*\n`;
              results.failed.forEach(f => { detailMsg += `• ${f.kelas}: ${f.error}\n`; });
            }

            detailMsg += `\n📊 Total: ${results.success.length}/${kelasList.length} berhasil`;

            await sock.sendMessage(from, { text: detailMsg }, { quoted: msg });
          }

        } catch (err) {
          console.error(`[FAILED] reqkelas: ${err.message}`);
          await sock.sendMessage(from, {
            text: `❌ *GAGAL TAMBAH KELAS*\n\n` +
                  `🏢 Cabang: ${cabang.toUpperCase()}\n` +
                  `🚫 Error: ${err.message}`
          }, { quoted: msg });
        }

        console.log('============================================');
      });
    }
  }
};