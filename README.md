# livekit-transcript-ui

Сервер отображения для [livekit-transcript](https://github.com/mogafk/livekit-transcript): принимает события
sink'а `http` (протокол — [`docs/http-sink.md`](https://github.com/mogafk/livekit-transcript/blob/main/docs/http-sink.md) проекта livekit-transcript) и показывает
транскрипт созвона в браузере в реальном времени.

## Запуск

```bash
npm install
cp .env.example .env          # вписать HTTP_SINK_TOKEN
npm run dev                   # сервер :8787 + UI http://localhost:5173
```

События принимаются на `POST http://localhost:8787/api/ingest` с заголовком
`Authorization: Bearer <HTTP_SINK_TOKEN>`.

## Тестовый прогон

Чтобы посмотреть UI в работе без настоящего созвона, при запущенном сервере:

```bash
npm run replay                # засыпает сервер событиями, будто идёт транскрибация
npm run replay -- --speed 4   # то же, быстрее
```

## Сборка

Без Vite: `npm run build && npm start` — UI на http://localhost:8787.

## Docker

```bash
docker build -t livekit-transcript-ui .
docker run --rm --env-file .env -p 127.0.0.1:8787:8787 livekit-transcript-ui
```

`-p 127.0.0.1:…` оставляет UI доступным только с этой машины.

Сессии хранятся только в памяти: пропадают при перезапуске сервера, а завершённые —
через 30 минут (`SESSION_RETENTION_S` в `.env`). Чтобы сохранить сессию, скачайте её
кнопкой «Экспорт JSON»; файл открывается кнопкой «Открыть JSON» на главной.
Подробности — [AGENTS.md](AGENTS.md).
