// Меню «Сочный Мощный 2».
// Блюда и цены: Яндекс Карты (2026-11-08) и 2ГИС (обновлено 14 февраля 2025), цены совпадают.
// Фото: своя серия заведения в Яндекс Картах, подписи подтвердил автор 2026-11-08.
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
];
