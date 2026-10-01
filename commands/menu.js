// commands/menu.js

const MENU_TEXT = `*DAFTAR MENU BOT*

=======================================

*SYSTEM*
- *!approve* - _Perintah approve data member._
- *!cutting* - _Perintah cutting sesi._
- *!hapusfinger* - _Perintah hapus finger member._
- *!reqins* - _Perintah tambah nama instruktur._
- *!reqkelas* - _Perintah tambah nama kelas._
- *!reqkelaskids* - _Perintah tambah nama kelas kids._
- *!reqmem* - _Perintah membuat paket membership._
- *!reqpt* - _Perintah membuat paket Sesi PT._
- *!sesiaktif* - _Perintah aktifkan Sesi PT._
- *!void* - _Perintah void data._

*APLIKASI*
- *!akun* - _Perintah ambil id dan password akun member._
- *!reset* - _Perintah reset password akun member._
- *!sinkron* - _Perintah sinkronisasi akun member._

*REPORT*
- *!allreport* - _Perintah semua report closing._
- *!rincianreport* - _Perintah rincian penjualan report closing._
- *!salesreport* - _Perintah sales report closing._
- *!ptreport* - _Perintah pt by pt report closing._
- *!kidsreport* - _Perintah kids sales report closing._
- *!akumulasireport* - _Perintah akumulasi report closing._
- *!databasereport* - _Perintah database online report closing._
- *!saletoday* - _Perintah report sales today report closing._
- *!peringkatreport* - _Perintah peringkat fc pt report closing._
- *!updatesales* - _Perintah update sales harian._
- *!dailycek* - _Perintah cek isi daily sales._
- *!kodecabang* - _Kode cabang untuk perintah._

=======================================

*RKDO BOT V1*`;

export default {
  command: ['!menu', 'menu', '!help', 'help'],
  execute: async (sock, msg) => {
    const from = msg.key.remoteJid;
    await sock.sendMessage(from, { text: MENU_TEXT }, { quoted: msg });
  }
};