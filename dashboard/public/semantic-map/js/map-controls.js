console.log('MAP-CONTROLS.JS загружен');
var currentGeoJsonLayer = null;
var currentChoroplethData = null;
var boundariesLoaded = false;

var EN_TO_RU = {
    'Afghanistan':'Афганистан','Angola':'Ангола','Albania':'Албания',
    'United Arab Emirates':'ОАЭ','Argentina':'Аргентина','Armenia':'Армения',
    'Antarctica':'Антарктида','French Southern and Antarctic Lands':'Французские Южные территории',
    'Australia':'Австралия','Austria':'Австрия','Azerbaijan':'Азербайджан',
    'Burundi':'Бурунди','Belgium':'Бельгия','Benin':'Бенин',
    'Burkina Faso':'Буркина-Фасо','Bangladesh':'Бангладеш','Bulgaria':'Болгария',
    'Bahamas':'Багамы','Bosnia and Herz.':'Босния','Bosnia and Herzegovina':'Босния',
    'Belarus':'Беларусь','Belize':'Белиз','Bolivia':'Боливия',
    'Brazil':'Бразилия','Brunei':'Бруней','Bhutan':'Бутан',
    'Botswana':'Ботсвана','Central African Rep.':'ЦАР','Central African Republic':'ЦАР',
    'Canada':'Канада','Switzerland':'Швейцария','Chile':'Чили',
    'China':'Китай','Cote d\'Ivoire':'Кот-д\'Ивуар','Ivory Coast':'Кот-д\'Ивуар',
    'Cameroon':'Камерун','Dem. Rep. Congo':'ДР Конго','Democratic Republic of the Congo':'ДР Конго',
    'Congo':'Республика Конго','Colombia':'Колумрия','Costa Rica':'Коста-Рика',
    'Cuba':'Куба','Cyprus':'Кипр','Czech Rep.':'Чехия','Czech Republic':'Чехия',
    'Germany':'Германия','Djibouti':'Джибути','Denmark':'Дания',
    'Dominican Rep.':'Доминиканская Республика','Dominican Republic':'Доминиканская Республика',
    'Algeria':'Алжир','Ecuador':'Эквадор','Egypt':'Египет',
    'Eritrea':'Эритрея','Spain':'Испания','Estonia':'Эстония',
    'Ethiopia':'Эфиопия','Finland':'Финляндия','Fiji':'Фиджи',
    'Falkland Is.':'Фолклендские о-ва','Falkland Islands':'Фолклендские о-ва',
    'France':'Франция','Gabon':'Габон','United Kingdom':'Великобритания',
    'Georgia':'Грузия','Ghana':'Гана','Guinea':'Гвинея',
    'Gambia':'Гамбия','Guinea-Bissau':'Гвинея-Бисау','Eq. Guinea':'Экваториальная Гвинея',
    'Equatorial Guinea':'Экваториальная Гвинея','Greece':'Греция','Greenland':'Гренландия',
    'Guatemala':'Гватемала','Guyana':'Гайана','Honduras':'Гондурас',
    'Croatia':'Хорватия','Haiti':'Гаити','Hungary':'Венгрия',
    'Indonesia':'Индонезия','India':'Индия','Ireland':'Ирландия',
    'Iran':'Иран','Iraq':'Ирак','Iceland':'Исландия',
    'Israel':'Израиль','Italy':'Италия','Jamaica':'Ямайка',
    'Jordan':'Иордания','Japan':'Япония','Kazakhstan':'Казахстан',
    'Kenya':'Кения','Kyrgyzstan':'Кыргызстан','Cambodia':'Камбоджа',
    'South Korea':'Южная Корея','Korea':'Южная Корея','North Korea':'КНДР',
    'Kosovo':'Косово','Kuwait':'Кувейт','Laos':'Лаос',
    'Lebanon':'Ливан','Liberia':'Либерия','Libya':'Ливия',
    'Sri Lanka':'Шри-Ланка','Lesotho':'Лесото','Lithuania':'Литва',
    'Luxembourg':'Люксембург','Latvia':'Латвия','Moldova':'Молдова',
    'Madagascar':'Мадагаскар','Mexico':'Мексика','Macedonia':'Северная Македония',
    'Mali':'Мали','Myanmar':'Мьянма','Montenegro':'Черногория',
    'Mongolia':'Монголия','Mozambique':'Мозамбик','Mauritania':'Мавритания',
    'Malawi':'Малави','Malaysia':'Малайзия','Namibia':'Намибия',
    'New Caledonia':'Новая Каледония','Niger':'Нигер','Nigeria':'Нигерия',
    'Nicaragua':'Никарагуа','Netherlands':'Нидерланды','Norway':'Норвегия',
    'Nepal':'Непал','New Zealand':'Новая Зеландия','Oman':'Оман',
    'Pakistan':'Пакистан','Panama':'Панама','Peru':'Перу',
    'Philippines':'Филиппины','Papua New Guinea':'Папуа-Новая Гвинея',
    'Poland':'Польша','Puerto Rico':'Пуэрто-Рико','Portugal':'Португалия',
    'Paraguay':'Парагвай','Palestine':'Палестина','Qatar':'Катар',
    'Romania':'Румыния','Russia':'Россия','Rwanda':'Руанда',
    'Western Sahara':'Западная Сахара','Saudi Arabia':'Саудовская Аравия',
    'Sudan':'Судан','S. Sudan':'Южный Судан','South Sudan':'Южный Судан',
    'Senegal':'Сенегал','Solomon Is.':'Соломоновы Острова','Solomon Islands':'Соломоновы Острова',
    'Sierra Leone':'Сьерра-Леоне','El Salvador':'Сальвадор','Somalia':'Сомали',
    'Serbia':'Сербия','Suriname':'Суринам','Slovakia':'Словакия',
    'Slovenia':'Словения','Sweden':'Швеция','Swaziland':'Эсватини',
    'eSwatini':'Эсватини','Syria':'Сирия','Chad':'Чад',
    'Togo':'Того','Thailand':'Таиланд','Tajikistan':'Таджикистан',
    'Turkmenistan':'Туркмения','Timor-Leste':'Восточный Тимор','East Timor':'Восточный Тимор',
    'Trinidad and Tobago':'Тринидад и Тобаго','Tunisia':'Тунис','Turkey':'Турция',
    'Taiwan':'Тайвань','Tanzania':'Танзания','Uganda':'Уганда',
    'Ukraine':'Украина','Uruguay':'Уругвай','United States':'США',
    'United States of America':'США','Uzbekistan':'Узбекистан',
    'Venezuela':'Венесуэла','Vietnam':'Вьетнам','Vanuatu':'Вануату',
    'West Bank':'Западный берег','Yemen':'Йемен','South Africa':'ЮАР',
    'Zambia':'Замбия','Zimbabwe':'Зимбабве',
    'Somaliland':'Сомалиленд','Mo. Rep.':'Македония','Dem. Rep. Korea':'КНДР',
    'Rep. Korea':'Южная Корея','Dem. Rep. Congo':'ДР Конго',
    'W. Sahara':'Западная Сахара','Falkland Is.':'Фолклендские о-ва',
    'Fr. S. Antarctic Lands':'Французские Южные территории',
    'Eq. Guinea':'Экваториальная Гвинея','Czechia':'Чехия',
    'Dominican Rep.':'Доминиканская Республика','S. Sudan':'Южный Судан',
    'Solomon Is.':'Соломоновы Острова','Central African Rep.':'ЦАР',
    'Dem. Rep. Korea':'КНДР','Bosnia and Herz.':'Босния',
    'N. Cyprus':'Северный Кипр','Northern Cyprus':'Северный Кипр'
};

