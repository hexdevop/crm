# Universal CRM

![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=flat&logo=docker&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React_18-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis_7-DC382D?style=flat&logo=redis&logoColor=white)

Дипломная работа — **мультитенантная CRM-система** с конструктором сущностей, гибкой ролевой моделью и Telegram-уведомлениями.

---

## О проекте

Universal CRM — это полнофункциональная CRM-платформа, где **каждая компания** (tenant) работает в полностью изолированном пространстве данных. Суперадминистратор управляет всеми компаниями через единый интерфейс, тогда как сотрудники каждой компании видят только свои данные.

### Ключевые концепции

**Мультитенантность** реализована через row-level изоляцию: каждая запись в базе данных содержит поле `company_id`, и все запросы автоматически фильтруются по нему. Данные разных компаний физически хранятся в одной БД, но полностью логически изолированы. Middleware аутентификации извлекает `company_id` из JWT-токена и прикрепляет его к каждому запросу — случайно «вытечь» в чужой тенант невозможно.

**Конструктор сущностей** позволяет каждой компании самостоятельно создавать произвольные типы объектов (например, «Клиенты», «Сделки», «Задачи»), определять поля нужных типов (`text`, `number`, `date`, `boolean`, `select`, `email`, `phone`) и немедленно работать с записями. Данные полей хранятся в колонке типа JSONB, ключи соответствуют `slug`-идентификаторам полей.

**RBAC (Role-Based Access Control)** предоставляет гибкую систему прав. В каждой компании есть системные роли (`owner`, `admin`, `manager`, `employee`) и произвольные пользовательские. Набор разрешений пользователя кэшируется в Redis: при изменении роли кэш инвалидируется, при следующем запросе перезагружается из БД.

**JWT-аутентификация** использует двухтокенную схему: короткоживущий access token (15 мин, хранится в памяти браузера) и долгоживущий refresh token (7 дней, HttpOnly cookie). Access token недоступен JavaScript с других доменов — XSS-атака не может его похитить. Refresh token автоматически подставляется браузером при обновлении.

**Управление сроком доступа** позволяет устанавливать дату истечения доступа для пользователей. По достижении даты аккаунт блокируется автоматически — удобно для временных сотрудников или подрядчиков.

**Telegram-уведомления** доставляются через связку Redis pub/sub + aiogram 3. Backend публикует события в Redis-канал; бот подписан на него и немедленно отправляет сообщения пользователям. Привязка Telegram-аккаунта выполняется командой `/connect TOKEN` прямо в боте.

---

## Скриншоты / Возможности

- 🏢 **Мультитенантность** — полная изоляция данных компаний на уровне строк БД, без отдельных схем или баз
- 🔐 **RBAC** — гибкая система ролей и разрешений с кэшированием в Redis; системные и пользовательские роли
- 🔑 **JWT двухтокенная схема** — access token в памяти + refresh token в HttpOnly cookie, автообновление прозрачно для пользователя
- 🏗️ **Конструктор сущностей** — создавайте любые типы объектов с произвольными полями прямо в интерфейсе, без изменения схемы БД
- 📋 **Записи сущностей** — JSONB-хранилище с типизацией, поиском и фильтрацией по полям
- ⏰ **Управление сроком доступа** — ограничение доступа пользователей по дате, автоматическая блокировка
- 🤖 **Telegram-бот** — уведомления в реальном времени через Redis pub/sub; привязка аккаунта по токену
- 👑 **Суперадминистратор** — управление всеми компаниями и пользователями с единого аккаунта
- 📖 **Swagger / ReDoc** — автогенерируемая интерактивная документация API
- 🐳 **Docker-ready** — полная контейнеризация для dev и prod окружений; один `docker compose up` запускает всё
- ♻️ **Hot-reload** — мгновенное применение изменений кода в dev-режиме (uvicorn `--reload` + Vite HMR)
- 🔒 **HTTPS в prod** — nginx проксирует трафик, управляет SSL-сертификатами и отдаёт статику

---

## Технологии

| Backend | Frontend | Инфраструктура |
|---------|----------|----------------|
| Python 3.11 | React 18 | Docker & Docker Compose |
| FastAPI | TypeScript | PostgreSQL 16 (asyncpg) |
| SQLAlchemy 2 (async) | Vite 5 | Redis 7 |
| Alembic | Tailwind CSS | Nginx 1.25 |
| Pydantic v2 | Zustand | aiogram 3 (Telegram) |
| pydantic-settings | React Router v6 | |
| python-jose (JWT) | Axios | |
| passlib / bcrypt | React Hook Form + Zod | |

---

## Быстрый старт

### Предварительные требования

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2 (`docker compose` без дефиса)
- Git

### Запуск за три команды

```bash
# 1. Клонировать репозиторий
git clone <repository-url> crm
cd crm

# 2. Запустить dev-стек
#    (postgres + redis + backend + frontend + bot, с hot-reload)
docker compose -f docker-compose.dev.yml up --build
```

