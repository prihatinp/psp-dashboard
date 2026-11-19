/**
 * PSP-Dashboard — API kecil di atas Google Sheet.
 * File ini di-push otomatis oleh GitHub Actions (lihat .github/workflows/deploy-gas.yml).
 * Jangan edit di editor Apps Script — edit di GitHub, lalu push.
 *
 * Tab di Google Sheet (dibuat otomatis saat pertama kali dipanggil):
 *   Projects, Members, Effort, Items, Moves, Config
 */

var TABS = {
  Projects: ['id', 'jenis', 'kode', 'nama', 'customer', 'qty', 'status', 'mulai', 'selesai', 'budget', 'saveMP', 'tipe', 'mode', 'tim', 'picLuar', 'catatan', 'updatedAt'],
  Members:  ['nrp', 'nama', 'job', 'skill', 'kapasitas', 'grup', 'peran'],
  Effort:   ['kode', 'nama', 'MECH', 'ELEC', 'AI', 'IOT', 'LAYOUT'],
  Items:    ['id', 'sku', 'nama', 'kategori', 'satuan', 'stok', 'minStok', 'lokasi', 'foto', 'spesifikasi', 'updatedAt'],
  Moves:    ['id', 'waktu', 'itemId', 'jenis', 'qty', 'stokAkhir', 'oleh', 'proyek', 'catatan'],
  Reports:  ['id', 'tanggal', 'nrp', 'nama', 'kode', 'kategori', 'tahap', 'uraian', 'jam', 'status', 'createdAt', 'taskId', 'peminta'],
  Tasks:    ['id', 'minggu', 'nrp', 'kode', 'judul', 'target', 'status', 'oleh', 'catatan', 'updatedAt'],
  Config:   ['key', 'value']
};
var KEY = { Projects: 'id', Members: 'nrp', Effort: 'kode', Items: 'id', Moves: 'id', Reports: 'id', Tasks: 'id', Config: 'key' };
var EDITABLE = ['Projects', 'Members', 'Effort', 'Items', 'Config', 'Tasks'];

function doGet(e)  { return out_(handle_((e && e.parameter) || {})); }
function doPost(e) { return out_(handle_(JSON.parse((e && e.postData && e.postData.contents) || '{}'))); }

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function handle_(p) {
  try {
    setup_();
    switch (p.action) {
      case 'ping':   return { ok: true, sheet: db_().getUrl() };
      case 'all':    return { ok: true, data: readAll_() };
      case 'save':   checkPin_(p); return save_(p.tab, p.row);
      case 'remove': checkPin_(p); return remove_(p.tab, p.id);
      case 'move':   checkPin_(p); return move_(p);
      case 'upload': checkPin_(p); return upload_(p);
      case 'seed':   checkPin_(p); return seed_(p.data || {});
      case 'checkPin': checkPin_(p); return { ok: true };
      case 'report':   checkTeamPin_(p); return report_(p);
      case 'unreport': checkTeamPin_(p); return unreport_(p);
      case 'task':     checkTeamPin_(p); return task_(p.row);
      case 'untask':   checkTeamPin_(p); return untask_(p.id);
      default: return { ok: false, error: 'Action tidak dikenal: ' + p.action };
    }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

/* ---------- Sheet ---------- */
function db_() {
  var props = PropertiesService.getScriptProperties();
  var id = (typeof SETTINGS !== 'undefined' && SETTINGS.SHEET_ID) || props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.create('PSP Dashboard — Database');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function setup_() {
  var cache = CacheService.getScriptCache();
  if (cache.get('setup-v3')) return;
  var ss = db_();
  Object.keys(TABS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, TABS[name].length).setValues([TABS[name]]).setFontWeight('bold').setBackground('#2b3140').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      sh.getRange('A:Z').setNumberFormat('@'); // simpan semua sebagai teks, supaya "2026-07" tidak berubah jadi tanggal
    } else {
      // tambah kolom baru di akhir kalau versi baru punya kolom yang belum ada (data lama tidak berubah)
      var have = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
      TABS[name].forEach(function (k) {
        if (have.indexOf(k) < 0) { var c = have.length + 1; sh.getRange(1, c).setValue(k).setFontWeight('bold').setBackground('#2b3140').setFontColor('#ffffff'); sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@'); have.push(k); }
      });
    }
  });
  var first = ss.getSheetByName('Sheet1');
  if (first && ss.getSheets().length > 1 && first.getLastRow() === 0) ss.deleteSheet(first);
  var cfg = ss.getSheetByName('Config');
  if (cfg.getLastRow() < 2) {
    cfg.getRange(2, 1, 6, 2).setValues([
      ['PIN', ''], ['TARGET_MP', '53'], ['FY_START', '2026-04'],
      ['JAM_EFEKTIF', '0.75'], ['FAKTOR_QTY', '0.5'], ['FAKTOR_VENDOR', '0.3']
    ]);
  }
    var keys = rows_('Config').map(function (r) { return r.key; });
  if (keys.indexOf('PIN_TIM') < 0) cfg.appendRow(['PIN_TIM', '']);
  cache.put('setup-v3', '1', 21600);
}

function rows_(name) {
  var sh = db_().getSheetByName(name);
  var v = sh.getDataRange().getValues();
  var h = v.shift();
  return v.filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    var o = {}; h.forEach(function (k, i) { o[k] = r[i]; }); return o;
  });
}

