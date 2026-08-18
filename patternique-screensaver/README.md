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
| `macos/PatterniqueSaver.swift` | Нативный модуль заставки — движок узоров портирован на Core Animation (без WebKit). |
| `macos/Info.plist` | Манифест бандла `.saver`. |
| `macos/Makefile` | Сборка и установка одним заходом. |

## Сборка и установка (на Mac)

Нужны Xcode Command Line Tools: `xcode-select --install`.

```bash
cd patternique-screensaver/macos
make install
```

`make install` собирает `Patternique.saver` под архитектуру вашего Mac
(arm64 на Apple Silicon), подписывает его ad-hoc подписью и кладёт в
`~/Library/Screen Savers/`. После этого выберите **Patternique** в
System Settings → Screen Saver.

Универсальный бандл (arm64 + x86_64) — `make universal`: для него нужен
полный Xcode, потому что отдельные Command Line Tools часто содержат
только arm64-версии библиотек совместимости Swift, и линковка x86_64
падает с ошибкой `__swift_FORCE_LOAD_$_swiftCompatibility56 … not found`.

> macOS может спросить разрешение при первом запуске неподписанной
> сторонней заставки — подтвердите её в System Settings →
> Privacy & Security.

### Если экран чёрный

- Начиная с версии 2.0 модуль **не использует WebKit вовсе**: песочница
  `legacyScreenSaver` часто не даёт WKWebView запустить или отрисовать
  свой WebContent-процесс, и это выглядит как молчаливый чёрный экран.
  Движок узоров портирован на Core Animation (CALayer/CAShapeLayer) —
  он рендерится в самом процессе заставки и не может быть заблокирован.
  Обновитесь и переустановите: `make install`.
- macOS кэширует загруженные заставки: после переустановки нужно убить
  старый процесс — `make install` делает это сам
  (`killall legacyScreenSaver`). Вручную: закройте System Settings,
  выполните `killall legacyScreenSaver` и откройте настройки заново.
- Проверить движок отдельно можно в браузере: `screensaver.html` — та же
  логика в веб-виде.

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
