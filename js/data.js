// Меню «Сочный Мощный 2».
// Блюда и цены: Яндекс Карты (2026-11-08) и 2ГИС (обновлено 14 февраля 2025), цены совпадают.
// Фото: своя серия заведения в Яндекс Картах, подписи подтвердил автор 2026-11-08.
// Салаты и напитки: обычные для шашлычной, цены примерные. Заменить по фото меню (решение автора 2026-11-08).
// photo: имя файла в img/b (большое 800x560) и img/t (маленькое 160x160).

export const cafe = {
  name: 'Сочный Мощный 2',
  point: 2,
  cabins: 20, // число кабинок не знаем: уточнить в заведении
};

export const sections = [
  { id: 'shashlyk', title: 'Шашлык' },
  { id: 'mangal', title: 'Мангал' },
  { id: 'ryba', title: 'Рыба' },
  { id: 'salaty', title: 'Салаты' },
  { id: 'napitki', title: 'Напитки' },
];

export const items = [
  { id: 'lula', section: 'shashlyk', name: 'Люля-кебаб', price: 400, photo: 'lula', hit: true },
  { id: 'baranina', section: 'shashlyk', name: 'Шашлык из баранины', price: 500, photo: 'baranina' },
  { id: 'govyadina', section: 'shashlyk', name: 'Говядина', price: 500, photo: 'govyadina' },
  { id: 'kurica', section: 'shashlyk', name: 'Курица', price: 450, photo: 'kurica' },
  { id: 'antrekot', section: 'shashlyk', name: 'Антрекот', price: 600, photo: 'antrekot' },
  { id: 'pistolet', section: 'shashlyk', name: 'Пистолет', price: 600, photo: 'pistolet' },
  { id: 'perepelki', section: 'shashlyk', name: 'Перепелки', price: 750, photo: 'perepelki' },
  { id: 'ovoshchi', section: 'mangal', name: 'Овощи на мангале', price: 350, photo: 'ovoshchi' },
  { id: 'griby', section: 'mangal', name: 'Грибы на мангале', price: 350 },
  { id: 'osetrina', section: 'ryba', name: 'Осетрина', price: 1000, photo: 'osetrina' },
  { id: 'salat-ovoshchnoy', section: 'salaty', name: 'Салат овощной', price: 300 },
  { id: 'narezka', section: 'salaty', name: 'Нарезка из свежих овощей', price: 350 },
  { id: 'grecheskiy', section: 'salaty', name: 'Греческий', price: 400 },
  { id: 'cezar', section: 'salaty', name: 'Цезарь с курицей', price: 450 },
  { id: 'chay-chyorny', section: 'napitki', name: 'Чай чёрный (чайник)', price: 200 },
  { id: 'chay-zelyony', section: 'napitki', name: 'Чай зелёный (чайник)', price: 200 },
  { id: 'kompot', section: 'napitki', name: 'Компот 1 л', price: 250 },
  { id: 'mors', section: 'napitki', name: 'Морс 1 л', price: 300 },
  { id: 'sok', section: 'napitki', name: 'Сок 1 л', price: 300 },
  { id: 'kola', section: 'napitki', name: 'Кока-Кола 0,5 л', price: 150 },
  { id: 'voda-gaz', section: 'napitki', name: 'Вода с газом 0,5 л', price: 80 },
  { id: 'voda', section: 'napitki', name: 'Вода без газа 0,5 л', price: 80 },
];
