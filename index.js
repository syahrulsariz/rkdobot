import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import queue from './utils/queue.js';
import { recordSender, getPhoneByLid } from './utils/lidMap.js';
import { potongSaldo, refundSaldo, getSaldo, normalizeSaldoPhone, formatRupiah } from './utils/saldo.js';
import { getCommandPrice, FREE_COMMANDS, ADMIN_COMMANDS } from './config/hargaCommand.js';
import {
  banUser,
  unbanUser,
  isBanned,
  getBannedListDisplay
} from './utils/banMap.js';

// 🔇 MATIKAN SEMUA LOG BAILEYS
process.env.DEBUG = '';
process.env.LOG_LEVEL = 'silent';

// Import commands
import akunCommand from './commands/akun.js';
import sinkronCommand from './commands/sinkron.js';
import dailycekCommand from './commands/dailycek.js';
import isimtdCommand from './commands/isimtd.js';
import logoutCommand from './commands/logout.js';
import brcdCommand from './commands/brcd.js';
import hapusfingerCommand from './commands/hapusfinger.js';
import cuttingCommand from './commands/cutting.js';
import settingakunCommand from './commands/settingakun.js';
import keuanganCommand, { handlePendingKeuangan } from './commands/keuangan.js';
import reqmemkidsCommand from './commands/reqmemkids.js';
import reqmemCommand from './commands/reqmem.js';
import reqptCommand from './commands/reqpt.js';
import reqkelaskidsCommand from './commands/reqkelaskids.js';
import HandleReqKelas from './commands/reqkelas.js';
import kirimperingkatCommand from './commands/kirimperingkat.js';
import reqinsCommand from './commands/reqins.js';
import handleReqHapusMemKids from './commands/hapusmemkids.js';
import handleReqHapusMem from './commands/hapusmem.js';
import handleReqHapusPt from './commands/hapuspt.js';
import handleApvCommand from './commands/approve.js';
import uptimeCommand from './commands/uptime.js';
import buatpaketCommand from './commands/buatpaket.js';

import handleReset from './commands/reset.js';
import closingReport from './commands/rincianreport.js';
import salesreport from './commands/salesreport.js';
import ptreport from './commands/ptreport.js';
import kidsreport from './commands/kidsreport.js';
import peringkatReport from './commands/peringkatreport.js';
import akumulasiReport from './commands/akumulasireport.js';
import allreport from './commands/allreport.js';
import databaseReport from './commands/databasereport.js';
import salesToday from './commands/salestoday.js';
import salesUpdate from './commands/updatesales.js';
import handleReqHapusInstruktur from './commands/hapusinstruktur.js';
import handleReqHapusKelas from './commands/hapuskelas.js';
import blastCommand from './commands/blast.js';
import autodeleteCommand from './commands/autodelete.js';
import { isAutoDeleteActive } from './utils/autoDeleteGroups.js';
import tesCommand from './commands/tes.js';
import menuCommand from './commands/menu.js';
import saldoCommand from './commands/saldo.js';
import topupCommand from './commands/topup.js';
import kodecabang from './commands/kodecabang.js';
import handleVoidCommand from './commands/void.js';
import handleAktifSesiCommand from './commands/aktifsesi.js';
import adminSaldoCommand from './commands/adminSaldo.js';

// ═══════════════════════════════════════════════════════════════════
// 🛡️ FILTER LOG BAILEYS
// ═══════════════════════════════════════════════════════════════════

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const BAILEYS_FILTERS = [
  'Closing session:',
  'SessionEntry',
  '_chains',
  'registrationId',
  'ephemeralKeyPair',
  'chainKey',
  'messageKeys',
  'currentRatchet',
  'baseKey',
  'remoteIdentityKey',
  'rootKey',
  'Buffer',
  'chainType',
  'indexInfo'
];

function shouldFilterLog(message) {
  const msgStr = String(message);
  return BAILEYS_FILTERS.some(filter => msgStr.includes(filter));
}

console.log = function(...args) {
  if (!args.some(arg => shouldFilterLog(arg))) {
    originalConsoleLog.apply(console, args);
  }
};

console.error = function(...args) {
  if (!args.some(arg => shouldFilterLog(arg))) {
    originalConsoleError.apply(console, args);
  }
};

