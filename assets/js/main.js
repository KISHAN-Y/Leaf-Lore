import { db, collection, getDocs, setDoc, doc } from './firebase-config.js';

const toastElement = document.getElementById('appToast');
const toastMessageEl = document.getElementById('appToastMessage');
const toastInstance = toastElement ? new bootstrap.Toast(toastElement) : null;

const showToast = (message, variant = 'primary') => {
  if (!toastInstance || !toastMessageEl || !toastElement) return;
  toastMessageEl.textContent = message;
  toastElement.className = `toast align-items-center text-bg-${variant} border-0`;
  toastInstance.show();
};

const showSuccess = (msg) => showToast(msg, 'success');
const showError = (msg) => showToast(msg, 'danger');
const showWarning = (msg) => showToast(msg, 'warning');

// Utility: SHA-256 hash and hex encoding
const hashString = async (str) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// --- SESSION MANAGEMENT ---
const setSession = (data, keepLoggedIn) => {
  const sessionData = {
    ...data,
    expires: keepLoggedIn ? null : Date.now() + 30 * 60 * 1_000,
  };
  localStorage.setItem('admin_session', JSON.stringify(sessionData));
};
const getSession = () => {
  const session = localStorage.getItem('admin_session');
  if (!session) return null;
  const data = JSON.parse(session);
  if (data.expires && Date.now() > data.expires) {
    destroySession();
    return null;
  }
  return data;
};
const destroySession = () => localStorage.removeItem('admin_session');

const protectPage = () => {
  if (getSession()) {
    // Session exists, okay to stay
    document.body.style.visibility = 'visible'; // Show the page
    return;
  }

  // No session, redirect to login immediately
  window.location.href = 'index.html';
};

// --- LOGIN LOGIC ---
const loginForm = document.querySelector('.login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.querySelector('input[type="email"]')?.value.trim() ?? '';
    const password = loginForm.querySelector('input[type="password"]')?.value ?? '';
    const keepLoggedIn = loginForm.querySelector('#keepLoggedIn')?.checked ?? false;
    const errorDiv = document.getElementById('loginError');

    errorDiv.style.display = 'none';

    if (!email || !password) {
      showError('Email and password are required.');
      return;
    }

    try {
      const adminSnap = await getDocs(collection(db, 'admin'));
      let foundAdmin = null;
      let foundId = null;

      adminSnap.forEach((docSnap) => {
        if (docSnap.data().email?.toLowerCase() === email.toLowerCase()) {
          foundAdmin = docSnap.data();
          foundId = docSnap.id;
        }
      });

      if (!foundAdmin) {
        showError('No admin registered with this email.');
        return;
      }
      if ((await hashString(password)) !== foundAdmin.passwordHash) {
        showError('Invalid credentials.');
        return;
      }

      const { passwordHash, recoveryCodeHash, ...adminSessionData } = foundAdmin;
      setSession(
        { ...adminSessionData, adminId: foundId, loginTime: Date.now() },
        keepLoggedIn
      );
      showSuccess('Login successful.');

      // Redirect after short delay to allow toast display (optional)
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 300);
    } catch {
      showError('Login failed. Try again.');
    }
  });
}

// --- LOGOUT LOGIC ---
const setupLogoutButtons = () => {
  document.querySelectorAll('[data-action="logout"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      destroySession();
      window.location.href = 'index.html';
    });
  });
};