Первый запуск занимает 2–3 минуты: Docker собирает образы, pip устанавливает зависимости, Alembic применяет миграции, создаётся аккаунт суперадминистратора. Дальнейшие запуски без `--build` стартуют за секунды.

После запуска:

| Сервис | URL |
|--------|-----|
| Frontend (React + Vite) | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/api/docs |
| ReDoc | http://localhost:8000/api/redoc |

**Первый вход:**
- Email: `admin@crm.local`
- Пароль: `Admin123!`

> Аккаунт суперадминистратора и системные разрешения создаются автоматически при первом запуске — никаких дополнительных шагов не требуется.

---

## Архитектура

### Мультитенантность (row-level isolation)

Каждая таблица с пользовательскими данными (`entities`, `entity_records`, `users`, `roles`, и т.д.) содержит внешний ключ `company_id`. Все репозитории принимают `company_id` обязательным параметром и добавляют его в `WHERE`-условие каждого запроса. `company_id` извлекается из JWT payload в middleware и прикрепляется к объекту запроса — слои выше репозитория не могут случайно обратиться к данным другого тенанта.

```
HTTP Request
    └── AuthMiddleware  →  JWT decode  →  user.company_id прикреплён к request
         └── Router     →  Dependency  →  company_id передан в Repository
              └── Repository   →  SELECT ... WHERE company_id = :cid
```

### JWT-стратегия

```
Клиент (браузер)              Сервер (FastAPI)
       │                              │
       │── POST /api/v1/auth/login ──>│
       │<── access_token (JSON body) ─│  хранится в памяти (Zustand)
       │<── refresh_token (cookie) ───│  HttpOnly; Secure; SameSite=Lax
       │                              │
       │── GET /api/v1/... + Bearer──>│  обычный запрос с access token
       │                              │
       │  (access token истёк)        │
       │── POST /api/v1/auth/refresh ─│  cookie подставляется браузером автоматически
       │<── новый access_token ───────│
```

Access token живёт только в JavaScript-памяти (`useState`/Zustand store) — его нельзя прочитать через `document.cookie` или `localStorage`, что защищает от XSS. Refresh token в HttpOnly cookie недоступен JavaScript в принципе.

### RBAC

Права (permissions) описаны строками-кодами (например, `users.create`, `entities.delete`). Роли связаны с правами через таблицу `role_permissions`. При каждом защищённом запросе система:

1. Проверяет Redis-кэш по ключу `permissions:{user_id}`.
2. При промахе — загружает права из БД, сохраняет в Redis.
3. При изменении роли — инвалидирует кэш.

Суперадмин (`is_superadmin=True`) не ограничен разрешениями и имеет полный доступ ко всем компаниям.

### Конструктор сущностей

```
Entity (тип объекта, напр. «Клиенты»)
  └── EntityField[]  (описание структуры)
        ├── name, slug, field_type
        ├── is_required, is_searchable, position
        └── config: JSONB  ← для select: {"options": [...]}, для number: {"min":0,"max":9999}

EntityRecord (конкретная запись, напр. «ООО Рога и Копыта»)
  └── data: JSONB  { "field_slug": значение, ... }
```

Структура хранится в реляционных таблицах, данные — в JSONB. Это позволяет компаниям менять схему на лету без миграций. Типовой запрос на создание сущности:

```json
POST /api/v1/entities
{
  "name": "Клиенты",
  "slug": "clients",
  "fields": [
    {"name": "Имя",    "slug": "name",  "field_type": "text",   "is_required": true},
    {"name": "Email",  "slug": "email", "field_type": "email",  "is_required": true},
    {"name": "Статус", "slug": "status","field_type": "select", "config": {"options": [{"value":"new","label":"Новый"}]}}
  ]
}
```

### Telegram-уведомления

```
Backend (событие)
    └── Redis PUBLISH  crm:notifications:{company_id}
         └── Bot (SUBSCRIBE, aiogram)
              └── Telegram Bot API → пользователь
```

---

## API документация

FastAPI автоматически генерирует интерактивную документацию на основе аннотаций типов и Pydantic-схем:

- **Swagger UI**: http://localhost:8000/api/docs — тестирование эндпоинтов прямо в браузере
- **ReDoc**: http://localhost:8000/api/redoc — удобное чтение и навигация по документации

Эндпоинты сгруппированы по тегам:

| Тег | Описание |
|-----|----------|
| `auth` | Логин, логаут, обновление токена, профиль |
| `companies` | Управление компаниями (суперадмин) |
| `users` | Пользователи компании |
| `roles` | Роли и разрешения |
| `entities` | Конструктор сущностей |
| `entity-records` | Записи сущностей |
| `telegram` | Привязка Telegram, статус |
| `access-expiration` | Управление сроком доступа |

Для тестирования защищённых эндпоинтов через Swagger UI:
1. Выполните `POST /api/v1/auth/login` с телом `{"email": "...", "password": "..."}`.
2. Скопируйте `access_token` из ответа.
3. Нажмите кнопку **Authorize** и введите токен в поле `Bearer`.

---

## Переменные окружения