function readAll_() {
  var d = {};
  ['Projects', 'Members', 'Effort', 'Items'].forEach(function (t) { d[t] = rows_(t); });
  d.Moves = rows_('Moves').slice(-500);
  var now = new Date(), from = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth() - 2, 1), 'Asia/Jakarta', 'yyyy-MM-dd');
  d.Tasks = rows_('Tasks').filter(function (r) { return String(r.minggu) >= from; });
  d.Reports = rows_('Reports').filter(function (r) { return String(r.tanggal) >= from; });
  d.Config = {};
  rows_('Config').forEach(function (r) { if (r.key !== 'PIN' && r.key !== 'PIN_TIM') d.Config[r.key] = r.value; });
  return d;
}

function checkPin_(p) {
  var pin = '';
  rows_('Config').forEach(function (r) { if (r.key === 'PIN') pin = String(r.value).trim(); });
  if (!pin) throw new Error('PIN belum diatur. Isi baris PIN di tab Config pada Google Sheet.');
  if (String(p.pin || '').trim() !== pin) throw new Error('PIN salah');
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function save_(tab, row) {
  if (EDITABLE.indexOf(tab) < 0) throw new Error('Tab tidak bisa diedit: ' + tab);
  if (!row || !row[KEY[tab]]) throw new Error('Data tidak lengkap (' + KEY[tab] + ' kosong)');
  if (tab === 'Config' && row.key === 'PIN') throw new Error('PIN hanya bisa diubah langsung di Google Sheet');
  return withLock_(function () {
    var sh = db_().getSheetByName(tab), h = header_(sh);
    if (h.indexOf('updatedAt') >= 0) row.updatedAt = new Date().toISOString();
    var values = [h.map(function (k) { return row[k] === undefined || row[k] === null ? '' : String(row[k]); })];
    var r = findRow_(sh, row[KEY[tab]]);
    if (r) sh.getRange(r, 1, 1, h.length).setValues(values);
    else sh.appendRow(values[0]);
    return { ok: true, row: row };
  });
}

function header_(sh) { return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String); }

function remove_(tab, id) {
  if (EDITABLE.indexOf(tab) < 0 || tab === 'Config') throw new Error('Tidak bisa hapus di tab ' + tab);
  return withLock_(function () {
    var sh = db_().getSheetByName(tab), r = findRow_(sh, id);
    if (r) sh.deleteRow(r);
    return { ok: true };
  });
}

function findRow_(sh, id) {
  var n = sh.getLastRow();
  if (n < 2) return 0;
  var ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

/* ---------- Laporan harian tim ---------- */
// PIN tim: satu PIN untuk semua anggota, cukup diisi sekali di HP. PIN admin juga diterima.
function checkTeamPin_(p) {
  var pins = {};
  rows_('Config').forEach(function (r) { if (r.key === 'PIN' || r.key === 'PIN_TIM') pins[r.key] = String(r.value).trim(); });
  if (!pins.PIN_TIM && !pins.PIN) throw new Error('PIN tim belum diatur. Isi baris PIN_TIM di tab Config.');
  var v = String(p.pin || '').trim();
  if (!v || (v !== pins.PIN_TIM && v !== pins.PIN)) throw new Error('PIN salah');
}

function report_(p) {
  var list = p.rows || [];
  if (!list.length) throw new Error('Tidak ada data');
  var nrps = rows_('Members').map(function (m) { return String(m.nrp); });
  return withLock_(function () {
    var sh = db_().getSheetByName('Reports'), h = header_(sh), out = [];
    var values = list.map(function (r) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.tanggal))) throw new Error('Tanggal tidak valid');
      if (nrps.indexOf(String(r.nrp)) < 0) throw new Error('NRP tidak terdaftar: ' + r.nrp);
      var jam = Number(r.jam);
      if (!(jam > 0 && jam <= 16)) throw new Error('Jam harus 0,5 sampai 16');
      if (!r.kode) throw new Error('Pekerjaan belum dipilih');
      r.id = 'rp_' + Utilities.getUuid().slice(0, 8); r.createdAt = new Date().toISOString(); r.jam = jam;
      out.push(r);
      return h.map(function (k) { return r[k] === undefined || r[k] === null ? '' : String(r[k]); });
    });
    sh.getRange(sh.getLastRow() + 1, 1, values.length, h.length).setValues(values);
    return { ok: true, rows: out };
  });
}

