/**
 * Findora - Authentication Client Logic (Login & Registration)
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
});

/**
 * Handle Login Form Submission
 */
async function handleLogin(e) {
  e.preventDefault();
  const alertContainer = document.getElementById('auth-alert');
  const submitBtn = document.getElementById('submit-btn');

  clearAlert(alertContainer);

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // Frontend validation
  if (!email || !password) {
    showAlert(alertContainer, 'Please enter both your email address and password.', 'danger');
    return;
  }

  setLoading(submitBtn, true, 'Signing in...');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.success) {
      showAlert(alertContainer, 'Login successful! Redirecting...', 'success');
      showToast('Welcome back, ' + data.user.name, 'success');

      // Check for redirect param in URL
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get('redirect') || (data.user.role === 'admin' ? '/admin.html' : '/dashboard.html');

      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 700);
    } else {
      showAlert(alertContainer, data.message || 'Invalid email or password.', 'danger');
      setLoading(submitBtn, false, 'Sign In');
    }
  } catch (error) {
    console.error('Login error:', error);
    showAlert(alertContainer, 'A network error occurred. Please check your connection and try again.', 'danger');
    setLoading(submitBtn, false, 'Sign In');
  }
}

/**
 * Handle Registration Form Submission
 */
async function handleRegister(e) {
  e.preventDefault();
  const alertContainer = document.getElementById('auth-alert');
  const submitBtn = document.getElementById('submit-btn');

  clearAlert(alertContainer);

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone') ? document.getElementById('phone').value.trim() : '';
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Frontend validation
  if (!name || !email || !password || !confirmPassword) {
    showAlert(alertContainer, 'Please fill in all required fields.', 'danger');
    return;
  }

  if (name.length < 2) {
    showAlert(alertContainer, 'Full name must be at least 2 characters long.', 'danger');
    return;
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    showAlert(alertContainer, 'Please provide a valid email address (e.g. name@college.edu).', 'danger');
    return;
  }

  if (password.length < 6) {
    showAlert(alertContainer, 'Password must be at least 6 characters long.', 'danger');
    return;
  }

  if (password !== confirmPassword) {
    showAlert(alertContainer, 'Password and Confirm Password do not match.', 'danger');
    return;
  }

  setLoading(submitBtn, true, 'Creating Account...');

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        phone,
        password,
        confirmPassword
      })
    });

    const data = await res.json();

    if (data.success) {
      showAlert(alertContainer, 'Account registered successfully! Redirecting to dashboard...', 'success');
      showToast('Registration successful! Welcome to Findora.', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 800);
    } else {
      showAlert(alertContainer, data.message || 'Registration failed. Please check your details.', 'danger');
      setLoading(submitBtn, false, 'Create Account');
    }
  } catch (error) {
    console.error('Register error:', error);
    showAlert(alertContainer, 'A network error occurred. Please try again later.', 'danger');
    setLoading(submitBtn, false, 'Create Account');
  }
}

/**
 * Quick Fill Demo Credentials (helpful for faculty presentation)
 */
function fillDemo(email, password) {
  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('password');
  if (emailInput && passInput) {
    emailInput.value = email;
    passInput.value = password;
  }
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

function clearAlert(container) {
  if (container) container.innerHTML = '';
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
