/* M&J CUP — tính điểm pickleball trực tiếp.
   Người xem: /mj-cup/        BTC chấm điểm: /mj-cup/#admin */

const CFG = window.MJ_SUPABASE && window.MJ_SUPABASE.url && window.MJ_SUPABASE.anonKey ? window.MJ_SUPABASE : null;
const SB_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
const INC = n => ({ __inc: n });
const NOW = { __now: 1 };
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const signed = n => (n > 0 ? '+' + n : String(n));

// ---------- Cấu trúc giải (theo sơ đồ BTC) ----------
const MEN = [
  'Vũ Thành Lâm & Việt Anh Cisco',
  'Phong Hoàng & Phạm Hồng Hải',
  'Tiu & Tùng Đỗ',
  'Nguyễn Sơn Hải & Đoàn Quang Tuấn',
  'Trần Phạm Việt Anh & Ngô Tuấn Thành',
];
const MIX = [
  ['Go Han & Hoàng', 'Vũ Ngọc Anh & Hoàng Minh Tiến'],
  ['Thuhadey & Chu Lý Quỳnh', 'Bảo Ngọc & Trần Danh Thái'],
  ['Thoa Malko & Trần Phạm Việt Anh', 'Huyền Hi Hi & Đoàn Quang Tuấn'],
  ['Lê Thanh Loan & Lucifer', 'Hải Anh & Lê Hoàn'],
  ['Doen & Tiu', 'Emily & Trung SSS'],
];
// Thứ tự vòng tròn: mỗi cặp được nghỉ xen kẽ, không đánh 2 trận liền nhau.
const MEN_PAIRS = [[1, 2], [3, 4], [5, 1], [2, 3], [4, 5], [1, 3], [2, 4], [3, 5], [4, 1], [5, 2]];

const MEN_IDS = MEN_PAIRS.map((_, i) => 'N' + pad(i + 1));
const R1_IDS = MIX.map((_, i) => 'R' + (i + 1));
const QF_IDS = ['Q1', 'Q2', 'Q3', 'Q4'];
const SF_IDS = ['S1', 'S2'];
const ALL_IDS = [...MEN_IDS, ...R1_IDS, ...QF_IDS, ...SF_IDS, 'F'];
const TEAM_IDS = [...MEN.map((_, i) => 'm' + (i + 1)), ...MIX.flatMap((_, i) => ['x' + (2 * i + 1), 'x' + (2 * i + 2)])];

const DEF = {};
MEN_IDS.forEach((id, i) => (DEF[id] = { ev: 'men', label: `Trận ${i + 1}` }));
R1_IDS.forEach((id, i) => (DEF[id] = { ev: 'mix', label: `Vòng 1 · Trận ${i + 1}` }));
Object.assign(DEF, {
  Q1: { ev: 'mix', label: 'Trận 8.1', src: [['seed', 1], ['seed', 8]] },
  Q2: { ev: 'mix', label: 'Trận 8.2', src: [['seed', 4], ['seed', 5]] },
  Q3: { ev: 'mix', label: 'Trận 8.3', src: [['seed', 2], ['seed', 7]] },
  Q4: { ev: 'mix', label: 'Trận 8.4', src: [['seed', 3], ['seed', 6]] },
  S1: { ev: 'mix', label: 'Bán kết 1', src: [['win', 'Q1'], ['win', 'Q2']] },
  S2: { ev: 'mix', label: 'Bán kết 2', src: [['win', 'Q3'], ['win', 'Q4']] },
  F: { ev: 'mix', label: 'Chung kết', src: [['win', 'S1'], ['win', 'S2']] },
});
const fullLabel = id => (DEF[id].ev === 'men' ? 'Đôi nam' : 'Đôi nam nữ') + ' · ' + DEF[id].label;
const srcLabel = ([k, v]) => {
  if (k === 'seed') return `Hạng ${v} Vòng 1`;
  const l = DEF[v].label;
  return 'Thắng ' + l[0].toLowerCase() + l.slice(1);
};