console.warn = function(...args) {
  if (!args.some(arg => shouldFilterLog(arg))) {
    originalConsoleWarn.apply(console, args);
  }
};

// ═══════════════════════════════════════════════════════════════════
// 🔧 CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const ADMIN_LIST = [
  '6285161706431',
  '174856960241884',
  '089677289925',
  '191289471578158',
];

const ADMIN_NUMBER = '6285161706431@s.whatsapp.net';

let BOT_ONLINE = true;

const commands = [
  akunCommand, sinkronCommand, dailycekCommand,
  isimtdCommand, logoutCommand, brcdCommand, hapusfingerCommand,
  cuttingCommand, settingakunCommand, keuanganCommand, reqmemkidsCommand, reqmemCommand,
  reqptCommand, reqkelaskidsCommand, HandleReqKelas, kirimperingkatCommand,
  reqinsCommand, handleReqHapusMemKids, handleReqHapusMem, handleReqHapusPt,
  handleApvCommand, uptimeCommand, buatpaketCommand, handleReset,
  closingReport, salesreport, ptreport, kidsreport,
  peringkatReport, akumulasiReport, allreport, databaseReport, salesToday, salesUpdate, handleReqHapusKelas, handleReqHapusInstruktur, blastCommand,
  autodeleteCommand, tesCommand, menuCommand, saldoCommand, topupCommand, kodecabang,
  handleVoidCommand, handleAktifSesiCommand, adminSaldoCommand
];

// ═══════════════════════════════════════════════════════════════════
// 🛠️ UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function normalizePhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  
  return cleaned;
}

function isAdmin(sender) {
  const senderRaw = sender.split('@')[0];
  const senderNormalized = normalizePhoneNumber(senderRaw);
  
  return ADMIN_LIST.some(adminNum => {
    const adminNormalized = normalizePhoneNumber(adminNum);
    return adminNormalized === senderNormalized;
  });
}

function getMessageText(msg) {
  return msg.message?.conversation || 
         msg.message?.extendedTextMessage?.text || 
         msg.message?.imageMessage?.caption ||
         msg.message?.videoMessage?.caption ||
         '';
}

function formatTimestamp() {
  return new Date().toLocaleString('id-ID', { 
    timeZone: 'Asia/Jakarta',
    hour12: false 
  });
}

function getLogPrefix(isGroup, commandName) {
  const timestamp = new Date().toLocaleTimeString('id-ID', { 
    hour12: false,
    timeZone: 'Asia/Jakarta'
  });
  const icon = isGroup ? '👥' : '👤';
  return `[${timestamp}] ${icon} ${commandName}`;
}

// ✅ NEW: Helper untuk check apakah text adalah command
// ⚠️ WAJIB pakai prefix "!" — tanpa prefix tidak dianggap command
function isCommand(text) {
  const lowerText = text.toLowerCase().trim();

  // Semua command WAJIB diawali "!"
  if (!lowerText.startsWith('!')) return false;

  for (const cmd of commands) {
    const cmdList = Array.isArray(cmd.command) ? cmd.command : [cmd.command];

    for (const c of cmdList) {
      const cmdLower = c.toLowerCase();
      const cmdWithPrefix = cmdLower.startsWith('!') ? cmdLower : '!' + cmdLower;

      if (lowerText.startsWith(cmdWithPrefix)) {
        return true;
      }
    }
  }

  // Check admin commands (wajib prefix !)
  const adminCommands = ['!botoff', '!boton', '!listadmin',
  '!myid', '!ban', '!unban', '!listban'];
  return adminCommands.some(cmd => lowerText.startsWith(cmd));
}

