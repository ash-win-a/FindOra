/**
 * Findora - Administrator Dashboard Client Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  await verifyAdminAccess();
  await loadAdminStats();
  await loadAdminUsers();
  await loadAdminItems();
  await loadAdminClaims();
});

/**
 * Verify Administrator Access
 */
async function verifyAdminAccess() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();

    if (!data.success || !data.isAuthenticated || data.user.role !== 'admin') {
      window.location.href = '/dashboard.html?error=admin_required';
    }
  } catch (err) {
    window.location.href = '/login.html';
  }
}

/**
 * Load System Statistics
 */
async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();

    if (data.success) {
      const s = data.stats;
      document.getElementById('stat-total-users').innerText = s.totalUsers;
      document.getElementById('stat-total-items').innerText = s.totalItems;
      document.getElementById('stat-active-items').innerText = s.activeItems;
      document.getElementById('stat-returned-items').innerText = s.returnedItems;
      document.getElementById('stat-total-claims').innerText = s.totalClaims;
      document.getElementById('stat-pending-claims').innerText = s.pendingClaims;
    }
  } catch (err) {
    console.error('Failed to load admin stats:', err);
  }
}

/**
 * Load Registered Users List
 */
async function loadAdminUsers() {
  const container = document.getElementById('admin-users-table');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/users');
    const data = await res.json();

    if (data.success) {
      let html = '';
      data.users.forEach(u => {
        const isAdmin = u.role === 'admin';
        const roleBadge = isAdmin
          ? '<span class="badge bg-primary">Administrator</span>'
          : '<span class="badge bg-secondary">User</span>';

        const toggleBtn = isAdmin
          ? `<button class="btn btn-outline-warning btn-sm" onclick="changeUserRole('${u._id}', 'user')">Demote to User</button>`
          : `<button class="btn btn-outline-teal btn-sm" onclick="changeUserRole('${u._id}', 'admin')">Promote to Admin</button>`;

        html += `
          <tr>
            <td class="fw-bold">${escapeHtml(u.name)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${escapeHtml(u.phone || 'N/A')}</td>
            <td>${roleBadge}</td>
            <td class="small text-muted">${formatDate(u.createdAt)}</td>
            <td class="text-end">${toggleBtn}</td>
          </tr>
        `;
      });
      container.innerHTML = html;
    }
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

/**
 * Change User Role
 */
async function changeUserRole(userId, newRole) {
  if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;

  try {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole })
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      loadAdminUsers();
    } else {
      showToast(data.message || 'Failed to update user role', 'error');
    }
  } catch (err) {
    showToast('Network error updating role', 'error');
  }
}

/**
 * Load Items for Admin Moderation
 */
async function loadAdminItems() {
  const container = document.getElementById('admin-items-table');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/items');
    const data = await res.json();

    if (data.success) {
      let html = '';
      data.items.forEach(item => {
        const isLost = item.itemType === 'lost';
        const typeBadge = isLost 
          ? '<span class="badge bg-danger">Lost</span>' 
          : '<span class="badge bg-teal">Found</span>';

        const ownerName = item.ownerId ? item.ownerId.name : 'Unknown';

        const statusAction = item.status === 'deactivated'
          ? `<button class="btn btn-outline-success btn-sm me-1" onclick="changeItemStatus('${item._id}', 'active')">Activate</button>`
          : `<button class="btn btn-outline-warning btn-sm me-1" onclick="changeItemStatus('${item._id}', 'deactivated')">Deactivate</button>`;

        html += `
          <tr>
            <td>${typeBadge}</td>
            <td class="fw-bold"><a href="/item-details.html?id=${item._id}" target="_blank" class="text-dark">${escapeHtml(item.title)}</a></td>
            <td><span class="badge bg-light text-secondary border">${escapeHtml(item.category)}</span></td>
            <td class="small">${escapeHtml(item.location)}</td>
            <td class="small">${escapeHtml(ownerName)}</td>
            <td>${renderStatusBadge(item.status)}</td>
            <td class="text-end">
              ${statusAction}
              <button class="btn btn-outline-danger btn-sm" onclick="adminDeleteItem('${item._id}')"><i class="fa-solid fa-trash-can"></i></button>
            </td>
          </tr>
        `;
      });
      container.innerHTML = html;
    }
  } catch (err) {
    console.error('Failed to load items:', err);
  }
}

/**
 * Change Item Status
 */
async function changeItemStatus(itemId, status) {
  try {
    const res = await fetch(`/api/admin/items/${itemId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      loadAdminItems();
      loadAdminStats();
    } else {
      showToast(data.message || 'Failed to update item status', 'error');
    }
  } catch (err) {
    showToast('Network error updating item', 'error');
  }
}

/**
 * Delete Item Listing as Admin
 */
async function adminDeleteItem(itemId) {
  if (!confirm('Are you sure you want to permanently delete this listing and its claims?')) return;

  try {
    const res = await fetch(`/api/admin/items/${itemId}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      loadAdminItems();
      loadAdminStats();
    } else {
      showToast(data.message || 'Failed to delete listing', 'error');
    }
  } catch (err) {
    showToast('Network error deleting item', 'error');
  }
}

/**
 * Load All Claims for Admin Review
 */
async function loadAdminClaims() {
  const container = document.getElementById('admin-claims-table');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/claims');
    const data = await res.json();

    if (data.success) {
      let html = '';
      data.claims.forEach(c => {
        const itemTitle = c.itemId ? c.itemId.title : 'N/A';
        const claimantName = c.claimantId ? c.claimantId.name : 'Unknown';

        html += `
          <tr>
            <td class="fw-bold">${escapeHtml(itemTitle)}</td>
            <td>${escapeHtml(claimantName)}</td>
            <td class="small" style="max-width: 250px;">${escapeHtml(c.claimDescription)}</td>
            <td class="small fw-semibold text-danger" style="max-width: 200px;">${escapeHtml(c.privateVerificationAnswer)}</td>
            <td>${renderStatusBadge(c.status)}</td>
            <td class="text-end">
              ${c.status === 'pending' ? `
                <button class="btn btn-teal btn-sm me-1" onclick="openReviewModal('${c._id}', 'approve')"><i class="fa-solid fa-check"></i></button>
                <button class="btn btn-outline-danger btn-sm" onclick="openReviewModal('${c._id}', 'reject')"><i class="fa-solid fa-xmark"></i></button>
              ` : `<span class="small text-muted">Reviewed</span>`}
            </td>
          </tr>
        `;
      });
      container.innerHTML = html;
    }
  } catch (err) {
    console.error('Failed to load admin claims:', err);
  }
}
