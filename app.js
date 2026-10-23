/* M&J CUP — tính điểm pickleball trực tiếp.
   Người xem: /mj-cup/        BTC chấm điểm: /mj-cup/#admin */

const CFG = window.MJ_SUPABASE && window.MJ_SUPABASE.url && window.MJ_SUPABASE.anonKey ? window.MJ_SUPABASE : null;
const SB_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
const INC = n => ({ __inc: n });
const NOW = { __now: 1 };
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const signed = n => (n > 0 ? '+' + n : String(n));

// ---------- Cấu trúc giải (theo sơ đồ + lịch thi đấu của BTC) ----------
const MEN = [
  'Vũ Thành Lâm & Việt Anh Cisco',
  'Phong Hoàng & Phạm Hồng Hải',
  'Tíu & Tùng Đỗ',
  'Nguyễn Sơn Hải & Đoàn Quang Tuấn',
  'Trần Phạm Việt Anh & Ngô Tuấn Thành',
  'Tuấn Anh & Hoàng',
];
const MIX = [
  'Thoa Maika & Trần Phạm Việt Anh',
  'Hải Anh & Lê Hoàn',
  'Bảo Ngọc & Trần Danh Thái',
  'Huyền Hí Hí & Đoàn Quang Tuấn',
  'Emly & Trung SSS',
  'Doen & Tíu',
  'Lê Thanh Loan & Lucifer',
  'Thuhadey & Chu Lý Quỳnh',
  'Phong & Phương Bi',
  'Vũ Ngọc Anh & Hoàng Minh Tiến',
  'Go Han & Hoàng',
  'Nana & Tú Cisco',
];
// Đôi nam: 15 trận vòng tròn, đánh số theo thứ tự xuất hiện trong lịch.
const MEN_PAIRS = [[1, 6], [2, 3], [2, 5], [4, 6], [4, 5], [1, 3], [1, 5], [3, 4], [3, 5], [2, 6], [1, 4], [5, 6], [2, 4], [1, 2], [3, 6]];
// Đôi nam nữ Vòng 1: 12 trận, mỗi cặp đánh 2 trận.
const MIX_PAIRS = [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [10, 11], [8, 9], [2, 5], [6, 7], [12, 3], [4, 1]];

const MEN_TEAMS = MEN.map((_, i) => 'm' + (i + 1));
const MIX_TEAMS = MIX.map((_, i) => 'x' + (i + 1));
const TEAM_IDS = [...MEN_TEAMS, ...MIX_TEAMS];
const MEN_IDS = MEN_PAIRS.map((_, i) => 'N' + pad(i + 1));
const R1_IDS = MIX_PAIRS.map((_, i) => 'R' + (i + 1));
const QF_IDS = ['Q1', 'Q2', 'Q3', 'Q4'];
const SF_IDS = ['S1', 'S2'];
const ALL_IDS = [...MEN_IDS, 'MF', ...R1_IDS, ...QF_IDS, ...SF_IDS, 'F'];

const DEF = {};
MEN_IDS.forEach((id, i) => (DEF[id] = { ev: 'men', label: `Trận ${i + 1}` }));
R1_IDS.forEach((id, i) => (DEF[id] = { ev: 'mix', label: `Vòng 1 · Trận ${i + 1}` }));
Object.assign(DEF, {
  MF: { ev: 'men', label: 'Chung kết', src: [['rank', 1], ['rank', 2]] },
  Q1: { ev: 'mix', label: 'Trận 8.1', src: [['seed', 1], ['seed', 8]] },
  Q2: { ev: 'mix', label: 'Trận 8.2', src: [['seed', 4], ['seed', 5]] },
  Q3: { ev: 'mix', label: 'Trận 8.3', src: [['seed', 2], ['seed', 7]] },
  Q4: { ev: 'mix', label: 'Trận 8.4', src: [['seed', 3], ['seed', 6]] },
  S1: { ev: 'mix', label: 'Bán kết 1', src: [['win', 'Q1'], ['win', 'Q2']] },
  S2: { ev: 'mix', label: 'Bán kết 2', src: [['win', 'Q3'], ['win', 'Q4']] },
  F: { ev: 'mix', label: 'Chung kết', src: [['win', 'S1'], ['win', 'S2']] },
});
const EV_NAME = { men: 'Đôi nam', mix: 'Đôi nam nữ' };
const fullLabel = id => EV_NAME[DEF[id].ev] + ' · ' + DEF[id].label;
const srcLabel = ([k, v]) => {
  if (k === 'rank') return `Hạng ${v} vòng tròn`;
  if (k === 'seed') return `Hạng ${v} Vòng 1`;
  const l = DEF[v].label;
  return 'Thắng ' + l[0].toLowerCase() + l.slice(1);
};

// Lịch thi đấu 2 sân: mỗi lượt [giờ, trận ở sân thứ nhất, trận ở sân thứ hai].
const SLOTS = [
  ['08:15', 'R1', 'R2'], ['08:25', 'N01', 'N02'], ['08:40', 'N03', 'N04'], ['08:55', 'R3', 'R4'],
  ['09:05', 'R5', 'R6'], ['09:15', 'N05', 'N06'], ['09:30', 'R7', 'R8'], ['09:40', 'N07', 'N08'],
  ['09:55', 'N09', 'N10'], ['10:10', 'R9', 'N11'], ['10:25', 'R10', 'R11'], ['10:35', 'N12', 'N13'],
  ['10:50', 'N14', 'N15'], ['11:05', 'R12', null],
  ['11:15', 'Q1', 'Q2'], ['11:25', 'Q3', 'Q4'], ['11:35', 'S1', 'S2'],
  ['11:45', 'MF', 'F'],
];
const WARMUP = { time: '08:00', text: 'Khởi động · làm quen sân', note: '15 phút' };
const PHASE_AT = { 0: 'p1', 14: 'p2', 17: 'p3' }; // lượt bắt đầu mỗi phần
const COURTS = ['3', '33'];
const SLOT_OF = {};
SLOTS.forEach(([, ...ids], i) => ids.forEach((id, c) => id && (SLOT_OF[id] = { i, c })));

function makeSeed() {
  const teams = {}, matches = {};
  MEN.forEach((n, i) => (teams[MEN_TEAMS[i]] = { name: n }));
  MIX.forEach((n, i) => (teams[MIX_TEAMS[i]] = { name: n }));
  MEN_PAIRS.forEach(([a, b], i) => (matches[MEN_IDS[i]] = { a: 'm' + a, b: 'm' + b, sa: 0, sb: 0, st: 'pending' }));
  MIX_PAIRS.forEach(([a, b], i) => (matches[R1_IDS[i]] = { a: 'x' + a, b: 'x' + b, sa: 0, sb: 0, st: 'pending' }));
  ['MF', ...QF_IDS, ...SF_IDS, 'F'].forEach(id => (matches[id] = { sa: 0, sb: 0, st: 'pending' }));
  return { meta: { target: 11, mixTarget: 7, finalTarget: 11, winBy: 1, courts: COURTS }, teams, matches };
}

