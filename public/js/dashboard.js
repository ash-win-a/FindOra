/**
 * Findora - User Dashboard Client Logic
 */

let myLostItems = [];
let myFoundItems = [];
let myClaimsList = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardData();
  bindEditForm();
});

/**
 * Loads user dashboard statistics, items, and claims
 */
async function loadDashboardData() {
  try {
    // 1. Verify user authentication
    const authRes = await fetch('/api/auth/me');
    const authData = await authRes.json();

    if (!authData.success || !authData.isAuthenticated) {
      window.location.href = '/login.html?redirect=/dashboard.html';
      return;
    }

    const userNameEl = document.getElementById('user-welcome-name');
    if (userNameEl) {
      userNameEl.innerText = authData.user.name;
    }

    // 2. Fetch user's reported items
    const itemsRes = await fetch('/api/items/user/my-items');
    const itemsData = await itemsRes.json();

    if (itemsData.success) {
      myLostItems = itemsData.lostItems || [];
      myFoundItems = itemsData.foundItems || [];
    }

    // 3. Fetch user's claims
    const claimsRes = await fetch('/api/claims/my-claims');
    const claimsData = await claimsRes.json();

    if (claimsData.success) {
      myClaimsList = claimsData.claims || [];
    }

    // 4. Update Summary Counters
    updateSummaryStats();

    // 5. Render Sections
    renderLostItemsTable();
    renderFoundItemsTable();
    renderClaimsTable();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showToast('Failed to load dashboard data. Please refresh.', 'error');
  }
}

/**
 * Calculates and updates summary counters
 */
function updateSummaryStats() {
  const lostCountEl = document.getElementById('stat-lost-count');
  const foundCountEl = document.getElementById('stat-found-count');
  const pendingCountEl = document.getElementById('stat-pending-claims');
  const approvedCountEl = document.getElementById('stat-approved-claims');

  if (lostCountEl) lostCountEl.innerText = myLostItems.length;
  if (foundCountEl) foundCountEl.innerText = myFoundItems.length;

  const pendingClaims = myClaimsList.filter(c => c.status === 'pending').length;
  const approvedClaims = myClaimsList.filter(c => c.status === 'approved').length;

  if (pendingCountEl) pendingCountEl.innerText = pendingClaims;
  if (approvedCountEl) approvedCountEl.innerText = approvedClaims;
}

/**
 * Renders My Lost Items tab
 */
