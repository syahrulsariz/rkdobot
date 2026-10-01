import fs from 'fs';
import path from 'path';

const FILE_PATH = path.resolve('./data/autoDeleteGroups.json');

function loadGroups() {
  try {
    if (!fs.existsSync(FILE_PATH)) return [];
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[AUTODELETE] Gagal load data:', err.message);
    return [];
  }
}

function saveGroups(groups) {
  try {
    fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify(groups, null, 2));
  } catch (err) {
    console.error('[AUTODELETE] Gagal simpan data:', err.message);
  }
}

export function isAutoDeleteActive(groupJid) {
  return loadGroups().includes(groupJid);
}

export function enableAutoDelete(groupJid) {
  const groups = loadGroups();
  if (!groups.includes(groupJid)) {
    groups.push(groupJid);
    saveGroups(groups);
  }
}

export function disableAutoDelete(groupJid) {
  saveGroups(loadGroups().filter(g => g !== groupJid));
}