// Nhóm các dòng bằng nhau mọi chỉ số (trừ thứ tự BTC tự xếp) để BTC quyết định.
function markTies(list, keyFn) {
  const groups = {};
  list.forEach(r => (groups[(r.key = keyFn(r))] ||= []).push(r));
  Object.values(groups).forEach(g => g.length > 1 && g.forEach((r, i) => { r.tie = true; r.tieTop = i === 0; }));
}

// ---------- Tính bảng xếp hạng + nhánh đấu từ kết quả ----------
function derive(S) {
  const M = S.matches || {}, T = S.teams || {}, tb = S.tb || {};
  const meta = { target: 11, mixTarget: 7, finalTarget: 11, winBy: 1, ...(S.meta || {}) };
  if (!Array.isArray(meta.courts)) meta.courts = COURTS;
  const times = meta.times || {};
  const st = id => (M[id] && M[id].st) || 'pending';
  const name = id => (T[id] && T[id].name) || '—';

  // Bảng điểm vòng tròn / vòng bảng: số trận thắng → hiệu số → tổng điểm → BTC xếp tay.
  function standings(teamIds, matchIds) {
    const rows = teamIds.map(id => ({ id, p: 0, w: 0, f: 0, a: 0 }));
    const row = Object.fromEntries(rows.map(r => [r.id, r]));
    matchIds.forEach(id => {
      const m = M[id];
      if (st(id) !== 'done' || !row[m.a] || !row[m.b]) return;
      const A = row[m.a], B = row[m.b];
      A.p++; B.p++;
      A.f += m.sa; A.a += m.sb; B.f += m.sb; B.a += m.sa;
      (m.sa > m.sb ? A : B).w++;
    });
    rows.forEach(r => (r.diff = r.f - r.a));
    rows.sort((x, y) => y.w - x.w || y.diff - x.diff || y.f - x.f || (tb[y.id] || 0) - (tb[x.id] || 0));
    rows.forEach((r, i) => (r.rank = i + 1));
    const done = matchIds.every(id => st(id) === 'done');
    if (done) markTies(rows, r => `${r.w}|${r.diff}|${r.f}`);
    return { rows, done };
  }
  const { rows: men, done: menDone } = standings(MEN_TEAMS, MEN_IDS);
  const { rows: mixT, done: r1Done } = standings(MIX_TEAMS, R1_IDS);
  const top = { rank: menDone ? men.map(r => r.id) : null, seed: r1Done ? mixT.slice(0, 8).map(r => r.id) : null };

  const memo = {};
  function sides(id) {
    if (memo[id]) return memo[id];
    const m = M[id] || {}, d = DEF[id];
    if (!d.src) return (memo[id] = { a: m.a, b: m.b });
    // Đã bắt đầu thì giữ nguyên cặp đã chốt (m.a/m.b), không đổi theo kết quả sửa sau.
    return (memo[id] = {
      a: m.a || resolve(d.src[0]), b: m.b || resolve(d.src[1]),
      la: srcLabel(d.src[0]), lb: srcLabel(d.src[1]),
    });
  }
  function resolve([k, v]) { return k === 'win' ? winner(v) : top[k] ? top[k][v - 1] : null; }
  function winner(id) {
    if (st(id) !== 'done') return null;
    const m = M[id], s = sides(id);
    return m.sa > m.sb ? s.a : s.b;
  }
  const slotTime = i => times[i] || SLOTS[i][0];
  const where = id => {
    const at = SLOT_OF[id], m = M[id] || {};
    return { time: at ? slotTime(at.i) : '', court: m.court || (at ? meta.courts[at.c] || COURTS[at.c] : ''), slot: at ? at.i : -1 };
  };
  const targetOf = id => (id === 'F' || id === 'MF' ? meta.finalTarget : DEF[id].ev === 'mix' ? meta.mixTarget : meta.target);

  return { M, T, meta, st, name, sides, winner, men, menDone, mixT, r1Done, slotTime, where, targetOf, warmTime: times.w || WARMUP.time };
}

// Giao bóng đánh đôi: đầu trận bên giao trước chỉ có người số 2 (gọi điểm "0–0–2").
// Chỉ để BTC theo dõi — chấm điểm không phụ thuộc vào lượt giao.
const serve = m => ({ srv: m.srv || 'a', sn: m.sn || 2 });

const isOver = (sa, sb, target, winBy) => {
  const hi = Math.max(sa, sb), lo = Math.min(sa, sb);
  return hi >= target && hi - lo >= winBy;
};

// Tìm tên không phân biệt dấu: "tiu" khớp "Tíu", "dong" khớp "Đông".
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

// ---------- Trạng thái ----------
let S = null, loaded = false, authReady = false, isAdmin = false;
let conn = null; // null = đang kết nối lần đầu
let lastView = null;
const STATIC = new Set(['set', 'edit', 'login', 'wait', 'init']); // view có form: không vẽ lại khi dữ liệu đổi
const store = { mode: CFG ? 'server' : 'demo' };
const app = document.getElementById('app');

function onData(cup) { S = cup; loaded = true; render(false); }

// Áp bản vá {'matches/N01/sa': INC(1), ...} vào dữ liệu — cùng logic với hàm cup_patch trong supabase.sql.
function applyPatch(data, up) {
  for (const [k, v] of Object.entries(up)) {
    const parts = k.split('/'), last = parts.pop();
    let o = data;
    for (const p of parts) o = o[p] && typeof o[p] === 'object' ? o[p] : (o[p] = {});
    const val = v && v.__inc !== undefined ? (o[last] || 0) + v.__inc : v && v.__now ? Date.now() : v;
    if (val === null) delete o[last]; else o[last] = val;
  }
}