function unreport_(p) {
  return withLock_(function () {
    var sh = db_().getSheetByName('Reports'), r = findRow_(sh, p.id);
    if (!r) return { ok: true };
    var nrp = String(sh.getRange(r, header_(sh).indexOf('nrp') + 1).getValue());
    if (nrp !== String(p.nrp)) throw new Error('Hanya bisa menghapus laporan sendiri');
    sh.deleteRow(r);
    return { ok: true };
  });
}

/* ---------- Tugas mingguan ---------- */
function task_(row) {
  if (!row || !row.judul || !row.nrp || !row.minggu) throw new Error('Tugas belum lengkap');
  if (!row.id) row.id = 'tk_' + Utilities.getUuid().slice(0, 8);
  return save_('Tasks', row);
}
function untask_(id) {
  return withLock_(function () { var sh = db_().getSheetByName('Tasks'), r = findRow_(sh, id); if (r) sh.deleteRow(r); return { ok: true }; });
}

/* ---------- Gudang: barang masuk / keluar ---------- */
function move_(p) {
  var qty = Number(p.qty);
  if (!(qty > 0)) throw new Error('Jumlah harus lebih dari 0');
  if (p.jenis !== 'IN' && p.jenis !== 'OUT') throw new Error('Jenis harus IN atau OUT');
  if (!String(p.oleh || '').trim()) throw new Error('Nama pengambil/penerima wajib diisi');
  return withLock_(function () {
    var ss = db_(), sh = ss.getSheetByName('Items'), h = header_(sh);
    var r = findRow_(sh, p.itemId);
    if (!r) throw new Error('Barang tidak ditemukan');
    var col = h.indexOf('stok') + 1;
    var stok = Number(sh.getRange(r, col).getValue()) || 0;
    var akhir = p.jenis === 'IN' ? stok + qty : stok - qty;
    if (akhir < 0) throw new Error('Stok tidak cukup (sisa ' + stok + ')');
    sh.getRange(r, col).setValue(String(akhir));
    sh.getRange(r, h.indexOf('updatedAt') + 1).setValue(new Date().toISOString());
    var mv = { id: 'mv_' + Utilities.getUuid().slice(0, 8), waktu: new Date().toISOString(), itemId: p.itemId, jenis: p.jenis,
               qty: qty, stokAkhir: akhir, oleh: p.oleh, proyek: p.proyek || '', catatan: p.catatan || '' };
    ss.getSheetByName('Moves').appendRow(TABS.Moves.map(function (k) { return String(mv[k]); }));
    return { ok: true, stok: akhir, move: mv };
  });
}

/* ---------- Foto barang ke Google Drive ---------- */
function upload_(p) {
  if (!p.base64) throw new Error('File kosong');
  var props = PropertiesService.getScriptProperties();
  var folderId = (typeof SETTINGS !== 'undefined' && SETTINGS.FOTO_FOLDER_ID) || props.getProperty('FOTO_FOLDER');
  var folder = folderId ? DriveApp.getFolderById(folderId) : null;
  if (!folder) { folder = DriveApp.createFolder('PSP Dashboard — Foto Gudang'); props.setProperty('FOTO_FOLDER', folder.getId()); }
  var blob = Utilities.newBlob(Utilities.base64Decode(p.base64), p.mime || 'image/jpeg', p.name || 'foto.jpg');
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800' };
}

/* ---------- Import data awal (hanya jika tab masih kosong) ---------- */
function seed_(d) {
  var done = [];
  [['Projects', d.projects], ['Members', d.members], ['Effort', d.effort]].forEach(function (x) {
    var tab = x[0], list = x[1] || [];
    var sh = db_().getSheetByName(tab);
    if (sh.getLastRow() > 1 || !list.length) return;
    var h = TABS[tab];
    sh.getRange(2, 1, list.length, h.length).setValues(list.map(function (o) {
      return h.map(function (k) { return o[k] === undefined || o[k] === null ? '' : String(o[k]); });
    }));
    done.push(tab + ' (' + list.length + ')');
  });
  return { ok: true, imported: done };
}
