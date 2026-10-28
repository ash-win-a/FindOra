/**
 * Findora - Browse & Search Items Client Logic
 */

let currentFilters = {
  type: '',
  category: 'All',
  location: '',
  search: '',
  sort: 'newest',
  page: 1,
  limit: 12
};

let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  // Read any initial query parameters from URL
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('type')) currentFilters.type = urlParams.get('type');
  if (urlParams.get('category')) currentFilters.category = urlParams.get('category');
  if (urlParams.get('search')) currentFilters.search = urlParams.get('search');
  if (urlParams.get('location')) currentFilters.location = urlParams.get('location');

  syncFilterInputs();
  bindFilterEvents();
  fetchItems();
});

/**
 * Synchronizes HTML filter inputs with current filter state
 */
function syncFilterInputs() {
  const searchInput = document.getElementById('search-input');
  const categorySelect = document.getElementById('category-filter');
  const typeFilter = document.getElementById('type-filter');
  const locationInput = document.getElementById('location-filter');
  const sortSelect = document.getElementById('sort-filter');

  if (searchInput && currentFilters.search) searchInput.value = currentFilters.search;
  if (categorySelect && currentFilters.category) categorySelect.value = currentFilters.category;
  if (typeFilter && currentFilters.type) typeFilter.value = currentFilters.type;
  if (locationInput && currentFilters.location) locationInput.value = currentFilters.location;
  if (sortSelect && currentFilters.sort) sortSelect.value = currentFilters.sort;
}

/**
 * Binds input and button listeners for instant reactive filtering
 */
function bindFilterEvents() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value.trim();
        currentFilters.page = 1;
        fetchItems();
      }, 350);
    });
  }

  const categorySelect = document.getElementById('category-filter');
  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      currentFilters.category = e.target.value;
      currentFilters.page = 1;
      fetchItems();
    });
  }

  const typeFilter = document.getElementById('type-filter');
  if (typeFilter) {
    typeFilter.addEventListener('change', (e) => {
      currentFilters.type = e.target.value;
      currentFilters.page = 1;
      fetchItems();
    });
  }

  const locationInput = document.getElementById('location-filter');
  if (locationInput) {
    locationInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.location = e.target.value.trim();
        currentFilters.page = 1;
        fetchItems();
      }, 350);
    });
  }

  const sortSelect = document.getElementById('sort-filter');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentFilters.sort = e.target.value;
      currentFilters.page = 1;
      fetchItems();
    });
  }

  const clearBtn = document.getElementById('clear-filters-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', resetFilters);
  }
}

/**
 * Resets all filters back to default
 */
function resetFilters() {
  currentFilters = {
    type: '',
    category: 'All',
    location: '',
    search: '',
    sort: 'newest',
    page: 1,
    limit: 12
  };

  const searchInput = document.getElementById('search-input');
  const categorySelect = document.getElementById('category-filter');
  const typeFilter = document.getElementById('type-filter');
  const locationInput = document.getElementById('location-filter');
  const sortSelect = document.getElementById('sort-filter');

  if (searchInput) searchInput.value = '';
  if (categorySelect) categorySelect.value = 'All';
  if (typeFilter) typeFilter.value = '';
  if (locationInput) locationInput.value = '';
  if (sortSelect) sortSelect.value = 'newest';

  fetchItems();
}

/**
 * Fetches items from MongoDB via Express API
 */
async function fetchItems() {
  const container = document.getElementById('items-container');
  const countBadge = document.getElementById('results-count');
  if (!container) return;

  container.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-teal" role="status">
        <span class="visually-hidden">Loading items...</span>
      </div>
      <p class="text-muted mt-2">Searching Findora database...</p>
    </div>
  `;

  try {
    const params = new URLSearchParams();
    if (currentFilters.type) params.append('type', currentFilters.type);
    if (currentFilters.category && currentFilters.category !== 'All') params.append('category', currentFilters.category);
    if (currentFilters.location) params.append('location', currentFilters.location);
    if (currentFilters.search) params.append('search', currentFilters.search);
    if (currentFilters.sort) params.append('sort', currentFilters.sort);
    params.append('page', currentFilters.page);
    params.append('limit', currentFilters.limit);

    const res = await fetch(`/api/items?${params.toString()}`);
    const data = await res.json();

    if (data.success) {
      if (countBadge) {
        countBadge.innerText = `${data.pagination.total} item${data.pagination.total === 1 ? '' : 's'} found`;
      }
      renderItems(data.items, container);
      renderPagination(data.pagination);
    } else {
      container.innerHTML = `<div class="col-12 alert alert-warning">${escapeHtml(data.message)}</div>`;
    }
  } catch (error) {
    console.error('Fetch items error:', error);
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="fa-solid fa-triangle-exclamation text-danger fs-1 mb-3"></i>
        <h5>Could not connect to Findora server</h5>
        <p class="text-muted">Please verify the backend server is running on port 3000.</p>
      </div>
    `;
  }
}

