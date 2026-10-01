// commands/extend.js
import { getExtendOption } from '../utils/extendPrices.js';
import { initiateTopup, isProcessing, lockProcessing, unlockProcessing } from '../utils/extendPayment.js';
import { setActivePeriod, normalizePhone, getPhoneByLid } from '../utils/lidMap.js';

function resolveSenderPhone(msg) {
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderPhone = msg.key.remoteJidAlt || null;

  // 1. Kalau remoteJidAlt kebawa di pesan ini, pakai itu
  if (senderPhone) return normalizePhone(senderPhone.split('@')[0]);

  // 2. Kalau sender bukan format LID, dia udah nomor HP asli
  if (!sender.endsWith('@lid')) return normalizePhone(sender.split('@')[0]);

  // 3. Fallback: sender pakai @lid tapi remoteJidAlt gak kebawa di pesan ini
  //    -> cek mapping yang udah tersimpan sebelumnya (dari !myid / pesan lain)
  const lid = sender.split('@')[0];
  return getPhoneByLid(lid); // null kalau LID beneran belum pernah kemapping
}

export default {
  command: ['!extend', 'extend'],
  execute: async (sock, msg) => {
    const from = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

    // Format: !extend 30 hari  /  !extend 90 hari
    const match = text.trim().match(/(\d+)\s*hari/i);
    const days = match ? parseInt(match[1], 10) : null;
    const option = days ? getExtendOption(days) : null;

    if (!option) {
      await sock.sendMessage(from, {
text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !extend <jumlah hari>
║ Example : !extend 30 hari
║
╚══════ *RKDO BOT V1* ═════╝

╔══════ *PRICE LIST* ══════╗
║
║ 7 Hari    : 10.000
║ 14 Hari   : 20.000
║ 21 Hari   : 25.000
║ 30 Hari   : 30.000
║ 45 Hari   : 35.000
║ 60 Hari   : 40.000
║ 75 Hari   : 45.000
║ 90 Hari   : 50.000
║ 105 Hari  : 55.000
║ 120 Hari  : 60.000
║ 135 Hari  : 65.000
║ 150 Hari  : 70.000
║ 165 Hari  : 75.000
║ 180 Hari  : 80.000
║ 195 Hari  : 85.000
║ 210 Hari  : 90.000
║ 225 Hari  : 95.000
║ 240 Hari  : 100.000
║ 300 Hari  : 150.000
║ 360 Hari  : 200.000
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
      return;
    }

    const phone = resolveSenderPhone(msg);
    if (!phone) {
      await sock.sendMessage(from, {
                text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !extend <jumlah hari>
║ Example : !extend 30 hari
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
      return;
    }

    if (isProcessing(phone)) {
      await sock.sendMessage(from, {
        text: 'Masih ada pembayaran tertunda, tunggu sampai masa berlaku qris habis!'
      }, { quoted: msg });
      return;
    }

    await sock.sendMessage(from, {
      text: `Memproses perpanjangan masa aktif menggunakan bot selama ${days} hari...\nMohon tunggu sebentar.`
    }, { quoted: msg });

    let session;
    try {
      session = await initiateTopup(option.nominalLabel);
    } catch (err) {
      await sock.sendMessage(from, {
        text: `Gagal, Mohon ulangi sekali lagi`
      }, { quoted: msg });
      return;
    }

    // Nominal aktual bisa beda dikit dari harga di config karena markup dinamis situs,
    // jadi pakai totalAmount dari sesi kalau ada, fallback ke harga config.
    const displayedAmount = session.totalAmount || `Rp ${option.price.toLocaleString('id-ID')}`;

    // Kirim QRIS
    const qrMsg = await sock.sendMessage(from, {
      image: session.qrBuffer,
      caption: `╔════ *QRIS PAYMENT* ═════╗
║
║ Silahkan lakukan pembayaran
║ untuk perpanjangan ${days} Hari
║
║ Nominal : ${displayedAmount}
║
║ Pembayaran dibatalkan dalam waktu 5 menit.
║
╚══════ *RKDO BOT V1* ═════╝` 
    }, { quoted: msg });

    const qrMessageKey = qrMsg.key;

    lockProcessing(phone);

    try {
      const status = await session.checkStatus();

      // Hapus pesan QRIS untuk semua orang, apapun hasil statusnya
      await sock.sendMessage(from, { delete: qrMessageKey }).catch((err) => {
        console.log('   ⚠️  Gagal hapus pesan QRIS:', err.message);
      });

      if (status === 'success') {
        const result = setActivePeriod(phone, days);
        const expiredDate = new Date(result.expiredAt).toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour12: false
        });

        await sock.sendMessage(from, {
          text: `╔════ *PAYMENT SUCCESS* ═════╗
║
║ Masa aktif : ${days} hari
║ Exp date   : ${expiredDate}
║
║ Gunakan perintah !menu untuk melihat fitur tersedia.
║
╚══════ *RKDO BOT V1* ═════╝`
        }, { quoted: msg });
      } else if (status === 'timeout') {
        await sock.sendMessage(from, {
          text: 'Waktu pembayaran sudah habis, pesanan dibatalkan secara otomatis!\n\nUlangi !extend untuk pembayaran ulang.'
        }, { quoted: msg });
      } else {
        await sock.sendMessage(from, {
          text: 'Waktu pembayaran sudah habis, pesanan dibatalkan secara otomatis!\n\nUlangi !extend untuk pembayaran ulang.'
        }, { quoted: msg });
      }
    } catch (err) {
      await sock.sendMessage(from, {
        text: 'Waktu pembayaran sudah habis, pesanan dibatalkan secara otomatis!\n\nUlangi !extend untuk pembayaran ulang.'
      }, { quoted: msg });
    } finally {
      unlockProcessing(phone);
      await session.close();
    }
  }
};