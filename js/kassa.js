// Экран кассы: вход Google, заказы за 12 часов, звук на новый заказ, смена статуса, наличие блюд.
import { authApi, firestore } from './db.js?v=044dd713';
import { rub, dishes, WAITS, cleanOff, goneIds, sumWithout, countWithout } from './cart.js?v=044dd713';
import { sections, items } from './data.js?v=044dd713';
import { cafe, applyBrand } from './brand.js?v=044dd713';

applyBrand(['Касса', cafe.words.join(' ')], `Касса: ${cafe.name}`, '../');
const app = document.getElementById('app');
const who = document.getElementById('who');
const out = document.getElementById('out');
const toastEl = document.getElementById('toast');
const soundEl = document.getElementById('sound');
const netEl = document.getElementById('net');
const stockEl = document.getElementById('stock');
let signed = false;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hhmm = (ts) => (ts ? ts.toDate().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '');

const COLS = [
  { key: 'new', title: 'Новые', empty: 'Новых заказов нет', sort: 1 },
  { key: 'accepted', title: 'Приняты', empty: 'Пусто', sort: 1 },
  { key: 'punched', title: 'Пробиты', empty: 'Пусто', sort: -1 },
];

let orders = [];
let unsub = null;
let unsubMenu = null;
// Наличие: номера блюд, которых нет (menu/live, поле off). mode: 'orders' или 'stock'.
let off = new Set();
let mode = 'orders';
const busy = new Set();
let first = true;
let audio = null;
let wake = null;
const fresh = new Set();
const armed = new Map();
// Время готовности, которое кассир ставит у «Пробит». Касса помнит прошлый выбор.
let wait = 15;
try { wait = WAITS.includes(Number(localStorage.getItem('sm-wait'))) ? Number(localStorage.getItem('sm-wait')) : 15; } catch { /* по умолчанию 15 */ }
const at = (o) => (o.updatedAt && o.waitMin ? hhmm({ toDate: () => new Date(o.updatedAt.toMillis() + o.waitMin * 60000) }) : '');

function toast(text) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { toastEl.hidden = true; }, 4000);
}

function beep() {
  try {
    audio ||= new AudioContext();
    const t = audio.currentTime;
    [[784, 0], [1046, 0.18], [784, 0.5], [1046, 0.68]].forEach(([hz, d]) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.5, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.16);
      o.connect(g).connect(audio.destination);
      o.start(t + d);
      o.stop(t + d + 0.17);
    });
  } catch { /* без звука */ }
}

// Браузер не даёт звук без нажатия на экран. После обновления страницы просим нажать.
function soundCheck() {
  soundEl.hidden = !signed || (!!audio && audio.state === 'running');
}

window.addEventListener('offline', () => { netEl.hidden = !signed; });

async function keepAwake() {
  try { wake = await navigator.wakeLock?.request('screen'); } catch { /* экран может погаснуть */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (wake) keepAwake();
  soundCheck();
});

function card(o) {
  // Блюда «Нет» в заказе зачёркнуты, сумма и число блюд без них.
  const gone = goneIds(o.items, o.status, o.gone, off);
  const n = countWithout(o.items, gone);
  const act = o.status === 'new' ? ['accepted', 'Принят'] : o.status === 'accepted' ? ['punched', 'Пробит'] : null;
  const chips = o.status === 'accepted'
    ? `<div class="chips"><span class="muted">Готово через</span>${WAITS.map((m) => `<button type="button" class="chip num${m === wait ? ' on' : ''}" data-wait="${m}">${m} мин</button>`).join('')}</div>` : '';
  const btns = (act ? `<button type="button" class="act head" data-set="${act[0]}" data-id="${o.id}">${act[1]}${act[0] === 'punched' ? ` · ${wait} мин` : ''}</button>` : '')
    + (o.status !== 'punched' ? `<button type="button" class="ghost" data-cancel="${o.id}">${armed.has(o.id) ? 'Точно отменить?' : 'Отменить'}</button>` : '');
  const ready = o.status === 'punched' && at(o) ? `<span class="ready num">к ${at(o)}</span>` : '';
  return `<article class="ord st-${o.status}${fresh.has(o.id) ? ' fresh' : ''}">`
    + `<div class="top"><b class="head">Кабинка ${o.cabin}</b>${o.parent ? '<span class="add-tag head">Дозаказ</span>' : ''}`
    + `${ready}<span class="num muted">${hhmm(o.createdAt)}</span></div>${chips}`
    + `<ul>${o.items.map((i) => `<li${gone.includes(i.id) ? ' class="gone"' : ''}><span>${esc(i.name)}${gone.includes(i.id) ? ' <em>нет в наличии</em>' : ''}</span><span class="num">× ${i.qty}</span><span class="num">${rub(i.price * i.qty)}</span></li>`).join('')}</ul>`
    + `<div class="sum"><span class="muted">${dishes(n)}</span><b class="num">${gone.length ? `<s>${rub(o.total)}</s> ` : ''}${rub(sumWithout(o.items, gone))}</b></div>`
    + (btns ? `<div class="acts">${btns}</div>` : '') + '</article>';
}

