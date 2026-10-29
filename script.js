/* =========================================================
   CGPA & Placement Eligibility Predictor — script.js
   All logic lives here: navigation, calculations, dashboard.
   ========================================================= */

// Shared state so the Dashboard can reflect the latest results
// from both the Calculator and the Eligibility Checker.
const state = {
  cgpa: null,
  percentage: null,
  level: null,
  eligibleCount: null,
};

/* ---------------------------------------------------------
   1. NAVIGATION — switch between the four "pages" (sections)
   --------------------------------------------------------- */
const navButtons = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page');

function showPage(id) {
  pages.forEach(p => p.classList.toggle('active', p.id === id));
  navButtons.forEach(b => b.classList.toggle('active', b.dataset.page === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navButtons.forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)));

// "Calculate my CGPA" / "Check eligibility" buttons on the home hero
document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.goto));
});

/* ---------------------------------------------------------
   1b. LOGIN — email saved to localStorage, visible on Admin page
   --------------------------------------------------------- */
const USERS_KEY = 'cgpaLedgerUsers';       // array of {email, firstLogin, lastLogin, count, cgpa, percentage, level, eligibleCount, eligibleCompanies}
const CURRENT_USER_KEY = 'cgpaLedgerCurrentUser';

// Admin credentials — change these to whatever you like.
const ADMIN_ID = 'Krithii';
const ADMIN_PASSWORD = '2609';
const ADMIN_UNLOCK_KEY = 'cgpaLedgerAdminUnlocked'; // 'true' once the admin has logged in on this browser

function isAdminUnlocked() {
  return localStorage.getItem(ADMIN_UNLOCK_KEY) === 'true';
}

const loginOverlay = document.getElementById('loginOverlay');
const loginEmail = document.getElementById('loginEmail');
const loginError = document.getElementById('loginError');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userChip = document.getElementById('userChip');

// Login-gate tabs (User Login / Admin Login)
const userTabBtn = document.getElementById('userTabBtn');
const adminTabBtn = document.getElementById('adminTabBtn');
const userLoginPanel = document.getElementById('userLoginPanel');
const adminLoginPanel = document.getElementById('adminLoginPanel');
const gateAdminId = document.getElementById('gateAdminId');
const gateAdminPass = document.getElementById('gateAdminPass');
const gateAdminError = document.getElementById('gateAdminError');
const gateAdminLoginBtn = document.getElementById('gateAdminLoginBtn');

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Show the login gate — blocks the whole app until the user logs in
function openLogin() {
  loginError.classList.add('hidden');
  loginEmail.value = '';
  showGateTab('user');
  loginOverlay.classList.remove('hidden');
  loginEmail.focus();
}

// Hide the gate and land on the Home page
function closeLoginAndEnter() {
  loginOverlay.classList.add('hidden');
  showPage('home');
}

function refreshNavUser() {
  const current = localStorage.getItem(CURRENT_USER_KEY);

  if (current) {
    userChip.textContent = current;
    userChip.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
  } else {
    userChip.classList.add('hidden');
    logoutBtn.classList.add('hidden');
  }
}

function loginWithEmail(email) {
  const now = new Date().toISOString();
  const users = getUsers();
  const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (existing) {
    existing.lastLogin = now;
    existing.count = (existing.count || 1) + 1;
  } else {
    users.push({ email, firstLogin: now, lastLogin: now, count: 1 });
  }

  saveUsers(users);
  localStorage.setItem(CURRENT_USER_KEY, email);
  refreshNavUser();
  renderAdminTable();
}

// Merge new fields (cgpa, eligibleCompanies, etc.) into the currently
// logged-in user's saved record, so the admin can see their latest results.
function updateCurrentUserRecord(patch) {
  const current = localStorage.getItem(CURRENT_USER_KEY);
  if (!current) return;

  const users = getUsers();
  const existing = users.find(u => u.email.toLowerCase() === current.toLowerCase());
  if (!existing) return;

  Object.assign(existing, patch);
  saveUsers(users);
  renderAdminTable();
}

loginSubmitBtn.addEventListener('click', () => {
  const email = loginEmail.value.trim();
  if (!isValidEmail(email)) {
    loginError.classList.remove('hidden');
    return;
  }
  loginWithEmail(email);
  closeLoginAndEnter();
});

