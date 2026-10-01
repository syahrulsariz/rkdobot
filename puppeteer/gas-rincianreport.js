import { google } from 'googleapis';
import puppeteer from 'puppeteer';
import credentials from '../config/credentials.js';
import {
  getSheetId,
  getCabangInfo,
  BULAN_AKTIF,
} from '../config/sheets.config.js';

// ─── Helpers ─────────────────────────────────────────────

const format = n => Number(n || 0).toLocaleString('id-ID');

const num = v => {
  if (v === undefined || v === null || v === '') return 0;

  return parseFloat(
    v.toString().replace(/\D/g, '')
  ) || 0;
};

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

function addTo(map, key, total) {
  if (!map.has(key)) {
    map.set(key, {
      total: 0,
      count: 0,
    });
  }

  const v = map.get(key);

  v.total += total;
  v.count += 1;
}

// ─── Sort ─────────────────────────────────────────────────

function parseQty(key) {
  const m = String(key).match(/(\d+)(?:\+(\d+))?/);

  return m
    ? [parseInt(m[1]), parseInt(m[2] || 0)]
    : [999999, 0];
}

// Urut dari angka utama kecil ke besar,
// lalu bonus (12 sebelum 12+12), lalu abjad
function sortByQty(entries) {
  return [...entries].sort((a, b) => {
    const [a1, a2] = parseQty(a[0]);
    const [b1, b2] = parseQty(b[0]);

    return (
      a1 - b1 ||
      a2 - b2 ||
      a[0].localeCompare(b[0])
    );
  });
}

// ─── Build rincian transaksi ─────────────────────────────

function normalizeRincianDetail(value, category) {
  const text = String(value || '')
    .toUpperCase()
    .trim();

  if (!text) return '';

  /*
    Ambil angka dari F.

    Contoh:
    3
    3+1
    6+2
    10
    20+5
  */

  const numberMatch = text.match(
    /\d+(?:\+\d+)?/
  );

  if (!numberMatch) {
    return '';
  }

  const numberPart = numberMatch[0];

  /*
    Yang boleh ikut dari F hanya:
    - PROMO
    - BOOSTER

    Selain itu dibuang.
  */

  const extras = [];

  if (/\bPROMO\b/.test(text)) {
    extras.push('PROMO');
  }

  if (/\bBOOSTER\b/.test(text)) {
    extras.push('BOOSTER');
  }

  /*
    MEMBERSHIP

    MONTH / MONTHS
    selalu menjadi MONTHS.

    PRIMARY / SIBLINGS
    otomatis tidak ikut.
  */

  if (category === 'membership') {
    return [
      numberPart,
      'MONTHS',
      ...extras,
    ].join(' ');
  }

  /*
    POS / REG

    SESI / SS
    selalu menjadi SESI.
  */

  if (
    category === 'reg' ||
    category === 'pos'
  ) {
    return [
      numberPart,
      'SESI',
      ...extras,
    ].join(' ');
  }

  return '';
}