function makeSeed() {
  const teams = {}, matches = {};
  MEN.forEach((n, i) => (teams['m' + (i + 1)] = { name: n }));
  MIX.forEach(([a, b], i) => {
    teams['x' + (2 * i + 1)] = { name: a };
    teams['x' + (2 * i + 2)] = { name: b };
  });
  MEN_PAIRS.forEach(([a, b], i) => (matches[MEN_IDS[i]] = { a: 'm' + a, b: 'm' + b, sa: 0, sb: 0, st: 'pending' }));
  R1_IDS.forEach((id, i) => (matches[id] = { a: 'x' + (2 * i + 1), b: 'x' + (2 * i + 2), sa: 0, sb: 0, st: 'pending' }));
  [...QF_IDS, ...SF_IDS, 'F'].forEach(id => (matches[id] = { sa: 0, sb: 0, st: 'pending' }));
  return { meta: { target: 11, winBy: 1, courts: 3 }, teams, matches };
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
  const meta = { target: 11, winBy: 1, courts: 3, ...(S.meta || {}) };
  const st = id => (M[id] && M[id].st) || 'pending';
  const name = id => (T[id] && T[id].name) || '—';
  const byTb = (x, y) => (tb[y.id] || 0) - (tb[x.id] || 0);

  // Đôi nam: vòng tròn
  const men = MEN.map((_, i) => ({ id: 'm' + (i + 1), p: 0, w: 0, f: 0, a: 0 }));
  const row = Object.fromEntries(men.map(r => [r.id, r]));
  MEN_IDS.forEach(id => {
    const m = M[id];
    if (st(id) !== 'done' || !row[m.a] || !row[m.b]) return;
    const A = row[m.a], B = row[m.b];
    A.p++; B.p++;
    A.f += m.sa; A.a += m.sb; B.f += m.sb; B.a += m.sa;
    (m.sa > m.sb ? A : B).w++;
  });
  men.forEach(r => (r.diff = r.f - r.a));
  men.sort((x, y) => y.w - x.w || y.diff - x.diff || y.f - x.f || byTb(x, y));
  men.forEach((r, i) => (r.rank = i + 1));
  const menDone = MEN_IDS.every(id => st(id) === 'done');
  if (menDone) markTies(men, r => `${r.w}|${r.diff}|${r.f}`);

  // Đôi nam nữ: Vòng 1 → 5 cặp thắng (hạng 1–5) + 3 cặp thua tốt nhất (hạng 6–8)
  const rows = [];
  R1_IDS.forEach(id => {
    const m = M[id] || {}, fin = st(id) === 'done';
    [[m.a, m.sa || 0, m.sb || 0], [m.b, m.sb || 0, m.sa || 0]].forEach(([t, f, a]) =>
      rows.push({ id: t, m: id, fin, win: fin && f > a, f, a, diff: f - a }));
  });
  const cmp = (x, y) => y.diff - x.diff || y.f - x.f || byTb(x, y);
  const W = rows.filter(r => r.fin && r.win).sort(cmp);
  const L = rows.filter(r => r.fin && !r.win).sort(cmp);
  const mixRank = [...W, ...L].map((r, i) => ({ ...r, rank: i + 1 }));
  const mixPending = rows.filter(r => !r.fin);
  const r1Done = R1_IDS.every(id => st(id) === 'done');
  if (r1Done) markTies(mixRank, r => `${r.win}|${r.diff}|${r.f}`);
  const seeds = r1Done ? mixRank.slice(0, 8).map(r => r.id) : null;

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
  function resolve([k, v]) { return k === 'seed' ? (seeds ? seeds[v - 1] : null) : winner(v); }
  function winner(id) {
    if (st(id) !== 'done') return null;
    const m = M[id], s = sides(id);
    return m.sa > m.sb ? s.a : s.b;
  }

  return { M, T, meta, st, name, sides, winner, men, menDone, mixRank, mixPending, r1Done };
}

const isOver = (sa, sb, meta) => {
  const hi = Math.max(sa, sb), lo = Math.min(sa, sb);
  return hi >= meta.target && hi - lo >= meta.winBy;
};

