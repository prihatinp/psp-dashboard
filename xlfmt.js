/* Isi template Excel PSP (Format Lama & Format Baru) dari data menu Lapor.
   Dipakai di browser (window.PSPX) dan bisa dites di Node (module.exports). */
(function (root) {
  const HARI = ['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Ju', 'Sb'];
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const d0 = s => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
  const stageNo = t => parseInt(String(t || '').trim(), 10) || 0;
  const jamTxt = j => (Math.round(j * 10) / 10).toString().replace('.', ',') + ' j';

  // Salin satu sheet (nilai, style, lebar kolom, tinggi baris, merge, validasi) ke sheet baru
  function cloneSheet(src, dst) {
    src.columns.forEach((c, i) => { const d = dst.getColumn(i + 1); d.width = c.width; d.hidden = c.hidden; });
    src.eachRow({ includeEmpty: true }, (row, r) => {
      const nr = dst.getRow(r); nr.height = row.height;
      row.eachCell({ includeEmpty: true }, (cell, c) => { const t = nr.getCell(c); t.value = cell.value; t.style = JSON.parse(JSON.stringify(cell.style || {})); });
    });
    (src.model.merges || []).forEach(m => { try { dst.mergeCells(m); } catch (e) {} });
    try { dst.dataValidations.model = JSON.parse(JSON.stringify(src.dataValidations.model)); } catch (e) {}
    dst.pageSetup = JSON.parse(JSON.stringify(src.pageSetup || {}));
    dst.views = JSON.parse(JSON.stringify(src.views || []));
  }

  /* FORMAT LAMA: 1 sheet per orang per bulan, matriks pekerjaan × tanggal berisi jam.
     opt: { nama, nrp, ym:'2026-11', rows:[{tanggal,kode,tahap,jam,...}], isProj(kode), projName(kode) } */
  async function lama(ExcelJS, tplBuf, opt) {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(tplBuf);
    const ws = wb.worksheets[0];
    const y = +opt.ym.slice(0, 4), m = +opt.ym.slice(5, 7), nDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
    ws.getCell('A1').value = 'Nama: ' + opt.nama;
    ws.getCell('A3').value = 'NRP  : ' + opt.nrp;
    ws.getCell('C3').value = new Date(Date.UTC(y, m - 1, 1));
    // warnai kolom Sabtu/Minggu sesuai bulan laporan (template asli berwarna untuk bulan lain)
    const wkFill = JSON.parse(JSON.stringify(ws.getCell('D7').fill || { type: 'pattern', pattern: 'solid', fgColor: { theme: 9 } }));
    for (let d = 1; d <= 31; d++) {
      const c = 2 + d, wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(), we = d <= nDays && (wd === 0 || wd === 6);
      for (let r = 5; r <= 52; r++) { const cell = ws.getRow(r).getCell(c); cell.fill = we ? wkFill : { type: 'pattern', pattern: 'none' }; }
      ws.getRow(5).getCell(c).value = d <= nDays ? d : null;
      ws.getRow(6).getCell(c).value = d <= nDays ? HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] : null;
    }
    const add = (r, tgl, jam) => { const cell = ws.getRow(r).getCell(2 + +tgl.slice(8, 10)); cell.value = (Number(cell.value) || 0) + jam; };
    // proyek: urut jam terbanyak, maksimal 6 blok (blok ke-6 menampung sisanya)
    const proj = {}; opt.rows.filter(r => opt.isProj(r.kode)).forEach(r => { proj[r.kode] = (proj[r.kode] || 0) + r.jam; });
    const kodes = Object.keys(proj).sort((a, b) => proj[b] - proj[a]);
    const blocks = kodes.slice(0, 5); const rest = kodes.slice(5); if (kodes.length === 6) { blocks.push(kodes[5]); rest.length = 0; }
    blocks.forEach((k, i) => { ws.getCell('A' + (7 + 6 * i)).value = opt.projName(k) + '\n(' + k + ')'; });
    if (rest.length) ws.getCell('A' + (7 + 6 * 5)).value = 'Proyek lain:\n' + rest.join(', ');
    // non-proyek → baris Aktivitas Lain-lain (label disesuaikan)
    const LAIN = { 'SUPPORT-GENBA': [43, 'Support genba / line'], 'SUPPORT-PICA': [44, 'Support PICA / kualitas'], 'PERBAIKAN': [45, 'Perbaikan / trouble mesin'], 'LAIN': [46, 'Aktivitas lain'],
      'DKM': [47, 'Aktivitas DKM'], 'RUTIN-MEETING': [48, 'Meeting, Circle, 5S, OJT'], 'RUTIN-ADMIN': [49, 'PUK, IMP, lain-lain'], 'TRAINING': [50, 'Training / upgrade skill'] };
    Object.values(LAIN).forEach(([r, l]) => { ws.getCell('B' + r).value = l; });
    opt.rows.forEach(r => {
      if (opt.isProj(r.kode)) {
        let bi = blocks.indexOf(r.kode); if (bi < 0) bi = 5;
        const st = Math.min(6, Math.max(1, stageNo(r.tahap) || 4));
        add(7 + 6 * bi + st - 1, r.tanggal, r.jam);
      } else add((LAIN[r.kode] || LAIN.LAIN)[0], r.tanggal, r.jam);
    });
    return wb.xlsx.writeBuffer();
  }

  /* FORMAT BARU: 1 sheet per hari kerja yang ada laporannya (seperti "30 September").
     Baris dikelompokkan per jenis pekerjaan (maks 4 baris), jam per kelompok ditulis di kolom Note.
     opt: { nama, nrp, dept, rows, planOf(r), dueOf(r), approver } */
  async function baru(ExcelJS, tplBuf, opt) {
    const tpl = new ExcelJS.Workbook(); await tpl.xlsx.load(tplBuf);
    const src = tpl.getWorksheet('Sample') || tpl.worksheets[0];
    const out = new ExcelJS.Workbook();
    const days = [...new Set(opt.rows.map(r => r.tanggal))].sort().reverse();
    days.forEach(tgl => {
      const rs = opt.rows.filter(r => r.tanggal === tgl), dt = d0(tgl);
      const ws = out.addWorksheet((String(dt.getUTCDate()).padStart(2, '0') + ' ' + BULAN[dt.getUTCMonth()]).slice(0, 31));
      cloneSheet(src, ws);
      ws.getCell('F3').value = ': ' + opt.nama;
      ws.getCell('F4').value = ':'; ws.getCell('G4').value = String(opt.nrp);
      ws.getCell('F5').value = ':'; ws.getCell('G5').value = 'PSP';
      if (opt.dept) ws.getCell('V4').value = opt.dept;
      ws.getCell('V5').value = dt; ws.getCell('V5').numFmt = 'dd/mm/yy';
      const tot = rs.reduce((a, r) => a + r.jam, 0), start = 7.5, fin = start + tot + (tot > 4 ? 1 : 0);
      ws.getCell('B9').value = start / 24; ws.getCell('E9').value = fin / 24;
      const groups = []; rs.forEach(r => { const plan = opt.planOf(r), key = plan + '|' + (r.kategori || ''); let g = groups.find(x => x.key === key); if (!g) { g = { key, plan, kat: r.kategori || '', items: [] }; groups.push(g); } g.items.push(r); });
      while (groups.length > 4) { const g = groups.pop(); groups[3].items.push(...g.items); groups[3].plan = groups[3].plan + ' + ' + g.plan; }
      groups.forEach((g, i) => {
        const r = 9 + i, jam = g.items.reduce((a, x) => a + x.jam, 0);
        ws.getCell('H' + r).value = g.plan;
        ws.getCell('P' + r).value = g.kat;
        const due = g.items.map(opt.dueOf).filter(Boolean).sort()[0]; ws.getCell('Q' + r).value = due ? d0(due) : null;
        if (due) ws.getCell('Q' + r).numFmt = 'dd-mmm';
        ws.getCell('R' + r).value = g.items.map(x => (x.uraian || x.label || x.kode) + (g.items.length > 1 ? ' (' + jamTxt(x.jam) + ')' : '')).join('\n');
        const st = g.items.map(x => x.status).filter(Boolean); ws.getCell('Z' + r).value = st.length ? (st.every(s => s === 'CLOSED') ? 'CLOSED' : 'OPEN') : null;
        ws.getCell('AA' + r).value = jamTxt(jam);
      });
      if (opt.approver) ws.getCell('AF15').value = opt.approver;
    });
    if (!days.length) { const ws = out.addWorksheet('Kosong'); ws.getCell('A1').value = 'Tidak ada laporan pada periode ini'; }
    return out.xlsx.writeBuffer();
  }

  const api = { lama, baru, cloneSheet };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PSPX = api;
})(typeof window !== 'undefined' ? window : globalThis);
