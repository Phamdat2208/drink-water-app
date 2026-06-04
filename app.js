// ===== STATE =====
let state = {
  today: new Date().toDateString(),
  totalMl: 0,
  cups: 0,
  goal: 2000,
  interval: 30,
  running: false,
  history: []
};

// ===== DOM refs =====
const waterFill = document.getElementById('waterFill');
const waterPercent = document.getElementById('waterPercent');
const todayTotal = document.getElementById('todayTotal');
const todayCups = document.getElementById('todayCups');
const goalPercent = document.getElementById('goalPercent');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const historyList = document.getElementById('historyList');
const historySection = document.getElementById('historySection');
const greeting = document.getElementById('greeting');
const reminderInterval = document.getElementById('reminderInterval');
const dailyGoal = document.getElementById('dailyGoal');

// ===== Greeting =====
function setGreeting() {
  const h = new Date().getHours();
  if (h < 12) greeting.textContent = 'Chào buổi sáng ☀️';
  else if (h < 18) greeting.textContent = 'Chào buổi chiều 🌤️';
  else greeting.textContent = 'Chào buổi tối 🌙';
}

// ===== LocalStorage =====
function saveState() {
  try {
    localStorage.setItem('drinkWater', JSON.stringify(state));
  } catch (e) { /* ignore */ }
}

function loadState() {
  try {
    const saved = localStorage.getItem('drinkWater');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Reset if new day
      if (parsed.today !== new Date().toDateString()) {
        state = { ...state, totalMl: 0, cups: 0, history: [] };
      } else {
        state = { ...state, ...parsed };
      }
    }
  } catch (e) { /* ignore */ }
}

// ===== UI Update =====
function updateUI() {
  const pct = Math.min((state.totalMl / state.goal) * 100, 100);
  waterFill.style.height = pct + '%';
  waterFill.classList.toggle('has-water', state.totalMl > 0);
  waterPercent.textContent = Math.round(pct) + '%';
  todayTotal.textContent = state.totalMl;
  todayCups.textContent = state.cups;
  goalPercent.textContent = Math.round(pct) + '%';

  // Update history
  if (state.history.length > 0) {
    historySection.style.display = 'block';
    historyList.innerHTML = state.history
      .slice()
      .reverse()
      .map(h => {
        const time = new Date(h.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return `<div class="history-item"><span>💧 ${h.ml}ml</span><span>${time}</span></div>`;
      })
      .join('');
  }
}

// ===== Notification =====
async function sendReminder() {
  if (!('Notification' in window)) {
    showToast('🔔 Trình duyệt không hỗ trợ thông báo');
    return;
  }

  if (Notification.permission === 'granted') {
    const now = new Date();
    const h = now.getHours();
    const isLate = h >= 22 || h < 6;
    
    // Don't notify late at night
    if (isLate) return;

    // Calculate progress
    const pct = Math.round((state.totalMl / state.goal) * 100);
    let msg;
    if (pct < 25) msg = '🌊 Uống nước đi bạn ơi! Hồi phục sức khỏe nào!';
    else if (pct < 50) msg = '💧 Còn 1/2 chặng đường! Nhấp một ngụm nào!';
    else if (pct < 75) msg = '🥤 Gần xong rồi! Cố lên!';
    else if (pct < 100) msg = '🏆 Gần đạt mục tiêu! Uống thêm tí nữa thôi!';
    else msg = '🎉 Xuất sắc! Bạn đã đạt mục tiêu hôm nay!';

    // Try service worker notification first (works offline)
    if (navigator.serviceWorker?.ready) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification('💧 Uống nước thôi!', {
          body: msg,
          icon: 'icon-192.png',
          badge: 'icon-192.png',
          vibrate: [200, 100, 200],
          tag: 'drink-water',
          requireInteraction: true,
          data: { url: window.location.href }
        });
        return;
      } catch (e) { /* fallback to regular notification */ }
    }

    // Regular notification
    try {
      const notif = new Notification('💧 Uống nước thôi!', {
        body: msg,
        icon: 'icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'drink-water',
        requireInteraction: true
      });
      setTimeout(() => notif.close(), 5000);
    } catch (e) {
      showToast('🔔 ' + msg);
    }
  } else if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

// ===== Reminder Loop =====
let reminderTimer = null;

function startReminders() {
  if (state.running) return;

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  state.running = true;
  const minutes = parseInt(reminderInterval.value);
  state.interval = minutes;

  // Send first reminder immediately (with small delay)
  setTimeout(() => sendReminder(), 2000);

  // Set interval
  reminderTimer = setInterval(() => sendReminder(), minutes * 60 * 1000);

  // Update UI
  statusDot.className = 'status-dot on';
  statusText.textContent = `🔔 Đang chạy — nhắc mỗi ${minutes} phút`;
  startBtn.style.display = 'none';
  stopBtn.style.display = 'block';
  reminderInterval.disabled = true;
  dailyGoal.disabled = true;

  saveState();
  showToast('✅ Đã bắt đầu nhắc nhở uống nước!');
}

function stopReminders() {
  state.running = false;
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }

  statusDot.className = 'status-dot off';
  statusText.textContent = '⏹ Đã dừng nhắc nhở';
  startBtn.style.display = 'block';
  stopBtn.style.display = 'none';
  reminderInterval.disabled = false;
  dailyGoal.disabled = false;

  saveState();
}

// ===== Add Water =====
function addWater(ml) {
  // Vibrate on mobile
  if (navigator.vibrate) navigator.vibrate(50);

  state.totalMl += ml;
  state.cups += 1;
  state.history.push({ ml, time: new Date().toISOString() });
  updateUI();
  saveState();

  // Confirm with sound-like feedback
  const pct = Math.round((state.totalMl / state.goal) * 100);
  if (pct >= 100) {
    showToast('🎉 Hoàn thành mục tiêu hôm nay! Xuất sắc!');
    // Celebration vibration
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
  } else {
    showToast(`✅ +${ml}ml (${pct}% mục tiêu)`);
  }
}

// ===== Daily Goal =====
dailyGoal.addEventListener('change', () => {
  state.goal = parseInt(dailyGoal.value);
  updateUI();
  saveState();
});

// ===== Toast =====
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== PWA Install =====
let deferredPrompt = null;
const installBanner = document.getElementById('installBanner');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBanner.classList.add('show');
});

async function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const result = await deferredPrompt.userChoice;
  if (result.outcome === 'accepted') {
    installBanner.classList.remove('show');
    showToast('✅ App đã được cài!');
  }
  deferredPrompt = null;
}

window.addEventListener('appinstalled', () => {
  installBanner.classList.remove('show');
  showToast('🎉 Cảm ơn bạn đã cài app!');
});

// ===== Init =====
setGreeting();
loadState();
if (state.running) {
  startReminders();
}
reminderInterval.value = state.interval;
dailyGoal.value = state.goal;
updateUI();

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => {
      console.log('SW registration failed:', err);
    });
  });
}

// Listen for notification clicks in service worker
navigator.serviceWorker?.addEventListener('message', (event) => {
  if (event.data === 'notification-click') {
    window.focus();
  }
});
