/* PSP-Dashboard — frontend (GitHub Pages). Data: Google Sheet lewat Apps Script (config.js). */
(() => {
const API = ((window.PSP_CONFIG || {}).API_URL || '').trim();
const DEMO = !API;
const ST = {
  Internal: ['Plan', 'Propose', 'PR', 'PO', 'Waiting Arrival', 'Install/Trial', 'Masspro', 'Closed', 'Hold'],
  Global: ['RFQ', 'Quotation', 'PO', 'Design', 'Fabrication', 'Delivery', 'Commissioning', 'Completed', 'Lost']
};
const DONE = ['Masspro', 'Closed', 'Completed'], OFF = ['Hold', 'Lost'], EARLY = ['Plan', 'Propose', 'RFQ', 'Quotation'];
const SK = { MECH: 'Mekanik', ELEC: 'Elektrik/PLC', AI: 'AI/Software', IOT: 'IoT/AGV', LAYOUT: 'Layout/Asset' };
const MLBL = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const S = { P: [], M: [], E: [], I: [], MV: [], R: [], T: [], ST: [], cfg: {}, f: { jenis: 'all', q: '', status: '' }, g: { q: '', cat: '' } };
const now = new Date(), CUR = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d });
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const ym = v => { const s = String(v || ''); const m = s.match(/^(\d{4})-(\d{2})/); if (m) return m[1] + '-' + m[2]; const d = new Date(s); return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const mName = m => m ? MLBL[+m.slice(5, 7) - 1] + " '" + m.slice(2, 4) : '—';
const cfg = (k, d) => S.cfg[k] !== undefined && S.cfg[k] !== '' ? num(S.cfg[k]) : d;
function months() { const s = String(S.cfg.FY_START || '2026-04'); let y = +s.slice(0, 4), m = +s.slice(5, 7); const a = []; for (let i = 0; i < 12; i++) { a.push(y + '-' + String(m).padStart(2, '0')); if (++m > 12) { m = 1; y++; } } return a; }
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }
const tone = s => DONE.includes(s) ? 'ok' : s === 'Lost' ? 'bad' : s === 'Hold' ? '' : EARLY.includes(s) ? '' : 'info';
const active = (p, m) => !OFF.includes(p.status) && p.mulai && p.selesai && p.mulai <= m && m <= p.selesai;
const late = p => p.selesai && p.selesai < CUR && !DONE.includes(p.status) && !OFF.includes(p.status);
const team = p => String(p.tim || '').split(/[,;]/).map(x => x.trim()).filter(Boolean).map(x => { const [n, pct] = x.split(':'); return { nrp: n.trim(), pct: num(pct || 20) }; });
const member = n => S.M.find(m => String(m.nrp) === String(n));
const short = n => { const p = String(n || '').split(' '); return p[0] === 'Muhammad' ? p[1] : p[0]; };

/* ---------- data ---------- */
async function api(action, payload = {}) {
  if (DEMO) return demoApi(action, payload);
  const res = action === 'all'
    ? await fetch(API + '?action=all', { redirect: 'follow' })
    : await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, pin: getPin(), ...payload }), redirect: 'follow' });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'Gagal');
  return j;
}
async function load() {
  try {
    let d;
    if (DEMO) {
      const s = await (await fetch('data/seed.json')).json();
      d = { Projects: s.projects, Members: s.members, Effort: s.effort, Items: s.demoItems, Moves: [], Config: s.config };
      $('#demo').hidden = false;
    } else {
      try { d = (await api('all')).data; try { localStorage.setItem('psp.cache', JSON.stringify({ t: Date.now(), d })); } catch (x) {} }
      catch (err) { // offline: pakai data terakhir yang tersimpan di HP
        let c = null; try { c = JSON.parse(localStorage.getItem('psp.cache') || 'null'); } catch (x) {}
        if (!c) throw err;
        d = c.d; S.offline = new Date(c.t);
      }
    }
    S.P = (d.Projects || []).map(p => ({ ...p, qty: num(p.qty) || 1, budget: num(p.budget), saveMP: num(p.saveMP), mulai: ym(p.mulai), selesai: ym(p.selesai) }));
    S.M = (d.Members || []).map(m => ({ ...m, nrp: String(m.nrp), kapasitas: num(m.kapasitas) || 100 }));
    S.E = d.Effort || [];
    S.I = (d.Items || []).map(i => ({ ...i, stok: num(i.stok), minStok: num(i.minStok) }));
    S.MV = d.Moves || [];
    S.ST = (d.Stages || []).map(x => ({ ...x, urut: num(x.urut), progress: num(x.progress), mulaiPlan: String(x.mulaiPlan || '').slice(0, 10), selesaiPlan: String(x.selesaiPlan || '').slice(0, 10), mulaiAkt: String(x.mulaiAkt || '').slice(0, 10), selesaiAkt: String(x.selesaiAkt || '').slice(0, 10) }));
    S.T = (d.Tasks || []).map(t => ({ ...t, nrp: String(t.nrp), minggu: String(t.minggu).slice(0, 10), target: String(t.target || '').slice(0, 10) }));
    S.R = (d.Reports || []).map(r => ({ ...r, nrp: String(r.nrp), jam: num(r.jam), tanggal: String(r.tanggal).slice(0, 10) }));
    S.cfg = d.Config || {};
    $('#status').textContent = DEMO ? 'demo' : S.offline ? 'offline · data ' + S.offline.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'tersambung';
    $('#status').className = 'status' + (DEMO || S.offline ? '' : ' on');
    if (!DEMO && !S.P.length && !S.M.length) offerSeed();
  } catch (e) { $('#status').textContent = 'gagal memuat'; toast('Gagal memuat data: ' + e.message); }
  render();
}
function demoApi(a, p) {
  const tabs = { Projects: S.P, Items: S.I, Members: S.M };
  if (a === 'save') { const arr = tabs[p.tab], key = p.tab === 'Members' ? 'nrp' : 'id'; const i = arr.findIndex(x => x[key] === p.row[key]); i >= 0 ? arr[i] = p.row : arr.push(p.row); return { ok: true, row: p.row }; }
  if (a === 'remove') { const arr = tabs[p.tab]; const i = arr.findIndex(x => x.id === p.id); if (i >= 0) arr.splice(i, 1); return { ok: true }; }
  if (a === 'move') { const it = S.I.find(x => x.id === p.itemId); const ak = p.jenis === 'IN' ? it.stok + num(p.qty) : it.stok - num(p.qty); if (ak < 0) throw new Error('Stok tidak cukup (sisa ' + it.stok + ')'); it.stok = ak; S.MV.push({ id: 'mv' + Date.now(), waktu: new Date().toISOString(), ...p, stokAkhir: ak }); return { ok: true }; }
  if (a === 'report') { const rows = p.rows.map(r => ({ ...r, id: 'rp' + Math.random().toString(36).slice(2, 8) })); S.R.push(...rows); return { ok: true, rows }; }
  if (a === 'stages') { S.ST = S.ST.filter(x => x.projectId !== p.projectId).concat(p.rows.map((r, i) => ({ ...r, id: 'st' + i + Date.now(), projectId: p.projectId }))); return { ok: true }; }
  if (a === 'task') { const r = { ...p.row, id: p.row.id || 'tk' + Math.random().toString(36).slice(2, 8) }; const i = S.T.findIndex(t => t.id === r.id); i >= 0 ? S.T[i] = r : S.T.push(r); return { ok: true, row: r }; }
  if (a === 'untask') { S.T = S.T.filter(t => t.id !== p.id); return { ok: true }; }
  if (a === 'unreport') { S.R = S.R.filter(r => r.id !== p.id); return { ok: true }; }
  if (a === 'upload') return { ok: true, url: 'data:' + p.mime + ';base64,' + p.base64 };
  return { ok: true };
}
async function offerSeed() {
  openModal(`<div class="hd"><h2>Database masih kosong</h2></div><div class="bd"><p>Google Sheet sudah tersambung tapi belum ada data. Import data awal (53 proyek internal, 13 request Global, 13 member, standar effort)?</p><p class="muted" style="font-size:13px">Barang gudang tidak ikut di-import. Isi lewat menu Gudang atau langsung di tab Items.</p></div>
    <div class="ft"><button class="btn pri" id="seedGo">Import data awal</button><button class="btn" data-close>Nanti</button></div>`, () => {
    $('#seedGo').onclick = async e => { e.target.disabled = true; try { const s = await (await fetch('data/seed.json')).json(); const r = await write('seed', { data: s }); if (r) { toast('Import: ' + (r.imported.join(', ') || 'tidak ada')); closeModal(); load(); } } finally { e.target.disabled = false; } };
  });
}

/* ---------- PIN ---------- */
function getPin() { try { return sessionStorage.getItem('psp.pin') || ''; } catch (e) { return S._pin || ''; } }
function setPin(v) { S._pin = v; try { v ? sessionStorage.setItem('psp.pin', v) : sessionStorage.removeItem('psp.pin'); } catch (e) {} }
function askPin(title = 'Masukkan PIN', msg = 'PIN dibutuhkan untuk menyimpan perubahan. Tanya admin PSP.') {
  return new Promise(res => {
    const prev = $('#modal').innerHTML;
    const box = document.createElement('div'); box.className = 'scrim'; box.style.zIndex = 50;
    box.innerHTML = `<form class="dlg" style="width:min(360px,100%)"><div class="hd"><h2>${title}</h2></div><div class="bd"><p class="muted" style="margin:0">${msg}</p><input id="pinIn" type="password" inputmode="numeric" autocomplete="off"></div><div class="ft"><button class="btn pri">Lanjut</button><button type="button" class="btn" id="pinX">Batal</button></div></form>`;
    document.body.appendChild(box); box.querySelector('#pinIn').focus();
    box.querySelector('form').onsubmit = e => { e.preventDefault(); const v = box.querySelector('#pinIn').value.trim(); box.remove(); res(v); };
    box.querySelector('#pinX').onclick = () => { box.remove(); res(''); };
  });
}
async function write(action, payload) {
  if (!DEMO && !getPin()) { const v = await askPin(); if (!v) return null; setPin(v); }
  try { return await api(action, payload); }
  catch (e) {
    if (/PIN salah/.test(e.message)) { setPin(''); toast('PIN salah'); const v = await askPin(); if (v) { setPin(v); return write(action, payload); } return null; }
    toast(e.message); return null;
  }
}

/* ---------- perhitungan ---------- */
function loadOf(nrp, m) { let t = 0; const list = []; for (const p of S.P) { if (!active(p, m)) continue; const a = team(p).find(x => x.nrp === String(nrp)); if (a) { t += a.pct; list.push([p, a.pct]); } } return { t, list }; }
const lvl = (v, cap) => { const r = v / (cap || 100) * 100; return r <= 0 ? '' : r < 50 ? 'l1' : r <= 80 ? 'l2' : r <= 100 ? 'l3' : r <= 150 ? 'l4' : 'l5'; };
function effortMM(p) {
  const e = S.E.find(x => x.kode === p.tipe); if (!e) return {};
  const f = (1 + cfg('FAKTOR_QTY', 0.5) * (Math.max(1, p.qty) - 1)) * (p.mode === 'Vendor' ? cfg('FAKTOR_VENDOR', 0.3) : 1);
  const o = {}; Object.keys(SK).forEach(k => o[k] = num(e[k]) * f); return o;
}
function dur(p) { if (!p.mulai || !p.selesai) return 0; return (+p.selesai.slice(0, 4) - +p.mulai.slice(0, 4)) * 12 + (+p.selesai.slice(5) - +p.mulai.slice(5)) + 1; }
function demand() { // orang yang dibutuhkan per bulan, dipisah Internal / Global
  const M = months(), eff = cfg('JAM_EFEKTIF', 0.75), out = { Internal: M.map(() => 0), Global: M.map(() => 0), skill: {} };
  Object.keys(SK).forEach(k => out.skill[k] = { Internal: 0, Global: 0 });
  for (const p of S.P) {
    if (OFF.includes(p.status)) continue; const d = dur(p); if (d <= 0) continue; const mm = effortMM(p); const tot = Object.values(mm).reduce((a, b) => a + b, 0);
    const g = p.jenis === 'Global' ? 'Global' : 'Internal';
    M.forEach((m, i) => { if (p.mulai <= m && m <= p.selesai) out[g][i] += tot / d / eff; });
    Object.keys(SK).forEach(k => out.skill[k][g] += (mm[k] || 0) / 12 / eff);
  }
  return out;
}
function supply() { const o = {}; Object.keys(SK).forEach(k => o[k] = 0); for (const m of S.M) { const sk = String(m.skill || '').split(/[,;]/).map(s => s.trim().toUpperCase()).filter(Boolean); if (!sk.length) continue; sk.forEach(s => { if (o[s] !== undefined) o[s] += (m.kapasitas / 100) / sk.length; }); } return o; }

/* ---------- router ---------- */
function render() {
  const h = (location.hash || '#dashboard').slice(1), [r, arg] = h.split('/');
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + r));
  window.scrollTo(0, 0);
  if (r === 'proyek' && arg) return vProjDetail(decodeURIComponent(arg));
  ({ dashboard: vDash, lapor: vLapor, tugas: vTugas, proyek: vProj, loading: vLoad, gudang: vGudang }[r] || vDash)();
}
window.addEventListener('hashchange', render);

