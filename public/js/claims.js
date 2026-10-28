/**
 * Findora - Claims & Verification Client Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const claimForm = document.getElementById('submit-claim-form');
  if (claimForm) {
    claimForm.addEventListener('submit', handleClaimSubmission);
  }

  // If on claim-verification.html, load claims for specified itemId
  if (window.location.pathname.includes('claim-verification.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('itemId');
    if (itemId) {
      loadItemClaimsForReview(itemId);
    } else {
      showToast('No Item ID specified for verification.', 'error');
    }
  }

  // If on my-claims.html, load user claims
  if (window.location.pathname.includes('my-claims.html')) {
    loadMyClaimsPage();
  }
});

/**
 * Handle Claim Form Submission on item-details.html
 */
async function handleClaimSubmission(e) {
  e.preventDefault();
  const alertContainer = document.getElementById('claim-alert');
  const submitBtn = document.getElementById('claim-submit-btn');

  if (alertContainer) alertContainer.innerHTML = '';

  const itemId = document.getElementById('claim-item-id').value;
  const claimDescription = document.getElementById('claim-description').value.trim();
  const privateVerificationAnswer = document.getElementById('claim-answer').value.trim();

  if (!claimDescription || claimDescription.length < 10) {
    showClaimAlert('Please provide a descriptive explanation (at least 10 characters).', 'danger');
    return;
  }

  if (!privateVerificationAnswer || privateVerificationAnswer.length < 3) {
    showClaimAlert('Please provide your private verification answer or distinctive identifying details.', 'danger');
    return;
  }

  setLoading(submitBtn, true, 'Submitting Claim...');

  try {
    const res = await fetch('/api/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId,
        claimDescription,
        privateVerificationAnswer
      })
    });

    const data = await res.json();

    if (data.success) {
      showToast('Claim submitted successfully!', 'success');
      showClaimAlert('Your claim has been submitted to the finder for review. You can track its status in My Claims.', 'success');
      setTimeout(() => {
        window.location.href = '/my-claims.html';
      }, 1500);
    } else {
      if (res.status === 401) {
        showClaimAlert('Please log in to submit a claim.', 'warning');
        setTimeout(() => {
          window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.href)}`;
        }, 1500);
      } else {
        showClaimAlert(data.message || 'Failed to submit claim.', 'danger');
        setLoading(submitBtn, false, 'Submit Claim');
      }
    }
  } catch (error) {
    console.error('Claim submit error:', error);
    showClaimAlert('A network error occurred while submitting your claim.', 'danger');
    setLoading(submitBtn, false, 'Submit Claim');
  }
}

/**
 * Load Incoming Claims for an Item (Claim Verification Workflow)
 */
async function loadItemClaimsForReview(itemId) {
  const container = document.getElementById('verification-claims-container');
  const itemHeader = document.getElementById('item-header-info');
  if (!container) return;

  try {
    const res = await fetch(`/api/claims/item/${itemId}`);
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `
        <div class="alert alert-danger">
          <i class="fa-solid fa-triangle-exclamation me-2"></i> ${escapeHtml(data.message || 'Unauthorized')}
        </div>
      `;
      return;
    }

    if (itemHeader) {
      itemHeader.innerHTML = `
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h3 class="fw-bold text-navy mb-1">${escapeHtml(data.item.title)}</h3>
            <div class="text-secondary small">
              <span class="badge bg-light text-dark border me-2">${escapeHtml(data.item.category)}</span>
              <i class="fa-solid fa-location-dot text-danger me-1"></i> ${escapeHtml(data.item.location)}
            </div>
            ${data.item.privateVerificationQuestion ? `
              <div class="mt-2 text-primary fw-semibold small bg-light p-2 rounded border">
                <i class="fa-solid fa-circle-question me-1"></i> Your Verification Question: "${escapeHtml(data.item.privateVerificationQuestion)}"
              </div>
            ` : ''}
          </div>
          <div>
            ${renderStatusBadge(data.item.status)}
            ${data.item.status === 'claimed' ? `
              <button class="btn btn-sm btn-teal ms-2" onclick="markItemAsReturned('${data.item._id}')">
                <i class="fa-solid fa-circle-check me-1"></i> Mark as Returned
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    if (!data.claims || data.claims.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 bg-white rounded-3 border">
          <i class="fa-regular fa-clipboard text-muted fs-1 mb-2"></i>
          <h5>No claims submitted for this item yet</h5>
          <p class="text-muted">When a student identifies this item as theirs and submits proof, their answers will appear here for your verification.</p>
        </div>
      `;
      return;
    }

    let html = '';
    data.claims.forEach((claim, idx) => {
      const claimantName = claim.claimantId ? claim.claimantId.name : 'Unknown User';
      const claimantEmail = claim.claimantId ? claim.claimantId.email : 'N/A';
      const claimantPhone = claim.claimantId && claim.claimantId.phone ? claim.claimantId.phone : 'Not provided';

      html += `
        <div class="card shadow-sm border mb-4">
          <div class="card-header bg-white d-flex justify-content-between align-items-center py-3">
            <div>
              <span class="fw-bold text-navy">Claim #${idx + 1} from ${escapeHtml(claimantName)}</span>
              <span class="text-muted small ms-2">(${formatDate(claim.createdAt)})</span>
            </div>
            <div>${renderStatusBadge(claim.status)}</div>
          </div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label text-muted small text-uppercase">Claimant Explanation</label>
                <div class="p-3 bg-light rounded text-dark mb-2">
                  ${escapeHtml(claim.claimDescription)}
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label text-muted small text-uppercase text-danger fw-bold">
                  <i class="fa-solid fa-lock me-1"></i> Private Verification Answer (Confidential)
                </label>
                <div class="p-3 bg-light border-start border-3 border-danger rounded text-dark mb-2 fw-semibold">
                  ${escapeHtml(claim.privateVerificationAnswer)}
                </div>
              </div>
            </div>

            <div class="small text-muted mt-2 border-top pt-2">
              <i class="fa-solid fa-envelope me-1"></i> ${escapeHtml(claimantEmail)} | 
              <i class="fa-solid fa-phone me-1 ms-2"></i> ${escapeHtml(claimantPhone)}
            </div>

            ${claim.reviewNote ? `
              <div class="mt-3 p-2 bg-warning-subtle text-dark rounded small">
                <strong>Review Decision Note:</strong> ${escapeHtml(claim.reviewNote)}
              </div>
            ` : ''}

            ${claim.status === 'pending' ? `
              <div class="mt-3 pt-3 border-top text-end">
                <button class="btn btn-outline-danger btn-sm me-2" onclick="openReviewModal('${claim._id}', 'reject')">
                  <i class="fa-solid fa-xmark me-1"></i> Reject Claim
                </button>
                <button class="btn btn-teal btn-sm" onclick="openReviewModal('${claim._id}', 'approve')">
                  <i class="fa-solid fa-check me-1"></i> Approve Ownership Claim
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading verification claims:', error);
    container.innerHTML = `<div class="alert alert-danger">Error retrieving claims data.</div>`;
  }
}

/**
 * Opens Claim Review Decision Modal
 */
function openReviewModal(claimId, action) {
  let modalEl = document.getElementById('reviewClaimModal');
  if (!modalEl) {
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="modal fade" id="reviewClaimModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow">
            <div class="modal-header">
              <h5 class="modal-title fw-bold" id="reviewModalTitle">Review Claim</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
              <input type="hidden" id="modal-claim-id">
              <input type="hidden" id="modal-review-action">
              <p id="modal-review-desc" class="mb-3"></p>
              <div class="mb-3">
                <label for="modal-review-note" class="form-label">Review Note / Handover Instructions</label>
                <textarea id="modal-review-note" class="form-control" rows="3" placeholder="Provide instructions on where/when the claimant can collect the item, or reason for rejection..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-teal" id="modal-confirm-btn" onclick="submitClaimReview()">Confirm Decision</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    modalEl = document.getElementById('reviewClaimModal');
  }

  document.getElementById('modal-claim-id').value = claimId;
  document.getElementById('modal-review-action').value = action;
  const descEl = document.getElementById('modal-review-desc');
  const confirmBtn = document.getElementById('modal-confirm-btn');

  if (action === 'approve') {
    document.getElementById('reviewModalTitle').innerText = 'Approve Ownership Claim';
    descEl.innerHTML = `<span class="text-success fw-bold">Are you sure the private verification details match?</span> Approving this claim marks the item as Claimed and provides contact details to reunite.`;
    confirmBtn.className = 'btn btn-teal';
    confirmBtn.innerText = 'Approve Claim';
  } else {
    document.getElementById('reviewModalTitle').innerText = 'Reject Claim';
    descEl.innerHTML = `<span class="text-danger fw-bold">Are you sure you want to reject this claim?</span> The claimant will be notified with your review note.`;
    confirmBtn.className = 'btn btn-danger';
    confirmBtn.innerText = 'Reject Claim';
  }

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

/**
 * Submits the claim review decision to the backend
 */
async function submitClaimReview() {
  const claimId = document.getElementById('modal-claim-id').value;
  const action = document.getElementById('modal-review-action').value;
  const reviewNote = document.getElementById('modal-review-note').value.trim();

  try {
    const res = await fetch(`/api/claims/${claimId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reviewNote })
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      const modal = bootstrap.Modal.getInstance(document.getElementById('reviewClaimModal'));
      if (modal) modal.hide();

      // Reload
      const urlParams = new URLSearchParams(window.location.search);
      const itemId = urlParams.get('itemId');
      if (itemId) loadItemClaimsForReview(itemId);
    } else {
      showToast(data.message || 'Failed to submit review.', 'error');
    }
  } catch (err) {
    showToast('Network error during review.', 'error');
  }
}

/**
 * Mark item as Returned / Reunited
 */
async function markItemAsReturned(itemId) {
  if (!confirm('Confirm that this item has been successfully handed over and returned to its verified owner?')) {
    return;
  }

  try {
    const res = await fetch(`/api/claims/item/${itemId}/return`, {
      method: 'PUT'
    });
    const data = await res.json();

    if (data.success) {
      showToast('Item successfully marked as Returned!', 'success');
      loadItemClaimsForReview(itemId);
    } else {
      showToast(data.message || 'Failed to update item status.', 'error');
    }
  } catch (err) {
    showToast('Network error marking returned.', 'error');
  }
}

/**
 * Load standalone My Claims page (`my-claims.html`)
 */
async function loadMyClaimsPage() {
  const container = document.getElementById('my-claims-list-container');
  if (!container) return;

  try {
    const res = await fetch('/api/claims/my-claims');
    const data = await res.json();

    if (!data.success) {
      window.location.href = '/login.html?redirect=/my-claims.html';
      return;
    }

    if (data.claims.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 bg-white rounded-3 border">
          <i class="fa-regular fa-clipboard text-muted fs-1 mb-2"></i>
          <h5>You have not submitted any claims</h5>
          <p class="text-muted mb-3">Browse reported found belongings and submit a claim if you spot your lost item.</p>
          <a href="/browse.html?type=found" class="btn btn-navy"><i class="fa-solid fa-magnifying-glass me-1"></i> Browse Found Items</a>
        </div>
      `;
      return;
    }

    let html = '';
    data.claims.forEach(c => {
      const item = c.itemId;
      const title = item ? item.title : 'Item Unavailable';
      const itemLink = item ? `/item-details.html?id=${item._id}` : '#';

      html += `
        <div class="card shadow-sm border mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <a href="${itemLink}" class="h5 fw-bold text-dark text-decoration-none">${escapeHtml(title)}</a>
                <div class="text-secondary small mt-1">
                  ${item ? `<span class="badge bg-light text-secondary border me-2">${escapeHtml(item.category)}</span>` : ''}
                  Submitted on ${formatDate(c.createdAt)}
                </div>
              </div>
              <div>${renderStatusBadge(c.status)}</div>
            </div>

            <div class="bg-light p-3 rounded small mb-2 text-dark">
              <strong>Your Explanation:</strong> ${escapeHtml(c.claimDescription)}
            </div>

            <div class="bg-light p-3 rounded small mb-2 text-dark border-start border-3 border-info">
              <strong>Your Verification Answer:</strong> ${escapeHtml(c.privateVerificationAnswer)}
            </div>

            ${c.reviewNote ? `
              <div class="p-3 bg-success-subtle text-success-emphasis rounded small mt-2">
                <strong><i class="fa-solid fa-comment-dots me-1"></i> Reviewer Feedback:</strong> ${escapeHtml(c.reviewNote)}
                ${c.reviewedAt ? `<span class="text-muted ms-2">(${formatDate(c.reviewedAt)})</span>` : ''}
              </div>
            ` : `
              <div class="text-muted small mt-2">
                <i class="fa-regular fa-clock me-1"></i> Awaiting verification review from the item finder.
              </div>
            `}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    console.error('Error loading claims:', err);
    container.innerHTML = `<div class="alert alert-danger">Failed to load claims.</div>`;
  }
}

function showClaimAlert(message, type) {
  const container = document.getElementById('claim-alert');
  if (!container) return;
  container.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show d-flex align-items-center" role="alert">
      <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} me-2 fs-5"></i>
      <div>${escapeHtml(message)}</div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}
