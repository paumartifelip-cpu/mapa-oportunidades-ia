// =============================================
// MAPA DE OPORTUNIDADES CON IA - app.js
// Conectado a Supabase (datos compartidos públicamente)
// =============================================

const SUPABASE_URL = 'https://owmjvuyokddopstvrrsh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93bWp2dXlva2Rkb3BzdHZycnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDQ4NjIsImV4cCI6MjA5NDU4MDg2Mn0.yQapuzoMRgLhB79mEEc0we7ckM_hOI2l_24RFqhBkC4';

// ---- Supabase API Helper ----
async function supabaseRequest(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': options.prefer || '',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ---- State ----
let allOpportunities = [];
let likedIds = new Set(JSON.parse(localStorage.getItem('likedOpportunities') || '[]'));

// ---- DOM References ----
const grid = document.getElementById('opportunitiesGrid');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const modalOverlay = document.getElementById('modalOverlay');
const opportunityForm = document.getElementById('opportunityForm');
const toast = document.getElementById('toast');

// ---- Stats DOM ----
const totalCountEl = document.getElementById('totalCount');
const totalCitiesEl = document.getElementById('totalCities');
const totalCountriesEl = document.getElementById('totalCountries');
const totalLikesEl = document.getElementById('totalLikes');

// ---- Filters DOM ----
const filterCity = document.getElementById('filterCity');
const filterCountry = document.getElementById('filterCountry');
const filterCategory = document.getElementById('filterCategory');

// ============================================
// FETCH ALL OPPORTUNITIES
// ============================================
async function fetchOpportunities() {
  showLoading();
  try {
    const data = await supabaseRequest(
      'opportunities?select=*&order=created_at.desc',
      { method: 'GET' }
    );
    allOpportunities = data || [];
    updateStats(allOpportunities);
    renderOpportunities(allOpportunities);
  } catch (err) {
    console.error('Error fetching:', err);
    showToast('Error al cargar oportunidades. Intenta de nuevo.', 'error');
    showEmpty();
  }
}

// ============================================
// INSERT NEW OPPORTUNITY
// ============================================
async function insertOpportunity(opp) {
  return supabaseRequest('opportunities', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify(opp),
  });
}

