// Меню гостя: блюда, корзина, отправка на кассу, «Ваши заказы», дозаказ, время готовности.
import { cafe, sections, items } from './data.js?v=927b8f56';
import {
  addItem, removeItem, cartLines, count, total, cabinFromUrl, parseCabin,
  buildOrder, rub, dishes, freshOrder, freshOrders, ordersTotal, parentFor, statusText,
} from './cart.js?v=927b8f56';
import { firestore } from './db.js?v=927b8f56';

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

// Библиотека базы грузится заранее, чтобы «Отправить» срабатывало сразу.
function warm() {
  if (warmed) return;
  warmed = true;
  firestore().catch(() => { warmed = false; });
}

const lines = () => cartLines(cart, items);

function stepper(id) {
  const q = cart[id] || 0;
  if (!q) return `<button class="add" type="button" data-add="${id}" aria-label="Добавить">+</button>`;
  return `<div class="step"><button type="button" data-del="${id}" aria-label="Убрать одно">−</button>`
    + `<b class="num">${q}</b><button type="button" class="plus" data-add="${id}" aria-label="Добавить ещё">+</button></div>`;
}

function card(it) {
  const ctl = `<div class="ctl" data-ctl="${it.id}">${stepper(it.id)}</div>`;
  if (it.hit && it.photo) {
    return `<article class="hero"><img src="img/b/${it.photo}.webp" alt="" width="800" height="560" fetchpriority="high" onerror="this.remove()"><div class="fade"></div>`
      + `<span class="tag head">Хит</span><div class="nm"><h3 class="head">${esc(it.name)}</h3>`
      + `<p class="num">${rub(it.price)}</p></div>${ctl}</article>`;
  }
  return `<article class="it">${it.photo ? `<img src="img/t/${it.photo}.webp" alt="" width="64" height="64" decoding="async" onerror="this.remove()">` : ''}`
    + `<div class="t"><h3 class="head">${esc(it.name)}</h3><p class="num">${rub(it.price)}</p></div>${ctl}</article>`;
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

function lineRow(l, ctl) {
  return `<div class="ln"><div class="t"><h3 class="head">${esc(l.name)}${ctl ? '' : ` × ${l.qty}`}</h3>`
    + `<p class="num">${rub(l.price * l.qty)}</p></div>${ctl ? `<div class="ctl" data-ctl="${l.id}">${stepper(l.id)}</div>` : ''}</div>`;
}

function orderBlock(o) {
  return `<div class="og${o.status === 'cancelled' ? ' gone' : ''}"><div class="og-top"><b class="head">${o.parent ? 'Дозаказ' : 'Заказ'} в ${hhmm(o.at)}</b>`
    + `<span class="num">${rub(o.total)}</span></div><p class="st st-${o.status}">${esc(stText(o))}</p>`
    + `<div class="lines">${o.lines.map((l) => lineRow(l, false)).join('')}</div></div>`;
}

function sheetHtml() {
  if (view === 'picker') {
    const nums = Array.from({ length: cafe.cabins }, (_, i) => i + 1);
    return '<h2 class="head">Номер кабинки</h2><p class="muted">Он написан на табличке с QR-кодом.</p><div class="grid">'
      + nums.map((n) => `<button type="button" class="nb num${n === cabin ? ' on' : ''}" data-cabin="${n}">${n}</button>`).join('') + '</div>';
  }
  if (view === 'cart') {
    const ls = lines();
    const label = sending ? 'Отправляем…' : !cabin ? 'Выбрать кабинку' : orders.length ? 'Отправить дозаказ' : 'Отправить на кассу';
    return `<h2 class="head">${orders.length ? 'Проверьте дозаказ' : 'Проверьте заказ'}</h2><button type="button" class="cabrow" data-view="picker">`
      + `<b>${cabin ? `Кабинка ${cabin}` : 'Кабинка не выбрана'}</b><span>Сменить</span></button>`
      + `<div class="lines">${ls.map((l) => lineRow(l, true)).join('')}</div>`
      + `<div class="sum"><span>Итого</span><b class="num">${rub(total(ls))}</b></div>`
      + (error ? `<p class="err">${error}</p>` : '')
      + `<button type="button" class="send head" data-send${sending || !ls.length ? ' disabled' : ''}>${label}</button>`;
  }
  if (view === 'sent' && orders.length) {
    const waiting = orders.filter((o) => o.status === 'new');
    const say = waiting.length ? `<p class="say">Подойдите к кассе и скажите: <b>«Кабинка ${waiting[0].cabin}»</b></p>` : '';
    return `<h2 class="head">${orders.length > 1 ? 'Ваши заказы' : 'Ваш заказ'}</h2>${say}`
      + orders.slice().reverse().map(orderBlock).join('')
      + (orders.length > 1 ? `<div class="sum"><span>Всего</span><b class="num">${rub(ordersTotal(orders))}</b></div>` : '')
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
  document.querySelectorAll('#list [data-ctl]').forEach((c) => { c.innerHTML = stepper(c.dataset.ctl); });
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
        orders[i] = { ...orders[i], status: d.status, waitMin: d.waitMin, updatedMs: d.updatedAt ? d.updatedAt.toMillis() : undefined };
        saveOrders();
        renderBar();
        if (view === 'sent') renderSheet();
      }, (err) => console.error(err)));
    });
  } catch (err) { console.error(err); }
}

async function send() {
  if (sending) return;
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
    document.querySelectorAll('#list [data-ctl]').forEach((c) => { c.innerHTML = stepper(c.dataset.ctl); });
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
  if (d.add) { cart = addItem(cart, d.add); changed(); warm(); }
  else if (d.del) { cart = removeItem(cart, d.del); changed(); }
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

renderMenu();
renderHeader();
renderBar();
watchAll();
if (count(lines())) warm();
// Свободная минута браузера может не наступить: предел 1,5 с (проверено 2026-11-08).
else setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(warm, { timeout: 1500 }) : warm()), 2000);
