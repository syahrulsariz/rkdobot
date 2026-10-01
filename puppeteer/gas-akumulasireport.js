import { google } from 'googleapis';
import credentials from '../config/credentials.js';
import { getCabangInfo, getSheetId, BULAN_AKTIF } from '../config/sheets.config.js';

const format = n => Number(n || 0).toLocaleString('id-ID');

const num = v => {
  if (!v) return 0;
  return parseFloat(v.toString().replace(/\D/g, '')) || 0;
};

function formatItem(jenis, unit, total) {
  const totalStr = total > 0 ? `Rp. ${format(total)},-` : '-';
  return `${jenis} : ${totalStr} (${unit} UNIT)`;
}

export async function akumulasiReport(cabang, tanggal) {
  const info = getCabangInfo(cabang);
  const sheetId = getSheetId(cabang, 'daily');

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

  // =========================
  // RANGE BARU
  // =========================

  const ranges = [
    `${tanggal}!U83:W100`, // [0] Regular data
    `${tanggal}!AH57`,     // [1] MTD Regular
    `${tanggal}!AH59`,     // [2] Target Regular
    `${tanggal}!AH61`,     // [3] Persen Regular
  ];

  if (info.hasKids) {
    ranges.push(
      `${tanggal}!Y83:AA100`, // [4] Kids data
      `${tanggal}!AH75`,      // [5] MTD Kids
      `${tanggal}!AH77`,      // [6] Target Kids
      `${tanggal}!AH79`       // [7] Persen Kids
    );
  }

  const res =
    await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges,
    });

  const data = res.data.valueRanges;

  // =========================
  // REGULAR
  // =========================

  const regularData =
    data[0]?.values || [];

  const mtdReg =
    num(data[1]?.values?.[0]?.[0]);

  const targetReg =
    num(data[2]?.values?.[0]?.[0]);

  const persenReg =
    data[3]?.values?.[0]?.[0] || '0,00%';

  // =========================
  // FORMAT TANGGAL
  // =========================

  const [tahun, bulanNum] =
    BULAN_AKTIF.split('-').map(Number);

  const d = new Date(
    tahun,
    bulanNum - 1,
    Number(tanggal)
  );

  const bulan =
    d.toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
    }).toUpperCase();

  const updateDate =
    d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });

  const tglPanjang =
    d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).toUpperCase();

  // =========================
  // BUILD OUTPUT
  // =========================

  let output =
    `*AKUMULASI ${info.nama} BULAN ${bulan}*\n`;

  output +=
    `*UPDATE per ${updateDate}*\n\n`;

  // =========================
  // REGULAR
  // =========================

  output += `*REGULAR*\n`;

  regularData.forEach(row => {
    const jenis = row[0] || '';
    const unit = num(row[1]);
    const total = num(row[2]);

    if (jenis) {
      output +=
        formatItem(jenis, unit, total) + '\n';
    }
  });

  // =========================
  // KIDS
  // =========================

  if (info.hasKids) {
    const kidsData =
      data[4]?.values || [];

    const mtdKids =
      num(data[5]?.values?.[0]?.[0]);

    const targetKids =
      num(data[6]?.values?.[0]?.[0]);

    const persenKids =
      data[7]?.values?.[0]?.[0] || '0,00%';

    output += `\n*KIDS*\n`;

    kidsData.forEach(row => {
      const jenis = row[0] || '';
      const unit = num(row[1]);
      const total = num(row[2]);

      if (jenis) {
        output +=
          formatItem(jenis, unit, total) + '\n';
      }
    });

    output += `\n*${info.nama} KIDS*\n`;

    output +=
      `TARGET : Rp. ${format(targetKids)},-\n`;

    output +=
      `MTD Per ${tglPanjang} : Rp. ${
        mtdKids > 0
          ? format(mtdKids)
          : '-'
      },-\n`;

    output +=
      `Actual x Target : ${persenKids}`;
  }

  // =========================
  // REGULAR SUMMARY
  // =========================

  output += `\n\n*${info.nama}*\n`;

  output +=
    `TARGET : Rp. ${format(targetReg)},-\n`;

  output +=
    `MTD Per ${tglPanjang} : Rp. ${format(mtdReg)},-\n`;

  output +=
    `Actual x Target : ${persenReg}`;

  return output;
}