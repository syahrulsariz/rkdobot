// utils/extendPayment.js
import puppeteer from 'puppeteer';

const TOPUP_URL = 'https://topup.ebelanja.id/dana';
const TOPUP_DANA_NUMBER = '089677289925'; // nomor DANA tujuan top-up (punya admin/bot)
const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000; // 5 menit
const POLL_INTERVAL_MS = 10 * 1000; // cek tiap 10 detik

const UA_STRING =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Lock sederhana biar 1 user gak bisa spam !extend bersamaan
const processingLocks = new Set();

export function isProcessing(phone) {
  return processingLocks.has(phone);
}

export function lockProcessing(phone) {
  processingLocks.add(phone);
}

export function unlockProcessing(phone) {
  processingLocks.delete(phone);
}

/**
 * Jalanin seluruh alur di topup.ebelanja.id/dana:
 *  1. Isi nomor HP
 *  2. Pilih nominal (dicocokkan via label "Xk", mis. "10k")
 *  3. Pilih metode pembayaran QRIS
 *  4. Klik "Beli sekarang"
 *  5. Konfirmasi di popup "Detail pesanan"
 *  6. Ambil QR code + total pembayaran aktual (bisa beda dari harga di card
 *     karena situs kelihatannya nambahin markup dinamis per transaksi)
 *
 * @param {string} nominalLabel - label nominal di situs, mis. '10k', '25k'
 * Return { totalAmount, transactionId, qrBuffer, checkStatus, close }
 * `checkStatus()` -> polling, resolve 'success' | 'timeout' | 'failed'
 */