loginEmail.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginSubmitBtn.click();
});

// Switch between the "User Login" and "Admin Login" tabs on the gate
function showGateTab(tab) {
  const isAdmin = tab === 'admin';
  userTabBtn.classList.toggle('active', !isAdmin);
  adminTabBtn.classList.toggle('active', isAdmin);
  userLoginPanel.classList.toggle('hidden', isAdmin);
  adminLoginPanel.classList.toggle('hidden', !isAdmin);
  gateAdminError.classList.add('hidden');
  loginError.classList.add('hidden');
}

userTabBtn.addEventListener('click', () => showGateTab('user'));
adminTabBtn.addEventListener('click', () => showGateTab('admin'));

// Admin login directly from the gate — on success, skip the user
// area entirely and land straight on the Admin page.
gateAdminLoginBtn.addEventListener('click', () => {
  const id = gateAdminId.value.trim();
  const pass = gateAdminPass.value;

  if (id === ADMIN_ID && pass === ADMIN_PASSWORD) {
    gateAdminError.classList.add('hidden');
    localStorage.setItem(ADMIN_UNLOCK_KEY, 'true');
    gateAdminId.value = '';
    gateAdminPass.value = '';
    loginOverlay.classList.add('hidden');
    showPage('admin');
    renderAdminTable();
  } else {
    gateAdminError.classList.remove('hidden');
  }
});

gateAdminPass.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') gateAdminLoginBtn.click();
});

// Logging out re-locks the app behind the login gate
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem(CURRENT_USER_KEY);
  refreshNavUser();
  openLogin();
});

// On load: an already-unlocked admin skips straight to the Admin page.
// Otherwise, if nobody is logged in on this browser, show the gate first.
// A logged-in user skips straight to Home.
if (isAdminUnlocked()) {
  showPage('admin');
} else if (!localStorage.getItem(CURRENT_USER_KEY)) {
  openLogin();
}

/* ---------------------------------------------------------
   1c. ADMIN PAGE — lists every email saved in localStorage
   --------------------------------------------------------- */
const adminLoginBox = document.getElementById('adminLoginBox');
const adminIdInput = document.getElementById('adminIdInput');
const adminPassInput = document.getElementById('adminPassInput');
const adminLoginError = document.getElementById('adminLoginError');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const adminContent = document.getElementById('adminContent');
const adminTable = document.getElementById('adminTable');
const adminTableBody = document.getElementById('adminTableBody');
const adminEmpty = document.getElementById('adminEmpty');
const clearUsersBtn = document.getElementById('clearUsersBtn');

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

