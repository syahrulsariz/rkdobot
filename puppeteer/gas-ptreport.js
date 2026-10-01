import { google } from 'googleapis';
import credentials from '../config/credentials.js';
import { getCabangInfo, getSheetId, BULAN_AKTIF } from '../config/sheets.config.js';

const format = n => Number(n || 0).toLocaleString('id-ID');

export async function ptReport(cabang) {
  const info    = getCabangInfo(cabang);
  const sheetId = getSheetId(cabang, 'peringkat');
  const { sheet, salesRange, summaryRange } = info.pt;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const res = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    includeGridData: true,
    ranges: [
      `${sheet}!${salesRange}`,
      `${sheet}!${summaryRange}`,
    ],
  });

  // Data harian
  const salesRows = res.data.sheets[0].data[0].rowData || [];
  const lines = [];

  for (const row of salesRows) {
    const cells   = row.values || [];
    const tanggal = cells[0]?.formattedValue?.trim();
    if (!tanggal) break;

    const salesCell = cells[1];
    if (!salesCell?.formattedValue) break;

    const num = salesCell?.effectiveValue?.numberValue;
    lines.push(
      num !== undefined && num !== null && !isNaN(num)
        ? `${tanggal} : ${format(num)}`
        : `${tanggal} : NO SALE`
    );
  }

  // Summary
  const summaryCells = res.data.sheets[0].data[1].rowData[0].values || [];
  const target = summaryCells[0]?.effectiveValue?.numberValue || 0;
  const mtd    = summaryCells[1]?.effectiveValue?.numberValue || 0;
  const persen = summaryCells[2]?.effectiveValue?.numberValue || 0;

  const persenFormatted = (persen * 100).toFixed(2).replace('.', ',');

  // Bulan & tahun dari BULAN_AKTIF
  const [tahun, bulanNum] = BULAN_AKTIF.split('-').map(Number);
  const bulan = new Date(tahun, bulanNum - 1, 1)
    .toLocaleDateString('id-ID', { month: 'long' })
    .toUpperCase();

  return `*${info.nama}*
*REPORT PT BY PT ${bulan} ${tahun}*\n
${lines.join('\n')}\n
*MTD : ${format(mtd)}//${persenFormatted}%*  
*TARGET : ${format(target)}*`;
}