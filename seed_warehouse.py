#!/usr/bin/env python3
"""
Seed-скрипт: складской учёт — полное наполнение CRM демо-данными.

Создаёт:
  • 1 компанию + администратор
  • 5 ролей с правами
  • 5 сотрудников
  • 6 сущностей (все типы полей): Склады, Товары, Поставщики, Клиенты,
    Заказы на закупку, Заказы на отгрузку
  • Тестовые записи в каждой сущности

Usage:
  python seed_warehouse.py --url https://your-domain.com
  python seed_warehouse.py --url https://crm.llve.ru --email admin@warehouse.example --password Admin1234!
"""

import argparse
import sys
import requests


# ─── Вывод ───────────────────────────────────────────────────────────────────

def ok(msg):     print(f"  ✓ {msg}")
def warn(msg):   print(f"  ! {msg}")
def header(msg): print(f"\n{'='*56}\n  {msg}\n{'='*56}")
def fatal(msg, resp=None):
    print(f"\n  ОШИБКА: {msg}")
    if resp is not None:
        print(f"    {resp.status_code}: {resp.text[:500]}")
    sys.exit(1)


# ─── API-клиент ───────────────────────────────────────────────────────────────

class CRM:
    def __init__(self, base_url):
        self.base = base_url.rstrip("/")
        self.s = requests.Session()
        self.token = None

    def _h(self):
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def post(self, path, body=None):
        return self.s.post(f"{self.base}/api/v1{path}", json=body, headers=self._h())

    def get(self, path, **params):
        return self.s.get(f"{self.base}/api/v1{path}", params=params, headers=self._h())

    def put(self, path, body=None):
        return self.s.put(f"{self.base}/api/v1{path}", json=body, headers=self._h())

    def login(self, email, password):
        r = self.post("/auth/login", {"email": email, "password": password})
        if r.status_code == 200:
            self.token = r.json()["access_token"]
        return r


