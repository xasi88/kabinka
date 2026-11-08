// Корзина и заказ. Без DOM и Firebase: проверяется тестами `tests/cart.test.mjs`.

export const MAX_QTY = 20;
export const MAX_CABIN = 99;
export const ORDER_TTL = 6 * 3600 * 1000; // статус заказа гость видит 6 часов

// Сохранённый заказ гостя: старый (вчерашний) не показываем.
export function freshOrder(o, now) {
  return o && typeof o.id === 'string' && typeof o.at === 'number' && now - o.at >= 0 && now - o.at < ORDER_TTL ? o : null;
}

export const STATUS = {
  new: 'Ждёт кассира',
  accepted: 'Кассир принял заказ',
  punched: 'Заказ пробит, готовим',
  cancelled: 'Заказ отменён',
};

export function addItem(cart, id) {
  const next = { ...cart };
  next[id] = Math.min((next[id] || 0) + 1, MAX_QTY);
  return next;
}

export function removeItem(cart, id) {
  const next = { ...cart };
  if (!next[id]) return next;
  next[id] -= 1;
  if (next[id] <= 0) delete next[id];
  return next;
}

// Строки заказа в порядке меню. Блюда, которых нет в меню, отбрасываются.
export function cartLines(cart, items) {
  return items
    .filter((it) => cart[it.id] > 0)
    .map((it) => ({ id: it.id, name: it.name, price: it.price, qty: cart[it.id] }));
}

export const count = (lines) => lines.reduce((s, l) => s + l.qty, 0);
export const total = (lines) => lines.reduce((s, l) => s + l.price * l.qty, 0);

export function parseCabin(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_CABIN ? n : null;
}

export function cabinFromUrl(search) {
  return parseCabin(new URLSearchParams(search).get('k'));
}

// Заказ для базы. Время ставит база (serverTimestamp), его добавляет страница.
export function buildOrder(cabin, lines, point) {
  if (!parseCabin(cabin)) throw new Error('Нет номера кабинки');
  if (!lines.length) throw new Error('Корзина пуста');
  return {
    cabin,
    items: lines.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
    total: total(lines),
    status: 'new',
    point,
  };
}

export function rub(n) {
  return n.toLocaleString('ru-RU').replace(/\s/g, ' ') + ' ₽';
}

export function plural(n, one, few, many) {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

export const dishes = (n) => `${n} ${plural(n, 'блюдо', 'блюда', 'блюд')}`;