async function initSupabase() {
  const { createClient } = await import(SB_LIB);
  const sb = createClient(CFG.url, CFG.anonKey);
  // ver tăng 1 sau mỗi lần ghi. Trong lúc máy này đang ghi, giữ điểm hiện trên màn hình
  // và bỏ qua bản cũ từ máy chủ để số không bị nhảy lùi khi bấm nhanh.
  let ver = 0, minVer = 0, pending = 0, stash = null;
  const incoming = row => {
    if (pending) { if (!stash || row.ver > stash.ver) stash = row; return; }
    if (row.ver < Math.max(ver, minVer)) return;
    ver = row.ver;
    onData(row.data);
  };
  const refetch = async () => {
    const { data, error } = await sb.from('cup').select('data, ver').eq('id', 'mj').maybeSingle();
    if (error) return toast('Không đọc được dữ liệu: ' + error.message);
    if (pending) return;
    if (!data) { ver = 0; return onData(null); }
    if (data.ver >= ver) { ver = data.ver; onData(data.data); }
  };

  sb.channel('cup-mj')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cup', filter: 'id=eq.mj' }, p => {
      if (p.eventType === 'DELETE') { ver = 0; onData(null); } else incoming(p.new);
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') { conn = true; refetch(); } // vào lại sau khi rớt mạng: lấy bản mới nhất
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') conn = false;
      paintConn();
    });
  // Điện thoại tắt màn hình thường cắt kết nối — mở lại thì tải bản mới nhất ngay.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refetch(); });
  refetch();

  // BTC nhập mật khẩu một lần; máy chủ kiểm tra lại mật khẩu ở mỗi lần ghi.
  const PW_KEY = 'mjcup-btc-pw';
  let pw = null;
  try { pw = localStorage.getItem(PW_KEY); } catch (e) { /* trình duyệt chặn lưu */ }
  const forget = () => { pw = null; isAdmin = false; try { localStorage.removeItem(PW_KEY); } catch (e) {} };
  const check = async candidate => {
    const { data, error } = await sb.rpc('cup_check', { pw: candidate });
    if (error) throw error;
    return data === true;
  };
  if (pw) { try { isAdmin = await check(pw); } catch (e) { isAdmin = false; } if (!isAdmin) forget(); }
  authReady = true;
  render(true);

  store.write = async up => {
    if (S) { applyPatch(S, up); render(false); }
    pending++;
    const { data, error } = await sb.rpc('cup_patch', { ops: up, pw });
    pending--;
    if (error) {
      stash = null; refetch();
      if (/42501|permission/i.test(`${error.code} ${error.message}`)) { forget(); render(true); } // mật khẩu đã bị đổi
      throw error;
    }
    minVer = Math.max(minVer, data);
    if (!pending && stash) { const row = stash; stash = null; incoming(row); }
  };
  store.seed = async () => {
    const { error } = await sb.rpc('cup_init', { doc: makeSeed(), pw });
    if (error) throw error;
    await refetch();
  };
  store.login = async candidate => {
    if (!(await check(candidate))) return false;
    pw = candidate; isAdmin = true;
    try { localStorage.setItem(PW_KEY, pw); } catch (e) {}
    render(true);
    return true;
  };
  store.logout = async () => { forget(); };
}

function initDemo() {
  const KEY = 'mjcup-demo-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* trình duyệt chặn lưu */ } };
  const emit = () => onData(JSON.parse(JSON.stringify(data)));
  let data = load() || makeSeed();
  // Đồng bộ giữa các tab trên cùng máy để thử "BTC nhập — người xem thấy".
  window.addEventListener('storage', e => { if (e.key === KEY) { data = load() || makeSeed(); emit(); } });
  store.write = async up => { applyPatch(data, up); save(); emit(); };
  store.seed = async () => { data = makeSeed(); save(); emit(); };
  store.logout = async () => {};
  authReady = true; isAdmin = true; conn = true;
  emit();
}

async function write(up) {
  try { await store.write(up); }
  catch (e) {
    const why = e ? `${e.code || ''} ${e.message || e}` : '';
    toast(/permission|42501/i.test(why) ? 'Không có quyền ghi — kiểm tra tài khoản BTC' : 'Lỗi lưu: ' + ((e && e.message) || e));
  }
}

// ---------- Điều hướng ----------
const TABS = [['lich', 'Lịch đấu'], ['men', 'Đôi nam'], ['mix', 'Đôi nam nữ']];
function route() {
  const parts = decodeURIComponent(location.hash.slice(1)).split('/');
  if (parts[0] === 'admin') {
    if (parts[1] === 'm' && DEF[parts[2]]) return { admin: true, match: parts[2], view: parts[3] === 'edit' ? 'edit' : 'score' };
    const tab = ['men', 'mix', 'set'].includes(parts[1]) ? parts[1] : 'lich';
    return { admin: true, tab, view: tab };
  }
  const tab = ['men', 'mix'].includes(parts[0]) ? parts[0] : 'lich';
  return { admin: false, tab, view: tab };
}
const tabHref = (admin, k) => (admin ? (k === 'lich' ? '#admin' : '#admin/' + k) : '#' + k);
const evOf = id => DEF[id].ev; // 'men' | 'mix'
let listHash = '#admin'; // trang danh sách BTC mở trận từ đó — nút quay lại về đúng chỗ
const ui = { q: '' };
try { ui.q = localStorage.getItem('mjcup-find') || ''; } catch (e) {}

