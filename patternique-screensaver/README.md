# Patternique — скринсейвер для macOS

Анимированный фон узоров с сайта Patternique (без затемнения) в виде
заставки macOS. Все узоры генерируются локально в JavaScript — сети не
нужно: фигуры, эмодзи, буквы всех поддерживаемых языков, режимы (сетка,
шахматы, поворот, сдвиги), фигуры на пересечениях и диагональная волна
морфа каждые ~5.7 секунды.

## Состав

| Файл | Назначение |
| --- | --- |
| `screensaver.html` | Самодостаточная страница с фоном (без затемнения). Открывается в любом браузере — F11 для полноэкранного просмотра. |
| `macos/PatterniqueSaver.swift` | Нативный модуль заставки (ScreenSaver + WKWebView). |
| `macos/Info.plist` | Манифест бандла `.saver`. |
| `macos/Makefile` | Сборка и установка одним заходом. |

## Сборка и установка (на Mac)

Нужны Xcode Command Line Tools: `xcode-select --install`.

```bash
cd patternique-screensaver/macos
make install
```

`make install` собирает универсальный `Patternique.saver`
(arm64 + x86_64), подписывает его ad-hoc подписью и кладёт в
`~/Library/Screen Savers/`. После этого выберите **Patternique** в
System Settings → Screen Saver.

> macOS может спросить разрешение при первом запуске неподписанной
> сторонней заставки — подтвердите её в System Settings →
> Privacy & Security.

### Если экран чёрный

- Модуль загружает страницу через `loadHTMLString` (а не `file://`),
  потому что песочница `legacyScreenSaver` может запретить WebKit доступ
  к файлам — это и выглядело как чёрный экран. Обновитесь до текущей
  версии и переустановите: `make install`.
- macOS кэширует загруженные заставки: после переустановки нужно убить
  старый процесс — `make install` теперь делает это сам
  (`killall legacyScreenSaver`). Вручную: закройте System Settings,
  выполните `killall legacyScreenSaver` и откройте настройки заново.
- Если модуль сообщает об ошибке, она теперь выводится текстом на экране
  заставки вместо чёрного экрана — пришлите этот текст.
- Проверить страницу отдельно от модуля: откройте `screensaver.html`
  в Safari — фон должен анимироваться.

## Вариант без сборки

Если собирать нативный модуль не хочется, поставьте бесплатный
[WebViewScreenSaver](https://github.com/liquidx/webviewscreensaver)
и укажите в его настройках путь к `screensaver.html`
(`file:///путь/до/patternique-screensaver/screensaver.html`).

## Обновление узоров

`screensaver.html` — копия фонового движка с сайта
(`pattern-backend/vercel-site/index.html`, первый `<script>` +
CSS-блок «animated pattern background») без слоя затемнения `bgDim`.
После изменения движка на сайте пересоберите файл или перенесите правки
вручную, затем `make install` заново.
