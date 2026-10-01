import { google } from 'googleapis';
import credentials from '../config/credentials.js';
import { getCabangInfo, getSheetId, BULAN_AKTIF } from '../config/sheets.config.js';

/* ================= UTILS ================= */
const parseNum = (val) => {
  if (val === null || val === undefined || val === '' || val === '-') return 0;
  const cleaned = val.toString().replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const format = n => {
  const num = parseNum(n);
  return num === 0 ? '-' : num.toLocaleString('id-ID');
};

// Sama seperti format(), tapi menambahkan "(X UNIT)" di belakang nilai kalau
// ada angka unit > 0 untuk sel itu. Kalau nilainya 0/kosong, tetap tampil "-"
// tanpa unit (mengikuti contoh PAK ZACKY / FATMA / SHANTY di laporan target).
const formatWithUnit = (val, unit) => {
  const num = parseNum(val);
  if (num === 0) return '-';
  const base = num.toLocaleString('id-ID');
  const unitNum = parseNum(unit);
  return unitNum > 0 ? `${base} (${unitNum} UNIT)` : base;
};

const isGenericName = (name) => {
  if (!name) return true;
  const cleaned = name.toString().trim().toUpperCase();
  return /^(FC|PT)\s*\d+$/.test(cleaned);
};

const isKidsFC = (name) => {
  if (!name) return false;
  return name.toString().toUpperCase().includes('KIDS');
};

/* ================= UNIT COLUMN MAP =================
 * Setiap FC/PT punya "blok kolom" sendiri di baris tertentu (mis. baris 132
 * untuk FC yang hasKids, baris 80 untuk yang tidak, baris 195/122 untuk PT).
 * Posisi kolom (index 0-based, A=0,B=1,C=2,D=3,...) SAMA untuk setiap
 * blok, hanya bergeser sejauh `step` kolom per FC/PT berikutnya:
 *
 *   FC (hasKids)  -> DP=D(3), NJM=E(4), DP POS=G(6), POS=H(7), DP KIDS=J(9), KIDS=K(10), step 14
 *   FC (no kids)  -> DP=D(3), NJM=E(4), DP POS=G(6), POS=H(7),                           step 8
 *   PT (keduanya) -> DP REG=D(3), REG=E(4),                                              step 5
 *
 * Baris tempat blok-blok ini berada (132/195 untuk hasKids: true, 80/122
 * untuk hasKids: false) SELALU SAMA untuk semua cabang berlayout sejenis,
 * jadi sudah di-hardcode otomatis di bawah berdasarkan info.hasKids — tidak
 * perlu nambah apa pun ke sheets.config.js. Kalau suatu saat ada cabang
 * dengan baris unit yang beda, tinggal isi `pr.unitFcRow` / `pr.unitPtRow`
 * di config cabang itu untuk override nilai default-nya.
 */
const FC_UNIT_COLS_KIDS  = { dp: 3, njm: 4, dpPos: 6, pos: 7, dpKids: 9, kids: 10, dpPosKids: 12, posKids: 13 };
const FC_UNIT_COLS_PLAIN = { dp: 3, njm: 4, dpPos: 6, pos: 7 };
const FC_UNIT_STEP_KIDS  = 14;
const FC_UNIT_STEP_PLAIN = 8;

const PT_UNIT_COLS = { dpReg: 3, reg: 4 };
const PT_UNIT_STEP = 5;

// Ambil satu nilai unit dari array 1 baris penuh (hasil fetch "sheet!ROW:ROW"),
// di kolom dasar `baseCol` + geseran `step * index`.
const getUnit = (rowValues, baseCol, step, index) => {
  if (!rowValues || !rowValues.length) return 0;
  return parseNum(rowValues[baseCol + step * index]);
};

/* ================= MAIN ================= */
export async function peringkatReport(cabang, tanggal) {
  const info    = getCabangInfo(cabang);
  const sheetId = getSheetId(cabang, 'peringkat');
  const pr      = info.peringkat;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  // Fetch numeric data
  const numericRes = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    ranges: [
      `${pr.sheet}!${pr.fcRange}`,
      `${pr.sheet}!${pr.ptRange}`,
    ],
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  // Fetch summary data (formatted untuk %)
  const summaryRes = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    ranges: [`${pr.sheet}!${pr.summaryRange}`],
    valueRenderOption: 'FORMATTED_VALUE',
  });

  // Baris tempat sel "jumlah unit" berada. Ini TETAP sama untuk semua cabang
  // dengan layout sejenis, tergantung hasKids atau tidak:
  //   hasKids: true  -> unit FC di baris 132, unit PT di baris 195
  //   hasKids: false -> unit FC di baris 80,  unit PT di baris 122
  // Bisa di-override per cabang lewat pr.unitFcRow / pr.unitPtRow di
  // sheets.config.js kalau suatu saat ada cabang dengan baris yang beda.
  const unitFcRow = pr.unitFcRow ?? (info.hasKids ? 132 : 80);
  const unitPtRow = pr.unitPtRow ?? (info.hasKids ? 195 : 122);

  const unitRes = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    ranges: [
      `${pr.sheet}!${unitFcRow}:${unitFcRow}`,
      `${pr.sheet}!${unitPtRow}:${unitPtRow}`,
    ],
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const unitFcRowValues = unitRes.data.valueRanges[0].values?.[0] || [];
  const unitPtRowValues = unitRes.data.valueRanges[1].values?.[0] || [];

  const numericValues = numericRes.data.valueRanges;
  const summaryValues = summaryRes.data.valueRanges;

  // Parse FC data
  const fcRows     = numericValues[0].values || [];
  const fcList     = [];
  const fcKidsList = [];

  const fcUnitCols = info.hasKids ? FC_UNIT_COLS_KIDS : FC_UNIT_COLS_PLAIN;
  const fcUnitStep = info.hasKids ? FC_UNIT_STEP_KIDS : FC_UNIT_STEP_PLAIN;
  let fcBlockIndex = 0; // urutan blok kolom FC di sheet (0-based)

  for (const row of fcRows) {
    const nama = row[0]?.toString().trim();
    if (!nama || isGenericName(nama)) continue;

    const blockIndex = fcBlockIndex;
    fcBlockIndex++;

    if (info.hasKids) {
      if (isKidsFC(nama)) {
        // FC KIDS pakai kolom unit khusus miliknya sendiri (beda dari FC regular):
        //   memkids   -> unit "kids"       (K, J, dst — sama seperti FC regular)
        //   dpMemkids -> unit "dpKids"     (J, X, dst — sama seperti FC regular)
        //   posKids   -> unit "posKids"    (N132, AB132, dst — kolom sendiri)
        //   dpPosKids -> unit "dpPosKids"  (M132, AA132, dst — kolom sendiri)
        const memkids   = parseNum(row[7]);
        const dpMemkids = parseNum(row[6]);
        const dpPosKids = parseNum(row[8]);
        const posKids   = parseNum(row[9]);
        fcKidsList.push({
          nama: nama.replace(/\(KIDS\)/gi, '').trim(),
          memkids, dpMemkids, dpPosKids, posKids,
          total: memkids + dpMemkids + dpPosKids + posKids,
          unitMemkids:   getUnit(unitFcRowValues, fcUnitCols.kids,      fcUnitStep, blockIndex),
          unitDpMemkids: getUnit(unitFcRowValues, fcUnitCols.dpKids,    fcUnitStep, blockIndex),
          unitPosKids:   getUnit(unitFcRowValues, fcUnitCols.posKids,   fcUnitStep, blockIndex),
          unitDpPosKids: getUnit(unitFcRowValues, fcUnitCols.dpPosKids, fcUnitStep, blockIndex),
        });
      } else {
        const dpMembership = parseNum(row[2]);
        const membership   = parseNum(row[3]);
        const dpPos        = parseNum(row[4]);
        const pos          = parseNum(row[5]);
        const dpMemkids    = parseNum(row[6]);
        const memkids      = parseNum(row[7]);
        const dpPosKids    = parseNum(row[8]);
        const posKids      = parseNum(row[9]);
        const total        = parseNum(row[11]);
        fcList.push({
          nama, membership, dpMembership, pos, dpPos,
          kidsTotal: memkids + posKids,
          dpKidsTotal: dpMemkids + dpPosKids,
          total,
          unitNjm:    getUnit(unitFcRowValues, fcUnitCols.njm,    fcUnitStep, blockIndex),
          unitPos:    getUnit(unitFcRowValues, fcUnitCols.pos,    fcUnitStep, blockIndex),
          unitDpPos:  getUnit(unitFcRowValues, fcUnitCols.dpPos,  fcUnitStep, blockIndex),
          unitDpKids: getUnit(unitFcRowValues, fcUnitCols.dpKids, fcUnitStep, blockIndex),
          unitKids:   getUnit(unitFcRowValues, fcUnitCols.kids,   fcUnitStep, blockIndex),
          unitDp:     getUnit(unitFcRowValues, fcUnitCols.dp,     fcUnitStep, blockIndex),
        });
      }
    } else {
      fcList.push({
        nama,
        dpMembership: parseNum(row[2]),
        membership:   parseNum(row[3]),
        dpPos:        parseNum(row[4]),
        pos:          parseNum(row[5]),
        kidsTotal:    0,
        dpKidsTotal:  0,
        total:        parseNum(row[7]),
        unitNjm:   getUnit(unitFcRowValues, fcUnitCols.njm,   fcUnitStep, blockIndex),
        unitPos:   getUnit(unitFcRowValues, fcUnitCols.pos,   fcUnitStep, blockIndex),
        unitDpPos: getUnit(unitFcRowValues, fcUnitCols.dpPos, fcUnitStep, blockIndex),
        unitDp:    getUnit(unitFcRowValues, fcUnitCols.dp,    fcUnitStep, blockIndex),
      });
    }
  }

  fcList.sort((a, b) => b.total - a.total);
  fcKidsList.sort((a, b) => b.total - a.total);

  // Parse PT data
  const ptRows = numericValues[1].values || [];
  const ptList = [];
  let ptBlockIndex = 0;

  for (const row of ptRows) {
    const nama = row[0]?.toString().trim();
    if (!nama || isGenericName(nama)) continue;

    const blockIndex = ptBlockIndex;
    ptBlockIndex++;

    ptList.push({
      nama,
      dpPT:  parseNum(row[2]),
      ptReg: parseNum(row[3]),
      total: parseNum(row[2]) + parseNum(row[3]),
      unitReg:   getUnit(unitPtRowValues, PT_UNIT_COLS.reg,   PT_UNIT_STEP, blockIndex),
      unitDpReg: getUnit(unitPtRowValues, PT_UNIT_COLS.dpReg, PT_UNIT_STEP, blockIndex),
    });
  }

  ptList.sort((a, b) => b.total - a.total);

  // Parse summary
  const summaryRow = summaryValues[0].values?.[0] || [];
  const target     = parseNum(summaryRow[0]);
  const mtd        = parseNum(summaryRow[1]);
  const persen     = summaryRow[2] || '0%';

  // Format tanggal dari BULAN_AKTIF + tanggal parameter
  const [tahun, bulanNum] = BULAN_AKTIF.split('-').map(Number);
  const tanggalDisplay = new Date(tahun, bulanNum - 1, Number(tanggal))
    .toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    .toUpperCase();

  // Build output
  // Catatan: info.nama di config sudah termasuk prefix "HOM" (mis. "HOM MODERNLAND").
  // Dipakai apa adanya baik di judul atas maupun di ringkasan bawah.
  let output = `*PERINGKAT FC&PT ${info.nama} ${tanggalDisplay}*\n\n`;
  output += `*FC*`;

  for (const fc of fcList) {
    output += `\n${fc.nama}\n`;
    output += `MEMBERSHIP : ${formatWithUnit(fc.membership, fc.unitNjm)}\n`;
    if (info.hasKids) {
      output += `KIDS : ${formatWithUnit(fc.kidsTotal, fc.unitKids)}\n`;
    }
    output += `POS : ${formatWithUnit(fc.pos, fc.unitPos)}\n`;
    output += `DP POS : ${formatWithUnit(fc.dpPos, fc.unitDpPos)}\n`;
    if (info.hasKids) {
      output += `DP KIDS : ${formatWithUnit(fc.dpKidsTotal, fc.unitDpKids)}\n`;
    }
    output += `DP : ${formatWithUnit(fc.dpMembership, fc.unitDp)}\n`;
    output += `JML : ${format(fc.total)}\n`;
  }

  if (fcKidsList.length > 0) {
    output += `\n*FC KIDS*`;
    for (const fc of fcKidsList) {
      output += `\n${fc.nama}\n`;
      output += `MEMBERSHIP : ${formatWithUnit(fc.memkids, fc.unitMemkids)}\n`;
      output += `DP : ${formatWithUnit(fc.dpMemkids, fc.unitDpMemkids)}\n`;
      output += `DP POS KIDS : ${formatWithUnit(fc.dpPosKids, fc.unitDpPosKids)}\n`;
      output += `POS KIDS : ${formatWithUnit(fc.posKids, fc.unitPosKids)}\n`;
    }
  }

  output += `\n*PT*`;
  for (const pt of ptList) {
    output += `\n${pt.nama}\n`;
    output += `REG : ${formatWithUnit(pt.ptReg, pt.unitReg)}\n`;
    output += `DP REG : ${formatWithUnit(pt.dpPT, pt.unitDpReg)}\n`;
    output += `JML : ${format(pt.total)}\n`;
  }

  output += `\n*${info.nama}*\n`;
  output += `*Total Target : Rp ${format(target)}*\n`;
  output += `*MTD Per. Tgl ${tanggalDisplay} : Rp ${format(mtd)}*\n`;
  output += `*Actual x Target : ${persen}*`;

  return output;
}