/**
 * Findora - Report Lost and Found Items Client Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const reportForm = document.getElementById('report-item-form');
  const imageInput = document.getElementById('image');
  const dateInput = document.getElementById('reportDate');

  // Set default reportDate to today (format YYYY-MM-DD)
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.max = today; // Prevent future dates
  }

  // Bind image file preview
  if (imageInput) {
    imageInput.addEventListener('change', handleImagePreview);
  }

  // Bind form submission
  if (reportForm) {
    reportForm.addEventListener('submit', handleReportSubmit);
  }
});

/**
 * Handle Image Preview & File Validation
 */
function handleImagePreview(e) {
  const file = e.target.files[0];
  const previewContainer = document.getElementById('image-preview-container');
  const previewImg = document.getElementById('image-preview');

  if (!file) {
    if (previewContainer) previewContainer.style.display = 'none';
    return;
  }

  // Check file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    showToast('Invalid file format. Please upload a JPG, PNG, WEBP, or GIF image.', 'error');
    e.target.value = '';
    if (previewContainer) previewContainer.style.display = 'none';
    return;
  }

  // Check file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image size exceeds 5MB limit. Please choose a smaller image.', 'error');
    e.target.value = '';
    if (previewContainer) previewContainer.style.display = 'none';
    return;
  }

  // Read and preview
  const reader = new FileReader();
  reader.onload = (event) => {
    if (previewImg && previewContainer) {
      previewImg.src = event.target.result;
      previewContainer.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}

/**
 * Handle Report Form Submission
 */
async function handleReportSubmit(e) {
  e.preventDefault();
  const alertContainer = document.getElementById('report-alert');
  const submitBtn = document.getElementById('submit-btn');

  if (alertContainer) alertContainer.innerHTML = '';

  const itemType = document.getElementById('itemType').value;
  const title = document.getElementById('title').value.trim();
  const category = document.getElementById('category').value;
  const description = document.getElementById('description').value.trim();
  const location = document.getElementById('location').value.trim();
  const reportDate = document.getElementById('reportDate').value;
  const brand = document.getElementById('brand') ? document.getElementById('brand').value.trim() : '';
  const color = document.getElementById('color') ? document.getElementById('color').value.trim() : '';
  const privateVerificationQuestion = document.getElementById('privateVerificationQuestion') 
    ? document.getElementById('privateVerificationQuestion').value.trim() 
    : '';
  const additionalDetails = document.getElementById('additionalDetails') 
    ? document.getElementById('additionalDetails').value.trim() 
    : '';

  // Frontend Validation
  if (!title || !category || !description || !location || !reportDate) {
    showAlert(alertContainer, 'Please fill in all mandatory fields (Title, Category, Description, Location, Date).', 'danger');
    return;
  }

  // Validate non-future date
  const selectedDate = new Date(reportDate);
  const now = new Date();
  if (selectedDate > new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
    showAlert(alertContainer, 'Report date cannot be in the future.', 'danger');
    return;
  }

  const formData = new FormData();
  formData.append('itemType', itemType);
  formData.append('title', title);
  formData.append('category', category);
  formData.append('description', description);
  formData.append('location', location);
  formData.append('reportDate', reportDate);
  formData.append('brand', brand);
  formData.append('color', color);
  formData.append('privateVerificationQuestion', privateVerificationQuestion);
  formData.append('additionalDetails', additionalDetails);

  const imageInput = document.getElementById('image');
  if (imageInput && imageInput.files[0]) {
    formData.append('image', imageInput.files[0]);
  }

  setLoading(submitBtn, true, 'Submitting Report...');

  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      showToast(`${itemType === 'lost' ? 'Lost' : 'Found'} item submitted successfully!`, 'success');

      // Check if immediate potential matches were found
      if (data.potentialMatchesCount > 0) {
        showMatchesModal(data.item, data.topMatches);
      } else {
        showAlert(alertContainer, 'Report submitted successfully! Redirecting to your dashboard...', 'success');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 1200);
      }
    } else {
      if (res.status === 401) {
        showAlert(alertContainer, 'You must be logged in to report an item. Redirecting to login...', 'warning');
        setTimeout(() => {
          window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        }, 1500);
      } else {
        showAlert(alertContainer, data.message || 'Failed to submit report. Please check input fields.', 'danger');
        setLoading(submitBtn, false, 'Submit Report');
      }
    }
  } catch (error) {
    console.error('Report submission error:', error);
    showAlert(alertContainer, 'A network error occurred while submitting your report.', 'danger');
    setLoading(submitBtn, false, 'Submit Report');
  }
}

/**
 * Display immediate matches modal
 */
function showMatchesModal(newItem, matches) {
  let modalEl = document.getElementById('matchesModal');
  if (!modalEl) {
    const div = document.createElement('div');
    div.id = 'matchesModalContainer';
    div.innerHTML = `
      <div class="modal fade" id="matchesModal" tabindex="-1" aria-labelledby="matchesModalLabel" aria-hidden="true" data-bs-backdrop="static">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content border-0 shadow">
            <div class="modal-header bg-navy text-white">
              <h5 class="modal-title" id="matchesModalLabel">
                <i class="fa-solid fa-wand-magic-sparkles text-teal me-2"></i> Intelligent Item Matches Found!
              </h5>
            </div>
            <div class="modal-body p-4" id="matchesModalBody"></div>
            <div class="modal-footer">
              <a href="/dashboard.html" class="btn btn-navy">Go to My Dashboard</a>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    modalEl = document.getElementById('matchesModal');
  }

  const bodyEl = document.getElementById('matchesModalBody');
  let listHtml = `
    <div class="alert alert-info">
      <i class="fa-solid fa-circle-info me-1"></i>
      Our intelligent matching algorithm identified <strong>${matches.length} possible counterpart${matches.length > 1 ? 's' : ''}</strong> in the database that closely correspond to your report!
    </div>
  `;

  matches.forEach(m => {
    const badgeClass = m.matchScore >= 75 ? 'match-score-strong' : 'match-score-possible';
    listHtml += `
      <div class="match-card">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 class="fw-bold mb-0">${escapeHtml(m.item.title)}</h5>
          <span class="match-score-badge ${badgeClass}">${m.matchScore}% Match</span>
        </div>
        <p class="text-muted small mb-2"><i class="fa-solid fa-location-dot text-danger me-1"></i> ${escapeHtml(m.item.location)} | <i class="fa-regular fa-calendar text-teal me-1"></i> ${formatDate(m.item.reportDate)}</p>
        <div class="bg-light p-2 rounded small mb-2 text-dark">
          <strong>Matching Factors:</strong> ${escapeHtml(m.explanation)}
        </div>
        <div class="text-end">
          <a href="/item-details.html?id=${m.item._id}" class="btn btn-sm btn-outline-navy">
            View Counterpart Details &amp; Claim &raquo;
          </a>
        </div>
      </div>
    `;
  });

  bodyEl.innerHTML = listHtml;
  const bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();
}

function showAlert(container, message, type) {
  if (!container) return;
  container.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show d-flex align-items-center" role="alert">
      <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} me-2 fs-5"></i>
      <div>${escapeHtml(message)}</div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}

function setLoading(button, isLoading, text) {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> ${text}`;
  } else {
    button.disabled = false;
    button.innerHTML = text;
  }
}
