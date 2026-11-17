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
const S = { P: [], M: [], E: [], I: [], MV: [], cfg: {}, f: { jenis: 'all', q: '', status: '' }, g: { q: '', cat: '' } };
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
function askPin() {
  return new Promise(res => {
    const prev = $('#modal').innerHTML;
    const box = document.createElement('div'); box.className = 'scrim'; box.style.zIndex = 50;
    box.innerHTML = `<form class="dlg" style="width:min(360px,100%)"><div class="hd"><h2>Masukkan PIN</h2></div><div class="bd"><p class="muted" style="margin:0">PIN dibutuhkan untuk menyimpan perubahan. Tanya admin PSP.</p><input id="pinIn" type="password" inputmode="numeric" autocomplete="off"></div><div class="ft"><button class="btn pri">Lanjut</button><button type="button" class="btn" id="pinX">Batal</button></div></form>`;
    document.body.appendChild(box); box.querySelector('#pinIn').focus();
    box.querySelector('form').onsubmit = e => { e.preventDefault(); const v = box.querySelector('#pinIn').value.trim(); box.remove(); setPin(v); res(!!v); };
    box.querySelector('#pinX').onclick = () => { box.remove(); res(false); };
  });
}
async function write(action, payload) {
  if (!DEMO && !getPin() && !(await askPin())) return null;
  try { return await api(action, payload); }
  catch (e) {
    if (/PIN salah/.test(e.message)) { setPin(''); toast('PIN salah'); if (await askPin()) return write(action, payload); return null; }
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
  const r = (location.hash || '#dashboard').slice(1);
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + r));
  ({ dashboard: vDash, proyek: vProj, loading: vLoad, gudang: vGudang }[r] || vDash)();
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
  $('#view').innerHTML = `<div class="tiles">
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
  document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => projForm(b.dataset.p));
  document.querySelectorAll('[data-i]').forEach(b => b.onclick = () => itemDetail(b.dataset.i));
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => location.hash = b.dataset.go);
}
function attention(over, low) {
  const a = [];
  over.forEach(m => a.push(`<button class="li" style="--c:var(--bad)" data-go="#loading"><span><b>${esc(m.nama)}</b> loading ${loadOf(m.nrp, CUR).t}% bulan ini<small>${loadOf(m.nrp, CUR).list.length} proyek bersamaan</small></span></button>`));
  S.P.filter(late).forEach(p => a.push(`<button class="li" style="--c:var(--warn)" data-p="${esc(p.id)}"><span><b>Terlambat:</b> ${esc(p.nama)}<small>${esc(p.kode)} · selesai ${mName(p.selesai)} · ${esc(p.status)}</small></span></button>`));
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
  document.querySelectorAll('tr[data-p]').forEach(r => { r.onclick = () => projForm(r.dataset.p); r.onkeydown = e => { if (e.key === 'Enter') projForm(r.dataset.p); }; });
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