// ═══════════════════════════════════════════════════════════════════
// 🤖 BOT CONNECTION
// ═══════════════════════════════════════════════════════════════════

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    version,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  // ───────────────────────────────────────────────────────────────
  // 📡 Connection Handler
  // ───────────────────────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      originalConsoleLog('\n╔════════════════════════════════════════╗');
      originalConsoleLog('║     📱 SCAN QR CODE DI BAWAH INI      ║');
      originalConsoleLog('╚════════════════════════════════════════╝\n');
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      
      originalConsoleLog('\n❌ Koneksi terputus');
      if (lastDisconnect?.error?.message) {
        originalConsoleLog('📋 Alasan:', lastDisconnect.error.message);
      }
      
      if (shouldReconnect) {
        originalConsoleLog('🔄 Reconnecting dalam 3 detik...\n');
        setTimeout(() => connectToWhatsApp(), 3000);
      } else {
        originalConsoleLog('🔒 Logged out. Hapus folder "auth_info_baileys" untuk login ulang\n');
      }
    } else if (connection === 'open') {
      originalConsoleLog('\n╔════════════════════════════════════════╗');
      originalConsoleLog('║     ✅ BOT SUCCESSFULLY CONNECTED!    ║');
      originalConsoleLog('╚════════════════════════════════════════╝');
      originalConsoleLog(`📅 ${formatTimestamp()}`);
      originalConsoleLog(`📦 Commands loaded: ${commands.length}`);
      originalConsoleLog(`👮 Admin count: ${ADMIN_LIST.length}`);
      originalConsoleLog(`🟢 Status: ONLINE`);
      originalConsoleLog('─'.repeat(50));
      originalConsoleLog('🎯 Menunggu command...\n');

      originalConsoleLog('💳 Sistem saldo aktif — masa aktif & shift dinonaktifkan\n');

      // Send notification to admin
      try {
        await sock.sendMessage(ADMIN_NUMBER, { 
          text: `✅ *Bot Aktif!*\n\n` +
                `📅 ${formatTimestamp()}\n` +
                `📦 Commands: ${commands.length}\n` +
                `👮 Admins: ${ADMIN_LIST.length}\n` +
                `🟢 Status: ONLINE`+
                `\n\nID REMOTE\n`+
                `USER : 86863411\n`+
                `PASS : User*******`
        });
      } catch (error) {
        originalConsoleError('❌ Gagal kirim notifikasi ke admin:', error.message);
      }
    }
  });

  // ───────────────────────────────────────────────────────────────
  // 💬 Message Handler
  // ───────────────────────────────────────────────────────────────
sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0];

      // Filter basic
      if (!msg.message || msg.key.fromMe) return;
      if (msg.key.remoteJid === 'status@broadcast') return;

      const from = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;

      // ═══════════════════════════════════════════════════
      // 🗑️ AUTO-DELETE GAMBAR/STIKER (skip kalau admin grup)
      // ═══════════════════════════════════════════════════
      const isGroupMsg = from.endsWith('@g.us');
      const isImageOrSticker = !!(msg.message?.imageMessage || msg.message?.stickerMessage);

      if (isGroupMsg && isImageOrSticker && isAutoDeleteActive(from)) {
        try {
          const groupMeta = await sock.groupMetadata(from);
          const participant = groupMeta.participants.find(p => p.id === sender);
          const senderIsGroupAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';

          if (senderIsGroupAdmin) {
            originalConsoleLog(`   ⏭️ Skip auto-delete: ${msg.pushName || 'Unknown'} adalah admin grup ${from.split('@')[0]}`);
          } else {
            await sock.sendMessage(from, { delete: msg.key });
await sock.sendMessage(from, { text: 'terdeteksi spam, dihapus otomatis' });
            originalConsoleLog(`   🗑️ Auto-delete: ${msg.pushName || 'Unknown'} kirim ${msg.message?.stickerMessage ? 'stiker' : 'gambar'} di grup ${from.split('@')[0]}`);
          }
        } catch (err) {
          originalConsoleError('   ❌ Gagal auto-delete:', err.message);
        }
        return;
      }

      const text = getMessageText(msg);

      if (!text) return;
      const senderPhone = msg.key.remoteJidAlt || null;
      const lidRaw = sender.endsWith('@lid') ? sender.split('@')[0] : null;
      const phoneRaw = senderPhone ? senderPhone.split('@')[0] : null;

      // ... lanjut kode setelahnya sama kayak sebelumnya

// Auto mapping LID <-> HP
if (lidRaw && phoneRaw) {
  recordSender(sender, senderPhone);
}

