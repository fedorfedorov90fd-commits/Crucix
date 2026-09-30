// ============================================================
// COUNTRIES.JS — 208 стран и территорий (Network Map, v2.0)
// ============================================================
// Формат: { id, name, status, color, code, lat, lng }
//   id     — латиница, дефисы, для сопоставления
//   name   — русское название
//   status — critical | pre-war | high | medium | normal
//   color  — цвет по статусу
//   code   — ISO Alpha-2 (RU, US, CN)
//   lat    — широта
//   lng    — долгота
//
// Источник: semantic-map/js/countries.js (208 записей).
// Поле code добавлено для Network Map (метаданные узлов графа).
// ============================================================

console.log('COUNTRIES.JS загружен (Network Map, 208 стран)');

window.ALL_COUNTRIES = [
    // CRITICAL (1)
    { id: 'ukraine', name: 'Украина', status: 'critical', color: '#ef4444', code: 'UA', lat: 48.4, lng: 31.2 },

    // PRE-WAR (5)
    { id: 'north-korea', name: 'Северная Корея', status: 'pre-war', color: '#f97316', code: 'KP', lat: 40.7, lng: 126.9 },
    { id: 'russia', name: 'Россия', status: 'pre-war', color: '#f97316', code: 'RU', lat: 61.5, lng: 105.0 },
    { id: 'sudan', name: 'Судан', status: 'pre-war', color: '#f97316', code: 'SD', lat: 15.5, lng: 32.4 },
    { id: 'syria', name: 'Сирия', status: 'pre-war', color: '#f97316', code: 'SY', lat: 34.8, lng: 38.2 },
    { id: 'yemen', name: 'Йемен', status: 'pre-war', color: '#f97316', code: 'YE', lat: 15.9, lng: 47.6 },

    // HIGH (8)
    { id: 'afghanistan', name: 'Афганистан', status: 'high', color: '#eab308', code: 'AF', lat: 34.0, lng: 67.4 },
    { id: 'ethiopia', name: 'Эфиопия', status: 'high', color: '#eab308', code: 'ET', lat: 8.9, lng: 40.1 },
    { id: 'iran', name: 'Иран', status: 'high', color: '#eab308', code: 'IR', lat: 32.5, lng: 53.2 },
    { id: 'iraq', name: 'Ирак', status: 'high', color: '#eab308', code: 'IQ', lat: 33.0, lng: 43.2 },
    { id: 'lebanon', name: 'Ливан', status: 'high', color: '#eab308', code: 'LB', lat: 34.1, lng: 36.1 },
    { id: 'libya', name: 'Ливия', status: 'high', color: '#eab308', code: 'LY', lat: 26.6, lng: 17.6 },
    { id: 'myanmar', name: 'Мьянма', status: 'high', color: '#eab308', code: 'MM', lat: 21.7, lng: 96.3 },
    { id: 'venezuela', name: 'Венесуэла', status: 'high', color: '#eab308', code: 'VE', lat: 6.1, lng: -66.7 },

    // NORMAL (10)
    { id: 'australia', name: 'Австралия', status: 'normal', color: '#22c55e', code: 'AU', lat: -25.5, lng: 133.8 },
    { id: 'brazil', name: 'Бразилия', status: 'normal', color: '#22c55e', code: 'BR', lat: -13.8, lng: -51.9 },
    { id: 'canada', name: 'Канада', status: 'normal', color: '#22c55e', code: 'CA', lat: 55.9, lng: -106.5 },
    { id: 'denmark', name: 'Дания', status: 'normal', color: '#22c55e', code: 'DK', lat: 56.3, lng: 10.0 },
    { id: 'iceland', name: 'Исландия', status: 'normal', color: '#22c55e', code: 'IS', lat: 64.6, lng: -18.9 },
    { id: 'luxembourg', name: 'Люксембург', status: 'normal', color: '#22c55e', code: 'LU', lat: 49.4, lng: 6.6 },
    { id: 'new-zealand', name: 'Новая Зеландия', status: 'normal', color: '#22c55e', code: 'NZ', lat: -40.8, lng: 173.5 },
    { id: 'norway', name: 'Норвегия', status: 'normal', color: '#22c55e', code: 'NO', lat: 60.9, lng: 8.0 },
    { id: 'qatar', name: 'Катар', status: 'normal', color: '#22c55e', code: 'QA', lat: 25.7, lng: 51.2 },
    { id: 'south-korea', name: 'Южная Корея', status: 'normal', color: '#22c55e', code: 'KR', lat: 36.6, lng: 127.8 },

    // MEDIUM (184)
    { id: 'albania', name: 'Албания', status: 'medium', color: '#ca8a04', code: 'AL', lat: 41.7, lng: 20.5 },
    { id: 'algeria', name: 'Алжир', status: 'medium', color: '#ca8a04', code: 'DZ', lat: 27.6, lng: 3.1 },
    { id: 'andorra', name: 'Андорра', status: 'medium', color: '#ca8a04', code: 'AD', lat: 42.5, lng: 1.5 },
    { id: 'angola', name: 'Ангола', status: 'medium', color: '#ca8a04', code: 'AO', lat: -12.4, lng: 18.4 },
    { id: 'antigua-barbuda', name: 'Антигуа и Барбуда', status: 'medium', color: '#ca8a04', code: 'AG', lat: 17.1, lng: -61.8 },
    { id: 'argentina', name: 'Аргентина', status: 'medium', color: '#ca8a04', code: 'AR', lat: -38.3, lng: -63.9 },
    { id: 'armenia', name: 'Армения', status: 'medium', color: '#ca8a04', code: 'AM', lat: 39.8, lng: 44.7 },
    { id: 'austria', name: 'Австрия', status: 'medium', color: '#ca8a04', code: 'AT', lat: 47.9, lng: 13.9 },
    { id: 'azerbaijan', name: 'Азербайджан', status: 'medium', color: '#ca8a04', code: 'AZ', lat: 40.9, lng: 47.9 },
    { id: 'bahamas', name: 'Багамские Острова', status: 'medium', color: '#ca8a04', code: 'BS', lat: 24.2, lng: -76.0 },
    { id: 'bahrain', name: 'Бахрейн', status: 'medium', color: '#ca8a04', code: 'BH', lat: 26.0, lng: 50.5 },
    { id: 'bangladesh', name: 'Бангладеш', status: 'medium', color: '#ca8a04', code: 'BD', lat: 23.8, lng: 90.6 },
    { id: 'barbados', name: 'Барбадос', status: 'medium', color: '#ca8a04', code: 'BB', lat: 13.1, lng: -59.6 },
    { id: 'belarus', name: 'Беларусь', status: 'medium', color: '#ca8a04', code: 'BY', lat: 53.2, lng: 27.2 },
    { id: 'belgium', name: 'Бельгия', status: 'medium', color: '#ca8a04', code: 'BE', lat: 50.9, lng: 4.7 },
    { id: 'belize', name: 'Белиз', status: 'medium', color: '#ca8a04', code: 'BZ', lat: 17.3, lng: -88.5 },
    { id: 'benin', name: 'Бенин', status: 'medium', color: '#ca8a04', code: 'BJ', lat: 9.3, lng: 2.3 },
    { id: 'bhutan', name: 'Бутан', status: 'medium', color: '#ca8a04', code: 'BT', lat: 27.5, lng: 90.4 },
    { id: 'bolivia', name: 'Боливия', status: 'medium', color: '#ca8a04', code: 'BO', lat: -16.5, lng: -63.7 },
    { id: 'bosnia', name: 'Босния и Герцеговина', status: 'medium', color: '#ca8a04', code: 'BA', lat: 44.2, lng: 17.7 },
    { id: 'botswana', name: 'Ботсвана', status: 'medium', color: '#ca8a04', code: 'BW', lat: -22.3, lng: 24.7 },
    { id: 'brunei', name: 'Бруней', status: 'medium', color: '#ca8a04', code: 'BN', lat: 4.5, lng: 114.7 },
    { id: 'bulgaria', name: 'Болгария', status: 'medium', color: '#ca8a04', code: 'BG', lat: 42.6, lng: 25.4 },
    { id: 'burkina-faso', name: 'Буркина-Фасо', status: 'medium', color: '#ca8a04', code: 'BF', lat: 12.3, lng: -1.6 },
    { id: 'burundi', name: 'Бурунди', status: 'medium', color: '#ca8a04', code: 'BI', lat: -3.4, lng: 29.9 },
    { id: 'cabo-verde', name: 'Кабо-Верде', status: 'medium', color: '#ca8a04', code: 'CV', lat: 16.0, lng: -24.0 },
    { id: 'cambodia', name: 'Камбоджа', status: 'medium', color: '#ca8a04', code: 'KH', lat: 12.7, lng: 103.5 },
    { id: 'cameroon', name: 'Камерун', status: 'medium', color: '#ca8a04', code: 'CM', lat: 7.7, lng: 12.1 },
    { id: 'central-african-republic', name: 'ЦАР', status: 'medium', color: '#ca8a04', code: 'CF', lat: 6.6, lng: 20.9 },
    { id: 'chad', name: 'Чад', status: 'medium', color: '#ca8a04', code: 'TD', lat: 15.5, lng: 18.7 },
    { id: 'chile', name: 'Чили', status: 'medium', color: '#ca8a04', code: 'CL', lat: -35.9, lng: -71.0 },
    { id: 'china', name: 'Китай', status: 'medium', color: '#ca8a04', code: 'CN', lat: 34.9, lng: 105.2 },
    { id: 'colombia', name: 'Колумбия', status: 'medium', color: '#ca8a04', code: 'CO', lat: 4.2, lng: -73.6 },
    { id: 'comoros', name: 'Коморы', status: 'medium', color: '#ca8a04', code: 'KM', lat: -11.6, lng: 43.3 },
    { id: 'congo', name: 'Республика Конго', status: 'medium', color: '#ca8a04', code: 'CG', lat: -0.2, lng: 15.8 },
    { id: 'congo-dr', name: 'ДР Конго', status: 'medium', color: '#ca8a04', code: 'CD', lat: -4.0, lng: 21.8 },
    { id: 'costa-rica', name: 'Коста-Рика', status: 'medium', color: '#ca8a04', code: 'CR', lat: 9.7, lng: -83.7 },
    { id: 'croatia', name: 'Хорватия', status: 'medium', color: '#ca8a04', code: 'HR', lat: 44.9, lng: 15.3 },
    { id: 'cuba', name: 'Куба', status: 'medium', color: '#ca8a04', code: 'CU', lat: 22.0, lng: -80.2 },
    { id: 'cyprus', name: 'Кипр', status: 'medium', color: '#ca8a04', code: 'CY', lat: 35.5, lng: 33.1 },
    { id: 'czech', name: 'Чехия', status: 'medium', color: '#ca8a04', code: 'CZ', lat: 50.2, lng: 15.2 },
    { id: 'djibouti', name: 'Джибути', status: 'medium', color: '#ca8a04', code: 'DJ', lat: 11.6, lng: 43.1 },
    { id: 'dominica', name: 'Доминика', status: 'medium', color: '#ca8a04', code: 'DM', lat: 15.4, lng: -61.3 },
    { id: 'dominican-republic', name: 'Доминиканская Республика', status: 'medium', color: '#ca8a04', code: 'DO', lat: 18.7, lng: -70.2 },
    { id: 'east-timor', name: 'Восточный Тимор', status: 'medium', color: '#ca8a04', code: 'TL', lat: -8.9, lng: 125.7 },
    { id: 'ecuador', name: 'Эквадор', status: 'medium', color: '#ca8a04', code: 'EC', lat: -1.8, lng: -78.2 },
    { id: 'egypt', name: 'Египет', status: 'medium', color: '#ca8a04', code: 'EG', lat: 26.9, lng: 30.7 },
    { id: 'el-salvador', name: 'Сальвадор', status: 'medium', color: '#ca8a04', code: 'SV', lat: 13.7, lng: -88.9 },
    { id: 'equatorial-guinea', name: 'Экваториальная Гвинея', status: 'medium', color: '#ca8a04', code: 'GQ', lat: 1.6, lng: 10.3 },
    { id: 'eritrea', name: 'Эритрея', status: 'medium', color: '#ca8a04', code: 'ER', lat: 15.3, lng: 39.8 },
    { id: 'estonia', name: 'Эстония', status: 'medium', color: '#ca8a04', code: 'EE', lat: 58.6, lng: 25.2 },
    { id: 'eswatini', name: 'Эсватини', status: 'medium', color: '#ca8a04', code: 'SZ', lat: -26.5, lng: 31.5 },
    { id: 'fiji', name: 'Фиджи', status: 'medium', color: '#ca8a04', code: 'FJ', lat: -17.7, lng: 178.1 },
    { id: 'finland', name: 'Финляндия', status: 'medium', color: '#ca8a04', code: 'FI', lat: 63.8, lng: 25.9 },
    { id: 'france', name: 'Франция', status: 'medium', color: '#ca8a04', code: 'FR', lat: 46.5, lng: 2.3 },
    { id: 'gabon', name: 'Габон', status: 'medium', color: '#ca8a04', code: 'GA', lat: -0.8, lng: 11.6 },
    { id: 'gambia', name: 'Гамбия', status: 'medium', color: '#ca8a04', code: 'GM', lat: 13.4, lng: -15.4 },
    { id: 'georgia', name: 'Грузия', status: 'medium', color: '#ca8a04', code: 'GE', lat: 41.8, lng: 43.3 },
    { id: 'germany', name: 'Германия', status: 'medium', color: '#ca8a04', code: 'DE', lat: 50.6, lng: 10.4 },
    { id: 'ghana', name: 'Гана', status: 'medium', color: '#ca8a04', code: 'GH', lat: 7.9, lng: -1.0 },
    { id: 'greece', name: 'Греция', status: 'medium', color: '#ca8a04', code: 'GR', lat: 39.1, lng: 21.7 },
    { id: 'grenada', name: 'Гренада', status: 'medium', color: '#ca8a04', code: 'GD', lat: 12.1, lng: -61.7 },
    { id: 'guatemala', name: 'Гватемала', status: 'medium', color: '#ca8a04', code: 'GT', lat: 15.8, lng: -90.2 },
    { id: 'guinea', name: 'Гвинея', status: 'medium', color: '#ca8a04', code: 'GN', lat: 9.9, lng: -11.4 },
    { id: 'guinea-bissau', name: 'Гвинея-Бисау', status: 'medium', color: '#ca8a04', code: 'GW', lat: 11.8, lng: -15.2 },
    { id: 'guyana', name: 'Гайана', status: 'medium', color: '#ca8a04', code: 'GY', lat: 4.9, lng: -58.9 },
    { id: 'haiti', name: 'Гаити', status: 'medium', color: '#ca8a04', code: 'HT', lat: 18.9, lng: -72.3 },
    { id: 'honduras', name: 'Гондурас', status: 'medium', color: '#ca8a04', code: 'HN', lat: 15.2, lng: -86.2 },
    { id: 'hungary', name: 'Венгрия', status: 'medium', color: '#ca8a04', code: 'HU', lat: 47.0, lng: 19.2 },
    { id: 'india', name: 'Индия', status: 'medium', color: '#ca8a04', code: 'IN', lat: 20.8, lng: 78.5 },
    { id: 'indonesia', name: 'Индонезия', status: 'medium', color: '#ca8a04', code: 'ID', lat: -4.8, lng: 120.5 },
    { id: 'ireland', name: 'Ирландия', status: 'medium', color: '#ca8a04', code: 'IE', lat: 52.7, lng: -7.9 },
    { id: 'israel', name: 'Израиль', status: 'medium', color: '#ca8a04', code: 'IL', lat: 30.7, lng: 34.6 },
    { id: 'italy', name: 'Италия', status: 'medium', color: '#ca8a04', code: 'IT', lat: 42.3, lng: 12.9 },
    { id: 'ivory-coast', name: 'Кот-дИвуар', status: 'medium', color: '#ca8a04', code: 'CI', lat: 7.5, lng: -5.5 },
    { id: 'jamaica', name: 'Ямайка', status: 'medium', color: '#ca8a04', code: 'JM', lat: 18.1, lng: -77.3 },
    { id: 'japan', name: 'Япония', status: 'medium', color: '#ca8a04', code: 'JP', lat: 36.3, lng: 138.7 },
    { id: 'jordan', name: 'Иордания', status: 'medium', color: '#ca8a04', code: 'JO', lat: 31.0, lng: 36.2 },
    { id: 'kazakhstan', name: 'Казахстан', status: 'medium', color: '#ca8a04', code: 'KZ', lat: 47.5, lng: 67.6 },
    { id: 'kenya', name: 'Кения', status: 'medium', color: '#ca8a04', code: 'KE', lat: 0.2, lng: 37.9 },
    { id: 'kiribati', name: 'Кирибати', status: 'medium', color: '#ca8a04', code: 'KI', lat: -3.4, lng: -168.7 },
    { id: 'kuwait', name: 'Кувейт', status: 'medium', color: '#ca8a04', code: 'KW', lat: 29.0, lng: 47.6 },
    { id: 'kyrgyzstan', name: 'Киргизия', status: 'medium', color: '#ca8a04', code: 'KG', lat: 41.2, lng: 74.8 },
    { id: 'laos', name: 'Лаос', status: 'medium', color: '#ca8a04', code: 'LA', lat: 19.9, lng: 102.5 },
    { id: 'latvia', name: 'Латвия', status: 'medium', color: '#ca8a04', code: 'LV', lat: 56.7, lng: 24.3 },
    { id: 'lesotho', name: 'Лесото', status: 'medium', color: '#ca8a04', code: 'LS', lat: -29.6, lng: 28.2 },
    { id: 'liberia', name: 'Либерия', status: 'medium', color: '#ca8a04', code: 'LR', lat: 6.4, lng: -9.4 },
    { id: 'liechtenstein', name: 'Лихтенштейн', status: 'medium', color: '#ca8a04', code: 'LI', lat: 47.2, lng: 9.6 },
    { id: 'lithuania', name: 'Литва', status: 'medium', color: '#ca8a04', code: 'LT', lat: 55.1, lng: 23.9 },
    { id: 'macedonia', name: 'Северная Македония', status: 'medium', color: '#ca8a04', code: 'MK', lat: 41.6, lng: 21.7 },
    { id: 'madagascar', name: 'Мадагаскар', status: 'medium', color: '#ca8a04', code: 'MG', lat: -18.8, lng: 46.9 },
    { id: 'malawi', name: 'Малави', status: 'medium', color: '#ca8a04', code: 'MW', lat: -13.3, lng: 34.3 },
    { id: 'malaysia', name: 'Малайзия', status: 'medium', color: '#ca8a04', code: 'MY', lat: 4.2, lng: 101.9 },
    { id: 'maldives', name: 'Мальдивы', status: 'medium', color: '#ca8a04', code: 'MV', lat: 3.2, lng: 73.2 },
    { id: 'mali', name: 'Мали', status: 'medium', color: '#ca8a04', code: 'ML', lat: 17.6, lng: -4.0 },
    { id: 'malta', name: 'Мальта', status: 'medium', color: '#ca8a04', code: 'MT', lat: 35.9, lng: 14.4 },
    { id: 'marshall-islands', name: 'Маршалловы Острова', status: 'medium', color: '#ca8a04', code: 'MH', lat: 7.1, lng: 171.2 },
    { id: 'mauritania', name: 'Мавритания', status: 'medium', color: '#ca8a04', code: 'MR', lat: 21.0, lng: -10.9 },
    { id: 'mauritius', name: 'Маврикий', status: 'medium', color: '#ca8a04', code: 'MU', lat: -20.3, lng: 57.6 },
    { id: 'mexico', name: 'Мексика', status: 'medium', color: '#ca8a04', code: 'MX', lat: 23.4, lng: -102.3 },
    { id: 'micronesia', name: 'Микронезия', status: 'medium', color: '#ca8a04', code: 'FM', lat: 7.4, lng: 150.6 },
    { id: 'moldova', name: 'Молдова', status: 'medium', color: '#ca8a04', code: 'MD', lat: 47.3, lng: 28.1 },
    { id: 'monaco', name: 'Монако', status: 'medium', color: '#ca8a04', code: 'MC', lat: 43.7, lng: 7.4 },
    { id: 'mongolia', name: 'Монголия', status: 'medium', color: '#ca8a04', code: 'MN', lat: 45.7, lng: 105.3 },
    { id: 'montenegro', name: 'Черногория', status: 'medium', color: '#ca8a04', code: 'ME', lat: 43.0, lng: 18.9 },
    { id: 'morocco', name: 'Марокко', status: 'medium', color: '#ca8a04', code: 'MA', lat: 31.7, lng: -6.7 },
    { id: 'mozambique', name: 'Мозамбик', status: 'medium', color: '#ca8a04', code: 'MZ', lat: -18.7, lng: 35.5 },
    { id: 'namibia', name: 'Намибия', status: 'medium', color: '#ca8a04', code: 'NA', lat: -22.9, lng: 18.5 },
    { id: 'nauru', name: 'Науру', status: 'medium', color: '#ca8a04', code: 'NR', lat: -0.5, lng: 166.9 },
    { id: 'nepal', name: 'Непал', status: 'medium', color: '#ca8a04', code: 'NP', lat: 28.4, lng: 84.1 },
    { id: 'netherlands', name: 'Нидерланды', status: 'medium', color: '#ca8a04', code: 'NL', lat: 52.7, lng: 5.5 },
    { id: 'nicaragua', name: 'Никарагуа', status: 'medium', color: '#ca8a04', code: 'NI', lat: 12.9, lng: -85.2 },
    { id: 'niger', name: 'Нигер', status: 'medium', color: '#ca8a04', code: 'NE', lat: 17.6, lng: 8.1 },
    { id: 'nigeria', name: 'Нигерия', status: 'medium', color: '#ca8a04', code: 'NG', lat: 9.3, lng: 7.9 },
    { id: 'oman', name: 'Оман', status: 'medium', color: '#ca8a04', code: 'OM', lat: 20.6, lng: 56.7 },
    { id: 'pakistan', name: 'Пакистан', status: 'medium', color: '#ca8a04', code: 'PK', lat: 30.3, lng: 70.5 },
    { id: 'palau', name: 'Палау', status: 'medium', color: '#ca8a04', code: 'PW', lat: 7.5, lng: 134.6 },
    { id: 'palestine', name: 'Палестина', status: 'medium', color: '#ca8a04', code: 'PS', lat: 31.9, lng: 35.2 },
    { id: 'panama', name: 'Панама', status: 'medium', color: '#ca8a04', code: 'PA', lat: 8.5, lng: -80.8 },
    { id: 'papua-new-guinea', name: 'Папуа-Новая Гвинея', status: 'medium', color: '#ca8a04', code: 'PG', lat: -6.3, lng: 143.9 },
    { id: 'paraguay', name: 'Парагвай', status: 'medium', color: '#ca8a04', code: 'PY', lat: -23.4, lng: -58.4 },
    { id: 'peru', name: 'Перу', status: 'medium', color: '#ca8a04', code: 'PE', lat: -9.2, lng: -75.0 },
    { id: 'philippines', name: 'Филиппины', status: 'medium', color: '#ca8a04', code: 'PH', lat: 12.9, lng: 121.8 },
    { id: 'poland', name: 'Польша', status: 'medium', color: '#ca8a04', code: 'PL', lat: 52.4, lng: 18.7 },
    { id: 'portugal', name: 'Португалия', status: 'medium', color: '#ca8a04', code: 'PT', lat: 39.6, lng: -8.0 },
    { id: 'romania', name: 'Румыния', status: 'medium', color: '#ca8a04', code: 'RO', lat: 45.5, lng: 25.0 },
    { id: 'rwanda', name: 'Руанда', status: 'medium', color: '#ca8a04', code: 'RW', lat: -2.0, lng: 29.9 },
    { id: 'saint-kitts', name: 'Сент-Китс и Невис', status: 'medium', color: '#ca8a04', code: 'KN', lat: 17.3, lng: -62.7 },
    { id: 'saint-lucia', name: 'Сент-Люсия', status: 'medium', color: '#ca8a04', code: 'LC', lat: 13.9, lng: -61.0 },
    { id: 'saint-vincent', name: 'Сент-Винсент и Гренадины', status: 'medium', color: '#ca8a04', code: 'VC', lat: 13.2, lng: -61.2 },
    { id: 'samoa', name: 'Самоа', status: 'medium', color: '#ca8a04', code: 'WS', lat: -13.8, lng: -172.1 },
    { id: 'san-marino', name: 'Сан-Марино', status: 'medium', color: '#ca8a04', code: 'SM', lat: 43.9, lng: 12.5 },
    { id: 'sao-tome', name: 'Сан-Томе и Принсипи', status: 'medium', color: '#ca8a04', code: 'ST', lat: 0.3, lng: 6.7 },
    { id: 'saudi-arabia', name: 'Саудовская Аравия', status: 'medium', color: '#ca8a04', code: 'SA', lat: 23.9, lng: 45.1 },
    { id: 'senegal', name: 'Сенегал', status: 'medium', color: '#ca8a04', code: 'SN', lat: 14.5, lng: -14.5 },
    { id: 'serbia', name: 'Сербия', status: 'medium', color: '#ca8a04', code: 'RS', lat: 44.2, lng: 20.5 },
    { id: 'seychelles', name: 'Сейшелы', status: 'medium', color: '#ca8a04', code: 'SC', lat: -4.7, lng: 55.5 },
    { id: 'sierra-leone', name: 'Сьерра-Леоне', status: 'medium', color: '#ca8a04', code: 'SL', lat: 8.5, lng: -11.8 },
    { id: 'singapore', name: 'Сингапур', status: 'medium', color: '#ca8a04', code: 'SG', lat: 1.4, lng: 103.8 },
    { id: 'slovakia', name: 'Словакия', status: 'medium', color: '#ca8a04', code: 'SK', lat: 48.3, lng: 19.3 },
    { id: 'slovenia', name: 'Словения', status: 'medium', color: '#ca8a04', code: 'SI', lat: 46.1, lng: 14.4 },
    { id: 'solomon-islands', name: 'Соломоновы Острова', status: 'medium', color: '#ca8a04', code: 'SB', lat: -9.6, lng: 160.2 },
    { id: 'somalia', name: 'Сомали', status: 'medium', color: '#ca8a04', code: 'SO', lat: 5.2, lng: 46.2 },
    { id: 'south-africa', name: 'ЮАР', status: 'medium', color: '#ca8a04', code: 'ZA', lat: -30.6, lng: 22.9 },
    { id: 'south-sudan', name: 'Южный Судан', status: 'medium', color: '#ca8a04', code: 'SS', lat: 6.9, lng: 31.3 },
    { id: 'spain', name: 'Испания', status: 'medium', color: '#ca8a04', code: 'ES', lat: 40.7, lng: -3.2 },
    { id: 'sri-lanka', name: 'Шри-Ланка', status: 'medium', color: '#ca8a04', code: 'LK', lat: 7.9, lng: 80.8 },
    { id: 'suriname', name: 'Суринам', status: 'medium', color: '#ca8a04', code: 'SR', lat: 3.9, lng: -56.0 },
    { id: 'sweden', name: 'Швеция', status: 'medium', color: '#ca8a04', code: 'SE', lat: 60.1, lng: 15.1 },
    { id: 'switzerland', name: 'Швейцария', status: 'medium', color: '#ca8a04', code: 'CH', lat: 46.8, lng: 8.5 },
    { id: 'taiwan', name: 'Тайвань', status: 'medium', color: '#ca8a04', code: 'TW', lat: 23.6, lng: 120.7 },
    { id: 'tajikistan', name: 'Таджикистан', status: 'medium', color: '#ca8a04', code: 'TJ', lat: 38.9, lng: 71.3 },
    { id: 'tanzania', name: 'Танзания', status: 'medium', color: '#ca8a04', code: 'TZ', lat: -6.4, lng: 34.9 },
    { id: 'thailand', name: 'Таиланд', status: 'medium', color: '#ca8a04', code: 'TH', lat: 15.1, lng: 101.3 },
    { id: 'togo', name: 'Того', status: 'medium', color: '#ca8a04', code: 'TG', lat: 8.6, lng: 0.8 },
    { id: 'tonga', name: 'Тонга', status: 'medium', color: '#ca8a04', code: 'TO', lat: -21.2, lng: -175.2 },
    { id: 'trinidad-tobago', name: 'Тринидад и Тобаго', status: 'medium', color: '#ca8a04', code: 'TT', lat: 10.7, lng: -61.2 },
    { id: 'tunisia', name: 'Тунис', status: 'medium', color: '#ca8a04', code: 'TN', lat: 33.9, lng: 9.6 },
    { id: 'turkey', name: 'Турция', status: 'medium', color: '#ca8a04', code: 'TR', lat: 38.6, lng: 34.8 },
    { id: 'turkmenistan', name: 'Туркменистан', status: 'medium', color: '#ca8a04', code: 'TM', lat: 38.9, lng: 59.6 },
    { id: 'tuvalu', name: 'Тувалу', status: 'medium', color: '#ca8a04', code: 'TV', lat: -7.1, lng: 177.6 },
    { id: 'uae', name: 'ОАЭ', status: 'medium', color: '#ca8a04', code: 'AE', lat: 23.2, lng: 53.9 },
    { id: 'uganda', name: 'Уганда', status: 'medium', color: '#ca8a04', code: 'UG', lat: 1.4, lng: 32.3 },
    { id: 'uk', name: 'Великобритания', status: 'medium', color: '#ca8a04', code: 'GB', lat: 55.3, lng: -3.2 },
    { id: 'uruguay', name: 'Уругвай', status: 'medium', color: '#ca8a04', code: 'UY', lat: -32.5, lng: -55.8 },
    { id: 'usa', name: 'США', status: 'medium', color: '#ca8a04', code: 'US', lat: 39.7, lng: -98.8 },
    { id: 'uzbekistan', name: 'Узбекистан', status: 'medium', color: '#ca8a04', code: 'UZ', lat: 41.4, lng: 64.6 },
    { id: 'vanuatu', name: 'Вануату', status: 'medium', color: '#ca8a04', code: 'VU', lat: -15.4, lng: 166.9 },
    { id: 'vatican', name: 'Ватикан', status: 'medium', color: '#ca8a04', code: 'VA', lat: 41.9, lng: 12.5 },
    { id: 'vietnam', name: 'Вьетнам', status: 'medium', color: '#ca8a04', code: 'VN', lat: 16.3, lng: 106.1 },
    { id: 'zambia', name: 'Замбия', status: 'medium', color: '#ca8a04', code: 'ZM', lat: -13.1, lng: 27.8 },
    { id: 'zimbabwe', name: 'Зимбабве', status: 'medium', color: '#ca8a04', code: 'ZW', lat: -19.0, lng: 29.2 },

    // TERRITORIES (12)
    { id: 'antarctica', name: 'Антарктида', status: 'medium', color: '#ca8a04', code: 'AQ', lat: -75.3, lng: 0.0 },
    { id: 'england', name: 'Англия', status: 'medium', color: '#ca8a04', code: 'GB-ENG', lat: 52.4, lng: -1.5 },
    { id: 'falkland-islands', name: 'Фолклендские острова', status: 'medium', color: '#ca8a04', code: 'FK', lat: -51.8, lng: -59.0 },
    { id: 'french-southern-territories', name: 'Французские Южные территории', status: 'medium', color: '#ca8a04', code: 'TF', lat: -49.3, lng: 69.3 },
    { id: 'greenland', name: 'Гренландия', status: 'medium', color: '#ca8a04', code: 'GL', lat: 71.7, lng: -42.6 },
    { id: 'kosovo', name: 'Косово', status: 'medium', color: '#ca8a04', code: 'XK', lat: 42.6, lng: 20.9 },
    { id: 'new-caledonia', name: 'Новая Каледония', status: 'medium', color: '#ca8a04', code: 'NC', lat: -20.9, lng: 165.6 },
    { id: 'northern-cyprus', name: 'Северный Кипр', status: 'medium', color: '#ca8a04', code: 'CY-N', lat: 35.2, lng: 33.3 },
    { id: 'puerto-rico', name: 'Пуэрто-Рико', status: 'medium', color: '#ca8a04', code: 'PR', lat: 18.2, lng: -66.5 },
    { id: 'somaliland', name: 'Сомалиленд', status: 'medium', color: '#ca8a04', code: 'SO-SL', lat: 9.5, lng: 46.9 },
    { id: 'west-bank', name: 'Западный берег', status: 'medium', color: '#ca8a04', code: 'PS-WB', lat: 32.0, lng: 35.3 },
    { id: 'western-sahara', name: 'Западная Сахара', status: 'medium', color: '#ca8a04', code: 'EH', lat: 24.2, lng: -12.9 }
];

// === ИНДЕКСЫ ДЛЯ БЫСТРОГО ПОИСКА ===
window.countryData = {};
window.countryByCode = {};

window.ALL_COUNTRIES.forEach(function(c) {
    window.countryData[c.id] = c;
    if (c.code) window.countryByCode[c.code] = c;
});

console.log('Загружено стран:', window.ALL_COUNTRIES.length);

// === СТАТИСТИКА ПО СТАТУСАМ ===
(function () {
    var stats = { critical: 0, 'pre-war': 0, high: 0, medium: 0, normal: 0 };
    for (var i = 0; i < window.ALL_COUNTRIES.length; i++) {
        var s = window.ALL_COUNTRIES[i].status;
        if (stats[s] !== undefined) stats[s]++;
    }
    console.log('  critical:', stats.critical);
    console.log('  pre-war: ', stats['pre-war']);
    console.log('  high:    ', stats.high);
    console.log('  medium:  ', stats.medium);
    console.log('  normal:  ', stats.normal);
})();
