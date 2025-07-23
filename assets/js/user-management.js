import { db, collection, getDocs, doc, getDoc, deleteDoc } from './firebase-config.js';

let allUsers = []; // To store fetched users

// Toast elements & instance (assuming you add the toast container in your HTML)
const toastElement = document.getElementById('successToast');
const toastMessageEl = document.getElementById('toastMessage');
const toastInstance = toastElement ? new bootstrap.Toast(toastElement) : null;

// Show success toast
const showSuccess = (message) => {
  if (!toastInstance || !toastMessageEl) return;
  toastMessageEl.textContent = message;
  toastInstance.show();
};

// Show error toast (fallback with alert, but preferably customize separate error toasts)
const showError = (message) => {
  console.error(message);
  alert(message);
};

document.addEventListener('DOMContentLoaded', async () => {
  await fetchAndDisplayUsers();

  const searchInput = document.getElementById('userSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();

      const filteredUsers = allUsers.filter(user =>
        (user.name?.toLowerCase().includes(searchTerm) || user.email?.toLowerCase().includes(searchTerm))
      );

      displayUsers(filteredUsers);
    });
  }
});

const fetchAndDisplayUsers = async () => {
  try {
    const usersCollection = collection(db, 'users');
    const userSnapshot = await getDocs(usersCollection);
    allUsers = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    displayUsers(allUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    const userTableBody = document.getElementById('user-table-body');
    if (userTableBody) {
      userTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to fetch user data.</td></tr>';
    }
  }
};

const displayUsers = (users) => {
  const userTableBody = document.getElementById('user-table-body');
  if (!userTableBody) return;
  userTableBody.innerHTML = '';

  if (users.length === 0) {
    userTableBody.innerHTML = `<tr><td colspan="5" class="text-center">No users found.</td></tr>`;
    return;
  }

  users.forEach(user => {
    const registrationDate = user.createdAt?.toDate?.()
      ? user.createdAt.toDate().toISOString().split('T')[0]
      : 'N/A';
    const avatarSrc = user.profileImageUrl || '../assets/images/avatar.png';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td data-label="Name">
        <div class="d-flex align-items-center">
          <img src="${avatarSrc}" alt="${user.name || 'User'}" class="avatar-sm rounded-circle me-3" onerror="this.onerror=null;this.src='../assets/images/avatar.png';" />
          <div>${user.name || 'N/A'}</div>
        </div>
      </td>
      <td data-label="Email"><span class="text-truncate">${user.email || 'N/A'}</span></td>
      <td data-label="Role"><span class="badge bg-secondary">User</span></td>
      <td data-label="Registration Date" class="text-nowrap">${registrationDate}</td>
      <td data-label="Actions">
        <button class="btn btn-sm btn-outline-secondary me-2 view-user-btn" title="View" data-bs-toggle="modal" data-bs-target="#viewUserModal" data-user-id="${user.id}">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger delete-user-btn" title="Delete" data-user-id="${user.id}">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;

    userTableBody.appendChild(row);
  });

  // Add event listeners for view buttons
  document.querySelectorAll('.view-user-btn').forEach(button => {
    button.addEventListener('click', async (e) => {
      const userId = e.currentTarget.dataset.userId;
      await populateViewUserModal(userId);
    });
  });

  // Add event listeners for delete buttons
  document.querySelectorAll('.delete-user-btn').forEach(button => {
    button.addEventListener('click', async (e) => {
      const userId = e.currentTarget.dataset.userId;
      const userName = e.currentTarget.closest('tr').querySelector('td[data-label="Name"] div:last-child').textContent;
      if (confirm(`Are you sure you want to delete the user "${userName}"? This action cannot be undone.`)) {
        await deleteUser(userId);
      }
    });
  });
};

const deleteUser = async (userId) => {
  try {
    await deleteDoc(doc(db, 'users', userId));
    showSuccess('User deleted successfully.');
    await fetchAndDisplayUsers(); // Refresh user list
  } catch (error) {
    console.error('Error deleting user:', error);
    showError('Failed to delete user.');
  }
};

const populateViewUserModal = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      showError('Could not find user details.');
      return;
    }

    const user = userSnap.data();

    // Populate modal fields
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text || 'N/A';
    };

    setText('viewUserName', user.name);
    setText('viewUserEmail', user.email);
    setText('viewUserPhone', user.phoneNumber);
    setText('viewUserRegistrationDate', user.createdAt?.toDate()?.toLocaleDateString() || 'N/A');

    // Fetch subcollections counts: cart, bookmarks, orders
    const [cartSnap, bookmarksSnap, ordersSnap] = await Promise.all([
      getDocs(collection(db, 'users', userId, 'cart')),
      getDocs(collection(db, 'users', userId, 'bookmarks')),
      getDocs(collection(db, 'users', userId, 'orders')),
    ]);

    setText('viewUserCartCount', cartSnap.size);
    setText('viewUserBookmarkCount', bookmarksSnap.size);
    setText('viewUserOrderCount', ordersSnap.size);
  } catch (error) {
    console.error("Error populating user modal:", error);
    showError('Failed to load user details.');
  }
};

export { fetchAndDisplayUsers, displayUsers, deleteUser, populateViewUserModal };
