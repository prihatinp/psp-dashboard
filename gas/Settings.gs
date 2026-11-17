/**
 * Setting untuk pindah akun (migrasi). Biarkan kosong saat pemakaian normal.
 * Saat pindah ke akun Gmail khusus: isi ID Sheet & folder foto yang lama,
 * lalu push. Script di akun baru akan memakai Sheet & folder yang sama.
 */
var SETTINGS = {
  SHEET_ID: '',        // ID Google Sheet "PSP Dashboard — Database" (bagian di antara /d/ dan /edit pada URL)
  FOTO_FOLDER_ID: ''   // ID folder Drive "PSP Dashboard — Foto Gudang" (bagian setelah /folders/)
};
