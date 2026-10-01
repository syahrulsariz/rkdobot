// config/hargaCommand.js

// Harga default semua command user.
export const DEFAULT_COMMAND_PRICE = 100;

// Harga khusus per command.
// Contoh:
//   '!dailycek': 100,
//   '!reqpt': 500,
//   '!kirimperingkat': 1000,
export const COMMAND_PRICES = {
};

export const FREE_COMMANDS = new Set([
  '!saldo',
  '!topup',
  '!menu',
  '!myid',
]);

// Command yang hanya boleh dijalankan admin.
// Semua command di sini gratis.
export const ADMIN_COMMANDS = new Set([
  '!botoff',
  '!boton',
  '!ban',
  '!unban',
  '!listban',
  '!masuk',
  '!keluar',
  '!tarik',
  '!setor',
  '!ceksaldo',
  '!listsaldo',
  '!ceksaldouser',
  '!addsaldo',
  '!tambahsaldo',
  '!kurangsaldo',
  '!minsaldo',
  '!hapussaldo',
  '!resetsaldo',
]);

export function getCommandPrice(command) {
  const key = String(command || '').toLowerCase();
  if (FREE_COMMANDS.has(key) || ADMIN_COMMANDS.has(key)) return 0;
  return Number(COMMAND_PRICES[key] ?? DEFAULT_COMMAND_PRICE);
}
