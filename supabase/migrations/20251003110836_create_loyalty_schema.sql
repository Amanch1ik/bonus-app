/*
  # Создание схемы для приложения лояльности

  ## Новые таблицы

  ### 1. `users`
  - `id` (uuid, primary key) - ID пользователя из auth.users
  - `full_name` (text) - Полное имя пользователя
  - `email` (text, unique) - Email пользователя
  - `points` (integer) - Текущие баллы лояльности
  - `loyalty_level_id` (uuid, foreign key) - Ссылка на уровень лояльности
  - `created_at` (timestamptz) - Дата регистрации
  - `updated_at` (timestamptz) - Дата последнего обновления

  ### 2. `loyalty_levels`
  - `id` (uuid, primary key) - ID уровня
  - `name` (text) - Название уровня (например, Bronze, Silver, Gold)
  - `min_points` (integer) - Минимальное количество баллов для уровня
  - `bonus_multiplier` (decimal) - Множитель бонусов (например, 1.0, 1.2, 1.5)
  - `description` (text) - Описание преимуществ уровня
  - `created_at` (timestamptz) - Дата создания

  ### 3. `transactions`
  - `id` (uuid, primary key) - ID транзакции
  - `user_id` (uuid, foreign key) - Ссылка на пользователя
  - `type` (text) - Тип транзакции (earned, spent, expired)
  - `amount` (integer) - Количество баллов (положительное или отрицательное)
  - `description` (text) - Описание транзакции
  - `created_at` (timestamptz) - Дата транзакции

  ### 4. `rewards`
  - `id` (uuid, primary key) - ID награды
  - `name` (text) - Название награды
  - `description` (text) - Описание награды
  - `points_cost` (integer) - Стоимость в баллах
  - `is_available` (boolean) - Доступность награды
  - `stock` (integer, nullable) - Количество на складе
  - `image_url` (text, nullable) - URL изображения
  - `created_at` (timestamptz) - Дата создания

  ### 5. `campaigns`
  - `id` (uuid, primary key) - ID кампании/акции
  - `name` (text) - Название акции
  - `description` (text) - Описание акции
  - `start_date` (timestamptz) - Дата начала
  - `end_date` (timestamptz) - Дата окончания
  - `is_active` (boolean) - Активность кампании
  - `bonus_points` (integer) - Дополнительные бонусные баллы
  - `created_at` (timestamptz) - Дата создания

  ### 6. `user_rewards`
  - `id` (uuid, primary key) - ID записи
  - `user_id` (uuid, foreign key) - Ссылка на пользователя
  - `reward_id` (uuid, foreign key) - Ссылка на награду
  - `redeemed_at` (timestamptz) - Дата получения награды
  - `status` (text) - Статус (pending, completed, cancelled)

  ## Безопасность

  1. Включение RLS для всех таблиц
  2. Политики для пользователей:
     - Пользователи могут читать свои данные
     - Пользователи могут обновлять свой профиль
     - Пользователи могут читать уровни лояльности
     - Пользователи могут читать свои транзакции
     - Пользователи могут читать доступные награды
     - Пользователи могут читать активные кампании
     - Пользователи могут получать свои награды

  ## Примечания
  
  - Используются значения по умолчанию для обеспечения целостности данных
  - Автоматическое обновление timestamps через триггеры
  - Индексы для оптимизации запросов
*/

-- Создание таблицы уровней лояльности
CREATE TABLE IF NOT EXISTS loyalty_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  min_points integer NOT NULL DEFAULT 0,
  bonus_multiplier decimal(3,2) NOT NULL DEFAULT 1.00,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  points integer NOT NULL DEFAULT 0,
  loyalty_level_id uuid REFERENCES loyalty_levels(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Создание таблицы транзакций
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('earned', 'spent', 'expired')),
  amount integer NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Создание таблицы наград
CREATE TABLE IF NOT EXISTS rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  points_cost integer NOT NULL,
  is_available boolean DEFAULT true,
  stock integer,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- Создание таблицы кампаний
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  bonus_points integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Создание таблицы полученных наград
CREATE TABLE IF NOT EXISTS user_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  redeemed_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled'))
);

-- Создание индексов для оптимизации
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_loyalty_level ON users(loyalty_level_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_user_rewards_user_id ON user_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для обновления updated_at в таблице users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Включение RLS для всех таблиц
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;

-- Политики для users
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Политики для loyalty_levels (все аутентифицированные могут читать)
CREATE POLICY "Authenticated users can view loyalty levels"
  ON loyalty_levels FOR SELECT
  TO authenticated
  USING (true);

-- Политики для transactions
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Политики для rewards (все аутентифицированные могут читать)
CREATE POLICY "Authenticated users can view available rewards"
  ON rewards FOR SELECT
  TO authenticated
  USING (is_available = true);

-- Политики для campaigns (все аутентифицированные могут читать активные)
CREATE POLICY "Authenticated users can view active campaigns"
  ON campaigns FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Политики для user_rewards
CREATE POLICY "Users can view own rewards"
  ON user_rewards FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Вставка начальных уровней лояльности
INSERT INTO loyalty_levels (name, min_points, bonus_multiplier, description)
VALUES 
  ('Bronze', 0, 1.00, 'Базовый уровень для новых пользователей'),
  ('Silver', 1000, 1.20, 'Увеличенные бонусы на 20% за покупки'),
  ('Gold', 5000, 1.50, 'Увеличенные бонусы на 50% и эксклюзивные предложения'),
  ('Platinum', 10000, 2.00, 'Двойные бонусы и VIP-преимущества')
ON CONFLICT (name) DO NOTHING;