if (isCommand(text)) {
  originalConsoleLog(`\n📨 Pesan masuk dari ${msg.pushName || 'Unknown'}`);
  if (phoneRaw) originalConsoleLog(`   📱 HP: ${phoneRaw}`);
  if (lidRaw)   originalConsoleLog(`   🔑 LID: ${lidRaw}`);
                originalConsoleLog(`   📩 JID raw: ${sender}`);
}

      // ─── Multi-step keuangan (pilih kategori / sumber) ───
      // Harus dicek SEBELUM filter isCommand, karena reply "A"/"B" bukan command
      if (isAdmin(sender)) {
        try {
          const handledPending = await handlePendingKeuangan(sock, msg, queue, ADMIN_LIST);
          if (handledPending) return;
        } catch (e) {
          originalConsoleError('   ❌ Error pending keuangan:', e.message);
        }
      }
      
      // ✅ PERBAIKAN: Skip HANYA jika bukan command sama sekali (wajib prefix !)
      if (!isCommand(text)) return;
      
      const senderName = msg.pushName || 'Unknown';
      const senderNumber = sender.split('@')[0];
      const isGroup = from.endsWith('@g.us');
      const groupId = isGroup ? from.split('@')[0] : null;
      
      // Text sudah dipastikan diawali "!" oleh isCommand()
      const normalizedText = text;

      // ═══════════════════════════════════════════════════════════
      // 🚫 BAN CHECK (skip untuk admin, biar admin tetap bisa buka !unban)
      // ═══════════════════════════════════════════════════════════
      if (!isAdmin(sender) && isBanned(sender)) {
        originalConsoleLog(`   🚫 Banned: ${senderName} (${sender})`);
        await sock.sendMessage(from, {
          text: `🚫 *Akses Dibatasi*\n\n` +
                `Akun Anda dalam tahap *banned otomatis*, terdeteksi penggunaan multiuser.\n\n` +
                `📵 Semua command untuk sementara tidak bisa digunakan.\n` +
                `📞 Silakan hubungi admin bot untuk membuka ban.`
        }, { quoted: msg });
        return;
      }

      // ═══════════════════════════════════════════════════════════
      // 🔐 ADMIN COMMANDS
      // ═══════════════════════════════════════════════════════════
      
      // List Admin (Public)

      // ─── !myid ────────────────────────────────────────────────────
if (normalizedText.toLowerCase() === '!myid') {
  const phone = phoneRaw || getPhoneByLid(sender.split('@')[0]);
  await sock.sendMessage(from, {
    text: `🆔 *Info ID kamu*\n\n` +
          `📩 JID: \`${sender}\`\n` +
          `📱 HP: ${phone ? '+' + phone : '❌ Belum terdeteksi'}\n` +
          `🔑 LID: ${lidRaw || '-'}\n\n` +
          `_Kirimkan info ini ke admin untuk didaftarkan._`
  }, { quoted: msg });
  return;
}

// ─── !ban ───────────────────────────────────────────────────────
if (normalizedText.toLowerCase().startsWith('!ban ')) {
  if (!isAdmin(sender)) {
    await sock.sendMessage(from, { text: '❌ Hanya admin yang bisa mem-ban user.' }, { quoted: msg });
    return;
  }
  const parts = normalizedText.split(' ');
  const targetPhone = parts[1]?.trim();
  const reasonArg = parts.slice(2).join(' ').trim();

  if (!targetPhone || !/^\d+$/.test(targetPhone.replace(/\+/g, ''))) {
    await sock.sendMessage(from, {
      text: `❌ Format salah!\n\nContoh:\n\`!ban 0851xxxxxxxx\`\n\`!ban 0851xxxxxxxx alasan custom\``
    }, { quoted: msg });
    return;
  }

  const result = banUser(targetPhone, reasonArg);

  if (result.success) {
    await sock.sendMessage(from, {
      text: `🚫 *User berhasil dibanned!*\n\n` +
            `📱 No HP: +${result.phone}\n` +
            `📝 Alasan: ${result.reason}\n\n` +
            `_User akan otomatis ditolak setiap kirim command sampai dibuka lewat_ \`!unban ${result.phone}\`.`
    }, { quoted: msg });
    originalConsoleLog(`   🚫 BAN: ${result.phone} | Alasan: ${result.reason}`);
  } else {
    await sock.sendMessage(from, { text: `⚠️ User +${normalizePhone(targetPhone)} sudah dalam status banned.` }, { quoted: msg });
  }
  return;
}

