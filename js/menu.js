// Меню гостя: блюда, корзина, отправка на кассу, «Ваши заказы», дозаказ, время готовности, наличие.
import { sections, items } from './data.js?v=c0b02ce3';
import { cafe, applyBrand, pageTitle } from './brand.js?v=c0b02ce3';
import {
  addItem, removeItem, cartLines, count, total, cabinFromUrl, parseCabin,
  buildOrder, rub, dishes, freshOrder, freshOrders, ordersTotal, parentFor, statusText,
  cleanOff, offLines, offFromRest, goneIds, sumWithout,
} from './cart.js?v=c0b02ce3';
import { firestore } from './db.js?v=c0b02ce3';
import { firebaseConfig } from './firebase-config.js?v=c0b02ce3';

const $ = (s) => document.querySelector(s);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* без памяти браузера */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* без памяти браузера */ } },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);
const hhmm = (ms) => new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const stText = (o) => statusText(o, Date.now(), hhmm);

let cart = store.get('sm-cart') || {};
const urlCabin = cabinFromUrl(location.search);
let cabin = urlCabin ?? parseCabin(store.get('sm-cabin'));
if (urlCabin) store.set('sm-cabin', urlCabin);

// Заказы с этого телефона за 6 часов. Старый формат (один заказ) переносим в список.
function loadOrders() {
  const list = store.get('sm-orders');
  if (Array.isArray(list)) return list;
  const one = freshOrder(store.get('sm-order'), Date.now());
  store.del('sm-order');
  return one ? [one] : [];
}
let orders = freshOrders(loadOrders(), Date.now());
const saveOrders = () => store.set('sm-orders', orders);
saveOrders();

let view = null; // null, 'cart', 'picker', 'sent'
let sending = false;
let error = '';
let pendingRef = null;
let warmed = false;
const unsubs = new Map();
// Блюда, которых нет: их выключает кассир. Прошлый список из памяти браузера, пока не пришёл новый.
let off = new Set(cleanOff(store.get('sm-off')));
let liveOff = false;

// Библиотека базы грузится заранее, чтобы «Отправить» срабатывало сразу.
function warm() {
  if (warmed) return;
  warmed = true;
  firestore().then(watchMenu).catch(() => { warmed = false; });
}

const lines = () => cartLines(cart, items);
const bad = () => offLines(lines(), off);

function setOff(list) {
  off = new Set(cleanOff(list));
  store.set('sm-off', [...off]);
  refreshCtls();
  renderBar();
  if (view === 'cart' || view === 'sent') renderSheet();
}

// Наличие вживую: кассир выключил блюдо, гость видит это сразу.
function watchMenu({ f, db }) {
  f.onSnapshot(f.doc(db, 'menu', 'live'), (s) => {
    liveOff = true;
    setOff(s.exists() ? s.data().off : []);
  }, (err) => console.error(err));
}

