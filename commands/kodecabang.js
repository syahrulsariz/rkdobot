// commands/kodecabang.js
const KODECABANG_TEXT = `╔════ *KODE CABANG* ═════╗
║
║ *CLD* - _Cilandak_
║ *RNJ* - _Pondok Ranji_
║ *HIJ* - _Harapan Indah_
║ *ALS* - _Alam Sutera_
║ *ALE* - _Alegria_
║ *PSR* - _Pasteur Bandung_
║ *SMB* - _Summarecon Bekasi_
║ *BTN* - _Batununggal Bandung_
║ *MRP* - _Merpati Bintaro_
║ *JGK* - _Jagakarsa_
║ *GSW* - _Garden Sawangan_
║ *BGR* - _Bogor_
║ *BTR* - _Bintaro_
║ *CBR* - _Cibubur_
║ *MPG* - _Mampang_
║ *PML* - _Pamulang_
║ *CNR* - _Cinere_
║ *CBN* - _Cibinong_
║ *KRN* - _Kirana Bekasi_
║ *GKB* - _Grand Kota Bintang_
║ *HERS* - _Hers Sawangan_
║ *GWB* - _Grand Wisata_
║ *ICN* - _Icon BSD_
║ *MDR* - _Modernland_
║ *CPT* - _Cipete_
║ *JGA* - _Jogja_
║ *SBY* - _Darmo Surabaya_
║
╚══════ *RKDO BOT V1* ═════╝`;

export default {
  command: ['!kodecabang', 'kodecabang'],
  execute: async (sock, msg) => {
    const from = msg.key.remoteJid;
    await sock.sendMessage(from, { text: KODECABANG_TEXT }, { quoted: msg });
  }
};