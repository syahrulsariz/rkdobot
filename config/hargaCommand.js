// config/hargaCommand.js

// Harga default semua command user. Ubah angka ini kalau mau.
export const DEFAULT_COMMAND_PRICE = 100;

// Harga khusus per command. Contoh: '!reqpt': 500
export const COMMAND_PRICES = {
  // '!dailycek': 100,
  // '!reqpt': 500,
  // '!kirimperingkat': 1000,
};

export const FREE_COMMANDS = new Set([
  '!saldo',
  '!topup',
  '!menu',
  '!myid',
]);

export const ADMIN_COMMANDS = new Set([
  '!botoff', '!boton', '!listadmin', '!add', '!remove', '!listuser',
  '!ban', '!unban', '!listban',
  '!masuk', '!keluar', '!tarik', '!setor', '!ceksaldo',
  '!listsaldo', '!ceksaldouser', '!addsaldo', '!tambahsaldo',
  '!kurangsaldo', '!minsaldo', '!hapussaldo', '!resetsaldo',
]);

export function getCommandPrice(command) {
  const key = String(command || '').toLowerCase();
  if (FREE_COMMANDS.has(key) || ADMIN_COMMANDS.has(key)) return 0;
  return Number(COMMAND_PRICES[key] ?? DEFAULT_COMMAND_PRICE);
}