// ============================================
// UPDATE LIKES
// ============================================
async function updateLikes(id, newLikes) {
  return supabaseRequest(`opportunities?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ likes: newLikes }),
  });
}

// ============================================
// RENDER CARDS
// ============================================
function renderOpportunities(list) {
  if (!list || list.length === 0) {
    showEmpty();
    return;
  }

  grid.style.display = 'grid';
  loadingState.style.display = 'none';
  emptyState.style.display = 'none';

  grid.innerHTML = list.map((opp, i) => createCard(opp, i)).join('');

  // Add like event listeners
  grid.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', handleLike);
  });
}

function createCard(opp, index) {
  const isLiked = likedIds.has(opp.id);
  const dateStr = new Date(opp.created_at).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  return `
    <article class="card" style="animation-delay: ${index * 0.06}s">
      <div class="card-top">
        <div class="card-badges">
          <span class="badge badge-category">${escapeHtml(opp.category)}</span>
          <span class="badge badge-potential">${escapeHtml(opp.potential)}</span>
        </div>
        <div class="card-location">
          <span>📍</span> <span>${escapeHtml(opp.city)}, ${escapeHtml(opp.country)}</span>
        </div>
      </div>

      <h3 class="card-title">${escapeHtml(opp.name)}</h3>

      <div class="card-section">
        <div class="card-section-label">🔴 Problema</div>
        <p class="card-section-text">${escapeHtml(opp.problem)}</p>
      </div>

      <div class="card-section">
        <div class="card-section-label">🤖 Solución con IA</div>
        <p class="card-section-text card-solution-text">${escapeHtml(opp.ai_solution)}</p>
      </div>

      <div class="card-footer">
        <span class="card-date">${dateStr}</span>
        <button
          class="like-btn ${isLiked ? 'liked' : ''}"
          data-id="${opp.id}"
          data-likes="${opp.likes}"
          id="like-${opp.id}"
          aria-label="Dar like a esta oportunidad"
        >
          <span class="heart">${isLiked ? '❤️' : '🤍'}</span>
          <span class="like-count">${opp.likes}</span>
        </button>
      </div>
    </article>
  `;
}

// ============================================
// HANDLE LIKE
// ============================================
async function handleLike(e) {
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  const currentLikes = parseInt(btn.dataset.likes, 10);

  if (likedIds.has(id)) {
    showToast('¡Ya le diste like a esta oportunidad!', 'error');
    return;
  }

  const newLikes = currentLikes + 1;

  // Optimistic update
  btn.dataset.likes = newLikes;
  btn.querySelector('.like-count').textContent = newLikes;
  btn.querySelector('.heart').textContent = '❤️';
  btn.classList.add('liked');

  // Save to liked set
  likedIds.add(id);
  localStorage.setItem('likedOpportunities', JSON.stringify([...likedIds]));

  try {
    await updateLikes(id, newLikes);
    // Update local data
    const opp = allOpportunities.find(o => o.id === id);
    if (opp) opp.likes = newLikes;
    updateStats(allOpportunities);
    showToast('❤️ ¡Like registrado!');
  } catch (err) {
    console.error('Error updating likes:', err);
    // Revert on error
    btn.dataset.likes = currentLikes;
    btn.querySelector('.like-count').textContent = currentLikes;
    btn.querySelector('.heart').textContent = '🤍';
    btn.classList.remove('liked');
    likedIds.delete(id);
    localStorage.setItem('likedOpportunities', JSON.stringify([...likedIds]));
    showToast('Error al registrar el like.', 'error');
  }
}

// ============================================
// FILTERS
// ============================================
function applyFilters() {
  const city = filterCity.value.trim().toLowerCase();
  const country = filterCountry.value.trim().toLowerCase();
  const category = filterCategory.value;

  const filtered = allOpportunities.filter(opp => {
    const matchCity = !city || opp.city.toLowerCase().includes(city);
    const matchCountry = !country || opp.country.toLowerCase().includes(country);
    const matchCat = !category || opp.category === category;
    return matchCity && matchCountry && matchCat;
  });

  renderOpportunities(filtered);
}

function clearFilters() {
  filterCity.value = '';
  filterCountry.value = '';
  filterCategory.value = '';
  renderOpportunities(allOpportunities);
}

// ============================================
// STATS
// ============================================
function updateStats(data) {
  totalCountEl.textContent = data.length;
  const cities = new Set(data.map(o => o.city.toLowerCase())).size;
  const countries = new Set(data.map(o => o.country.toLowerCase())).size;
  const totalLikes = data.reduce((sum, o) => sum + (o.likes || 0), 0);
  totalCitiesEl.textContent = cities;
  totalCountriesEl.textContent = countries;
  totalLikesEl.textContent = totalLikes;
}

// ============================================
// MODAL
// ============================================
function openModal() {
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
  opportunityForm.reset();
}

// ============================================
// FORM SUBMIT
// ============================================
opportunityForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('fieldName').value.trim();
  const city = document.getElementById('fieldCity').value.trim();
  const country = document.getElementById('fieldCountry').value.trim();
  const problem = document.getElementById('fieldProblem').value.trim();
  const ai_solution = document.getElementById('fieldSolution').value.trim();
  const category = document.getElementById('fieldCategory').value;
  const potential = document.getElementById('fieldPotential').value;

  if (!name || !city || !country || !problem || !ai_solution || !category || !potential) {
    showToast('Por favor completa todos los campos.', 'error');
    return;
  }

  const submitBtn = document.getElementById('btnSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Publicando...';

  try {
    await insertOpportunity({ name, city, country, problem, ai_solution, category, potential, likes: 0 });
    closeModal();
    showToast('🚀 ¡Oportunidad publicada! Ya la pueden ver todos.');
    await fetchOpportunities(); // Reload from Supabase
  } catch (err) {
    console.error('Error inserting:', err);
    showToast('Error al publicar. Intenta de nuevo.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publicar Oportunidad';
  }
});

// ============================================
// TOAST
// ============================================
let toastTimer;
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type === 'error' ? 'error' : ''} show`;
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// ============================================
// HELPERS
// ============================================
function showLoading() {
  loadingState.style.display = 'flex';
  emptyState.style.display = 'none';
  grid.style.display = 'none';
}

function showEmpty() {
  loadingState.style.display = 'none';
  emptyState.style.display = 'flex';
  grid.style.display = 'none';
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// EVENT LISTENERS
// ============================================
document.getElementById('btnOpenModal').addEventListener('click', openModal);
document.getElementById('btnCloseModal').addEventListener('click', closeModal);
document.getElementById('btnCancelModal').addEventListener('click', closeModal);
document.getElementById('btnFilter').addEventListener('click', applyFilters);
document.getElementById('btnClear').addEventListener('click', clearFilters);

// Close modal clicking outside
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

// Close modal with Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Filter on Enter key in inputs
filterCity.addEventListener('keydown', e => e.key === 'Enter' && applyFilters());
filterCountry.addEventListener('keydown', e => e.key === 'Enter' && applyFilters());

// ============================================
// INIT
// ============================================
fetchOpportunities();