// ---------- Trạng thái ----------
let S = null, loaded = false, authReady = false, user = null, isAdmin = false;
let conn = null; // null = đang kết nối lần đầu
let lastView = null;
const STATIC = new Set(['set', 'edit', 'login', 'denied', 'wait', 'init']); // view có form: không vẽ lại khi dữ liệu đổi
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

  let authKey = null;
  sb.auth.onAuthStateChange((_e, session) => {
    const u = (session && session.user) || null;
    // Không gọi Supabase trực tiếp trong callback này (thư viện có thể treo), nên đẩy ra ngoài.
    setTimeout(async () => {
      const key = u ? u.id : '';
      if (key === authKey) return; // bỏ qua sự kiện làm mới token định kỳ
      authKey = key;
      user = u ? { email: u.email, uid: u.id } : null;
      isAdmin = false;
      if (u) { const { data } = await sb.rpc('cup_is_admin'); isAdmin = data === true; }
      authReady = true;
      render(true);
    }, 0);
  });

  store.write = async up => {
    if (S) { applyPatch(S, up); render(false); }
    pending++;
    const { data, error } = await sb.rpc('cup_patch', { ops: up });
    pending--;
    if (error) { stash = null; refetch(); throw error; }
    minVer = Math.max(minVer, data);
    if (!pending && stash) { const row = stash; stash = null; incoming(row); }
  };
  store.seed = async () => {
    const { error } = await sb.rpc('cup_init', { doc: makeSeed() });
    if (error) throw error;
    await refetch();
  };
  store.login = async (email, password) => {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };
  store.logout = () => sb.auth.signOut();
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
function route() {
  const parts = decodeURIComponent(location.hash.slice(1)).split('/');
  if (parts[0] === 'admin') {
    if (parts[1] === 'm' && DEF[parts[2]]) return { admin: true, match: parts[2], view: parts[3] === 'edit' ? 'edit' : 'score' };
    const tab = ['men', 'mix', 'set'].includes(parts[1]) ? parts[1] : 'live';
    return { admin: true, tab, view: tab };
  }
  const tab = ['men', 'mix'].includes(parts[0]) ? parts[0] : 'live';
  return { admin: false, tab, view: tab };
}
const tabHref = (admin, k) => (admin ? (k === 'live' ? '#admin' : '#admin/' + k) : '#' + k);

function render(force) {
  const r = route();
  let v = r.view;
  if (r.admin && !authReady) v = 'wait';
  else if (r.admin && store.mode === 'server' && !user) v = 'login';
  else if (r.admin && !isAdmin) v = 'denied';
  else if (!loaded) v = 'loading';
  else if (r.admin && !S) v = 'init';
  if (!force && STATIC.has(v) && v === lastView) return;
  lastView = v;

  const D = derive(S || makeSeed());
  const views = {
    live: () => viewLive(D, r.admin), men: () => viewMen(D, r.admin), mix: () => viewMix(D, r.admin),
    set: () => viewSet(D), score: () => viewScore(D, r.match), edit: () => viewEdit(D, r.match),
    login: viewLogin, denied: viewDenied, init: viewInit,
    wait: () => '<div class="boot">Đang kiểm tra đăng nhập…</div>',
    loading: () => '<div class="boot">Đang tải dữ liệu giải…</div>',
  };
  const focus = v === 'score' || v === 'edit';
  app.innerHTML =
    (focus ? '' : hero(D, r)) +
    (r.admin && isAdmin && !focus ? adminBar() : '') +
    (!r.admin && user && isAdmin ? '<a class="to-admin" href="#admin">Bạn là BTC · <b>Mở trang chấm điểm ›</b></a>' : '') +
    (['live', 'men', 'mix', 'set'].includes(v) ? tabs(D, r) : '') +
    `<main class="wrap">${!S && loaded && !r.admin ? '<p class="note">BTC chưa mở giải — tỉ số sẽ hiện ở đây khi trận đầu bắt đầu.</p>' : ''}${views[v]()}</main>` +
    (focus ? '' : footer(r));
  paintConn();
}

