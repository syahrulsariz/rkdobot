import { google } from 'googleapis';
import credentials from '../config/credentials.js';
import { getCabangInfo, getSheetId, BULAN_AKTIF } from '../config/sheets.config.js';

const format = n => Number(n || 0).toLocaleString('id-ID');

const num = v => {
  if (!v) return 0;

  return Number(
    v.toString()
      .replace(/[Rp.\s]/g, '')
      .replace(',', '.')
  ) || 0;
};

// Persentase: handle "4.10%", "4,10%", "0.041" dll
const pct = v => {
  if (v === undefined || v === null || v === '') {
    return '0.00%';
  }

  let s = v.toString().trim();
  const hasPercentSign = s.includes('%');

  s = s
    .replace(/%/g, '')
    .replace(/\s/g, '')
    .replace(',', '.');

  let n = Number(s) || 0;

  // Kalau sheet menyimpan bentuk pecahan,
  // misalnya 0.041 -> 4.10%
  if (!hasPercentSign && Math.abs(n) <= 10) {
    n *= 100;
  }

  return `${n.toFixed(2)}%`;
};

export async function salesToday(cabang, tanggal) {
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
    auth: client
  });

  let res;

  try {
    res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges: [
        `${tanggal}!O83:O88`, // [0] Revenue Membership
        `${tanggal}!F59`,     // [1] Revenue Kids

        `${tanggal}!O89`,     // [2] PT POS 1
        `${tanggal}!O91`,     // [3] PT POS 2
        `${tanggal}!O93`,     // [4] PT POS 3
        `${tanggal}!O95`,     // [5] PT POS 4
        `${tanggal}!O97`,     // [6] PT POS 5
        `${tanggal}!O99`,     // [7] PT POS 6

        `${tanggal}!F57`,     // [8] Revenue PT by PT
        `${tanggal}!F55`,     // [9] Total Today

        `${tanggal}!AH57`,    // [10] MTD
        `${tanggal}!AH61`,    // [11] Persentase MTD

        `${tanggal}!AH75`,    // [12] MTD Kids
        `${tanggal}!AH79`,    // [13] Persentase MTD Kids
      ],
    });
  } catch (err) {
    throw new Error(
      `Sheet tanggal ${tanggal} belum ada`
    );
  }

  const data =
    res.data.valueRanges || [];

  // =========================
  // REVENUE MEMBERSHIP
  // O83:O88
  // =========================

  const revMembership =
    (data[0]?.values || []).reduce(
      (sum, row) => sum + num(row?.[0]),
      0
    );

  // =========================
  // REVENUE KIDS
  // F59
  // =========================

  const revKids =
    num(data[1]?.values?.[0]?.[0]);

  // =========================
  // REVENUE PT POS
  // O89 + O91 + O93 + O95 + O97 + O99
  // =========================

  const revPTPos =
    num(data[2]?.values?.[0]?.[0]) +
    num(data[3]?.values?.[0]?.[0]) +
    num(data[4]?.values?.[0]?.[0]) +
    num(data[5]?.values?.[0]?.[0]) +
    num(data[6]?.values?.[0]?.[0]) +
    num(data[7]?.values?.[0]?.[0]);

  // =========================
  // REVENUE PT BY PT
  // F57
  // =========================

  const revPTReg =
    num(data[8]?.values?.[0]?.[0]);

  // =========================
  // TOTAL TODAY
  // F55
  // =========================

  const totalToday =
    num(data[9]?.values?.[0]?.[0]);

  // =========================
  // MTD
  // AH57
  // PERSENTASE AH61
  // =========================

  const totalMTD =
    num(data[10]?.values?.[0]?.[0]);

  const persenMTD =
    pct(data[11]?.values?.[0]?.[0]);

  // =========================
  // MTD KIDS
  // AH75
  // AH79
  // =========================

  const totalMTDKids =
    num(data[12]?.values?.[0]?.[0]);

  const persenMTDKids =
    pct(data[13]?.values?.[0]?.[0]);

  // =========================
  // FORMAT TANGGAL
  // =========================

  const [tahun, bulanNum] =
    BULAN_AKTIF
      .split('-')
      .map(Number);

  const d = new Date(
    tahun,
    bulanNum - 1,
    Number(tanggal)
  );

  const tglText =
    d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  // =========================
  // OUTPUT
  // =========================

  let output =
    `*${info.nama}*\n\n`;

  output +=
    `Tgl. ${tglText}\n`;

  output +=
    `Pkl. 22.00\n\n`;

  output +=
    `Revenue Membership : Rp ${format(revMembership)}\n`;

  if (info.hasKids) {
    output +=
      `Revenue Kids : Rp ${format(revKids)}\n`;
  }

  output +=
    `Revenue PT POS : Rp ${format(revPTPos)}\n`;

  output +=
    `Revenue PT by PT : Rp ${format(revPTReg)}\n\n`;

  output +=
    `*Total Today : Rp ${format(totalToday)}*\n\n`;

  if (info.hasKids) {
    output +=
      `*MTD KIDS : Rp ${format(totalMTDKids)} // ${persenMTDKids}*\n`;
  }

  output +=
    `*MTD : Rp ${format(totalMTD)} // ${persenMTD}*`;

  return output;
}