/* ---------- DASHBOARD ---------- */
function vDash() {
  const intl = S.P.filter(p => p.jenis !== 'Global'), glb = S.P.filter(p => p.jenis === 'Global');
  const target = cfg('TARGET_MP', 53), plan = intl.filter(p => !OFF.includes(p.status)).reduce((a, p) => a + p.saveMP, 0), real = intl.filter(p => DONE.includes(p.status)).reduce((a, p) => a + p.saveMP, 0);
  const gAct = glb.filter(p => !OFF.includes(p.status) && !DONE.includes(p.status));
  const sup = supply(), cap = Object.values(sup).reduce((a, b) => a + b, 0), dm = demand();
  const peak = Math.max(...months().map((m, i) => dm.Internal[i] + dm.Global[i]));
  const over = S.M.filter(m => loadOf(m.nrp, CUR).t > m.kapasitas);
  const low = S.I.filter(i => i.stok <= i.minStok);
  $('#view').innerHTML = `<div class="toolbar" style="margin-bottom:10px"><h2 style="margin:0">Ringkasan</h2><span class="grow"></span><button class="btn pri" id="dj">📋 Daily Job ${isWork(today()) ? 'hari ini' : esc(dlabel(lastWorkday()))}</button></div>
  <div class="tiles">
    <div class="tile"><div class="k">KPI Reduce MP</div><div class="v num">${fmt(real)}<small> / ${fmt(plan)} plan · target ${fmt(target)}</small></div><div class="s">${target - plan > 0 ? `Gap <b style="color:var(--bad)">${fmt(target - plan)} MP</b> belum ada proyeknya` : 'Plan sudah menutup target'}</div></div>
    <div class="tile"><div class="k">Support Global aktif</div><div class="v num">${gAct.length}<small> request</small></div><div class="s">IDR ${fmt(gAct.reduce((a, p) => a + p.budget, 0))} Mio · ${gAct.filter(p => !EARLY.includes(p.status)).length} sudah PO</div></div>
    <div class="tile ${peak > cap * 1.2 ? 'bad' : ''}"><div class="k">Beban puncak vs tim</div><div class="v num">${fmt(peak / (cap || 1), 1)}×</div><div class="s">Butuh ${fmt(peak)} orang, tim ${fmt(cap, 1)} orang</div></div>
    <div class="tile ${low.length ? 'bad' : ''}"><div class="k">Gudang</div><div class="v num">${low.length}<small> stok menipis/habis</small></div><div class="s">${S.I.length} jenis barang</div></div>
  </div>
  <div class="grid2">
    <div class="panel"><h3>Beban kerja per bulan vs kemampuan tim</h3>
      <div class="legend"><span><i class="sw i"></i>Internal</span><span><i class="sw g"></i>Support Global</span><span><i class="sw l"></i>Kemampuan tim (${fmt(cap, 1)} orang)</span></div>
      <div class="chart" id="cDem"></div>
      <p class="muted" style="font-size:12px;margin:6px 0 0">Orang yang dibutuhkan = standar effort tipe proyek (tab Effort) disebar rata dari mulai s/d selesai, jam efektif ${fmt(cfg('JAM_EFEKTIF', .75) * 100)}%.</p></div>
    <div class="panel"><h3>Perlu perhatian</h3><div class="list">${attention(over, low)}</div></div>
  </div>`;
  chartDemand($("#cDem"), dm, cap);
  $('#dj').onclick = () => dailyJobModal(isWork(today()) ? today() : lastWorkday());
  document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => location.hash = '#proyek/' + encodeURIComponent(b.dataset.p));
  document.querySelectorAll('[data-i]').forEach(b => b.onclick = () => itemDetail(b.dataset.i));
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => location.hash = b.dataset.go);
}
function attention(over, low) {
  const a = [];
  over.forEach(m => a.push(`<button class="li" style="--c:var(--bad)" data-go="#loading"><span><b>${esc(m.nama)}</b> loading ${loadOf(m.nrp, CUR).t}% bulan ini<small>${loadOf(m.nrp, CUR).list.length} proyek bersamaan</small></span></button>`));
  S.P.filter(late).forEach(p => a.push(`<button class="li" style="--c:var(--warn)" data-p="${esc(p.id)}"><span><b>Terlambat:</b> ${esc(p.nama)}<small>${esc(p.kode)} · selesai ${mName(p.selesai)} · ${esc(p.status)}</small></span></button>`));
  const lw = lastWorkday(), miss = S.M.filter(m => !/ADMIN/.test(m.skill) && !S.R.some(r => r.nrp === m.nrp && r.tanggal === lw));
  if (S.M.length && miss.length) a.push(`<button class="li" style="--c:var(--warn)" data-go="#lapor"><span><b>Belum lapor ${esc(dlabel(lw))}:</b> ${miss.length} orang<small>${esc(miss.map(m => short(m.nama)).join(', '))}</small></span></button>`);
  const wk = weekOf(today()), noPlan = S.M.filter(m => !/ADMIN/.test(m.skill) && !S.T.some(t => t.nrp === m.nrp && t.minggu === wk));
  const lateT = S.T.filter(t => t.status !== 'Selesai' && t.target && t.target < today());
  const wRs = S.R.filter(r => r.tanggal >= wk), wTot = wRs.reduce((x, r) => x + r.jam, 0), wIns = wRs.filter(INS).reduce((x, r) => x + r.jam, 0);
  if (wIns) a.push(`<button class="li" style="--c:var(--glb)" data-go="#lapor"><span><b>Insidentil minggu ini: ${fmt(wIns, 1)} jam (${fmt(wIns / wTot * 100)}%)</b><small>support genba, PICA, perbaikan di luar rencana proyek</small></span></button>`);
  if (lateT.length) a.push(`<button class="li" style="--c:var(--bad)" data-go="#tugas"><span><b>${lateT.length} tugas lewat target</b><small>${esc([...new Set(lateT.map(t => short(member(t.nrp)?.nama)))].join(', '))}</small></span></button>`);
  if (S.M.length && noPlan.length) a.push(`<button class="li" style="--c:var(--warn)" data-go="#tugas"><span><b>Belum ada rencana minggu ini:</b> ${noPlan.length} orang<small>${esc(noPlan.map(m => short(m.nama)).join(', '))}</small></span></button>`);
  low.forEach(i => a.push(`<button class="li" style="--c:var(--int)" data-i="${esc(i.id)}"><span><b>${i.stok <= 0 ? 'Habis' : 'Stok menipis'}:</b> ${esc(i.nama)}<small>sisa ${fmt(i.stok)} ${esc(i.satuan)} · minimal ${fmt(i.minStok)}</small></span></button>`));
  return a.join('') || '<p class="muted">Tidak ada yang perlu ditindaklanjuti.</p>';
}
function chartDemand(box, dm, team) {
  const M = months(), W = 640, H = 250, L = 34, R = 8, T = 14, B = 24, iw = W - L - R, ih = H - T - B;
  const max = Math.max(team * 1.3, ...M.map((_, i) => dm.Internal[i] + dm.Global[i])) * 1.08 || 10;
  const step = max > 60 ? 20 : max > 30 ? 10 : 5, y = v => T + ih - v / max * ih, bw = iw / 12 * .64;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Orang dibutuhkan per bulan">`;
  for (let v = 0; v <= max; v += step) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  M.forEach((m, i) => {
    const cx = L + iw * (i + .5) / 12, a = dm.Internal[i], b = dm.Global[i];
    if (a > 0) s += `<rect x="${cx - bw / 2}" y="${y(a)}" width="${bw}" height="${y(0) - y(a)}" fill="var(--int)" rx="${b > .05 ? 0 : 3}"/>`;
    if (b > .05) s += `<rect x="${cx - bw / 2}" y="${y(a + b)}" width="${bw}" height="${Math.max(0, y(a) - y(a + b) - 2)}" fill="var(--glb)" rx="3"/>`;
    s += `<text x="${cx}" y="${H - 7}" text-anchor="middle" ${m === CUR ? 'style="fill:var(--accent);font-weight:600"' : ''}>${MLBL[+m.slice(5) - 1]}</text>`;
    s += `<rect data-k="${i}" x="${cx - iw / 24}" y="${T}" width="${iw / 12}" height="${ih}" fill="transparent"/>`;
  });
  s += `<line x1="${L}" x2="${W - R}" y1="${y(team)}" y2="${y(team)}" stroke="var(--fg)" stroke-width="2" stroke-dasharray="6 4"/></svg>`;
  box.innerHTML = s;
  const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; box.appendChild(tip);
  box.querySelectorAll('[data-k]').forEach(r => { r.onmousemove = e => { const i = +r.dataset.k, a = dm.Internal[i], b = dm.Global[i], bb = box.getBoundingClientRect(); tip.innerHTML = `<b>${mName(M[i])}: butuh ${fmt(a + b, 1)} orang</b> (${fmt((a + b) / (team || 1), 1)}× tim)<br>Internal ${fmt(a, 1)} · Global ${fmt(b, 1)}`; tip.hidden = false; tip.style.left = Math.min(e.clientX - bb.left + 12, bb.width - tip.offsetWidth) + 'px'; tip.style.top = (e.clientY - bb.top - 40) + 'px'; }; r.onmouseleave = () => tip.hidden = true; });
}

