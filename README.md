# PSP-Dashboard

Aplikasi sederhana untuk section PSP:

- **Dashboard**: KPI Reduce MP, request Global, beban kerja vs kemampuan tim, hal yang perlu perhatian
- **Proyek**: Internal + Support Global dalam satu daftar, dengan timeline
- **Loading MP**: heatmap beban tiap member dan kekurangan orang per skill
- **Gudang**: katalog barang ala marketplace (foto, stok, lokasi rak), ambil/masuk barang tercatat otomatis

Tampilan: GitHub Pages. Database: Google Sheet. Penghubung: 1 file Apps Script (`gas/Code.gs`).
**Tidak ada copy-paste ke editor Apps Script.** Edit di GitHub → push → otomatis ter-deploy.

```
index.html  style.css  app.js   ← tampilan (GitHub Pages)
manifest.webmanifest  sw.js  img/icon-*.png ← supaya bisa dipasang di HP
config.js                       ← isi API_URL di sini
data/seed.json                  ← data awal (proyek, member, standar effort)
gas/Code.gs  gas/appsscript.json← backend, di-push otomatis oleh GitHub Actions
.github/workflows/deploy-gas.yml
```

## Pasang di HP (seperti aplikasi)

Aplikasi ini adalah PWA: bisa dipasang ke layar utama HP, terbuka layar penuh tanpa address bar, dan tetap bisa dibuka saat sinyal hilang (menampilkan data terakhir).

- **Android (Chrome):** buka alamat aplikasi → tombol **Pasang di HP** di atas, atau menu ⋮ → **Install app / Add to Home screen**
- **iPhone (Safari):** tombol Share → **Add to Home Screen**

Update tampilan cukup push ke GitHub. HP otomatis memakai versi terbaru saat aplikasi dibuka dalam keadaan online.

## Coba dulu tanpa setup (mode demo)

Aktifkan GitHub Pages (Settings → Pages → Branch `main`, folder `/root`). Selama `API_URL` di `config.js` kosong, aplikasi jalan dengan data contoh dan perubahan tidak tersimpan.

## Setup sekali saja (±20 menit)

Setelah ini selesai, semua perubahan cukup **push**.

**1. Aktifkan Apps Script API**
Buka https://script.google.com/home/usersettings → *Google Apps Script API* → **On**.

**2. Ambil token clasp** (sekali saja, dari laptop pribadi atau GitHub Codespaces — tidak perlu laptop kantor)

*Laptop pribadi (ada Node.js):*
```
npx @google/clasp@2.4.2 login
```
Browser terbuka → pilih akun Google → Allow. Lalu buka file `C:\Users\<nama>\.clasprc.json` dan copy **seluruh isinya**.

*GitHub Codespaces (dari browser):* repo → tombol **Code** → tab **Codespaces** → **Create codespace**. Di terminal:
```
npx @google/clasp@2.4.2 login
```
Buka link yang muncul, pilih akun → Allow. Browser akan pindah ke alamat `http://localhost:xxxx/?code=...` yang gagal dibuka — itu normal. Copy alamat lengkap itu, buka terminal **kedua** di Codespaces, lalu jalankan:
```
curl "TEMPEL_ALAMAT_TADI"
```
Terminal pertama akan menulis "Authorization successful". Lalu `cat ~/.clasprc.json` dan copy seluruh isinya. Setelah itu codespace boleh dihapus.

**3. Buat project Apps Script kosong**
https://script.google.com → *New project* → beri nama `PSP Dashboard API` → ⚙ *Project Settings* → copy **Script ID**.

**4. Isi GitHub Secrets** (repo → Settings → Secrets and variables → Actions → New repository secret)
| Name | Isi |
|---|---|
| `CLASPRC_JSON` | isi file `.clasprc.json` dari langkah 2 |
| `SCRIPT_ID` | Script ID dari langkah 3 |

**5. Jalankan deploy pertama**
Tab *Actions* → *Deploy Apps Script* → *Run workflow*. Setelah hijau, buka ringkasan run-nya. Di situ tertulis:
- `DEPLOYMENT_ID` → simpan sebagai secret ketiga **`DEPLOYMENT_ID`** (supaya URL tidak berubah di deploy berikutnya)
- `API_URL` → buka URL ini sekali di browser dalam keadaan login Google, klik **Allow**

**6. Sambungkan tampilan ke database**
Edit `config.js`, isi `API_URL` dengan URL dari langkah 5, lalu commit.
Buka aplikasi. Database masih kosong, jadi akan muncul tombol **Import data awal**.

**7. Atur PIN (2 macam)**
Saat pertama dipanggil, Apps Script membuat Google Sheet **"PSP Dashboard — Database"** di Drive Anda. Buka tab `Config`:
- `PIN` = PIN admin, untuk mengubah proyek, gudang, dan data master.
- `PIN_TIM` = PIN untuk semua anggota tim, khusus untuk mengisi laporan harian (menu **Lapor**). Cukup dimasukkan sekali di HP masing-masing.

Tanpa PIN, aplikasi hanya bisa dibaca.

## Detail proyek & Gantt tahapan

Klik satu proyek di menu Proyek → halaman detail:
- Progress aktual vs seharusnya hari ini (on track / terlambat)
- Gantt per tahap: bar plan (biru muda) dan aktual (biru, hijau jika selesai), garis merah = hari ini
- Jam kerja dari menu Lapor per tahap dan per orang, aktivitas terakhir
- **Edit tahapan**: ubah tanggal plan/aktual, progress %, tambah/hapus tahap. Proyek yang belum punya tahapan mendapat jadwal usulan otomatis (6 tahap) dari bulan mulai–selesai.

