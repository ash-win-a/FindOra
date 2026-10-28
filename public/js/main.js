/**
 * Findora - Main Shared Client Scripts
 * Handles Authentication state, navigation bar updates, toasts, and utility helpers.
 */

let currentUser = null;

// Run as soon as DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthStatus();
  highlightActiveNav();
});

/**
 * Checks session authentication status with the server
 */
async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();

    if (data.success && data.isAuthenticated && data.user) {
      currentUser = data.user;
      renderAuthenticatedNav(data.user);
    } else {
      currentUser = null;
      renderGuestNav();
    }
  } catch (error) {
    console.warn('[Findora] Could not verify authentication state:', error);
    renderGuestNav();
  }
}

/**
 * Updates navbar for authenticated users
 */
function renderAuthenticatedNav(user) {
  const navContainer = document.getElementById('navbar-auth-links');
  if (!navContainer) return;

  const adminLink = user.role === 'admin' 
    ? `<li class="nav-item"><a class="nav-link text-warning fw-bold" href="/admin.html"><i class="fa-solid fa-shield-halved me-1"></i> Admin Panel</a></li>`
    : '';

  navContainer.innerHTML = `
    ${adminLink}
    <li class="nav-item">
      <a class="nav-link" href="/dashboard.html"><i class="fa-solid fa-gauge me-1"></i> Dashboard</a>
    </li>
    <li class="nav-item">
      <a class="nav-link" href="/my-claims.html"><i class="fa-solid fa-file-signature me-1"></i> My Claims</a>
    </li>
    <li class="nav-item dropdown">
      <a class="nav-link dropdown-toggle text-dark fw-semibold" href="#" id="userDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
        <i class="fa-regular fa-user-circle me-1 text-teal"></i> ${escapeHtml(user.name.split(' ')[0])}
      </a>
      <ul class="dropdown-menu dropdown-menu-end shadow-sm" aria-labelledby="userDropdown">
        <li class="dropdown-header text-muted small">${escapeHtml(user.email)}</li>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item" href="/report-lost.html"><i class="fa-solid fa-plus-circle me-2 text-danger"></i> Report Lost Item</a></li>
        <li><a class="dropdown-item" href="/report-found.html"><i class="fa-solid fa-plus-circle me-2 text-teal"></i> Report Found Item</a></li>
        <li><hr class="dropdown-divider"></li>
        <li><button class="dropdown-item text-danger" onclick="logoutUser()"><i class="fa-solid fa-arrow-right-from-bracket me-2"></i> Log Out</button></li>
      </ul>
    </li>
  `;
}

/**
 * Updates navbar for guest users
 */
function renderGuestNav() {
  const navContainer = document.getElementById('navbar-auth-links');
  if (!navContainer) return;

  navContainer.innerHTML = `
    <li class="nav-item me-2">
      <a class="btn btn-outline-navy btn-sm px-3" href="/login.html">Log In</a>
    </li>
    <li class="nav-item">
      <a class="btn btn-teal btn-sm px-3" href="/register.html">Register</a>
    </li>
  `;
}

/**
 * Handles logout action
 */
async function logoutUser() {
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Logged out successfully', 'info');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 600);
    }
  } catch (err) {
    showToast('Failed to log out. Please check network connection.', 'error');
  }
}

/**
 * Shows lightweight, animated toast message
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `custom-toast toast-${type}`;

  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="fa-solid ${icon} me-2 fs-5"></i>
      <div>${escapeHtml(message)}</div>
    </div>
    <button type="button" class="btn-close btn-close-sm ms-3" aria-label="Close" onclick="this.parentElement.remove()"></button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

/**
 * Formats ISO date string to human-readable format
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Generates status pill HTML
 */
function renderStatusBadge(status) {
  const s = (status || 'active').toLowerCase();
  switch (s) {
    case 'active':
      return `<span class="status-pill status-active"><i class="fa-solid fa-circle-dot"></i> Active</span>`;
    case 'claimed':
      return `<span class="status-pill status-claimed"><i class="fa-solid fa-hourglass-half"></i> Claimed</span>`;
    case 'returned':
      return `<span class="status-pill status-returned"><i class="fa-solid fa-circle-check"></i> Returned</span>`;
    case 'pending':
      return `<span class="status-pill status-pending"><i class="fa-solid fa-clock"></i> Pending Review</span>`;
    case 'approved':
      return `<span class="status-pill status-approved"><i class="fa-solid fa-check"></i> Approved</span>`;
    case 'rejected':
      return `<span class="status-pill status-rejected"><i class="fa-solid fa-xmark"></i> Rejected</span>`;
    case 'deactivated':
      return `<span class="status-pill status-deactivated"><i class="fa-solid fa-ban"></i> Deactivated</span>`;
    default:
      return `<span class="badge bg-secondary">${escapeHtml(status)}</span>`;
  }
}

/**
 * Highlights current navigation link
 */
function highlightActiveNav() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });
}

/**
 * Prevents XSS when rendering user strings
 */
function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Returns the Font Awesome icon class for each item category
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
 * Constructs the correct URL for uploaded item images:
 * - If the database contains a relative path such as /uploads/example.jpg, constructs the correct URL.
 * - Does not accidentally prepend the backend URL twice if already an absolute URL.
 * - Handles missing images by returning null.
 * - Normalizes Windows backslashes and relative paths.
 */
function getItemImageUrl(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') {
    return null;
  }

  let clean = imagePath.trim();
  if (!clean || clean === 'null' || clean === 'undefined') {
    return null;
  }

  // Normalize Windows backslashes (\) to forward slashes (/)
  clean = clean.replace(/\\/g, '/');

  // If already an absolute HTTP/HTTPS URL or data URI, return directly without double prepending
  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:')) {
    return clean;
  }

  // Ensure clean leading slash
  if (!clean.startsWith('/')) {
    clean = '/' + clean;
  }

  // If only filename was stored without /uploads/ prefix, prepend /uploads
  if (!clean.startsWith('/uploads/')) {
    clean = '/uploads' + clean;
  }

  // If page is loaded through file:// protocol, prepend local backend address
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.protocol === 'file:') {
      return 'http://localhost:3000' + clean;
    }
    // If running under a different local port (e.g. VS Code Live Server on 5500),
    // point to the Express backend on port 3000
    if (window.location.port && window.location.port !== '3000' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      const backendOrigin = `${window.location.protocol}//${window.location.hostname}:3000`;
      if (!clean.startsWith(backendOrigin)) {
        return backendOrigin + clean;
      }
    }
  }

  return clean;
}

/**
 * Gracefully handles broken or missing image URLs by replacing the <img> element
 * with the category placeholder icon.
 */
function handleImageError(imgElement, category) {
  if (!imgElement) return;
  imgElement.onerror = null; // Prevent recursion if placeholder fails
  const icon = getCategoryIcon(category);
  const placeholder = document.createElement('div');
  placeholder.className = 'item-card-placeholder';
  placeholder.innerHTML = `<i class="fa-solid ${icon}"></i>`;
  if (imgElement.parentElement) {
    imgElement.parentElement.replaceChild(placeholder, imgElement);
  }
}

