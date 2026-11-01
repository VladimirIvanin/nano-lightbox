# Nano Lightbox

Нативные модалки, выезжающее меню и смешанные медиагалереи без runtime-зависимостей. Нужен браузер с `HTMLDialogElement.showModal()`. Проверки запускаются в Chromium, Firefox и WebKit. Safari/iOS 15.5+, Chrome 100+ и Firefox 100+ являются целевым нижним уровнем совместимости, который ещё требует отдельного прогона на старых версиях. Там, где отсутствуют современные CSS-переходы, открытие и закрытие происходят без анимации.

Модалки, меню и лента слайдов используют `overscroll-behavior: contain` для ограничения передачи прокрутки за границы контейнера. Внутри слайда применяется только `overscroll-behavior-y: contain`, чтобы горизонтальные жесты доходили до Scroll Snap ленты. Для миниатюр применяется `overscroll-behavior-x: contain`. Значение `contain` сохраняет возможность упругого отскока. Свойство действует на scroll-контейнеры, CSS снаружи стороннего iframe не управляет прокруткой его документа. [Описание на MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overscroll-behavior)

Поддержка `contain` начинается с Chrome 63, Firefox 59 и Safari/iOS 16. В Safari и старых Chromium/Firefox есть ограничения для контейнеров без прокручиваемого переполнения. В Safari 15.5 свойство игнорируется. Блокировка фоновой страницы обеспечивается ядром через фиксацию `body`, скрытие переполнения корневого элемента и восстановление позиции при закрытии. [Данные совместимости MDN](https://github.com/mdn/browser-compat-data/blob/main/css/properties/overscroll-behavior.json)

## Запуск примеров

```sh
npm install
npm run build
npm run dev
```

Документация с живыми примерами доступна на `http://127.0.0.1:4173/`. Отдельные примеры — `/examples/modal.html`, `/examples/menu.html` и `/examples/gallery.html`.

## Подключение в HTML

Для InSales доступна самостоятельная поставка в `browser-build`: `nano-lightbox.min.js`, единый `nano-lightbox.css` и gzip-копия JS. Файлы входят в npm-пакет и прикрепляются к GitHub Release, как у Tvist. После публикации версии доступны через jsDelivr:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/nano-lightbox@0.1.0/browser-build/nano-lightbox.css">
<script defer src="https://cdn.jsdelivr.net/npm/nano-lightbox@0.1.0/browser-build/nano-lightbox.min.js"></script>
```

Используйте API `window.NanoLightbox` после загрузки script. При `defer` запускайте initializer в `DOMContentLoaded`; JS и CSS должны иметь одну версию. ESM устанавливается через `npm install nano-lightbox`. [Порядок выпуска версии и однократная настройка npm/GitHub Pages](docs/releasing.md).

Скопируйте каталог `dist` целиком, сохраняя соседство файлов. Модули используют относительные импорты. Сервер должен отдавать JavaScript с соответствующим MIME-типом.

```html
<link rel="stylesheet" href="/nano/core.css">
<script type="module" src="/nano/auto.js"></script>

<button data-nl-open="contact">Обратная связь</button>
<dialog id="contact" data-nl-modal aria-labelledby="contact-title">
  <h2 id="contact-title">Напишите нам</h2>
  <form method="dialog">
    <label>Имя <input name="name" autofocus required></label>
    <button value="send">Отправить</button>
  </form>
  <button type="button" data-nl-close>Закрыть</button>
</dialog>
```

`auto.js` устанавливает делегированный обработчик. Добавленные позднее кнопки и ссылки также работают. Для одной формы или меню загружаются только `auto.js`, общий модуль ядра и `core.css`. Галерея импортируется по первому клику. Миниатюры импортируются при первом открытии группы с `data-nl-thumbs`.

`data-nl-modal` включает базовые стили модалки. Автор может использовать собственный CSS без этого атрибута. `closedby` по умолчанию получает значение `any`. Укажите `closerequest`, чтобы сохранить закрытие по Esc и отключить закрытие по фону, или `none`, чтобы закрывать только кнопкой или программно. Не добавляйте `tabindex` самому `<dialog>`. Используйте `autofocus` на подходящем внутреннем элементе и задавайте имя через `aria-labelledby` или `aria-label`.

Поддержка `closedby` проверяется отдельно через `'closedBy' in dialog`. При отсутствии свойства ядро обрабатывает нажатия на фон и событие `cancel` самостоятельно. Нажатие и отпускание должны принадлежать одному указателю и происходить на фоне. Перетаскивание из содержимого не закрывает окно. Закрытие по фону посылает отменяемое событие `cancel`, поэтому обработчик сайта может вызвать `preventDefault()`. Значения атрибута регистронезависимы и читаются при каждом действии. Браузерные тесты fallback отключают отражение свойства и скрывают сам атрибут от нативного движка.

Нативное `form method="dialog"` закрывает форму и записывает значение кнопки в `dialog.returnValue`. Для отправки данных на сервер используйте обычную форму со своим обработчиком.

## Меню

```html
<button data-nl-open="navigation" aria-controls="navigation">Меню</button>
<dialog id="navigation" data-nl-drawer="start" aria-label="Навигация">
  <button data-nl-close autofocus>Закрыть</button>
  <nav><a href="/catalog">Каталог</a></nav>
</dialog>
```

Положение задаётся через `start` или `end`. Ширина по умолчанию составляет 22rem, максимум 90% окна. Высота использует `100dvh` с запасным `100vh`. В примере `menu.html` показаны закрытие при переходе по якорю и переключение на десктопную навигацию от 900px. Эти правила переходов находятся в коде конкретного сайта.

## Галерея

Добавьте CSS галереи, затем объедините ссылки непустым именем группы. Имена групп действуют в пределах документа, порядок соответствует DOM. Пустой `data-nl-gallery` открывает отдельный слайд. Переходы на краях останавливаются. Полноразмерное изображение загружается только при выборе слайда.

```html
<link rel="stylesheet" href="/nano/gallery.css">
<a href="/images/large-1.jpg" data-nl-gallery="product" data-nl-caption="Вид спереди">
  <img src="/images/thumb-1.jpg" alt="Чёрный рюкзак, вид спереди">
</a>
<a href="/images/large-2.jpg" data-nl-gallery="product">Вид сзади</a>
<a href="/videos/demo.mp4" data-nl-gallery="product">Видео</a>
<a href="https://youtu.be/M7lc1UVf-VE" data-nl-gallery="product">YouTube</a>
```

Изображения могут иметь любой формат, поддерживаемый браузером. MP4 и WebM распознаются по пути URL, включая ссылки с query-параметрами. Для видео без расширения укажите `data-nl-type="video"`. Подпись задаёт `data-nl-caption`, альтернативный текст — `data-nl-alt` или `alt` вложенного изображения. `data-nl-label` на открывающей ссылке задаёт имя диалога. Элементы управления по умолчанию подписаны на английском.

Для миниатюр добавьте `thumbs.css` и оберните ссылки в контейнер с `data-nl-thumbs`. Все ссылки группы рекомендуется помещать в один контейнер. Превью берётся из `data-nl-thumb`, затем из вложенного `<img>`. Иначе кнопка содержит номер. Сторонние запросы за постерами автоматически не выполняются.

```html
<link rel="stylesheet" href="/nano/thumbs.css">
<div data-nl-thumbs>
  <a href="/full.jpg" data-nl-gallery="photos" data-nl-thumb="/small.jpg">Фото</a>
  <a href="/movie.webm" data-nl-gallery="photos">Видео</a>
</div>
```

Миниатюры переключают слайд, стрелки клавиатуры работают вне полей ввода и видеоплееров. На мобильных используется обычный горизонтальный свайп Scroll Snap. Увеличение остаётся штатным жестом браузера. JS-зум и циклическое перелистывание в эту версию не входят.

## Видеосервисы

Поддерживаются HTTPS-ссылки следующих видов.

| Сервис | Обычная ссылка | Встроенный плеер |
| --- | --- | --- |
| YouTube | `youtube.com/watch?v=ID`, `youtu.be/ID`, `/shorts/ID`, `/live/ID` | `youtube.com/embed/ID`, `youtube-nocookie.com/embed/ID` |
| VK Видео | `vk.com/videoOWNER_ID`, `vkvideo.ru/videoOWNER_ID` | `/video_ext.php?oid=OWNER&id=ID&hash=KEY` на тех же доменах |
| RUTUBE | `rutube.ru/video/ID`, `/video/private/ID?p=KEY` | `rutube.ru/play/embed/ID?p=KEY` |
| Vimeo | `vimeo.com/ID`, `vimeo.com/ID/HASH` | `player.vimeo.com/video/ID?h=HASH` |
| Kinescope | `kinescope.io/ID` | `kinescope.io/embed/ID` |

Для VK `OWNER_ID` обозначает пару чисел, например `-123_456`. Если ссылка требует ключа, скопируйте **URL из атрибута src** официального iframe в `data-nl-embed`. HTML-код iframe в этот атрибут не передаётся.

```html
<a href="https://vkvideo.ru/video-123_456"
   data-nl-gallery="video"
   data-nl-embed="https://vk.com/video_ext.php?oid=-123&amp;id=456&amp;hash=KEY">Видео</a>
```

URL плеера проверяется по HTTPS, домену и пути. Для YouTube сохраняется время старта `start` или `t`, Vimeo — `h`, RUTUBE — `p` и `t`, VK — `oid`, `id`, `hash`. Внешние SDK не подключаются. При уходе со слайда iframe удаляется, при возврате видео начинается заново. Автозапуск выключен. Рядом остаётся ссылка на оригинал. События ошибок внутри стороннего iframe браузер не раскрывает.

## ESM API

```js
import { open, close } from 'nano-lightbox/core';
import 'nano-lightbox/core.css';

open(document.getElementById('contact'), document.activeElement);
close(document.getElementById('contact'), 'cancel');
```

Импорт `core` не устанавливает глобальных обработчиков. `open(dialog, opener?)` открывает готовый нативный диалог и блокирует прокрутку. Повторный вызов для открытого диалога ничего не делает. `close(dialog, value?)` использует нативное закрытие, событие `close` освобождает блокировку и возвращает фокус. Вызов `dialog.close()` и нативная форма также обрабатываются.

```js
import { openGallery } from 'nano-lightbox/gallery';
import { resolveMedia } from 'nano-lightbox/providers';
import 'nano-lightbox/core.css';
import 'nano-lightbox/gallery.css';

const dialog = await openGallery(document.querySelector('a[data-nl-gallery]'));
dialog?.addEventListener('nl:change', event => console.log(event.detail.index));
```

`openGallery(trigger)` возвращает `Promise<HTMLDialogElement | undefined>`. Триггер должен быть ссылкой в документе. Одновременно открывается одна галерея. Повторный вызов во время загрузки или показа возвращает `undefined`. Закрытая галерея удаляется из DOM. Событие `nl:change` содержит индекс с нуля. `resolveMedia(source, {type?, embed?, base?})` возвращает `{type: 'image' | 'video' | 'iframe', src}` и выбрасывает исключение для запрещённых протоколов или неизвестного embed URL.

`nano-lightbox/thumbs` экспортирует `createThumbs(dialog, links, go)`. Эта функция добавляет ленту и возвращает `update(index)` для синхронизации текущей кнопки. Обычно её загружает сама галерея.

## Инстансы и InSales

Для `snippet.js` подключите обычный script после CSS. Он самодостаточен: рядом не нужны JS chunks. Подключение только предоставляет API, затем зарегистрируйте каждый экземпляр виджета.

```html
<link rel="stylesheet" href="/nano/core.css">
<link rel="stylesheet" href="/nano/gallery.css">
<link rel="stylesheet" href="/nano/thumbs.css"><!-- если нужны миниатюры -->
<script src="/nano/nano-lightbox.js"></script>
```

```js
$widget.each(function (_, root) {
  NanoLightbox.getScope(root)?.destroy(); // перед повторной инициализацией
  const scope = NanoLightbox.createScope(root);
  const gallery = scope.gallery(root.querySelector('.photos'), {
    thumbs: true,
    labels: { close: 'Закрыть', gallery: 'Фотографии товара' }
  });
  gallery.on('change', event => console.log(event.detail.index));
  // Владелец вызывает scope.destroy() ДО удаления/замены DOM.
});
```

ESM предоставляет тот же API через `import { createScope, getScope } from 'nano-lightbox/instances'`. API script и ESM разделяют реестр областей, координацию галерей и блокировку прокрутки. [Работающий пример](examples/instances.html) показывает две копии одного товара, быстрый просмотр, массив медиа и удаление. [Образец snippet.js](examples/insales/snippet.js) показывает EventBus, фильтрацию по форме и `widget_item_id`, отписку и подготовку состояния до синхронного replay при подписке. Работа настоящего редактора InSales этими локальными примерами не проверяется.

### Области и контроллеры

`createScope(root)` принимает DOM Element; повторный вызов возвращает существующую область. `getScope(root)` возвращает её или `undefined`. `scope.modal(dialog, options?)` регистрирует авторский `<dialog>`, `scope.gallery(container, options?)` — контейнер галерей. Элементы должны находиться в корне области; повторная регистрация элемента возвращает прежний контроллер без изменения настроек. Для изменения настроек используйте `setOptions`.

Каждый контроллер имеет `state` (`closed`, `opening`, `open`, `destroyed`), `dialog`, методы `open`, `close(reason?)`, `setOptions`, `on`, `off`, `destroy`. `open()` возвращает `Promise<boolean>`: `true` при открытии, `false` при отмене, уничтожении, пустом списке или ошибке. Ошибки открытия публикуются через `error`. Повторные вызовы во время открытия возвращают один Promise. `close` возвращает `false`, если закрытие отменено; остальные случаи возвращают `true`.

`modal.open(opener?)` принимает открывающий элемент. `gallery.open(indexOrLink?)` принимает индекс с нуля либо DOM-ссылку. В DOM-режиме имя `data-nl-gallery` объединяет ссылки только внутри контейнера контроллера; пустое имя при клике открывает одну ссылку. Программное `open(0)` без ссылки собирает все подходящие ссылки контейнера. Вложенные зарегистрированные контейнеры и области исключаются из родительской выборки. Локальная делегация поддерживает добавленные после регистрации ссылки, `data-nl-open="dialog-id"` и `data-nl-close`. Идентификаторы в HTML должны оставаться уникальными. `auto.js` пропускает зарегистрированные области.

Настройки: `closedby: 'any' | 'closerequest' | 'none'` (по умолчанию `any`), `returnFocus: boolean` (по умолчанию `true`, управляет явным возвратом фокуса библиотекой; браузер также имеет собственное поведение), `labels`. Для галереи также `thumbs: boolean`, `selector` (по умолчанию `a[data-nl-gallery]`) и `items`. `setOptions` объединяет настройки и подписи; новые настройки применяются при следующем открытии. Кнопка закрытия работает при любом `closedby`.

Ключи `labels`: `close`, `previous`, `next`, `original`, `gallery`, `unavailable`, `slide`. Подписи по умолчанию английские. Контент, настройки и подписки независимы. Открытие следующей галереи закрывает предыдущую; отмена `beforeclose` отменяет переключение. Галерея допускается поверх модалки; закрытие или уничтожение родителя освобождает и её.

### Данные и события

```js
const gallery = scope.gallery(container, {
  items: [{ src: '/large.jpg', thumb: '/small.jpg', alt: 'Вид спереди' }]
});
gallery.on('open', () => console.log('Открыта'));
gallery.on('change', event => console.log(event.detail.item, event.detail.index));
await gallery.open(0);
gallery.setItems([{ src: '/other.jpg', caption: 'Новый вариант' }]);
```

Объекты медиа имеют поля `{ src, type?, embed?, caption?, alt?, thumb? }`. URL и видеосервисы проходят те же проверки, что в компактном API. В DOM-режиме используются `href`, `data-nl-type`, `data-nl-embed`, `data-nl-caption`, `data-nl-alt`, `data-nl-thumb` и вложенный `<img>`.

Методы галереи: `goTo(index)`, `next()`, `prev()`, `refresh()`, `setItems(items)`. На краях переход останавливается; некорректный индекс игнорируется. `refresh` перечитывает DOM, сохраняя выбранную ссылку или выбирая первую оставшуюся. `setItems` переключает контроллер в режим массива, копирует список и выбирает первый элемент. Пустой список принудительно закрывает окно. Для возврата к DOM установите `setOptions({ items: null })` перед следующим открытием. `index` и `items` доступны для чтения; `items` возвращает копии объектов.

`on(name, handler, { once?, signal? })` возвращает функцию отписки, `off(name, handler?)` снимает соответствующие подписки. События: `beforeopen`, `open`, `change`, `beforeclose`, `close`, `destroy`, `error`. Callback получает CustomEvent с `detail: { controller, scope, dialog, index, item, element, reason?, error? }`. `beforeopen` и `beforeclose` отменяются через `event.preventDefault()`. При первом показе идут `open`, затем `change`; подтверждение того же индекса после Scroll Snap не создаёт повторное событие. Подписки сохраняются между открытиями. `reason` у закрытия: `api`, `button`, `cancel`, `native`, `replace`, `parent`, `empty`, `destroy`, `error` либо пользовательская строка.

### Очистка

`scope.addCleanup(fn)` регистрирует внешнюю очистку и возвращает функцию снятия регистрации. Например, зарегистрируйте `() => EventBus.unsubscribe(name, callback)` **до** вызова `subscribe`. EventBus InSales не возвращает disposer и может немедленно воспроизвести последнее событие; сначала подготовьте состояние и фильтруйте источник.

`scope.destroy()` уничтожает все контроллеры, выполняет все внешние cleanup, удаляет область из реестра. Ошибки внешних cleanup собираются в `AggregateError`, который выбрасывается после остальных очисток. Повторный destroy безопасен. `controller.destroy()` уничтожает только этот контроллер. Авторские диалоги остаются в DOM, созданные галереи удаляются; медиа, обработчики, observers, таймеры и блокировки освобождаются. Уничтожение и закрытие из-за пустого списка выполняются независимо от `beforeclose`.

Удаление DOM само по себе не вызывает destroy. Владелец должен вызвать cleanup перед удалением или заменой виджета и initializer после вставки. MutationObserver, опроса DOM и придуманного события удаления InSales нет. Скрытие виджета не равно уничтожению.

## Размер и проверки

`npm run build` минифицирует ESM через esbuild, создаёт общие части и `dist/sizes.json`. Размеры суммируются по графу импортов, каждая загружаемая часть учитывается один раз. Для сценария модалки исключаются динамические импорты. Gzip с уровнем 9 рассчитывается отдельно для каждого HTTP-ресурса. Бюджет ядра включает общий модуль и точку входа `core.js`. Бюджет полной JS-поставки включает HTML-инициализацию, провайдеры и миниатюры, CSS учитывается отдельно.

```sh
npm test
npx playwright install chromium firefox webkit
npm run check
```

Сборка завершается ошибкой при превышении 1024 байт для ядра, 5120 байт для компактной полной JS-поставки или 2048 байт для всего CSS. Расширенный ESM-граф `instances` и самостоятельный script имеют отдельные лимиты по 10240 байт gzip. Они также отражаются в `dist/sizes.json`. CI устанавливает три браузера и выполняет те же проверки.

Автотесты покрывают преобразование URL всех пяти сервисов и сохранение ключей, жизненный цикл медиа, фокус, прокрутку, закрытие диалога разными способами, переключение меню на desktop, синхронизацию слайдов и миниатюр. Сторонние плееры в браузерных тестах подменяются ответами, чтобы проверки не зависели от сети. Воспроизведение реальных роликов всех сервисов и прогоны на физических iPhone/Android остаются обязательной ручной проверкой перед выпуском.