/**
 * Renders item cards into grid
 */
function renderItems(items, container) {
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <div class="bg-white rounded-4 p-5 shadow-sm border mx-auto" style="max-width: 500px;">
          <i class="fa-regular fa-folder-open text-muted fs-1 mb-3"></i>
          <h4>No matching reports found</h4>
          <p class="text-muted mb-4">Try adjusting your keywords, changing category, or clearing filters to see more results.</p>
          <button class="btn btn-outline-navy px-4" onclick="resetFilters()">Reset All Filters</button>
        </div>
      </div>
    `;
    return;
  }

  let html = '';
  items.forEach(item => {
    const isLost = item.itemType === 'lost';
    const typeBadge = isLost 
      ? '<span class="item-badge-type badge-lost"><i class="fa-solid fa-circle-question me-1"></i> Lost</span>'
      : '<span class="item-badge-type badge-found"><i class="fa-solid fa-hand-holding-heart me-1"></i> Found</span>';

    const imageUrl = getItemImageUrl(item.imagePath);
    const categoryIcon = getCategoryIcon(item.category);

    const imageHtml = imageUrl 
      ? `<img src="${escapeHtml(imageUrl)}" class="item-card-img" alt="${escapeHtml(item.title)}" onerror="handleImageError(this, '${escapeHtml(item.category)}')">`
      : `<div class="item-card-placeholder"><i class="fa-solid ${categoryIcon}"></i></div>`;

    html += `
      <div class="col-lg-4 col-md-6 mb-4">
        <div class="card-custom">
          <div class="item-card-img-wrapper">
            ${imageHtml}
            ${typeBadge}
          </div>
          <div class="p-3 d-flex flex-column flex-grow-1">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="badge bg-light text-secondary border small">${escapeHtml(item.category)}</span>
              ${renderStatusBadge(item.status)}
            </div>
            <h5 class="fw-bold text-dark mt-2 mb-1 text-truncate" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h5>
            <p class="text-muted small mb-2 text-truncate-2" style="min-height: 40px;">${escapeHtml(item.description)}</p>
            
            <div class="small text-secondary mb-3 mt-auto">
              <div><i class="fa-solid fa-location-dot text-danger me-1"></i> ${escapeHtml(item.location)}</div>
              <div><i class="fa-regular fa-calendar text-teal me-1"></i> ${formatDate(item.reportDate)}</div>
              ${item.color ? `<div><i class="fa-solid fa-palette text-muted me-1"></i> Color: ${escapeHtml(item.color)}</div>` : ''}
            </div>

            <a href="/item-details.html?id=${item._id}" class="btn btn-navy btn-sm w-100 py-2">
              <i class="fa-solid fa-arrow-up-right-from-square me-1"></i> View Details
            </a>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Returns appropriate icon for each category
 */
function getCategoryIcon(category) {
  switch (category) {
    case 'Electronics': return 'fa-laptop';
    case 'Bags': return 'fa-briefcase';
    case 'Wallets and Cards': return 'fa-wallet';
    case 'Documents': return 'fa-id-card';
    case 'Keys': return 'fa-key';
    case 'Clothing': return 'fa-shirt';
    case 'Accessories': return 'fa-gem';
    case 'Books': return 'fa-book';
    default: return 'fa-box-open';
  }
}

/**
 * Renders pagination controls
 */
function renderPagination(pagination) {
  const container = document.getElementById('pagination-container');
  if (!container) return;

  if (pagination.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `<ul class="pagination justify-content-center">`;

  // Previous
  html += `
    <li class="page-item ${pagination.page === 1 ? 'disabled' : ''}">
      <button class="page-link" onclick="changePage(${pagination.page - 1})">&laquo; Prev</button>
    </li>
  `;

  // Pages
  for (let i = 1; i <= pagination.totalPages; i++) {
    html += `
      <li class="page-item ${pagination.page === i ? 'active' : ''}">
        <button class="page-link" onclick="changePage(${i})">${i}</button>
      </li>
    `;
  }

  // Next
  html += `
    <li class="page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}">
      <button class="page-link" onclick="changePage(${pagination.page + 1})">Next &raquo;</button>
    </li>
  `;

  html += `</ul>`;
  container.innerHTML = html;
}

function changePage(newPage) {
  currentFilters.page = newPage;
  fetchItems();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
