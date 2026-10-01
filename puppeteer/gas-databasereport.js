import { google } from 'googleapis';
import credentials from '../config/credentials.js';
import { getCabangInfo, getSheetId, BULAN_AKTIF } from '../config/sheets.config.js';

const bulanIndo = [
  'januari','februari','maret','april','mei','juni',
  'juli','agustus','september','oktober','november','desember'
];

const bulanPendek = [
  'JAN','FEB','MAR','APR','MEI','JUN',
  'JUL','AGU','SEP','OKT','NOV','DES'
];

const format2 = n => String(n).padStart(2, '0');

export async function databaseReport(cabang, tanggalFilter) {
  const info    = getCabangInfo(cabang);
  const sheetId = getSheetId(cabang, 'database');

  // Ambil bulan & tahun dari BULAN_AKTIF
  const [tahun, bulanNum] = BULAN_AKTIF.split('-').map(Number);
  const bulan      = bulanIndo[bulanNum - 1];
  const bulanUpper = bulan.toUpperCase();
  const bulanShort = bulanPendek[bulanNum - 1];
  const tahunShort = tahun.toString().slice(-2);
  const bulanAngka = format2(bulanNum);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  // Auto detect nama sheet
  const sheetCandidates = [
    bulan,
    bulanUpper,
    `${bulanUpper} ${tahun}`,
    `${bulanShort}-${tahunShort}`,
    `${bulanUpper}'${tahunShort}`,
    `${bulanShort}'${tahunShort}`,
    `${bulanShort}'${tahun}`,
    `${bulanUpper}'${tahun}`,
  ];

  let res;
  for (const sheetName of sheetCandidates) {
    try {
      res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A2:F2000`,
      });
      if (res?.data?.values) break;
    } catch {
      // coba nama berikutnya
    }
  }

  if (!res) throw new Error(`Sheets tidak ditemukan, kirimkan link spreedsheets database ke Admin BOT`);

  const rows = res.data.values || [];
  const regular = [];
  const kids    = [];
  const totalPerTanggal = {};

  for (const row of rows) {
    const tgl = parseInt(row[1]);
    if (!tgl) continue;

    totalPerTanggal[tgl] = (totalPerTanggal[tgl] || 0) + 1;

    if (tgl === tanggalFilter) {
      const jenis = (row[2] || '').toString().toLowerCase().trim();
      const nama  = row[3] || '-';
      const wa    = row[4] || '-';
      const fc    = row[5] || '-';
      const line  = `${nama} - ${wa} - ${fc}`;

      if (jenis.includes('kids')) {
        kids.push(line);
      } else {
        regular.push(line);
      }
    }
  }

  const tanggalStr = `${format2(tanggalFilter)}/${bulanAngka}/${tahun}`;

  // Pesan 1
  let pesan1;
  if (!info.hasKids) {
    const semua     = [...regular, ...kids];
    const semuaText = semua.length
      ? semua.map((v, i) => `${i + 1}. ${v}`).join('\n')
      : 'Tidak ada data';

    pesan1 = `DATA BASE ${info.nama} ${tanggalStr}\n\n${semuaText}`;
  } else {
    const regularText = regular.length
      ? regular.map((v, i) => `${i + 1}. ${v}`).join('\n')
      : 'Tidak ada data';
    const kidsText = kids.length
      ? kids.map((v, i) => `${i + 1}. ${v}`).join('\n')
      : 'Tidak ada data';

    pesan1 = `*DATABASE ONLINE ${info.nama}*\n*${tanggalStr}*\n\n*REGULER*\n${regularText}\n\n*KIDS*\n${kidsText}`;
  }

  // Pesan 2
  let totalAll = 0;
  const lines      = [];
  const maxTanggal = Math.max(...Object.keys(totalPerTanggal).map(Number), 0);

  for (let i = 1; i <= maxTanggal; i++) {
    const val = totalPerTanggal[i] || 0;
    totalAll += val;
    lines.push(`${format2(i)}/${bulanAngka} : ${val}`);
  }

  const pesan2 = `*TOTAL INCOMING DATA SOSMED ${info.nama} ${bulanUpper} ${tahun}*\n\n${lines.join('\n')}\n\nTOTAL : *${totalAll}*`;

  return { pesan1, pesan2 };
}