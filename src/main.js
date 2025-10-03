import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentUser = null;

const API_BASE = `${supabaseUrl}/functions/v1`;

async function fetchAPI(endpoint, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('No session');
  }

  const response = await fetch(`${API_BASE}/${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

function showMessage(elementId, message, type = 'success') {
  const element = document.getElementById(elementId);
  element.innerHTML = `<div class="message ${type}">${message}</div>`;
  setTimeout(() => {
    element.innerHTML = '';
  }, 5000);
}

async function login() {
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    currentUser = data.user;
    showApp();
  } catch (error) {
    showMessage('authMessage', error.message, 'error');
  }
}

async function register() {
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  const fullName = document.getElementById('authFullName').value;

  if (!fullName) {
    showMessage('authMessage', 'Пожалуйста, введите полное имя', 'error');
    return;
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;

    currentUser = authData.user;

    const profileData = await fetchAPI('users-api/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: fullName,
        email: email,
      }),
    });

    showMessage('authMessage', 'Регистрация успешна! Вход...', 'success');

    setTimeout(() => {
      showApp();
    }, 1000);
  } catch (error) {
    showMessage('authMessage', error.message, 'error');
  }
}

async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  document.getElementById('authSection').classList.add('active');
  document.getElementById('appSection').classList.remove('active');
}

function showApp() {
  document.getElementById('authSection').classList.remove('active');
  document.getElementById('appSection').classList.add('active');
  loadProfile();
  loadTransactions();
  loadRewards();
  loadCampaigns();
  loadLevels();
}

async function loadProfile() {
  try {
    const { data } = await fetchAPI('users-api');

    const levelClass = `level-${data.loyalty_levels.name.toLowerCase()}`;

    document.getElementById('profileContent').innerHTML = `
      <div class="level-badge ${levelClass}">${data.loyalty_levels.name}</div>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${data.points}</div>
          <div class="stat-label">Баллов</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.loyalty_levels.bonus_multiplier}x</div>
          <div class="stat-label">Множитель</div>
        </div>
      </div>
      <p style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
        <strong>${data.full_name}</strong>
      </p>
      <p style="font-size: 14px; color: #6b7280;">
        ${data.email}
      </p>
    `;
  } catch (error) {
    document.getElementById('profileContent').innerHTML = `
      <div class="empty-state">${error.message}</div>
    `;
  }
}

async function loadTransactions() {
  try {
    const { data, count } = await fetchAPI('transactions-api?limit=10');

    if (data.length === 0) {
      document.getElementById('transactionsContent').innerHTML = `
        <div class="empty-state">Нет транзакций</div>
      `;
      return;
    }

    const transactionsHTML = data.map(tx => {
      const amountClass = tx.amount > 0 ? 'amount-positive' : 'amount-negative';
      const sign = tx.amount > 0 ? '+' : '';
      const date = new Date(tx.created_at).toLocaleDateString('ru-RU');

      return `
        <div class="transaction-item">
          <div>
            <div style="font-weight: 500; margin-bottom: 4px;">${tx.description}</div>
            <div style="font-size: 12px; color: #6b7280;">${date}</div>
          </div>
          <div class="transaction-amount ${amountClass}">${sign}${tx.amount}</div>
        </div>
      `;
    }).join('');

    document.getElementById('transactionsContent').innerHTML = `
      <div class="transaction-list">${transactionsHTML}</div>
      <div style="margin-top: 12px; font-size: 12px; color: #6b7280; text-align: center;">
        Всего транзакций: ${count}
      </div>
    `;
  } catch (error) {
    document.getElementById('transactionsContent').innerHTML = `
      <div class="empty-state">${error.message}</div>
    `;
  }
}

async function earnPoints() {
  const amount = parseInt(document.getElementById('purchaseAmount').value);

  if (!amount || amount <= 0) {
    showMessage('earnMessage', 'Введите корректную сумму', 'error');
    return;
  }

  try {
    await fetchAPI('transactions-api/earn', {
      method: 'POST',
      body: JSON.stringify({
        amount: amount,
        description: `Покупка на сумму ${amount}`,
      }),
    });

    showMessage('earnMessage', 'Баллы успешно начислены!', 'success');
    document.getElementById('purchaseAmount').value = '';

    loadProfile();
    loadTransactions();
  } catch (error) {
    showMessage('earnMessage', error.message, 'error');
  }
}

async function loadRewards() {
  try {
    const { data } = await fetchAPI('rewards-api');

    if (data.length === 0) {
      document.getElementById('rewardsContent').innerHTML = `
        <div class="empty-state">Нет доступных наград</div>
      `;
      return;
    }

    const rewardsHTML = data.map(reward => {
      return `
        <div class="reward-item">
          <div style="flex: 1;">
            <div style="font-weight: 500; margin-bottom: 4px;">${reward.name}</div>
            <div style="font-size: 12px; color: #6b7280;">${reward.description}</div>
            <div style="font-size: 14px; color: #667eea; font-weight: 600; margin-top: 4px;">
              ${reward.points_cost} баллов
            </div>
          </div>
          <button class="reward-button" onclick="redeemReward('${reward.id}', ${reward.points_cost})">
            Обменять
          </button>
        </div>
      `;
    }).join('');

    document.getElementById('rewardsContent').innerHTML = `
      <div class="reward-list">${rewardsHTML}</div>
    `;
  } catch (error) {
    document.getElementById('rewardsContent').innerHTML = `
      <div class="empty-state">${error.message}</div>
    `;
  }
}

async function redeemReward(rewardId, pointsCost) {
  if (!confirm(`Обменять ${pointsCost} баллов на эту награду?`)) {
    return;
  }

  try {
    await fetchAPI('rewards-api/redeem', {
      method: 'POST',
      body: JSON.stringify({ reward_id: rewardId }),
    });

    alert('Награда успешно получена!');

    loadProfile();
    loadTransactions();
  } catch (error) {
    alert(`Ошибка: ${error.message}`);
  }
}

async function loadCampaigns() {
  try {
    const { data } = await fetchAPI('campaigns-api');

    if (data.length === 0) {
      document.getElementById('campaignsContent').innerHTML = `
        <div class="empty-state">Нет активных акций</div>
      `;
      return;
    }

    const campaignsHTML = data.map(campaign => {
      const startDate = new Date(campaign.start_date).toLocaleDateString('ru-RU');
      const endDate = new Date(campaign.end_date).toLocaleDateString('ru-RU');

      return `
        <div class="campaign-item">
          <div>
            <div style="font-weight: 500; margin-bottom: 4px;">${campaign.name}</div>
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
              ${campaign.description}
            </div>
            <div style="font-size: 12px; color: #667eea;">
              ${startDate} - ${endDate}
            </div>
          </div>
          ${campaign.bonus_points > 0 ? `
            <div style="background: #667eea; color: white; padding: 8px 12px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              +${campaign.bonus_points}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    document.getElementById('campaignsContent').innerHTML = `
      <div class="campaign-list">${campaignsHTML}</div>
    `;
  } catch (error) {
    document.getElementById('campaignsContent').innerHTML = `
      <div class="empty-state">${error.message}</div>
    `;
  }
}

async function loadLevels() {
  try {
    const { data } = await fetchAPI('loyalty-levels-api');

    const levelsHTML = data.map(level => {
      const levelClass = `level-${level.name.toLowerCase()}`;

      return `
        <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
          <div class="level-badge ${levelClass}" style="margin-bottom: 8px;">${level.name}</div>
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
            ${level.description}
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #667eea;">
            <span>От ${level.min_points} баллов</span>
            <span>${level.bonus_multiplier}x множитель</span>
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('levelsContent').innerHTML = levelsHTML;
  } catch (error) {
    document.getElementById('levelsContent').innerHTML = `
      <div class="empty-state">${error.message}</div>
    `;
  }
}

document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('registerBtn').addEventListener('click', register);
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('earnPointsBtn').addEventListener('click', earnPoints);

window.redeemReward = redeemReward;

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    currentUser = session.user;
    showApp();
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    document.getElementById('authSection').classList.add('active');
    document.getElementById('appSection').classList.remove('active');
  }
});

(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    showApp();
  }
})();