function render(force) {
  const r = route();
  let v = r.view;
  if (r.admin && !authReady) v = 'wait';
  else if (r.admin && !isAdmin) v = 'login';
  else if (!loaded) v = 'loading';
  else if (r.admin && !S) v = 'init';
  if (!force && STATIC.has(v) && v === lastView) return;
  lastView = v;

  const D = derive(S || makeSeed());
  const views = {
    lich: () => viewSchedule(D, r.admin), men: () => viewMen(D, r.admin), mix: () => viewMix(D, r.admin),
    set: () => viewSet(D), score: () => viewScore(D, r.match), edit: () => viewEdit(D, r.match),
    login: viewLogin, init: viewInit,
    wait: () => '<div class="boot">Đang kiểm tra đăng nhập…</div>',
    loading: () => '<div class="boot">Đang tải dữ liệu giải…</div>',
  };
  const focus = v === 'score' || v === 'edit';
  // Đang gõ ô tìm tên mà tỉ số cập nhật: vẽ lại xong thì trả con trỏ về ô tìm.
  const typing = document.activeElement && document.activeElement.matches('[data-find]');
  app.innerHTML =
    (focus ? '' : hero(D, r)) +
    (r.admin && isAdmin && !focus ? adminBar() : '') +
    (!r.admin && isAdmin && store.mode === 'server' ? '<a class="to-admin" href="#admin">Bạn là BTC · <b>Mở trang chấm điểm ›</b></a>' : '') +
    (['lich', 'men', 'mix', 'set'].includes(v) ? tabs(D, r) : '') +
    `<main class="wrap">${!S && loaded && !r.admin ? '<p class="note">BTC chưa mở giải — tỉ số sẽ hiện ở đây khi trận đầu bắt đầu.</p>' : ''}${views[v]()}</main>` +
    (focus ? '' : footer(r));
  paintConn();
  if (typing) { const f = app.querySelector('[data-find]'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }
}

// ---------- Khối giao diện dùng chung ----------
function hero(D, r) {
  const m = D.meta;
  return `<header class="hero">
    <h1 class="logo">M&amp;J CUP</h1>
    <p class="sub">Giải pickleball kỷ niệm một năm ngày cưới <b>Mike &amp; Go Han</b></p>
    <div class="rule"><span class="rule-tag">Luật chung</span><span>Đánh chạm <b>${m.target}</b> trước là thắng${m.winBy > 1 ? ` · cách ${m.winBy} điểm` : ''}<small> · Đôi nam nữ chạm ${m.mixTarget}, riêng chung kết chạm ${m.finalTarget}</small></span></div>
    <div class="conn" id="conn"></div>
  </header>`;
}

function paintConn() {
  const el = document.getElementById('conn');
  if (!el) return;
  if (store.mode === 'demo') { el.className = 'conn demo'; el.textContent = 'Chế độ thử · chưa nối Supabase'; return; }
  el.className = 'conn ' + (conn === false ? 'off' : conn ? 'on' : '');
  el.innerHTML = conn === false ? '<i></i>Mất kết nối — đang thử lại' : conn ? '<i></i>Cập nhật trực tiếp' : '<i></i>Đang kết nối…';
}

function adminBar() {
  const who = store.mode === 'demo' ? 'Chế độ thử' : 'Đang chấm điểm';
  return `<div class="adminbar"><span class="ab-tag">BTC</span><span class="ab-who">${who}</span>
    <a href="#admin/set" class="ab-btn${route().tab === 'set' ? ' on' : ''}">${ICON.gear} Cài đặt</a>
    <a href="#lich" class="ab-link">Trang người xem</a>
    ${store.mode === 'server' ? '<button class="ab-link" data-act="logout">Thoát BTC</button>' : ''}</div>`;
}

function tabs(D, r) {
  return `<nav class="tabs${r.admin ? ' admin' : ''}">${TABS.map(([k, t]) => {
    const live = ALL_IDS.filter(id => (k === 'lich' || evOf(id) === k) && D.st(id) === 'live').length;
    return `<a href="${tabHref(r.admin, k)}" class="${r.tab === k ? 'on' : ''}">${t}${live ? `<span class="cnt" title="Đang đấu">${live}</span>` : ''}</a>`;
  }).join('')}</nav>`;
}

function footer(r) {
  return `<footer class="foot">
    <button class="btn ghost" data-act="share">${ICON.share} Chia sẻ link xem tỉ số</button>
    <p>M&amp;J CUP · Tỉ số do BTC cập nhật trực tiếp${r.admin ? '' : ' · <a href="#admin">Đăng nhập BTC</a>'}</p>
  </footer>`;
}

const ICON = {
  gear: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
};

const pair = n => esc(n).split(' &amp; ').map(p => `<span>${p}</span>`).join('');
const teamCell = (D, id, ph) => (id ? `<span class="pair">${pair(D.name(id))}</span>` : `<span class="ph">${esc(ph || 'Chưa xác định')}</span>`);

function badge(m, ready) {
  if (m.st === 'live') return '<span class="badge live"><i></i>Đang đấu</span>';
  if (m.st === 'done') return '<span class="badge done">Kết thúc</span>';
  return `<span class="badge">${ready ? 'Chờ đấu' : 'Chờ xác định'}</span>`;
}

function card(D, id, admin, opt = {}) {
  const m = { st: 'pending', sa: 0, sb: 0, ...(D.M[id] || {}) };
  const s = D.sides(id), ready = !!(s.a && s.b);
  const fin = m.st === 'done', pend = m.st === 'pending';
  const cls = side => {
    if (!fin) return m.st === 'live' && m['s' + side] > m['s' + (side === 'a' ? 'b' : 'a')] ? ' lead' : '';
    return m['s' + side] > m['s' + (side === 'a' ? 'b' : 'a')] ? ' win' : ' lose';
  };
  const tap = admin && ready;
  const tag = tap ? `a href="#admin/m/${id}"` : 'div';
  const srvTag = side => (m.st === 'live' && m.srv === side ? `<span class="srv-tag" title="Đang giao bóng"><i class="ball"></i>giao${m.sn ? ' ' + m.sn : ''}</span>` : '');
  const w = D.where(id);
  return `<${tag} class="mc st-${m.st}${opt.big ? ' big' : ''}${id === 'F' || id === 'MF' ? ' final' : ''}${tap ? ' tap' : ''}">
    <div class="mc-head"><span class="mc-label"><b class="mc-time">${w.time}</b> · Sân ${esc(w.court)} · ${esc(opt.full ? fullLabel(id) : DEF[id].label)}</span>${badge(m, ready)}</div>
    <div class="mc-row${cls('a')}">${teamCell(D, s.a, s.la)}${srvTag('a')}<span class="sc">${pend ? '–' : m.sa}</span></div>
    <div class="mc-row${cls('b')}">${teamCell(D, s.b, s.lb)}${srvTag('b')}<span class="sc">${pend ? '–' : m.sb}</span></div>
  </${tap ? 'a' : 'div'}>`;
}
const cards = (D, ids, admin, opt) => `<div class="cards">${ids.map(id => card(D, id, admin, opt)).join('')}</div>`;

const evHead = (pill, cls, title, meta) =>
  `<div class="ev-head"><span class="pill ${cls}">${pill}</span><span class="ev-title">${title}</span><span class="ev-meta">${meta}</span></div>`;
const sub = (t, cls = '') => `<h3 class="sub-h"><span class="pill sm ${cls}">${t}</span></h3>`;

function champ(D, title, id, placeholder) {
  if (!id && !placeholder) return '';
  return `<div class="champ${id ? '' : ' wait'}"><div class="champ-ic">${ICON.trophy}</div>
    <div><div class="champ-t">${title}</div><div class="champ-n">${id ? esc(D.name(id)) : 'Chờ chung kết'}</div></div></div>`;
}

const tieBtn = (admin, r, list) =>
  admin && r.tie && !r.tieTop ? `<button class="tb" data-act="tb" data-list="${list}" data-id="${r.id}" aria-label="Xếp lên trên">▲</button>` : '';

// Các trận đang đấu của một hạng mục, hiện ở đầu tab.
function liveBlock(D, ev, admin) {
  const live = ALL_IDS.filter(id => evOf(id) === ev && D.st(id) === 'live')
    .sort((x, y) => D.where(x).slot - D.where(y).slot);
  return (admin ? '<p class="hint">Chạm vào một trận để chấm điểm.</p>' : '') +
    (live.length ? `<section class="sec"><h2 class="sec-h"><span class="dot"></span>Đang thi đấu</h2>${cards(D, live, admin, { big: true })}</section>` : '');
}

// ---------- Trang: Lịch đấu ----------
function game(D, id, admin, q) {
  const m = { st: 'pending', sa: 0, sb: 0, ...(D.M[id] || {}) };
  const s = D.sides(id), ready = !!(s.a && s.b), w = D.where(id), ev = evOf(id);
  const fin = m.st === 'done', pend = m.st === 'pending';
  const hit = side => q && s[side] && fold(D.name(s[side])).includes(q);
  const row = side => {
    const o = side === 'a' ? 'b' : 'a';
    const res = fin ? (m['s' + side] > m['s' + o] ? ' win' : ' lose') : m.st === 'live' && m['s' + side] > m['s' + o] ? ' lead' : '';
    const srv = m.st === 'live' && m.srv === side ? '<i class="ball" title="Đang giao bóng"></i>' : '';
    return `<div class="gm-row${res}${hit(side) ? ' me' : ''}">${teamCell(D, s[side], s['l' + side])}${srv}<span class="sc">${pend ? '' : m['s' + side]}</span></div>`;
  };
  const tap = admin && ready;
  const tag = tap ? `a href="#admin/m/${id}"` : 'div';
  const label = DEF[id].label.replace('Vòng 1 · ', ''); // thẻ đã ghi hạng mục, bỏ chữ thừa cho gọn
  return `<${tag} class="gm st-${m.st}${id === 'F' || id === 'MF' ? ' final' : ''}${tap ? ' tap' : ''}">
    <div class="gm-top">${m.st === 'live' ? '<i class="live-dot" title="Đang đấu"></i>' : ''}<span class="court">Sân ${esc(w.court)}</span><span class="evc ${ev}">${ev === 'men' ? 'Đôi nam' : 'Nam nữ'}</span>
      <span class="gm-lbl">${esc(label)} · chạm ${D.targetOf(id)}</span></div>
    ${row('a')}${row('b')}
  </${tap ? 'a' : 'div'}>`;
}

function viewSchedule(D, admin) {
  const q = fold(ui.q);
  // Lượt "hiện tại": lượt có trận đang đấu; chưa có thì lượt sớm nhất còn trận chưa đánh.
  const slotSt = SLOTS.map(([, ...ids]) => ids.filter(Boolean).map(id => D.st(id)));
  let cur = slotSt.findIndex(a => a.includes('live'));
  const isNow = cur >= 0;
  if (!isNow) cur = slotSt.findIndex(a => a.some(x => x !== 'done'));
  const phaseTitle = {
    p1: `Phần 1 · Đôi nam vòng tròn (chạm ${D.meta.target}) + Vòng 1 Đôi nam nữ (chạm ${D.meta.mixTarget})`,
    p2: `Phần 2 · Loại trực tiếp Đôi nam nữ (chạm ${D.meta.mixTarget})`,
    p3: `Phần 3 · Hai trận chung kết (chạm ${D.meta.finalTarget}) · đánh cùng lúc 2 sân`,
  };
  let found = 0, h = '';
  if (!q) h += `<div class="warm"><b>${esc(D.warmTime)}</b><span>${WARMUP.text}</span><small>${WARMUP.note}</small></div>`;
  SLOTS.forEach(([, ...ids], i) => {
    const shown = ids.filter(id => {
      if (!id) return false;
      if (!q) return true;
      const s = D.sides(id);
      return [s.a, s.b].some(t => t && fold(D.name(t)).includes(q));
    });
    if (!q && PHASE_AT[i]) h += `<div class="phase">${phaseTitle[PHASE_AT[i]]}</div>`;
    if (!shown.length) return;
    found += shown.length;
    const done = slotSt[i].every(x => x === 'done');
    const tag = i === cur ? (isNow ? '<span class="now-tag">Đang đánh</span>' : '<span class="now-tag next">Tiếp theo</span>') : '';
    h += `<div class="slot${i === cur ? ' cur' : ''}${done ? ' done' : ''}" id="slot-${i}">
      <div class="slot-time"><b>${esc(D.slotTime(i))}</b><span>Lượt ${i + 1}</span>${tag}</div>
      <div class="slot-games">${shown.map(id => game(D, id, admin, q)).join('')}${!q && ids.includes(null) ? '<div class="gm empty-court">Sân trống</div>' : ''}</div>
    </div>`;
  });
  const jump = !q && cur >= 0
    ? `<button class="jump" data-act="jump" data-slot="${cur}">${isNow ? '<i class="live-dot"></i>Đang đánh' : 'Tiếp theo'}: <b>${esc(D.slotTime(cur))}</b> · Lượt ${cur + 1} <span>›</span></button>` : '';
  const doneAll = ALL_IDS.filter(id => D.st(id) === 'done').length;
  return `<div class="sched-head">
      <div class="ev-head"><span class="pill navy">Lịch thi đấu</span><span class="ev-meta">${D.meta.courts.length} sân · ${doneAll}/${ALL_IDS.length} trận xong</span></div>
      ${champ(D, 'Vô địch Đôi nam', D.winner('MF'))}${champ(D, 'Vô địch Đôi nam nữ', D.winner('F'))}
      <label class="find">${ICON.search}<input data-find type="search" placeholder="Tìm tên bạn để xem trận của mình" value="${esc(ui.q)}" autocomplete="off" enterkeyhint="search">${ui.q ? '<button type="button" data-act="find-clear" aria-label="Xoá tìm kiếm">×</button>' : ''}</label>
      ${q ? `<p class="fine top">${found ? `${found} trận có “${esc(ui.q)}”` : `Không thấy trận nào có “${esc(ui.q)}”`}${found ? ' · trận vòng sau hiện khi đã rõ cặp' : ''}</p>` : jump}
      ${admin ? '<p class="hint">Chạm vào một trận để chấm điểm.</p>' : ''}
    </div>
    <div class="sched">${h}</div>`;
}

// ---------- Trang: Đôi nam ----------
function standingsTable(D, rows, done, list, admin, qualify) {
  const ties = rows.some(r => r.tie);
  return `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>#</th><th class="l">Cặp đấu</th><th>Trận</th><th class="hot">Thắng</th><th class="hot">HS</th></tr></thead>
      <tbody>${rows.map(r => `<tr class="${done ? (r.rank <= qualify ? 'in' : 'out') : ''}">
        <td class="rk"><span class="num">${r.p || done ? r.rank : '–'}</span>${r.tie ? '<sup>=</sup>' : ''}</td>
        <td class="l"><div class="cell">${teamCell(D, r.id)}${tieBtn(admin, r, list)}</div></td>
        <td>${r.p}</td><td class="b">${r.w}</td><td class="${r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : ''}">${signed(r.diff)}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="fine">Xếp theo số trận thắng → hiệu số → tổng điểm ghi được.${ties ? ' <b>=</b> bằng mọi chỉ số: BTC quyết định thứ tự.' : ''}</p>`;
}

function viewMen(D, admin) {
  const played = MEN_IDS.filter(id => D.st(id) === 'done').length;
  return `${evHead('Đôi nam', 'pink', 'Vòng tròn 1 bảng → Chung kết', `${MEN.length} cặp · ${played}/${MEN_IDS.length} trận`)}
    ${champ(D, 'Vô địch Đôi nam', D.winner('MF'))}
    ${liveBlock(D, 'men', admin)}
    <section class="sec"><h2 class="sec-h">Bảng xếp hạng${D.menDone ? '' : ' <small>tạm tính</small>'}</h2>
    ${standingsTable(D, D.men, D.menDone, 'men', admin, 2)}
    <p class="fine">Hạng 1 và hạng 2 vào Chung kết (chạm ${D.meta.finalTarget}).</p></section>
    <section class="sec"><h2 class="sec-h">Vòng tròn · chạm ${D.meta.target}</h2>${cards(D, MEN_IDS, admin)}</section>
    <section class="sec">${sub('Chung kết', 'yellow')}${cards(D, ['MF'], admin, { big: true })}${champ(D, 'Vô địch Đôi nam', D.winner('MF'), true)}</section>`;
}

// ---------- Trang: Đôi nam nữ ----------
function viewMix(D, admin) {
  const played = R1_IDS.filter(id => D.st(id) === 'done').length;
  return `${evHead('Đôi nam nữ', 'lime', 'Vòng 1 → Loại trực tiếp', `${MIX.length} cặp · ${played}/${R1_IDS.length} trận vòng 1`)}
    ${champ(D, 'Vô địch Đôi nam nữ', D.winner('F'))}
    ${liveBlock(D, 'mix', admin)}
    <section class="sec">${sub('Vòng 1', 'navy')}<p class="fine top">Mỗi cặp đánh 2 trận, chạm ${D.meta.mixTarget} · 8 cặp đầu vào Vòng 8 đội.</p>
    <h2 class="sec-h">Xếp hạng Vòng 1${D.r1Done ? '' : ' <small>tạm tính</small>'}</h2>
    ${standingsTable(D, D.mixT, D.r1Done, 'mix', admin, 8)}</section>
    <section class="sec"><h2 class="sec-h">Các trận Vòng 1</h2>${cards(D, R1_IDS, admin)}</section>
    <section class="sec">${sub('Vòng 8 đội', 'navy')}${cards(D, QF_IDS, admin)}</section>
    <section class="sec">${sub('Bán kết', 'navy')}${cards(D, SF_IDS, admin)}</section>
    <section class="sec">${sub('Chung kết', 'yellow')}<p class="fine top">Chạm ${D.meta.finalTarget}.</p>${cards(D, ['F'], admin, { big: true })}${champ(D, 'Vô địch', D.winner('F'), true)}</section>`;
}

// ---------- BTC: chấm điểm 1 trận ----------
function viewScore(D, id) {
  const m = { st: 'pending', sa: 0, sb: 0, ...(D.M[id] || {}) };
  const s = D.sides(id), meta = D.meta;
  const back = `<div class="sc-top"><a href="${listHash}" class="back">‹ Danh sách trận</a><span class="conn" id="conn"></span></div>`;
  if (!s.a || !s.b) return back + `<h2 class="sc-title">${esc(fullLabel(id))}</h2><p class="empty">Trận này chưa xác định đủ 2 cặp.</p>`;
  const target = D.targetOf(id), w = D.where(id);
  const fin = m.st === 'done', over = isOver(m.sa, m.sb, target, meta.winBy);
  const { srv, sn } = serve(m);
  const panel = side => {
    const v = m['s' + side], o = m['s' + (side === 'a' ? 'b' : 'a')];
    return `<div class="pn pn-${side}${v > o ? ' lead' : ''}${fin ? (v > o ? ' win' : ' lose') : ''}">
      <button class="pn-hit" data-act="pt" data-side="${side}" ${fin || over ? 'disabled' : ''}>
        <span class="pn-srv${!fin && srv === side ? '' : ' off'}"><i class="ball"></i>Giao bóng · người ${sn}</span>
        <span class="pn-name">${pair(D.name(s[side]))}</span>
        <span class="pn-score">${v}</span>
        <span class="pn-hint">${fin ? (v > o ? 'Thắng' : '') : over ? '' : 'Chạm để +1'}</span>
      </button>
      <button class="pn-minus" data-act="minus" data-side="${side}" ${fin || !v ? 'disabled' : ''} aria-label="Trừ 1 điểm">−1</button>
    </div>`;
  };
  const winner = m.sa > m.sb ? s.a : s.b;
  const call = srv === 'a' ? `${m.sa} – ${m.sb} – ${sn}` : `${m.sb} – ${m.sa} – ${sn}`;
  const srvBar = fin ? '' : `<div class="srv-bar">
      <div class="srv-row">
        <div class="srv-call"><span>Gọi điểm</span><b>${call}</b></div>
        <button class="btn srv-out" data-act="sideout">Mất giao<small>${sn === 1 ? '→ người 2' : '→ đổi bên giao'}</small></button>
      </div>
      <div class="srv-set">
        <div class="grp"><span>Bên giao</span>
          <button class="chip${srv === 'a' ? ' on' : ''}" data-act="srv" data-side="a">▲ Trên</button>
          <button class="chip${srv === 'b' ? ' on' : ''}" data-act="srv" data-side="b">▼ Dưới</button></div>
        <div class="grp"><span>Người</span>
          <button class="chip${sn === 1 ? ' on' : ''}" data-act="sn" data-n="1">1</button>
          <button class="chip${sn === 2 ? ' on' : ''}" data-act="sn" data-n="2">2</button></div>
      </div>
    </div>`;
  return `${back}
    <h2 class="sc-title">${esc(fullLabel(id))} ${badge(m, true)}</h2>
    <p class="sc-sub"><b>${w.time}</b> · Lượt ${w.slot + 1} · Chạm <b>${target}</b></p>
    <div class="courts"><span>Sân</span>${meta.courts.map(c => `<button class="chip${w.court === c ? ' on' : ''}" data-act="court" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    ${panel('a')}${srvBar}${panel('b')}
    ${over && !fin ? `<div class="bar win-bar"><div><b>${esc(D.name(winner))}</b> chạm ${Math.max(m.sa, m.sb)} điểm</div><button class="btn dark" data-act="finish">Chốt kết quả</button></div>` : ''}
    ${fin ? `<div class="bar done-bar"><div>Đã kết thúc <b>${m.sa}–${m.sb}</b></div><button class="btn ghost" data-act="reopen">Mở lại để sửa</button></div>` : ''}
    ${m.st === 'pending' ? '<button class="btn primary wide" data-act="start">Bắt đầu trận — hiện “Đang đấu”</button>' : ''}
    <div class="sc-tools">
      <a class="btn ghost" href="#admin/m/${id}/edit">Nhập tỉ số cuối</a>
      <button class="btn danger" data-act="reset">Đặt lại trận</button>
    </div>`;
}

function viewEdit(D, id) {
  const m = { sa: 0, sb: 0, ...(D.M[id] || {}) };
  const s = D.sides(id);
  if (!s.a || !s.b) return `<div class="sc-top"><a href="${listHash}" class="back">‹ Danh sách trận</a></div><p class="empty">Trận này chưa xác định đủ 2 cặp.</p>`;
  return `<div class="sc-top"><a href="#admin/m/${id}" class="back">‹ Quay lại chấm điểm</a></div>
    <h2 class="sc-title">${esc(fullLabel(id))}</h2>
    <form class="card form" data-form="edit" data-id="${id}">
      <p class="fine top">Dùng khi nhập kết quả sau trận hoặc sửa tỉ số sai.</p>
      <label class="score-in pn-a-t">${teamCell(D, s.a)}<input name="sa" type="number" inputmode="numeric" min="0" max="99" value="${m.sa}" required></label>
      <label class="score-in pn-b-t">${teamCell(D, s.b)}<input name="sb" type="number" inputmode="numeric" min="0" max="99" value="${m.sb}" required></label>
      <button class="btn primary wide" type="submit">Lưu &amp; kết thúc trận</button>
    </form>`;
}

// ---------- BTC: cài đặt ----------
function viewSet(D) {
  const meta = D.meta;
  const url = location.origin + location.pathname;
  const inp = id => `<input name="t_${id}" value="${esc(D.name(id))}" autocomplete="off">`;
  const num = (name, label, v) => `<label>${label}<input name="${name}" type="number" inputmode="numeric" min="1" max="99" value="${v}"></label>`;
  return `<form class="form" data-form="settings">
    <section class="card"><h3>Luật</h3>
      ${num('target', 'Đôi nam vòng tròn — chạm', meta.target)}
      ${num('mixTarget', 'Đôi nam nữ (vòng 1, vòng 8, bán kết) — chạm', meta.mixTarget)}
      ${num('finalTarget', 'Hai trận chung kết — chạm', meta.finalTarget)}
      <label>Cách biệt tối thiểu<select name="winBy">
        <option value="1"${meta.winBy === 1 ? ' selected' : ''}>1 điểm — chạm là thắng</option>
        <option value="2"${meta.winBy === 2 ? ' selected' : ''}>2 điểm</option></select></label>
    </section>
    <section class="card"><h3>Sân &amp; giờ thi đấu</h3>
      <div class="grid2">${meta.courts.map((c, i) => `<label>Tên sân ${i + 1}<input name="court${i}" value="${esc(c)}" autocomplete="off"></label>`).join('')}</div>
      <p class="fine top">Lịch bị trễ thì sửa giờ các lượt còn lại — người xem thấy ngay.</p>
      <div class="times">
        <label>Khởi động<input name="time_w" type="time" value="${esc(D.warmTime)}"></label>
        ${SLOTS.map((_, i) => `<label>Lượt ${i + 1}<input name="time_${i}" type="time" value="${esc(D.slotTime(i))}"></label>`).join('')}
      </div>
    </section>
    <section class="card"><h3>Đôi nam · ${MEN.length} cặp</h3>
      ${MEN_TEAMS.map((id, i) => `<label>Cặp ${i + 1}${inp(id)}</label>`).join('')}
    </section>
    <section class="card"><h3>Đôi nam nữ · ${MIX.length} cặp</h3>
      ${MIX_TEAMS.map((id, i) => `<label>Cặp ${i + 1}${inp(id)}</label>`).join('')}
      <p class="fine">Viết tên theo dạng “Người 1 &amp; Người 2”. Cặp nào gặp cặp nào theo lịch cố định.</p>
    </section>
    <button class="btn primary wide" type="submit">Lưu thay đổi</button>
  </form>
  <section class="card"><h3>Chia sẻ cho người chơi</h3>
    <p class="link">${esc(url)}</p>
    <button class="btn ghost wide" data-act="share">${ICON.share} Chia sẻ link</button>
  </section>
  <section class="card danger-zone"><h3>Xoá kết quả</h3>
    <p class="fine top">Đưa cả ${ALL_IDS.length} trận về 0–0, giữ nguyên tên các cặp, giờ và luật.</p>
    <button class="btn danger wide" data-act="reset-all">Xoá toàn bộ kết quả</button>
  </section>`;
}

function viewLogin() {
  return `<form class="card form narrow" data-form="login">
    <h3>Mật khẩu BTC</h3>
    <p class="fine top">Nhập mật khẩu để chấm điểm. Máy này sẽ nhớ cho lần sau.</p>
    <label>Mật khẩu<input name="pw" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" required autofocus></label>
    <button class="btn primary wide" type="submit">Vào trang chấm điểm</button>
    <p class="err" id="lerr"></p>
  </form>`;
}
function viewInit() {
  return `<section class="card narrow"><h3>Khởi tạo giải</h3>
    <p>Máy chủ chưa có dữ liệu. Bấm để tạo ${ALL_IDS.length} trận (${MEN_IDS.length} trận Đôi nam, ${ALL_IDS.length - MEN_IDS.length} trận Đôi nam nữ) với danh sách cặp theo sơ đồ.</p>
    <button class="btn primary wide" data-act="seed">Khởi tạo M&amp;J CUP</button></section>`;
}

// ---------- Xử lý thao tác ----------
function startPatch(id, D) {
  const p = `matches/${id}/`, s = D.sides(id), m = D.M[id] || {};
  const up = { [p + 'st']: 'live', [p + 'a']: s.a, [p + 'b']: s.b };
  if (!m.startedAt) up[p + 'startedAt'] = NOW;
  return up;
}

async function act(name, el) {
  const r = route(), id = r.match;
  const D = derive(S || makeSeed());
  const m = id ? { st: 'pending', sa: 0, sb: 0, ...(D.M[id] || {}) } : null;
  const p = `matches/${id}/`;
  switch (name) {
    case 'pt': {
      if (m.st === 'done') return;
      if (isOver(m.sa, m.sb, D.targetOf(id), D.meta.winBy)) return toast('Đã đủ điểm — bấm “Chốt kết quả”');
      const up = { [p + 's' + el.dataset.side]: INC(1) };
      if (m.st === 'pending') Object.assign(up, startPatch(id, D));
      return write(up);
    }
    case 'minus':
      if (m.st === 'done' || !m['s' + el.dataset.side]) return;
      return write({ [p + 's' + el.dataset.side]: INC(-1) });
    case 'start': return write(startPatch(id, D));
    case 'sideout': {
      if (m.st === 'done') return;
      const { srv, sn } = serve(m);
      return write(sn === 1 ? { [p + 'srv']: srv, [p + 'sn']: 2 } : { [p + 'srv']: srv === 'a' ? 'b' : 'a', [p + 'sn']: 1 });
    }
    case 'srv': return write({ [p + 'srv']: el.dataset.side, [p + 'sn']: serve(m).sn });
    case 'sn': return write({ [p + 'srv']: serve(m).srv, [p + 'sn']: +el.dataset.n });
    case 'court': {
      const c = el.dataset.c, plan = D.meta.courts[SLOT_OF[id] ? SLOT_OF[id].c : -1];
      return write({ [p + 'court']: c === plan ? null : c }); // trùng sân theo lịch thì bỏ ghi đè
    }
    case 'finish': return write({ [p + 'st']: 'done', [p + 'endedAt']: NOW });
    case 'reopen': return write({ [p + 'st']: 'live', [p + 'endedAt']: null });
    case 'reset': {
      if (!confirm(`Đặt lại ${fullLabel(id)} về 0–0?`)) return;
      const up = { [p + 'sa']: 0, [p + 'sb']: 0, [p + 'st']: 'pending', [p + 'court']: null, [p + 'startedAt']: null, [p + 'endedAt']: null, [p + 'srv']: null, [p + 'sn']: null };
      if (DEF[id].src) Object.assign(up, { [p + 'a']: null, [p + 'b']: null });
      return write(up);
    }
    case 'reset-all': {
      if (!confirm('Xoá TOÀN BỘ kết quả của cả giải?')) return;
      if (prompt('Gõ XOA để xác nhận') !== 'XOA') return toast('Đã huỷ');
      const seed = makeSeed(), up = { tb: null };
      ALL_IDS.forEach(i => (up['matches/' + i] = seed.matches[i]));
      await write(up);
      return toast('Đã xoá toàn bộ kết quả');
    }
    case 'tb': {
      const list = el.dataset.list === 'men' ? D.men : D.mixT;
      const row = list.find(x => x.id === el.dataset.id);
      const tb = (S && S.tb) || {};
      const max = Math.max(...list.filter(x => x.key === row.key).map(x => tb[x.id] || 0));
      return write({ ['tb/' + row.id]: max + 1 });
    }
    case 'seed': await store.seed(); return toast('Đã khởi tạo giải');
    case 'logout': await store.logout(); location.hash = '#lich'; return;
    case 'jump': {
      const el2 = document.getElementById('slot-' + el.dataset.slot);
      if (el2) el2.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    case 'find-clear': setFind(''); return;
    case 'share': return share();
  }
}

function setFind(v) {
  ui.q = v;
  try { localStorage.setItem('mjcup-find', v); } catch (e) {}
  render(false);
}

async function share() {
  const url = location.origin + location.pathname;
  try {
    if (navigator.share) return await navigator.share({ title: 'M&J CUP — Tỉ số trực tiếp', url });
    await navigator.clipboard.writeText(url);
    toast('Đã chép link');
  } catch (e) {
    if (e && e.name !== 'AbortError') prompt('Chép link này:', url);
  }
}

async function submit(form) {
  const f = new FormData(form);
  const kind = form.dataset.form;
  if (kind === 'login') {
    const err = form.querySelector('#lerr');
    err.textContent = '';
    const btn = form.querySelector('button');
    btn.disabled = true;
    try { if (!(await store.login(f.get('pw')))) err.textContent = 'Sai mật khẩu.'; }
    catch (e) { err.textContent = 'Không kiểm tra được mật khẩu: ' + (e.message || e); }
    btn.disabled = false;
    return;
  }
  if (kind === 'settings') {
    const up = {};
    const num = (k, lo, hi) => { const n = parseInt(f.get(k), 10); return n >= lo && n <= hi ? n : null; };
    ['target', 'mixTarget', 'finalTarget'].forEach(k => { const n = num(k, 1, 99); if (n) up['meta/' + k] = n; });
    up['meta/winBy'] = f.get('winBy') === '2' ? 2 : 1;
    const D = derive(S || makeSeed());
    up['meta/courts'] = D.meta.courts.map((c, i) => (f.get('court' + i) || '').trim() || c);
    const hhmm = v => /^\d{2}:\d{2}$/.test(v || '');
    if (hhmm(f.get('time_w'))) up['meta/times/w'] = f.get('time_w');
    SLOTS.forEach((_, i) => { const v = f.get('time_' + i); if (hhmm(v)) up['meta/times/' + i] = v; });
    TEAM_IDS.forEach(tid => { const v = (f.get('t_' + tid) || '').trim(); if (v) up[`teams/${tid}/name`] = v; });
    await write(up);
    render(true);
    return toast('Đã lưu');
  }
  if (kind === 'edit') {
    const id = form.dataset.id, sa = parseInt(f.get('sa'), 10), sb = parseInt(f.get('sb'), 10);
    if (!(sa >= 0 && sb >= 0)) return toast('Tỉ số không hợp lệ');
    if (sa === sb) return toast('Hai cặp không thể hoà');
    const D = derive(S || makeSeed()), p = `matches/${id}/`;
    await write({ ...startPatch(id, D), [p + 'sa']: sa, [p + 'sb']: sb, [p + 'st']: 'done', [p + 'endedAt']: NOW });
    location.hash = '#admin/m/' + id;
  }
}

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'show';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.className = ''), 2600);
}

// ---------- Khởi động ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled) { e.preventDefault(); act(el.dataset.act, el); }
});
document.addEventListener('submit', e => {
  const form = e.target.closest('[data-form]');
  if (form) { e.preventDefault(); submit(form); }
});
document.addEventListener('input', e => { if (e.target.matches('[data-find]')) setFind(e.target.value); });
window.addEventListener('hashchange', () => {
  const r = route();
  if (r.admin && !r.match && r.tab !== 'set') listHash = location.hash || '#admin';
  render(true);
  window.scrollTo(0, 0);
});

render(true);
(store.mode === 'server' ? initSupabase() : Promise.resolve(initDemo())).catch(e => {
  app.innerHTML = `<div class="boot">Không kết nối được máy chủ.<br><small>${esc(e.message || e)}</small></div>`;
});