// ---------- Khối giao diện dùng chung ----------
function hero(D, r) {
  const m = D.meta;
  return `<header class="hero">
    <h1 class="logo">M&amp;J CUP</h1>
    <p class="sub">Giải pickleball kỷ niệm một năm ngày cưới <b>Mike &amp; Go Han</b></p>
    <div class="rule"><span class="rule-tag">Luật chung</span><span>Đánh chạm <b>${m.target}</b> trước là thắng${m.winBy > 1 ? ` · cách ${m.winBy} điểm` : ''}</span></div>
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
  const who = store.mode === 'demo' ? 'Chế độ thử' : esc(user && user.email);
  return `<div class="adminbar"><span class="ab-tag">BTC</span><span class="ab-who">${who}</span>
    <a href="#live" class="ab-link">Trang người xem</a>
    ${store.mode === 'server' ? '<button class="ab-link" data-act="logout">Đăng xuất</button>' : ''}</div>`;
}

function tabs(D, r) {
  const live = ALL_IDS.filter(id => D.st(id) === 'live').length;
  const items = [['live', 'Trực tiếp'], ['men', 'Đôi nam'], ['mix', 'Đôi nam nữ']];
  if (r.admin) items.push(['set', 'Cài đặt']);
  return `<nav class="tabs${r.admin ? ' admin' : ''}">${items.map(([k, t]) =>
    `<a href="${tabHref(r.admin, k)}" class="${r.tab === k ? 'on' : ''}">${t}${k === 'live' && live ? `<span class="cnt">${live}</span>` : ''}</a>`).join('')}</nav>`;
}

function footer(r) {
  return `<footer class="foot">
    <button class="btn ghost" data-act="share">${ICON.share} Chia sẻ link xem tỉ số</button>
    <p>M&amp;J CUP · Tỉ số do BTC cập nhật trực tiếp${r.admin ? '' : ' · <a href="#admin">Đăng nhập BTC</a>'}</p>
  </footer>`;
}

const ICON = {
  share: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
};

const pair = n => esc(n).split(' &amp; ').map(p => `<span>${p}</span>`).join('');
const teamCell = (D, id, ph) => (id ? `<span class="pair">${pair(D.name(id))}</span>` : `<span class="ph">${esc(ph || 'Chưa xác định')}</span>`);

function badge(m, ready) {
  if (m.st === 'live') return `<span class="badge live"><i></i>Đang đấu${m.court ? ' · Sân ' + m.court : ''}</span>`;
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
  return `<${tag} class="mc st-${m.st}${opt.big ? ' big' : ''}${id === 'F' ? ' final' : ''}${tap ? ' tap' : ''}">
    <div class="mc-head"><span class="mc-label">${esc(opt.full ? fullLabel(id) : DEF[id].label)}</span>${badge(m, ready)}</div>
    <div class="mc-row${cls('a')}">${teamCell(D, s.a, s.la)}<span class="sc">${pend ? '–' : m.sa}</span></div>
    <div class="mc-row${cls('b')}">${teamCell(D, s.b, s.lb)}<span class="sc">${pend ? '–' : m.sb}</span></div>
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

// ---------- Trang: Trực tiếp ----------
function viewLive(D, admin) {
  const live = ALL_IDS.filter(id => D.st(id) === 'live').sort((x, y) => (D.M[x].court || 99) - (D.M[y].court || 99));
  const next = ALL_IDS.filter(id => D.st(id) === 'pending' && D.sides(id).a && D.sides(id).b).slice(0, 5);
  const recent = ALL_IDS.filter(id => D.st(id) === 'done').sort((x, y) => (D.M[y].endedAt || 0) - (D.M[x].endedAt || 0)).slice(0, 6);
  const doneCount = ALL_IDS.filter(id => D.st(id) === 'done').length;
  let h = '';
  if (D.menDone) h += champ(D, 'Vô địch Đôi nam', D.men[0].id);
  h += champ(D, 'Vô địch Đôi nam nữ', D.winner('F'));
  if (admin) h += '<p class="hint">Chạm vào một trận để chấm điểm.</p>';
  h += `<section class="sec"><h2 class="sec-h">Đang thi đấu</h2>${live.length ? cards(D, live, admin, { full: true, big: true }) : '<p class="empty">Chưa có trận nào đang diễn ra.</p>'}</section>`;
  if (next.length) h += `<section class="sec"><h2 class="sec-h">Sắp diễn ra</h2>${cards(D, next, admin, { full: true })}</section>`;
  if (recent.length) h += `<section class="sec"><h2 class="sec-h">Kết quả mới nhất</h2>${cards(D, recent, admin, { full: true })}</section>`;
  h += `<p class="progress">Đã xong ${doneCount}/${ALL_IDS.length} trận</p>`;
  return h;
}

// ---------- Trang: Đôi nam ----------
function viewMen(D, admin) {
  const played = MEN_IDS.filter(id => D.st(id) === 'done').length;
  const ties = D.men.some(r => r.tie);
  return `${evHead('Đôi nam', 'pink', 'Vòng tròn 1 bảng', `5 cặp · ${played}/10 trận`)}
    ${D.menDone ? champ(D, 'Vô địch Đôi nam', D.men[0].id) : ''}
    <section class="sec"><h2 class="sec-h">Bảng xếp hạng${D.menDone ? '' : ' <small>tạm tính</small>'}</h2>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>#</th><th class="l">Cặp đấu</th><th>Trận</th><th class="hot">Thắng</th><th class="hot">HS</th></tr></thead>
      <tbody>${D.men.map(r => `<tr class="${D.menDone && r.rank === 1 ? 'top' : ''}">
        <td class="rk"><span class="num">${r.p || D.menDone ? r.rank : '–'}</span>${r.tie ? '<sup>=</sup>' : ''}</td>
        <td class="l"><div class="cell">${teamCell(D, r.id)}${tieBtn(admin, r, 'men')}</div></td>
        <td>${r.p}</td><td class="b">${r.w}</td><td class="${r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : ''}">${signed(r.diff)}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="fine">Xếp theo số trận thắng → hiệu số → tổng điểm ghi được.${ties ? ' <b>=</b> bằng mọi chỉ số: BTC quyết định thứ tự.' : ''}</p>
    </section>
    <section class="sec"><h2 class="sec-h">Lịch thi đấu</h2>${cards(D, MEN_IDS, admin)}</section>`;
}

// ---------- Trang: Đôi nam nữ ----------
function viewMix(D, admin) {
  const ties = D.mixRank.some(r => r.tie);
  const rowsHtml = [...D.mixRank, ...D.mixPending].map(r => {
    const q = D.r1Done ? (r.rank <= 8 ? 'in' : 'out') : '';
    return `<tr class="${q}">
      <td class="rk"><span class="num">${r.fin ? r.rank : '–'}</span>${r.tie ? '<sup>=</sup>' : ''}</td>
      <td class="l"><div class="cell">${teamCell(D, r.id)}${tieBtn(admin, r, 'mix')}</div></td>
      <td>${r.fin ? (r.win ? '<span class="res w">Thắng</span>' : '<span class="res l">Thua</span>') : '—'}</td>
      <td class="g">${r.fin ? `${r.f}–${r.a}` : '—'}</td>
      <td class="${r.diff > 0 && r.fin ? 'pos' : r.diff < 0 && r.fin ? 'neg' : ''}">${r.fin ? signed(r.diff) : '—'}</td></tr>`;
  }).join('');
  return `${evHead('Đôi nam nữ', 'lime', 'Vòng 1 → Loại trực tiếp', '10 cặp')}
    ${champ(D, 'Vô địch Đôi nam nữ', D.winner('F'))}
    <section class="sec">${sub('Vòng 1', 'navy')}<p class="fine top">5 cặp thắng + 3 cặp thua có hiệu số tốt nhất vào Vòng 8 đội.</p>${cards(D, R1_IDS, admin)}</section>
    <section class="sec"><h2 class="sec-h">Xếp hạng Vòng 1${D.r1Done ? '' : ' <small>tạm tính</small>'}</h2>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>#</th><th class="l">Cặp đấu</th><th>KQ</th><th class="green">Tỉ số</th><th>HS</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table></div>
    <p class="fine">Cặp thắng xếp hạng 1–5, cặp thua xếp hạng 6–10; cùng nhóm thì xét hiệu số.${D.r1Done ? ' Hạng 1–8 vào Vòng 8 đội.' : ''}${ties ? ' <b>=</b> bằng hiệu số: BTC quyết định thứ tự.' : ''}</p>
    </section>
    <section class="sec">${sub('Vòng 8 đội', 'navy')}${cards(D, QF_IDS, admin)}</section>
    <section class="sec">${sub('Bán kết', 'navy')}${cards(D, SF_IDS, admin)}</section>
    <section class="sec">${sub('Chung kết', 'yellow')}${cards(D, ['F'], admin, { big: true })}${champ(D, 'Vô địch', D.winner('F'), true)}</section>`;
}

// ---------- BTC: chấm điểm 1 trận ----------
function viewScore(D, id) {
  const m = { st: 'pending', sa: 0, sb: 0, ...(D.M[id] || {}) };
  const s = D.sides(id), meta = D.meta;
  const back = `<div class="sc-top"><a href="#admin" class="back">‹ Danh sách trận</a><span class="conn" id="conn"></span></div>`;
  if (!s.a || !s.b) return back + `<h2 class="sc-title">${esc(fullLabel(id))}</h2><p class="empty">Trận này chưa xác định đủ 2 cặp.</p>`;
  const fin = m.st === 'done', over = isOver(m.sa, m.sb, meta);
  const panel = side => {
    const v = m['s' + side], o = m['s' + (side === 'a' ? 'b' : 'a')];
    return `<div class="pn pn-${side}${v > o ? ' lead' : ''}${fin ? (v > o ? ' win' : ' lose') : ''}">
      <button class="pn-hit" data-act="pt" data-side="${side}" ${fin || over ? 'disabled' : ''}>
        <span class="pn-name">${pair(D.name(s[side]))}</span>
        <span class="pn-score">${v}</span>
        <span class="pn-hint">${fin ? (v > o ? 'Thắng' : '') : over ? '' : 'Chạm để +1'}</span>
      </button>
      <button class="pn-minus" data-act="minus" data-side="${side}" ${fin || !v ? 'disabled' : ''} aria-label="Trừ 1 điểm">−1</button>
    </div>`;
  };
  const courts = Array.from({ length: meta.courts }, (_, i) => i + 1);
  const winner = m.sa > m.sb ? s.a : s.b;
  return `${back}
    <h2 class="sc-title">${esc(fullLabel(id))} ${badge(m, true)}</h2>
    <div class="courts"><span>Sân</span>${courts.map(c => `<button class="chip${m.court == c ? ' on' : ''}" data-act="court" data-c="${c}">${c}</button>`).join('')}</div>
    ${panel('a')}${panel('b')}
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
  if (!s.a || !s.b) return `<div class="sc-top"><a href="#admin" class="back">‹ Danh sách trận</a></div><p class="empty">Trận này chưa xác định đủ 2 cặp.</p>`;
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
  return `<form class="form" data-form="settings">
    <section class="card"><h3>Luật</h3>
      <label>Điểm chạm để thắng<input name="target" type="number" inputmode="numeric" min="1" max="99" value="${meta.target}"></label>
      <label>Cách biệt tối thiểu<select name="winBy">
        <option value="1"${meta.winBy === 1 ? ' selected' : ''}>1 điểm — chạm là thắng</option>
        <option value="2"${meta.winBy === 2 ? ' selected' : ''}>2 điểm</option></select></label>
      <label>Số sân<input name="courts" type="number" inputmode="numeric" min="1" max="12" value="${meta.courts}"></label>
    </section>
    <section class="card"><h3>Đôi nam</h3>
      ${MEN.map((_, i) => `<label>Cặp ${i + 1}${inp('m' + (i + 1))}</label>`).join('')}
    </section>
    <section class="card"><h3>Đôi nam nữ · Vòng 1</h3>
      ${MIX.map((_, i) => `<fieldset><legend>Trận ${i + 1}</legend>${inp('x' + (2 * i + 1))}<span class="vs">gặp</span>${inp('x' + (2 * i + 2))}</fieldset>`).join('')}
      <p class="fine">Viết tên theo dạng “Người 1 &amp; Người 2”.</p>
    </section>
    <button class="btn primary wide" type="submit">Lưu thay đổi</button>
  </form>
  <section class="card"><h3>Chia sẻ cho người chơi</h3>
    <p class="link">${esc(url)}</p>
    <button class="btn ghost wide" data-act="share">${ICON.share} Chia sẻ link</button>
  </section>
  <section class="card danger-zone"><h3>Xoá kết quả</h3>
    <p class="fine top">Đưa cả ${ALL_IDS.length} trận về 0–0, giữ nguyên tên các cặp.</p>
    <button class="btn danger wide" data-act="reset-all">Xoá toàn bộ kết quả</button>
  </section>`;
}

function viewLogin() {
  return `<form class="card form narrow" data-form="login">
    <h3>Đăng nhập BTC</h3>
    <label>Email<input name="email" type="email" autocomplete="username" required></label>
    <label>Mật khẩu<input name="pw" type="password" autocomplete="current-password" required></label>
    <button class="btn primary wide" type="submit">Đăng nhập</button>
    <p class="err" id="lerr"></p>
  </form>`;
}
function viewDenied() {
  return `<section class="card narrow"><h3>Chưa có quyền BTC</h3>
    <p>Tài khoản <b>${esc(user && user.email)}</b> chưa được cấp quyền nhập điểm. Chạy lệnh cấp quyền BTC với email này trong Supabase (HUONG-DAN.md, bước 4), rồi đăng xuất và đăng nhập lại.</p>
    <button class="btn ghost wide" data-act="logout">Đăng xuất</button></section>`;
}
function viewInit() {
  return `<section class="card narrow"><h3>Khởi tạo giải</h3>
    <p>Máy chủ chưa có dữ liệu. Bấm để tạo 22 trận (10 trận Đôi nam, 12 trận Đôi nam nữ) với danh sách cặp theo sơ đồ.</p>
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
      if (isOver(m.sa, m.sb, D.meta)) return toast('Đã đủ điểm — bấm “Chốt kết quả”');
      const up = { [p + 's' + el.dataset.side]: INC(1) };
      if (m.st === 'pending') Object.assign(up, startPatch(id, D));
      return write(up);
    }
    case 'minus':
      if (m.st === 'done' || !m['s' + el.dataset.side]) return;
      return write({ [p + 's' + el.dataset.side]: INC(-1) });
    case 'start': return write(startPatch(id, D));
    case 'court': return write({ [p + 'court']: m.court == el.dataset.c ? null : +el.dataset.c });
    case 'finish': return write({ [p + 'st']: 'done', [p + 'endedAt']: NOW });
    case 'reopen': return write({ [p + 'st']: 'live', [p + 'endedAt']: null });
    case 'reset': {
      if (!confirm(`Đặt lại ${fullLabel(id)} về 0–0?`)) return;
      const up = { [p + 'sa']: 0, [p + 'sb']: 0, [p + 'st']: 'pending', [p + 'court']: null, [p + 'startedAt']: null, [p + 'endedAt']: null };
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
      const list = el.dataset.list === 'men' ? D.men : D.mixRank;
      const row = list.find(x => x.id === el.dataset.id);
      const tb = (S && S.tb) || {};
      const max = Math.max(...list.filter(x => x.key === row.key).map(x => tb[x.id] || 0));
      return write({ ['tb/' + row.id]: max + 1 });
    }
    case 'seed': await store.seed(); return toast('Đã khởi tạo giải');
    case 'logout': await store.logout(); location.hash = '#live'; return;
    case 'share': return share();
  }
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
    try { await store.login(f.get('email').trim(), f.get('pw')); }
    catch (e) { err.textContent = /invalid|credential/i.test(`${e.code || ''} ${e.message || ''}`) ? 'Sai email hoặc mật khẩu.' : 'Không đăng nhập được: ' + (e.code || e.message); }
    return;
  }
  if (kind === 'settings') {
    const up = {};
    const num = (k, lo, hi) => { const n = parseInt(f.get(k), 10); return n >= lo && n <= hi ? n : null; };
    const t = num('target', 1, 99), c = num('courts', 1, 12);
    if (t) up['meta/target'] = t;
    if (c) up['meta/courts'] = c;
    up['meta/winBy'] = f.get('winBy') === '2' ? 2 : 1;
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
window.addEventListener('hashchange', () => { render(true); window.scrollTo(0, 0); });

render(true);
(store.mode === 'server' ? initSupabase() : Promise.resolve(initDemo())).catch(e => {
  app.innerHTML = `<div class="boot">Không kết nối được máy chủ.<br><small>${esc(e.message || e)}</small></div>`;
});
