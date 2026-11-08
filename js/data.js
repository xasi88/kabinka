// Меню «Сочный Мощный 2».
// Источник: Яндекс Карты, 2026-11-08, пометка «давно не обновлялось». Цены сверить в заведении.
// Фото: Яндекс Карты заведения. Нужны фото от владельца.

export const cafe = {
  name: 'Сочный Мощный 2',
  point: 2,
  cabins: 20, // число кабинок не знаем: уточнить в заведении
};

export const sections = [
  { id: 'shashlyk', title: 'Шашлык' },
  { id: 'mangal', title: 'Мангал' },
  { id: 'ryba', title: 'Рыба' },
];

export const items = [
  { id: 'lula', section: 'shashlyk', name: 'Люля-кебаб', price: 400, photo: 'img/lula.webp', hit: true },
  { id: 'baranina', section: 'shashlyk', name: 'Шашлык из баранины', price: 500 },
  { id: 'govyadina', section: 'shashlyk', name: 'Говядина', price: 500 },
  { id: 'kurica', section: 'shashlyk', name: 'Курица', price: 450, photo: 'img/kurica.webp' },
  { id: 'antrekot', section: 'shashlyk', name: 'Антрекот', price: 600 },
  { id: 'pistolet', section: 'shashlyk', name: 'Пистолет', price: 600 },
  { id: 'perepelki', section: 'shashlyk', name: 'Перепелки', price: 750, photo: 'img/perepelki.webp' },
  { id: 'ovoshchi', section: 'mangal', name: 'Овощи на мангале', price: 350 },
  { id: 'griby', section: 'mangal', name: 'Грибы на мангале', price: 350 },
  { id: 'osetrina', section: 'ryba', name: 'Осетрина', price: 1000 },
];