// Список блюд для кассира: нажал на блюдо, «Есть» сменилось на «Нет». Гости видят это сразу.
function stockView() {
  return '<div class="stock"><h1 class="head">Наличие</h1>'
    + '<p class="muted">Нажмите на блюдо, которого нет. Гости сразу увидят «Нет в наличии» и не смогут его выбрать. Блюдо появилось: нажмите ещё раз.</p>'
    + sections.map((s) => `<section><h2 class="head">${esc(s.title)}</h2><div class="sk-grid">`
      + items.filter((i) => i.section === s.id).map((i) => `<button type="button" class="sk${off.has(i.id) ? ' no' : ''}" data-stock="${i.id}"${busy.has(i.id) ? ' disabled' : ''}>`
        + `<span>${esc(i.name)}</span><b class="head">${off.has(i.id) ? 'Нет' : 'Есть'}</b></button>`).join('')
      + '</div></section>').join('') + '</div>';
}

function render() {
  const nNew = orders.filter((o) => o.status === 'new').length;
  document.title = `${nNew ? `(${nNew}) ` : ''}Касса: ${cafe.name}`;
  stockEl.textContent = mode === 'stock' ? `Заказы${nNew ? ` · новых ${nNew}` : ''}` : `Наличие${off.size ? ` · нет ${off.size}` : ''}`;
  stockEl.classList.toggle('hot', mode === 'stock' && nNew > 0);
  if (mode === 'stock') { app.innerHTML = stockView(); return; }
  app.innerHTML = '<div class="cols">' + COLS.map((c) => {
    const list = orders.filter((o) => o.status === c.key)
      .sort((a, b) => c.sort * ((a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)))
      .slice(0, c.key === 'punched' ? 30 : 100);
    return `<section class="col col-${c.key}"><h2 class="head">${c.title} <span class="num">${list.length}</span></h2>`
      + (list.length ? list.map(card).join('') : `<p class="muted">${c.empty}</p>`) + '</section>';
  }).join('') + '</div>';
}

function loginView(msg = '') {
  app.innerHTML = '<div class="login"><h1 class="head">Касса</h1>'
    + '<p>Войдите аккаунтом Google, который хозяин добавил в список кассиров.</p>'
    + (msg ? `<p class="err">${esc(msg)}</p>` : '')
    + '<button type="button" class="act head big" id="in">Войти через Google</button></div>';
}

