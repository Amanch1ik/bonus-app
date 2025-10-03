-- Административные SQL-запросы для управления приложением лояльности

-- ============================================
-- Управление наградами (Rewards)
-- ============================================

-- Добавить новую награду
INSERT INTO rewards (name, description, points_cost, is_available, stock, image_url)
VALUES
  ('Скидка 10%', 'Скидка 10% на следующую покупку', 500, true, 100, null),
  ('Бесплатная доставка', 'Бесплатная доставка следующего заказа', 300, true, null, null),
  ('Подарочный сертификат 1000₽', 'Сертификат на 1000 рублей', 2000, true, 50, null);

-- Обновить награду
UPDATE rewards
SET is_available = false
WHERE name = 'Скидка 10%';

-- Изменить стоимость награды
UPDATE rewards
SET points_cost = 400
WHERE name = 'Бесплатная доставка';

-- Просмотреть все награды
SELECT * FROM rewards
ORDER BY points_cost ASC;

-- Просмотреть награды с низким запасом
SELECT * FROM rewards
WHERE stock IS NOT NULL AND stock < 10;

-- ============================================
-- Управление акциями (Campaigns)
-- ============================================

-- Создать новую акцию
INSERT INTO campaigns (name, description, start_date, end_date, is_active, bonus_points)
VALUES
  (
    'Новогодняя распродажа',
    'Удвоенные баллы за все покупки в декабре',
    '2024-12-01 00:00:00+00',
    '2024-12-31 23:59:59+00',
    true,
    100
  );

-- Деактивировать акцию
UPDATE campaigns
SET is_active = false
WHERE name = 'Новогодняя распродажа';

-- Просмотреть активные акции
SELECT * FROM campaigns
WHERE is_active = true
  AND start_date <= NOW()
  AND end_date >= NOW()
ORDER BY start_date DESC;

-- ============================================
-- Управление пользователями (Users)
-- ============================================

-- Просмотреть топ пользователей по баллам
SELECT
  u.full_name,
  u.email,
  u.points,
  l.name as loyalty_level
FROM users u
LEFT JOIN loyalty_levels l ON u.loyalty_level_id = l.id
ORDER BY u.points DESC
LIMIT 20;

-- Начислить бонусные баллы пользователю (с транзакцией)
DO $$
DECLARE
  target_user_id uuid := 'USER_ID_HERE';
  bonus_amount integer := 500;
BEGIN
  -- Создать транзакцию
  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (target_user_id, 'earned', bonus_amount, 'Бонус от администратора');

  -- Обновить баллы пользователя
  UPDATE users
  SET points = points + bonus_amount
  WHERE id = target_user_id;
END $$;

-- Обновить уровень лояльности пользователей на основе баллов
UPDATE users u
SET loyalty_level_id = (
  SELECT l.id
  FROM loyalty_levels l
  WHERE l.min_points <= u.points
  ORDER BY l.min_points DESC
  LIMIT 1
);

-- Просмотреть пользователей с истекающими баллами (пример)
SELECT
  u.full_name,
  u.email,
  u.points,
  u.updated_at as last_activity
FROM users u
WHERE u.updated_at < NOW() - INTERVAL '90 days'
  AND u.points > 0
ORDER BY u.updated_at ASC;

-- ============================================
-- Аналитика и отчеты
-- ============================================

-- Статистика по транзакциям за последний месяц
SELECT
  type,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount
FROM transactions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY type;

-- Самые популярные награды
SELECT
  r.name,
  r.points_cost,
  COUNT(ur.id) as redemption_count
FROM rewards r
LEFT JOIN user_rewards ur ON r.id = ur.reward_id
GROUP BY r.id, r.name, r.points_cost
ORDER BY redemption_count DESC
LIMIT 10;

-- Распределение пользователей по уровням лояльности
SELECT
  l.name as level,
  COUNT(u.id) as user_count,
  AVG(u.points) as avg_points
FROM loyalty_levels l
LEFT JOIN users u ON l.id = u.loyalty_level_id
GROUP BY l.id, l.name, l.min_points
ORDER BY l.min_points ASC;

-- Активность пользователей (транзакции за последнюю неделю)
SELECT
  u.full_name,
  u.email,
  COUNT(t.id) as transaction_count,
  SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as earned_points,
  SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as spent_points