// ─── !unban ─────────────────────────────────────────────────────
if (normalizedText.toLowerCase().startsWith('!unban ')) {
  if (!isAdmin(sender)) {
    await sock.sendMessage(from, { text: '❌ Hanya admin yang bisa membuka ban user.' }, { quoted: msg });
    return;
  }
  const targetPhone = normalizedText.split(' ')[1]?.trim();
  if (!targetPhone) {
    await sock.sendMessage(from, { text: '❌ Format salah!\n\nContoh: `!unban 0851xxxxxxxx`' }, { quoted: msg });
    return;
  }

  const result = unbanUser(targetPhone);

  if (result.success) {
    await sock.sendMessage(from, {
      text: `✅ *Ban dibuka!*\n\n📱 No HP: +${result.phone}\nUser sudah bisa menggunakan bot lagi seperti biasa.`
    }, { quoted: msg });
    originalConsoleLog(`   ✅ UNBAN: ${result.phone}`);
  } else {
    await sock.sendMessage(from, { text: `⚠️ User +${normalizePhone(targetPhone)} tidak sedang dalam status banned.` }, { quoted: msg });
  }
  return;
}

// ─── !listban ───────────────────────────────────────────────────
if (normalizedText.toLowerCase() === '!listban') {
  if (!isAdmin(sender)) {
    await sock.sendMessage(from, { text: '❌ Hanya admin yang bisa melihat daftar banned.' }, { quoted: msg });
    return;
  }
  const list = getBannedListDisplay();
  await sock.sendMessage(from, {
    text: list.length > 0
      ? `🚫 *Daftar User Banned (${list.length})*\n\n${list.join('\n\n')}`
      : `📋 *Tidak ada user yang sedang dibanned saat ini.*`
  }, { quoted: msg });
  return;
}

      if (normalizedText.toLowerCase() === '!listadmin') {
        const prefix = getLogPrefix(isGroup, 'LISTADMIN');
        originalConsoleLog(`${prefix} | User: ${senderName} (${senderNumber})${isGroup ? ` | Group: ${groupId}` : ''}`);
        
        const adminList = ADMIN_LIST.map((num, idx) => `${idx + 1}. ${num}`).join('\n');
        
        await sock.sendMessage(from, {
          text: `👮 *Daftar Admin Bot*\n\n${adminList}\n\n` +
                `Total: ${ADMIN_LIST.length} admin`
        }, { quoted: msg });
        return;
      }
      
      // Bot OFF (Admin Only)
      if (normalizedText.toLowerCase() === '!botoff') {
        const prefix = getLogPrefix(isGroup, 'botOFF');
        originalConsoleLog(`${prefix} | User: ${senderName} (${senderNumber})${isGroup ? ` | Group: ${groupId}` : ''}`);
        
        if (!isAdmin(sender)) {
          await sock.sendMessage(from, {
            text: '❌ *Akses Ditolak!*\n\nHanya admin yang bisa mematikan bot.'
          }, { quoted: msg });
          originalConsoleLog(`   ⚠️  Access denied - not admin`);
          return;
        }
        
        BOT_ONLINE = false;
        originalConsoleLog(`   ✅ Bot set to OFFLINE by admin`);
        
        await sock.sendMessage(from, {
          text: `🔴 *Bot OFFLINE*\n\n` +
                `Bot tidak akan merespon command.\n` +
                `Gunakan *!boton* untuk mengaktifkan.\n\n` +
                `🕐 ${formatTimestamp()}`
        }, { quoted: msg });
        return;
      }
      
      // Bot ON (Admin Only)
      if (normalizedText.toLowerCase() === '!boton') {
        const prefix = getLogPrefix(isGroup, 'botON');
        originalConsoleLog(`${prefix} | User: ${senderName} (${senderNumber})${isGroup ? ` | Group: ${groupId}` : ''}`);
        
        if (!isAdmin(sender)) {
          await sock.sendMessage(from, {
            text: '❌ *Akses Ditolak!*\n\nHanya admin yang bisa mengaktifkan bot.'
          }, { quoted: msg });
          originalConsoleLog(`   ⚠️  Access denied - not admin`);
          return;
        }
        
        BOT_ONLINE = true;
        originalConsoleLog(`   ✅ Bot set to ONLINE by admin`);
        
        await sock.sendMessage(from, {
          text: `🟢 *Bot ONLINE*\n\n` +
                `Bot sudah aktif dan siap menerima command.\n\n` +
                `🕐 ${formatTimestamp()}`
        }, { quoted: msg });
        return;
      }
      
      // ═══════════════════════════════════════════════════════════
      // 🛑 CHECK BOT STATUS
      // ═══════════════════════════════════════════════════════════
      
      if (!BOT_ONLINE) {
        return;
      }

      // ═══════════════════════════════════════════════════════════════
