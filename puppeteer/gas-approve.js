import puppeteer from 'puppeteer';
  import cabangMap from '../utils/cabang-map.js';
  import dotenv from 'dotenv';
  import path from 'path';
  import { fileURLToPath } from 'url';
  import fs from 'fs';

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  dotenv.config({ path: path.join(__dirname, '../config/.env') });

  export async function handleApvCommand(cabang, jenis, noMember, sock) {
    console.log(`[PROCESS] Approve : Cabang=${cabang}, Jenis=${jenis}, NoMember=${noMember}`);
  const browser = await puppeteer.launch({
    headless: true,
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


    const page = await browser.newPage();

    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    try {
      console.log('[STEP] Login ke sistem...');
      await page.goto('https://houseofmetamorfit.ampabatech.com/index.php', { waitUntil: 'networkidle2' });
      await page.type('input[name="namapengguna"]', process.env.USERNAME);
      await page.type('input[name="katasandi"]', process.env.PASSWORD);
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      const cabangId = cabangMap[cabang.toLowerCase()];
  console.log(`[INFO] Cabang ID: ${cabangId}`);

      await page.goto(`https://houseofmetamorfit.ampabatech.com/secure_login2.php?id=${cabangId}`, { waitUntil: 'networkidle2' });

      const jenisURLMap = {
        mem: 'approval-member-view',
        memkids: 'approval-member-kids-view',
        pt: 'approval-pt-view&link=reguler',
        ptkids: 'approval-pt-kids-view'
      };
      const path = jenisURLMap[jenis];
      if (!path) throw new Error('Jenis tidak dikenali');

      await page.goto(`https://houseofmetamorfit.ampabatech.com/menu.php?open=${path}`, { waitUntil: 'networkidle2' });

      // Cek apakah command untuk approve all
      if (noMember.toLowerCase() === 'all') {
        return await handleApprovalAll(page, jenis, cabang, browser, path, sock);
      } else {
        return await handleSingleApproval(page, jenis, cabang, noMember, browser, sock);
      }

    } catch (err) {
      console.error('❌ Error handleApvCommand:', err.message);
      if (browser) await browser.close();
      return 'ulangi sekali lagi';
    }
  }

  // Fungsi untuk approve semua member dengan pagination
  async function handleApprovalAll(page, jenis, cabang, browser, path, sock) {
    let hasilApproval = [];
    let totalProcessed = 0;
    let totalApproved = 0;
    let currentPage = 1;

    // Tentukan apakah ini PT atau MEM untuk handling yang berbeda
    const isPT = jenis === 'pt' || jenis === 'ptkids';

    try {
      while (true) {
        console.log(`📄 Processing page ${currentPage}...`);
        
        let skippedMembers = new Set(); // Track member yang sudah di-skip untuk menghindari infinite loop
        
        // PERBAIKAN KRITIS: Selalu ambil data terbaru dari tabel setiap iterasi
        while (true) {
          // Tunggu sampai tabel load dengan benar
          await page.waitForSelector('table tbody tr', { timeout: 10000 });
          
          // Ambil data member terbaru dari halaman saat ini
          const currentMembers = await page.evaluate((isPT) => {
            const rows = Array.from(document.querySelectorAll('table tbody tr'));
            return rows.map((row, index) => {
              const noCell = row.querySelector('td:nth-child(1)');
              const namaCell = row.querySelector('td:nth-child(5)');
              const invoiceCell = row.querySelector('td:nth-child(3)');
              
              // Untuk PT, struktur tabel bisa berbeda
              let paketCell, metodeBayarCell;
              if (isPT) {
                paketCell = row.querySelector('td:nth-child(4)');
                metodeBayarCell = row.querySelector('td:nth-child(6)');
              } else {
                paketCell = row.querySelector('td:nth-child(6)'); // Paket Member kolom ke-6
                metodeBayarCell = row.querySelector('td:nth-child(7)'); // Status Member kolom ke-7
              }
              
              const no = parseInt(noCell?.textContent.trim()) || 0;
              const nama = namaCell?.textContent.trim() || '';
              const invoice = invoiceCell?.textContent.trim() || '';
              
              // Validasi data lebih ketat
              if (no > 0 && nama && invoice && !nama.toLowerCase().includes('no data')) {
                return {
                  no: no,
                  nama: nama,
                  invoice: invoice,
                  paketFromList: paketCell?.textContent.trim() || '',
                  metodeFromList: metodeBayarCell?.textContent.trim() || '',
                  rowIndex: index
                };
              }
              return null;
            }).filter(member => member !== null);
          }, isPT);

          if (currentMembers.length === 0) {
            console.log(`📄 Page ${currentPage} tidak ada data valid lagi, pindah ke page berikutnya...`);
            break; // Keluar dari while loop untuk pindah halaman
          }

          console.log(`📄 Found ${currentMembers.length} valid members on page ${currentPage}`);

          // Cari member pertama yang belum di-skip
          let memberToProcess = null;
          let memberIndex = -1;
          
          for (let i = 0; i < currentMembers.length; i++) {
            const member = currentMembers[i];
            const memberKey = `${member.nama}-${member.invoice}`;
            
            if (!skippedMembers.has(memberKey)) {
              memberToProcess = member;
              memberIndex = i;
              break;
            }
          }

          // Jika semua member sudah di-skip, berarti tidak ada yang bisa diapprove di halaman ini
          if (!memberToProcess) {
            console.log(`📄 Semua member di halaman ${currentPage} sudah diproses/skip, pindah ke halaman berikutnya...`);
            break;
          }
          
          try {
            console.log(`🔍 Processing member: No.${memberToProcess.no} - ${memberToProcess.nama} (index ${memberIndex})`);
            
            // Scroll ke kanan untuk akses tombol View Detail
            await page.evaluate(() => {
              const container = document.querySelector('.table-responsive');
              if (container) container.scrollLeft = container.scrollWidth;
            });
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Klik View Detail berdasarkan index yang tepat
            const viewDetailClicked = await page.evaluate((targetIndex) => {
              const rows = Array.from(document.querySelectorAll('table tbody tr'));
              
              if (rows.length > targetIndex) {
                const targetRow = rows[targetIndex];
                const viewBtn = targetRow.querySelector('a.btn.btn-xs.btn-block.blue.btn-outline.sbold');
                if (viewBtn) {
                  console.log(`Clicking View Detail for row index ${targetIndex}`);
                  viewBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  viewBtn.click();
                  return true;
                }
              }
              
              console.log(`No View Detail button found at row index ${targetIndex}`);
              return false;
            }, memberIndex);

            if (!viewDetailClicked) {
              const memberKey = `${memberToProcess.nama}-${memberToProcess.invoice}`;
              skippedMembers.add(memberKey);
              hasilApproval.push(`❌ No.${memberToProcess.no} - ${memberToProcess.nama}: Tombol View Detail tidak ditemukan`);
              totalProcessed++;
              continue;
            }

            // Tunggu halaman detail load dengan timeout yang cukup
            try {
              await page.waitForNavigation({ 
                waitUntil: 'networkidle2', 
                timeout: isPT ? 60000 : 30000 
              });
            } catch (navError) {
              console.error(`Navigation error for ${memberToProcess.nama}:`, navError.message);
              const memberKey = `${memberToProcess.nama}-${memberToProcess.invoice}`;
              skippedMembers.add(memberKey);
              hasilApproval.push(`❌ No.${memberToProcess.no} - ${memberToProcess.nama}: Gagal load halaman detail`);
              totalProcessed++;
              
              // Kembali ke list page
              await page.goto(`https://houseofmetamorfit.ampabatech.com/menu.php?open=${path}`, { waitUntil: 'networkidle2' });
              if (currentPage > 1) {
                await navigateToPage(page, currentPage, isPT);
              }
              continue;
            }

            // VALIDASI: Pastikan kita di halaman detail yang benar dengan mengecek nama
            const pageValidation = await page.evaluate((expectedName) => {
              const bodyText = document.body.textContent.toLowerCase();
              const expectedNameLower = expectedName.toLowerCase();
              
              // Cek di tabel detail atau elemen yang mengandung nama member
              const nameInTables = Array.from(document.querySelectorAll('table tr')).some(tr => {
                const cellText = tr.textContent.toLowerCase();
                return cellText.includes(expectedNameLower);
              });
              
              return nameInTables;
            }, memberToProcess.nama);

            if (!pageValidation) {
              console.log(`⚠️ Halaman detail tidak sesuai untuk ${memberToProcess.nama}, skip...`);
              const memberKey = `${memberToProcess.nama}-${memberToProcess.invoice}`;
              skippedMembers.add(memberKey);
              hasilApproval.push(`❌ No.${memberToProcess.no} - ${memberToProcess.nama}: Halaman detail tidak sesuai`);
              totalProcessed++;
              
              // Kembali ke list page
              await page.goto(`https://houseofmetamorfit.ampabatech.com/menu.php?open=${path}`, { waitUntil: 'networkidle2' });
              if (currentPage > 1) {
                await navigateToPage(page, currentPage, isPT);
              }
              continue;
            }

            console.log(`✅ Validasi berhasil untuk ${memberToProcess.nama}, melanjutkan approval...`);

            // Proses approval untuk member ini
            const hasil = await processApprovalForMember(page, jenis, memberToProcess.nama, memberToProcess.invoice, browser, cabang, sock, memberToProcess);
            
            if (typeof hasil === 'object' && hasil.approved) {
              // Member berhasil diapprove - data akan hilang dari tabel
              hasilApproval.push(`✅ No.${memberToProcess.no} - ${memberToProcess.nama}: APPROVED - ${hasil.paket} | ${hasil.metode} | ${hasil.harga}`);
              totalApproved++;
              console.log(`🎉 Member ${memberToProcess.nama} berhasil diapprove, data akan hilang dari tabel`);
              // TIDAK menambahkan ke skippedMembers karena sudah diapprove (hilang dari tabel)
            } else if (typeof hasil === 'string') {
              // Member tidak diapprove (ada masalah) - tambahkan ke skip list
              const memberKey = `${memberToProcess.nama}-${memberToProcess.invoice}`;
              skippedMembers.add(memberKey);
              hasilApproval.push(`❌ No.${memberToProcess.no} - ${memberToProcess.nama}: ${hasil}`);
              console.log(`⚠️ Member ${memberToProcess.nama} tidak diapprove: ${hasil}, added to skip list`);
            }
            
            totalProcessed++;

            // Kembali ke halaman list
            await page.goto(`https://houseofmetamorfit.ampabatech.com/menu.php?open=${path}`, { waitUntil: 'networkidle2' });
            
            // Navigasi ke halaman yang sama jika bukan halaman 1
            if (currentPage > 1) {
              await navigateToPage(page, currentPage, isPT);
              await page.waitForSelector('table tbody tr', { timeout: 10000 });
            }

            // Delay sebelum cek member berikutnya
            await new Promise(resolve => setTimeout(resolve, isPT ? 3000 : 2000));

          } catch (err) {
            const memberKey = `${memberToProcess.nama}-${memberToProcess.invoice}`;
            skippedMembers.add(memberKey);
            hasilApproval.push(`❌ No.${memberToProcess.no} - ${memberToProcess.nama}: Error - ${err.message}`);
            totalProcessed++;
            console.error(`Error processing member ${memberToProcess.nama}:`, err);
            
            // Pastikan kembali ke list page jika error
            try {
              await page.goto(`https://houseofmetamorfit.ampabatech.com/menu.php?open=${path}`, { waitUntil: 'networkidle2' });
              if (currentPage > 1) {
                await navigateToPage(page, currentPage, isPT);
              }
            } catch (navErr) {
              console.error('Error returning to list after error:', navErr);
            }
          }
        }

        // Cek apakah ada halaman selanjutnya
        const hasNextPage = await checkNextPage(page, isPT);
        if (!hasNextPage) {
          console.log(`📄 Tidak ada halaman selanjutnya, selesai di page ${currentPage}`);
          break;
        }

        // Pindah ke halaman berikutnya
        currentPage++;
        const navigated = await navigateToPage(page, currentPage, isPT);
        if (!navigated) {
          console.log(`❌ Gagal navigate ke page ${currentPage}, stopping...`);
          break;
        }
        
        // Delay lebih lama untuk PT
        await new Promise(resolve => setTimeout(resolve, isPT ? 5000 : 4000));
      }

      await browser.close();

      // Format hasil
      const summary = `
  🎯 HASIL APPROVAL ALL ${isPT ? 'PT' : 'MEM'} - ${cabang.toUpperCase()}
  📊 Total halaman: ${currentPage}
  📊 Total diproses: ${totalProcessed}
  ✅ Berhasil diapprove: ${totalApproved}
  ❌ Gagal/Skip: ${hasilApproval.filter(h => h.includes('❌')).length}

  📋 Detail:
  ${hasilApproval.join('\n')}
      `;

      return summary;

    } catch (err) {
      await browser.close();
      return `Error saat approval all: ${err.message}`;
    }
  }

  // Fungsi untuk approval single member (tidak berubah)
  async function handleSingleApproval(page, jenis, cabang, noMember, browser, sock) {
    await page.waitForSelector('.filter-option');
    await page.click('.filter-option');

    // Ketik no member (bukan nama lagi, karena no member lebih spesifik)
    await page.waitForSelector('.bs-searchbox input', { visible: true });
    await page.type('.bs-searchbox input', noMember);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // DEBUG: cek apa yang sebenarnya ada di searchbox setelah diketik
    const typedValue = await page.$eval('.bs-searchbox input', el => el.value);
    console.log(`[DEBUG] Nilai searchbox setelah diketik: "${typedValue}"`);

    // Ambil semua item dropdown yang tidak hidden
    const dropdownItems = await page.$$('.dropdown-menu.inner li:not(.hidden) a');
    console.log(`[DEBUG] Jumlah dropdown item yang tidak hidden: ${dropdownItems.length}`);

    // DEBUG: tampilkan isi teks tiap item yang tidak hidden (max 10 biar gak spam)
    const allTexts = [];
    for (const item of dropdownItems.slice(0, 10)) {
      const t = await item.evaluate(el => el.textContent.trim());
      allTexts.push(t);
    }
    console.log(`[DEBUG] Contoh isi dropdown (max 10):`, allTexts);

    let found = false;
    for (const item of dropdownItems) {
      const text = await item.evaluate(el => el.textContent.trim().toLowerCase());
      // CATATAN: ini asumsi teks dropdown mengandung no member (misal format "00123 - BUDI").
      // Kalau ternyata dropdown cuma nampilin nama tanpa nomor, matching ini perlu disesuaikan
      // ke selector/field lain yang benar-benar menampilkan no member.
      if (text.includes(noMember.toLowerCase())) {
        await item.hover();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await item.click();
        found = true;
        break;
      }
    }

    if (!found) {
      console.log(`[DEBUG] Tidak ada match untuk noMember="${noMember.toLowerCase()}"`);
      await browser.close();
      return `gak ada no member ${noMember} di data approval`;
    }

    // Klik search button
    if (jenis === 'mem' || jenis === 'memkids') {
      await page.waitForSelector('button[name="search"]');
      await page.click('button[name="search"]');
    } else {
      await page.waitForSelector('button[name="search2"]');
      await page.click('button[name="search2"]');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Ambil info invoice DAN nama asli member (karena search key sekarang no member, bukan nama)
    const { noInvoice, namaAsli } = await page.evaluate(() => {
      const row = document.querySelector('table tbody tr');
      if (!row) return { noInvoice: '', namaAsli: '' };
      const tds = row.querySelectorAll('td');
      const invoice = tds[2]?.textContent.trim().toUpperCase() || '';
      const nama = tds[4]?.textContent.trim() || ''; // kolom ke-5, sama seperti di handleApprovalAll
      return { noInvoice: invoice, namaAsli: nama };
    });

    if (!namaAsli) {
      await browser.close();
      return `❌ Gagal ambil nama member dari hasil pencarian no ${noMember}`;
    }

    // Scroll kanan untuk View Detail
    await page.evaluate(() => {
      const container = document.querySelector('.table-responsive');
      if (container) container.scrollLeft = container.scrollWidth;
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const viewDetailBtn = await page.$('a.btn.btn-xs.btn-block.blue.btn-outline.sbold');
    if (!viewDetailBtn) {
      await browser.close();
      return '❌ Tombol View Detail tidak ditemukan!';
    }

    await viewDetailBtn.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await viewDetailBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    const hasil = await processApprovalForMember(page, jenis, namaAsli, noInvoice, browser, cabang, sock, null);
    
    await browser.close();
    return hasil;
  }

  // Helper function untuk navigasi ke halaman tertentu (ditingkatkan untuk PT)
  async function navigateToPage(page, pageNumber, isPT = false) {
    try {
      console.log(`🔄 Navigating to page ${pageNumber} (${isPT ? 'PT' : 'MEM'} mode)...`);
      
      // Tunggu sebentar sebelum navigasi
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const navigated = await page.evaluate((targetPage, isPT) => {
        let links = [];
        
        if (isPT) {
          // Untuk PT, coba berbagai selector pagination
          links = [
            ...Array.from(document.querySelectorAll('.pagination a')),
            ...Array.from(document.querySelectorAll('.paging a')),
            ...Array.from(document.querySelectorAll('.page-link')),
            ...Array.from(document.querySelectorAll('a[href*="page="]')),
            ...Array.from(document.querySelectorAll('a[href*="halaman="]')),
            ...Array.from(document.querySelectorAll('div.pagination a')),
            ...Array.from(document.querySelectorAll('ul.pagination a')),
            ...Array.from(document.querySelectorAll('a[onclick*="page"]'))
          ];
        } else {
          links = [
            ...Array.from(document.querySelectorAll('.pagination a')),
            ...Array.from(document.querySelectorAll('.paging a')),
            ...Array.from(document.querySelectorAll('.page-link')),
            ...Array.from(document.querySelectorAll('a[href*="page="]'))
          ];
        }
        
        console.log(`Found ${links.length} pagination links`);
        
        for (const link of links) {
          const text = link.textContent.trim();
          const href = link.getAttribute('href') || '';
          const onclick = link.getAttribute('onclick') || '';
          
          if (text === targetPage.toString() || 
              href.includes(`page=${targetPage}`) || 
              href.includes(`halaman=${targetPage}`) ||
              onclick.includes(`page=${targetPage}`) ||
              onclick.includes(`halaman=${targetPage}`)) {
            
            console.log(`Found matching link for page ${targetPage}`);
            link.click();
            return true;
          }
        }
        return false;
      }, pageNumber, isPT);

      if (navigated) {
        await page.waitForNavigation({ 
          waitUntil: 'networkidle2',
          timeout: isPT ? 60000 : 30000 
        });
        console.log(`✅ Successfully navigated to page ${pageNumber}`);
        return true;
      }

      console.log(`⚠️ Tidak dapat menemukan link untuk halaman ${pageNumber}`);
      return false;
    } catch (err) {
      console.error(`Error navigating to page ${pageNumber}:`, err);
      return false;
    }
  }

  // Helper function untuk cek apakah ada halaman selanjutnya (ditingkatkan untuk PT)
  async function checkNextPage(page, isPT = false) {
    try {
      return await page.evaluate((isPT) => {
        let links = [];
        
        if (isPT) {
          links = [
            ...Array.from(document.querySelectorAll('.pagination a')),
            ...Array.from(document.querySelectorAll('.paging a')),
            ...Array.from(document.querySelectorAll('.page-link')),
            ...Array.from(document.querySelectorAll('a[href*="page="]')),
            ...Array.from(document.querySelectorAll('a[href*="halaman="]')),
            ...Array.from(document.querySelectorAll('div.pagination a')),
            ...Array.from(document.querySelectorAll('ul.pagination a'))
          ];
        } else {
          links = [
            ...Array.from(document.querySelectorAll('.pagination a')),
            ...Array.from(document.querySelectorAll('.paging a')),
            ...Array.from(document.querySelectorAll('.page-link')),
            ...Array.from(document.querySelectorAll('a[href*="page="]'))
          ];
        }
        
        const numbers = [];
        
        for (const link of links) {
          const text = link.textContent.trim();
          const num = parseInt(text);
          if (!isNaN(num)) {
            numbers.push(num);
          }
        }
        
        if (numbers.length === 0) {
          console.log('No page numbers found in pagination');
          return false;
        }
        
        // Cari halaman aktif
        const activeSelectors = [
          '.pagination .active',
          '.paging .active', 
          '.page-link.active',
          '.pagination li.active a',
          '.current'
        ];
        
        let currentPage = 1;
        
        for (const selector of activeSelectors) {
          const activeLinks = document.querySelectorAll(selector);
          for (const activeLink of activeLinks) {
            const text = activeLink.textContent.trim();
            const num = parseInt(text);
            if (!isNaN(num)) {
              currentPage = num;
              break;
            }
          }
          if (currentPage > 1) break;
        }
        
        const maxPage = Math.max(...numbers);
        
        console.log(`Current page: ${currentPage}, Max page: ${maxPage}, Numbers found: [${numbers.join(', ')}]`);
        
        return currentPage < maxPage;
      }, isPT);
    } catch (err) {
      console.error('Error checking next page:', err);
      return false;
    }
  }

  // Fungsi untuk memproses approval member individual (diperbaiki untuk konsistensi data)
  // Fungsi untuk memproses approval member individual (diperbaiki untuk konsistensi data)
  async function processApprovalForMember(page, jenis, namaMember, invoice, browser, cabang, sock, memberDataFromList = null) {
    try {
      console.log(`🔍 Processing approval for: ${namaMember} | Invoice: ${invoice}`);
      
      // VALIDASI TAMBAHAN: Pastikan kita masih di halaman yang benar untuk member ini
      const currentPageValidation = await page.evaluate((expectedName, expectedInvoice) => {
        const bodyText = document.body.textContent;
        const nameExists = bodyText.includes(expectedName);
        const invoiceExists = bodyText.includes(expectedInvoice);
        
        console.log(`Validation - Name: ${nameExists}, Invoice: ${invoiceExists}`);
        console.log(`Expected Name: ${expectedName}, Expected Invoice: ${expectedInvoice}`);
        
        return nameExists && invoiceExists;
      }, namaMember, invoice);

      if (!currentPageValidation) {
        console.log(`⚠️ Halaman tidak sesuai dengan member ${namaMember}, invoice ${invoice}`);
        return `Halaman tidak sesuai - kemungkinan data tercampur`;
      }

      // Aturan invoice
      const invoiceRules = [
        { keyword: '-TF-', reject: true },
        { keyword: '-KIDS-DP-PT-', bp: true, id: false, or: false, ag: false },
        { keyword: '-DP-RN-KIDS-', bp: true, id: false, or: false, ag: false },
        { keyword: '-KIDS-FUN-RN-', bp: true, id: false, or: true, ag: true },
        { keyword: '-KIDS-PT-', bp: true, id: false, or: true, ag: true },
        { keyword: '-DP-KIDS-', bp: true, id: true, or: false, ag: false },
        { keyword: '-DP-RN-', bp: true, id: false, or: false, ag: false },
        { keyword: '-PIF-RN-', bp: true, id: false, or: true, ag: true },
        { keyword: '-DP-PT-', bp: true, id: false, or: false, ag: false },
        { keyword: '-PT-', bp: true, id: false, or: true, ag: true },
        { keyword: '-PIF-UP-', bp: true, id: false, or: true, ag: true },
        { keyword: '-FR-', bp: true, id: false, or: false, ag: false },
        { keyword: '-DP-', bp: true, id: true, or: false, ag: false },
        { keyword: '-PIF-', bp: true, id: true, or: true, ag: true, parq: true },
        { keyword: '-KIDS-FUN-', bp: true, id: true, or: true, ag: true }
      ];

      const rule = invoiceRules.find(r => invoice.includes(r.keyword));

      if (rule?.reject) {
        return `gabisa approve tf member`;
      }

      const butuhDokumen = {
        bp: rule?.bp !== undefined ? rule.bp : true,
        id: rule?.id !== undefined ? rule.id : true,
        or: rule?.or !== undefined ? rule.or : false,
        ag: rule?.ag !== undefined ? rule.ag : false,
        parq: rule?.parq !== undefined ? rule.parq : false
      };

      // Scroll ke bawah pelan maksimal 3x
      await page.evaluate(async () => {
        let pos = 0;
        for (let i = 0; i < 3; i++) {
          window.scrollTo(0, pos);
          pos += 300;
          await new Promise(r => setTimeout(r, 1000));
        }
      });

      // Ambil semua dokumen
      const hasilCek = await page.evaluate(() => {
        const tabelDokumen = Array.from(document.querySelectorAll('table')).find(t =>
          Array.from(t.querySelectorAll('th')).some(th =>
            th.textContent.toLowerCase().includes('kategori')
          )
        );
        if (!tabelDokumen) return { teks: [] };

        const semuaTeks = Array.from(tabelDokumen.querySelectorAll('td')).map(td =>
          td.textContent.trim().toLowerCase()
        );

        return { teks: semuaTeks };
      });

      const teksDokumen = hasilCek.teks;
      const isPT = invoice.includes('-PT-') || invoice.includes('KIDS-PT-');

      const jumlahLainLain = teksDokumen.filter(t => t.includes('lain-lain')).length;

      const dokumenAda = {
        bp: teksDokumen.some(t => t.includes('bukti pembayaran')),
        id: teksDokumen.some(t =>
          ['ktp', 'sim', 'passport', 'kartu pelajar'].some(id => t.includes(id))
        ),
        or: teksDokumen.some(t => t.includes('official receipt')),
        ag: teksDokumen.some(t =>
          t.includes('agreement members') || t.includes('agreement personal trainner')
        ),
        parq: jumlahLainLain >= 3
      };

      // Validasi dokumen
      let dokumenKurang = [];

      if (butuhDokumen.bp && !dokumenAda.bp) dokumenKurang.push('bukti pembayaran');
      if (butuhDokumen.id && !dokumenAda.id) dokumenKurang.push('KTP');
      if (butuhDokumen.or && !dokumenAda.or) dokumenKurang.push('OR');
      if (butuhDokumen.ag && !dokumenAda.ag) {
        dokumenKurang.push(`${isPT ? 'agreement pt' : 'agreement member'}`);
      }
      if (butuhDokumen.parq && !dokumenAda.parq) dokumenKurang.push('silahkan par q blm lengkap');

      // Evaluasi akhir
      if (dokumenKurang.length > 0) {
        return `belum ada ${dokumenKurang.join(', ')}`;
      }

      // PROSES APPROVAL JIKA DOKUMEN LENGKAP
      console.log(`✅ ${namaMember}: Dokumen lengkap, memulai approval...`);

      // Ambil informasi pembayaran dari halaman detail dengan fallback ke data list
      let infoPembayaran = { paket: '', metode: '', harga: '' };
      
      // Coba ambil dari detail page dulu dengan validasi nama untuk memastikan konsistensi
      const infoFromDetail = await page.evaluate((jenis, expectedName) => {
        const rows = Array.from(document.querySelectorAll('table tr'));
        let paket = '';
        let metode = '';
        let harga = '';
        let nameFound = false;

        for (const row of rows) {
          const label = row.children[0]?.innerText.trim().toLowerCase();
          const value = row.children[1]?.innerText.trim();

          // Cek apakah ada nama member di halaman ini
          if (value && value.toLowerCase().includes(expectedName.toLowerCase())) {
            nameFound = true;
          }

          if (jenis === 'pt') {
            if (label.includes('paket trainer')) paket = value;
            if (label.includes('tipe pembayaran')) metode = value;
            if (label.includes('harga paket')) harga = value;
          } else if (jenis === 'ptkids') {
            if (label.includes('paket latihan')) paket = value;
            if (label.includes('tipe pembayaran')) metode = value;
            if (label.includes('harga paket')) harga = value;
          } else {
            if (label.includes('paket member')) paket = value;
            if (label.includes('jenis pembayaran')) metode = value;
            if (label.includes('harga paket')) harga = value;
          }
        }

        return { paket, metode, harga, nameFound };
      }, jenis, namaMember);

      // Validasi tambahan: pastikan nama member ditemukan di halaman detail
      if (!infoFromDetail.nameFound) {
        console.log(`⚠️ Nama ${namaMember} tidak ditemukan di halaman detail, kemungkinan salah halaman`);
        return `Data tidak konsisten - halaman detail tidak sesuai`;
      }

      // Gunakan data dari detail page, atau fallback ke data dari list
      infoPembayaran.paket = infoFromDetail.paket || (memberDataFromList ? memberDataFromList.paketFromList : '');
      infoPembayaran.metode = infoFromDetail.metode || (memberDataFromList ? memberDataFromList.metodeFromList : '');
      infoPembayaran.harga = infoFromDetail.harga || '';
      
      console.log(`📋 Info pembayaran ${namaMember}:`, infoPembayaran);

      // 🔥 BAGIAN YANG DIGANTI: Ambil URL gambar bukti pembayaran DAN agreement SEBELUM klik approve
      let buktiBayarPath = null;
      let agreementPath = null;

      try {
        console.log('🖼️ Mengambil bukti pembayaran dan agreement...');
        
        const gambarUrls = await page.evaluate((expectedName, expectedInvoice, isPT) => {
          const rows = Array.from(document.querySelectorAll('table tbody tr'));
          let buktiBayarUrl = null;
          let agreementUrl = null;
          
          // Cari tabel yang berisi dokumen
          for (const row of rows) {
            const kategoriCell = row.querySelector('td:nth-child(4)');
            const linkCell = row.querySelector('td:nth-child(3)');
            
            if (!kategoriCell || !linkCell) continue;
            
            const kategori = kategoriCell.innerText?.trim().toLowerCase();
            const link = linkCell.querySelector('a')?.getAttribute('href');

            if (!link) continue;

            // VALIDASI TAMBAHAN: Pastikan ini adalah halaman yang benar
            const pageContent = document.body.textContent;
            const nameExists = pageContent.includes(expectedName);
            const invoiceExists = pageContent.includes(expectedInvoice);
            
            if (!nameExists || !invoiceExists) {
              console.log(`❌ Validation failed for document - Name: ${nameExists}, Invoice: ${invoiceExists}`);
              continue;
            }

            // Cari bukti pembayaran
            if (kategori?.includes('bukti pembayaran')) {
              console.log(`Found bukti pembayaran link: ${link} for category: ${kategori}`);
              buktiBayarUrl = link;
            }
            
            // Cari agreement (berbeda untuk PT dan Member)
            const isAgreementMember = kategori?.includes('agreement members');
            const isAgreementPT = kategori?.includes('agreement personal trainner') || kategori?.includes('agreement personal trainer');
            
            if ((isPT && isAgreementPT) || (!isPT && isAgreementMember)) {
              console.log(`Found agreement link: ${link} for category: ${kategori}`);
              agreementUrl = link;
            }
          }
          
          console.log(`✅ URLs found - Bukti Bayar: ${buktiBayarUrl}, Agreement: ${agreementUrl}`);
          return { buktiBayarUrl, agreementUrl };
        }, namaMember, invoice, isPT);

        const baseUrl = page.url().split('/menu')[0];

        // Screenshot Bukti Pembayaran
        if (gambarUrls.buktiBayarUrl) {
          console.log(`📸 Screenshot bukti pembayaran untuk ${namaMember}:`, gambarUrls.buktiBayarUrl);
          
          const newPage = await browser.newPage();
          const fullImgUrl = `${baseUrl}/${gambarUrls.buktiBayarUrl.replace(/^(\.\.\/)+/, '')}`;

          console.log('🌐 Full bukti bayar URL:', fullImgUrl);
          
          try {
            await newPage.goto(fullImgUrl, { waitUntil: 'networkidle2', timeout: 15000 });
            await newPage.waitForSelector('img', { visible: true, timeout: 10000 });

            const buktiImg = await newPage.$('img');
            buktiBayarPath = `./bukti-bayar-${namaMember.replace(/\s+/g, '-')}-${Date.now()}.png`;
            await buktiImg.screenshot({ path: buktiBayarPath });
            
            console.log(`✅ Bukti bayar screenshot saved for ${namaMember}:`, buktiBayarPath);
          } catch (imgError) {
            console.error(`❌ Error loading bukti bayar image for ${namaMember}:`, imgError);
            buktiBayarPath = null;
          } finally {
            await newPage.close();
          }
        } else {
          console.log(`❌ Bukti pembayaran link not found for ${namaMember}`);
        }

        // Screenshot Agreement
        if (gambarUrls.agreementUrl) {
          console.log(`📸 Screenshot agreement untuk ${namaMember}:`, gambarUrls.agreementUrl);
          
          const newPage = await browser.newPage();
          const fullImgUrl = `${baseUrl}/${gambarUrls.agreementUrl.replace(/^(\.\.\/)+/, '')}`;

          console.log('🌐 Full agreement URL:', fullImgUrl);
          
          try {
            await newPage.goto(fullImgUrl, { waitUntil: 'networkidle2', timeout: 15000 });
            await newPage.waitForSelector('img', { visible: true, timeout: 10000 });

            const agreementImg = await newPage.$('img');
            agreementPath = `./agreement-${namaMember.replace(/\s+/g, '-')}-${Date.now()}.png`;
            await agreementImg.screenshot({ path: agreementPath });
            
            console.log(`✅ Agreement screenshot saved for ${namaMember}:`, agreementPath);
          } catch (imgError) {
            console.error(`❌ Error loading agreement image for ${namaMember}:`, imgError);
            agreementPath = null;
          } finally {
            await newPage.close();
          }
        } else {
          console.log(`❌ Agreement link not found for ${namaMember}`);
        }
        
      } catch (imgErr) {
        console.error(`❌ Error capturing images for ${namaMember}:`, imgErr);
      }

      // KLIK APPROVE PERTAMA (approval-xxx-acc.php)
      console.log(`🔄 Clicking first approve button for ${namaMember}...`);
      
      const approveBtn = await page.$('a[href*="approval-member-acc.php"], a[href*="approval-member-kids-acc.php"], a[href*="approval-pt-acc.php"], a[href*="approval-pt-kids-acc.php"]');
      if (!approveBtn) {
        return 'Tombol approve tidak ditemukan!';
      }
      
      await approveBtn.click();
      
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
      } catch (navError) {
        console.error(`Navigation error after first approve for ${namaMember}:`, navError);
        return `Error navigasi setelah approve pertama`;
      }
      
      // VALIDASI: Pastikan kita di halaman approve kedua yang benar
      const secondPageValidation = await page.evaluate((expectedName) => {
        const bodyText = document.body.textContent;
        return bodyText.includes(expectedName);
      }, namaMember);

      if (!secondPageValidation) {
        console.log(`⚠️ Halaman approve kedua tidak sesuai untuk ${namaMember}`);
        return `Error: halaman approve kedua tidak sesuai`;
      }

      // KLIK APPROVE KEDUA (approval-xxx-done.php)
      console.log(`🔄 Clicking second approve button for ${namaMember}...`);
      
      let secondApproveBtn = null;
      
      if (jenis === 'mem') {
        // Untuk membership: approval-member-done.php
        secondApproveBtn = await page.$('a[href*="approval-member-done.php"]');
      } else if (jenis === 'memkids') {
        // Untuk membership kids: approval-member-kids-done.php  
        secondApproveBtn = await page.$('a[href*="approval-member-kids-done.php"]');
      } else if (jenis === 'pt') {
        // Untuk PT: approval-pt-acc.php (kedua kali)
        secondApproveBtn = await page.$('a[href*="approval-pt-acc.php"]');
      } else if (jenis === 'ptkids') {
        // Untuk PT Kids: approval-pt-kids-acc.php (kedua kali)
        secondApproveBtn = await page.$('a[href*="approval-pt-kids-acc.php"]');
      }
      
      if (!secondApproveBtn) {
        // Jika tombol khusus tidak ada, cari tombol "Transaksi Selesai" atau "Transaction Complete"
        const doneBtn = await page.evaluateHandle(() => {
          const allLinks = Array.from(document.querySelectorAll('a'));
          return allLinks.find(a => {
            const text = a.textContent.trim().toLowerCase();
            return text === 'transaksi selesai' || text === 'transaction complete';
          }) || null;
        });
        
        if (doneBtn && await doneBtn.asElement()) {
          await doneBtn.click();
          
          try {
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
          } catch (navError) {
            console.error(`Navigation error after second approve for ${namaMember}:`, navError);
            return `Error navigasi setelah approve kedua`;
          }
        } else {
          return 'Tombol approve kedua tidak ditemukan!';
        }
      } else {
        // Klik tombol approve kedua
        await secondApproveBtn.click();
        
        try {
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
        } catch (navError) {
          console.error(`Navigation error after second approve for ${namaMember}:`, navError);
          return `Error navigasi setelah approve kedua`;
        }
      }

      console.log(`✅ Approval completed for ${namaMember}`);

      // 🔥 BAGIAN YANG DIGANTI: KIRIM KE WHATSAPP ADMIN dengan kedua gambar
      if (sock && (buktiBayarPath || agreementPath)) {
        try {
          
          console.log(`📱 Mengirim gambar ${namaMember} ke admin...`);
          
          const adminNumber = process.env.ADMIN_NUMBER || '6285161706431@s.whatsapp.net';
          
          // Format caption
          const caption = `✅ APPROVE Dari *${cabang.toUpperCase()}*
  👤 Nama : *${namaMember.toUpperCase()}*
  📦 Paket : *${infoPembayaran.paket}*
  💳 Pembayaran : *${infoPembayaran.metode}*
  💰 Harga: *${infoPembayaran.harga}*`;

          // Kirim Bukti Pembayaran
          if (buktiBayarPath && fs.existsSync(buktiBayarPath)) {
            console.log(`📤 Sending bukti bayar for ${namaMember}...`);
    const imageBuffer = fs.readFileSync(buktiBayarPath);
  await sock.sendMessage(adminNumber, {
    image: imageBuffer,
    caption: `📋 BUKTI PEMBAYARAN\n${caption}`
  });
            console.log(`✅ Bukti bayar berhasil dikirim untuk ${namaMember}`);
            
            // Hapus file setelah dikirim
            fs.unlinkSync(buktiBayarPath);
            console.log(`🗑️ Bukti bayar file deleted for ${namaMember}`);
          } else {
            console.log(`❌ Bukti bayar file not found for ${namaMember}:`, buktiBayarPath);
          }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Definisikan agreementType
  const agreementType = isPT ? 'AGREEMENT PERSONAL TRAINER' : 'AGREEMENT MEMBER';

  // Kirim Agreement
  if (agreementPath && fs.existsSync(agreementPath)) {
    console.log(`📤 Sending agreement for ${namaMember}...`);
    const imageBuffer = fs.readFileSync(agreementPath);
    await sock.sendMessage(adminNumber, {
      image: imageBuffer,
      caption: `📋 ${agreementType}\n${caption}`
    });
            console.log(`✅ Agreement berhasil dikirim untuk ${namaMember}`);
            
            // Hapus file setelah dikirim
            fs.unlinkSync(agreementPath);
            console.log(`🗑️ Agreement file deleted for ${namaMember}`);
          } else {
            console.log(`❌ Agreement file not found for ${namaMember}:`, agreementPath);
          }

          // Kirim pesan konfirmasi jika kedua gambar berhasil dikirim
          const buktiBayarSent = buktiBayarPath && !fs.existsSync(buktiBayarPath);
          const agreementSent = agreementPath && !fs.existsSync(agreementPath);
          
          if (buktiBayarSent || agreementSent) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await sock.sendMessage(adminNumber, { 
    text: `✅ Dokumen lengkap untuk *${namaMember.toUpperCase()}* telah dikirim` 
  });
          }
          
        } catch (sendErr) {
          console.error(`❌ Error sending images to admin for ${namaMember}:`, sendErr);
          
          // Cleanup files jika ada error
          try {
            if (buktiBayarPath && require('fs').existsSync(buktiBayarPath)) {
              require('fs').unlinkSync(buktiBayarPath);
            }
            if (agreementPath && require('fs').existsSync(agreementPath)) {
              require('fs').unlinkSync(agreementPath);
            }
          } catch (cleanupErr) {
            console.error(`Error cleanup files for ${namaMember}:`, cleanupErr);
          }
        }
      } else {
        console.log(`⚠️ Tidak ada gambar untuk dikirim atau WhatsApp sock tidak tersedia untuk ${namaMember}`);
        console.log(`- buktiBayarPath: ${buktiBayarPath}`);
        console.log(`- agreementPath: ${agreementPath}`);
        console.log(`- sock: ${!!sock}`);
      }

      // Cek apakah ini single approval (ada dropdown search sebelumnya)
      const isSingleApproval = await page.evaluate(() => {
        return document.querySelector('.bs-searchbox') !== null;
      });

      // Return berbeda untuk single vs all approval
      if (isSingleApproval) {
        return {
          cabangName: cabang.toUpperCase(),
          nama: namaMember.toUpperCase(),
          paket: infoPembayaran.paket,
          metode: infoPembayaran.metode,
          harga: infoPembayaran.harga,
          approved: true
        };
      } else {
        return {
          approved: true,
          paket: infoPembayaran.paket,
          metode: infoPembayaran.metode,
          harga: infoPembayaran.harga
        };
      }

    } catch (err) {
      console.error(`Error processing ${namaMember}:`, err);
      return `Error: ${err.message}`;
    }
  }