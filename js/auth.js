import ApiClient from './api-client.js';

// Auth guard - redirect to login if not authenticated
export function requireAuth() {
  if (!ApiClient.isAuthenticated()) {
    window.location.replace('/login.html');
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
      
      // Redirect to dashboard using replace to prevent back button issues
      window.location.replace('/dashboard.html');
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
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Business details
    const businessName = document.getElementById('business-name').value.trim();
    const businessAddress = document.getElementById('business-address').value.trim();
    const businessPhone = document.getElementById('business-phone').value.trim();
    const businessEmail = document.getElementById('business-email').value.trim();
    const currency = document.getElementById('currency').value.trim();
    const themeColor = document.getElementById('theme-color').value;
    const logoFile = document.getElementById('logo-upload').files[0];

    if (!username || !email || !password || !confirmPassword) {
      showError('Please fill in username, email and password fields');
      return;
    }
    
    // Business info is optional except name/address can be enforced if desired

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

      await ApiClient.register(username, email, password, {
        businessName,
        businessAddress,
        phone: businessPhone
      });
      
      // Handle logo upload
      let logoUrl = '';
      if (logoFile) {
        const reader = new FileReader();
        logoUrl = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(logoFile);
        });
      }
      
      // Save settings to database via API
      const settingsPayload = {
        businessName,
        address: businessAddress,
        phone: businessPhone,
        email: businessEmail || email,
        currency: currency || 'LKR',
        themeColor: themeColor || '#2563eb',
        logoUrl: logoUrl,
        showBankDetails: true
      };
      
      try {
        await ApiClient.saveSettings(settingsPayload);
      } catch (error) {
        console.warn('Failed to save settings to server, will use local storage:', error);
      }
      
      // Also save locally as cache
      const localSettings = {
        name: businessName,
        address: businessAddress,
        phone: businessPhone,
        email: businessEmail || email,
        currency: currency || 'LKR',
        themeColor: themeColor || '#2563eb',
        logoUrl: logoUrl,
        showBankDetails: true
      };
      localStorage.setItem('invoicify_settings', JSON.stringify(localSettings));
      
      // Redirect to dashboard using replace to prevent back button issues
      window.location.replace('/dashboard.html');
    } catch (error) {
      showError(error.message || 'Registration failed. Username may already exist.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

// Logout handler - unified across all pages
export function setupLogout() {
  // Remove duplicate comment and ensure proper cleanup
  const logoutBtns = document.querySelectorAll('.logout-btn, [data-logout], #btn-logout');
  logoutBtns.forEach(btn => {
    // Remove any existing listeners to prevent duplicates
    const newBtn = btn.cloneNode(true);
    btn.parentNode?.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (confirm('Are you sure you want to log out?')) {
        // Clear all local data
        localStorage.clear();
        sessionStorage.clear();
        
        // Then use ApiClient logout which redirects
        ApiClient.logout();
      }
    });
  });
}