// 🔒 WHITELIST CHECK
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// 🔒 WHITELIST CHECK
// ═══════════════════════════════════════════════════════════════════
const isAddGrupCmd = normalizedText.toLowerCase().startsWith('!addgrup');
const isTesCmd = normalizedText.toLowerCase() === '!tes';
const isExtendCmd = normalizedText.toLowerCase().startsWith('!extend');
const isCekAktifCmd = normalizedText.toLowerCase().startsWith('!cekaktif');
const isShiftCmd = normalizedText.toLowerCase() === '!pagi' ||
                    normalizedText.toLowerCase() === '!siang';

if (!isAddGrupCmd && !isTesCmd && !isAdmin(sender) && !isWhitelisted(sender)) {
  originalConsoleLog(`   🚫 Blocked: ${msg.pushName || 'Unknown'} (${sender})`);
  return;
}

// ═══════════════════════════════════════════════════════════════════
// ⏳ MASA AKTIF CHECK
// ═══════════════════════════════════════════════════════════════════
if (!isAddGrupCmd && !isTesCmd && !isExtendCmd && !isCekAktifCmd && !isAdmin(sender) && isExpired(sender)) {
  originalConsoleLog(`   ⏳ Expired: ${msg.pushName || 'Unknown'} (${sender})`);
  await sock.sendMessage(from, {
    text: `⏳ *Masa Aktif Habis*\n\nNomor kamu sudah tidak memiliki masa aktif.\nSilakan gunakan perintah !extend untuk memperpanjang masa aktif.`
  }, { quoted: msg });
  return;
}

