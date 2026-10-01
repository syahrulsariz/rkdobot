import puppeteer from 'puppeteer';
import cabangMap from '../utils/cabang-map.js';
import { getAkunCabang, butuhAkunKhusus } from '../utils/cabang-akun.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../config/.env') });

const BASE_URL = 'https://houseofmetamorfit.ampabatech.com';

// Helper: buka browser baru dengan opsi yang sama tiap dipanggil.
// Dipisah jadi function biar gampang panggil berkali-kali (browser #1 utk akun
// default, browser #2 utk akun cabang) tanpa duplikasi opsi launch.
async function bukaBrowserBaru() {
  return await puppeteer.launch({
    headless: false, // DEBUG: biar browser kelihatan jalan
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-extensions',
      '--disable-features=site-per-process',
      '--mute-audio',
    ],
  });
}

// Helper: login, lalu (opsional) pilih cabang lewat secure_login2.php.
// - Akun default (syahrul) itu admin multi-cabang -> HARUS eksplisit pilih
//   cabang lewat secure_login2.php?id=..., makanya pilihCabangViaUrl: true.
// - Akun cabang (mis. bayu) itu single-branch account yang OTOMATIS nempel
//   ke cabangnya sendiri begitu login -> JANGAN dipaksa lewat secure_login2.php,
//   karena endpoint itu ternyata bikin server balikin status aktif jadi akun
//   default lagi (root cause "abis login akun cabang, tiba-tiba jadi syahrul
//   lagi"). Buat akun cabang, cukup diemin di dashboard hasil login langsung.
async function loginDanPilihCabang(page, username, password, cabangId, { pilihCabangViaUrl = true } = {}) {
  console.log(`[INFO] Login sebagai "${username}"${pilihCabangViaUrl ? `, pilih cabang id=${cabangId} via secure_login2.php` : ' (skip secure_login2.php, akun ini otomatis nempel ke cabangnya sendiri)'}`);

  await page.goto(`${BASE_URL}/index.php`, { waitUntil: 'networkidle2' });

  await page.waitForSelector('input[name="namapengguna"]', { timeout: 15000 });

  // Clear dulu field-nya. Kadang server prefill value lama (misal username terakhir
  // yang login) di kolom ini, dan page.type() itu APPEND bukan REPLACE, jadi kalau
  // gak di-clear dulu hasilnya bisa nyambung jadi "syahrulbayu" dll -> login gagal
  await page.evaluate(() => {
    const userInput = document.querySelector('input[name="namapengguna"]');
    const passInput = document.querySelector('input[name="katasandi"]');
    if (userInput) userInput.value = '';
    if (passInput) passInput.value = '';
  });

  await page.type('input[name="namapengguna"]', username, { delay: 30 });
  await page.type('input[name="katasandi"]', password, { delay: 30 });
  await page.keyboard.press('Enter');

  try {
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
  } catch (e) {
    // mungkin gak ada navigation (misal login gagal dan cuma reload form di tempat)
  }

  // Verifikasi: kalau form login masih ada di halaman, berarti login GAGAL
  const loginGagal = await page.evaluate(() => {
    return document.querySelector('input[name="namapengguna"]') !== null;
  });

  if (loginGagal) {
    throw new Error(`Login gagal untuk akun "${username}". Cek lagi username/password-nya lewat !settingakun.`);
  }

  if (!pilihCabangViaUrl) {
    console.log(`⏭️ Skip secure_login2.php buat "${username}", biarin di dashboard hasil login langsung.`);
    return;
  }

  await page.goto(`${BASE_URL}/secure_login2.php?id=${cabangId}`, {
    waitUntil: 'networkidle2'
  });
}

// Helper: cek alert error "Silahkan Checkin Member Terlebih Dahulu" di halaman checkin barcode
async function cekErrorCheckin(page) {
  return await page.evaluate(() => {
    const alert = document.querySelector('.alert-danger');
    if (alert && alert.textContent.includes('Silahkan Checkin Member Terlebih Dahulu')) {
      return alert.textContent.trim();
    }
    return null;
  });
}

// Helper: dari halaman menu.php?open=running-sesi, cari & filter nama member,
// lalu ambil semua link "Check In Barcode" yang match.
async function cariSemuaLinkSesi(page, namaMember) {
  console.log(`\n🔍 Mencari semua sesi untuk "${namaMember}"...`);

  await page.goto(`${BASE_URL}/menu.php?open=running-sesi`, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Klik dropdown filter untuk buka kolom ketik
  await page.waitForSelector('.filter-option', { timeout: 10000 });
  await page.click('.filter-option');
  await page.waitForSelector('.bs-searchbox input', { timeout: 5000 });
  await new Promise(resolve => setTimeout(resolve, 500));

  // Clear input dulu
  await page.evaluate(() => {
    const input = document.querySelector('.bs-searchbox input');
    if (input) input.value = '';
  });

  // Ketik nama member
  await page.type('.bs-searchbox input', namaMember, { delay: 50 });
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Tekan Enter untuk pilih dari dropdown
  await page.keyboard.press('Enter');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Klik tombol pencarian
  await page.click('button[name="search"]');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Scroll horizontal biar kolom "Check In Barcode" muncul
  await page.evaluate(() => {
    const runningTableWrapper = document.querySelector('.dataTables_scrollBody') || document.querySelector('.table-responsive');
    if (runningTableWrapper) {
      runningTableWrapper.scrollLeft = runningTableWrapper.scrollWidth;
    } else {
      window.scrollBy(500, 0);
    }
  });
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Ambil SEMUA link "Check In Barcode" yang match nama ini
  // (bisa lebih dari 1 sesi walau nama membernya sama, misal 2 baris DEWI SUSANTI dengan jumlah sesi beda-beda)
  const semuaLink = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="sesi-pelatih-checkin-barcode"]'));
    return links.map(a => a.href);
  });

  console.log(`📊 Status: Ditemukan ${semuaLink.length} sesi untuk "${namaMember}"`);

  return semuaLink;
}