В dev-режиме все переменные уже заданы непосредственно в `docker-compose.dev.yml` — отдельный `.env` файл **не требуется**. Для production создайте `.env.prod` (см. [SETUP.md](SETUP.md)).

| Переменная | Dev-значение | Описание |
|---|---|---|
| `SECRET_KEY` | `dev-secret-key-...` | Ключ подписи JWT. **Обязательно** сменить в prod (мин. 32 символа) |
| `ALGORITHM` | `HS256` | Алгоритм подписи JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Время жизни access token (минуты) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Время жизни refresh token (дни) |
| `DATABASE_URL` | `postgresql+asyncpg://crm:crm_secret@postgres:5432/crm_db` | URL подключения к PostgreSQL (asyncpg driver) |
| `REDIS_URL` | `redis://redis:6379/0` | URL подключения к Redis |
| `BOT_TOKEN` | *(dev token)* | Токен Telegram-бота от @BotFather |
| `INTERNAL_BOT_TOKEN` | `crm-dev-internal-...` | Секрет для внутренних вызовов бота → backend. **Сменить в prod** |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | JSON-массив разрешённых origins (браузерных) |
| `SUPERADMIN_EMAIL` | `admin@crm.local` | Email суперадминистратора (создаётся при первом старте) |
| `SUPERADMIN_PASSWORD` | `Admin123!` | Пароль суперадминистратора. **Сменить в prod** |
| `ENVIRONMENT` | `development` | Режим: `development` или `production` |
| `WEBHOOK_URL` | *(пусто)* | URL вебхука Telegram (только для prod, если используется webhook-режим) |
| `POSTGRES_PASSWORD` | `crm_secret` | Пароль PostgreSQL (**обязателен и уникален в prod**) |
| `REDIS_PASSWORD` | *(пусто)* | Пароль Redis (рекомендуется в prod) |

> **Типичная ошибка:** не устанавливайте `VITE_API_URL` ни в dev, ни в prod окружении. В обоих случаях маршрутизация `/api`-запросов выполняется прокси (Vite dev server в dev, nginx в prod). Если задать `VITE_API_URL`, фронтенд начнёт использовать абсолютные URL, которые обходят прокси и вызывают CORS-ошибки.

---

## Разработка без Docker

Подробная пошаговая инструкция — в файле [SETUP.md](SETUP.md#ручная-установка-без-docker).

Краткий план:

```bash
# PostgreSQL и Redis должны быть запущены локально

# --- Backend ---
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# Создайте .env с DATABASE_URL, REDIS_URL, SECRET_KEY (см. config.py для всех переменных)
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# --- Frontend (в отдельном терминале) ---
cd frontend
npm install
npm run dev
# Откроется на http://localhost:5173
# Прокси /api -> http://localhost:8000 настроен в vite.config.ts автоматически

# --- Bot (опционально) ---
cd bot
pip install -r requirements.txt
# Задайте BOT_TOKEN, REDIS_URL, BACKEND_INTERNAL_URL, INTERNAL_BOT_TOKEN в .env
python -m bot.main
```

---

## Структура проекта

```
crm/
├── backend/                    # FastAPI приложение
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/             # Эндпоинты: auth, users, roles, entities, ...
│   │   ├── core/               # security.py, dependencies.py, exceptions.py
│   │   ├── models/             # SQLAlchemy ORM-модели
│   │   ├── repositories/       # Слой доступа к данным (tenant-scoped)
│   │   ├── schemas/            # Pydantic v2 схемы (request/response)
│   │   ├── services/           # Бизнес-логика
│   │   ├── tasks/              # Фоновые задачи (проверка сроков доступа)
│   │   ├── config.py           # Настройки через pydantic-settings
│   │   └── main.py             # Точка входа FastAPI
│   ├── alembic/                # Миграции БД
│   ├── entrypoint.sh           # Старт: alembic upgrade head + uvicorn
│   └── requirements.txt
├── frontend/                   # React + TypeScript приложение
│   └── src/
│       ├── api/                # Axios-клиенты для каждого ресурса
│       ├── pages/              # Страницы: auth, dashboard, entities, users, ...
│       ├── components/         # Переиспользуемые UI-компоненты
│       ├── layouts/            # Layout-компоненты (AuthLayout, AppLayout)
│       ├── store/              # Zustand стор (auth, permissions)
│       ├── hooks/              # React Query хуки
│       └── router/             # React Router конфигурация
├── bot/                        # Telegram-бот (aiogram 3)
├── nginx/
│   └── nginx.prod.conf         # Конфигурация nginx для prod
├── docker-compose.dev.yml      # Dev-окружение (с hot-reload)
├── docker-compose.prod.yml     # Prod-окружение (nginx, без source mounts)
└── SETUP.md                    # Подробная инструкция по установке
```

---

## Автор

Дипломная работа по специальности «Разработка программного обеспечения».

Проект демонстрирует построение production-ready мультитенантного SaaS-приложения с использованием современного стека: FastAPI, React 18, PostgreSQL, Redis, Docker, Telegram Bot API.