export async function initiateTopup(nominalLabel) {
  const browser = await puppeteer.launch({
    headless: 'new', // GUI biar bisa diliat langsung waktu debug
    defaultViewport: { width: 1366, height: 768 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-blink-features=AutomationControlled',
    ],
    protocolTimeout: 6 * 60 * 1000,
  });

  try {
    const page = await browser.newPage();

    // Auto-accept native dialog (alert/confirm) biar gak hang kalau situs pakai itu
    page.on('dialog', async (dialog) => {
      console.log('   ⚠️  Dialog muncul:', dialog.message());
      await dialog.accept().catch(() => {});
    });

    // Samarkan sinyal automation biar gak gampang ke-detect anti-bot
    await page.setUserAgent(UA_STRING);
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en-US'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    });

    await page.goto(TOPUP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 1) Isi nomor HP
    await page.waitForSelector('input[name="user_id"]', { timeout: 15000 });
    await page.click('input[name="user_id"]');
    await page.type('input[name="user_id"]', TOPUP_DANA_NUMBER, { delay: 30 });

    // 2) Pilih nominal — cari card yang <span>-nya persis sama dengan label (mis. "10k")
    //    lalu klik container card-nya (bukan cuma span-nya). Grid awal cuma nampilin
    //    nominal sampai 70k — kalau nominalnya di atas itu, harus klik "Muat Lainnya"
    //    dulu (bisa berkali-kali) sampai nominalnya kebuka di grid.
    const clickNominalCard = async (label) =>
      page.evaluate((lbl) => {
        const spans = Array.from(document.querySelectorAll('span'));
        const target = spans.find((s) => s.textContent.trim() === lbl);
        if (!target) return false;

        // Naik ke container card terdekat yang punya beberapa child block (bukan cuma span itu sendiri)
        let card = target.closest('button, [role="button"]');
        if (!card) {
          // Fallback: card di sini berupa <div> polos yang keseluruhannya clickable
          card = target.parentElement?.parentElement || target.parentElement;
        }
        if (!card) return false;
        card.click();
        return true;
      }, label);

    const clickMuatLainnya = async () =>
      page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent.trim() === 'Muat Lainnya'
        );
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });

    let nominalClicked = await clickNominalCard(nominalLabel);

    const MAX_LOAD_MORE_ATTEMPTS = 10; // jaga-jaga biar gak infinite loop kalau labelnya emang salah/gak ada
    let loadMoreAttempts = 0;

    while (!nominalClicked && loadMoreAttempts < MAX_LOAD_MORE_ATTEMPTS) {
      const clickedMore = await clickMuatLainnya();
      if (!clickedMore) break; // tombol "Muat Lainnya" udah gak ada -> nominalnya emang gak tersedia

      loadMoreAttempts += 1;
      await new Promise((r) => setTimeout(r, 500)); // tunggu grid nominal baru ke-render
      nominalClicked = await clickNominalCard(nominalLabel);
    }

    if (!nominalClicked) {
      throw new Error(
        `Nominal "${nominalLabel}" tidak ditemukan di grid nominal topup.ebelanja.id ` +
        `(sudah coba klik "Muat Lainnya" ${loadMoreAttempts}x).`
      );
    }

    await new Promise((r) => setTimeout(r, 600));

    // 3) Pilih metode pembayaran QRIS — cari <img alt="QRIS"> lalu klik <button> pembungkusnya
    const qrisClicked = await page.evaluate(() => {
      const img = document.querySelector('img[alt="QRIS"]');
      const btn = img ? img.closest('button') : null;
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!qrisClicked) {
      throw new Error('Tombol metode pembayaran QRIS (img[alt="QRIS"]) tidak ditemukan.');
    }

    await new Promise((r) => setTimeout(r, 600));

    // 4) Klik "Beli sekarang"
    const buyClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[type="submit"]'));
      const btn = btns.find((b) => b.textContent.includes('Beli sekarang'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!buyClicked) {
      const currentUrl = page.url();
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500)).catch(() => '');
      throw new Error(
        `Tombol "Beli sekarang" tidak ditemukan. URL: ${currentUrl}\nCuplikan halaman:\n${bodyText}`
      );
    }

    // 5) Tunggu popup "Detail pesanan" muncul, lalu klik "Konfirmasi"
    try {
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('button')).some((b) => b.textContent.trim() === 'Konfirmasi'),
        { timeout: 15000 }
      );
    } catch (e) {
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500)).catch(() => '');
      throw new Error(`Popup "Detail pesanan" (tombol Konfirmasi) tidak muncul.\nCuplikan halaman:\n${bodyText}`);
    }

    const confirmClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Konfirmasi');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!confirmClicked) {
      throw new Error('Gagal klik tombol "Konfirmasi" di popup detail pesanan.');
    }

    // 6) Tunggu QR code muncul DAN beneran selesai kemuat.
    //    PENTING: jangan andalkan img[alt="qris"] doang buat nyari elemennya —
    //    ternyata ada gambar LAIN di container yang sama (logo/wordmark "QRIS"
    //    buat label metode pembayaran) yang malah kepilih, jadi yang ke-screenshot
    //    tulisan logo QRIS-nya, bukan QR code aslinya. Di sini kita anchor ke teks
    //    unik "Pindai kode QR" yang cuma ada persis di container QR code beneran,
    //    baru ambil <img> yang ada DI DALAM container itu.
    function findQrImgInPage() {
      const divs = Array.from(document.querySelectorAll('div'));
      const container = divs.find((d) =>
        Array.from(d.childNodes).some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim() === 'Pindai kode QR'
        )
      );
      return container ? container.querySelector('img') : null;
    }

    try {
      await page.waitForFunction(
        () => {
          const divs = Array.from(document.querySelectorAll('div'));
          const container = divs.find((d) =>
            Array.from(d.childNodes).some(
              (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim() === 'Pindai kode QR'
            )
          );
          const img = container ? container.querySelector('img') : null;
          return !!img && !!img.src && img.complete && img.naturalWidth > 0;
        },
        { timeout: 20000, polling: 200 }
      );
    } catch (e) {
      const currentUrl = page.url();
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500)).catch(() => '');
      throw new Error(
        `QR code (container "Pindai kode QR") tidak muncul/tidak selesai kemuat dalam 20 detik. ` +
        `URL: ${currentUrl}\nCuplikan halaman:\n${bodyText}`
      );
    }

    const qrHandle = await page.evaluateHandle(findQrImgInPage);

    const qrElement = qrHandle.asElement();
    if (!qrElement) {
      throw new Error('Gagal ambil elemen QR code (container "Pindai kode QR" + <img> di dalamnya tidak ketemu).');
    }

    // Screenshot elemen langsung = ambil piksel yang beneran udah dirender browser,
    // jadi gak perlu fetch manual (yang tadinya kena masalah CORS) dan gak
    // ketuker sama gambar lain di halaman.
    const qrBuffer = await qrElement.screenshot({ type: 'png' });


    // 7) Ambil total pembayaran aktual & transaction ID dari halaman QR.
    //    PENTING: ini SPA, elemen card nominal yang lama masih nempel di DOM
    //    (cuma ketutup modal), jadi cari sembarang "div Rp... font-bold" itu
    //    BAHAYA — bisa kejaring ke card nominal lama (yang textnya gabungan
    //    "Rp 10.180" + tooltip "Share via WA"). Di sini kita anchor spesifik
    //    dari heading "Total nominal bayar" yang cuma ada di halaman QR.
    const { totalAmount, transactionId } = await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll('h4')).find(
        (h) => h.textContent.trim() === 'Total nominal bayar'
      );

      let totalAmount = null;
      if (heading) {
        // Kotak nominal ada tepat setelah heading-nya, di dalam parent yang sama
        const container = heading.parentElement;
        const amountEl = container
          ? Array.from(container.querySelectorAll('div')).find((d) => {
              const t = d.textContent.trim();
              return /^Rp\s?[\d.,]+$/.test(t);
            })
          : null;
        totalAmount = amountEl ? amountEl.textContent.trim() : null;
      }

      const bodyText = document.body.innerText;
      const match = bodyText.match(/Transaction ID:\s*([\w-]+)/i);

      return {
        totalAmount,
        transactionId: match ? match[1] : null,
      };
    });

    return {
      totalAmount,
      transactionId,
      qrBuffer,
      checkStatus: () => pollPaymentStatus(page),
      close: () => browser.close(),
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

/**
 * Halaman QR di topup.ebelanja.id kelihatannya SPA (nggak ada navigasi/redirect
 * ke halaman status terpisah kayak hotelmurah.com dulu). Jadi di sini kita cuma
 * ngecek ulang isi halaman yang sama tiap POLL_INTERVAL_MS, nunggu modal
 * "Pembayaran Berhasil!" muncul.
 *
 * CATATAN: teks buat status GAGAL/EXPIRED belum diverifikasi (belum ada contoh
 * HTML-nya) — kalau QRIS-nya expired beneran, sesuaikan pattern regex di bawah.
 */
async function pollPaymentStatus(page) {
  const startTime = Date.now();

  while (Date.now() - startTime < PAYMENT_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    try {
      const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');

      if (/Pembayaran Berhasil/i.test(bodyText)) {
        return 'success';
      }

      // Heuristik longgar buat status gagal/expired — sesuaikan kalau ternyata beda
      if (/waktu\s*habis|kadaluarsa|dibatalkan|gagal/i.test(bodyText)) {
        return 'failed';
      }
    } catch (err) {
      console.log('   ⚠️  Polling error:', err.message);
      // ignore, coba lagi di iterasi berikutnya
    }
  }

  return 'timeout';
}