function translateCountryName(enName) {
    if (!enName) return '';
    if (EN_TO_RU[enName]) return EN_TO_RU[enName];
    if (EN_TO_RU[enName.trim()]) return EN_TO_RU[enName.trim()];
    return enName;
}

async function loadCountryBoundaries() {
    if (boundariesLoaded) { return; }
    try {
        var response = await fetch('data/world.geojson');
        if (!response.ok) { return; }
        var data = await response.json();
        if (!window.leafletMap) return;
        currentGeoJsonLayer = L.geoJson(data, {
            style: {
                fillColor: '#1a2a3a', weight: 0.5, opacity: 0.8,
                color: '#3a5a7a', fillOpacity: 0.3
            },
            onEachFeature: function(feature, layer) {
                var enName = (feature.properties && feature.properties.name) || '';
                var ruName = translateCountryName(enName);
                if (ruName) layer.bindPopup('<b>' + ruName + '</b>');
                layer.on('mouseover', function(e) {
                    e.target.setStyle({ fillOpacity: 0.5, weight: 1.5, color: '#5bc0f8' });
                });
                layer.on('mouseout', function(e) {
                    e.target.setStyle({ fillOpacity: 0.3, weight: 0.5, color: '#3a5a7a' });
                });
            }
        }).addTo(window.leafletMap);
        boundariesLoaded = true;
        var count = data.features ? data.features.length : 0;
        console.log('Границы загружены: ' + count + ' стран, RU-перевод: ' + Object.keys(EN_TO_RU).length);
    } catch (err) {
        console.warn('Ошибка загрузки границ:', err);
    }
}

function getChoroplethColor(value) {
    if (value > 0.7) return '#ef4444';
    if (value > 0.4) return '#f59e0b';
    if (value > 0.2) return '#22c55e';
    return '#1a2a3a';
}

function applyChoropleth(data) {
    if (!currentGeoJsonLayer || !data) return;
    currentGeoJsonLayer.eachLayer(function(layer) {
        var name = (layer.feature && layer.feature.properties && layer.feature.properties.name || '').toLowerCase();
        var value = data[name];
        if (value !== undefined) layer.setStyle({ fillColor: getChoroplethColor(value), fillOpacity: 0.7 });
    });
}

function resetChoropleth() {
    if (currentGeoJsonLayer) {
        currentGeoJsonLayer.eachLayer(function(layer) {
            layer.setStyle({ fillColor: '#1a2a3a', fillOpacity: 0.3 });
        });
    }
}

window.loadCountryBoundaries = loadCountryBoundaries;
window.applyChoropleth = applyChoropleth;
window.resetChoropleth = resetChoropleth;
window.translateCountryName = translateCountryName;
console.log('MAP-CONTROLS.JS готов (RU: ' + Object.keys(EN_TO_RU).length + ' переводов)');
