import { db, collection, getDocs, setDoc, doc } from './firebase-config.js';

// Utility: SHA-256 hash and hex encoding
async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- SESSION MANAGEMENT ---
function setSession(data, keepLoggedIn) {
    const sessionData = {
        ...data,
        expires: keepLoggedIn ? null : Date.now() + 30 * 60 * 1000
    };
    localStorage.setItem('admin_session', JSON.stringify(sessionData));
}
function getSession() {
    const session = localStorage.getItem('admin_session');
    if (!session) return null;
    const data = JSON.parse(session);
    if (data.expires && Date.now() > data.expires) {
        destroySession();
        return null;
    }
    return data;
}
function destroySession() {
    localStorage.removeItem('admin_session');
}
function protectPage() {
    if (!getSession()) {
        window.location.href = '../login.html';
    }
}


// --- LOGIN LOGIC ---
const loginForm = document.querySelector('.login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm.querySelector('input[type="email"]').value.trim();
        const password = loginForm.querySelector('input[type="password"]').value;
        const keepLoggedIn = loginForm.querySelector('#keepLoggedIn').checked;
        const errorDiv = document.getElementById('loginError');
        errorDiv.style.display = 'none';

        if (!email || !password) {
            errorDiv.textContent = 'Email and password are required.';
            errorDiv.style.display = 'block';
            return;
        }

        try {
            const adminSnap = await getDocs(collection(db, 'admin'));
            let foundAdmin = null;
            let foundId = null;
            adminSnap.forEach(docSnap => {
                if (docSnap.data().email?.toLowerCase() === email.toLowerCase()) {
                    foundAdmin = docSnap.data();
                    foundId = docSnap.id;
                }
            });

            if (!foundAdmin) {
                errorDiv.textContent = 'No admin registered with this email.';
                errorDiv.style.display = 'block';
                return;
            }
            if (foundAdmin.passwordHash !== await hashString(password)) {
                errorDiv.textContent = 'Invalid credentials.';
                errorDiv.style.display = 'block';
                return;
            }

            const { passwordHash, recoveryCodeHash, ...adminSessionData } = foundAdmin;
            setSession({ ...adminSessionData, adminId: foundId, loginTime: Date.now() }, keepLoggedIn);
            window.location.href = 'screens/settings.html';
        } catch (err) {
            errorDiv.textContent = 'Login failed. Try again.';
            errorDiv.style.display = 'block';
        }
    });
}

// --- LOGOUT LOGIC ---
function setupLogoutButtons() {
    document.querySelectorAll('.btn-dark, .btn-logout').forEach(btn => {
        if (btn.innerHTML.includes('fa-sign-out-alt')) {
            btn.addEventListener('click', () => {
                destroySession();
                window.location.href = '../login.html';
            });
        }
    });
}


// --- !! FINAL PASSWORD RESET FLOW !! ---
function setupPasswordResetFlow() {
    const modalEl = document.getElementById('resetPasswordModal');
    if (!modalEl) return;

    // Get all interactive elements
    const form = modalEl.querySelector('#passwordResetForm');
    const emailInput = modalEl.querySelector('#resetEmail');
    const otpInputs = modalEl.querySelectorAll('.otp-input');
    const validateBtn = modalEl.querySelector('#validateRecoveryBtn');
    const clearBtn = modalEl.querySelector('#clearOtpBtn');
    const newPasswordSection = modalEl.querySelector('#newPasswordSection'); // The section to hide/show

    let validAdminData = null; 

    // Step 1: Handle the "Validate" button click
    validateBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const recoveryCode = Array.from(otpInputs).map(input => input.value).join('');

        if (!email || recoveryCode.length < 6) {
            Swal.fire({ icon: 'error', title: 'Oops...', text: 'Please enter your email and the 6-digit recovery code.' });
            return;
        }

        try {
            let adminDoc = null;
            const adminSnap = await getDocs(collection(db, 'admin'));
            adminSnap.forEach(doc => {
                if (doc.data().email?.toLowerCase() === email.toLowerCase()) {
                    adminDoc = doc;
                }
            });

            if (!adminDoc) {
                Swal.fire({ icon: 'error', title: 'Not Found', text: 'No account found with that email address.' });
                return;
            }

            const recoveryCodeHash = await hashString(recoveryCode);
            if (adminDoc.data().recoveryCodeHash === recoveryCodeHash) {
                Swal.fire({ icon: 'success', title: 'Validated!', text: 'You can now set a new password.' });
                
                // Show the hidden password section
                newPasswordSection.style.display = 'block';
                
                validAdminData = { id: adminDoc.id, data: adminDoc.data() };

            } else {
                Swal.fire({ icon: 'error', title: 'Invalid Code', text: 'The recovery code is incorrect. Please try again.' });
                newPasswordSection.style.display = 'none'; // Keep it hidden on failure
            }

        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Something went wrong during validation. Please try again.' });
            console.error("Validation Error:", error);
        }
    });

    // Step 2: Handle the final form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPasswordInput = modalEl.querySelector('#resetNewPassword');
        const newPassword = newPasswordInput.value;

        if (!validAdminData) {
            Swal.fire({ icon: 'warning', title: 'Not Validated', text: 'Please validate your recovery code first.' });
            return;
        }
        
        if (newPassword.length < 8) {
            Swal.fire({ icon: 'error', title: 'Weak Password', text: 'Your new password must be at least 8 characters long.' });
            return;
        }

        try {
            const newPasswordHash = await hashString(newPassword);
            await setDoc(doc(db, 'admin', validAdminData.id), {
                ...validAdminData.data,
                passwordHash: newPasswordHash,
                updatedAt: new Date().toISOString()
            });
            
            Swal.fire({ icon: 'success', title: 'Success!', text: 'Your password has been changed.' });

            const bsModal = bootstrap.Modal.getInstance(modalEl);
            bsModal.hide();

        } catch (error) {
             Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to update your password. Please try again.' });
             console.error("Password Reset Error:", error);
        }
    });

    // Handle the "Clear" button click
    clearBtn.addEventListener('click', () => {
        otpInputs.forEach(input => (input.value = ''));
        otpInputs[0].focus();
    });

    // Reset the form completely when the modal is hidden
    modalEl.addEventListener('hidden.bs.modal', () => {
        form.reset();
        newPasswordSection.style.display = 'none';
        validAdminData = null;
    });
}


// --- PAGE INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    setupLogoutButtons();
    setupPasswordResetFlow(); 
    
    const path = window.location.pathname;
    if (!path.endsWith('login.html') && !path.endsWith('/')) {
        protectPage();
    }
});