Data tahapan disimpan di tab `Stages`.

## Daily Job

Ringkasan → tombol **📋 Daily Job hari ini** → teks siap kirim (bisa diedit) → **Salin** atau **Buka WhatsApp**.

## Tugas mingguan (menu Tugas)

- Setiap orang boleh membuat tugas untuk dirinya sendiri.
- **Koordinator** (kolom `peran` = `Koordinator` di tab Members) bisa membuat tugas untuk semua anggota. **Leader** (`peran` = `Leader`) untuk anggota satu `grup` (`Internal` / `Global`).
- Status diketuk bergantian: Rencana → Proses → Selesai. Tugas yang belum selesai bisa dibawa ke minggu berikutnya dengan satu tombol.
- Di menu Lapor, tugas minggu ini muncul paling atas; jam yang dilaporkan tercatat ke tugas itu.
- Ringkasan menampilkan tugas lewat target dan siapa yang belum punya rencana minggu ini.

Pembagian awal: Pak Eko = Koordinator (Internal), Pak Wardiyono = Leader Global, lainnya Member Internal. Ubah kapan saja di tab Members (kolom `grup` dan `peran`).

## Laporan harian tim (menu Lapor)

Pengganti format laporan Excel. Dibuat supaya bisa diisi dari HP dalam ±30 detik:
1. Pertama kali: pilih nama sendiri dan masukkan PIN tim (HP mengingat keduanya).
2. Setiap hari: **+ Tambah pekerjaan** → ketuk proyek → ketuk jam → (tahap) → Simpan. Proyek yang sering dikerjakan muncul paling atas.
3. Kalau pekerjaannya sama dengan kemarin: satu tombol **Sama seperti kemarin**.

Admin: buka **Laporan tim** di bawah menu Lapor:
- **Harian** → tombol **Salin untuk WA / email**: teks Daily Job siap tempel untuk atasan (⚡ = pekerjaan insidentil, lengkap dengan peminta).
- **Mingguan** → **Download paket mingguan (ZIP)**: 1 folder berisi `00_REKAP` + 1 file Excel per orang. Extract langsung ke folder server.
- **Bulanan** → Excel rekap WLA sebulan.

Pekerjaan insidentil (Support genba, Support PICA, Perbaikan) dicatat terpisah lengkap dengan **siapa yang meminta**, supaya terlihat berapa persen waktu tim terpakai di luar rencana proyek.

Aplikasi yang dipasang di HP langsung terbuka di menu Lapor. Di Ringkasan, nama yang belum lapor hari kerja terakhir muncul di "Perlu perhatian".

## Sehari-hari

| Mau apa | Caranya |
|---|---|
| Update proyek, ambil/masuk barang | Lewat aplikasi (minta PIN) |
| Tambah/ubah member, skill, kapasitas | Langsung di Google Sheet tab `Members` |
| Ubah standar effort per tipe proyek | Tab `Effort` |
| Ubah target MP, jam efektif, faktor vendor | Tab `Config` |
| Ubah tampilan / fitur | Edit file di GitHub → push. Kalau yang diubah folder `gas/`, backend ikut ter-deploy otomatis |

## Format data di Sheet

- `tim` di tab Projects: `NRP:persen` dipisah koma, contoh `943:20, 1195:30`
- `skill` di tab Members: `MECH`, `ELEC`, `AI`, `IOT`, `LAYOUT` (boleh dua, contoh `ELEC,IOT` = 50/50). `KOORD`/`ADMIN` tidak dihitung sebagai tenaga eksekusi
- `mulai` / `selesai`: `YYYY-MM`, contoh `2026-11`
- `tipe`: kode di tab Effort (A–L). `mode`: `In-house` atau `Vendor`

## Catatan

- Foto barang disimpan di folder Drive **"PSP Dashboard — Foto Gudang"** dengan akses "siapa saja yang punya link bisa melihat". Jika akun Google kantor melarang sharing ke luar, pakai akun Google pribadi/khusus untuk database.
- Standar effort per tipe proyek di tab Effort adalah estimasi awal. Kalibrasi dengan data proyek PSP yang sudah selesai.

## Pindah ke akun Gmail khusus (migrasi)

Sementara aplikasi boleh jalan di akun pribadi. Saat akun khusus (mis. `pspcontrol.mapin@gmail.com`) sudah siap:

1. **Pindahkan kepemilikan file, jangan di-copy.** Di Google Drive akun pribadi, share Sheet "PSP Dashboard — Database" dan folder "PSP Dashboard — Foto Gudang" ke akun khusus sebagai Editor. Lalu klik Share → ubah peran akun khusus jadi **Owner** (transfer ownership) dan terima undangannya dari akun khusus. ID file tidak berubah, jadi foto lama tetap tampil.
2. Di `gas/Settings.gs`, isi `SHEET_ID` dan `FOTO_FOLDER_ID` dengan ID Sheet dan folder tadi.
3. Ulangi README langkah 1–3 pakai akun khusus (Apps Script API, `clasp login`, project Apps Script baru).
4. Ganti secret `CLASPRC_JSON` dan `SCRIPT_ID`, **hapus** secret `DEPLOYMENT_ID`, lalu push (atau Run workflow).
5. Ambil `DEPLOYMENT_ID` dan `API_URL` baru dari ringkasan run. Simpan `DEPLOYMENT_ID`, buka `API_URL` sekali lalu klik Allow, lalu ganti `API_URL` di `config.js` dan push.

Data proyek, member, barang, riwayat, dan PIN ikut pindah karena Sheet-nya sama.
