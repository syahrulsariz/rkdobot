import { handleApvCommand } from '../puppeteer/gas-approve.js';
import cabangMap from '../utils/cabang-map.js';
import fs from 'fs';

const validBranches = Object.keys(cabangMap);

export default {
  command: 'approve',
  
  async execute(sock, msg, queue) {
    const text = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || '';
    
    const parts = text.trim().split(' ');
    if (parts.length < 4) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: 'Format salah, contoh:\n' +
              '• approve pml mem 00123\n' +
              '• approve pml memkids 00456\n' +
              '• approve pml pt 00789\n' +
              '• approve pml ptkids 00999\n' +
              '• approve pml mem all'
      }, { quoted: msg });
    }
    
    const cabang = parts[1].toLowerCase();
    const jenis = parts[2].toLowerCase();
    const noMember = parts.slice(3).join(' ');
    
    if (!cabangMap[cabang]) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Kode cabang tidak valid!\n\n*Kode cabang:* ${validBranches.join(', ')}`
      }, { quoted: msg });
    }
    
    if (!['mem', 'memkids', 'pt', 'ptkids'].includes(jenis)) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Jenis harus: mem / memkids / pt / ptkids'
      }, { quoted: msg });
    }
    
    const isApproveAll = noMember.toLowerCase() === 'all';
    
    if (isApproveAll) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '🔄 Starting approval ALL members... ini bisa lama ya, tunggu aja...'
      }, { quoted: msg });
    } else {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '⏳ Memproses approval, tunggu sebentar...'
      }, { quoted: msg });
    }
    
    queue.add(async () => {
      try {
        const hasil = await handleApvCommand(cabang, jenis, noMember, sock);
        
        // Handle hasil untuk approve all (string summary)
        if (isApproveAll && typeof hasil === 'string') {
          // Split message jika terlalu panjang (WhatsApp limit ~4096 chars)
          if (hasil.length > 4000) {
            const parts = hasil.match(/[\s\S]{1,4000}(?:\n|$)/g) || [hasil];
            for (const part of parts) {
              await sock.sendMessage(msg.key.remoteJid, {
                text: part.trim()
              }, { quoted: msg });
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } else {
            await sock.sendMessage(msg.key.remoteJid, {
              text: hasil
            }, { quoted: msg });
          }
          return;
        }
        
        // Handle hasil untuk single member
        if (typeof hasil === 'string') {
          // Single member yang gagal/error
          await sock.sendMessage(msg.key.remoteJid, {
            text: hasil
          }, { quoted: msg });
        } else {
          // Single member yang berhasil dengan bukti bayar
          const {
            cabangName,
            nama,
            paket,
            metode,
            harga,
            buktiBayarPath
          } = hasil;
          
          const notif = `✅ Approval dari cabang *${cabangName}*\n` +
                       `👤 *${nama}*\n` +
                       `📦 *Paket:* ${paket}\n` +
                       `💳 *Metode:* ${metode}\n` +
                       `💰 *Harga:* ${harga}`;
          
          // Send bukti bayar to owner
          try {
            const ownerId = process.env.OWNER_CHAT_ID; // 6285161706431@s.whatsapp.net
            
            // Kirim notif text
            await sock.sendMessage(ownerId, { text: notif });
            
            // Kirim gambar bukti bayar
            const imageBuffer = fs.readFileSync(buktiBayarPath);
            await sock.sendMessage(ownerId, {
              image: imageBuffer,
              caption: `Bukti Bayar - ${nama}`
            });
          } catch (mediaErr) {
            console.error('❌ Error sending media to owner:', mediaErr.message);
          }
          
          // Clean up file
          try {
            fs.unlinkSync(buktiBayarPath);
          } catch (e) {
            console.error('❌ Gagal hapus file bukti bayar:', e.message);
          }
          
          await sock.sendMessage(msg.key.remoteJid, {
            text: '✅ Done! Bukti bayar dan agreement sudah terverifikasi.'
          }, { quoted: msg });
        }
        
      } catch (err) {
        console.error('❌ Error handle approve:', err.message);
        await sock.sendMessage(msg.key.remoteJid, {
          text: '❌ Ulangi sekali lagi'
        }, { quoted: msg });
      }
    });
  }
};