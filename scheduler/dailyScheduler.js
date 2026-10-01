import cabangGroups from '../config/cabang-groups.js';

const TZ = 'Asia/Jakarta';

async function sendWithTagAll(sock, groupId, text) {
  const metadata = await sock.groupMetadata(groupId);
  const participants = metadata.participants.map(p => p.id || p.jid).filter(Boolean);
  if (!participants.length) return;
  const mentionText = participants.map(jid => `@${jid.split('@')[0]}`).join(' ');
  await sock.sendMessage(groupId, { text: `${text}\n\n${mentionText}`, mentions: participants });
}

export function morningScheduler(sock) {
  // Scheduler otomatis pagi dinonaktifkan karena node-cron sudah dihapus.
  console.log('🌞 Morning scheduler tidak aktif.');
}

export function nightScheduler(sock) {
  // Scheduler otomatis malam dinonaktifkan karena node-cron sudah dihapus.
  console.log('🌙 Night scheduler tidak aktif.');
}