function renderLostItemsTable() {
  const container = document.getElementById('lost-items-container');
  if (!container) return;

  if (myLostItems.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="fa-regular fa-folder text-muted fs-1 mb-2"></i>
        <h5>No lost item reports yet</h5>
        <p class="text-muted mb-3">If you have misplaced an item on campus, report it to enable intelligent matching.</p>
        <a href="/report-lost.html" class="btn btn-navy btn-sm"><i class="fa-solid fa-plus me-1"></i> Report Lost Item</a>
      </div>
    `;
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th>Item</th>
            <th>Category</th>
            <th>Location</th>
            <th>Report Date</th>
            <th>Status</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
  `;

  myLostItems.forEach(item => {
    html += `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            ${(() => {
              const imgUrl = getItemImageUrl(item.imagePath);
              const icon = getCategoryIcon(item.category);
              return imgUrl 
                ? `<img src="${escapeHtml(imgUrl)}" class="rounded me-2" style="width: 44px; height: 44px; object-fit: cover;" alt="" onerror="this.onerror=null; this.outerHTML='<div class=\\'rounded bg-light text-secondary d-flex align-items-center justify-content-center me-2\\' style=\\'width: 44px; height: 44px;\\'><i class=\\'fa-solid ${icon}\\'></i></div>';">` 
                : `<div class="rounded bg-light text-secondary d-flex align-items-center justify-content-center me-2" style="width: 44px; height: 44px;"><i class="fa-solid ${icon}"></i></div>`;
            })()}
            <div>
              <div class="fw-bold text-dark">${escapeHtml(item.title)}</div>
              <small class="text-muted">${escapeHtml(item.color || 'No color specified')}</small>
            </div>
          </div>
        </td>
        <td><span class="badge bg-light text-secondary border">${escapeHtml(item.category)}</span></td>
        <td class="small text-secondary">${escapeHtml(item.location)}</td>
        <td class="small text-secondary">${formatDate(item.reportDate)}</td>
        <td>${renderStatusBadge(item.status)}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-teal" onclick="viewMatches('${item._id}')" title="Find Intelligent Matches">
              <i class="fa-solid fa-wand-magic-sparkles me-1"></i> Matches
            </button>
            <a href="/item-details.html?id=${item._id}" class="btn btn-outline-secondary" title="View details">
              <i class="fa-regular fa-eye"></i>
            </a>
            <button class="btn btn-outline-primary" onclick="openEditModal('${item._id}')" title="Edit">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-outline-danger" onclick="deleteItem('${item._id}')" title="Delete">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

/**
 * Renders My Found Items tab
 */
function renderFoundItemsTable() {
  const container = document.getElementById('found-items-container');
  if (!container) return;

  if (myFoundItems.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="fa-regular fa-folder text-muted fs-1 mb-2"></i>
        <h5>No found item reports yet</h5>
        <p class="text-muted mb-3">If you found someone's lost belongings, report them here to help reunite them with their rightful owner.</p>
        <a href="/report-found.html" class="btn btn-teal btn-sm"><i class="fa-solid fa-plus me-1"></i> Report Found Item</a>
      </div>
    `;
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th>Item</th>
            <th>Category</th>
            <th>Location</th>
            <th>Report Date</th>
            <th>Status</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
  `;

  myFoundItems.forEach(item => {
    html += `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            ${(() => {
              const imgUrl = getItemImageUrl(item.imagePath);
              const icon = getCategoryIcon(item.category);
              return imgUrl 
                ? `<img src="${escapeHtml(imgUrl)}" class="rounded me-2" style="width: 44px; height: 44px; object-fit: cover;" alt="" onerror="this.onerror=null; this.outerHTML='<div class=\\'rounded bg-light text-secondary d-flex align-items-center justify-content-center me-2\\' style=\\'width: 44px; height: 44px;\\'><i class=\\'fa-solid ${icon}\\'></i></div>';">` 
                : `<div class="rounded bg-light text-secondary d-flex align-items-center justify-content-center me-2" style="width: 44px; height: 44px;"><i class="fa-solid ${icon}"></i></div>`;
            })()}
            <div>
              <div class="fw-bold text-dark">${escapeHtml(item.title)}</div>
              <small class="text-muted">${escapeHtml(item.color || 'No color specified')}</small>
            </div>
          </div>
        </td>
        <td><span class="badge bg-light text-secondary border">${escapeHtml(item.category)}</span></td>
        <td class="small text-secondary">${escapeHtml(item.location)}</td>
        <td class="small text-secondary">${formatDate(item.reportDate)}</td>
        <td>${renderStatusBadge(item.status)}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <a href="/claim-verification.html?itemId=${item._id}" class="btn btn-outline-teal" title="Review Incoming Claims">
              <i class="fa-solid fa-shield-check me-1"></i> Review Claims
            </a>
            <a href="/item-details.html?id=${item._id}" class="btn btn-outline-secondary" title="View details">
              <i class="fa-regular fa-eye"></i>
            </a>
            <button class="btn btn-outline-primary" onclick="openEditModal('${item._id}')" title="Edit">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-outline-danger" onclick="deleteItem('${item._id}')" title="Delete">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

/**
 * Renders My Claims tab
 */
function renderClaimsTable() {
  const container = document.getElementById('claims-container');
  if (!container) return;

  if (myClaimsList.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="fa-regular fa-file-lines text-muted fs-1 mb-2"></i>
        <h5>No claims submitted yet</h5>
        <p class="text-muted mb-3">If you spot a found item in the listings that belongs to you, submit a verified claim.</p>
        <a href="/browse.html?type=found" class="btn btn-navy btn-sm"><i class="fa-solid fa-magnifying-glass me-1"></i> Browse Found Items</a>
      </div>
    `;
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th>Claimed Item</th>
            <th>Your Explanation</th>
            <th>Submitted On</th>
            <th>Status</th>
            <th>Review Note</th>
          </tr>
        </thead>
        <tbody>
  `;

  myClaimsList.forEach(claim => {
    const itemTitle = claim.itemId ? claim.itemId.title : 'Item Removed';
    const itemLink = claim.itemId ? `/item-details.html?id=${claim.itemId._id}` : '#';

    html += `
      <tr>
        <td>
          <a href="${itemLink}" class="fw-bold text-dark text-decoration-none">
            ${escapeHtml(itemTitle)}
          </a>
        </td>
        <td class="small text-secondary" style="max-width: 250px;">
          ${escapeHtml(claim.claimDescription)}
        </td>
        <td class="small text-secondary">${formatDate(claim.createdAt)}</td>
        <td>${renderStatusBadge(claim.status)}</td>
        <td class="small text-muted">
          ${claim.reviewNote ? escapeHtml(claim.reviewNote) : '<em>Awaiting finder review</em>'}
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

/**
 * Trigger Intelligent Matching from Dashboard
 */
async function viewMatches(itemId) {
  try {
    const res = await fetch(`/api/items/${itemId}/matches`);
    const data = await res.json();

    if (data.success) {
      if (data.matches.length === 0) {
        showToast('No counterpart matches above 30% similarity threshold found at this time.', 'info');
      } else {
        showMatchesModal(data.targetItem, data.matches);
      }
    } else {
      showToast(data.message || 'Could not fetch matches', 'error');
    }
  } catch (err) {
    showToast('Failed to calculate matches', 'error');
  }
}

/**
 * Delete Item with Confirmation
 */
async function deleteItem(itemId) {
  if (!confirm('Are you sure you want to permanently delete this report? This cannot be undone.')) {
    return;
  }

  try {
    const res = await fetch(`/api/items/${itemId}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      showToast('Report deleted successfully.', 'success');
      await loadDashboardData();
    } else {
      showToast(data.message || 'Failed to delete report.', 'error');
    }
  } catch (err) {
    showToast('Network error while deleting item.', 'error');
  }
}

/**
 * Open Edit Modal
 */
async function openEditModal(itemId) {
  try {
    const res = await fetch(`/api/items/${itemId}`);
    const data = await res.json();

    if (!data.success || !data.item) {
      showToast('Could not load item details', 'error');
      return;
    }

    const item = data.item;
    document.getElementById('edit-item-id').value = item._id;
    document.getElementById('edit-title').value = item.title;
    document.getElementById('edit-category').value = item.category;
    document.getElementById('edit-description').value = item.description;
    document.getElementById('edit-brand').value = item.brand || '';
    document.getElementById('edit-color').value = item.color || '';
    document.getElementById('edit-location').value = item.location;
    document.getElementById('edit-status').value = item.status;

    const modal = new bootstrap.Modal(document.getElementById('editItemModal'));
    modal.show();
  } catch (err) {
    showToast('Failed to open editor', 'error');
  }
}

/**
 * Bind Edit Form Submission
 */
function bindEditForm() {
  const form = document.getElementById('edit-item-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const itemId = document.getElementById('edit-item-id').value;

    const payload = {
      title: document.getElementById('edit-title').value.trim(),
      category: document.getElementById('edit-category').value,
      description: document.getElementById('edit-description').value.trim(),
      brand: document.getElementById('edit-brand').value.trim(),
      color: document.getElementById('edit-color').value.trim(),
      location: document.getElementById('edit-location').value.trim(),
      status: document.getElementById('edit-status').value
    };

    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showToast('Report updated successfully!', 'success');
        const modalEl = document.getElementById('editItemModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        await loadDashboardData();
      } else {
        showToast(data.message || 'Failed to update report', 'error');
      }
    } catch (err) {
      showToast('Network error updating item', 'error');
    }
  });
}
