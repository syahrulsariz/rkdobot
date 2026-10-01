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

export async function salesUpdate(cabang) {
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

  // =========================
  // TANGGAL & JAM WIB
  // =========================

  const nowWIB =
    new Date(Date.now() + 7 * 60 * 60 * 1000);

  const tanggal =
    nowWIB.getUTCDate().toString();

  const dd =
    String(nowWIB.getUTCDate()).padStart(2, '0');

  const mm =
    String(nowWIB.getUTCMonth() + 1).padStart(2, '0');

  const yyyy =
    nowWIB.getUTCFullYear();

  const hh =
    String(nowWIB.getUTCHours()).padStart(2, '0');

  const min =
    String(nowWIB.getUTCMinutes()).padStart(2, '0');

  const tglText =
    `${dd}-${mm}-${yyyy}`;

  const jamText =
    `${hh}.${min}`;

  // =========================
  // RANGE
  // =========================

  const ranges = [
    `${tanggal}!O83:O88`, // [0] Revenue Membership
    `${tanggal}!O89`,     // [1] PT POS 1
    `${tanggal}!O91`,     // [2] PT POS 2
    `${tanggal}!O93`,     // [3] PT POS 3
    `${tanggal}!O95`,     // [4] PT POS 4
    `${tanggal}!O97`,     // [5] PT POS 5
    `${tanggal}!O99`,     // [6] PT POS 6

    `${tanggal}!F57`,     // [7] Revenue PT by PT
    `${tanggal}!F59`,     // [8] Revenue Kids
    `${tanggal}!F55`,     // [9] Total Today

    `${tanggal}!AH57`,    // [10] MTD
    `${tanggal}!AH61`,    // [11] Persentase MTD
  ];

  if (info.hasKids) {
    ranges.push(
      `${tanggal}!AH75`,  // [12] MTD Kids
      `${tanggal}!AH79`   // [13] Persentase MTD Kids
    );
  }

  let res;

  try {
    res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges,
    });
  } catch (err) {
    throw new Error(
      `Sheet tanggal ${tanggal} belum ada`
    );
  }

  const vr =
    res.data.valueRanges || [];

  // =========================
  // REVENUE MEMBERSHIP
  // O83:O88
  // =========================

  const membershipRows =
    vr[0]?.values || [];

  const revMembership =
    membershipRows.reduce(
      (acc, row) => acc + num(row?.[0]),
      0
    );

  // =========================
  // REVENUE PT POS
  // O89 + O91 + O93 + O95 + O97 + O99
  // =========================

  const revPTPos =
    num(vr[1]?.values?.[0]?.[0]) +
    num(vr[2]?.values?.[0]?.[0]) +
    num(vr[3]?.values?.[0]?.[0]) +
    num(vr[4]?.values?.[0]?.[0]) +
    num(vr[5]?.values?.[0]?.[0]) +
    num(vr[6]?.values?.[0]?.[0]);

  // =========================
  // REVENUE PT BY PT
  // F57
  // =========================

  const revPTReg =
    num(vr[7]?.values?.[0]?.[0]);

  // =========================
  // REVENUE KIDS
  // F59
  // =========================

  const revKids =
    num(vr[8]?.values?.[0]?.[0]);

  // =========================
  // TOTAL TODAY
  // F55
  // =========================

  const totalToday =
    num(vr[9]?.values?.[0]?.[0]);

  // =========================
  // MTD
  // AH57
  // PERSENTASE AH61
  // =========================

  const mtdValue =
    num(vr[10]?.values?.[0]?.[0]);

  const mtdPct =
    pct(vr[11]?.values?.[0]?.[0]);

  // =========================
  // MTD KIDS
  // AH75
  // AH79
  // =========================

  let mtdKidsVal = 0;
  let mtdKidsPct = '0.00%';

  if (info.hasKids) {
    mtdKidsVal =
      num(vr[12]?.values?.[0]?.[0]);

    mtdKidsPct =
      pct(vr[13]?.values?.[0]?.[0]);
  }

  // =========================
  // BUILD OUTPUT
  // =========================

  let output =
    `*${info.nama}*\n\n`;

  output +=
    `Tgl. ${tglText}\n`;

  output +=
    `Pkl. ${jamText}\n\n`;

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
      `*MTD KIDS : Rp ${format(mtdKidsVal)} // ${mtdKidsPct}*\n`;
  }

  output +=
    `*MTD : Rp ${format(mtdValue)} // ${mtdPct}*`;

  return output;
}