function getRincianTransactionInfo(type) {
  const t = String(type || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (!t) return null;

  const isKids =
    /\bKIDS\b/.test(t);

  /*
    Mapping DP resmi:

    REGULAR:
    DP NJM
    DP RENEW

    DP NEW POS
    DP RENEW POS

    DP NEW REG
    DP RENEW REG

    KIDS:
    DP NJM KIDS
    DP RENEW KIDS

    DP NEW POS KIDS
    DP RENEW POS KIDS

    DP NEW REG KIDS
    DP RENEW REG KIDS

    TIDAK ADA:
    DP UPGRADE
    DP PELUNASAN
  */

  const isDP =
    /^DP\s+(?:NJM|RENEW)(?:\s+KIDS)?$/.test(t) ||
    /^DP\s+(?:NEW|RENEW)\s+(?:POS|REG)(?:\s+KIDS)?$/.test(t);

  // =======================================================
  // MEMBERSHIP
  // =======================================================

  if (
    /^(?:NJM|RENEW|UPGRADE MEM|PELUNASAN MEM)(?:\s+KIDS)?$/.test(t) ||
    /^DP\s+(?:NJM|RENEW)(?:\s+KIDS)?$/.test(t)
  ) {
    return {
      category: 'membership',
      kids: isKids,
      dp: isDP,
    };
  }

  // =======================================================
  // POS
  // =======================================================

  if (
    /^(?:NEW POS|RENEW POS|UPGRADE POS|PELUNASAN POS)(?:\s+KIDS)?$/.test(t) ||
    /^DP\s+(?:NEW|RENEW) POS(?:\s+KIDS)?$/.test(t)
  ) {
    return {
      category: 'pos',
      kids: isKids,
      dp: isDP,
    };
  }

  // =======================================================
  // REG
  // =======================================================

  if (
    /^(?:NEW REG|RENEW REG|UPGRADE REG|PELUNASAN REG)(?:\s+KIDS)?$/.test(t) ||
    /^DP\s+(?:NEW|RENEW) REG(?:\s+KIDS)?$/.test(t)
  ) {
    return {
      category: 'reg',
      kids: isKids,
      dp: isDP,
    };
  }

  return null;
}

function buildRincian(transaksi) {
  const groups = {
    dpKidsMonths: new Map(),
    kidsMonths: new Map(),

    dpRegMonths: new Map(),
    regMonths: new Map(),

    dpPosKids: new Map(),
    dpRegKids: new Map(),
    posKids: new Map(),
    regKids: new Map(),

    dpPos: new Map(),
    dpReg: new Map(),
    pos: new Map(),
    reg: new Map(),
  };

  for (const r of transaksi || []) {

    /*
      Range C:AD

      r[0]  = C = jenis transaksi Regular
      r[1]  = D = jenis transaksi Kids
      r[2]  = E = nama member
      r[3]  = F = detail/package

      r[4]  = G
      ...
      r[27] = AD
    */

    const cType =
      String(r[0] || '').trim();

    const dType =
      String(r[1] || '').trim();

    const detailRaw =
      String(r[3] || '').trim();

    /*
      D terisi = Kids
      D kosong = Regular

      F TIDAK dipakai untuk menentukan
      jenis transaksi.
    */

    const sourceType =
      dType || cType;

    if (!sourceType) continue;

    const info =
      getRincianTransactionInfo(
        sourceType
      );

    if (!info) continue;

    // =====================================================
    // NOMINAL G:AD
    // =====================================================

    let total = 0;

    for (let i = 4; i <= 27; i++) {
      total += num(r[i]);
    }

    if (!total) continue;

    // =====================================================
    // DETAIL DARI F
    // =====================================================

    const key =
      normalizeRincianDetail(
        detailRaw,
        info.category
      );

    if (!key) continue;

    let target;

    // =====================================================
    // MEMBERSHIP
    // =====================================================

    if (info.category === 'membership') {

      if (info.kids) {
        target = info.dp
          ? groups.dpKidsMonths
          : groups.kidsMonths;
      } else {
        target = info.dp
          ? groups.dpRegMonths
          : groups.regMonths;
      }
    }

    // =====================================================
    // POS
    // =====================================================

    else if (info.category === 'pos') {

      if (info.kids) {
        target = info.dp
          ? groups.dpPosKids
          : groups.posKids;
      } else {
        target = info.dp
          ? groups.dpPos
          : groups.pos;
      }
    }

    // =====================================================
    // REG
    // =====================================================

    else if (info.category === 'reg') {

      if (info.kids) {
        target = info.dp
          ? groups.dpRegKids
          : groups.regKids;
      } else {
        target = info.dp
          ? groups.dpReg
          : groups.reg;
      }
    }

    if (!target) continue;

    addTo(
      target,
      key,
      total
    );
  }

  return groups;
}

// ─── Render rincian ───────────────────────────────────────

function renderLine(label, val) {
  return val.count > 1
    ? `${label} X${val.count} ${format(val.total)}`
    : `${label} ${format(val.total)}`;
}

function renderGroup(
  map,
  labelFn,
  sortFn = sortByQty
) {
  return sortFn([...map.entries()])
    .map(([key, val]) =>
      renderLine(
        labelFn(key),
        val
      )
    );
}

function renderRincian(groups) {
  const sections = [];

  // =======================================================
  // 1. KIDS MEMBERSHIP
  // =======================================================

  const s1 = [
    ...renderGroup(
      groups.dpKidsMonths,
      k => `DP KIDS ${k}`
    ),
    ...renderGroup(
      groups.kidsMonths,
      k => `KIDS ${k}`
    ),
  ];

  if (s1.length) {
    sections.push(s1.join('\n'));
  }

  // =======================================================
  // 2. REGULAR MEMBERSHIP
  // =======================================================

  const s2 = [
    ...renderGroup(
      groups.dpRegMonths,
      k => `DP ${k}`
    ),
    ...renderGroup(
      groups.regMonths,
      k => k
    ),
  ];

  if (s2.length) {
    sections.push(s2.join('\n'));
  }

  // =======================================================
  // 3. KIDS POS / REG
  // =======================================================

  const s3 = [
    ...renderGroup(
      groups.dpPosKids,
      k => `DP PT KIDS POS ${k}`
    ),
    ...renderGroup(
      groups.dpRegKids,
      k => `DP PT KIDS REG ${k}`
    ),
    ...renderGroup(
      groups.posKids,
      k => `PT KIDS POS ${k}`
    ),
    ...renderGroup(
      groups.regKids,
      k => `PT KIDS REG ${k}`
    ),
  ];

  if (s3.length) {
    sections.push(s3.join('\n'));
  }

  // =======================================================
  // 4. REGULAR POS / REG
  // =======================================================

  const s4 = [
    ...renderGroup(
      groups.dpPos,
      k => `DP PT POS ${k}`
    ),
    ...renderGroup(
      groups.dpReg,
      k => `DP PT REG ${k}`
    ),
    ...renderGroup(
      groups.pos,
      k => `PT POS ${k}`
    ),
    ...renderGroup(
      groups.reg,
      k => `PT REG ${k}`
    ),
  ];

  if (s4.length) {
    sections.push(s4.join('\n'));
  }

  return sections.join('\n\n');
}

// ─── Puppeteer: ambil data checkin ───────────────────────

/*
  Env yang dipakai (.env):

  SISTEM_USERNAME=
  SISTEM_PASSWORD=
*/

// true  = browser tampil (GUI) untuk debug
// false = browser jalan di belakang layar (normal)
const SHOW_BROWSER = false;

async function getCheckin(checkinId) {
  const DEBUG = SHOW_BROWSER;

  let browser;
  let step = 'start';

  const setStep = s => {
    step = s;
    console.log('LANGKAH:', s);
  };

  try {
    const username =
      process.env.SISTEM_USERNAME;

    const password =
      process.env.SISTEM_PASSWORD;

    if (!username || !password) {
      throw new Error(
        'SISTEM_USERNAME / SISTEM_PASSWORD belum diset'
      );
    }

    browser = await puppeteer.launch({
      headless: DEBUG ? false : 'new',
      slowMo: DEBUG ? 100 : 0,
      defaultViewport: DEBUG ? null : undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        ...(DEBUG ? ['--start-maximized'] : []),
      ],
    });

    const page =
      await browser.newPage();

    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(60000);

    // Blok gambar, font, dan media supaya halaman lebih cepat
    await page.setRequestInterception(true);

    page.on('request', req => {
      const t = req.resourceType();

      if (
        t === 'image' ||
        t === 'font' ||
        t === 'media'
      ) {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });

    // Tangani alert/popup dari halaman
    // (catat pesannya, lalu otomatis OK)
    page.on('dialog', async dialog => {
      console.log(
        'POPUP SISTEM:',
        dialog.message()
      );

      await dialog.accept().catch(() => {});
    });

    // ─── Buka halaman login ────────────────────────

    setStep('buka halaman login');

    await page.goto(
      'https://houseofmetamorfit.ampabatech.com/index.php',
      {
        waitUntil: 'domcontentloaded',
      }
    );

    setStep('tunggu form login');

    await page.waitForSelector(
      'input[name="namapengguna"]'
    );

    // ─── Isi form login ────────────────────────────

    setStep('isi form login');

    // Kosongkan dulu, lalu ketik
    await page.click(
      'input[name="namapengguna"]',
      { clickCount: 3 }
    );

    await page.type(
      'input[name="namapengguna"]',
      username,
      { delay: 0 }
    );

    await page.click(
      'input[name="katasandi"]',
      { clickCount: 3 }
    );

    await page.type(
      'input[name="katasandi"]',
      password,
      { delay: 0 }
    );

    // Pastikan isian benar-benar terisi sebelum klik
    const filled =
      await page.evaluate(() => ({
        u:
          document.querySelector(
            'input[name="namapengguna"]'
          )?.value || '',

        p:
          document.querySelector(
            'input[name="katasandi"]'
          )?.value || '',
      }));

    if (
      filled.u !== username ||
      filled.p !== password
    ) {
      throw new Error(
        'Isian form tidak sesuai, login dibatalkan'
      );
    }

    // Jeda singkat sebelum klik masuk
    await sleep(300);

    // ─── Klik login ────────────────────────────────

    setStep('klik login');

    await page.click(
      'button[type="submit"], input[type="submit"]'
    );

    // Tunggu sampai form login hilang (dashboard terbuka),
    // maksimal 8 detik. Popup di-OK otomatis oleh handler.
    await page
      .waitForFunction(
        () =>
          !document.querySelector(
            'input[name="namapengguna"]'
          ),
        { timeout: 8000 }
      )
      .catch(() => {});

    await sleep(300);

    console.log(
      'URL setelah login:',
      page.url()
    );

    // ─── Halaman check in ──────────────────────────

    setStep('buka halaman checkin');

    await page.goto(
      `https://houseofmetamorfit.ampabatech.com/secure_login2.php?&id=${checkinId}`,
      {
        waitUntil: 'domcontentloaded',
      }
    );

    setStep('tunggu .details');

    await page.waitForSelector(
      '.details'
    );

    // ─── Ambil angka ───────────────────────────────

    setStep('ambil angka');

    const checkin =
      await page.evaluate(() => {

        for (
          const card of
          document.querySelectorAll('.details')
        ) {

          const desc =
            card
              .querySelector('.desc')
              ?.innerText
              ?.toLowerCase();

          if (
            desc?.includes('check in hari ini')
          ) {

            return (
              card
                .querySelector('.number span')
                ?.getAttribute('data-value') ||

              card
                .querySelector('.number span')
                ?.innerText ||

              '0'
            );
          }
        }

        return '0';
      });

    console.log(
      'CHECKIN terbaca:',
      checkin,
      '| URL:',
      page.url()
    );

    return checkin;

  } catch (err) {

    console.log(
      `CHECKIN ERROR (langkah: ${step}):`,
      err.message
    );

    // Simpan screenshot + URL terakhir untuk debug
    try {
      const pages =
        browser
          ? await browser.pages()
          : [];

      const p =
        pages[pages.length - 1];

      if (p) {
        console.log(
          'URL terakhir:',
          p.url()
        );

        await p.screenshot({
          path: 'checkin-error.png',
        });
      }
    } catch {}

    return '-';

  } finally {

    if (browser) {

      // Mode debug: tahan sebentar supaya sempat dilihat
      if (DEBUG) {
        await sleep(5000);
      }

      await browser.close();
    }
  }
}

// ─── Google Sheets: ambil data closing ───────────────────

async function getClosingData(
  spreadsheetId,
  tanggal
) {
  const auth =
    new google.auth.GoogleAuth({
      credentials,

      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ],
    });

  const client =
    await auth.getClient();

  const sheets =
    google.sheets({
      version: 'v4',
      auth: client,
    });

  const res =
    await sheets.spreadsheets.values.batchGet({
      spreadsheetId,

      ranges: [

        // [0] Transaksi
        `${tanggal}!C4:AD50`,

        // [1] New Join Regular
        `${tanggal}!N83`,

        // [2] New Join Regular baris 2
        `${tanggal}!N85`,

        // [3] New Join Kids
        `${tanggal}!R83`,

        // [4] New Join Kids baris 2
        `${tanggal}!R85`,

        // [5] Akumulasi Regular
        `${tanggal}!V83`,

        // [6] Akumulasi Regular baris 2
        `${tanggal}!V85`,

        // [7] Akumulasi Kids
        `${tanggal}!Z83`,

        // [8] Akumulasi Kids baris 2
        `${tanggal}!Z85`,

        // [9] Total Today
        `${tanggal}!F55`,

        // [10] DLL
        `${tanggal}!F78`,

        // [11] Payment
        `${tanggal}!B56:C69`,

        // [12] MTD Regular
        `${tanggal}!AH57`,

        // [13] Target Regular
        `${tanggal}!AH59`,

        // [14] Persentase Regular
        `${tanggal}!AH61`,

        // [15] MTD Kids
        `${tanggal}!AH75`,

        // [16] Target Kids
        `${tanggal}!AH77`,

        // [17] Persentase Kids
        `${tanggal}!AH79`,

        // [18] CS
        `${tanggal}!AG4:AG53`,
      ],
    });

  return res.data.valueRanges;
}

