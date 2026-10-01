import cron from 'node-cron';
import cabangGroups from '../config/cabang-groups.js';
import { getActivePhones } from '../utils/lidMap.js';

const TZ = 'Asia/Jakarta';

/**
 * Kirim pesan + tag semua member grup
 * AMAN untuk Baileys (tanpa groupMetadata forbidden)
 */
async function sendWithTagAll(sock, groupId, text) {
  const metadata = await sock.groupMetadata(groupId);

  const participants = metadata.participants
    .map(p => p.id || p.jid)
    .filter(Boolean);

  if (participants.length === 0) {
    console.log('⚠️ Tidak ada participant untuk di-tag');
    return;
  }

  const mentionText = participants
    .map(jid => `@${jid.split('@')[0]}`)
    .join(' ');

  await sock.sendMessage(groupId, {
    text: `${text}\n\n${mentionText}`,
    mentions: participants
  });
}


/**
 * SCHEDULER PAGI
 */
export function morningScheduler(sock) {
  // Senin–Jumat | 06:00 WIB
  cron.schedule(
    '0 6 * * 1-5',
    async () => {
      for (const groupId of cabangGroups) {
        await sendWithTagAll(
          sock,
          groupId,
          `🌅 *Selamat Pagi*\n\nJangan lupa selamat pagi di grup masing-masing cabang`
        );
      }
    },
    { timezone: TZ }
  );

  // Sabtu–Minggu | 07:00 WIB
  cron.schedule(
    '0 7 * * 6,0',
    async () => {
      for (const groupId of cabangGroups) {
        await sendWithTagAll(
          sock,
          groupId,
          `🌅 *Selamat Pagi*\n\nJangan lupa selamat pagi di grup masing-masing cabang`
        );
      }
    },
    { timezone: TZ }
  );

  console.log('🌞 Morning scheduler aktif');
}

/**
 * SCHEDULER REMINDER SHIFT (!pagi / !siang)
 * Kirim ke PERSONAL CHAT tiap user yang masih aktif (bukan expired),
 * bukan ke grup cabang. Jalan tiap hari jam 06:00 WIB.
 */
export function shiftReminderScheduler(sock) {
  cron.schedule(
    '30 6 * * *',
    async () => {
      const phones = getActivePhones();
      let sent = 0;

      for (const phone of phones) {
        try {
          await sock.sendMessage(`${phone}@s.whatsapp.net`, {
            text: `Selamat pagi, untuk meminimalisir penggunaan langganan multi user, kami akan membuat settingan aktif bot, gunakan perintah *!pagi* dan *!siang*\n\n` +
                  `🌅 *!pagi* → bot aktif 06.00 - 14.00\n` +
                  `☀️ *!siang* → bot aktif 14.00 - 22.00\n\n` +
                  `_Silakan ketik salah satu sesuai jadwal pemakaian Anda hari ini._`
          });
          sent++;
        } catch (err) {
          console.log(`⚠️ Gagal kirim reminder shift ke ${phone}:`, err.message);
        }
      }

      console.log(`📨 Reminder shift terkirim ke ${sent}/${phones.length} user aktif`);
    },
    { timezone: TZ }
  );

  console.log('⏰ Shift reminder scheduler aktif (06:00 setiap hari)');
}

/**
 * SCHEDULER MALAM
 */
export function nightScheduler(sock) {
  // Senin–Sabtu | 21:30 WIB
  cron.schedule(
    '30 21 * * 1-6',
    async () => {
      for (const groupId of cabangGroups) {
        await sendWithTagAll(
          sock,
          groupId,
          `🌙 *Selamat Malam*\n\nJangan lupa kirim report dan settlement EDC`
        );
      }
    },
    { timezone: TZ }
  );

  // Minggu | 21:30 WIB
  cron.schedule(
    '30 21 * * 0',
    async () => {
      for (const groupId of cabangGroups) {
        await sendWithTagAll(
          sock,
          groupId,
          `🌙 *Selamat Malam*\n\nJangan lupa:\n` +
          `• Kirim report\n` +
          `• Settlement EDC\n` +
          `• Kirim peringkat FC PT`
        );
      }
    },
    { timezone: TZ }
  );

  console.log('🌙 Night scheduler aktif');
}