async function subscribe(user) {
  const { f, db } = await firestore();
  const since = f.Timestamp.fromMillis(Date.now() - 12 * 3600 * 1000);
  const q = f.query(f.collection(db, 'orders'), f.where('createdAt', '>=', since), f.orderBy('createdAt', 'desc'), f.limit(150));
  app.innerHTML = '<p class="muted center">Загрузка заказов…</p>';
  unsubMenu = f.onSnapshot(f.doc(db, 'menu', 'live'), (s) => {
    off = new Set(cleanOff(s.exists() ? s.data().off : []));
    if (!first) render(); // до первых заказов на экране «Загрузка заказов…»
  }, (err) => console.error(err));
  unsub = f.onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    netEl.hidden = !snap.metadata.fromCache;
    const added = snap.docChanges().filter((ch) => ch.type === 'added' && ch.doc.data().status === 'new').map((ch) => ch.doc.id);
    orders = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((o) => o.status !== 'cancelled');
    if (!first && added.length) {
      beep();
      added.forEach((id) => fresh.add(id));
      setTimeout(() => { added.forEach((id) => fresh.delete(id)); render(); }, 6000);
    }
    first = false;
    render();
  }, (err) => {
    console.error(err);
    loginView(err.code === 'permission-denied'
      ? `У почты ${user.email} нет доступа к кассе. Попросите хозяина добавить её.`
      : 'Нет связи с базой. Проверьте интернет и обновите страницу.');
  });
}

async function setStock(id) {
  busy.add(id);
  render();
  try {
    const { f, db } = await firestore();
    const was = off.has(id);
    await f.setDoc(f.doc(db, 'menu', 'live'), { off: was ? f.arrayRemove(id) : f.arrayUnion(id), updatedAt: f.serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error(err);
    toast('Не сохранилось. Проверьте интернет и нажмите ещё раз.');
  }
  busy.delete(id);
  render();
}

async function setStatus(id, status, btn) {
  btn.disabled = true;
  try {
    const { f, db } = await firestore();
    const data = { status, updatedAt: f.serverTimestamp() };
    if (status === 'punched') data.waitMin = wait;
    // Каких блюд не было при «Принят» и «Пробит»: пробитый заказ хранит верную сумму навсегда.
    const o = orders.find((x) => x.id === id);
    if (o && status !== 'cancelled') data.gone = goneIds(o.items, 'new', null, off);
    await f.updateDoc(f.doc(db, 'orders', id), data);
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    toast('Не сохранилось. Проверьте интернет и нажмите ещё раз.');
  }
}

let api;
try {
  api = await authApi();
} catch (err) {
  console.error(err);
  loginView('Нет связи с сервером. Проверьте интернет и обновите страницу.');
}

if (api) {
  const { m, auth } = api;
  m.onAuthStateChanged(auth, (user) => {
    unsub?.();
    unsubMenu?.();
    unsub = null;
    unsubMenu = null;
    orders = [];
    off = new Set();
    mode = 'orders';
    stockEl.hidden = !user;
    first = true;
    out.hidden = !user;
    who.textContent = user ? user.email : '';
    signed = !!user;
    netEl.hidden = true;
    soundCheck();
    if (user) subscribe(user); else loginView();
  });

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    // Без await: окно входа Google должно открыться в том же нажатии.
    try { audio ||= new AudioContext(); audio.resume().then(soundCheck, () => {}); } catch { /* без звука */ }
    if (!wake) keepAwake();
    soundCheck();
    if (b.id === 'sound') {
      beep();
    } else if (b.id === 'in') {
      try { await m.signInWithPopup(auth, new m.GoogleAuthProvider()); } catch (err) {
        if (err.code !== 'auth/popup-closed-by-user') loginView('Вход не удался. Попробуйте ещё раз.');
      }
    } else if (b.id === 'out') {
      m.signOut(auth);
    } else if (b.id === 'stock') {
      mode = mode === 'stock' ? 'orders' : 'stock';
      render();
      window.scrollTo(0, 0);
    } else if (b.dataset.stock) {
      setStock(b.dataset.stock);
    } else if (b.dataset.wait) {
      wait = Number(b.dataset.wait);
      try { localStorage.setItem('sm-wait', String(wait)); } catch { /* без памяти браузера */ }
      render();
    } else if (b.dataset.set) {
      setStatus(b.dataset.id, b.dataset.set, b);
    } else if (b.dataset.cancel) {
      const id = b.dataset.cancel;
      if (armed.has(id)) {
        clearTimeout(armed.get(id));
        armed.delete(id);
        setStatus(id, 'cancelled', b);
      } else {
        armed.set(id, setTimeout(() => { armed.delete(id); render(); }, 3000));
        render();
      }
    }
  });
}
