# Публикация Nano Lightbox

Схема соответствует Tvist: GitHub Release запускает `.github/workflows/publish.yml`, проверяет версию, выполняет проверки и создаёт npm-архив. Из проверенного архива извлекаются браузерные файлы для вложений релиза. Именно этот архив публикуется в npm, откуда его раздаёт jsDelivr.

## Браузерная поставка для InSales

`npm run build` собирает ESM в `dist` и самостоятельную поставку в `browser-build`:

- `nano-lightbox.min.js` — обычный script, глобальный API `window.NanoLightbox`, баннер версии и лицензии.
- `nano-lightbox.css` — единый CSS модалок, галереи и миниатюр, без внешних импортов.
- `nano-lightbox.min.js.gz` — gzip-копия того же JS для скачивания или раздачи сервером с `Content-Encoding: gzip`. В `<script src>` указывается `.js`.

Отдельно можно выполнить `npm run build:browser`. Бюджеты с баннером: JS до 10 КБ gzip, CSS до 2 КБ gzip. `dist/nano-lightbox.js` сохранён для совместимости существующих подключений.

После успешной публикации версии `0.1.1`:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/nano-lightbox@0.1.1/browser-build/nano-lightbox.css">
<script defer src="https://cdn.jsdelivr.net/npm/nano-lightbox@0.1.1/browser-build/nano-lightbox.min.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function () {
  // Здесь библиотека загружена; initializer виджетов получает NanoLightbox.
});
</script>
```

В InSales JS-файл регистрируется как библиотека платформы и добавляется в зависимости виджета; имя записи назначается при регистрации. Эта настройка репозитория сама по себе не регистрирует библиотеку в InSales. Используйте одну точную версию для JS и CSS. При подключении через платформу запускайте snippet после загрузки зависимости.

## Однократная настройка сервисов

Для этого репозитория первая версия `0.1.0` опубликована в npm, Trusted Publisher настроен на `VladimirIvanin/nano-lightbox`, workflow `publish.yml`, с правом публикации; GitHub Pages использует GitHub Actions. Ниже порядок первоначальной настройки для воспроизведения или переноса:

1. Выполнить `npm ci`, `npm run check`, `npm run test:package`. Последняя команда выводит путь к проверенному `.tgz`.
2. Выполнить `npm login`, затем `npm publish <путь-к-проверенному-tgz> --access public`. Этот шаг выполняется один раз для первоначального создания пакета.
3. В npm → пакет `nano-lightbox` → Settings → Trusted publishing добавить GitHub Actions: user **VladimirIvanin**, repository **nano-lightbox**, workflow **publish.yml**, environment оставить пустым. Разрешить прямой `npm publish`. Workflow использует OIDC, секрет `NPM_TOKEN` не требуется. Требования и актуальные правила настройки: [npm Trusted publishing](https://docs.npmjs.com/trusted-publishers/).
4. В GitHub → Settings → Pages выбрать source **GitHub Actions**. Документация будет разворачиваться на `https://vladimirivanin.github.io/nano-lightbox/` из `main`, при GitHub Release или ручном запуске workflow `deploy-docs.yml`.

Если первая версия уже опубликована вручную, создание релиза с той же версией прикрепит файлы, но npm job получит ошибку повторной публикации: npm не допускает замену существующей версии. Для первой автоматической публикации подготовьте следующую версию. Точные сведения о доверенном издателе и настройках Pages задаются в аккаунтах сервисов, а не в git-файлах.

## Последующие версии

1. Обновить `package.json` и `package-lock.json` через `npm version patch --no-git-tag-version` (либо `minor`, `major`, `prerelease`). Закоммитить и отправить изменения.
2. Создать GitHub Release с тегом строго `v<package.json.version>` на нужном коммите, например `v0.1.1`. У prerelease-версии вроде `0.2.0-beta.1` включить GitHub pre-release.
3. Дождаться успешного `Publish to npm`. Обычный релиз публикуется с npm-тегом `latest`, GitHub pre-release — `next`. Release assets и npm используют один и тот же проверенный архив; эти jobs выполняются независимо, поэтому проверяйте оба результата.

Повторная публикация существующей npm-версии завершится ошибкой; уже опубликованный архив не заменяется. CDN-ссылки конкретной версии становятся рабочими после успешной публикации в npm. Создание тега само по себе не запускает публикацию — нужен опубликованный GitHub Release.

## Локальные проверки

```sh
npm run check
npm run test:package
npm run test:docs
```

`test:package` устанавливает настоящий `.tgz` в отдельный локальный consumer без сети, проверяет ESM imports/exports, побайтовое совпадение браузерных файлов с архивом, gzip и самодостаточность script/CSS. В CI архив сохраняется в `RUNNER_TEMP` и передаётся неизменённым в jobs публикации и вложений релиза.

`docs:build` собирает статический сайт в игнорируемый `site-dist`, сохраняя относительные пути для размещения в подкаталоге GitHub Pages. `test:docs` проверяет загрузку сайта и InSales-примера именно из подкаталога.