FROM users u
LEFT JOIN transactions t ON u.id = t.user_id
  AND t.created_at >= NOW() - INTERVAL '7 days'
GROUP BY u.id, u.full_name, u.email
HAVING COUNT(t.id) > 0
ORDER BY transaction_count DESC;

-- Общая статистика платформы
SELECT
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM rewards WHERE is_available = true) as available_rewards,
  (SELECT COUNT(*) FROM campaigns WHERE is_active = true) as active_campaigns,
  (SELECT SUM(points) FROM users) as total_points_in_circulation,
  (SELECT COUNT(*) FROM transactions) as total_transactions;

-- ============================================
-- Управление уровнями лояльности
-- ============================================

-- Добавить новый уровень
INSERT INTO loyalty_levels (name, min_points, bonus_multiplier, description)
VALUES
  ('Diamond', 25000, 3.00, 'Эксклюзивный уровень с тройными бонусами');

-- Обновить параметры уровня
UPDATE loyalty_levels
SET bonus_multiplier = 1.25,
    description = 'Увеличенные бонусы на 25% за все покупки'
WHERE name = 'Silver';

-- ============================================
-- Очистка и обслуживание
-- ============================================

-- Архивировать старые транзакции (создание архивной таблицы)
CREATE TABLE IF NOT EXISTS transactions_archive (LIKE transactions INCLUDING ALL);

INSERT INTO transactions_archive
SELECT * FROM transactions
WHERE created_at < NOW() - INTERVAL '1 year';

-- Удалить неактивные акции, закончившиеся более года назад
DELETE FROM campaigns
WHERE is_active = false
  AND end_date < NOW() - INTERVAL '1 year';

-- Найти и исправить несоответствия в балансе баллов
WITH calculated_points AS (
  SELECT
    user_id,
    SUM(amount) as calculated_total
  FROM transactions
  GROUP BY user_id
)
SELECT
  u.id,
  u.full_name,
  u.points as recorded_points,
  COALESCE(cp.calculated_total, 0) as calculated_points,
  u.points - COALESCE(cp.calculated_total, 0) as difference
FROM users u
LEFT JOIN calculated_points cp ON u.id = cp.user_id
WHERE u.points != COALESCE(cp.calculated_total, 0);

-- Исправить баланс пользователя (если найдены несоответствия)
UPDATE users u
SET points = (
  SELECT COALESCE(SUM(amount), 0)
  FROM transactions t
  WHERE t.user_id = u.id
)
WHERE EXISTS (
  SELECT 1
  FROM transactions t
  WHERE t.user_id = u.id
);

-- ============================================
-- Служебные функции
-- ============================================

-- Создать функцию для автоматического обновления уровня пользователя
CREATE OR REPLACE FUNCTION update_user_loyalty_level()
RETURNS TRIGGER AS $$
BEGIN
  NEW.loyalty_level_id := (
    SELECT id
    FROM loyalty_levels
    WHERE min_points <= NEW.points
    ORDER BY min_points DESC
    LIMIT 1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создать триггер для автоматического обновления уровня при изменении баллов
DROP TRIGGER IF EXISTS trigger_update_loyalty_level ON users;
CREATE TRIGGER trigger_update_loyalty_level
  BEFORE UPDATE OF points ON users
  FOR EACH ROW
  WHEN (OLD.points IS DISTINCT FROM NEW.points)
  EXECUTE FUNCTION update_user_loyalty_level();

-- ============================================
-- Примеры массовых операций
-- ============================================

-- Начислить бонус всем пользователям определенного уровня
DO $$
DECLARE
  bonus_amount integer := 100;
  level_name text := 'Gold';
BEGIN
  INSERT INTO transactions (user_id, type, amount, description)
  SELECT
    u.id,
    'earned',
    bonus_amount,
    'Бонус для уровня ' || level_name
  FROM users u
  INNER JOIN loyalty_levels l ON u.loyalty_level_id = l.id
  WHERE l.name = level_name;

  UPDATE users u
  SET points = points + bonus_amount
  FROM loyalty_levels l
  WHERE u.loyalty_level_id = l.id
    AND l.name = level_name;
END $$;

-- Деактивировать все просроченные награды со сроком годности (если добавить поле expiry_date)
-- UPDATE rewards
-- SET is_available = false
-- WHERE expiry_date < NOW();
