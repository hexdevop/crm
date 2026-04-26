# Universal CRM — Руководство по установке и развёртыванию

Это руководство охватывает четыре сценария: быстрый запуск в режиме разработки, развёртывание на сервер с существующим nginx, развёртывание на чистый сервер и ручная установка без Docker.

---

## Содержание

1. [Требования](#требования)
2. [Режим разработки (DEV)](#режим-разработки-dev)
3. [Деплой на сервер с существующим Nginx](#деплой-на-сервер-с-существующим-nginx)
4. [Режим продакшн (PROD — чистый сервер)](#режим-продакшн-prod--чистый-сервер)
5. [Ручная установка (без Docker)](#ручная-установка-без-docker)
6. [Telegram-бот](#telegram-бот)
7. [Управление базой данных](#управление-базой-данных)
8. [Часто задаваемые вопросы](#часто-задаваемые-вопросы)
9. [Структура проекта](#структура-проекта)

---

## Требования

### Docker-способ (рекомендуется)

| Компонент | Минимальная версия | Проверка |
|---|---|---|
| Docker Engine | 24.0+ | `docker --version` |
| Docker Compose | v2.20+ (плагин, не standalone) | `docker compose version` |
| RAM | 2 GB свободной памяти | |
| Диск | 10 GB свободного места | |

> Важно: используется `docker compose` (v2, плагин, без дефиса). Команда `docker-compose` (v1, standalone) устарела и может не работать с некоторыми конфигурациями файла.

### Ручная установка (без Docker)

| Компонент | Версия |
|---|---|
| Python | 3.11+ |
| Node.js | 20+ |
| PostgreSQL | 16 |
| Redis | 7 |

---

## Режим разработки (DEV)

Dev-конфигурация (`docker-compose.dev.yml`) запускает все пять сервисов: PostgreSQL, Redis, backend (FastAPI + uvicorn), frontend (Vite dev server), bot (aiogram). Исходный код монтируется в контейнеры — изменения подхватываются мгновенно без пересборки образов.

### Шаг 1 — Клонировать репозиторий

```bash
git clone <repository-url> crm
cd crm
```

### Шаг 2 — Переменные окружения

В dev-режиме **отдельный `.env` файл не нужен**: все переменные уже заданы прямо в `docker-compose.dev.yml` с безопасными дефолтами для локальной разработки.

Если вы хотите переопределить какие-то значения (например, подключить реального Telegram-бота), создайте файл `.env` в корне проекта — Docker Compose подхватит его автоматически. Все доступные переменные перечислены в разделе [Переменные окружения](#переменные-окружения) файла README.md.

### Шаг 3 — Запустить стек

```bash
docker compose -f docker-compose.dev.yml up --build
```

При первом запуске Docker:
1. Собирает образы (backend, frontend, bot).
2. Поднимает postgres и redis, ждёт их healthcheck.
3. Запускает backend: `entrypoint.sh` выполняет `alembic upgrade head` (применяет все миграции), затем стартует `uvicorn` с флагом `--reload`.
4. Автоматически создаёт аккаунт суперадминистратора (`admin@crm.local` / `Admin123!`) и системные разрешения.
5. Запускает Vite dev server и бота.

Дальнейшие запуски (без `--build`) занимают несколько секунд:

```bash
docker compose -f docker-compose.dev.yml up
```

### Доступные адреса

| Сервис | URL | Описание |
|--------|-----|----------|
| Frontend | http://localhost:5173 | React-приложение (Vite dev server) |
| Backend API | http://localhost:8000 | FastAPI |
| Swagger UI | http://localhost:8000/api/docs | Интерактивная документация |
| ReDoc | http://localhost:8000/api/redoc | Документация для чтения |
| PostgreSQL | localhost:5432 | Прямой доступ к БД (dev only) |
| Redis | localhost:6379 | Прямой доступ к Redis (dev only) |

### Первый вход

Перейдите на http://localhost:5173 и войдите с кредентиалами суперадминистратора:

- **Email:** `admin@crm.local`
- **Пароль:** `Admin123!`

Суперадмин видит все компании и управляет системой. Для создания обычного рабочего пространства: создайте компанию через меню управления, добавьте пользователей и настройте роли.

### Hot-reload в dev-режиме

**Backend:** исходный код `./backend` монтируется в контейнер. `uvicorn` запущен с флагом `--reload` (через переменную `UVICORN_FLAGS=--reload`). Любое изменение `.py` файла автоматически перезапускает сервер — обычно за 1–2 секунды.

**Frontend:** исходный код `./frontend` монтируется в контейнер. Vite отслеживает изменения и применяет их через HMR (Hot Module Replacement) без перезагрузки страницы.

**Прокси:** Vite dev server проксирует все запросы `/api/*` на backend. URL для прокси берётся из переменной `BACKEND_URL` (в docker-compose — `http://backend:8000`, при ручном запуске — `http://localhost:8000`). **Не задавайте** переменную `VITE_API_URL` — это приведёт к использованию абсолютных URL и CORS-ошибкам.

### Остановка и очистка

```bash
# Остановить контейнеры (данные в volumes сохраняются)
docker compose -f docker-compose.dev.yml down

# Остановить и удалить volumes (ВНИМАНИЕ: удаляет БД)
docker compose -f docker-compose.dev.yml down -v

# Пересобрать образы после изменений в Dockerfile или requirements.txt
docker compose -f docker-compose.dev.yml up --build
```

---

## Деплой на сервер с существующим Nginx

Этот сценарий применяется когда на сервере уже запущен nginx (обслуживает другие сайты). Docker не поднимает собственный nginx — вместо этого backend и frontend доступны только на `127.0.0.1`, а хостовый nginx принимает внешний трафик и проксирует его.

**Домен:** `crm.llve.ru` → IP `89.223.64.97`  
**Путь проекта на сервере:** `/home/crm`

### Архитектура

```
Интернет (80/443)
       │
  [Хостовый nginx]  ← SSL-сертификат Let's Encrypt (certbot на хосте)
       ├── /api/*  → proxy_pass http://127.0.0.1:8000  (crm_backend)
       └── /*      → proxy_pass http://127.0.0.1:3000  (crm_frontend)

Docker-сеть (только внутри сервера):
  crm_backend   — слушает 127.0.0.1:8000
  crm_frontend  — слушает 127.0.0.1:3000
  crm_postgres  — только внутренняя сеть Docker
  crm_redis     — только внутренняя сеть Docker
  crm_bot       — только внутренняя сеть Docker
```

---

### Шаг 1 — Подготовка сервера

Подключитесь к серверу и убедитесь, что Docker установлен:

```bash
ssh root@89.223.64.97

# Проверка Docker
docker --version && docker compose version
```

Если Docker не установлен:

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker
```

---

### Шаг 2 — Загрузить проект на сервер

**Вариант А — через Git:**

```bash
cd /home
git clone <ваш-репозиторий> crm
cd crm
```

**Вариант Б — через rsync (с вашей машины):**

```bash
# Запустить на локальной машине (Git Bash / WSL)
rsync -avz \
  --exclude='.git' \
  --exclude='frontend/node_modules' \
  --exclude='venv' \
  --exclude='.venv' \
  /e/crm/ root@89.223.64.97:/home/crm/
```

---

### Шаг 3 — Создать `.env.prod`

```bash
cd /home/crm
cp .env.prod.example .env.prod
nano .env.prod
```

Сгенерировать случайные ключи:

```bash
# Запустить дважды — для SECRET_KEY и INTERNAL_BOT_TOKEN
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Заполненный `.env.prod` должен выглядеть так:

```dotenv
SECRET_KEY=a3f8c2e1d9b47f6a2c8e3d1b9f4e7a2c8d3f1b9e4a7c2d8f3b1e9a4c7d2f8b3
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

POSTGRES_USER=crm
POSTGRES_PASSWORD=MyStr0ngDbP@ss2024
POSTGRES_DB=crm_db

REDIS_PASSWORD=R3disStr0ngP@ss2024

BOT_TOKEN=6689906797:AAHQNAkJRcq-WF958iorvzxHPBPmjCA3RhM
WEBHOOK_URL=https://crm.llve.ru/api/v1/telegram/webhook
INTERNAL_BOT_TOKEN=f2b9e4a7c1d3f8b6e2a9c4d7f1b3e8a6c2d4f9b1e7a3c6d8f2b4e1a9c7d3f6b8

CORS_ORIGINS=["https://crm.llve.ru"]

SUPERADMIN_EMAIL=admin@crm.llve.ru
SUPERADMIN_PASSWORD=Admin@Pr0d2024!
```

---

### Шаг 4 — Собрать образы и запустить Docker-стек

```bash
cd /home/crm

# Собрать все образы
docker compose -f docker-compose.host-nginx.yml --env-file .env.prod build --parallel

# Запустить в фоне
docker compose -f docker-compose.host-nginx.yml --env-file .env.prod up -d

# Проверить статус (все должны быть healthy)
docker compose -f docker-compose.host-nginx.yml --env-file .env.prod ps
```

Дождитесь пока backend пройдёт healthcheck (около 30–60 секунд):

```bash
# Проверить доступность backend
curl http://127.0.0.1:8000/health

# Проверить доступность frontend
curl -I http://127.0.0.1:3000
```

---

### Шаг 5 — Установить Certbot и получить SSL-сертификат

```bash
# Установка Certbot (Debian/Ubuntu)
apt update && apt install -y certbot python3-certbot-nginx

# Проверка установки
certbot --version
```

Получить сертификат через standalone-режим (временно останавливать nginx НЕ нужно — используется webroot):

```bash
# Создать директорию для ACME-challenge
mkdir -p /var/www/certbot

# Получить сертификат через webroot
# (nginx должен отдавать /.well-known/acme-challenge/ — настроим в следующем шаге)
certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email abduraxmonislomov@gmail.com \
  --agree-tos \
  --no-eff-email \
  -d crm.llve.ru
```

> Если домен ещё не настроен или DNS не успел обновиться, используйте standalone:
> ```bash
> # Временно освобождает порт 80 (nginx нужно остановить только для этой команды)
> systemctl stop nginx
> certbot certonly --standalone -d crm.llve.ru --email abduraxmonislomov@gmail.com --agree-tos --no-eff-email
> systemctl start nginx
> ```

Сертификаты появятся в:

```
/etc/letsencrypt/live/crm.llve.ru/fullchain.pem
/etc/letsencrypt/live/crm.llve.ru/privkey.pem
```

---

### Шаг 6 — Настроить хостовый Nginx

Создать конфигурационный файл для сайта:

```bash
nano /etc/nginx/sites-available/crm.llve.ru
```

Вставить следующее содержимое:

```nginx
# /etc/nginx/sites-available/crm.llve.ru

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=crm_api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=crm_auth:10m rate=5r/m;

# HTTP → HTTPS redirect + Let's Encrypt challenge
server {
    listen 80;
    server_name crm.llve.ru;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl;
    server_name crm.llve.ru;

    ssl_certificate     /etc/letsencrypt/live/crm.llve.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.llve.ru/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling        on;
    ssl_stapling_verify on;

    client_max_body_size 20m;

    # Security headers
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy no-referrer-when-downgrade always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Auth endpoints — строгий rate limit
    location ~ ^/api/v1/auth/(login|register) {
        limit_req zone=crm_auth burst=10 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API proxy → backend (порт 8000)
    location /api/ {
        limit_req zone=crm_api burst=50 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 60s;
    }

    # Frontend SPA → frontend (порт 3000)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активировать конфигурацию:

```bash
# Создать символическую ссылку
ln -s /etc/nginx/sites-available/crm.llve.ru /etc/nginx/sites-enabled/crm.llve.ru

# Проверить конфигурацию на ошибки
nginx -t

# Перезагрузить nginx (без остановки — нулевой downtime)
systemctl reload nginx
```

---

### Шаг 7 — Проверить работу

```bash
# Проверить HTTPS
curl -I https://crm.llve.ru

# Проверить API
curl https://crm.llve.ru/api/health

# Статус всех контейнеров
docker compose -f /home/crm/docker-compose.host-nginx.yml --env-file /home/crm/.env.prod ps

# Логи в реальном времени
docker compose -f /home/crm/docker-compose.host-nginx.yml --env-file /home/crm/.env.prod logs -f
```

Открыть в браузере: `https://crm.llve.ru`

**Первый вход:**
- Email: значение `SUPERADMIN_EMAIL` из `.env.prod`
- Пароль: значение `SUPERADMIN_PASSWORD` из `.env.prod`

---

### Автоматическое обновление SSL-сертификата

Certbot при установке через apt автоматически создаёт systemd-таймер для обновления. Проверить:

```bash
systemctl status certbot.timer

# Проверить что обновление сработает
certbot renew --dry-run
```

Если таймер не создался — добавить в cron вручную:

```bash
crontab -e
# Добавить строку:
0 3 * * * certbot renew --quiet && systemctl reload nginx
```

---

### Управление сервисами

```bash
cd /home/crm

# Посмотреть статус
docker compose -f docker-compose.host-nginx.yml --env-file .env.prod ps

# Логи конкретного сервиса
docker compose -f docker-compose.host-nginx.yml --env-file .env.prod logs -f backend
docker compose -f docker-compose.host-nginx.yml --env-file .env.prod logs -f bot

# Перезапустить сервис
docker compose -f docker-compose.host-nginx.yml --env-file .env.prod restart backend

# Остановить всё
docker compose -f docker-compose.host-nginx.yml --env-file .env.prod down

# Обновить код и пересобрать
git pull
docker compose -f docker-compose.host-nginx.yml --env-file .env.prod up --build -d

# Применить миграции БД вручную
docker compose -f docker-compose.host-nginx.yml --env-file .env.prod exec backend alembic upgrade head
```

### Резервное копирование базы данных

```bash
# Создать дамп
docker compose -f /home/crm/docker-compose.host-nginx.yml --env-file /home/crm/.env.prod \
  exec postgres pg_dump -U crm crm_db > /home/crm/backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановить из дампа
docker compose -f /home/crm/docker-compose.host-nginx.yml --env-file /home/crm/.env.prod \
  exec -T postgres psql -U crm crm_db < /home/crm/backup_20240101_120000.sql
```

---

## Режим продакшн (PROD — чистый сервер)

Prod-конфигурация (`docker-compose.prod.yml`) использует оптимизированные образы без source-mount'ов, добавляет nginx как reverse proxy с поддержкой HTTPS и ограничивает потребление памяти сервисами.

### Шаг 1 — Подготовить переменные окружения

Создайте файл `.env.prod` в корне проекта. Все переменные, помеченные `(обязательно)`, должны быть заданы — без них prod-контейнер откажется стартовать.

```dotenv
# === БЕЗОПАСНОСТЬ (ОБЯЗАТЕЛЬНО СМЕНИТЬ) ===

# Случайная строка, минимум 32 символа. Генерация: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=замените-на-случайную-строку-минимум-32-символа

# === БАЗА ДАННЫХ ===
POSTGRES_USER=crm
POSTGRES_PASSWORD=ваш_надёжный_пароль_postgres   # обязательно
POSTGRES_DB=crm_db

# === REDIS ===
REDIS_PASSWORD=ваш_надёжный_пароль_redis          # рекомендуется

# === СУПЕРАДМИНИСТРАТОР ===
SUPERADMIN_EMAIL=admin@yourdomain.com
SUPERADMIN_PASSWORD=ВашНадёжныйПароль123!          # обязательно

# === TELEGRAM ===
BOT_TOKEN=токен_от_BotFather                        # обязательно, если используется бот
INTERNAL_BOT_TOKEN=случайная-строка-для-внутр-апи  # обязательно, сменить!
WEBHOOK_URL=https://yourdomain.com/bot/webhook      # если используется webhook-режим

# === CORS ===
# Точный origin вашего фронтенда — без trailing slash
CORS_ORIGINS=["https://yourdomain.com"]

# === JWT (опционально, можно оставить дефолты) ===
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
```

> **Внимание:** не добавляйте `VITE_API_URL` в `.env.prod`. В production nginx проксирует `/api` на backend — абсолютный URL не нужен и сломает маршрутизацию.

### Шаг 2 — Добавить SSL-сертификаты

Положите файлы сертификата в директорию `nginx/ssl/`:

```
nginx/
└── ssl/
    ├── cert.pem      # Сертификат (fullchain)
    └── key.pem       # Приватный ключ
```

Получить бесплатный сертификат Let's Encrypt:

```bash
# Через certbot (вне Docker, до первого запуска)
certbot certonly --standalone -d yourdomain.com
# Сертификаты появятся в /etc/letsencrypt/live/yourdomain.com/
# Скопируйте fullchain.pem → nginx/ssl/cert.pem
#          privkey.pem    → nginx/ssl/key.pem
```

### Шаг 3 — Запустить prod-стек

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d
```

Флаг `-d` запускает сервисы в фоне (detached mode).

### Шаг 4 — Проверить работу

```bash
# Состояние контейнеров
docker compose -f docker-compose.prod.yml ps

# Логи backend
docker compose -f docker-compose.prod.yml logs backend --tail=50

# Логи nginx
docker compose -f docker-compose.prod.yml logs nginx --tail=50

# Проверить healthcheck backend
curl -f https://yourdomain.com/api/health
```

### Архитектура prod-окружения

```
Интернет
   │  :443 (HTTPS)
   ▼
nginx (crm_nginx)
   ├── /api/*  → proxy_pass http://backend:8000
   └── /*      → proxy_pass http://frontend:80  (собранная React-SPA)

backend (crm_backend)   — expose 8000, не публичный
frontend (crm_frontend) — expose 80,   не публичный (nginx-static)
postgres (crm_postgres) — только внутренняя сеть
redis (crm_redis)       — только внутренняя сеть
bot (crm_bot)           — только внутренняя сеть
```

В prod-режиме PostgreSQL и Redis не экспонируют порты наружу — доступны только другим сервисам Docker-сети.

### Обновление в production

```bash
# Получить новый код
git pull

# Пересобрать и перезапустить (с минимальным downtime)
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d

# Миграции применяются автоматически через entrypoint.sh при старте backend
```

---

## Ручная установка (без Docker)

Используйте этот способ если Docker недоступен или нужна максимальная гибкость.

### Предварительно: запустите PostgreSQL и Redis

**PostgreSQL:**
```sql
-- Выполните в psql как суперпользователь
CREATE USER crm WITH PASSWORD 'crm_secret';
CREATE DATABASE crm_db OWNER crm;
```

**Redis:** запустите локально на порту 6379 (стандартная установка).

### Backend

```bash
cd backend

# Создать виртуальное окружение
python -m venv .venv
source .venv/bin/activate        # Linux / macOS
# .venv\Scripts\activate         # Windows

# Установить зависимости
pip install -r requirements.txt

# Создать файл настроек
# Можно скопировать из docker-compose.dev.yml нужные значения
cat > ../.env << 'EOF'
SECRET_KEY=dev-secret-key-change-in-production-minimum-32-characters-long
DATABASE_URL=postgresql+asyncpg://crm:crm_secret@localhost:5432/crm_db
REDIS_URL=redis://localhost:6379/0
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
ENVIRONMENT=development
BOT_TOKEN=
INTERNAL_BOT_TOKEN=crm-dev-internal-bot-token-12345
CORS_ORIGINS=["http://localhost:5173"]
SUPERADMIN_EMAIL=admin@crm.local
SUPERADMIN_PASSWORD=Admin123!
EOF

# Применить миграции (создаст таблицы и суперадмина)
alembic upgrade head

# Запустить сервер с hot-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend будет доступен на http://localhost:8000.

### Frontend

```bash
cd frontend
npm install

# Убедитесь, что VITE_API_URL НЕ задан в .env.
# Vite сам проксирует /api → http://localhost:8000 (см. vite.config.ts).
npm run dev
```

Frontend будет доступен на http://localhost:5173. Прокси `/api` → `http://localhost:8000` настроен в `vite.config.ts` через переменную `BACKEND_URL` (дефолт — `http://localhost:8000`).

### Bot (опционально)

```bash
cd bot
pip install -r requirements.txt

# Задайте переменные:
export BOT_TOKEN="ваш_токен_от_BotFather"
export REDIS_URL="redis://localhost:6379/1"
export BACKEND_INTERNAL_URL="http://localhost:8000"
export INTERNAL_BOT_TOKEN="crm-dev-internal-bot-token-12345"

python -m bot.main
```

---

## Telegram-бот

### Создание бота

1. Откройте Telegram, найдите `@BotFather`.
2. Отправьте `/newbot`, задайте имя и username.
3. Скопируйте выданный `BOT_TOKEN`.
4. Задайте `BOT_TOKEN` в переменных окружения (dev: `docker-compose.dev.yml`, prod: `.env.prod`).

### Привязка аккаунта

1. Войдите в CRM-приложение.
2. Перейдите в **Настройки** → **Telegram-интеграция**.
3. Нажмите **Сгенерировать токен подключения** — будет показан одноразовый токен.
4. Откройте бота в Telegram и отправьте команду:
   ```
   /connect ВАШ_ТОКЕН
   ```
5. Бот подтвердит привязку. Теперь уведомления будут приходить в этот Telegram-аккаунт.

### Как работают уведомления

Backend публикует события в Redis-канал `crm:notifications:{company_id}`. Бот подписан на Redis через `SUBSCRIBE` и немедленно пересылает сообщения в Telegram. Привязка хранится в БД: `user.telegram_chat_id`.

---

## Управление базой данных

### Миграции Alembic

Все команды выполняются из директории `backend/` (или внутри контейнера).

```bash
# Применить все pending-миграции (выполняется автоматически при старте контейнера)
alembic upgrade head

# Откатить последнюю миграцию
alembic downgrade -1

# Откатить до конкретной ревизии
alembic downgrade <revision_id>

# Показать историю миграций
alembic history --verbose

# Показать текущую ревизию в БД
alembic current

# Создать новую миграцию (autogenerate по изменениям моделей)
alembic revision --autogenerate -m "описание изменений"

# Создать пустую миграцию (для ручного SQL)
alembic revision -m "описание изменений"
```

**Внутри Docker (dev):**

```bash
# Подключиться к контейнеру backend
docker compose -f docker-compose.dev.yml exec backend bash

# Внутри контейнера
alembic revision --autogenerate -m "add new field to entity"
alembic upgrade head
```

**Или одной командой:**

```bash
docker compose -f docker-compose.dev.yml exec backend alembic upgrade head
```

### Прямой доступ к PostgreSQL

```bash
# Через psql в контейнере (dev)
docker compose -f docker-compose.dev.yml exec postgres psql -U crm -d crm_db

# Или через любой GUI-клиент (TablePlus, DBeaver, pgAdmin):
# Host: localhost, Port: 5432, User: crm, Password: crm_secret, DB: crm_db
```

### Резервное копирование

```bash
# Создать дамп (prod)
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U crm crm_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановить из дампа
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U crm crm_db < backup_20240101_120000.sql
```

---

## Часто задаваемые вопросы

### «Network Error» или «ERR_CONNECTION_REFUSED» при входе

**Причина:** frontend не может достучаться до backend.

**Решение:**
1. Убедитесь, что backend-контейнер запущен: `docker compose -f docker-compose.dev.yml ps`.
2. Посмотрите логи backend: `docker compose -f docker-compose.dev.yml logs backend`.
3. Проверьте, что backend слушает порт 8000: откройте http://localhost:8000/health.
4. Убедитесь, что `VITE_API_URL` **не задан** — при его наличии запросы идут напрямую, минуя прокси.

### Ошибка миграции при старте backend

**Симптом:** backend-контейнер падает с ошибкой `alembic.util.exc.CommandError` или `psycopg2.OperationalError`.

**Решение:**
1. Убедитесь, что postgres-контейнер поднялся и прошёл healthcheck: `docker compose -f docker-compose.dev.yml ps`.
2. Запустите миграцию вручную:
   ```bash
   docker compose -f docker-compose.dev.yml exec backend alembic upgrade head
   ```
3. Если возник конфликт ревизий (несколько heads):
   ```bash
   alembic heads               # посмотреть все head-ревизии
   alembic merge heads -m "merge"  # смержить
   alembic upgrade head
   ```

### CORS-ошибки в браузере

**Симптом:** `Access to XMLHttpRequest ... has been blocked by CORS policy`.

**Причины и решения:**

| Ситуация | Решение |
|----------|---------|
| Фронтенд открыт не на `localhost:5173` | Добавьте реальный origin в `CORS_ORIGINS` |
| Задана переменная `VITE_API_URL` | Удалите её — запросы должны идти через прокси |
| В prod: nginx не проксирует `/api` | Проверьте `nginx.prod.conf`, раздел `location /api/` |
| В prod: неверный `CORS_ORIGINS` | Убедитесь, что значение содержит точный origin с протоколом и без trailing slash: `["https://yourdomain.com"]` |

### Бот не получает сообщения / уведомления не приходят

**Проверьте по шагам:**

1. Контейнер бота запущен?
   ```bash
   docker compose -f docker-compose.dev.yml logs bot
   ```
2. `BOT_TOKEN` правильный? Проверьте через `@BotFather` → `/mybots`.
3. Redis доступен из контейнера бота:
   ```bash
   docker compose -f docker-compose.dev.yml exec bot \
     python -c "import redis; r=redis.from_url('redis://redis:6379/1'); print(r.ping())"
   ```
4. Привязка выполнена? В Telegram должна быть отправлена команда `/connect TOKEN`.
5. `INTERNAL_BOT_TOKEN` совпадает в контейнерах backend и bot?

### Контейнер падает с «out of memory»

В prod-конфигурации установлены лимиты памяти. Если сервер имеет меньше 2 GB RAM, увеличьте swap или поднимите лимиты в `docker-compose.prod.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 1g   # увеличить при необходимости
```

### Страница белая / React не загружается

1. Откройте DevTools → Console — посмотрите JS-ошибки.
2. Убедитесь, что Vite dev server запущен: http://localhost:5173 должен отдавать HTML.
3. Логи frontend-контейнера:
   ```bash
   docker compose -f docker-compose.dev.yml logs frontend
   ```
4. Проверьте, что `node_modules` установлены:
   ```bash
   docker compose -f docker-compose.dev.yml exec frontend ls node_modules | head
   ```

---

## Структура проекта

```
crm/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── router.py              # Главный роутер (подключает v1)
│   │   │   └── v1/
│   │   │       ├── auth.py            # Логин, логаут, refresh, профиль
│   │   │       ├── companies.py       # Управление компаниями (суперадмин)
│   │   │       ├── users.py           # Пользователи компании
│   │   │       ├── roles.py           # Роли и разрешения
│   │   │       ├── entities.py        # Конструктор сущностей
│   │   │       ├── entity_records.py  # Записи сущностей
│   │   │       ├── telegram.py        # Привязка Telegram, токены
│   │   │       └── access_expiration.py # Управление сроком доступа
│   │   ├── core/
│   │   │   ├── security.py            # JWT: create/decode/verify
│   │   │   ├── dependencies.py        # FastAPI Depends: get_current_user, etc.
│   │   │   ├── exceptions.py          # Кастомные HTTP-исключения
│   │   │   └── pagination.py          # Pagination helper
│   │   ├── models/
│   │   │   ├── base.py                # TimestampMixin
│   │   │   ├── company.py             # Company
│   │   │   ├── user.py                # User, UserRole
│   │   │   ├── role.py                # Role, Permission, RolePermission
│   │   │   ├── entity.py              # Entity, EntityField (FieldType enum)
│   │   │   ├── entity_record.py       # EntityRecord (JSONB data)
│   │   │   ├── telegram.py            # TelegramBinding
│   │   │   └── access_expiration.py   # AccessExpiration
│   │   ├── repositories/              # Tenant-scoped репозитории
│   │   ├── schemas/                   # Pydantic v2 request/response схемы
│   │   ├── services/                  # Бизнес-логика
│   │   ├── tasks/                     # Фоновые задачи (APScheduler)
│   │   ├── config.py                  # pydantic-settings конфигурация
│   │   ├── database.py                # AsyncEngine, AsyncSession
│   │   ├── redis_client.py            # Redis-клиент
│   │   └── main.py                    # FastAPI app, lifespan, middleware
│   ├── alembic/
│   │   ├── versions/                  # Файлы миграций
│   │   └── env.py
│   ├── alembic.ini
│   ├── entrypoint.sh                  # alembic upgrade head + uvicorn
│   ├── Dockerfile                     # Prod/dev образ backend
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── api/                       # Axios-клиенты (authApi, entitiesApi, ...)
│   │   ├── components/                # Переиспользуемые UI-компоненты
│   │   ├── hooks/                     # React Query хуки
│   │   ├── layouts/                   # AppLayout, AuthLayout
│   │   ├── pages/
│   │   │   ├── auth/                  # Login, Register
│   │   │   ├── dashboard/             # Главная страница
│   │   │   ├── entities/              # Конструктор сущностей
│   │   │   ├── records/               # Записи сущностей
│   │   │   ├── users/                 # Управление пользователями
│   │   │   ├── roles/                 # Управление ролями
│   │   │   ├── settings/              # Настройки, Telegram-интеграция
│   │   │   ├── access/                # Управление сроком доступа
│   │   │   └── errors/                # 404, 403
│   │   ├── router/                    # React Router: маршруты, guards
│   │   ├── store/                     # Zustand: auth store
│   │   ├── types/                     # TypeScript типы
│   │   └── utils/                     # Вспомогательные функции
│   ├── vite.config.ts                 # Vite config: proxy /api → BACKEND_URL
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── Dockerfile                     # Prod: build + nginx-static
│   └── Dockerfile.dev                 # Dev: vite dev server
│
├── bot/
│   ├── bot/
│   │   ├── handlers/                  # /start, /connect команды
│   │   ├── notifications/             # Redis pub/sub listener
│   │   └── main.py                    # aiogram App, запуск polling/webhook
│   ├── Dockerfile
│   └── requirements.txt
│
├── nginx/
│   ├── nginx.prod.conf                # HTTPS + certbot, для чистого сервера
│   └── nginx.init.conf                # HTTP-only, используется при первом получении сертификата
│
├── docker-compose.dev.yml             # Dev: hot-reload, открытые порты
├── docker-compose.prod.yml            # Prod: Docker nginx + certbot (чистый сервер)
├── docker-compose.host-nginx.yml      # Prod: без Docker nginx (сервер с существующим nginx)
├── .env.prod.example                  # Шаблон переменных для production
├── deploy.sh                          # Скрипт автодеплоя (для чистого сервера)
├── README.md                          # Обзор проекта
└── SETUP.md                           # Это руководство
```
