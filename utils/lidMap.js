// utils/lidMap.js
import fs from 'fs';

const LID_MAP_PATH = './lid_map.json';

function loadLidMapFull() {
  if (!fs.existsSync(LID_MAP_PATH)) {
    const empty = { phone_to_lid: {}, lid_to_phone: {} };
    fs.writeFileSync(LID_MAP_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }

  try {
    const data = JSON.parse(fs.readFileSync(LID_MAP_PATH, 'utf8'));
    if (!data.phone_to_lid) data.phone_to_lid = {};
    if (!data.lid_to_phone) data.lid_to_phone = {};
    return data;
  } catch {
    const empty = { phone_to_lid: {}, lid_to_phone: {} };
    fs.writeFileSync(LID_MAP_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
}

function saveLidMap(map) {
  fs.writeFileSync(LID_MAP_PATH, JSON.stringify(map, null, 2));
}

export function recordSender(jid, linkedJid = null) {
  const map = loadLidMapFull();
  const raw = jid.split('@')[0];

  if (jid.endsWith('@lid')) {
    if (!map.lid_to_phone[raw]) map.lid_to_phone[raw] = null;

    if (linkedJid && !linkedJid.endsWith('@lid')) {
      const phone = normalizePhone(linkedJid.split('@')[0]);
      map.lid_to_phone[raw] = phone;
      map.phone_to_lid[phone] = raw;
    }
  } else {
    const phone = normalizePhone(raw);
    if (!map.phone_to_lid[phone]) map.phone_to_lid[phone] = null;

    if (linkedJid && linkedJid.endsWith('@lid')) {
      const lid = linkedJid.split('@')[0];
      map.phone_to_lid[phone] = lid;
      map.lid_to_phone[lid] = phone;
    }
  }

  saveLidMap(map);
}

export function getLidByPhone(phone) {
  const map = loadLidMapFull();
  return map.phone_to_lid[normalizePhone(phone)] || null;
}

export function getPhoneByLid(lid) {
  const map = loadLidMapFull();
  return map.lid_to_phone[lid] || null;
}

export function normalizePhone(phone) {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
  else if (cleaned && !cleaned.startsWith('62')) cleaned = '62' + cleaned;
  return cleaned;
}
