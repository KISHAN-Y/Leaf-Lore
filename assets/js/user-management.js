import { db, collection, getDocs, doc, getDoc, deleteDoc } from './firebase-config.js';


let allUsers = []; // To store all users for filtering

document.addEventListener('DOMContentLoaded', async () => {
    await fetchAndDisplayUsers();

    const searchInput = document.getElementById('userSearchInput');
    searchInput.addEventListener('keyup', (e) => {        const searchTerm = e.target.value.toLowerCase();
        const filteredUsers = allUsers.filter(user => {
            return (
                user.name?.toLowerCase().includes(searchTerm) ||
                user.email?.toLowerCase().includes(searchTerm)
            );
        });
        displayUsers(filteredUsers);
    });
});

async function fetchAndDisplayUsers() {
    try {
        const usersCollection = collection(db, 'users');
        const userSnapshot = await getDocs(usersCollection);
        allUsers = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayUsers(allUsers);
    } catch (error) {
        console.error("Error fetching users: ", error);
        const userTableBody = document.getElementById('user-table-body');
        userTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to fetch user data.</td></tr>';
    }
}

function displayUsers(users) {
    const userTableBody = document.getElementById('user-table-body');
    userTableBody.innerHTML = ''; // Clear existing rows

    if (users.length === 0) {
        userTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No users found.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');

        const registrationDate = user.createdAt && user.createdAt.toDate 
            ? user.createdAt.toDate().toISOString().split('T')[0] 
            : 'N/A';

        const avatarSrc = user.profileImageUrl || '../assets/images/avatar.png';

        row.innerHTML = `
            <td data-label="Name">
                <div class="d-flex align-items-center">
                    <img src="${avatarSrc}" alt="${user.name || 'User'}" class="avatar-sm rounded-circle me-3" onerror="this.onerror=null;this.src='../assets/images/avatar.png';">
                    <div>${user.name || 'N/A'}</div>
                </div>
            </td>
            <td data-label="Email"><span class="text-truncate">${user.email || 'N/A'}</span></td>
            <td data-label="Role"><span class="badge bg-secondary">User</span></td>
            <td data-label="Registration Date" class="text-nowrap">${registrationDate}</td>
            <td data-label="Actions">
                    <button class="btn btn-sm btn-outline-secondary me-2 view-user-btn" title="View" data-bs-toggle="modal" data-bs-target="#viewUserModal" data-user-id="${user.id}"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-outline-danger delete-user-btn" title="Delete" data-user-id="${user.id}"><i class="fas fa-trash-alt"></i></button>
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
}

async function deleteUser(userId) {
    try {
        await deleteDoc(doc(db, 'users', userId));
        alert('User deleted successfully.');
        await fetchAndDisplayUsers(); // Refresh the user list
    } catch (error) {
        console.error('Error deleting user: ', error);
        alert('Failed to delete user.');
    }
}

async function populateViewUserModal(userId) {
    try {
        // Fetch user document
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            console.error('User not found');
            alert('Could not find user details.');
            return;
        }

        const user = userSnap.data();

        // Populate basic info
        document.getElementById('viewUserName').textContent = user.name || 'N/A';
        document.getElementById('viewUserEmail').textContent = user.email || 'N/A';
        document.getElementById('viewUserPhone').textContent = user.phoneNumber || 'N/A';
        document.getElementById('viewUserRegistrationDate').textContent = user.createdAt?.toDate().toLocaleDateString() || 'N/A';

        // Fetch and populate counts
        const cartRef = collection(db, 'users', userId, 'cart');
        const bookmarksRef = collection(db, 'users', userId, 'bookmarks');
        const cartSnap = await getDocs(cartRef);
        const bookmarksSnap = await getDocs(bookmarksRef);
        document.getElementById('viewUserCartCount').textContent = cartSnap.size;
        document.getElementById('viewUserBookmarkCount').textContent = bookmarksSnap.size;

        // Fetch and populate order count
        const ordersRef = collection(db, 'users', userId, 'orders');
        const ordersSnap = await getDocs(ordersRef);
        document.getElementById('viewUserOrderCount').textContent = ordersSnap.size;
    } catch (error) {
        console.error("Error populating user modal: ", error);
        alert('Failed to load user details.');
    }
}

function getStatusBadge(status) {
    switch (status.toLowerCase()) {
        case 'confirmed':
            return `<span class="badge bg-success">Confirmed</span>`;
        case 'pending':
            return `<span class="badge bg-warning">Pending</span>`;
        case 'shipped':
            return `<span class="badge bg-info">Shipped</span>`;
        case 'delivered':
            return `<span class="badge bg-primary">Delivered</span>`;
        case 'cancelled':
            return `<span class="badge bg-danger">Cancelled</span>`;
        default:
            return `<span class="badge bg-secondary">${status}</span>`;
    }
}