// Helper: buka tiap link sesi satu-satu di halaman yang sudah login, isi barcode
// (kalau perlu, lewat opsi isiManual), klik simpan, dan hitung yang berhasil di-cutting.
async function submitCuttingSatuSatu(page, semuaLink, { isiManual = null } = {}) {
  let totalCutting = 0;

  for (const link of semuaLink) {
    console.log(`📍 Membuka sesi: ${link}`);
    await page.goto(link, { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 1500));

    const errorAlert = await cekErrorCheckin(page);
    if (errorAlert) {
      console.log('❌ ERROR: Member belum check-in!');
      throw new Error(`Gagal cutting sesi: ${errorAlert}. Member harus check-in terlebih dahulu sebelum sesi bisa di-cutting.`);
    }

    // Dipakai flow akun cabang: kolom barcode kosong dan kode uniknya harus diisi
    // manual pakai kode yang sudah dikumpulkan sebelumnya (via akun default).
    if (isiManual) {
      const barcode = isiManual(link);
      if (!barcode) {
        console.log(`⚠️ Kode unik tidak tersedia untuk sesi ${link}, skip...`);
        continue;
      }
      await page.waitForSelector('input[name="barcode"]', { timeout: 10000 });
      await page.evaluate(() => {
        const input = document.querySelector('input[name="barcode"]');
        if (input) input.value = '';
      });
      await page.type('input[name="barcode"]', barcode, { delay: 50 });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const simpanExists = await page.evaluate(() => {
      const btn = document.querySelector('button[name="simpan"]');
      return btn !== null;
    });

    if (!simpanExists) {
      console.log('⚠️ Tombol simpan tidak ditemukan, skip...');
      continue;
    }

    console.log('💾 Klik simpan...');
    await page.click('button[name="simpan"]');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const errorAfterSave = await cekErrorCheckin(page);
    if (errorAfterSave) {
      console.log('❌ ERROR setelah klik simpan: Member belum check-in!');
      throw new Error(`Gagal cutting sesi: ${errorAfterSave}. Member harus check-in terlebih dahulu sebelum sesi bisa di-cutting.`);
    }

    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    } catch (e) {
      console.log('⚠️ Tidak ada navigation setelah simpan, cek halaman...');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    totalCutting++;
    console.log(`✅ Cutting sesi ke-${totalCutting} berhasil!\n`);

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return totalCutting;
}

export default async function handleReqCuttingSesi(cabang, namaMember) {
  const perluAkunKhusus = butuhAkunKhusus(cabang);
  const akunCabang = perluAkunKhusus ? getAkunCabang(cabang) : null;

  if (perluAkunKhusus && !akunCabang) {
    // Safety net, seharusnya sudah ketolak duluan di commands/cutting.js
    throw new Error(`Akun untuk cabang ${cabang} belum di-setting. Gunakan !settingakun ${cabang} <username> <password>`);
  }

  const cabangId = cabangMap[cabang.toLowerCase()];
  console.log(`[INFO] Cabang ID: ${cabangId}`);

  // ============================================================
  // TAHAP 1 — Browser #1: login akun default (syahrul), cari sesi
  // member, dan (kalau cabang butuh akun khusus) kumpulin dulu kode
  // unik/barcode tiap sesi. Browser ini DITUTUP TOTAL sebelum browser
  // #2 dibuka, jadi gak ada dua akun yang login bareng di browser yang sama.
  // ============================================================
  let daftarSesi = []; // dipakai kalau akunCabang ada: [{ link, barcode }]
  let totalCutting = 0;

  const browserDefault = await bukaBrowserBaru();
  try {
    const page = (await browserDefault.pages())[0] || (await browserDefault.newPage());

    page.on('dialog', async dialog => {
      console.log(`🔔 Dialog muncul: ${dialog.message()}`);
      await dialog.accept();
    });

    console.log('✅ [Browser #1] Login akun default...');
    // PENTING: pakai APP_USERNAME/APP_PASSWORD (bukan USERNAME/PASSWORD polos),
    // karena "USERNAME" adalah environment variable bawaan Windows (otomatis
    // berisi nama akun Windows yang lagi login, mis. "OFFICE") dan dotenv
    // secara default TIDAK menimpa env var yang sudah ada -> kalau pakai nama
    // "USERNAME" polos, isinya bakal ke-override jadi nama akun Windows, bukan
    // username dari file .env.
    await loginDanPilihCabang(page, process.env.SISTEM_USERNAME, process.env.SISTEM_PASSWORD, cabangId, { pilihCabangViaUrl: true });

    const semuaLink = await cariSemuaLinkSesi(page, namaMember);

    if (semuaLink.length === 0) {
      console.log('✅ Tidak ada sesi yang perlu di-cutting');
      return { success: true, totalCutting: 0, namaMember };
    }

    if (!akunCabang) {
      // Cabang gak butuh akun khusus -> langsung cutting di browser #1 ini juga,
      // gak perlu buka browser kedua sama sekali.
      totalCutting = await submitCuttingSatuSatu(page, semuaLink);
    } else {
      // Cabang butuh akun khusus -> di browser #1 ini cuma kumpulin kode unik
      // tiap sesi dulu (akun default lihat kolom barcode udah otomatis keisi).
      console.log(`\n📋 [Browser #1] Mengumpulkan kode unik dari ${semuaLink.length} sesi...`);

      for (const link of semuaLink) {
        console.log(`📍 Membuka sesi (akun default): ${link}`);
        await page.goto(link, { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(resolve => setTimeout(resolve, 1500));

        const errorAlert = await cekErrorCheckin(page);
        if (errorAlert) {
          console.log('❌ ERROR: Member belum check-in!');
          throw new Error(`Gagal cutting sesi: ${errorAlert}. Member harus check-in terlebih dahulu sebelum sesi bisa di-cutting.`);
        }

        const barcodeValue = await page.evaluate(() => {
          const input = document.querySelector('input[name="barcode"]');
          return input ? input.value : null;
        });

        if (!barcodeValue) {
          console.log(`⚠️ Kode unik tidak ditemukan untuk sesi ${link}, skip...`);
          continue;
        }

        console.log(`🔑 Kode unik didapat: ${barcodeValue}`);
        daftarSesi.push({ link, barcode: barcodeValue });
      }

      if (daftarSesi.length === 0) {
        throw new Error('Kode barcode/unik tidak ditemukan di halaman, tidak bisa lanjut cutting.');
      }
    }
  } finally {
    // Tutup browser #1 TOTAL di sini. Kalau cabang butuh akun khusus, ini artinya
    // akun default sudah benar-benar logout/tidak aktif lagi sebelum akun cabang
    // login di browser baru -> gak ada rebutan status login di sisi server.
    await browserDefault.close();
    console.log('🔒 [Browser #1] Ditutup.');
  }

  // ============================================================
  // TAHAP 2 — Browser #2 (BARU): login akun cabang (mis. bayu), lalu
  // submit barcode satu-satu pakai kode unik yang sudah dikumpulkan
  // di Tahap 1. Hanya dijalankan kalau cabang ini butuh akun khusus.
  // ============================================================
  if (akunCabang) {
    console.log(`\n🔐 [Browser #2] Cabang "${cabang}" pakai akun khusus, buka browser baru...`);

    const browserCabang = await bukaBrowserBaru();
    try {
      const cabangPage = (await browserCabang.pages())[0] || (await browserCabang.newPage());

      // Kalau username/password akun cabang salah, sistem munculin alert popup
      // "Nama Pengguna atau Kata Sandi Belum Terdaftar!" -> tangkep di sini
      let akunCabangSalah = null;
      cabangPage.on('dialog', async dialog => {
        const pesanDialog = dialog.message();
        console.log(`🔔 Dialog muncul (akun cabang): ${pesanDialog}`);
        if (pesanDialog.includes('Belum Terdaftar')) {
          akunCabangSalah = pesanDialog;
        }
        await dialog.accept();
      });

      // Akun cabang: JANGAN pilih cabang lewat secure_login2.php, biar gak
      // ke-reset balik ke akun default. Dashboard hasil login langsung sudah
      // otomatis dalam konteks cabangnya sendiri.
      await loginDanPilihCabang(cabangPage, akunCabang.username, akunCabang.password, cabangId, { pilihCabangViaUrl: false });

      if (akunCabangSalah) {
        throw new Error(`Akun cabang ${cabang} salah (${akunCabangSalah}). Silakan setting ulang dengan !settingakun ${cabang} <username> <password>`);
      }

      console.log('✅ [Browser #2] Berhasil login akun khusus cabang...');

      const linkList = daftarSesi.map(s => s.link);
      const barcodeByLink = new Map(daftarSesi.map(s => [s.link, s.barcode]));

      totalCutting = await submitCuttingSatuSatu(cabangPage, linkList, {
        isiManual: (link) => barcodeByLink.get(link)
      });
    } finally {
      await browserCabang.close();
      console.log('🔒 [Browser #2] Ditutup.');
    }
  }

  console.log(`\n🎉 SELESAI! Total ${totalCutting} sesi berhasil di-cutting untuk ${namaMember}!`);

  return { success: true, totalCutting, namaMember };
}