// Меню гостя: блюда, корзина, отправка заказа на кассу, статус заказа.
import { cafe, sections, items } from './data.js?v=e4622669';
import {
  addItem, removeItem, cartLines, count, total, cabinFromUrl, parseCabin,
  buildOrder, rub, dishes, STATUS,
} from './cart.js?v=e4622669';
import { firestore } from './db.js?v=e4622669';

const $ = (s) => document.querySelector(s);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* без памяти браузера */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* без памяти браузера */ } },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

let cart = store.get('sm-cart') || {};
const urlCabin = cabinFromUrl(location.search);
let cabin = urlCabin ?? parseCabin(store.get('sm-cabin'));
if (urlCabin) store.set('sm-cabin', urlCabin);
let current = store.get('sm-order');
let view = null; // null, 'cart', 'picker', 'sent'
let sending = false;
let error = '';
let pendingRef = null;
let unsub = null;

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
    return `<article class="hero"><img src="${it.photo}" alt=""><div class="fade"></div>`
      + `<span class="tag head">Хит</span><div class="nm"><h3 class="head">${esc(it.name)}</h3>`
      + `<p class="num">${rub(it.price)}</p></div>${ctl}</article>`;
  }
  return `<article class="it">${it.photo ? `<img src="${it.photo}" alt="" loading="lazy">` : ''}`
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
  if (count(ls)) {
    bar.innerHTML = `<b class="head">Отправить на кассу</b><span class="num">${dishes(count(ls))} · ${rub(total(ls))}</span>`;
    bar.dataset.go = 'cart';
  } else if (current) {
    bar.innerHTML = `<b class="head">Ваш заказ</b><span>${STATUS[current.status] || ''}</span>`;
    bar.dataset.go = 'sent';
  }
  bar.hidden = !count(ls) && !current;
}

function lineRow(l, ctl) {
  return `<div class="ln"><div class="t"><h3 class="head">${esc(l.name)}${ctl ? '' : ` × ${l.qty}`}</h3>`
    + `<p class="num">${rub(l.price * l.qty)}</p></div>${ctl ? `<div class="ctl" data-ctl="${l.id}">${stepper(l.id)}</div>` : ''}</div>`;
}

function sheetHtml() {
  if (view === 'picker') {
    const nums = Array.from({ length: cafe.cabins }, (_, i) => i + 1);
    return '<h2 class="head">Номер кабинки</h2><p class="muted">Он написан на табличке с QR-кодом.</p><div class="grid">'
      + nums.map((n) => `<button type="button" class="nb num${n === cabin ? ' on' : ''}" data-cabin="${n}">${n}</button>`).join('') + '</div>';
  }
  if (view === 'cart') {
    const ls = lines();
    const label = sending ? 'Отправляем…' : cabin ? 'Отправить на кассу' : 'Выбрать кабинку';
    return `<h2 class="head">Проверьте заказ</h2><button type="button" class="cabrow" data-view="picker">`
      + `<b>${cabin ? `Кабинка ${cabin}` : 'Кабинка не выбрана'}</b><span>Сменить</span></button>`
      + `<div class="lines">${ls.map((l) => lineRow(l, true)).join('')}</div>`
      + `<div class="sum"><span>Итого</span><b class="num">${rub(total(ls))}</b></div>`
      + (error ? `<p class="err">${error}</p>` : '')
      + `<button type="button" class="send head" data-send${sending || !ls.length ? ' disabled' : ''}>${label}</button>`;
  }
  if (view === 'sent' && current) {
    return `<h2 class="head">Заказ отправлен</h2><p class="say">Подойдите к кассе и скажите: <b>«Кабинка ${current.cabin}»</b></p>`
      + `<p class="st head st-${current.status}">${STATUS[current.status] || ''}</p>`
      + `<div class="lines">${current.lines.map((l) => lineRow(l, false)).join('')}</div>`
      + `<div class="sum"><span>Итого</span><b class="num">${rub(current.total)}</b></div>`
      + '<button type="button" class="send head" data-new>Новый заказ</button>';
  }
  return '';
}

function renderSheet() {
  const sh = $('#sheet');
  const html = view ? sheetHtml() : '';
  sh.hidden = !html;
  document.body.classList.toggle('lock', !!html);
  sh.innerHTML = html ? `<div class="shade" data-close></div><div class="panel" role="dialog" aria-modal="true">`
    + `<button type="button" class="x" data-close aria-label="Закрыть">×</button>${html}</div>` : '';
}

function changed() {
  store.set('sm-cart', cart);
  pendingRef = null;
  document.querySelectorAll('#list [data-ctl]').forEach((c) => { c.innerHTML = stepper(c.dataset.ctl); });
  if (view === 'cart' && !count(lines())) view = null;
  renderBar();
  renderSheet();
}

async function watch() {
  if (!current) return;
  try {
    const { f, db } = await firestore();
    unsub?.();
    unsub = f.onSnapshot(f.doc(db, 'orders', current.id), (s) => {
      if (!s.exists() || !current) return;
      current = { ...current, status: s.data().status };
      store.set('sm-order', current);
      renderBar();
      if (view === 'sent') renderSheet();
    }, (err) => console.error(err));
  } catch (err) { console.error(err); }
}

async function send() {
  if (sending) return;
  let order;
  try { order = buildOrder(cabin, lines(), cafe.point); } catch { return; }
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
    current = { id: ref.id, cabin: order.cabin, lines: order.items, total: order.total, status: 'new' };
    store.set('sm-order', current);
    cart = {};
    store.set('sm-cart', cart);
    document.querySelectorAll('#list [data-ctl]').forEach((c) => { c.innerHTML = stepper(c.dataset.ctl); });
    view = 'sent';
    watch();
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
  if (d.add) { cart = addItem(cart, d.add); changed(); }
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
  else if ('new' in d) {
    unsub?.();
    unsub = null;
    current = null;
    store.del('sm-order');
    view = null;
    renderBar();
    renderSheet();
  }
  else if (d.tab) setTab(d.tab);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && view) { view = null; renderSheet(); }
});

renderMenu();
renderHeader();
renderBar();
watch();