// Escape user-entered text (emails) before dropping it into innerHTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderAdminTable() {
  // Gate: the Admin ID + Password login (on this page) must be unlocked
  if (!isAdminUnlocked()) {
    adminContent.classList.add('hidden');
    adminLoginBox.classList.remove('hidden');
    return;
  }

  adminLoginBox.classList.add('hidden');
  adminContent.classList.remove('hidden');

  const users = getUsers();
  adminTableBody.innerHTML = '';

  if (users.length === 0) {
    adminTable.classList.add('hidden');
    adminEmpty.classList.remove('hidden');
    return;
  }

  adminEmpty.classList.add('hidden');
  adminTable.classList.remove('hidden');

  users.forEach((u, i) => {
    const cgpaText = (typeof u.cgpa === 'number')
      ? u.cgpa.toFixed(2)
      : '<span class="no-data">--</span>';

    let companiesText = '<span class="no-data">--</span>';
    if (Array.isArray(u.eligibleCompanies)) {
      companiesText = u.eligibleCompanies.length
        ? u.eligibleCompanies.map(c => `<span class="company-chip">${escapeHtml(c)}</span>`).join('')
        : '<span class="no-data">None eligible</span>';
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${i + 1}</td>
      <td class="mono">${escapeHtml(u.email)}</td>
      <td class="mono">${cgpaText}</td>
      <td>${companiesText}</td>
      <td>${formatDate(u.firstLogin)}</td>
      <td>${formatDate(u.lastLogin)}</td>
      <td>${u.count || 1}</td>`;
    adminTableBody.appendChild(row);
  });
}

clearUsersBtn.addEventListener('click', () => {
  if (!confirm('Clear all saved user emails from local storage?')) return;
  localStorage.removeItem(USERS_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  refreshNavUser();
  renderAdminTable();
});

adminLoginBtn.addEventListener('click', () => {
  const id = adminIdInput.value.trim();
  const pass = adminPassInput.value;

  if (id === ADMIN_ID && pass === ADMIN_PASSWORD) {
    adminLoginError.classList.add('hidden');
    localStorage.setItem(ADMIN_UNLOCK_KEY, 'true');
    adminIdInput.value = '';
    adminPassInput.value = '';
    renderAdminTable();
  } else {
    adminLoginError.classList.remove('hidden');
  }
});

adminPassInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') adminLoginBtn.click();
});

adminLogoutBtn.addEventListener('click', () => {
  localStorage.removeItem(ADMIN_UNLOCK_KEY);
  renderAdminTable();
});

// Refresh the admin table whenever the Admin nav tab is opened
document.querySelector('.nav-btn[data-page="admin"]').addEventListener('click', renderAdminTable);

// Initial state on page load
refreshNavUser();
renderAdminTable();

/* ---------------------------------------------------------
   2. DARK MODE TOGGLE (kept in memory only — no storage)
   --------------------------------------------------------- */
const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  themeToggle.textContent = isDark ? '🌙' : '☀️';
});

/* ---------------------------------------------------------
   3. CGPA CALCULATOR
   --------------------------------------------------------- */
const semCount = document.getElementById('semCount');
const gpaInputs = document.getElementById('gpaInputs');
const calcBtn = document.getElementById('calcBtn');
const calcResult = document.getElementById('calcResult');

// Fill the semester dropdown with options 1 to 8
for (let i = 1; i <= 8; i++) {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = `${i} Semester${i > 1 ? 's' : ''}`;
  semCount.appendChild(opt);
}

// Build one GPA input box per semester chosen
semCount.addEventListener('change', () => {
  gpaInputs.innerHTML = '';
  const n = Number(semCount.value);
  calcBtn.disabled = !n;

  for (let i = 1; i <= n; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'gpa-field';
    wrap.innerHTML = `
      <span>Semester ${i} GPA</span>
      <input type="number" class="sem-gpa" min="0" max="10" step="0.01" placeholder="0.00 - 10.00">`;
    gpaInputs.appendChild(wrap);
  }
  calcResult.classList.add('hidden');
});

// Turn a CGPA into an academic performance level
function getPerformanceLevel(cgpa) {
  if (cgpa >= 8.5) return { text: 'Excellent', cls: 'lvl-excellent' };
  if (cgpa >= 7.0) return { text: 'Good', cls: 'lvl-good' };
  if (cgpa >= 6.0) return { text: 'Average', cls: 'lvl-average' };
  return { text: 'Needs Improvement', cls: 'lvl-poor' };
}

calcBtn.addEventListener('click', () => {
  const fields = [...document.querySelectorAll('.sem-gpa')];
  const values = fields.map(f => parseFloat(f.value));

  if (values.some(v => isNaN(v) || v < 0 || v > 10)) {
    alert('Please enter a valid GPA between 0 and 10 for every semester.');
    return;
  }

  // Overall CGPA = average of entered semester GPAs
  const cgpa = values.reduce((sum, v) => sum + v, 0) / values.length;
  // Common engineering-college conversion formula
  const percentage = (cgpa - 0.75) * 10;
  const level = getPerformanceLevel(cgpa);

  document.getElementById('rCgpa').textContent = cgpa.toFixed(2);
  document.getElementById('rPercent').textContent = percentage.toFixed(2) + '%';
  const rLevel = document.getElementById('rLevel');
  rLevel.textContent = level.text;
  rLevel.className = 'rc-value badge ' + level.cls;
  calcResult.classList.remove('hidden');

  // Save to shared state and refresh the dashboard
  state.cgpa = cgpa;
  state.percentage = percentage;
  state.level = level.text;
  updateDashboard();

  // Save to this user's record so the admin can see it
  updateCurrentUserRecord({ cgpa, percentage, level: level.text });
});

document.getElementById('resetCalc').addEventListener('click', () => {
  semCount.value = '';
  gpaInputs.innerHTML = '';
  calcBtn.disabled = true;
  calcResult.classList.add('hidden');
});

/* ---------------------------------------------------------
   4. PLACEMENT ELIGIBILITY CHECKER
   --------------------------------------------------------- */
// Company eligibility rules
const companies = [
  { name: 'Company A', minCgpa: 7.0, maxArrears: 0 },
  { name: 'Company B', minCgpa: 7.5, maxArrears: 1 },
  { name: 'Company C', minCgpa: 8.0, maxArrears: 0 },
  { name: 'Company D', minCgpa: 8.5, maxArrears: 0 },
];

const eCgpa = document.getElementById('eCgpa');
const eArrears = document.getElementById('eArrears');
const eligResult = document.getElementById('eligResult');

document.getElementById('checkBtn').addEventListener('click', () => {
  const cgpa = parseFloat(eCgpa.value);
  const arrears = parseInt(eArrears.value, 10);

  if (isNaN(cgpa) || cgpa < 0 || cgpa > 10 || isNaN(arrears) || arrears < 0) {
    alert('Please enter a valid CGPA (0-10) and a valid arrear count (0 or more).');
    return;
  }

  eligResult.innerHTML = '';
  let eligibleCount = 0;
  const eligibleCompanies = [];

  companies.forEach(c => {
    const cgpaOk = cgpa >= c.minCgpa;
    const arrearsOk = arrears <= c.maxArrears;
    const eligible = cgpaOk && arrearsOk;
    if (eligible) {
      eligibleCount++;
      eligibleCompanies.push(c.name);
    }

    // Build the reason for rejection, if any
    let reason = '';
    if (!eligible) {
      const reasons = [];
      if (!cgpaOk) reasons.push(`CGPA below ${c.minCgpa.toFixed(1)} requirement`);
      if (!arrearsOk) reasons.push(`arrears exceed limit of ${c.maxArrears}`);
      reason = reasons.join(' and ');
    }

    const card = document.createElement('div');
    card.className = 'stamp-card';
    card.innerHTML = `
      <h3>${c.name}</h3>
      <span class="stamp ${eligible ? 'pass' : 'fail'}">${eligible ? 'Eligible' : 'Not Eligible'}</span>
      ${eligible ? '' : `<p class="stamp-reason">Reason: ${reason}</p>`}
      <p class="stamp-reason">Requires CGPA ≥ ${c.minCgpa.toFixed(1)}, max ${c.maxArrears} arrear(s)</p>`;
    eligResult.appendChild(card);
  });

  eligResult.classList.remove('hidden');

  // Save to shared state and refresh the dashboard
  state.eligibleCount = eligibleCount;
  updateDashboard();

  // Save to this user's record so the admin can see it
  updateCurrentUserRecord({ eligibleCount, eligibleCompanies });
});

document.getElementById('resetElig').addEventListener('click', () => {
  eCgpa.value = '';
  eArrears.value = '';
  eligResult.innerHTML = '';
  eligResult.classList.add('hidden');
});

/* ---------------------------------------------------------
   5. DASHBOARD — reflects the latest saved state
   --------------------------------------------------------- */
function updateDashboard() {
  document.getElementById('dCgpa').textContent =
    state.cgpa !== null ? state.cgpa.toFixed(2) : '--';
  document.getElementById('dPercent').textContent =
    state.percentage !== null ? state.percentage.toFixed(2) + '%' : '--';
  document.getElementById('dEligible').textContent =
    state.eligibleCount !== null ? `${state.eligibleCount} / ${companies.length}` : '--';

  const summary = document.getElementById('dSummary');
  if (state.cgpa !== null && state.eligibleCount !== null) {
    summary.textContent =
      `Your CGPA of ${state.cgpa.toFixed(2)} places you in the "${state.level}" band, ` +
      `and you currently qualify for ${state.eligibleCount} of ${companies.length} tracked companies.`;
  } else if (state.cgpa !== null) {
    summary.textContent =
      `Your CGPA of ${state.cgpa.toFixed(2)} places you in the "${state.level}" band. ` +
      `Run the Eligibility Checker to see which companies you qualify for.`;
  } else if (state.eligibleCount !== null) {
    summary.textContent =
      `You currently qualify for ${state.eligibleCount} of ${companies.length} tracked companies. ` +
      `Run the CGPA Calculator to complete your summary.`;
  }
}