# ─── main ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url",      required=True,                   help="https://your-domain.com")
    ap.add_argument("--email",    default="admin@warehouse.example", help="Email администратора")
    ap.add_argument("--password", default="Warehouse1!",            help="Пароль администратора")
    args = ap.parse_args()

    crm = CRM(args.url)

    # ── 1. Регистрация / вход ────────────────────────────────────────────────
    header("1. Регистрация компании")

    r = crm.post("/auth/register", {
        "company_name":        "Главный склад ООО",
        "company_slug":        "main-warehouse",
        "company_description": "Система учёта склада и логистики",
        "first_name":          "Администратор",
        "last_name":           "Системы",
        "email":               args.email,
        "password":            args.password,
    })
    if r.status_code in (200, 201):
        crm.token = r.json()["access_token"]
        ok(f"Компания создана, вошли как {args.email}")
    elif r.status_code == 409:
        warn("Компания уже существует — выполняем вход...")
        r = crm.login(args.email, args.password)
        if r.status_code != 200:
            fatal("Не удалось войти", r)
        ok(f"Вход выполнен: {args.email}")
    else:
        fatal("Ошибка регистрации", r)

    # ── 2. Роли ──────────────────────────────────────────────────────────────
    header("2. Роли и права")

    r = crm.get("/roles/permissions")
    if r.status_code != 200:
        fatal("Не удалось получить список прав", r)
    perms = {p["code"]: p["id"] for p in r.json()}
    ok(f"Найдено прав: {len(perms)} — {', '.join(sorted(perms))}")

    def perm_ids(*codes):
        return [perms[c] for c in codes if c in perms]

    roles_spec = [
        ("Директор склада",       "Полный доступ ко всем функциям",                     perm_ids(*perms)),
        ("Кладовщик",             "Учёт товаров, движение, инвентаризация",             perm_ids("read", "create", "update")),
        ("Менеджер по закупкам",  "Работа с поставщиками и заказами на закупку",        perm_ids("read", "create", "update")),
        ("Менеджер по продажам",  "Работа с клиентами и заказами на отгрузку",          perm_ids("read", "create", "update")),
        ("Аудитор",               "Просмотр данных без возможности изменений",           perm_ids("read")),
    ]

    role_ids = {}
    for name, desc, pid_list in roles_spec:
        r = crm.post("/roles", {"name": name, "description": desc})
        if r.status_code == 201:
            rid = r.json()["id"]
            rp = crm.put(f"/roles/{rid}/permissions", {"permission_ids": pid_list})
            role_ids[name] = rid
            ok(f"Роль '{name}' — {len(pid_list)} прав")
        elif r.status_code == 409:
            warn(f"Роль '{name}' уже существует")
        else:
            warn(f"Роль '{name}': {r.text[:120]}")

    # ── 3. Сотрудники ────────────────────────────────────────────────────────
    header("3. Сотрудники")

    pwd = "Warehouse1!"
    employees = [
        ("Санжар",  "Ахмедов",  "sanzhar@warehouse.example",  "Директор склада"),
        ("Бобур",   "Тохиров",  "bobur@warehouse.example",    "Кладовщик"),
        ("Нилуфар", "Юсупова",  "nilufar@warehouse.example",  "Менеджер по закупкам"),
        ("Отабек",  "Рахимов",  "otabek@warehouse.example",   "Менеджер по продажам"),
        ("Дилноза", "Каримова", "dilnoza@warehouse.example",  "Аудитор"),
    ]
    for fn, ln, email, role in employees:
        r = crm.post("/users", {"email": email, "password": pwd,
                                "first_name": fn, "last_name": ln})
        if r.status_code == 201:
            uid = r.json()["id"]
            rid = role_ids.get(role)
            if rid:
                crm.post(f"/users/{uid}/roles", {"role_id": rid})
            ok(f"{fn} {ln} ({role})")
        elif r.status_code == 409:
            warn(f"{fn} {ln} уже существует")
        else:
            warn(f"{fn} {ln}: {r.text[:120]}")

    # ── 4. Сущности ──────────────────────────────────────────────────────────
    header("4. Сущности")

    eids = {}

    def entity(slug, name, icon, color, desc, fields):
        r = crm.post("/entities", {
            "slug": slug, "name": name, "icon": icon,
            "color": color, "description": desc, "fields": fields,
        })
        if r.status_code == 201:
            eids[slug] = r.json()["id"]
            ok(f"'{name}' — {len(fields)} полей")
        elif r.status_code == 409:
            warn(f"'{name}' уже существует, получаем ID...")
            rg = crm.get("/entities")
            if rg.status_code == 200:
                for e in rg.json():
                    if e["slug"] == slug:
                        eids[slug] = e["id"]
                        return
        else:
            warn(f"'{name}': {r.text[:200]}")

    # 4.1 Склады
    entity("warehouses", "Склады", "🏭", "#6366F1",
           "Справочник складских помещений", [
        {"name": "Название",      "slug": "name",    "field_type": "text",    "is_required": True,  "is_searchable": True,  "position": 0},
        {"name": "Адрес",         "slug": "address", "field_type": "text",    "is_required": False, "is_searchable": True,  "position": 1},
        {"name": "Ответственный", "slug": "manager", "field_type": "text",    "is_required": False, "is_searchable": True,  "position": 2},
        {"name": "Телефон",       "slug": "phone",   "field_type": "phone",   "is_required": False, "is_searchable": False, "position": 3},
        {"name": "Площадь, м²",   "slug": "area",    "field_type": "number",  "is_required": False, "is_searchable": False, "position": 4, "config": {"min": 0}},
        {"name": "Активен",       "slug": "active",  "field_type": "boolean", "is_required": False, "is_searchable": False, "position": 5},
    ])

    # 4.2 Товары (все типы полей)
    entity("products", "Товары", "📦", "#10B981",
           "Номенклатура товаров и материалов", [
        {"name": "Название",       "slug": "name",      "field_type": "text",               "is_required": True,  "is_searchable": True,  "position": 0},
        {"name": "Артикул",        "slug": "article",   "field_type": "autoincrement",       "is_required": False, "is_searchable": True,  "position": 1, "config": {"prefix": "T-", "padding": 5, "next_value": 1}},
        {"name": "Штрихкод",       "slug": "barcode",   "field_type": "barcode",             "is_required": False, "is_searchable": True,  "position": 2},
        {"name": "Категория",      "slug": "category",  "field_type": "select",              "is_required": False, "is_searchable": False, "position": 3, "config": {"options": [
            {"value": "electronics",  "label": "Электроника"},
            {"value": "construction", "label": "Стройматериалы"},
            {"value": "food",         "label": "Продукты питания"},
            {"value": "tools",        "label": "Инструменты"},
            {"value": "office",       "label": "Офисные товары"},
            {"value": "clothing",     "label": "Одежда и ткани"},
            {"value": "other",        "label": "Прочее"},
        ]}},
        {"name": "Количество",     "slug": "quantity",  "field_type": "quantity_unit",       "is_required": False, "is_searchable": False, "position": 4, "config": {"units": ["шт", "кг", "л", "м", "м²", "упак", "рул"], "default_unit": "шт"}},
        {"name": "Цена закупки",   "slug": "price_in",  "field_type": "price",               "is_required": False, "is_searchable": False, "position": 5, "config": {"currency": "UZS", "symbol": "сум"}},
        {"name": "Цена продажи",   "slug": "price_out", "field_type": "price",               "is_required": False, "is_searchable": False, "position": 6, "config": {"currency": "UZS", "symbol": "сум"}},
        {"name": "Мин. остаток",   "slug": "min_stock", "field_type": "number",              "is_required": False, "is_searchable": False, "position": 7, "config": {"min": 0}},
        {"name": "Место хранения", "slug": "location",  "field_type": "warehouse_location",  "is_required": False, "is_searchable": True,  "position": 8, "config": {"placeholder": "А-01-1"}},
        {"name": "Срок годности",  "slug": "expiry",    "field_type": "expiry_date",         "is_required": False, "is_searchable": False, "position": 9, "config": {"warn_days": 30}},
        {"name": "Активен",        "slug": "active",    "field_type": "boolean",             "is_required": False, "is_searchable": False, "position": 10},
        {"name": "Фото",           "slug": "photo",     "field_type": "image",               "is_required": False, "is_searchable": False, "position": 11},
        {"name": "Статус",         "slug": "status",    "field_type": "status",              "is_required": False, "is_searchable": False, "position": 12, "config": {"options": [
            {"value": "in_stock",  "label": "В наличии",     "color": "#10B981"},
            {"value": "low_stock", "label": "Заканчивается", "color": "#F59E0B"},
            {"value": "out_stock", "label": "Нет в наличии", "color": "#EF4444"},
            {"value": "on_order",  "label": "На заказ",      "color": "#6366F1"},
        ]}},
    ])

    # 4.3 Поставщики
    entity("suppliers", "Поставщики", "🚚", "#F59E0B",
           "Справочник поставщиков товаров и услуг", [
        {"name": "Название",             "slug": "name",     "field_type": "text",   "is_required": True,  "is_searchable": True,  "position": 0},
        {"name": "Контактное лицо",       "slug": "contact",  "field_type": "text",   "is_required": False, "is_searchable": True,  "position": 1},
        {"name": "Телефон",              "slug": "phone",    "field_type": "phone",  "is_required": False, "is_searchable": False, "position": 2},
        {"name": "Email",                "slug": "email",    "field_type": "email",  "is_required": False, "is_searchable": True,  "position": 3},
        {"name": "Сайт",                 "slug": "website",  "field_type": "url",    "is_required": False, "is_searchable": False, "position": 4},
        {"name": "ИНН / ОГРН",           "slug": "inn",      "field_type": "text",   "is_required": False, "is_searchable": True,  "position": 5},
        {"name": "Адрес",                "slug": "address",  "field_type": "text",   "is_required": False, "is_searchable": False, "position": 6},
        {"name": "Статус",               "slug": "status",   "field_type": "status", "is_required": False, "is_searchable": False, "position": 7, "config": {"options": [
            {"value": "active",   "label": "Активен",      "color": "#10B981"},
            {"value": "new",      "label": "Новый",        "color": "#6366F1"},
            {"value": "inactive", "label": "Неактивен",    "color": "#94A3B8"},
            {"value": "blocked",  "label": "Заблокирован", "color": "#EF4444"},
        ]}},
        {"name": "Рейтинг (1–5)",        "slug": "rating",   "field_type": "number", "is_required": False, "is_searchable": False, "position": 8, "config": {"min": 1, "max": 5}},
        {"name": "Договор",              "slug": "contract", "field_type": "file",   "is_required": False, "is_searchable": False, "position": 9},
        {"name": "Начало сотрудничества","slug": "since",    "field_type": "date",   "is_required": False, "is_searchable": False, "position": 10},
    ])

    # 4.4 Клиенты
    entity("customers", "Клиенты", "🤝", "#8B5CF6",
           "База клиентов и покупателей", [
        {"name": "Название / ФИО",  "slug": "name",         "field_type": "text",   "is_required": True,  "is_searchable": True,  "position": 0},
        {"name": "Контактное лицо", "slug": "contact",      "field_type": "text",   "is_required": False, "is_searchable": True,  "position": 1},
        {"name": "Телефон",         "slug": "phone",        "field_type": "phone",  "is_required": False, "is_searchable": False, "position": 2},
        {"name": "Email",           "slug": "email",        "field_type": "email",  "is_required": False, "is_searchable": True,  "position": 3},
        {"name": "ИНН",             "slug": "inn",          "field_type": "text",   "is_required": False, "is_searchable": True,  "position": 4},
        {"name": "Адрес доставки",  "slug": "address",      "field_type": "text",   "is_required": False, "is_searchable": False, "position": 5},
        {"name": "Кредитный лимит", "slug": "credit_limit", "field_type": "price",  "is_required": False, "is_searchable": False, "position": 6, "config": {"currency": "UZS", "symbol": "сум"}},
        {"name": "Статус",          "slug": "status",       "field_type": "status", "is_required": False, "is_searchable": False, "position": 7, "config": {"options": [
            {"value": "active",  "label": "Активен",      "color": "#10B981"},
            {"value": "new",     "label": "Новый",        "color": "#6366F1"},
            {"value": "vip",     "label": "VIP",          "color": "#F59E0B"},
            {"value": "blocked", "label": "Заблокирован", "color": "#EF4444"},
        ]}},
        {"name": "Дата регистрации","slug": "registered",   "field_type": "date",   "is_required": False, "is_searchable": False, "position": 8},
    ])

    # 4.5 Заказы на закупку (relation → Поставщики)
    entity("purchase-orders", "Заказы на закупку", "📥", "#EC4899",
           "Заказы поставщикам на поставку товаров", [
        {"name": "Номер",              "slug": "number",        "field_type": "autoincrement", "is_required": False, "is_searchable": True,  "position": 0, "config": {"prefix": "ЗАК-", "padding": 5, "next_value": 1}},
        {"name": "Поставщик",          "slug": "supplier",      "field_type": "relation",      "is_required": False, "is_searchable": False, "position": 1, "config": {"entity_id": eids.get("suppliers"), "display_field": "name"}},
        {"name": "Дата заказа",        "slug": "order_date",    "field_type": "date",          "is_required": False, "is_searchable": False, "position": 2},
        {"name": "Ожидаемая доставка", "slug": "delivery_date", "field_type": "date",          "is_required": False, "is_searchable": False, "position": 3},
        {"name": "Сумма заказа",       "slug": "amount",        "field_type": "price",         "is_required": False, "is_searchable": False, "position": 4, "config": {"currency": "UZS", "symbol": "сум"}},
        {"name": "Статус",             "slug": "status",        "field_type": "status",        "is_required": False, "is_searchable": False, "position": 5, "config": {"options": [
            {"value": "draft",     "label": "Черновик",     "color": "#94A3B8"},
            {"value": "sent",      "label": "Отправлен",    "color": "#6366F1"},
            {"value": "confirmed", "label": "Подтверждён",  "color": "#F59E0B"},
            {"value": "delivered", "label": "Доставлен",    "color": "#10B981"},
            {"value": "cancelled", "label": "Отменён",      "color": "#EF4444"},
        ]}},
        {"name": "Примечания",         "slug": "notes",         "field_type": "text",          "is_required": False, "is_searchable": False, "position": 6},
        {"name": "Документ",           "slug": "document",      "field_type": "file",          "is_required": False, "is_searchable": False, "position": 7},
    ])

    # 4.6 Заказы на отгрузку (relation → Клиенты, formula)
    entity("sales-orders", "Заказы на отгрузку", "📤", "#14B8A6",
           "Заказы клиентов на отгрузку товаров", [
        {"name": "Номер",            "slug": "number",     "field_type": "autoincrement", "is_required": False, "is_searchable": True,  "position": 0, "config": {"prefix": "ОТГ-", "padding": 5, "next_value": 1}},
        {"name": "Клиент",           "slug": "customer",   "field_type": "relation",      "is_required": False, "is_searchable": False, "position": 1, "config": {"entity_id": eids.get("customers"), "display_field": "name"}},
        {"name": "Дата заказа",      "slug": "order_date", "field_type": "date",          "is_required": False, "is_searchable": False, "position": 2},
        {"name": "Дата отгрузки",    "slug": "ship_date",  "field_type": "date",          "is_required": False, "is_searchable": False, "position": 3},
        {"name": "Сумма",            "slug": "amount",     "field_type": "price",         "is_required": False, "is_searchable": False, "position": 4, "config": {"currency": "UZS", "symbol": "сум"}},
        {"name": "Скидка %",         "slug": "discount",   "field_type": "number",        "is_required": False, "is_searchable": False, "position": 5, "config": {"min": 0, "max": 100}},
        {"name": "Итого со скидкой", "slug": "total",      "field_type": "formula",       "is_required": False, "is_searchable": False, "position": 6, "config": {"formula": "amount * (1 - discount / 100)"}},
        {"name": "Статус",           "slug": "status",     "field_type": "status",        "is_required": False, "is_searchable": False, "position": 7, "config": {"options": [
            {"value": "new",        "label": "Новый",            "color": "#6366F1"},
            {"value": "processing", "label": "В обработке",      "color": "#F59E0B"},
            {"value": "ready",      "label": "Готов к отгрузке", "color": "#14B8A6"},
            {"value": "shipped",    "label": "Отгружен",         "color": "#10B981"},
            {"value": "cancelled",  "label": "Отменён",          "color": "#EF4444"},
        ]}},
        {"name": "Примечания",       "slug": "notes",      "field_type": "text",          "is_required": False, "is_searchable": False, "position": 8},
    ])

    # ── 5. Записи ─────────────────────────────────────────────────────────────
    header("5. Тестовые записи")

    def rec(slug, data):
        eid = eids.get(slug)
        if not eid:
            warn(f"Сущность '{slug}' не найдена")
            return None
        r = crm.post(f"/entities/{eid}/records", {"data": data})
        if r.status_code == 201:
            return r.json()["id"]
        warn(f"Запись в '{slug}': {r.text[:200]}")
        return None

    # Склады
    print("  Склады...")
    rec("warehouses", {"name": "Главный склад",   "address": "г. Ташкент, ул. Промышленная, 15",   "manager": "Тохиров Бобур",  "phone": "+998712345678", "area": 1200, "active": True})
    rec("warehouses", {"name": "Склад № 2",       "address": "г. Самарканд, ул. Навои, 7",          "manager": "Юсупов Азиз",    "phone": "+998662345678", "area": 850,  "active": True})
    rec("warehouses", {"name": "Склад запчастей", "address": "г. Ташкент, ул. Паркентская, 42",     "manager": "Расулов Ш.Б.",   "phone": "+998713456789", "area": 320,  "active": False})
    ok("3 склада")

    # Поставщики
    print("  Поставщики...")
    sup1 = rec("suppliers", {"name": "ООО «ТехноИмпорт»",  "contact": "Ким Александр",   "phone": "+998712001122", "email": "info@technoimport.uz",   "website": "https://technoimport.uz",  "inn": "302456789", "address": "г. Ташкент, ул. Мирзо Улугбека, 88",   "status": "active",   "rating": 5, "since": "2021-03-15"})
    sup2 = rec("suppliers", {"name": "ИП Акбаров А.А.",    "contact": "Акбаров Акбар",   "phone": "+998903334455", "email": "akbarov@example.com",    "website": "https://stroy-market.uz", "inn": "405123456", "address": "г. Самарканд, пр. Ипподромный, 12",    "status": "active",   "rating": 4, "since": "2022-07-01"})
    sup3 = rec("suppliers", {"name": "ООО «ФудТрейд»",     "contact": "Нурматов Шохрух", "phone": "+998712556677", "email": "sales@foodtrade.uz",     "website": "https://foodtrade.uz",    "inn": "301789012", "address": "г. Ташкент, ул. Шота Руставели, 5",    "status": "active",   "rating": 4, "since": "2020-11-20"})
    sup4 = rec("suppliers", {"name": "ЧП «КанцОфис»",      "contact": "Хасанов Умид",    "phone": "+998936667788", "email": "info@kancofis.uz",        "website": "",                         "inn": "403456123", "address": "г. Ташкент, ул. Бунёдкор, 77",         "status": "new",      "rating": 3, "since": "2024-01-10"})
    ok(f"4 поставщика")

    # Клиенты
    print("  Клиенты...")
    cus1 = rec("customers", {"name": "ООО «РитейлПлюс»",    "contact": "Смирнов Игорь",   "phone": "+998712109988", "email": "igors@retailplus.uz",   "inn": "304567890", "address": "г. Ташкент, пр. Амира Темура, 105", "credit_limit": 50000000, "status": "vip",    "registered": "2020-05-12"})
    cus2 = rec("customers", {"name": "ИП Хасанов Б.К.",      "contact": "Хасанов Бахром",  "phone": "+998907778899", "email": "bakhrom@example.com",   "inn": "406789012", "address": "г. Фергана, ул. Мустақиллик, 33",  "credit_limit": 10000000, "status": "active", "registered": "2022-02-28"})
    cus3 = rec("customers", {"name": "ООО «СтройМаркет»",    "contact": "Ким Дмитрий",     "phone": "+998712334455", "email": "d.kim@stroymarket.uz",  "inn": "302112233", "address": "г. Ташкент, ул. Сергели, 18",      "credit_limit": 30000000, "status": "active", "registered": "2021-09-05"})
    cus4 = rec("customers", {"name": "ИП Рустамова Малика",   "contact": "Рустамова Малика","phone": "+998994455667", "email": "malika.r@example.com",  "inn": "407123456", "address": "г. Наманган, ул. Янги Намangan, 7","credit_limit": 5000000,  "status": "new",    "registered": "2024-03-01"})
    ok("4 клиента")

    # Товары
    print("  Товары...")
    items = [
        {"name": "Ноутбук HP 250 G9",          "barcode": "4065510476461", "category": "electronics",  "quantity": {"value": 12,  "unit": "шт"},  "price_in": 6500000,  "price_out": 8200000,  "min_stock": 3,   "location": "А-01-1", "active": True,  "status": "in_stock"},
        {"name": "Кабель USB-C 1м",             "barcode": "0603012735024", "category": "electronics",  "quantity": {"value": 150, "unit": "шт"},  "price_in": 35000,    "price_out": 65000,    "min_stock": 20,  "location": "А-01-4", "active": True,  "status": "in_stock"},
        {"name": "Монитор LG 24MK430H",         "barcode": "8806098686390", "category": "electronics",  "quantity": {"value": 5,   "unit": "шт"},  "price_in": 2800000,  "price_out": 3500000,  "min_stock": 2,   "location": "А-02-1", "active": True,  "status": "low_stock"},
        {"name": "Цемент М500, 25 кг",          "barcode": "4607048654321", "category": "construction", "quantity": {"value": 200, "unit": "упак"}, "price_in": 85000,    "price_out": 105000,   "min_stock": 50,  "location": "Б-03-1", "active": True,  "status": "in_stock"},
        {"name": "Кирпич строительный М150",    "barcode": "4607048612345", "category": "construction", "quantity": {"value": 480, "unit": "шт"},  "price_in": 600,      "price_out": 950,      "min_stock": 500, "location": "Б-03-5", "active": True,  "status": "low_stock"},
        {"name": "Кабель NYM 3×2.5 мм",        "barcode": "4607048643210", "category": "construction", "quantity": {"value": 150, "unit": "м"},   "price_in": 12500,    "price_out": 18000,    "min_stock": 50,  "location": "Б-04-1", "active": True,  "status": "in_stock"},
        {"name": "Сахар белый, 1 кг",           "barcode": "4605829012345", "category": "food",         "quantity": {"value": 80,  "unit": "кг"},  "price_in": 12000,    "price_out": 15500,    "min_stock": 50,  "location": "В-02-2", "active": True,  "status": "in_stock",  "expiry": "2025-12-31"},
        {"name": "Мука пшеничная высший сорт",  "barcode": "4605829054321", "category": "food",         "quantity": {"value": 0,   "unit": "кг"},  "price_in": 8500,     "price_out": 11000,    "min_stock": 100, "location": "В-02-3", "active": True,  "status": "out_stock", "expiry": "2025-06-30"},
        {"name": "Дрель Bosch GSB 13 RE",       "barcode": "3165140591645", "category": "tools",        "quantity": {"value": 7,   "unit": "шт"},  "price_in": 1200000,  "price_out": 1650000,  "min_stock": 2,   "location": "Г-01-2", "active": True,  "status": "in_stock"},
        {"name": "Перфоратор Makita HR2470",    "barcode": "0088381186070", "category": "tools",        "quantity": {"value": 4,   "unit": "шт"},  "price_in": 1850000,  "price_out": 2400000,  "min_stock": 2,   "location": "Г-01-3", "active": True,  "status": "in_stock"},
        {"name": "Бумага А4, 500 листов",       "barcode": "4607048698765", "category": "office",       "quantity": {"value": 45,  "unit": "упак"}, "price_in": 55000,    "price_out": 75000,    "min_stock": 10,  "location": "Д-01-1", "active": True,  "status": "in_stock"},
        {"name": "Ручка шариковая Pilot G2",    "barcode": "4902505086687", "category": "office",       "quantity": {"value": 320, "unit": "шт"},  "price_in": 3500,     "price_out": 6000,     "min_stock": 50,  "location": "Д-01-2", "active": True,  "status": "in_stock"},
    ]
    cnt = sum(1 for it in items if rec("products", it))
    ok(f"{cnt} из {len(items)} товаров")

    # Заказы на закупку
    print("  Заказы на закупку...")
    rec("purchase-orders", {"supplier": sup1, "order_date": "2026-04-15", "delivery_date": "2026-04-28", "amount": 45500000, "status": "delivered", "notes": "Ноутбуки и мониторы, партия Q2-2026"})
    rec("purchase-orders", {"supplier": sup2, "order_date": "2026-05-02", "delivery_date": "2026-05-12", "amount": 18700000, "status": "delivered", "notes": "Цемент М500 — 200 мешков, кирпич М150"})
    rec("purchase-orders", {"supplier": sup3, "order_date": "2026-05-10", "delivery_date": "2026-05-20", "amount": 9200000,  "status": "confirmed", "notes": "Продовольственные товары, партия май"})
    rec("purchase-orders", {"supplier": sup1, "order_date": "2026-05-18", "delivery_date": "2026-06-01", "amount": 32000000, "status": "sent",      "notes": "Перфораторы и дрели Bosch/Makita"})
    rec("purchase-orders", {"supplier": sup4, "order_date": "2026-05-22", "delivery_date": "2026-06-05", "amount": 3150000,  "status": "draft",     "notes": "Офисные принадлежности на квартал"})
    ok("5 заказов на закупку")

    # Заказы на отгрузку
    print("  Заказы на отгрузку...")
    rec("sales-orders", {"customer": cus1, "order_date": "2026-04-20", "ship_date": "2026-04-22", "amount": 32400000, "discount": 5,  "status": "shipped",    "notes": "Электроника для сети магазинов RetailPlus"})
    rec("sales-orders", {"customer": cus3, "order_date": "2026-05-03", "ship_date": "2026-05-05", "amount": 21000000, "discount": 0,  "status": "shipped",    "notes": "Стройматериалы для объекта № 12"})
    rec("sales-orders", {"customer": cus2, "order_date": "2026-05-14", "ship_date": "2026-05-17", "amount": 8800000,  "discount": 3,  "status": "ready",      "notes": "Инструменты и расходники"})
    rec("sales-orders", {"customer": cus1, "order_date": "2026-05-20", "ship_date": "2026-05-28", "amount": 15600000, "discount": 7,  "status": "processing", "notes": "Офисные товары и кабельная продукция"})
    rec("sales-orders", {"customer": cus4, "order_date": "2026-05-22", "ship_date": "2026-06-02", "amount": 4200000,  "discount": 0,  "status": "new",        "notes": "Первый заказ нового клиента"})
    ok("5 заказов на отгрузку")

    # ── Итог ─────────────────────────────────────────────────────────────────
    header("Готово!")
    print(f"""
  Учётные данные для входа
  ────────────────────────────────────────────────────────
  Администратор: {args.email}
  Пароль:        {args.password}

  Сотрудники (пароль для всех: {pwd})
  ────────────────────────────────────────────────────────
  Санжар Ахмедов     sanzhar@warehouse.example   Директор склада
  Бобур Тохиров      bobur@warehouse.example     Кладовщик
  Нилуфар Юсупова    nilufar@warehouse.example   Менеджер по закупкам
  Отабек Рахимов     otabek@warehouse.example    Менеджер по продажам
  Дилноза Каримова   dilnoza@warehouse.example   Аудитор

  Сущности: Склады · Товары · Поставщики · Клиенты ·
            Заказы на закупку · Заказы на отгрузку
""")


if __name__ == "__main__":
    main()
