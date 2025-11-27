import ApiClient from './api-client.js';

// Auth guard - redirect to login if not authenticated
export function requireAuth() {
  if (!ApiClient.isAuthenticated()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

// Verify token and get user info
export async function getCurrentUser() {
  try {
    const response = await ApiClient.verifyToken();
    return response.user;
  } catch (error) {
    console.error('Token verification failed:', error);
    ApiClient.logout();
    return null;
  }
}

// Login form handler
export function setupLoginForm() {
  const form = document.getElementById('login-form');
  const errorDiv = document.getElementById('error-message');
  const submitBtn = document.getElementById('submit-btn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      showError('Please fill in all fields');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging in...';
      errorDiv.style.display = 'none';

      await ApiClient.login(username, password);
      
      // Redirect to dashboard
      window.location.href = '/dashboard.html';
    } catch (error) {
      showError(error.message || 'Login failed. Please check your credentials.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
    }
  });

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

// Register form handler
export function setupRegisterForm() {
  const form = document.getElementById('register-form');
  const errorDiv = document.getElementById('error-message');
  const submitBtn = document.getElementById('submit-btn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!username || !password || !confirmPassword) {
      showError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';
      errorDiv.style.display = 'none';

      await ApiClient.register(username, password);
      
      // Redirect to dashboard
      window.location.href = '/dashboard.html';
    } catch (error) {
      showError(error.message || 'Registration failed. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

// Logout handler
export function setupLogout() {
  const logoutBtns = document.querySelectorAll('.logout-btn, [data-logout]');
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to log out?')) {
        ApiClient.logout();
      }
    });
  });
}
