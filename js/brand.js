// Бренд заведения. У самой системы названия нет (решение автора 2026-11-08): поля пустые,
// на экранах «Меню» и «Касса». Название, знак и логотип заполняются только для клиента.
// Цвета и шрифты: site/base.css. Блюда, цены, фото: site/js/data.js.
// Все шаги для заведения клиента: docs/Новое заведение.md.

export const cafe = {
  name: '', // полное название заведения: вкладка браузера, касса
  mark: '', // знак слева от названия: цифра или буква до 3 знаков
  words: [], // название в шапке меню: одна или две строки
  logo: '', // логотип в site/img, например 'logo.webp'. Есть логотип: он вместо знака
  point: 1, // номер точки, если у заведения их несколько
  cabins: 20, // число кабинок: выбор номера в меню
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Заголовок вкладки: «Меню» или «Меню: Название», если название есть.
export const pageTitle = (page) => (cafe.name ? `${page}: ${cafe.name}` : page);

// Шапка из настроек. lines: строки рядом со знаком, base: путь до папки site.
// Без знака и логотипа строки крупнее (класс plain).
export function applyBrand(lines, title, base = '') {
  const el = document.querySelector('.wm');
  if (el) {
    const sign = cafe.logo ? `<img src="${base}img/${esc(cafe.logo)}" alt="${esc(cafe.name)}">` : cafe.mark ? `<i>${esc(cafe.mark)}</i>` : '';
    el.innerHTML = sign + `<div>${lines.filter(Boolean).map((l) => `<span>${esc(l)}</span>`).join('')}</div>`;
    el.classList.toggle('plain', !sign);
  }
  document.title = title;
}
