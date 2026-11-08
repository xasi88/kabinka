// Бренд заведения: всё, что меняется при переносе основы на другую шашлычную.
// Цвета и шрифты: site/base.css. Блюда, цены, фото: site/js/data.js.
// Все шаги для нового заведения: docs/Новое заведение.md.

export const cafe = {
  name: 'Сочный Мощный 2', // полное название: вкладка браузера, касса
  mark: '2', // знак слева от названия: цифра или буква до 3 знаков
  words: ['Сочный', 'Мощный'], // название в шапке меню: одна или две строки
  logo: '', // логотип в site/img, например 'logo.webp'. Есть логотип: он вместо знака
  point: 2, // номер точки, если у заведения их несколько
  cabins: 20, // число кабинок: выбор номера в меню
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Шапка и вкладка из настроек. lines: строки рядом со знаком, base: путь до папки site.
export function applyBrand(lines, title, base = '') {
  const el = document.querySelector('.wm');
  if (el) {
    el.innerHTML = (cafe.logo ? `<img src="${base}img/${esc(cafe.logo)}" alt="${esc(cafe.name)}">` : `<i>${esc(cafe.mark)}</i>`)
      + `<div>${lines.filter(Boolean).map((l) => `<span>${esc(l)}</span>`).join('')}</div>`;
  }
  document.title = title;
}
