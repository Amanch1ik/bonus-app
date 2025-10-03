# Loyalty App Backend

Полнофункциональный backend для приложения программы лояльности с базой данных PostgreSQL (Supabase) и REST API.

## 🚀 Возможности

- **Управление пользователями**: Регистрация, профили, система уровней
- **Система баллов**: Начисление, списание, история транзакций
- **Уровни лояльности**: Bronze, Silver, Gold, Platinum с разными множителями
- **Награды**: Каталог наград с возможностью обмена на баллы
- **Акции**: Временные маркетинговые кампании
- **Безопасность**: Row Level Security (RLS) для защиты данных
- **REST API**: Полнофункциональные Edge Functions

## 📋 Структура проекта

```
loyalty-app-backend/
├── supabase/
│   ├── functions/
│   │   ├── users-api/         # API пользователей
│   │   ├── transactions-api/  # API транзакций
│   │   ├── rewards-api/       # API наград
│   │   ├── campaigns-api/     # API акций
│   │   └── loyalty-levels-api/# API уровней
│   └── migrations/
│       └── create_loyalty_schema.sql
├── src/
│   └── main.js               # Frontend демо-приложение
├── API_DOCUMENTATION.md      # Полная документация API
├── ADMIN_QUERIES.sql         # SQL-запросы для администрирования
└── README.md                 # Этот файл
```

## 🗄️ Схема базы данных

### Таблицы

1. **users** - Профили пользователей
   - id, full_name, email, points, loyalty_level_id, created_at, updated_at

2. **loyalty_levels** - Уровни лояльности
   - id, name, min_points, bonus_multiplier, description, created_at

3. **transactions** - История транзакций
   - id, user_id, type, amount, description, created_at

4. **rewards** - Доступные награды
   - id, name, description, points_cost, is_available, stock, image_url, created_at

5. **campaigns** - Маркетинговые акции
   - id, name, description, start_date, end_date, is_active, bonus_points, created_at

6. **user_rewards** - История полученных наград
   - id, user_id, reward_id, redeemed_at, status

## 🔐 Безопасность

Все таблицы защищены Row Level Security (RLS):

- Пользователи видят только свои данные
- Публичный доступ к справочникам (уровни, награды, акции)
- JWT аутентификация для всех API запросов

## 🌐 API Endpoints

**Базовый URL**: `https://xuvgvnkqxboozhleznps.supabase.co/functions/v1`

### Основные эндпоинты:

- `GET /users-api` - Получить профиль
- `PUT /users-api` - Обновить профиль
- `POST /users-api/register` - Регистрация профиля
- `GET /transactions-api` - История транзакций
- `POST /transactions-api/earn` - Начислить баллы
- `GET /rewards-api` - Доступные награды
- `POST /rewards-api/redeem` - Обменять награду
- `GET /rewards-api/my-rewards` - Мои награды
- `GET /campaigns-api` - Активные акции
- `GET /loyalty-levels-api` - Уровни лояльности

Полная документация: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## 🛠️ Установка и запуск

### 1. Установка зависимостей

```bash
npm install
```

### 2. Запуск демо-приложения

```bash
npm run dev
```

### 3. Сборка для продакшена

```bash
npm run build
```

## 📊 Административные задачи

Для управления наградами, акциями и пользователями используйте SQL-запросы из файла `ADMIN_QUERIES.sql`.

### Примеры:

**Добавить новую награду:**
```sql
INSERT INTO rewards (name, description, points_cost, is_available)
VALUES ('Скидка 15%', 'Скидка 15% на следующую покупку', 700, true);
```

**Создать акцию:**
```sql
INSERT INTO campaigns (name, description, start_date, end_date, is_active, bonus_points)
VALUES (
  'Летняя распродажа',
  'Дополнительные 50 баллов за каждую покупку',
  '2024-06-01 00:00:00+00',
  '2024-08-31 23:59:59+00',
  true,
  50
);
```

**Просмотреть топ пользователей:**
```sql
SELECT u.full_name, u.email, u.points, l.name as level
FROM users u
LEFT JOIN loyalty_levels l ON u.loyalty_level_id = l.id
ORDER BY u.points DESC
LIMIT 10;
```

## 📱 Пример использования API

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xuvgvnkqxboozhleznps.supabase.co',
  'YOUR_ANON_KEY'
);

// Регистрация пользователя
const { data: authData } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123'
});

// Создание профиля
const { data: session } = await supabase.auth.getSession();
const response = await fetch(
  'https://xuvgvnkqxboozhleznps.supabase.co/functions/v1/users-api/register',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      full_name: 'Иван Иванов',
      email: 'user@example.com'
    })
  }
);

// Начислить баллы
await fetch(
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

## 🎯 Функционал системы лояльности

### Начисление баллов

Баллы начисляются с учетом множителя текущего уровня пользователя:

- **Bronze** (0+ баллов): 1.0x множитель
- **Silver** (1000+ баллов): 1.2x множитель
- **Gold** (5000+ баллов): 1.5x множитель
- **Platinum** (10000+ баллов): 2.0x множитель

**Пример**: Покупка на 100₽
- Bronze: 100 баллов
- Silver: 120 баллов
- Gold: 150 баллов
- Platinum: 200 баллов

### Обмен наград

Пользователи могут обменивать накопленные баллы на награды:

1. Проверка достаточности баллов
2. Проверка наличия награды на складе
3. Создание записи в `user_rewards`
4. Списание баллов
5. Создание транзакции типа "spent"

### Автоматическое обновление уровня

При изменении количества баллов уровень пользователя автоматически обновляется через триггер базы данных.

## 🔧 Технологический стек

- **База данных**: Supabase PostgreSQL
- **Backend**: Supabase Edge Functions (TypeScript/Deno)
- **Frontend**: Vanilla JavaScript + Vite
- **Аутентификация**: Supabase Auth (JWT)
- **Безопасность**: Row Level Security (RLS)

## 📈 Аналитика

Используйте запросы из `ADMIN_QUERIES.sql` для получения аналитики:

- Статистика транзакций
- Популярные награды
- Распределение пользователей по уровням
- Активность пользователей
- Общая статистика платформы

## 🤝 Интеграция

### Мобильное приложение

Используйте официальные SDK Supabase:

- [iOS (Swift)](https://github.com/supabase-community/supabase-swift)
- [Android (Kotlin)](https://github.com/supabase-community/supabase-kt)
- [Flutter](https://github.com/supabase/supabase-flutter)
- [React Native](https://supabase.com/docs/reference/javascript)

### Web приложение

```bash
npm install @supabase/supabase-js
```

Примеры использования в файле `src/main.js`

## 📝 Документация

Документация Supabase: https://supabase.com/docs