/* ---------- PROYEK ---------- */
function vProj() {
  const f = S.f, q = f.q.toLowerCase(), M = months(), ci = M.indexOf(CUR);
  const rows = S.P.filter(p => (f.jenis === 'all' || p.jenis === f.jenis) && (!f.status || p.status === f.status || (f.status === '_late' && late(p))) && (!q || [p.nama, p.kode, p.customer, p.picLuar, p.catatan].join(' ').toLowerCase().includes(q)));
  $('#view').innerHTML = `<div class="toolbar"><h2 style="margin:0 8px 0 0">Proyek</h2>
    <div class="seg">${[['all', 'Semua'], ['Internal', 'Internal'], ['Global', 'Global']].map(([k, l]) => `<button data-j="${k}" class="${f.jenis === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <select id="fs" style="width:auto"><option value="">Semua status</option><option value="_late" ${f.status === '_late' ? 'selected' : ''}>Terlambat</option>${[...ST.Internal, ...ST.Global].filter((v, i, a) => a.indexOf(v) === i).map(s => `<option ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <input type="search" id="fq" placeholder="Cari proyek…" value="${esc(f.q)}"><span class="grow"></span><span class="muted">${rows.length} proyek</span><button class="btn pri" id="add">+ Proyek</button></div>
  <div class="tbl"><table><thead><tr><th>Proyek</th><th>Customer</th><th>Tim PSP</th><th>Status</th><th class="r">Budget<br>IDR Mio</th><th class="r">Save MP</th><th><div class="mh">${M.map(m => `<span>${MLBL[+m.slice(5) - 1]}</span>`).join('')}</div></th></tr></thead><tbody>
  ${rows.map(p => { const a = M.indexOf(p.mulai) >= 0 ? M.indexOf(p.mulai) : (p.mulai < M[0] ? 0 : -1), b = M.indexOf(p.selesai) >= 0 ? M.indexOf(p.selesai) : (p.selesai > M[11] ? 11 : -1);
    return `<tr class="row" tabindex="0" data-p="${esc(p.id)}"><td class="pname"><small><span class="tag ${p.jenis === 'Global' ? 'g' : ''}">${p.jenis === 'Global' ? 'GLOBAL' : 'INT'}</span> ${esc(p.kode)}</small>${esc(p.nama)}${p.qty > 1 ? ` <span class="muted">×${p.qty}</span>` : ''}</td><td>${esc(p.customer)}</td>
    <td>${team(p).map(t => `<span class="pill" style="margin:1px">${esc(short(member(t.nrp)?.nama || t.nrp))} ${t.pct}%</span>`).join('') || (OFF.includes(p.status) || DONE.includes(p.status) ? '' : '<span class="pill warn">belum ada</span>')}</td>
    <td><span class="pill ${tone(p.status)}">${esc(p.status)}</span>${late(p) ? ' <span class="pill bad">telat</span>' : ''}</td><td class="r num">${p.budget ? fmt(p.budget) : '—'}</td><td class="r num">${p.saveMP || ''}</td>
    <td><div class="gantt">${a >= 0 && b >= a ? `<i class="${DONE.includes(p.status) ? 'ok' : OFF.includes(p.status) ? 'off' : p.jenis === 'Global' ? 'g' : ''}" style="grid-column:${a + 1}/${b + 2}"></i>` : ''}${ci >= 0 ? `<span class="now" style="left:${(ci + .5) / 12 * 100}%"></span>` : ''}</div></td></tr>`; }).join('')}
  </tbody></table></div>`;
  document.querySelectorAll('[data-j]').forEach(b => b.onclick = () => { f.jenis = b.dataset.j; vProj(); });
  $('#fs').onchange = e => { f.status = e.target.value; vProj(); };
  const qi = $('#fq'); qi.oninput = () => { f.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { vProj(); const n = $('#fq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  $('#add').onclick = () => projForm(null);
  document.querySelectorAll('tr[data-p]').forEach(r => { const go = () => location.hash = '#proyek/' + encodeURIComponent(r.dataset.p); r.onclick = go; r.onkeydown = e => { if (e.key === 'Enter') go(); }; });
}
function monthOpts(v) { const o = []; for (let y = 2025; y <= 2028; y++) for (let m = 1; m <= 12; m++) o.push(y + '-' + String(m).padStart(2, '0')); return '<option value="">—</option>' + o.map(x => `<option value="${x}" ${x === v ? 'selected' : ''}>${mName(x)}</option>`).join(''); }
function projForm(id) {
  const ex = S.P.find(p => p.id === id);
  const p = ex ? { ...ex } : { id: 'P' + Date.now().toString(36).toUpperCase(), jenis: S.f.jenis === 'Global' ? 'Global' : 'Internal', kode: '', nama: '', customer: '', qty: 1, status: '', mulai: CUR, selesai: '', budget: 0, saveMP: 0, tipe: 'A', mode: 'In-house', tim: '', picLuar: '', catatan: '' };
  let tm = team(p);
  const draw = () => {
    if (!ST[p.jenis].includes(p.status)) p.status = ST[p.jenis][0];
    openModal(`<form id="pf"><div class="hd"><div><small class="muted mono">${ex ? 'EDIT' : 'BARU'}</small><h2>${esc(p.nama || 'Proyek baru')}</h2></div><button type="button" class="btn" data-close>✕</button></div>
    <div class="bd">
      <div class="f2"><label class="f">Jenis<select name="jenis">${['Internal', 'Global'].map(j => `<option ${p.jenis === j ? 'selected' : ''}>${j}</option>`).join('')}</select></label><label class="f">Status<select name="status">${ST[p.jenis].map(s => `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
      <label class="f">Nama proyek / mesin<input name="nama" required value="${esc(p.nama)}"></label>
      <div class="f2"><label class="f">Kode / Budget No<input name="kode" value="${esc(p.kode)}"></label><label class="f">Customer / Plant<input name="customer" value="${esc(p.customer)}"></label></div>
      <div class="f2"><label class="f">Mulai<select name="mulai">${monthOpts(p.mulai)}</select></label><label class="f">Selesai / delivery<select name="selesai">${monthOpts(p.selesai)}</select></label></div>
      <div class="f2"><label class="f">Budget / nilai (IDR Mio)<input name="budget" type="number" step="0.1" value="${p.budget}"></label>${p.jenis === 'Global' ? `<label class="f">Qty unit<input name="qty" type="number" min="1" value="${p.qty}"></label>` : `<label class="f">Save MP<input name="saveMP" type="number" min="0" value="${p.saveMP}"></label>`}</div>
      <div class="f2"><label class="f">Tipe proyek (untuk hitung kebutuhan MP)<select name="tipe">${S.E.map(e => `<option value="${esc(e.kode)}" ${e.kode === p.tipe ? 'selected' : ''}>${esc(e.kode)}. ${esc(e.nama)}</option>`).join('')}</select></label><label class="f">Dikerjakan<select name="mode">${['In-house', 'Vendor'].map(m => `<option ${p.mode === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
      <div><div class="muted" style="font-size:12px;font-weight:500;margin-bottom:5px">Tim PSP & % waktu per bulan</div>
        ${tm.map((t, i) => `<div class="teamrow"><select data-tn="${i}">${S.M.map(m => `<option value="${esc(m.nrp)}" ${m.nrp === t.nrp ? 'selected' : ''}>${esc(m.nama)}</option>`).join('')}</select><input type="number" data-tp="${i}" min="0" max="200" step="5" value="${t.pct}"><button type="button" class="btn" data-tx="${i}" aria-label="Hapus">✕</button></div>`).join('')}
        <button type="button" class="btn" id="tAdd">+ Member</button></div>
      <label class="f">PIC di luar PSP<input name="picLuar" value="${esc(p.picLuar)}"></label>
      <label class="f">Catatan / next action<textarea name="catatan" rows="2">${esc(p.catatan)}</textarea></label>
      <div id="cf"></div>
    </div>
    <div class="ft"><button class="btn pri" id="sv">Simpan</button>${ex ? '<button type="button" class="btn danger" id="del">Hapus</button>' : ''}<button type="button" class="btn" data-close style="margin-left:auto">Batal</button></div></form>`, bind);
  };
  const collect = () => { const fd = new FormData($('#pf')); for (const [k, v] of fd) p[k] = ['budget', 'saveMP', 'qty'].includes(k) ? num(v) : v; tm = tm.map((t, i) => ({ nrp: document.querySelector(`[data-tn="${i}"]`).value, pct: num(document.querySelector(`[data-tp="${i}"]`).value) })); };
  const bind = () => {
    $('#pf [name=jenis]').onchange = () => { collect(); draw(); };
    $('#tAdd').onclick = () => { collect(); tm.push({ nrp: S.M[0]?.nrp, pct: 20 }); draw(); };
    document.querySelectorAll('[data-tx]').forEach(b => b.onclick = () => { collect(); tm.splice(+b.dataset.tx, 1); draw(); });
    $('#pf').onsubmit = async e => { e.preventDefault(); collect(); if (p.mulai && p.selesai && p.selesai < p.mulai) return toast('Bulan selesai sebelum bulan mulai');
      p.tim = tm.map(t => t.nrp + ':' + t.pct).join(', '); $('#sv').disabled = true;
      const r = await write('save', { tab: 'Projects', row: p }); $('#sv').disabled = false;
      if (r) { const i = S.P.findIndex(x => x.id === p.id); i >= 0 ? S.P[i] = p : S.P.push(p); toast('Tersimpan'); closeModal(); render(); } };
    const d = $('#del'); if (d) d.onclick = () => { $('#cf').innerHTML = `<div class="confirm">Hapus proyek ini? <button type="button" class="btn danger" id="dy">Ya, hapus</button><button type="button" class="btn" id="dn">Tidak</button></div>`; $('#dn').onclick = () => $('#cf').innerHTML = ''; $('#dy').onclick = async () => { if (await write('remove', { tab: 'Projects', id: p.id })) { S.P = S.P.filter(x => x.id !== p.id); toast('Dihapus'); closeModal(); render(); } }; };
  };
  draw();
}

/* ---------- LOADING MP ---------- */
function vLoad() {
  const M = months(), ci = M.indexOf(CUR), sup = supply(), dm = demand();
  $('#view').innerHTML = `<h2>Loading member per bulan</h2>
  <p class="muted" style="margin:-6px 0 10px;font-size:13px">% = jumlah alokasi dari semua proyek aktif bulan itu (atur di form proyek). Merah = di atas 100%.</p>
  <div class="tbl" style="padding:10px"><table class="heat"><thead><tr><th></th>${M.map((m, i) => `<th class="mono" style="font-size:11px;${i === ci ? 'color:var(--accent)' : ''}">${MLBL[+m.slice(5) - 1]}</th>`).join('')}</tr></thead><tbody>
  ${S.M.map(m => `<tr><td class="n"><b>${esc(m.nama)}</b><small>${esc(m.nrp)} · ${esc(m.skill)}</small></td>${M.map((mo, i) => { const l = loadOf(m.nrp, mo); return `<td><div class="hc ${lvl(l.t, m.kapasitas)} ${i === ci ? 'cur' : ''}" title="${esc(l.list.map(x => x[0].kode + ' ' + x[1] + '%').join('\n'))}">${l.t || ''}</div></td>`; }).join('')}</tr>`).join('')}
  </tbody></table></div>
  <div class="panel" style="margin-top:14px"><h3>Kebutuhan vs orang yang ada per skill (rata-rata setahun)</h3>
    <div class="legend"><span><i class="sw i"></i>Internal</span><span><i class="sw g"></i>Global</span><span><i class="sw l" style="border-top-style:solid"></i>Orang yang ada</span></div>
    <div class="skills">${Object.keys(SK).map(k => { const a = dm.skill[k].Internal, b = dm.skill[k].Global, need = a + b, have = sup[k], mx = Math.max(...Object.keys(SK).map(x => dm.skill[x].Internal + dm.skill[x].Global), ...Object.values(sup), 1) * 1.05;
      return `<div class="sk"><b>${SK[k]}</b><div class="skbar">${a > 0 ? `<i style="width:${a / mx * 100}%;background:var(--int)"></i>` : ''}${b > .05 ? `<i style="width:${b / mx * 100}%;background:var(--glb)"></i>` : ''}<span class="cap" style="left:${have / mx * 100}%"></span></div>
      <div class="r" style="color:${need > have * 1.15 ? 'var(--bad)' : 'var(--ok)'}">${fmt(need, 1)}<small>ada ${fmt(have, 1)} · ${need > have ? 'kurang ' + fmt(need - have, 1) : 'cukup'}</small></div></div>`; }).join('')}</div>
    <p class="muted" style="font-size:12px;margin:10px 0 0">Member, skill dan standar effort diedit langsung di Google Sheet (tab Members dan Effort).</p></div>`;
}

/* ---------- GUDANG (katalog) ---------- */
function vGudang() {
  const g = S.g, q = g.q.toLowerCase(), cats = [...new Set(S.I.map(i => i.kategori).filter(Boolean))].sort();
  const list = S.I.filter(i => (!g.cat || (g.cat === '_low' ? i.stok <= i.minStok : i.kategori === g.cat)) && (!q || [i.nama, i.sku, i.lokasi, i.spesifikasi].join(' ').toLowerCase().includes(q)));
  $('#view').innerHTML = `<div class="toolbar"><h2 style="margin:0 8px 0 0">Gudang PSP</h2><input type="search" id="gq" placeholder="Cari barang, kode, rak…" value="${esc(g.q)}"><span class="grow"></span><button class="btn pri" id="gAdd">+ Barang</button></div>
  <div class="chips"><button data-c="" class="${!g.cat ? 'on' : ''}">Semua (${S.I.length})</button><button data-c="_low" class="${g.cat === '_low' ? 'on' : ''}">Stok menipis (${S.I.filter(i => i.stok <= i.minStok).length})</button>${cats.map(c => `<button data-c="${esc(c)}" class="${g.cat === c ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>
  ${list.length ? `<div class="catalog">${list.map(card).join('')}</div>` : `<div class="empty">${S.I.length ? 'Tidak ada barang yang cocok.' : 'Belum ada barang. Klik <b>+ Barang</b> untuk menambah barang pertama, lengkap dengan fotonya.'}</div>`}`;
  const qi = $('#gq'); qi.oninput = () => { g.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { vGudang(); const n = $('#gq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { g.cat = b.dataset.c; vGudang(); });
  document.querySelectorAll('[data-i]').forEach(b => b.onclick = () => itemDetail(b.dataset.i));
  $('#gAdd').onclick = () => itemForm(null);
}
const stockPill = i => i.stok <= 0 ? '<span class="pill bad">Habis</span>' : i.stok <= i.minStok ? '<span class="pill warn">Menipis</span>' : '<span class="pill ok">Tersedia</span>';
const photo = i => i.foto ? `<img src="${esc(i.foto)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="ini">${esc(String(i.nama || '?').trim().slice(0, 2).toUpperCase())}</span>`;
function card(i) {
  return `<button class="card-item" data-i="${esc(i.id)}"><div class="ph">${photo(i)}<span class="badge">${stockPill(i)}</span></div>
  <div class="b">${i.contoh ? '<span class="contoh">CONTOH</span>' : ''}<span class="nm">${esc(i.nama)}</span><span class="st num">${fmt(i.stok)} <small>${esc(i.satuan)}</small></span><span class="loc">📍 ${esc(i.lokasi || '—')}</span></div></button>`;
}
function itemDetail(id) {
  const i = S.I.find(x => x.id === id); if (!i) return;
  const hist = S.MV.filter(m => m.itemId === id).slice(-10).reverse();
  openModal(`<div class="hd"><div><small class="muted mono">${esc(i.sku || '')} · ${esc(i.kategori || '')}</small><h2>${esc(i.nama)}</h2></div><button class="btn" data-close>✕</button></div>
  <div class="bd"><div class="itemhead"><div class="ph">${photo(i)}</div><div style="display:flex;flex-direction:column;gap:10px">
    <div><span style="font:700 40px var(--display)" class="num">${fmt(i.stok)}</span> <span class="muted">${esc(i.satuan)}</span> ${stockPill(i)}</div>
    <div class="kv"><span>Lokasi</span><b>${esc(i.lokasi || '—')}</b><span>Stok minimal</span><b>${fmt(i.minStok)} ${esc(i.satuan)}</b><span>Spesifikasi</span><span style="color:var(--fg)">${esc(i.spesifikasi || '—')}</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="mOut">Ambil barang</button><button class="btn ok" id="mIn">Barang masuk</button><button class="btn" id="mEd">Edit</button></div></div></div>
    <div id="mvBox"></div>
    <div><h3>Riwayat terakhir</h3>${hist.length ? `<table class="hist">${hist.map(m => `<tr><td class="mono" style="font-size:11.5px;color:var(--muted)">${esc(String(m.waktu).slice(0, 10))}</td><td><b style="color:${m.jenis === 'IN' ? 'var(--ok)' : 'var(--bad)'}">${m.jenis === 'IN' ? '+' : '−'}${fmt(m.qty)}</b></td><td>${esc(m.oleh)}${m.proyek ? ' · ' + esc(m.proyek) : ''}</td><td class="muted">${esc(m.catatan || '')}</td></tr>`).join('')}</table>` : '<p class="muted" style="margin:0">Belum ada transaksi.</p>'}</div>
  </div>`, () => {
    $('#mOut').onclick = () => moveForm(i, 'OUT'); $('#mIn').onclick = () => moveForm(i, 'IN'); $('#mEd').onclick = () => itemForm(i.id);
  });
}
function moveForm(i, jenis) {
  let who = ''; try { who = localStorage.getItem('psp.nama') || ''; } catch (e) {}
  $('#mvBox').innerHTML = `<form id="mf" class="panel" style="display:flex;flex-direction:column;gap:10px;background:var(--soft)"><b>${jenis === 'OUT' ? 'Ambil barang' : 'Barang masuk'}</b>
    <div class="f2"><label class="f">Jumlah (${esc(i.satuan)})<input name="qty" type="number" min="1" step="any" required value="1"></label><label class="f">${jenis === 'OUT' ? 'Diambil oleh' : 'Diterima oleh'}<input name="oleh" required value="${esc(who)}"></label></div>
    ${jenis === 'OUT' ? `<label class="f">Untuk proyek<select name="proyek"><option value="">—</option>${S.P.filter(p => !OFF.includes(p.status) && !DONE.includes(p.status)).map(p => `<option value="${esc(p.kode)}">${esc(p.kode)} · ${esc(p.nama)}</option>`).join('')}</select></label>` : ''}
    <label class="f">Catatan<input name="catatan" placeholder="${jenis === 'IN' ? 'No PO / supplier' : 'Keperluan'}"></label>
    <div style="display:flex;gap:8px"><button class="btn ${jenis === 'OUT' ? 'pri' : 'ok'}" id="mfGo">Simpan</button><button type="button" class="btn" id="mfX">Batal</button></div></form>`;
  $('#mfX').onclick = () => $('#mvBox').innerHTML = '';
  $('#mf').onsubmit = async e => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target)); try { localStorage.setItem('psp.nama', fd.oleh); } catch (x) {}
    $('#mfGo').disabled = true; const r = await write('move', { itemId: i.id, jenis, qty: num(fd.qty), oleh: fd.oleh, proyek: fd.proyek || '', catatan: fd.catatan });
    if (r) { if (!DEMO) { i.stok = r.stok; S.MV.push(r.move); } toast(jenis === 'OUT' ? 'Barang diambil, stok ' + fmt(i.stok) : 'Stok bertambah jadi ' + fmt(i.stok)); itemDetail(i.id); render(); } else $('#mfGo').disabled = false; };
}
function itemForm(id) {
  const ex = S.I.find(x => x.id === id);
  const i = ex ? { ...ex } : { id: 'I' + Date.now().toString(36).toUpperCase(), sku: '', nama: '', kategori: S.g.cat && S.g.cat !== '_low' ? S.g.cat : '', satuan: 'pcs', stok: 0, minStok: 0, lokasi: '', foto: '', spesifikasi: '' };
  const cats = [...new Set(S.I.map(x => x.kategori).filter(Boolean))];
  openModal(`<form id="if"><div class="hd"><h2>${ex ? 'Edit barang' : 'Barang baru'}</h2><button type="button" class="btn" data-close>✕</button></div>
  <div class="bd"><div class="itemhead"><div><div class="ph" id="fph" style="border-radius:10px">${photo(i)}</div><label class="btn" style="display:block;text-align:center;margin-top:6px">Ambil / pilih foto<input type="file" accept="image/*" capture="environment" id="ffile" hidden></label></div>
    <div style="display:flex;flex-direction:column;gap:10px"><label class="f">Nama barang<input name="nama" required value="${esc(i.nama)}"></label>
    <div class="f2"><label class="f">Kode / SKU<input name="sku" value="${esc(i.sku)}"></label><label class="f">Kategori<input name="kategori" list="catl" value="${esc(i.kategori)}"><datalist id="catl">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></label></div>
    <div class="f2"><label class="f">Satuan<input name="satuan" value="${esc(i.satuan)}"></label><label class="f">Lokasi rak<input name="lokasi" value="${esc(i.lokasi)}" placeholder="Rak A-01"></label></div></div></div>
    <div class="f2">${ex ? `<label class="f">Stok saat ini<input value="${fmt(i.stok)}" disabled></label>` : `<label class="f">Stok awal<input name="stok" type="number" min="0" step="any" value="0"></label>`}<label class="f">Stok minimal (alarm)<input name="minStok" type="number" min="0" step="any" value="${i.minStok}"></label></div>
    <label class="f">Spesifikasi / catatan<textarea name="spesifikasi" rows="2">${esc(i.spesifikasi)}</textarea></label>
    ${ex ? '<p class="muted" style="margin:0;font-size:12.5px">Stok diubah lewat tombol Ambil / Barang masuk supaya tercatat di riwayat.</p>' : ''}<div id="cf"></div></div>
  <div class="ft"><button class="btn pri" id="isv">Simpan</button>${ex ? '<button type="button" class="btn danger" id="idel">Hapus</button>' : ''}<button type="button" class="btn" data-close style="margin-left:auto">Batal</button></div></form>`, () => {
    $('#ffile').onchange = async e => { const f = e.target.files[0]; if (!f) return; $('#fph').innerHTML = '<span class="muted">mengunggah…</span>';
      try { const b64 = await shrink(f); const r = await write('upload', { name: (i.sku || i.id) + '.jpg', mime: 'image/jpeg', base64: b64 }); if (r) i.foto = r.url; } catch (x) { toast('Foto gagal: ' + x.message); }
      $('#fph').innerHTML = photo(i); };
    $('#if').onsubmit = async e => { e.preventDefault(); Object.assign(i, Object.fromEntries(new FormData(e.target))); i.stok = num(i.stok); i.minStok = num(i.minStok); delete i.contoh;
      $('#isv').disabled = true; const r = await write('save', { tab: 'Items', row: i }); $('#isv').disabled = false;
      if (r) { const k = S.I.findIndex(x => x.id === i.id); k >= 0 ? S.I[k] = i : S.I.push(i); toast('Barang tersimpan'); closeModal(); render(); } };
    const d = $('#idel'); if (d) d.onclick = () => { $('#cf').innerHTML = `<div class="confirm">Hapus barang ini dari katalog? <button type="button" class="btn danger" id="dy">Ya, hapus</button><button type="button" class="btn" id="dn">Tidak</button></div>`; $('#dn').onclick = () => $('#cf').innerHTML = ''; $('#dy').onclick = async () => { if (await write('remove', { tab: 'Items', id: i.id })) { S.I = S.I.filter(x => x.id !== i.id); closeModal(); render(); } }; };
  });
}
function shrink(file) { // perkecil foto jadi maks 1000px JPEG supaya upload cepat
  return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const s = Math.min(1, 1000 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); ok(c.toDataURL('image/jpeg', .82).split(',')[1]); }; img.onerror = () => no(new Error('File bukan gambar')); img.src = URL.createObjectURL(file); });
}

/* ---------- modal ---------- */
function openModal(html, bind) {
  $('#modal').innerHTML = `<div class="scrim" id="scrim"><div class="dlg" role="dialog" aria-modal="true">${html}</div></div>`;
  $('#scrim').onclick = e => { if (e.target.id === 'scrim') closeModal(); };
  document.querySelectorAll('#modal [data-close]').forEach(b => b.onclick = closeModal);
  if (bind) bind();
}
function closeModal() { $('#modal').innerHTML = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal').innerHTML) closeModal(); });


/* ---------- LAPOR (laporan harian, dibuat secepat mungkin dari HP) ---------- */
const NONPROJ = [
  { kode: 'RUTIN-MEETING', nama: 'Meeting / 5S / OJT', kat: 'MEETING / 5S' },
  { kode: 'RUTIN-ADMIN', nama: 'PUK / laporan / admin', kat: 'ADMIN / LAPORAN' },
  { kode: 'SUPPORT-GENBA', nama: '⚡ Support genba / line', kat: 'KOMARIGOTO' },
  { kode: 'SUPPORT-PICA', nama: '⚡ Support PICA / kualitas', kat: 'CLAIM KUALITAS' },
  { kode: 'PERBAIKAN', nama: '⚡ Perbaikan / trouble mesin', kat: 'TROUBLE MESIN' },
  { kode: 'TRAINING', nama: 'Training', kat: 'UPGRADE SKILL' },
  { kode: 'LAIN', nama: 'Lain-lain', kat: 'LAIN-LAIN' }];
const TAHAP = ['1. Referensi, evaluasi awal', '2. Design, prepare LO', '3. Penawaran, prepare ringi', '4. M/C assy, pelaksanaan LO', '5. Trial, evaluasi, approval', '6. Penanganan trouble'];
const TAHAP_S = ['Evaluasi', 'Design', 'Ringi', 'Assy / LO', 'Trial', 'Trouble'];
const KELOMPOK = { AUTOMATION: 'Proyek', 'AI IOT': 'Proyek', 'LAY OUT': 'Proyek', SPM: 'Proyek', LPS: 'Proyek', KOMARIGOTO: 'Support', 'TROUBLE MESIN': 'Support', 'CLAIM KUALITAS': 'Support', 'UPGRADE SKILL': 'Pengembangan', 'MEETING / 5S': 'Rutin', 'ADMIN / LAPORAN': 'Rutin', 'LAIN-LAIN': 'Lain-lain' };
const pad = n => String(n).padStart(2, '0');
const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => dstr(new Date());
const weekOf = s => { const d = new Date(s + 'T00:00'); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return dstr(d); };
const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return dstr(d); };
const isWork = s => { const w = new Date(s + 'T00:00').getDay(); return w > 0 && w < 6; };
function lastWorkday(from = today()) { let d = addDays(from, -1); while (!isWork(d)) d = addDays(d, -1); return d; }
const dlabel = s => s === today() ? 'hari ini' : s === addDays(today(), -1) ? 'kemarin' : new Date(s + 'T00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
const JAM_HARI = () => cfg('JAM_KERJA_HARI', 8);
function katFor(kode) {
  const n = NONPROJ.find(x => x.kode === kode); if (n) return n.kat;
  const p = S.P.find(x => x.kode === kode); if (!p) return 'LAIN-LAIN';
  if (p.jenis === 'Global') return 'SPM';
  return ['F', 'G', 'L'].includes(p.tipe) ? 'AI IOT' : p.tipe === 'K' ? 'LAY OUT' : 'AUTOMATION';
}
const kodeName = k => ((NONPROJ.find(x => x.kode === k) || S.P.find(x => x.kode === k) || {}).nama || k).replace('⚡ ', '');
function getMe() { try { return localStorage.getItem('psp.me') || ''; } catch (e) { return S._me || ''; } }
function setMe(v) { S._me = v; try { v ? localStorage.setItem('psp.me', v) : localStorage.removeItem('psp.me'); } catch (e) {} }
function teamPin() { try { return localStorage.getItem('psp.pinTim') || ''; } catch (e) { return S._pt || ''; } }
function setTeamPin(v) { S._pt = v; try { v ? localStorage.setItem('psp.pinTim', v) : localStorage.removeItem('psp.pinTim'); } catch (e) {} }
async function teamSend(action, payload) {
  if (!DEMO && !teamPin()) { const v = await askPin('PIN tim PSP', 'Cukup sekali. PIN disimpan di HP ini.'); if (!v) return null; setTeamPin(v); }
  try { return await api(action, { ...payload, pin: teamPin() }); }
  catch (e) { if (/PIN salah/.test(e.message)) { setTeamPin(''); toast('PIN tim salah'); return teamSend(action, payload); } toast(e.message); return null; }
}
const L = S.lp = { tgl: today(), add: null };
function vLapor() {
  const me = member(getMe());
  if (!me) {
    $('#view').innerHTML = `<h2>Siapa kamu?</h2><p class="muted" style="margin-top:-6px">Pilih sekali saja. HP ini akan mengingatnya.</p>
      <div class="pick big">${S.M.map(m => `<button data-me="${esc(m.nrp)}">${esc(m.nama)}<small>${esc(m.nrp)}</small></button>`).join('')}</div>`;
    document.querySelectorAll('[data-me]').forEach(b => b.onclick = () => { setMe(b.dataset.me); vLapor(); });
    return;
  }
  const mine = S.R.filter(r => r.nrp === me.nrp && r.tanggal === L.tgl), tot = mine.reduce((a, r) => a + r.jam, 0), target = isWork(L.tgl) ? JAM_HARI() : 0;
  const prev = lastWorkday(L.tgl), prevRows = S.R.filter(r => r.nrp === me.nrp && r.tanggal === prev);
  const pct = target ? Math.min(100, tot / target * 100) : (tot ? 100 : 0);
  $('#view').innerHTML = `<div class="lapor">
    <div class="toolbar"><h2 style="margin:0">Halo, ${esc(short(me.nama))}</h2><span class="grow"></span><button class="btn" id="lpWho" style="font-size:12px;padding:5px 9px">Bukan saya</button></div>
    <div class="seg" style="margin-bottom:12px">${[[today(), 'Hari ini'], [addDays(today(), -1), 'Kemarin']].map(([d, l]) => `<button data-d="${d}" class="${L.tgl === d ? 'on' : ''}">${l}</button>`).join('')}<input type="date" id="lpDate" value="${L.tgl}" max="${today()}" style="border:0;border-left:1px solid var(--line);border-radius:0;width:auto;padding:6px 8px"></div>
    <div class="panel" style="padding:14px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><b>${esc(dlabel(L.tgl))}</b><span class="num" style="font:700 22px var(--display);color:${tot >= target && target ? 'var(--ok)' : 'var(--fg)'}">${fmt(tot, 1)}<small class="muted" style="font-size:14px"> / ${target || '–'} jam</small></span></div>
      <div class="pbar"><i style="width:${pct}%;background:${tot >= target ? 'var(--ok)' : 'var(--int)'}"></i></div>
      ${mine.length ? `<div class="entries">${mine.map(r => `<div class="ent"><div><b>${esc(kodeName(r.kode))}</b><small>${esc(r.kode)}${r.tahap ? ' · ' + esc(TAHAP_S[TAHAP.indexOf(r.tahap)] || r.tahap) : ''}${r.uraian ? ' · ' + esc(r.uraian) : ''}</small></div><span class="jam">${fmt(r.jam, 1)} j</span><button class="x" data-del="${esc(r.id)}" aria-label="Hapus">✕</button></div>`).join('')}</div>`
        : `<p class="muted" style="margin:10px 0 0">Belum ada laporan ${esc(dlabel(L.tgl))}.</p>`}
      ${!mine.length && prevRows.length ? `<button class="btn" id="lpCopy" style="width:100%;margin-top:10px">↻ Sama seperti ${esc(dlabel(prev))} (${prevRows.length} pekerjaan, ${fmt(prevRows.reduce((a, r) => a + r.jam, 0), 1)} jam)</button>` : ''}
    </div>
    <div id="lpAdd">${addForm(me, target - tot)}</div>
    <details class="panel" style="margin-top:14px" id="lpTeam"><summary><b>Laporan tim: harian, mingguan, bulanan</b> <span class="muted">(Daily Job, server, WLA)</span></summary><div id="lpTeamBody"></div></details>
  </div>`;
  $('#lpWho').onclick = () => { setMe(''); vLapor(); };
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { L.tgl = b.dataset.d; L.add = null; vLapor(); });
  $('#lpDate').onchange = e => { if (e.target.value) { L.tgl = e.target.value; L.add = null; vLapor(); } };
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { const r = await teamSend('unreport', { id: b.dataset.del, nrp: me.nrp }); if (r) { S.R = S.R.filter(x => x.id !== b.dataset.del); vLapor(); } });
  const cp = $('#lpCopy'); if (cp) cp.onclick = () => save(prevRows.map(r => ({ kode: r.kode, kategori: r.kategori, tahap: r.tahap, uraian: r.uraian, jam: r.jam, status: r.status, peminta: r.peminta || '' })));
  bindAdd(me, target - tot);
  $('#lpTeam').ontoggle = () => { if ($('#lpTeam').open) teamPanel(); };
  async function save(rows) {
    const r = await teamSend('report', { rows: rows.map(x => ({ ...x, tanggal: L.tgl, nrp: me.nrp, nama: me.nama })) });
    if (r) { if (!DEMO) S.R.push(...r.rows.map(x => ({ ...x, nrp: String(x.nrp), jam: num(x.jam) }))); L.add = null; toast('Tersimpan ✓'); vLapor(); }
  }
  S._saveReport = save;
}
function addForm(me, sisa) {
  const a = L.add;
  if (!a) return `<button class="btn pri" id="lpNew" style="width:100%;padding:14px;font-size:16px;margin-top:12px">+ Tambah pekerjaan</button>`;
  const q = (a.q || '').toLowerCase();
  const myP = S.P.filter(p => team(p).some(t => t.nrp === me.nrp) && !OFF.includes(p.status) && !DONE.includes(p.status));
  const recent = [...new Set(S.R.filter(r => r.nrp === me.nrp).slice(-40).reverse().map(r => r.kode))].filter(k => !NONPROJ.some(n => n.kode === k)).slice(0, 6);
  const fav = [...new Set([...recent, ...myP.map(p => p.kode)])].slice(0, 10);
  const found = q ? S.P.filter(p => [p.kode, p.nama, p.customer].join(' ').toLowerCase().includes(q)).slice(0, 12).map(p => p.kode) : [];
  const chip = k => `<button data-k="${esc(k)}" class="${a.kode === k ? 'on' : ''}">${esc(kodeName(k))}<small>${esc(k)}</small></button>`;
  const isProj = a.kode && !NONPROJ.some(n => n.kode === a.kode);
  const lastUr = a.kode ? (S.R.filter(r => r.nrp === me.nrp && r.kode === a.kode).slice(-1)[0] || {}).uraian || '' : '';
  const myT = S.T.filter(t => t.nrp === me.nrp && t.minggu === weekOf(L.tgl) && t.status !== 'Selesai');
  return `<div class="panel addp">
    <div class="step"><b>1. Pekerjaan apa?</b>
      ${myT.length ? `<span class="muted" style="font-size:12px">Tugas minggu ini</span><div class="pick task">${myT.map(t => `<button data-task="${esc(t.id)}" class="${a.taskId === t.id ? 'on' : ''}">${esc(t.judul)}<small>${esc(t.kode || '')}${t.target ? ' · target ' + esc(dlabel(t.target)) : ''}</small></button>`).join('')}</div><span class="muted" style="font-size:12px">Atau pilih proyek</span>` : ''}
      ${fav.length ? `<div class="pick">${fav.map(chip).join('')}</div>` : ''}
      <div class="pick nonp">${NONPROJ.map(n => `<button data-k="${n.kode}" class="${a.kode === n.kode ? 'on' : ''}">${esc(n.nama)}</button>`).join('')}</div>
      <input type="search" id="lpQ" placeholder="Cari proyek lain (nama / kode)…" value="${esc(a.q || '')}">
      ${found.length ? `<div class="pick">${found.map(chip).join('')}</div>` : ''}</div>
    ${a.kode ? `<div class="step"><b>2. Berapa jam?</b><div class="pick jam">${[0.5, 1, 2, 3, 4, 8].map(j => `<button data-j="${j}" class="${a.jam === j ? 'on' : ''}">${fmt(j, j % 1 ? 1 : 0)}</button>`).join('')}${sisa > 0 && ![0.5, 1, 2, 3, 4, 8].includes(sisa) ? `<button data-j="${sisa}" class="${a.jam === sisa ? 'on' : ''}">${fmt(sisa, 1)}<small>sisa</small></button>` : ''}</div></div>` : ''}
    ${a.kode && isProj ? `<div class="step"><b>3. Tahap</b><div class="pick tahap">${TAHAP.map((t, i) => `<button data-t="${i}" class="${a.tahap === t ? 'on' : ''}">${TAHAP_S[i]}</button>`).join('')}</div></div>` : ''}
    ${a.kode ? `<div class="step"><b>${isProj ? '4' : '3'}. Keterangan <span class="muted" style="font-weight:400">(boleh kosong)</span></b><input id="lpU" value="${esc(a.uraian ?? lastUr)}" placeholder="contoh: wiring panel, drawing assy"></div>` : ''}
    ${a.kode && INS({ kategori: katFor(a.kode) }) ? `<div class="step"><b>Diminta oleh?</b><div class="pick">${['Produksi', 'QA / QC', 'Maintenance', 'Atasan', 'Engineering'].map(x => `<button data-pm="${x}" class="${a.peminta === x ? 'on' : ''}">${x}</button>`).join('')}</div><input id="lpPm" value="${esc(a.peminta || '')}" placeholder="atau ketik: nama / dept"></div>` : ''}
    ${a.taskId ? `<label style="display:flex;gap:8px;align-items:center;font-weight:500"><input type="checkbox" id="lpDone" style="width:auto" ${a.done ? 'checked' : ''}> Tugas ini sudah selesai</label>` : ''}
    <div style="display:flex;gap:8px;margin-top:4px"><button class="btn pri" id="lpSave" style="flex:1;padding:12px;font-size:15px" ${a.kode && a.jam ? '' : 'disabled'}>Simpan</button><button class="btn" id="lpX">Batal</button></div>
  </div>`;
}
function bindAdd(me, sisa) {
  const re = () => { $('#lpAdd').innerHTML = addForm(me, sisa); bindAdd(me, sisa); };
  const n = $('#lpNew'); if (n) { n.onclick = () => { L.add = { kode: '', jam: 0, tahap: '', q: '' }; re(); }; return; }
  const a = L.add; if (!a) return;
  document.querySelectorAll('#lpAdd [data-task]').forEach(b => b.onclick = () => {
    const t = S.T.find(x => x.id === b.dataset.task); a.taskId = t.id; a.kode = t.kode || 'LAIN'; a.uraian = t.judul;
    const last = S.R.filter(r => r.nrp === me.nrp && r.kode === a.kode).slice(-1)[0];
    a.tahap = NONPROJ.some(x => x.kode === a.kode) ? '0. Non proyek' : (last && last.tahap) || '';
    re(); });
  document.querySelectorAll('#lpAdd [data-k]').forEach(b => b.onclick = () => {
    a.kode = b.dataset.k; a.uraian = undefined; a.taskId = '';
    const last = S.R.filter(r => r.nrp === me.nrp && r.kode === a.kode).slice(-1)[0];
    a.tahap = NONPROJ.some(x => x.kode === a.kode) ? '0. Non proyek' : (last && last.tahap) || a.tahap || '';
    re(); });
  document.querySelectorAll('#lpAdd [data-j]').forEach(b => b.onclick = () => { a.jam = num(b.dataset.j); re(); });
  document.querySelectorAll('#lpAdd [data-t]').forEach(b => b.onclick = () => { a.tahap = TAHAP[+b.dataset.t]; re(); });
  const q = $('#lpQ'); q.oninput = () => { a.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => { re(); const z = $('#lpQ'); z.focus(); z.setSelectionRange(z.value.length, z.value.length); }, 250); };
  const u = $('#lpU'); if (u) u.oninput = () => a.uraian = u.value;
  $('#lpX').onclick = () => { L.add = null; re(); };
  const dn = $('#lpDone'); if (dn) dn.onchange = () => a.done = dn.checked;
  document.querySelectorAll('#lpAdd [data-pm]').forEach(b => b.onclick = () => { a.peminta = b.dataset.pm; if (u) a.uraian = u.value; re(); });
  const pm = $('#lpPm'); if (pm) pm.oninput = () => a.peminta = pm.value;
  $('#lpSave').onclick = async () => { if (!a.kode || !a.jam) return;
    if (a.taskId && a.done) { const t = S.T.find(x => x.id === a.taskId); if (t) { const r = await teamSend('task', { row: { ...t, status: 'Selesai' } }); if (r) t.status = 'Selesai'; } }
    S._saveReport([{ kode: a.kode, kategori: katFor(a.kode), tahap: a.tahap || '', uraian: (u ? u.value : '').trim(), jam: a.jam, status: a.taskId ? (a.done ? 'CLOSED' : 'OPEN') : '', taskId: a.taskId || '', peminta: INS({ kategori: katFor(a.kode) }) ? (a.peminta || '').trim() : '' }]); };
}
const INS = r => (KELOMPOK[r.kategori] || '') === 'Support'; // pekerjaan insidentil / permintaan dari luar rencana
function periodOf(mode, ref) {
  if (mode === 'hari') return { from: ref, to: ref, label: new Date(ref + 'T00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), key: ref };
  if (mode === 'minggu') { const f = weekOf(ref), t = addDays(f, 6); return { from: f, to: t, label: 'Minggu ' + new Date(f + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' – ' + new Date(addDays(f, 4) + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }), key: f }; }
  const ym = ref.slice(0, 7), last = addDays(addDays(ym + '-01', 32).slice(0, 7) + '-01', -1); return { from: ym + '-01', to: last, label: new Date(ym + '-01T00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }), key: ym };
}
function stats(pr) {
  const days = []; let d = pr.from; while (d <= pr.to) { if (isWork(d) && d <= today()) days.push(d); d = addDays(d, 1); }
  return S.M.filter(m => !/ADMIN/.test(m.skill)).map(m => {
    const rs = S.R.filter(r => r.nrp === m.nrp && r.tanggal >= pr.from && r.tanggal <= pr.to).sort((a, b) => a.tanggal.localeCompare(b.tanggal)), jam = rs.reduce((a, r) => a + r.jam, 0);
    const g = {}; rs.forEach(r => { const k = KELOMPOK[r.kategori] || 'Lain-lain'; g[k] = (g[k] || 0) + r.jam; });
    const filled = days.filter(x => rs.some(r => r.tanggal === x)).length, jk = days.length * JAM_HARI();
    return { m, rs, jam, g, filled, hari: days.length, jk };
  });
}
const RP = S.rp = { mode: 'hari', ref: null };
function teamPanel() {
  RP.ref = RP.ref || (isWork(today()) ? today() : lastWorkday());
  const pr = periodOf(RP.mode, RP.ref), st = stats(pr), tot = st.reduce((a, x) => a + x.jam, 0), ins = st.reduce((a, x) => a + (x.g.Support || 0), 0), proj = st.reduce((a, x) => a + (x.g.Proyek || 0), 0);
  const miss = st.filter(x => !x.rs.length);
  const btn = RP.mode === 'hari' ? `<button class="btn pri" id="rpWa">Salin untuk WA / email</button><button class="btn" id="rpXls">Excel</button>`
    : RP.mode === 'minggu' ? `<button class="btn pri" id="rpZip">Download paket mingguan (ZIP)</button>` : `<button class="btn pri" id="rpXls">Download Excel bulanan</button>`;
  $('#lpTeamBody').innerHTML = `<div class="toolbar" style="margin-top:10px">
    <div class="seg">${[['hari', 'Harian'], ['minggu', 'Mingguan'], ['bulan', 'Bulanan']].map(([k, l]) => `<button data-rm="${k}" class="${RP.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <input type="date" id="rpRef" value="${RP.ref}" max="${today()}" style="width:auto"></div>
  <div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:10px">
    <div class="tile"><div class="k">Terlapor</div><div class="v num" style="font-size:30px">${st.length - miss.length}<small>/${st.length} org</small></div></div>
    <div class="tile"><div class="k">Total jam</div><div class="v num" style="font-size:30px">${fmt(tot)}</div></div>
    <div class="tile"><div class="k">Proyek terencana</div><div class="v num" style="font-size:30px">${tot ? fmt(proj / tot * 100) : 0}<small>%</small></div></div>
    <div class="tile ${tot && ins / tot > .25 ? 'bad' : ''}"><div class="k">Insidentil</div><div class="v num" style="font-size:30px">${tot ? fmt(ins / tot * 100) : 0}<small>%</small></div><div class="s">${fmt(ins, 1)} jam</div></div></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">${btn}</div>
  ${RP.mode === 'hari' ? `<div class="daily">${st.filter(x => x.rs.length).map(x => `<div class="dm"><b>${esc(x.m.nama)}</b> <span class="muted num">${fmt(x.jam, 1)} j</span>${x.rs.map(r => `<div class="dr ${INS(r) ? 'ins' : ''}"><span>${INS(r) ? '⚡ ' : ''}${esc(r.uraian || kodeName(r.kode))}<small>${esc(r.kode)}${INS(r) && r.peminta ? ' · diminta ' + esc(r.peminta) : ''}</small></span><b class="num">${fmt(r.jam, 1)}</b></div>`).join('')}</div>`).join('') || '<p class="muted">Belum ada laporan.</p>'}
    ${miss.length ? `<p class="muted" style="font-size:13px">Belum lapor: ${esc(miss.map(x => short(x.m.nama)).join(', '))}</p>` : ''}</div>`
  : `<div class="tbl"><table style="min-width:640px"><thead><tr><th>Nama</th><th class="r">Hari terisi</th><th class="r">Jam</th><th class="r">Kelengkapan</th><th class="r">Proyek</th><th class="r">Insidentil</th><th class="r">Rutin+lain</th></tr></thead><tbody>
  ${st.map(x => { const k = x.jk ? x.jam / x.jk : 0; return `<tr><td>${esc(x.m.nama)}</td><td class="r num">${x.filled}/${x.hari}</td><td class="r num">${fmt(x.jam, 1)}</td><td class="r"><span class="pill ${k >= .9 ? 'ok' : k >= .6 ? 'warn' : 'bad'}">${fmt(k * 100)}%</span></td><td class="r num">${x.jam ? fmt((x.g.Proyek || 0) / x.jam * 100) + '%' : '–'}</td><td class="r num">${x.jam ? fmt((x.g.Support || 0) / x.jam * 100) + '%' : '–'}</td><td class="r num">${x.jam ? fmt(((x.g.Rutin || 0) + (x.g['Lain-lain'] || 0) + (x.g.Pengembangan || 0)) / x.jam * 100) + '%' : '–'}</td></tr>`; }).join('')}
  </tbody></table></div>${insBreakdown(st)}`}`;
  document.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { RP.mode = b.dataset.rm; teamPanel(); });
  $('#rpRef').onchange = e => { if (e.target.value) { RP.ref = e.target.value; teamPanel(); } };
  const wa = $('#rpWa'); if (wa) wa.onclick = () => copyText(dailyText(pr, st));
  const xl = $('#rpXls'); if (xl) xl.onclick = () => exportPeriod(pr, st, xl);
  const zp = $('#rpZip'); if (zp) zp.onclick = () => exportZip(pr, st, zp);
}
function insBreakdown(st) {
  const by = {}; st.forEach(x => x.rs.filter(INS).forEach(r => { const k = r.peminta || 'tidak dicatat'; by[k] = (by[k] || 0) + r.jam; }));
  const e = Object.entries(by).sort((a, b) => b[1] - a[1]); if (!e.length) return '';
  return `<p style="font-size:13px;margin:10px 0 0"><b>Insidentil menurut peminta:</b> ${e.map(([k, v]) => esc(k) + ' ' + fmt(v, 1) + ' j').join(' · ')}</p>`;
}
function dailyText(pr, st) {
  const tot = st.reduce((a, x) => a + x.jam, 0), ins = st.reduce((a, x) => a + (x.g.Support || 0), 0), proj = st.reduce((a, x) => a + (x.g.Proyek || 0), 0);
  const L2 = [`*DAILY JOB PSP — ${pr.label}*`, `Terlapor ${st.filter(x => x.rs.length).length}/${st.length} orang · ${fmt(tot, 1)} jam · Proyek ${tot ? fmt(proj / tot * 100) : 0}% · Insidentil ${tot ? fmt(ins / tot * 100) : 0}%`, ''];
  st.filter(x => x.rs.length).forEach(x => { L2.push(`*${x.m.nama}*`); x.rs.forEach(r => L2.push(`${INS(r) ? '⚡' : '•'} ${r.kode && !NONPROJ.some(n => n.kode === r.kode) ? '[' + r.kode + '] ' : ''}${r.uraian || kodeName(r.kode)}${INS(r) && r.peminta ? ' (diminta ' + r.peminta + ')' : ''} — ${fmt(r.jam, 1)} j`)); L2.push(''); });
  const miss = st.filter(x => !x.rs.length); if (miss.length) L2.push('Belum lapor: ' + miss.map(x => x.m.nama).join(', '));
  L2.push('⚡ = pekerjaan insidentil di luar rencana');
  return L2.join('\n');
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Tersalin. Tempel di WhatsApp / email.'); } catch (e) { openModal(`<div class="hd"><h2>Salin teks</h2><button class="btn" data-close>✕</button></div><div class="bd"><textarea rows="14" readonly>${esc(t)}</textarea></div>`, () => { const x = document.querySelector('#modal textarea'); x.focus(); x.select(); }); } }
const libs = { XLSX: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', JSZip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' };
const need = n => window[n] ? Promise.resolve() : new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = libs[n]; sc.onload = ok; sc.onerror = () => no(new Error('Library gagal dimuat, cek internet')); document.head.appendChild(sc); });
const HEAD = ['Tanggal', 'Kode Proyek', 'Nama Proyek', 'Kategori', 'Tahap', 'Uraian pekerjaan (aktual)', 'Jam', 'Status', 'Kelompok WLA', 'Diminta oleh'];
const rowOf = r => [r.tanggal, r.kode, kodeName(r.kode), r.kategori, r.tahap, r.uraian, r.jam, r.status, KELOMPOK[r.kategori] || 'Lain-lain', r.peminta || ''];
const W = a => a.map(w => ({ wch: w }));
function rekapSheet(X, pr, st) {
  const G = ['Proyek', 'Support', 'Pengembangan', 'Rutin', 'Lain-lain'];
  const a = [['REKAP WLA PSP — ' + pr.label], [], ['NRP', 'Nama', 'Hari kerja', 'Hari terisi', 'Jam kerja', 'Jam tercatat', 'Kelengkapan %', 'Jam Proyek', 'Jam Insidentil', 'Jam Pengembangan', 'Jam Rutin', 'Jam Lain-lain', 'Utilisasi proyek %']];
  st.forEach(x => a.push([x.m.nrp, x.m.nama, x.hari, x.filled, x.jk, x.jam, x.jk ? Math.round(x.jam / x.jk * 100) : 0, ...G.map(g => x.g[g] || 0), x.jk ? Math.round((x.g.Proyek || 0) / x.jk * 100) : 0]));
  const s = X.utils.aoa_to_sheet(a); s['!cols'] = W([8, 26, 10, 10, 10, 11, 12, 10, 12, 14, 10, 12, 14]); return s;
}
function allSheet(X, st) { const s = X.utils.aoa_to_sheet([['NRP', 'Nama', ...HEAD], ...st.flatMap(x => x.rs.map(r => [x.m.nrp, x.m.nama, ...rowOf(r)]))]); s['!cols'] = W([8, 22, 11, 16, 34, 16, 24, 40, 6, 9, 13, 16]); return s; }
function personSheet(X, x, pr) { const s = X.utils.aoa_to_sheet([['LAPORAN PEKERJAAN — PSP'], ['Nama', x.m.nama], ['NRP', x.m.nrp], ['Periode', pr.label], ['Jam tercatat', x.jam, 'dari', x.jk, 'jam kerja'], [], HEAD, ...x.rs.map(rowOf)]); s['!cols'] = W([11, 16, 34, 16, 24, 40, 6, 9, 13, 16]); return s; }
function saveBlob(data, name, type) { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }
const XT = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
async function exportPeriod(pr, st, b) {
  b.disabled = true;
  try { await need('XLSX'); const X = window.XLSX, wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, rekapSheet(X, pr, st), 'Rekap WLA'); X.utils.book_append_sheet(wb, allSheet(X, st), 'Semua');
    st.forEach(x => { if (x.rs.length) X.utils.book_append_sheet(wb, personSheet(X, x, pr), (x.m.nrp + ' ' + short(x.m.nama)).slice(0, 31)); });
    saveBlob(X.write(wb, { bookType: 'xlsx', type: 'array' }), 'LAPORAN_PSP_' + pr.key + '.xlsx', XT);
  } catch (e) { toast('Gagal: ' + e.message); }
  b.disabled = false;
}
async function exportZip(pr, st, b) { // 1 folder: rekap + 1 file per orang, tinggal di-extract ke server
  b.disabled = true; b.textContent = 'Menyiapkan…';
  try { await need('XLSX'); await need('JSZip'); const X = window.XLSX, z = new window.JSZip(), dir = 'LAPORAN_PSP_' + pr.key, f = z.folder(dir);
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, rekapSheet(X, pr, st), 'Rekap WLA'); X.utils.book_append_sheet(wb, allSheet(X, st), 'Semua');
    f.file('00_REKAP_' + pr.key + '.xlsx', X.write(wb, { bookType: 'xlsx', type: 'array' }));
    st.forEach(x => { const w = X.utils.book_new(); X.utils.book_append_sheet(w, personSheet(X, x, pr), 'Log'); f.file(`LAPORAN_${x.m.nrp}_${x.m.nama.replace(/[^A-Za-z0-9]+/g, '_')}_${pr.key}.xlsx`, X.write(w, { bookType: 'xlsx', type: 'array' })); });
    saveBlob(await z.generateAsync({ type: 'blob' }), dir + '.zip', 'application/zip');
  } catch (e) { toast('Gagal: ' + e.message); }
  b.disabled = false; b.textContent = 'Download paket mingguan (ZIP)';
}

/* ---------- TUGAS MINGGUAN ---------- */
// Koordinator membuat tugas untuk semua anggota grupnya; Leader untuk grupnya; setiap orang boleh membuat tugas untuk dirinya sendiri.
const TST = ['Rencana', 'Proses', 'Selesai', 'Tunda'];
const tTone = s => s === 'Selesai' ? 'ok' : s === 'Proses' ? 'info' : s === 'Tunda' ? '' : 'warn';
function canPlan(me, m) { if (!me) return false; if (me.nrp === m.nrp) return true; return me.peran === 'Koordinator' || (me.peran === 'Leader' && me.grup === m.grup); }
const TW = S.tw = { wk: null, all: false, form: null };
function vTugas() {
  const me = member(getMe()); TW.wk = TW.wk || weekOf(today());
  const lead = me && (me.peran === 'Koordinator' || me.peran === 'Leader');
  const people = S.M.filter(m => !/ADMIN/.test(m.skill)).filter(m => TW.all || !me || lead ? (me && me.peran === 'Leader' && !TW.all ? m.grup === me.grup : true) : m.nrp === me.nrp);
  const fri = addDays(TW.wk, 4), lastWk = addDays(TW.wk, -7);
  $('#view').innerHTML = `<div class="lapor" style="max-width:860px">
    <div class="toolbar"><h2 style="margin:0">Tugas minggu ini</h2><span class="grow"></span>
      <div class="seg"><button id="wPrev">‹</button><button class="on" style="pointer-events:none">${esc(new Date(TW.wk + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }))} – ${esc(new Date(fri + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }))}</button><button id="wNext">›</button></div></div>
    ${me ? `<p class="muted" style="margin:-4px 0 10px;font-size:13px">Masuk sebagai <b>${esc(me.nama)}</b>${me.peran && me.peran !== 'Member' ? ' · ' + esc(me.peran) + (me.grup ? ' ' + esc(me.grup) : '') : ''}. ${lead ? 'Anda bisa membuat tugas untuk anggota.' : 'Anda bisa membuat tugas untuk diri sendiri.'} ${!lead ? `<a href="#" id="wAll">${TW.all ? 'Tampilkan tugas saya saja' : 'Lihat semua tim'}</a>` : ''}</p>` : `<p class="muted">Pilih nama dulu di menu <a href="#lapor">Lapor</a>.</p>`}
    ${people.map(m => personCard(m, me, lastWk)).join('')}
  </div>`;
  $('#wPrev').onclick = () => { TW.wk = addDays(TW.wk, -7); TW.form = null; vTugas(); };
  $('#wNext').onclick = () => { TW.wk = addDays(TW.wk, 7); TW.form = null; vTugas(); };
  const wa = $('#wAll'); if (wa) wa.onclick = e => { e.preventDefault(); TW.all = !TW.all; vTugas(); };
  document.querySelectorAll('[data-st]').forEach(b => b.onclick = async () => { const t = S.T.find(x => x.id === b.dataset.st); const nx = TST[(TST.indexOf(t.status) + 1) % 3]; const r = await teamSend('task', { row: { ...t, status: nx } }); if (r) { t.status = nx; vTugas(); } });
  document.querySelectorAll('[data-tadd]').forEach(b => b.onclick = () => { TW.form = { nrp: b.dataset.tadd, id: '', judul: '', kode: '', target: fri, catatan: '' }; vTugas(); setTimeout(() => $('#tfJ')?.focus(), 0); });
  document.querySelectorAll('[data-tedit]').forEach(b => b.onclick = () => { TW.form = { ...S.T.find(x => x.id === b.dataset.tedit) }; vTugas(); });
  document.querySelectorAll('[data-carry]').forEach(b => b.onclick = async () => {
    const open = S.T.filter(t => t.nrp === b.dataset.carry && t.minggu === lastWk && t.status !== 'Selesai'); b.disabled = true;
    for (const t of open) { const r = await teamSend('task', { row: { ...t, id: '', minggu: TW.wk, status: t.status === 'Proses' ? 'Proses' : 'Rencana', target: addDays(TW.wk, 4), oleh: me ? me.nama : '' } }); if (!r) break; S.T.push(DEMO ? r.row : { ...r.row, nrp: String(r.row.nrp) }); if (!DEMO) {} }
    if (DEMO) S.T = S.T.filter((t, i, a) => a.findIndex(x => x.id === t.id) === i);
    vTugas(); });
  const f = $('#tf'); if (f) {
    f.onsubmit = async e => { e.preventDefault(); const fd = Object.fromEntries(new FormData(f)); const row = { ...TW.form, ...fd, minggu: TW.form.minggu || TW.wk, status: TW.form.status || 'Rencana', oleh: TW.form.oleh || (me ? me.nama : '') };
      if (!row.judul.trim()) return toast('Isi tugasnya dulu');
      const r = await teamSend('task', { row }); if (r) { const nr = { ...r.row, nrp: String(r.row.nrp) }; const i = S.T.findIndex(t => t.id === nr.id); i >= 0 ? S.T[i] = nr : (DEMO || S.T.push(nr)); TW.form = null; toast('Tugas tersimpan'); vTugas(); } };
    $('#tfX').onclick = () => { TW.form = null; vTugas(); };
    const d = $('#tfDel'); if (d) d.onclick = async () => { if (await teamSend('untask', { id: TW.form.id })) { S.T = S.T.filter(t => t.id !== TW.form.id); TW.form = null; vTugas(); } };
  }
}
function personCard(m, me, lastWk) {
  const ts = S.T.filter(t => t.nrp === m.nrp && t.minggu === TW.wk), can = canPlan(me, m);
  const carry = S.T.filter(t => t.nrp === m.nrp && t.minggu === lastWk && t.status !== 'Selesai').length;
  const done = ts.filter(t => t.status === 'Selesai').length;
  const jamT = id => S.R.filter(r => r.taskId === id).reduce((a, r) => a + r.jam, 0);
  const projOpts = k => `<option value="">— tanpa proyek —</option>` + [...NONPROJ.map(n => [n.kode, n.nama]), ...S.P.filter(p => !OFF.includes(p.status) && !DONE.includes(p.status)).map(p => [p.kode, p.nama])].map(([c, n]) => `<option value="${esc(c)}" ${c === k ? 'selected' : ''}>${esc(c)} · ${esc(n)}</option>`).join('');
  const form = TW.form && TW.form.nrp === m.nrp ? `<form id="tf" class="addp" style="margin-top:8px;background:var(--soft);padding:12px;border-radius:8px">
      <label class="f">Tugas<input id="tfJ" name="judul" value="${esc(TW.form.judul)}" placeholder="contoh: Selesaikan drawing assy cam" required></label>
      <div class="f2"><label class="f">Proyek<select name="kode">${projOpts(TW.form.kode)}</select></label><label class="f">Target<input type="date" name="target" value="${esc(TW.form.target)}"></label></div>
      <label class="f">Catatan<input name="catatan" value="${esc(TW.form.catatan || '')}"></label>
      <div style="display:flex;gap:8px"><button class="btn pri">Simpan</button>${TW.form.id ? '<button type="button" class="btn danger" id="tfDel">Hapus</button>' : ''}<button type="button" class="btn" id="tfX" style="margin-left:auto">Batal</button></div></form>` : '';
  return `<div class="panel" style="margin-bottom:10px;padding:12px 14px">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="font-size:15px">${esc(m.nama)}</b>${m.peran && m.peran !== 'Member' ? `<span class="pill info">${esc(m.peran)}</span>` : ''}<span class="tag ${m.grup === 'Global' ? 'g' : ''}">${esc(m.grup || 'Internal')}</span><span class="grow" style="flex:1"></span>
      <span class="muted num" style="font-size:12.5px">${ts.length ? `${done}/${ts.length} selesai` : '<span style="color:var(--warn);font-weight:600">belum ada rencana</span>'}</span></div>
    ${ts.length ? `<div class="entries">${ts.map(t => `<div class="ent" style="grid-template-columns:1fr auto auto"><div ${can ? `data-tedit="${esc(t.id)}" style="cursor:pointer"` : ''}><b style="${t.status === 'Selesai' ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(t.judul)}</b><small>${esc(t.kode || '')}${t.target ? ' · target ' + esc(dlabel(t.target)) : ''}${t.target && t.target < today() && t.status !== 'Selesai' ? ' · <b style="color:var(--bad)">lewat</b>' : ''}${jamT(t.id) ? ' · ' + fmt(jamT(t.id), 1) + ' jam' : ''}${t.oleh && t.oleh !== m.nama ? ' · dari ' + esc(short(t.oleh)) : ''}</small></div><span class="muted" style="font-size:11px"></span><button class="pill ${tTone(t.status)}" style="border:0;cursor:pointer;padding:5px 10px" data-st="${esc(t.id)}" title="Ketuk untuk ganti status">${esc(t.status)}</button></div>`).join('')}</div>` : ''}
    ${form}
    ${can && !form ? `<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn" data-tadd="${esc(m.nrp)}">+ Tugas</button>${carry ? `<button class="btn" data-carry="${esc(m.nrp)}">↻ Bawa ${carry} tugas belum selesai dari minggu lalu</button>` : ''}</div>` : ''}
  </div>`;
}


/* ---------- DAILY JOB (Ringkasan) ---------- */
function dailyJobModal(d) {
  const pr = periodOf('hari', d), st = stats(pr), txt = dailyText(pr, st);
  openModal(`<div class="hd"><div><small class="muted mono">DAILY JOB PSP</small><h2>${esc(pr.label)}</h2></div><button class="btn" data-close>✕</button></div>
  <div class="bd"><div class="toolbar" style="margin:0"><button class="btn" id="djPrev">‹ Hari sebelumnya</button>${d < today() ? '<button class="btn" id="djNext">Hari berikutnya ›</button>' : ''}</div>
  <textarea id="djT" rows="16" style="font:13px var(--mono)">${esc(txt)}</textarea>
  <p class="muted" style="margin:0;font-size:12.5px">Teks bisa diedit dulu sebelum disalin. ⚡ = pekerjaan insidentil di luar rencana.</p></div>
  <div class="ft"><button class="btn pri" id="djCopy">Salin untuk WA / email</button><a class="btn" id="djWa" target="_blank" rel="noopener">Buka WhatsApp</a></div>`, () => {
    $('#djCopy').onclick = () => copyText($('#djT').value);
    const wa = $('#djWa'); const upd = () => wa.href = 'https://wa.me/?text=' + encodeURIComponent($('#djT').value); upd(); $('#djT').oninput = upd;
    $('#djPrev').onclick = () => { let x = addDays(d, -1); while (!isWork(x)) x = addDays(x, -1); dailyJobModal(x); };
    const n = $('#djNext'); if (n) n.onclick = () => { let x = addDays(d, 1); while (!isWork(x) && x < today()) x = addDays(x, 1); dailyJobModal(x); };
  });
}

/* ---------- DETAIL PROYEK: tahapan, Gantt plan vs aktual ---------- */
const STAGE_TPL = [['1. Evaluasi awal / referensi', 10], ['2. Design & prepare LO', 20], ['3. Penawaran, ringi, PR/PO', 15], ['4. Fabrikasi / assy / pelaksanaan LO', 35], ['5. Trial, evaluasi, approval', 15], ['6. Masspro / serah terima', 5]];
const pStart = p => p.mulai ? p.mulai + '-01' : today();
const pEnd = p => p.selesai ? addDays(addDays(p.selesai + '-01', 32).slice(0, 7) + '-01', -1) : addDays(pStart(p), 90);
const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5);
function proposeStages(p) {
  const a = pStart(p), n = Math.max(7, dayDiff(a, pEnd(p))); let cur = a, acc = 0;
  return STAGE_TPL.map(([t, w], i) => { acc += w; const end = i === STAGE_TPL.length - 1 ? pEnd(p) : addDays(a, Math.round(n * acc / 100)); const r = { urut: i + 1, tahap: t, mulaiPlan: cur, selesaiPlan: end, mulaiAkt: '', selesaiAkt: '', progress: 0, catatan: '' }; cur = addDays(end, 1); return r; });
}
const fmtD = s => s ? new Date(s + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '–';
const stageNo = t => parseInt(String(t || '').trim(), 10) || 0;
const PD = S.pd = { edit: false, rows: null };
function vProjDetail(id) {
  const p = S.P.find(x => x.id === id || x.kode === id);
  if (!p) { $('#view').innerHTML = `<p><a href="#proyek">‹ Semua proyek</a></p><div class="empty">Proyek tidak ditemukan.</div>`; return; }
  if (PD.id !== p.id) { PD.id = p.id; PD.edit = false; PD.rows = null; }
  const saved = S.ST.filter(x => x.projectId === p.id).sort((a, b) => a.urut - b.urut), usul = !saved.length;
  const rows = PD.rows || (usul ? proposeStages(p) : saved.map(x => ({ ...x })));
  const rp = S.R.filter(r => r.kode === p.kode), jam = rp.reduce((a, r) => a + r.jam, 0);
  const durTot = rows.reduce((a, r) => a + Math.max(1, dayDiff(r.mulaiPlan, r.selesaiPlan)), 0);
  const prog = durTot ? rows.reduce((a, r) => a + num(r.progress) * Math.max(1, dayDiff(r.mulaiPlan, r.selesaiPlan)), 0) / durTot : 0;
  const planNow = (() => { const t = today(); let done = 0; rows.forEach(r => { const d = Math.max(1, dayDiff(r.mulaiPlan, r.selesaiPlan)); if (t > r.selesaiPlan) done += d; else if (t >= r.mulaiPlan) done += d * (dayDiff(r.mulaiPlan, t) / d); }); return durTot ? done / durTot * 100 : 0; })();
  const byStage = {}; rp.forEach(r => { const k = stageNo(r.tahap); byStage[k] = (byStage[k] || 0) + r.jam; });
  const byPerson = {}; rp.forEach(r => { byPerson[r.nrp] = (byPerson[r.nrp] || 0) + r.jam; });
  $('#view').innerHTML = `<p style="margin:0 0 8px"><a href="#proyek">‹ Semua proyek</a></p>
  <div class="toolbar"><div style="min-width:0"><small class="mono muted"><span class="tag ${p.jenis === 'Global' ? 'g' : ''}">${p.jenis === 'Global' ? 'GLOBAL' : 'INT'}</span> ${esc(p.kode)} · ${esc(p.customer || '')}</small><h2 style="margin:2px 0 0">${esc(p.nama)}</h2></div><span class="grow"></span><span class="pill ${tone(p.status)}" style="font-size:13px">${esc(p.status)}</span><button class="btn" id="pdEdit">Edit info proyek</button></div>
  <div class="tiles">
    <div class="tile"><div class="k">Progress aktual</div><div class="v num">${fmt(prog)}<small>%</small></div><div class="s">Seharusnya ${fmt(planNow)}% per hari ini ${prog + 5 < planNow ? '· <b style="color:var(--bad)">terlambat</b>' : prog >= planNow - 5 ? '· <b style="color:var(--ok)">on track</b>' : ''}</div></div>
    <div class="tile"><div class="k">Jadwal</div><div class="v num" style="font-size:28px">${mName(p.mulai)} – ${mName(p.selesai)}</div><div class="s">${p.budget ? 'IDR ' + fmt(p.budget) + ' Mio' : ''}${p.saveMP ? ' · Save ' + p.saveMP + ' MP' : ''}</div></div>
    <div class="tile"><div class="k">Jam kerja tercatat</div><div class="v num">${fmt(jam, 1)}<small> jam</small></div><div class="s">${Object.keys(byPerson).length} orang · dari menu Lapor</div></div>
    <div class="tile"><div class="k">Tim</div><div style="margin-top:6px">${team(p).map(t => `<span class="pill" style="margin:2px">${esc(short(member(t.nrp)?.nama || t.nrp))} ${t.pct}%</span>`).join('') || '<span class="muted">belum ada</span>'}${p.picLuar ? `<div class="s">+ ${esc(p.picLuar)}</div>` : ''}</div></div>
  </div>
  <div class="panel"><div class="toolbar" style="margin-bottom:6px"><h3 style="margin:0">Tahapan & timeline</h3><span class="grow"></span>
    ${usul && !PD.edit ? '<span class="pill warn">jadwal usulan otomatis — belum disimpan</span>' : ''}
    ${PD.edit ? '' : `<button class="btn ${usul ? 'pri' : ''}" id="pdEditSt">${usul ? 'Atur & simpan tahapan' : 'Edit tahapan'}</button>`}</div>
    <div class="legend"><span><i class="sw" style="background:var(--int-soft,#cfe0f6);border:1px solid var(--int)"></i>Plan</span><span><i class="sw" style="background:var(--int)"></i>Aktual</span><span><i class="sw" style="background:var(--ok)"></i>Selesai</span><span><i class="sw" style="background:var(--accent);width:3px"></i>Hari ini</span></div>
    <div class="gwrap" id="pdG">${ganttSvg(rows, p)}</div>
    ${PD.edit ? stageEditor(rows) : `<div class="tbl" style="margin-top:10px"><table style="min-width:640px"><thead><tr><th>Tahap</th><th>Plan</th><th>Aktual</th><th class="r">Progress</th><th class="r">Jam lapor</th><th>Catatan</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(r.tahap)}</td><td class="num">${fmtD(r.mulaiPlan)} – ${fmtD(r.selesaiPlan)}</td><td class="num">${r.mulaiAkt ? fmtD(r.mulaiAkt) + ' – ' + (r.selesaiAkt ? fmtD(r.selesaiAkt) : '<i>berjalan</i>') : '–'}</td><td class="r"><span class="pill ${num(r.progress) >= 100 ? 'ok' : num(r.progress) > 0 ? 'info' : ''}">${fmt(r.progress)}%</span></td><td class="r num">${byStage[stageNo(r.tahap)] ? fmt(byStage[stageNo(r.tahap)], 1) : ''}</td><td>${esc(r.catatan || '')}</td></tr>`).join('')}</tbody></table></div>`}
  </div>
  <div class="grid2" style="margin-top:12px">
    <div class="panel"><h3>Aktivitas terakhir (dari Lapor)</h3>${rp.length ? `<div class="daily">${rp.slice().sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 12).map(r => `<div class="dr"><span>${esc(r.uraian || r.tahap || '-')}<small>${esc(fmtD(r.tanggal))} · ${esc(short(member(r.nrp)?.nama || r.nrp))}${r.tahap ? ' · ' + esc(String(r.tahap).replace(/^\d\.\s*/, '')) : ''}</small></span><b class="num">${fmt(r.jam, 1)}</b></div>`).join('')}</div>` : '<p class="muted">Belum ada laporan untuk proyek ini.</p>'}</div>
    <div class="panel"><h3>Jam per orang</h3>${Object.keys(byPerson).length ? Object.entries(byPerson).sort((a, b) => b[1] - a[1]).map(([n, j]) => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line)"><span>${esc(member(n)?.nama || n)}</span><b class="num">${fmt(j, 1)} j</b></div>`).join('') : '<p class="muted">–</p>'}
      ${p.catatan ? `<h3 style="margin-top:14px">Catatan</h3><p style="margin:0">${esc(p.catatan)}</p>` : ''}</div>
  </div>`;
  $('#pdEdit').onclick = () => projForm(p.id);
  const es = $('#pdEditSt'); if (es) es.onclick = () => { PD.edit = true; PD.rows = rows.map(r => ({ ...r })); vProjDetail(p.id); };
  if (PD.edit) bindStageEditor(p);
}
function ganttSvg(rows, p) {
  if (!rows.length) return '<p class="muted">Belum ada tahapan.</p>';
  const all = rows.flatMap(r => [r.mulaiPlan, r.selesaiPlan, r.mulaiAkt, r.selesaiAkt]).filter(Boolean).concat([today()]);
  let a = all.reduce((x, y) => x < y ? x : y), b = all.reduce((x, y) => x > y ? x : y);
  a = weekOf(addDays(a, -3)); b = addDays(b, 7);
  const days = Math.max(14, dayDiff(a, b)), LW = 210, PX = Math.max(4, Math.min(14, 760 / days)), W = LW + days * PX + 10, RH = 34, T = 34, H = T + rows.length * RH + 6;
  const x = d => LW + dayDiff(a, d) * PX;
  let g = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Gantt tahapan proyek" style="display:block">`;
  // month labels + week grid
  for (let d = a; d <= b; d = addDays(d, 7)) g += `<line x1="${x(d)}" x2="${x(d)}" y1="${T - 6}" y2="${H}" stroke="var(--line)"/>`;
  let m = a.slice(0, 7) + '-01'; if (m < a) m = addDays(addDays(m, 32).slice(0, 7) + '-01', 0);
  for (; m <= b; m = addDays(m, 32).slice(0, 7) + '-01') g += `<line x1="${x(m)}" x2="${x(m)}" y1="0" y2="${H}" stroke="var(--muted)" stroke-opacity=".5"/><text x="${x(m) + 4}" y="14" style="font:600 11px var(--mono);fill:var(--fg)">${MLBL[+m.slice(5, 7) - 1]} ${m.slice(2, 4)}</text>`;
  rows.forEach((r, i) => {
    const y = T + i * RH, pr = num(r.progress), done = pr >= 100;
    g += `<text x="6" y="${y + 15}" style="font:500 12px var(--body);fill:var(--fg)">${esc(String(r.tahap).slice(0, 30))}</text><text x="6" y="${y + 28}" style="font:10.5px var(--mono);fill:var(--muted)">${fmt(pr)}%</text>`;
    if (r.mulaiPlan && r.selesaiPlan) g += `<rect x="${x(r.mulaiPlan)}" y="${y + 4}" width="${Math.max(3, (dayDiff(r.mulaiPlan, r.selesaiPlan) + 1) * PX)}" height="11" rx="3" fill="#cfe0f6" stroke="var(--int)" stroke-width="1"/>`;
    if (r.mulaiAkt) { const e = r.selesaiAkt || today(), w = Math.max(3, (dayDiff(r.mulaiAkt, e) + 1) * PX); g += `<rect x="${x(r.mulaiAkt)}" y="${y + 18}" width="${w}" height="11" rx="3" fill="${done ? 'var(--ok)' : 'var(--int)'}"/>`; }
    else if (r.mulaiPlan && pr > 0) { const w = Math.max(3, (dayDiff(r.mulaiPlan, r.selesaiPlan) + 1) * PX * pr / 100); g += `<rect x="${x(r.mulaiPlan)}" y="${y + 18}" width="${w}" height="11" rx="3" fill="${done ? 'var(--ok)' : 'var(--int)'}"/>`; }
    if (!done && r.selesaiPlan && r.selesaiPlan < today()) g += `<text x="${x(r.selesaiPlan) + (dayDiff(r.mulaiPlan, r.selesaiPlan) + 1) * PX * 0 + 6}" y="${y + 14}" style="font:700 10px var(--body);fill:var(--bad)">!</text>`;
  });
  const tx = x(today()); g += `<line x1="${tx}" x2="${tx}" y1="${T - 10}" y2="${H}" stroke="var(--accent)" stroke-width="2"/><text x="${tx + 3}" y="${T - 12}" style="font:600 10px var(--body);fill:var(--accent)">hari ini</text></svg>`;
  return g;
}
function stageEditor(rows) {
  return `<div class="tbl" style="margin-top:10px"><table style="min-width:860px" id="stTbl"><thead><tr><th style="width:26%">Tahap</th><th>Mulai plan</th><th>Selesai plan</th><th>Mulai aktual</th><th>Selesai aktual</th><th style="width:90px">Progress %</th><th>Catatan</th><th></th></tr></thead><tbody>
  ${rows.map((r, i) => `<tr><td><input data-i="${i}" data-f="tahap" value="${esc(r.tahap)}"></td><td><input type="date" data-i="${i}" data-f="mulaiPlan" value="${esc(r.mulaiPlan)}"></td><td><input type="date" data-i="${i}" data-f="selesaiPlan" value="${esc(r.selesaiPlan)}"></td><td><input type="date" data-i="${i}" data-f="mulaiAkt" value="${esc(r.mulaiAkt)}"></td><td><input type="date" data-i="${i}" data-f="selesaiAkt" value="${esc(r.selesaiAkt)}"></td><td><input type="number" min="0" max="100" step="5" data-i="${i}" data-f="progress" value="${num(r.progress)}"></td><td><input data-i="${i}" data-f="catatan" value="${esc(r.catatan || '')}"></td><td><button class="btn" data-rm="${i}" aria-label="Hapus">✕</button></td></tr>`).join('')}
  </tbody></table></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" id="stAdd">+ Tahap</button><button class="btn" id="stReset">Isi ulang dari template</button><span class="grow" style="flex:1"></span><button class="btn pri" id="stSave">Simpan tahapan</button><button class="btn" id="stX">Batal</button></div>
  <p class="muted" style="font-size:12px;margin:6px 0 0">Tips: isi "Mulai aktual" saat tahap mulai dikerjakan, "Selesai aktual" + progress 100% saat selesai. Nomor di depan nama tahap (1–6) dipakai untuk mencocokkan jam dari menu Lapor.</p>`;
}
function bindStageEditor(p) {
  const rows = PD.rows, sync = () => document.querySelectorAll('#stTbl [data-f]').forEach(inp => { rows[+inp.dataset.i][inp.dataset.f] = inp.dataset.f === 'progress' ? num(inp.value) : inp.value; });
  document.querySelectorAll('#stTbl [data-f]').forEach(inp => inp.onchange = () => { sync(); $('#pdG').innerHTML = ganttSvg(rows, p); });
  document.querySelectorAll('#stTbl [data-rm]').forEach(b => b.onclick = () => { sync(); rows.splice(+b.dataset.rm, 1); vProjDetail(p.id); });
  $('#stAdd').onclick = () => { sync(); const last = rows[rows.length - 1]; const st = last ? addDays(last.selesaiPlan, 1) : pStart(p); rows.push({ urut: rows.length + 1, tahap: (rows.length + 1) + '. ', mulaiPlan: st, selesaiPlan: addDays(st, 14), mulaiAkt: '', selesaiAkt: '', progress: 0, catatan: '' }); vProjDetail(p.id); };
  $('#stReset').onclick = () => { PD.rows = proposeStages(p); vProjDetail(p.id); };
  $('#stX').onclick = () => { PD.edit = false; PD.rows = null; vProjDetail(p.id); };
  $('#stSave').onclick = async () => { sync();
    for (const r of rows) { if (!r.tahap.trim()) return toast('Nama tahap tidak boleh kosong'); if (r.mulaiPlan && r.selesaiPlan && r.selesaiPlan < r.mulaiPlan) return toast('Tanggal selesai plan sebelum mulai: ' + r.tahap); }
    const out = rows.map((r, i) => ({ urut: i + 1, tahap: r.tahap.trim(), mulaiPlan: r.mulaiPlan, selesaiPlan: r.selesaiPlan, mulaiAkt: r.mulaiAkt, selesaiAkt: r.selesaiAkt, progress: num(r.progress), catatan: r.catatan || '' }));
    $('#stSave').disabled = true; const res = await teamSend('stages', { projectId: p.id, rows: out }); $('#stSave').disabled = false;
    if (res) { if (!DEMO) S.ST = S.ST.filter(x => x.projectId !== p.id).concat((res.rows || out).map(r => ({ ...r, projectId: p.id }))); PD.edit = false; PD.rows = null; toast('Tahapan tersimpan'); vProjDetail(p.id); } };
}

/* ---------- aplikasi HP (PWA) ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('#install').hidden = false; });
window.addEventListener('appinstalled', () => { $('#install').hidden = true; toast('Aplikasi terpasang di HP'); });
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (!standalone && /iphone|ipad/i.test(navigator.userAgent)) $('#install').hidden = false;
$('#install').onclick = async () => {
  if (installEvt) { installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('#install').hidden = true; return; }
  openModal(`<div class="hd"><h2>Pasang di iPhone</h2><button class="btn" data-close>✕</button></div><div class="bd"><ol style="margin:0;padding-left:20px;line-height:1.8"><li>Buka halaman ini di <b>Safari</b></li><li>Ketuk tombol <b>Share</b> (kotak dengan panah ke atas)</li><li>Pilih <b>Add to Home Screen</b> → <b>Add</b></li></ol></div>`);
};

load();
})();