// Первый список без библиотеки базы: короткий запрос, ответ за доли секунды.
fetch(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/menu/live?mask.fieldPaths=off`)
  .then((r) => (r.ok || r.status === 404 ? r.json() : Promise.reject(r.status)))
  .then((j) => { if (!liveOff) setOff(offFromRest(j)); })
  .catch(() => { /* остаётся прошлый список */ });

const ctl = (id) => (off.has(id) ? '<span class="no">Нет в наличии</span>' : stepper(id));

function refreshCtls() {
  document.querySelectorAll('#list [data-ctl]').forEach((c) => {
    c.innerHTML = ctl(c.dataset.ctl);
    c.closest('article').classList.toggle('off', off.has(c.dataset.ctl));
  });
}

function stepper(id) {
  const q = cart[id] || 0;
  if (!q) return `<button class="add" type="button" data-add="${id}" aria-label="Добавить">+</button>`;
  return `<div class="step"><button type="button" data-del="${id}" aria-label="Убрать одно">−</button>`
    + `<b class="num">${q}</b><button type="button" class="plus" data-add="${id}" aria-label="Добавить ещё">+</button></div>`;
}

function card(it) {
  const box = `<div class="ctl" data-ctl="${it.id}">${ctl(it.id)}</div>`;
  const no = off.has(it.id) ? ' off' : '';
  if (it.hit && it.photo) {
    return `<article class="hero${no}"><img src="img/b/${it.photo}.webp" alt="" width="800" height="560" fetchpriority="high" onerror="this.remove()"><div class="fade"></div>`
      + `<span class="tag head">Хит</span><div class="nm"><h3 class="head">${esc(it.name)}</h3>`
      + `<p class="num">${rub(it.price)}</p></div>${box}</article>`;
  }
  return `<article class="it${no}">${it.photo ? `<img src="img/t/${it.photo}.webp" alt="" width="64" height="64" decoding="async" onerror="this.remove()">` : ''}`
    + `<div class="t"><h3 class="head">${esc(it.name)}</h3><p class="num">${rub(it.price)}</p></div>${box}</article>`;
}

function renderMenu() {
  const used = sections.filter((s) => items.some((i) => i.section === s.id));
  $('#tabs').innerHTML = used.map((s, i) => `<a class="tab${i ? '' : ' on'}" href="#s-${s.id}" data-tab="${s.id}">${esc(s.title)}</a>`).join('');
  $('#list').innerHTML = used.map((s) => `<section class="sec" id="s-${s.id}"><h2 class="head">${esc(s.title)}</h2>`
    + items.filter((i) => i.section === s.id).map(card).join('') + '</section>').join('');
  const obs = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setTab(e.target.id.slice(2))), { rootMargin: '-40% 0px -55% 0px' });
  document.querySelectorAll('.sec').forEach((s) => obs.observe(s));
}

function setTab(id) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === id));
}

function renderHeader() {
  $('#cab').textContent = cabin ? `Кабинка ${cabin}` : 'Выбрать кабинку';
}

function renderBar() {
  const bar = $('#bar');
  const ls = lines();
  const last = orders[orders.length - 1];
  if (count(ls)) {
    bar.innerHTML = `<b class="head">${orders.length ? 'Отправить дозаказ' : 'Отправить на кассу'}</b><span class="num">${dishes(count(ls))} · ${rub(total(ls))}</span>`;
    bar.dataset.go = 'cart';
  } else if (last) {
    bar.innerHTML = `<b class="head">${orders.length > 1 ? 'Ваши заказы' : 'Ваш заказ'}</b><span>${esc(stText(last))}</span>`;
    bar.dataset.go = 'sent';
  }
  bar.hidden = !count(ls) && !last;
}

function lineRow(l, edit, gone) {
  if (gone) {
    return `<div class="ln off"><div class="t"><h3 class="head"><s>${esc(l.name)} × ${l.qty}</s></h3><p class="no">Нет в наличии</p></div></div>`;
  }
  if (edit && off.has(l.id)) {
    return `<div class="ln off"><div class="t"><h3 class="head">${esc(l.name)} × ${l.qty}</h3><p class="no">Нет в наличии</p></div>`
      + `<button type="button" class="drop" data-drop="${l.id}">Убрать</button></div>`;
  }
  return `<div class="ln"><div class="t"><h3 class="head">${esc(l.name)}${edit ? '' : ` × ${l.qty}`}</h3>`
    + `<p class="num">${rub(l.price * l.qty)}</p></div>${edit ? `<div class="ctl" data-ctl="${l.id}">${stepper(l.id)}</div>` : ''}</div>`;
}

// Заказ гостя: блюда «Нет» зачёркнуты, сумма без них, как на кассе.
function orderBlock(o) {
  const gone = goneIds(o.lines, o.status, o.gone, off);
  const sum = gone.length ? `<s>${rub(o.total)}</s> ${rub(sumWithout(o.lines, gone))}` : rub(o.total);
  return `<div class="og${o.status === 'cancelled' ? ' gone' : ''}"><div class="og-top"><b class="head">${o.parent ? 'Дозаказ' : 'Заказ'} в ${hhmm(o.at)}</b>`
    + `<span class="num">${sum}</span></div><p class="st st-${o.status}">${esc(stText(o))}</p>`
    + `<div class="lines">${o.lines.map((l) => lineRow(l, false, gone.includes(l.id))).join('')}</div></div>`;
}

function sheetHtml() {
  if (view === 'picker') {
    const nums = Array.from({ length: cafe.cabins }, (_, i) => i + 1);
    return '<h2 class="head">Номер кабинки</h2><p class="muted">Он написан на табличке с QR-кодом.</p><div class="grid">'
      + nums.map((n) => `<button type="button" class="nb num${n === cabin ? ' on' : ''}" data-cabin="${n}">${n}</button>`).join('') + '</div>';
  }
  if (view === 'cart') {
    const ls = lines();
    const gone = bad().length;
    const label = sending ? 'Отправляем…' : !cabin ? 'Выбрать кабинку' : orders.length ? 'Отправить дозаказ' : 'Отправить на кассу';
    return `<h2 class="head">${orders.length ? 'Проверьте дозаказ' : 'Проверьте заказ'}</h2><button type="button" class="cabrow" data-view="picker">`
      + `<b>${cabin ? `Кабинка ${cabin}` : 'Кабинка не выбрана'}</b><span>Сменить</span></button>`
      + `<div class="lines">${ls.map((l) => lineRow(l, true)).join('')}</div>`
      + `<div class="sum"><span>Итого</span><b class="num">${rub(total(ls))}</b></div>`
      + (gone ? '<p class="err">Пока вы выбирали, это закончилось. Уберите из заказа, и можно отправлять.</p>' : '')
      + (error ? `<p class="err">${error}</p>` : '')
      + `<button type="button" class="send head" data-send${sending || !ls.length || gone ? ' disabled' : ''}>${label}</button>`;
  }
  if (view === 'sent' && orders.length) {
    const waiting = orders.filter((o) => o.status === 'new');
    const say = waiting.length ? `<p class="say">Подойдите к кассе и скажите: <b>«Кабинка ${waiting[0].cabin}»</b></p>` : '';
    return `<h2 class="head">${orders.length > 1 ? 'Ваши заказы' : 'Ваш заказ'}</h2>${say}`
      + orders.slice().reverse().map(orderBlock).join('')
      + (orders.length > 1 ? `<div class="sum"><span>Всего</span><b class="num">${rub(ordersTotal(orders, off))}</b></div>` : '')
      + '<button type="button" class="send head" data-more>Дозаказать</button>';
  }
  return '';
}

function renderSheet() {
  const sh = $('#sheet');
  const html = view ? sheetHtml() : '';
  const top = sh.querySelector('.panel')?.scrollTop || 0; // обновление статуса не сбрасывает прокрутку
  const was = !sh.hidden;
  sh.hidden = !html;
  document.body.classList.toggle('lock', !!html);
  sh.innerHTML = html ? `<div class="shade" data-close></div><div class="panel${was ? ' still' : ''}" role="dialog" aria-modal="true">`
    + `<button type="button" class="x" data-close aria-label="Закрыть">×</button>${html}</div>` : '';
  if (html && was) sh.querySelector('.panel').scrollTop = top;
}

function changed() {
  store.set('sm-cart', cart);
  pendingRef = null;
  refreshCtls();
  if (view === 'cart' && !count(lines())) view = null;
  renderBar();
  renderSheet();
}

// Статус каждого заказа вживую: «Принят», «Пробит» и время готовности.
async function watchAll() {
  const todo = orders.filter((o) => !unsubs.has(o.id) && o.status !== 'cancelled');
  if (!todo.length) return;
  try {
    const { f, db } = await firestore();
    todo.forEach((o) => {
      if (unsubs.has(o.id)) return;
      unsubs.set(o.id, f.onSnapshot(f.doc(db, 'orders', o.id), (s) => {
        const i = orders.findIndex((x) => x.id === o.id);
        if (!s.exists() || i < 0) return;
        const d = s.data();
        orders[i] = { ...orders[i], status: d.status, waitMin: d.waitMin, gone: d.gone, updatedMs: d.updatedAt ? d.updatedAt.toMillis() : undefined };
        saveOrders();
        renderBar();
        if (view === 'sent') renderSheet();
      }, (err) => console.error(err)));
    });
  } catch (err) { console.error(err); }
}

async function send() {
  if (sending || bad().length) return;
  let order;
  try { order = buildOrder(cabin, lines(), cafe.point, parentFor(orders, cabin)); } catch { return; }
  sending = true;
  error = '';
  renderSheet();
  try {
    const { f, db } = await withTimeout(firestore(), 15000);
    const retry = !!pendingRef;
    pendingRef ||= f.doc(f.collection(db, 'orders'));
    const ref = pendingRef;
    const exists = retry && await withTimeout(f.getDoc(ref), 8000).then((s) => s.exists()).catch(() => false);
    if (!exists) await withTimeout(f.setDoc(ref, { ...order, createdAt: f.serverTimestamp() }), 12000);
    pendingRef = null;
    orders.push({ id: ref.id, cabin: order.cabin, lines: order.items, total: order.total, status: 'new', at: Date.now(), parent: order.parent || null });
    saveOrders();
    cart = {};
    store.set('sm-cart', cart);
    refreshCtls();
    view = 'sent';
    watchAll();
  } catch (err) {
    console.error(err);
    error = 'Не отправилось. Проверьте интернет и нажмите ещё раз.';
  }
  sending = false;
  renderBar();
  renderSheet();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a, [data-close]');
  if (!t) return;
  const d = t.dataset;
  if (d.add) { if (!off.has(d.add)) { cart = addItem(cart, d.add); changed(); } warm(); }
  else if (d.del) { cart = removeItem(cart, d.del); changed(); }
  else if (d.drop) { cart = { ...cart }; delete cart[d.drop]; changed(); }
  else if (d.cabin) {
    cabin = Number(d.cabin);
    store.set('sm-cabin', cabin);
    renderHeader();
    view = count(lines()) ? 'cart' : null;
    renderSheet();
  }
  else if (d.view) { view = d.view; renderSheet(); }
  else if (t.id === 'bar') { view = d.go; renderSheet(); }
  else if (t.id === 'cab') { view = 'picker'; renderSheet(); }
  else if ('close' in d) { view = null; error = ''; renderSheet(); }
  else if ('send' in d) { if (cabin) send(); else { view = 'picker'; renderSheet(); } }
  else if ('more' in d) { view = null; renderSheet(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  else if (d.tab) setTab(d.tab);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && view) { view = null; renderSheet(); }
});

// «Примерно к 14:35» сменится на «Чуть дольше обычного», когда время выйдет.
setInterval(() => {
  if (!orders.some((o) => o.status === 'punched')) return;
  renderBar();
  if (view === 'sent') renderSheet();
}, 30000);

applyBrand(cafe.words.length ? cafe.words : ['Меню'], pageTitle('Меню'));
renderMenu();
renderHeader();
renderBar();
watchAll();
if (count(lines())) warm();
// Свободная минута браузера может не наступить: предел 1,5 с (проверено 2026-11-08).
else setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(warm, { timeout: 1500 }) : warm()), 2000);