// ═══════════════════════════════════════════════════════════════════
// 🕐 SHIFT CHECK (!pagi / !siang) - per user, reset tiap hari
// ═══════════════════════════════════════════════════════════════════
if (!isAddGrupCmd && !isTesCmd && !isShiftCmd && !isExtendCmd && !isCekAktifCmd && !isAdmin(sender)) {
  const shiftStatus = checkShiftAccess(sender);

  if (shiftStatus.status === 'not_set') {
    originalConsoleLog(`   🕐 Shift belum dipilih: ${msg.pushName || 'Unknown'} (${sender})`);
    await sock.sendMessage(from, {
      text: `⚠️ *Pilih Jadwal Dulu*\n\nKetik *!pagi* atau *!siang* dulu sebelum pakai bot hari ini.\n\n🌅 !pagi → 06.00 - 16.00\n☀️ !siang → 13.00 - 22.30`
    }, { quoted: msg });
    return;
  }

  if (shiftStatus.status === 'outside_window') {
    originalConsoleLog(`   🕐 Diluar jam shift (${shiftStatus.shift}): ${msg.pushName || 'Unknown'} (${sender})`);
    await sock.sendMessage(from, {
      text: `🚫 *Diluar Jam Aktif*\n\nMohon maaf, bot hanya di setting untuk penggunaan *${shiftStatus.shift}* hari ini.`
    }, { quoted: msg });
    return;
  }
}
      
      // ═══════════════════════════════════════════════════════════
      // ⚡ COMMAND EXECUTION
      // ═══════════════════════════════════════════════════════════
      
      let commandFound = false;
      
      for (const cmd of commands) {
        const cmdList = Array.isArray(cmd.command) ? cmd.command : [cmd.command];
        
        const matchedCommand = cmdList.find(c => {
          const cmdLower = c.toLowerCase();
          const textLower = normalizedText.toLowerCase();
          
          // Wajib pakai prefix "!"
          const cmdWithPrefix = cmdLower.startsWith('!') ? cmdLower : '!' + cmdLower;
          
          return textLower.startsWith(cmdWithPrefix);
        });
        
        if (matchedCommand) {
          commandFound = true;
          
          const displayCmd = matchedCommand.startsWith('!') ? matchedCommand : `!${matchedCommand}`;
          const prefix = getLogPrefix(isGroup, displayCmd.toUpperCase());
          originalConsoleLog(`${prefix} | User: ${senderName} (${senderNumber})${isGroup ? ` | Group: ${groupId}` : ''}`);
          
          const commandKey = displayCmd.toLowerCase();
          const isAdminUser = isAdmin(sender);
          const isFree = FREE_COMMANDS.has(commandKey);
          const isAdminCommand = ADMIN_COMMANDS.has(commandKey);
          const price = (!isAdminUser && !isFree && !isAdminCommand) ? getCommandPrice(commandKey) : 0;

          let charged = false;
          let walletPhone = null;

          if (price > 0) {
            walletPhone = phoneRaw
              ? normalizeSaldoPhone(phoneRaw)
              : normalizeSaldoPhone(getPhoneByLid(lidRaw || '') || '');

            if (!walletPhone) {
              await sock.sendMessage(from, {
                text: '❌ Nomor WhatsApp kamu belum bisa dikenali. Coba kirim pesan biasa dulu lalu ulangi command.'
              }, { quoted: msg });
              break;
            }

            const currentSaldo = getSaldo(walletPhone);
            if (currentSaldo < price) {
              await sock.sendMessage(from, {
                text: `💳 *Saldo tidak cukup*\n\nHarga command: *${formatRupiah(price)}*\nSaldo kamu: *${formatRupiah(currentSaldo)}*\nKekurangan: *${formatRupiah(price - currentSaldo)}*\n\nGunakan *!topup 10k* untuk isi saldo.`
              }, { quoted: msg });
              break;
            }

            const deduction = potongSaldo(walletPhone, price);
            if (!deduction.success) {
              await sock.sendMessage(from, {
                text: `❌ Gagal memotong saldo. Saldo kamu: *${formatRupiah(deduction.saldo)}*`
              }, { quoted: msg });
              break;
            }

            charged = true;
            originalConsoleLog(`   💳 Saldo -${formatRupiah(price)} | Sisa ${formatRupiah(deduction.saldo)}`);
          }

          try {
            await cmd.execute(sock, msg, queue, ADMIN_LIST);
            originalConsoleLog(`   ✅ Success`);
          } catch (error) {
            if (charged && walletPhone) {
              refundSaldo(walletPhone, price);
              originalConsoleLog(`   ↩️ Saldo dikembalikan: ${formatRupiah(price)}`);
            }

            originalConsoleLog(`   ❌ Error: ${error.message}`);
            await sock.sendMessage(from, {
              text: `❌ Terjadi kesalahan saat memproses command.\n\nError: ${error.message}${charged ? '\n\n💳 Saldo dikembalikan karena command gagal.' : ''}`
            }, { quoted: msg });
          }
          break;
        }
      }
      
      // Unknown command
      if (!commandFound) {
        const unknownCmd = normalizedText.split(' ')[0];
        const prefix = getLogPrefix(isGroup, 'UNKNOWN');
        originalConsoleLog(`${prefix} | Cmd: ${unknownCmd} | User: ${senderName} (${senderNumber})${isGroup ? ` | Group: ${groupId}` : ''}`);
      }
      
    } catch (error) {
      originalConsoleError('❌ Error handling message:', error.message);
    }
  });

  // Silent mode untuk group events
  sock.ev.on('group-participants.update', async () => {});

  return sock;
}

// ═══════════════════════════════════════════════════════════════════
// 🚀 STARTUP
// ═══════════════════════════════════════════════════════════════════

console.clear();
originalConsoleLog('\n╔════════════════════════════════════════╗');
originalConsoleLog('║       🤖 WHATSAPP BOT STARTING...     ║');
originalConsoleLog('╚════════════════════════════════════════╝\n');

connectToWhatsApp();

// ═══════════════════════════════════════════════════════════════════
// 🛡️ ERROR HANDLERS
// ═══════════════════════════════════════════════════════════════════

process.on('unhandledRejection', (err) => {
  if (!shouldFilterLog(err?.message || '')) {
    originalConsoleError('\n❌ Unhandled Rejection:', err.message);
  }
});

process.on('uncaughtException', (err) => {
  if (!shouldFilterLog(err?.message || '')) {
    originalConsoleError('\n❌ Uncaught Exception:', err.message);
    originalConsoleLog('🔄 Restarting process...\n');
    process.exit(1);
  }
});