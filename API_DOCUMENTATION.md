# API Documentation - Loyalty Application

## Обзор

Backend приложения лояльности с полным REST API для управления пользователями, баллами, наградами и акциями.

**База данных:** Supabase PostgreSQL
**API:** Supabase Edge Functions (TypeScript/Deno)
**Аутентификация:** JWT через Supabase Auth

---

## Структура базы данных

### Таблицы

1. **users** - Профили пользователей
2. **loyalty_levels** - Уровни лояльности (Bronze, Silver, Gold, Platinum)
3. **transactions** - История транзакций баллов
4. **rewards** - Доступные награды
5. **campaigns** - Маркетинговые акции
6. **user_rewards** - История полученных наград

### Уровни лояльности

| Уровень | Мин. баллы | Множитель |
|---------|-----------|-----------|
| Bronze | 0 | 1.0x |
| Silver | 1000 | 1.2x |
| Gold | 5000 | 1.5x |
| Platinum | 10000 | 2.0x |

---

## API Endpoints

### Базовый URL

```
https://xuvgvnkqxboozhleznps.supabase.co/functions/v1
```

### Аутентификация

Все запросы требуют JWT токен в заголовке:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 1. Users API

### Получить профиль пользователя

```http
GET /users-api
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "full_name": "Иван Иванов",
    "email": "ivan@example.com",
    "points": 1500,
    "loyalty_level_id": "uuid",
    "loyalty_levels": {
      "name": "Silver",
      "min_points": 1000,
      "bonus_multiplier": 1.20,
      "description": "Увеличенные бонусы на 20%"
    },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### Обновить профиль

```http
PUT /users-api
Content-Type: application/json

{
  "full_name": "Иван Петров"
}
```

### Регистрация профиля после создания auth пользователя

```http
POST /users-api/register
Content-Type: application/json

{
  "full_name": "Иван Иванов",
  "email": "ivan@example.com"
}
```

---

## 2. Transactions API

### Получить историю транзакций

```http
GET /transactions-api?limit=50&offset=0&type=earned
```

**Query Parameters:**
- `limit` (optional) - количество записей (default: 50)
- `offset` (optional) - смещение для пагинации (default: 0)
- `type` (optional) - фильтр по типу: `earned`, `spent`, `expired`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "type": "earned",
      "amount": 120,
      "description": "Покупка на сумму 100",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 150
}
```

### Начислить баллы (симуляция покупки)

```http
POST /transactions-api/earn
Content-Type: application/json

{
  "amount": 100,
  "description": "Покупка товаров"
}
```

**Response:**
```json
{
  "transaction": {
    "id": "uuid",
    "user_id": "uuid",
    "type": "earned",
    "amount": 120,
    "description": "Покупка на сумму 100",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "user": {
    "id": "uuid",
    "points": 1620
  }
}
```

> **Примечание:** Количество начисленных баллов зависит от уровня лояльности пользователя (множитель бонусов).

---

## 3. Rewards API

### Получить доступные награды

```http
GET /rewards-api
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Скидка 10%",
      "description": "Скидка 10% на следующую покупку",
      "points_cost": 500,
      "is_available": true,
      "stock": 100,
      "image_url": "https://example.com/image.jpg",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Обменять баллы на награду

```http
POST /rewards-api/redeem
Content-Type: application/json

{
  "reward_id": "uuid"
}
```

**Response:**
```json
{
  "userReward": {
    "id": "uuid",
    "user_id": "uuid",
    "reward_id": "uuid",
    "redeemed_at": "2024-01-01T00:00:00Z",
    "status": "pending"
  },
  "transaction": {
    "id": "uuid",
    "type": "spent",
    "amount": -500,
    "description": "Обмен на награду: Скидка 10%"
  },
  "user": {
    "points": 1120
  }
}
```

**Ошибки:**
- `400` - Недостаточно баллов / Награда недоступна / Награды нет в наличии
- `404` - Награда не найдена

### Получить мои награды

```http
GET /rewards-api/my-rewards
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "reward_id": "uuid",
      "redeemed_at": "2024-01-01T00:00:00Z",
      "status": "pending",
      "rewards": {
        "name": "Скидка 10%",
        "description": "Скидка 10% на следующую покупку",
        "points_cost": 500,
        "image_url": "https://example.com/image.jpg"
      }
    }
  ]
}
```

---

## 4. Campaigns API

### Получить активные акции

```http
GET /campaigns-api
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Новогодняя распродажа",
      "description": "Удвоенные баллы за все покупки",
      "start_date": "2024-12-20T00:00:00Z",
      "end_date": "2024-12-31T23:59:59Z",
      "is_active": true,
      "bonus_points": 100,
      "created_at": "2024-12-01T00:00:00Z"
    }
  ]
}
```

### Получить конкретную акцию

```http
GET /campaigns-api/{campaign_id}
```

---

## 5. Loyalty Levels API

### Получить все уровни лояльности

```http
GET /loyalty-levels-api
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Bronze",
      "min_points": 0,
      "bonus_multiplier": 1.00,
      "description": "Базовый уровень для новых пользователей",
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "name": "Silver",
      "min_points": 1000,
      "bonus_multiplier": 1.20,
      "description": "Увеличенные бонусы на 20%",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## Безопасность

### Row Level Security (RLS)

Все таблицы защищены RLS политиками:

- **users**: Пользователи могут видеть и редактировать только свой профиль
- **transactions**: Пользователи видят только свои транзакции
- **rewards**: Все пользователи видят доступные награды
- **campaigns**: Все пользователи видят активные акции
- **loyalty_levels**: Все пользователи видят уровни лояльности
- **user_rewards**: Пользователи видят только свои награды

### Аутентификация

1. Регистрация через Supabase Auth
2. Получение JWT токена
3. Создание профиля через `/users-api/register`
4. Использование токена во всех запросах

---

## Примеры использования

### JavaScript/TypeScript клиент

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xuvgvnkqxboozhleznps.supabase.co',
  'YOUR_ANON_KEY'
);

// Регистрация
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123'
});

// Создание профиля
const { data: session } = await supabase.auth.getSession();
const token = session.session?.access_token;

const response = await fetch(
  'https://xuvgvnkqxboozhleznps.supabase.co/functions/v1/users-api/register',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      full_name: 'Иван Иванов',
      email: 'user@example.com'
    })
  }
);

// Получить профиль
const profileResponse = await fetch(
  'https://xuvgvnkqxboozhleznps.supabase.co/functions/v1/users-api',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

// Начислить баллы
const earnResponse = await fetch(
  'https://xuvgvnkqxboozhleznps.supabase.co/functions/v1/transactions-api/earn',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: 100,
      description: 'Покупка товаров'
    })
  }
);
```

---

## Коды ответов

- `200` - Успешный запрос
- `201` - Ресурс создан
- `400` - Неверный запрос
- `401` - Не авторизован
- `404` - Ресурс не найден
- `500` - Внутренняя ошибка сервера
