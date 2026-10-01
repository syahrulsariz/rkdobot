// puppeteer/gas-dailycek.js
import { google } from 'googleapis';
import credentials from '../config/credentials.js';
import { CABANG, BULAN_AKTIF } from '../config/sheets.config.js';

// Mapping pembayaran baru
const paymentColumns = {
  G: 'CASH',

  H: 'QRIS',

  I: 'TF BCA',
  J: 'TF MANDIRI',
  K: 'TF BRI',

  L: 'DEBIT BCA',
  M: 'SWITCHING BCA',
  N: 'CC BCA',
  O: 'QR BCA',

  P: 'DEBIT MANDIRI',
  Q: 'SWITCHING MANDIRI',
  R: 'CC MANDIRI',
  S: 'QR MANDIRI',

  T: 'DEBIT BRI',
  U: 'SWITCHING BRI',
  V: 'CC BRI',
  W: 'CC SWITCHING BRI',
  X: 'QR BRI',

  Y: 'BLIBLI',
  Z: 'DANA',
  AA: 'INDODANA',

  AB: 'OTHER',
  AC: 'OTHER',
  AD: 'OTHER'
};

// Konversi kolom Google Sheets → index array
function columnToIndex(column, startColumn = 'C') {
  const columnNumber = columnToNumber(column);
  const startNumber = columnToNumber(startColumn);

  return columnNumber - startNumber;
}

function columnToNumber(column) {
  let result = 0;

  for (const char of column) {
    result =
      result * 26 +
      (char.charCodeAt(0) - 64);
  }

  return result;
}

// Format nominal
function formatNominal(value) {
  const harga =
    parseFloat(
      value
        .toString()
        .replace(/[^0-9]/g, '')
    ) || 0;

  return harga.toLocaleString('id-ID');
}

async function dailyCek(cabang, nomorSheet) {
  const cabangKey = cabang.toLowerCase();

  // =========================
  // VALIDASI CABANG
  // =========================

  if (!CABANG[cabangKey]) {
    throw new Error(
      `❌ Cabang "${cabang}" tidak ditemukan! Pilih: ${Object.keys(CABANG).join(', ')}`
    );
  }

  // =========================
  // VALIDASI NOMOR SHEET
  // =========================

  const sheetNum = parseInt(nomorSheet);

  if (
    isNaN(sheetNum) ||
    sheetNum < 1 ||
    sheetNum > 31
  ) {
    throw new Error(
      '❌ Nomor sheet harus antara 1-31!'
    );
  }

  // =========================
  // SPREADSHEET ID
  // =========================

  const spreadsheetId =
    CABANG[cabangKey]
      .sheets?.[BULAN_AKTIF]
      ?.daily;

  if (!spreadsheetId) {
    throw new Error(
      `❌ Sheet daily untuk cabang ${cabang.toUpperCase()} bulan ${BULAN_AKTIF} belum dikonfigurasi!`
    );
  }

  // =========================
  // GOOGLE AUTH
  // =========================

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly'
    ],
  });

  const client = await auth.getClient();

  const sheets = google.sheets({
    version: 'v4',
    auth: client,
  });

  try {
    // ==================================================
    // LAYOUT BARU
    //
    // C  = Kode Transaksi
    // D  = Kids
    // E  = Nama Member
    // F  = Tipe Transaksi
    //
    // G:AD = Pembayaran
    // AE   = ADMIN
    // AF   = SOLD BY
    // AG   = NAMA CS
    //
    // Data hanya sampai row 50
    // ==================================================

    const res =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetNum}!C4:AG50`,
      });

    const rows =
      res.data.values || [];

    if (rows.length === 0) {
      return '📭 Tidak ada data di sheet ini.';
    }

    let hasil = [];

    // =========================
    // LOOP TRANSAKSI
    // =========================

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      /*
       * Karena range dimulai dari C:
       *
       * C  = row[0]  → Kode transaksi
       * D  = row[1]  → Kids
       * E  = row[2]  → Nama Member
       * F  = row[3]  → Tipe Transaksi
       *
       * G  = row[4]  → CASH
       * H  = row[5]  → QRIS
       * I  = row[6]  → TF BCA
       * J  = row[7]  → TF MANDIRI
       * K  = row[8]  → TF BRI
       *
       * ...
       *
       * AD = row[27] → OTHER
       * AE = row[28] → ADMIN
       * AF = row[29] → SOLD BY
       * AG = row[30] → NAMA CS
       */

      // =========================
      // KODE TRANSAKSI
      // =========================

      const kodeTransaksi =
        row[0]?.toString().trim();

      if (!kodeTransaksi) {
        continue;
      }

      // =========================
      // NAMA MEMBER
      // =========================

      const nama =
        row[2]?.toString().trim() || '-';

      // =========================
      // TIPE TRANSAKSI
      // =========================

      const tipe =
        row[3]?.toString().trim() || '-';

      // =========================
      // PEMBAYARAN
      // =========================

      let jenisPembayaran = [];

      for (
        const [col, label]
        of Object.entries(paymentColumns)
      ) {
        const index =
          columnToIndex(col, 'C');

        const val =
          row[index]
            ?.toString()
            .trim();

        if (!val) {
          continue;
        }

        const harga =
          parseFloat(
            val.replace(/[^0-9]/g, '')
          ) || 0;

        if (harga <= 0) {
          continue;
        }

        const formatted =
          harga.toLocaleString('id-ID');

        jenisPembayaran.push(
          `${formatted} ${label}`
        );
      }

      const pembayaran =
        jenisPembayaran.length > 0
          ? jenisPembayaran.join(', ')
          : '-';

      // =========================
      // ADMIN
      // =========================

      const admin =
        row[28]?.toString().trim() || '-';

      // =========================
      // SOLD BY
      // =========================

      const soldBy =
        row[29]?.toString().trim() || '-';

      // =========================
      // NAMA CS
      // =========================

      const namaCS =
        row[30]?.toString().trim() || '-';

      // =========================
      // OUTPUT
      // =========================

      hasil.push(
        `${nama} - ${tipe} - ${pembayaran} - ${soldBy} - ${namaCS}`
      );
    }

    // =========================
    // TIDAK ADA DATA
    // =========================

    if (hasil.length === 0) {
      return '📭 Tidak ada data member yang terisi.';
    }

    // =========================
    // NAMA CABANG
    // =========================

    const namaCabang =
      CABANG[cabangKey].nama;

    // =========================
    // FINAL OUTPUT
    // =========================

    return (
      `📊 *Data Sheet ${sheetNum} - ${namaCabang}*\n\n` +
      hasil.join('\n')
    );

  } catch (err) {
    console.error(
      `[ERROR dailycek] ${cabang} sheet ${nomorSheet}:`,
      err.message
    );

    throw new Error(
      `Gagal mengambil data: ${err.message}`
    );
  }
}

export { dailyCek };