// --- PASSWORD RESET FLOW ---
const setupPasswordResetFlow = () => {
  const modalEl = document.getElementById('resetPasswordModal');
  if (!modalEl) return;

  const form = modalEl.querySelector('#passwordResetForm');
  const emailInput = modalEl.querySelector('#resetEmail');
  const otpInputs = [...modalEl.querySelectorAll('.otp-input')];
  const validateBtn = modalEl.querySelector('#validateRecoveryBtn');
  const clearBtn = modalEl.querySelector('#clearOtpBtn');
  const newPasswordSection = modalEl.querySelector('#newPasswordSection');

  let validAdminData = null;

  validateBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const recoveryCode = otpInputs.map((input) => input.value).join('');

    if (!email || recoveryCode.length < 6) {
      showError('Please enter your email and the 6-digit recovery code.');
      return;
    }

    try {
      let adminDoc = null;
      const adminSnap = await getDocs(collection(db, 'admin'));

      adminSnap.forEach((doc) => {
        if (doc.data().email?.toLowerCase() === email.toLowerCase()) {
          adminDoc = doc;
        }
      });

      if (!adminDoc) {
        await Swal.fire({
          icon: 'error',
          title: 'Not Found',
          text: 'No account found with that email address.',
        });
        return;
      }

      const recoveryCodeHash = await hashString(recoveryCode);

      if (adminDoc.data().recoveryCodeHash === recoveryCodeHash) {
        await Swal.fire({
          icon: 'success',
          title: 'Validated!',
          text: 'You can now set a new password.',
        });
        newPasswordSection.style.display = 'block';
        validAdminData = { id: adminDoc.id, ...adminDoc.data() };
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Invalid Code',
          text: 'The recovery code is incorrect. Please try again.',
        });
        newPasswordSection.style.display = 'none';
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Something went wrong during validation. Please try again.',
      });
      console.error('Validation Error:', error);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validAdminData) {
      await Swal.fire({
        icon: 'warning',
        title: 'Not Validated',
        text: 'Please validate your recovery code first.',
      });
      return;
    }

    const newPasswordInput = modalEl.querySelector('#resetNewPassword');
    const newPassword = newPasswordInput.value;

    if (newPassword.length < 8) {
      await Swal.fire({
        icon: 'error',
        title: 'Weak Password',
        text: 'Your new password must be at least 8 characters long.',
      });
      return;
    }

    try {
      const newPasswordHash = await hashString(newPassword);
      await setDoc(doc(db, 'admin', validAdminData.id), {
        ...validAdminData.data,
        passwordHash: newPasswordHash,
        updatedAt: new Date().toISOString(),
      });

      await Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Your password has been changed.',
      });

      bootstrap.Modal.getInstance(modalEl).hide();
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to update your password. Please try again.',
      });
      console.error('Password Reset Error:', error);
    }
  });

  clearBtn.addEventListener('click', () => {
    otpInputs.forEach((input) => (input.value = ''));
    otpInputs[0]?.focus();
  });

  modalEl.addEventListener('hidden.bs.modal', () => {
    form.reset();
    newPasswordSection.style.display = 'none';
    validAdminData = null;
  });
};

// --- INITIALIZATION ---

window.addEventListener('DOMContentLoaded', () => {
  setupLogoutButtons();
  setupPasswordResetFlow();

  // Session check & routing logic
  const path = window.location.pathname;
  const onLoginPage = path.endsWith('/') || path.endsWith('index.html');
  if (onLoginPage) {
    // Hide body initially to avoid flicker
    document.body.style.visibility = 'visible'; // Show login page without redirect
    if (getSession()) {
      // Already logged in, redirect to dashboard
      window.location.href = 'dashboard.html';
    }
  } else {
    // For all other protected pages
    // Hide body until session validated to avoid flicker
    document.body.style.visibility = 'hidden';
    protectPage();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // Sidebar toggle & UI interactions - unchanged

  const sidebar = document.getElementById('sidebar');
  const sidebarCollapse = document.getElementById('sidebarCollapse');
  const overlay = document.querySelector('.overlay');

  const openSidebar = () => {
    sidebar?.classList.add('active');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeSidebar = () => {
    sidebar?.classList.remove('active');
    overlay?.classList.remove('active');
    document.body.style.overflow = 'auto';
  };

  sidebarCollapse?.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar?.classList.contains('active') ? closeSidebar() : openSidebar();
  });

  overlay?.addEventListener('click', closeSidebar);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar?.classList.contains('active')) {
      closeSidebar();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 991.98 && sidebar?.classList.contains('active')) {
      closeSidebar();
    }
  });

  // Initialize Bootstrap tooltips & popovers
  [...document.querySelectorAll('[data-bs-toggle="tooltip"]')].map(
    (el) => new bootstrap.Tooltip(el)
  );

  [...document.querySelectorAll('[data-bs-toggle="popover"]')].map(
    (el) => new bootstrap.Popover(el)
  );
});
