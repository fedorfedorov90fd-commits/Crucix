# Mutation Testing для Crucix

Mutation testing проверяет **качество самих тестов**, внося мутации в код и
проверяя, что тесты их ловят.

## Запуск

~~~bash
# Один модуль
node tests/mutation/meta_learner.mutate.mjs

# Все модули
node tests/mutation/run_all.mjs

# В CI (nightly)
# Автоматически в .github/workflows/nightly-property.yml
~~~
## Что такое mutation score

~~~
score = killed_mutations / total_mutations
~~~
Score = 1.0 — идеально: все мутации пойманы.

Score > 0.7 — хорошо: тесты качественные.

Score < 0.5 — плохо: тесты слабые.

## Типы мутаций

Arithmetic: `\+` \-> `\-`, `\*` \-> `/`

Comparison: `<` \-> `>`, `==` \-> `!=`

Constant: `0.5` \-> `0.6`

Statement: удаление строки

Boundary: `>` \-> `>=`

Negation: `if (x)` \-> `if (\!x)`

## Наши мутации

### MetaLearner

Номер | Мутация | Что проверяет 1 | Убрать softmax нормализацию | Тест на сумму
весов = 1 2 | Убрать ReLU | Тест на отсутствие NaN 3 | Убрать bias correction в
Adam | Тест на сходимость 4 | Убрать clamp в _classifyRegime | Тест на
чувствительность к весам 5 | Заменить weighted sum на простую сумму | Тест на
разные веса для разных режимов 6 | Убрать проверку isNaN | Тест на
экстремальные inputs

### TemporalLagNetwork

Номер | Мутация | Что проверяет 1 | Заменить z-score на абсолютный diff | Тест
на детекцию сдвига 2 | Убрать сортировку timeline | Тест на порядок событий 3 |
Игнорировать maxLagMs | Тест на границу

## Как улучшать score

Если мутация survived:

1.  Понять, почему тесты не поймали. Мутация изменила поведение? Если да —
    нужен новый тест.
2.  Написать целевой тест. Не общий, а конкретно на этот случай.
3.  Убедиться, что тест ловит мутацию. Запустить mutation test снова.

Пример:

~~~javascript
// Мутация: убрать bias correction в Adam
// Тест:
it('обучение сходится за 100 шагов', () => {
  const ml = new MetaLearner({ inputDim: 4, hiddenDim: 16, outputDim: 3 });
  const features = [0.5, 0.5, 0.5, 0.5];
  const preds = [0.3, 0.5, 0.7];
  const target = 0.6;

  const initialLoss = ml.trainStep(features, preds, target).loss;
  for (let i = 0; i < 100; i++) ml.trainStep(features, preds, target);
  const finalLoss = ml.trainStep(features, preds, target).loss;

  assert.ok(finalLoss < initialLoss * 0.5, 'Training did not converge');
});
~~~
Этот тест гарантированно ловит мутацию — без bias correction loss растёт.

## CI интеграция

Push: пропускаем (слишком медленно).

Nightly: запускаем run_all.mjs.

Release: обязательная проверка — score >= 0.7.

## Что дальше

Расширить mutation testing на narrative_warfare.mjs.

Использовать библиотеку Stryker (если разрешат зависимости).

Прогонять mutation testing на каждой PR (если найдём быстрый способ).