// ─── Builder: susun teks report ─────────────────────────

function buildReport({
  info,
  tanggal,
  data,
  checkin,
  hasKids,
}) {

  // ─── Transaksi ──────────────────────────────────────

  const transaksi =
    data[0]?.values || [];

  // ─── New Join ──────────────────────────────────────

  const joinTodayReg =
    num(data[1]?.values?.[0]?.[0]) +
    num(data[2]?.values?.[0]?.[0]);

  const joinTodayKids =
    num(data[3]?.values?.[0]?.[0]) +
    num(data[4]?.values?.[0]?.[0]);

  const joinNew =
    joinTodayReg +
    joinTodayKids;

  // ─── Akumulasi ─────────────────────────────────────

  const regAkum =
    num(data[5]?.values?.[0]?.[0]) +
    num(data[6]?.values?.[0]?.[0]);

  const kidsAkum =
    num(data[7]?.values?.[0]?.[0]) +
    num(data[8]?.values?.[0]?.[0]);

  const akumulasi =
    regAkum +
    kidsAkum;

  // ─── Total Today ──────────────────────────────────

  const totalToday =
    num(data[9]?.values?.[0]?.[0]);

  // ─── DLL ───────────────────────────────────────────

  const dll =
    num(data[10]?.values?.[0]?.[0]);

  // ─── Payment ──────────────────────────────────────

  const payment =
    data[11]?.values || [];

  // ─── MTD Regular ──────────────────────────────────

  const mtd =
    num(data[12]?.values?.[0]?.[0]);

  const target =
    num(data[13]?.values?.[0]?.[0]);

  const persen =
    data[14]?.values?.[0]?.[0] || 0;

  // ─── MTD Kids ─────────────────────────────────────

  const mtdKids =
    num(data[15]?.values?.[0]?.[0]);

  const targetKids =
    num(data[16]?.values?.[0]?.[0]);

  const persenKids =
    data[17]?.values?.[0]?.[0] || 0;

  // ─── Rincian transaksi ────────────────────────────

  const groups =
    buildRincian(transaksi);

  const rincian =
    renderRincian(groups);

  // ─── DLL text ─────────────────────────────────────

  const dllText =
    dll > 0
      ? format(dll)
      : '-';

  // ─── Payment text ────────────────────────────────

  let payText = '';

  for (const r of payment) {

    const nama =
      r[0]?.toString().trim();

    const val =
      num(r[1]);

    if (!nama) continue;

    if (
      nama
        .toUpperCase()
        .includes('OTHER')
    ) {
      break;
    }

    // Kalau nominal kosong / 0, jangan tampilkan
    if (!val) continue;

    payText +=
      `${nama} : ${format(val)}\n`;
  }

  // ─── CS terakhir ─────────────────────────────────

  const csList =
    data[18]?.values || [];

  let lastCS = '-';

  csList.forEach(r => {

    const nama =
      r[0]?.toString().trim();

    if (nama) {
      lastCS =
        nama.toUpperCase();
    }
  });

  // ─── Format tanggal ──────────────────────────────

  const [tahun, bulan] =
    BULAN_AKTIF
      .split('-')
      .map(Number);

  const d =
    new Date(
      tahun,
      bulan - 1,
      Number(tanggal)
    );

  const hari =
    d.toLocaleDateString(
      'id-ID',
      { weekday: 'long' }
    );

  const tgl =
    d.toLocaleDateString(
      'id-ID',
      {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }
    ).toUpperCase();

  // ─── Teks kondisional Kids ────────────────────────

  const kidsJoinText =
    hasKids
      ? `New Join Member Kids : ${joinTodayKids}\n`
      : '';

  const akumulasiText =
    hasKids
      ? `Akumulasi new join : ${akumulasi}\nRegular : ${regAkum}\nKids : ${kidsAkum}`
      : `Akumulasi new join : ${akumulasi}`;

  const mtdKidsText =
    hasKids
      ? `\n\n*MTD KIDS :*\n*${format(mtdKids)}//${persenKids}*\n*TARGET : ${format(targetKids)}*`
      : '';

  // ─── Final report ─────────────────────────────────

  return `*${info.nama}*
*${hari} ,${tgl} pukul 22.00 WIB*

New Join Member : ${joinNew}
${kidsJoinText}
${rincian}

DLL :
${dllText}

Total today at 22.00 : ${format(totalToday)}

${akumulasiText}

Check in today : ${checkin} member

${payText}
*MTD :*
*${format(mtd)}//${persen}*
*TARGET : ${format(target)}*${mtdKidsText}

Thanks
${lastCS}`;
}

// ─── Main export ─────────────────────────────────────────

async function closingReport(
  cabang,
  tanggal
) {
  const info =
    getCabangInfo(cabang);

  const sheetId =
    getSheetId(
      cabang,
      'daily'
    );

  const [data, checkin] =
    await Promise.all([

      getClosingData(
        sheetId,
        tanggal
      ),

      getCheckin(
        info.checkinId
      ),

    ]);

  return buildReport({
    info,
    tanggal,
    data,
    checkin,
    hasKids: info.hasKids,
  });
}

export {
  closingReport,
};