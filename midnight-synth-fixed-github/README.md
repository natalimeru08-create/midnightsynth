# MIDNIGHT SYNTH — исправленная публикация GitHub Pages

## Главное: имена файлов НЕ МЕНЯТЬ

В корне репозитория должны находиться:

```
index.html
styles.css
fonts.css
script.js
.nojekyll
fonts/
  Arial Narrow.ttf
  Arial Narrow Bold.ttf
  Arial Narrow Italic.ttf
  Arial Narrow Bold Italic.ttf
```

**Файлы шрифтов добавь самостоятельно** из своих исходных .ttf. В архиве шрифтов нет. Удали `PLACE_FONTS_HERE.txt` после добавления шрифтов.

Если Mac переименовал `index.html` в `index 12.57.32.html` (и аналогично остальные), верни точные имена из списка выше. GitHub Pages не найдёт главную страницу без `index.html`.

1. Распакуй ZIP на компьютер.
2. Скопируй четыре оригинальных файла Arial Narrow в `fonts/`.
3. Загрузить нужно **содержимое** папки `midnight-synth-fixed-github`, не саму папку и не ZIP. Проверь, что `index.html` лежит прямо в корне репозитория.
4. В GitHub → Settings → Pages → Build and deployment выбери Deploy from a branch → main → /(root) → Save.
5. Подожди 1–5 минут и обнови сайт. Если репозиторий `midnight-synth`, адрес обычно `https://USERNAME.github.io/midnight-synth/`.
6. На телефоне открой сайт в Safari или Chrome и нажми PLAY. Звук не запускается автоматически.

Для проверки ссылок открой `https://USERNAME.github.io/REPO/styles.css` и `/script.js`: они должны показывать текст файлов, а не страницу 404.
