import { 
    collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, 
    serverTimestamp, query, where, orderBy
} from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js';
import { db } from './firebase-config.js';

// --- Global Variables & DOM Elements ---
let allStores = [];
let filteredStores = []; // For search and filter
const storesTableBody = document.getElementById('stores-table-body');
const noStoresMessage = document.getElementById('no-stores-message');

// Modal Elements
const storeModalElement = document.getElementById('storeModal');
const storeModal = new bootstrap.Modal(storeModalElement);
const storeModalLabel = document.getElementById('storeModalLabel');
const storeForm = document.getElementById('store-form');
const storeSubmitBtn = document.getElementById('store-submit-btn');
const storeIdInput = document.getElementById('storeId');

// Filter Elements
const searchBar = document.getElementById('store-search-bar');
const statusFilter = document.getElementById('store-status-filter');


// --- Utility Functions ---
const showToast = (message, isError = false) => {
    alert(message);
    if(isError) console.error(message);
};

const getStatusBadgeClass = (status) => {
    return status.toLowerCase() === 'active' ? 'success' : 'secondary';
};

// --- CRUD Functions (Stores) ---

async function loadStores() {
    try {
        const storesCollectionRef = collection(db, 'stores');
        const storesSnapshot = await getDocs(storesCollectionRef);

        if (storesSnapshot.empty) {
            allStores = [];
            filteredStores = [];
            applyFilters();
            return;
        }

        // First get all books and group by storeId
        const booksSnapshot = await getDocs(collection(db, 'books'));
        const booksByStore = {};
        
        booksSnapshot.forEach(bookDoc => {
            const bookData = bookDoc.data();
            if (bookData.storeId) {
                booksByStore[bookData.storeId] = (booksByStore[bookData.storeId] || 0) + 1;
            }
        });

        const storePromises = storesSnapshot.docs.map((storeDoc) => {
            const storeData = storeDoc.data();
            return {
                id: storeDoc.id,
                name: storeData.name || 'N/A',
                ownerName: storeData.ownerName || 'N/A',
                status: storeData.status || 'inactive',
                totalBooks: booksByStore[storeDoc.id] || 0,
                email: storeData.email || '',
                phone: storeData.phone || '',
                location: storeData.location || '',
            };
        });
        
        allStores = await Promise.all(storePromises);
        applyFilters(); // Display the stores through the filter function
    } catch (error) {
        showToast("Error loading stores. See console for details.", true);
        console.error(error);
    }
}

// Function to generate the next store ID
async function getNextStoreId() {
    try {
        // Get all stores and find the highest ID
        const storesSnapshot = await getDocs(collection(db, 'stores'));
        let maxId = 123003; // Starting point - 1
        
        storesSnapshot.forEach(doc => {
            const idNum = parseInt(doc.id);
            if (!isNaN(idNum) && idNum > maxId) {
                maxId = idNum;
            }
        });
        
        return (maxId + 1).toString();
    } catch (error) {
        console.error('Error generating store ID:', error);
        // Fallback to timestamp if there's an error
        return Date.now().toString();
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    storeSubmitBtn.disabled = true;
    
    // Generate a new ID for new stores
    const storeId = storeIdInput.value || await getNextStoreId();
    const storeData = {
        name: document.getElementById('storeName').value,
        ownerName: document.getElementById('ownerName').value,
        email: document.getElementById('storeEmail').value,
        phone: document.getElementById('storePhone').value,
        location: document.getElementById('storeLocation').value,
        status: document.getElementById('storeStatus').value,
        updatedAt: serverTimestamp()
    };

    try {
        if (storeIdInput.value) {
            const storeRef = doc(db, 'stores', storeIdInput.value);
            await updateDoc(storeRef, storeData);
            showToast('Store updated successfully!');
        } else {
            const storeRef = doc(db, 'stores', storeId);
            await setDoc(storeRef, storeData);
            showToast('Store added successfully!');
        }
        storeModal.hide();
        loadStores();
    } catch (error) {
        showToast(`Error saving store: ${error.message}`, true);
    } finally {
        storeSubmitBtn.disabled = false;
    }
}

async function deleteStore(id) {
    if (!confirm('Are you sure you want to delete this store? This cannot be undone.')) return;
    try {
        await deleteDoc(doc(db, 'stores', id));
        showToast('Store deleted successfully!');
        loadStores();
    } catch (error) {
        showToast(`Error deleting store: ${error.message}`, true);
    }
}

// --- UI & Display Functions ---

function applyFilters() {
    const searchTerm = searchBar.value.toLowerCase();
    const status = statusFilter.value;

    filteredStores = allStores.filter(store => {
        const matchesSearch = store.name.toLowerCase().includes(searchTerm) || 
                              store.ownerName.toLowerCase().includes(searchTerm);
        const matchesStatus = !status || store.status === status;
        return matchesSearch && matchesStatus;
    });
    
    displayStores();
}

function displayStores() {
    storesTableBody.innerHTML = '';
    const loaderRow = document.getElementById('stores-loader-row');

    if(loaderRow) loaderRow.style.display = 'none';

    if (filteredStores.length === 0) {
        noStoresMessage.style.display = 'block';
        storesTableBody.style.display = 'none';
        noStoresMessage.textContent = allStores.length === 0 ? "No stores available." : "No stores match your search."
        return;
    }

    noStoresMessage.style.display = 'none';
    storesTableBody.style.display = '';

    storesTableBody.innerHTML = filteredStores.map(store => {
        const statusText = store.status.charAt(0).toUpperCase() + store.status.slice(1);
        return `
            <tr>
                <td data-label="Store Name">${store.name}</td>
                <td data-label="Owner Name">${store.ownerName}</td>
                <td data-label="Status"><span class="badge bg-${getStatusBadgeClass(store.status)}">${statusText}</span></td>
                <td data-label="Total Books">${store.totalBooks.toLocaleString()}</td>
                <td data-label="Actions">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-secondary ms-1" onclick="viewStore('${store.id}')" title="View"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-sm btn-outline-primary ms-1" onclick="editStore('${store.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger ms-1" onclick="deleteStore('${store.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}


// --- View Store Books & Modal Management ---
async function viewStore(storeId) {
    const modal = new bootstrap.Modal(document.getElementById('viewStoreBooksModal'));
    const storeNameTitle = document.getElementById('storeNameTitle');
    const storeBooksList = document.getElementById('storeBooksList');
    const noBooksMessage = document.getElementById('noBooksMessage');
    const booksLoading = document.getElementById('booksLoading');
    const modalBody = document.querySelector('#viewStoreBooksModal .modal-body');

    storeBooksList.dataset.storeId = storeId;
    
    const cleanup = () => {
        const modalElement = document.getElementById('viewStoreBooksModal');
        modalElement.removeEventListener('hidden.bs.modal', onModalHidden);
    };

    const onModalHidden = () => {
        cleanup();
    };

    try {
        storeBooksList.innerHTML = '';
        noBooksMessage.style.display = 'none';
        booksLoading.style.display = 'block';

        const storeDoc = await getDoc(doc(db, 'stores', storeId));
        if (!storeDoc.exists()) throw new Error('Store not found');
        
        storeNameTitle.textContent = storeDoc.data().name;

        const booksQuery = query(collection(db, 'books'), where('storeId', '==', storeId));
        const booksSnapshot = await getDocs(booksQuery);

        booksLoading.style.display = 'none';

        if (booksSnapshot.empty) {
            noBooksMessage.style.display = 'block';
        } else {
            // UPDATED: Added data-label attributes to each <td> for responsive view
            storeBooksList.innerHTML = booksSnapshot.docs.map(bookDoc => {
                const book = { id: bookDoc.id, ...bookDoc.data() };
                const price = book.price ? 
                    `₹${parseFloat(book.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                    'N/A';
                    
                return `
                    <tr>
                        <td data-label="Cover">
                            ${book.coverImageUrl ? 
                                `<img src="${book.coverImageUrl}" 
                                      alt="${book.title || 'Book Cover'}" 
                                      class="img-thumbnail" 
                                      style="width: 50px; height: 70px; object-fit: cover;">` : 
                                '<div class="bg-light d-flex align-items-center justify-content-center" style="width: 50px; height: 70px;"><i class="fas fa-book text-muted"></i></div>'
                            }
                        </td>
                        <td data-label="Title">${book.title || 'Untitled'}</td>
                        <td data-label="Author">${book.author || 'N/A'}</td>
                        <td data-label="Price">${price}</td>
                        <td data-label="Stock">${typeof book.quantity !== 'undefined' ? book.quantity : 'N/A'}</td>
                        <td data-label="Actions">
                            <button class="btn btn-sm btn-outline-primary edit-book-btn" 
                                    data-book-id="${book.id}"
                                    title="Edit Book">
                                <i class="fas fa-edit me-1"></i>Edit
                            </button>
                        </td>
                    </tr>`;
            }).join('');
            
            storeBooksList.querySelectorAll('.edit-book-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const bookId = e.currentTarget.dataset.bookId;
                    modal.hide();
                    openEditBookModal(bookId);
                });
            });
        }
        
        document.getElementById('viewStoreBooksModal').addEventListener('hidden.bs.modal', onModalHidden, { once: true });
        modal.show();
        
    } catch (error) {
        console.error('Error loading store books:', error);
        showToast('Error loading store books. Please try again.', true);
        booksLoading.style.display = 'none';
        noBooksMessage.style.display = 'block';
        noBooksMessage.textContent = 'Error loading books. Please try again.';
    }
}

function openAddModal() {
    storeForm.reset();
    storeIdInput.value = '';
    storeModalLabel.textContent = 'Add New Store';
    storeSubmitBtn.textContent = 'Add Store';
    storeModal.show();
}

async function editStore(id) {
    storeForm.reset();
    const store = allStores.find(s => s.id === id);
    if (!store) {
        showToast('Store not found!', true);
        return;
    }
    
    storeIdInput.value = store.id;
    document.getElementById('storeName').value = store.name;
    document.getElementById('ownerName').value = store.ownerName;
    document.getElementById('storeEmail').value = store.email;
    document.getElementById('storePhone').value = store.phone;
    document.getElementById('storeLocation').value = store.location;
    document.getElementById('storeStatus').value = store.status;

    storeModalLabel.textContent = 'Edit Store';
    storeSubmitBtn.textContent = 'Save Changes';
    storeModal.show();
}

// --- Book Edit Functionality (Correctly Scoped) ---

async function openEditBookModal(bookId) {
    try {
        const bookDoc = await getDoc(doc(db, 'books', bookId));
        if (!bookDoc.exists()) {
            throw new Error('Book not found!');
        }
        const bookData = bookDoc.data();

        document.getElementById('bookId').value = bookId;
        
        const coverPreview = document.getElementById('bookCoverPreview');
        // **FIX**: Use coverImageUrl to be consistent
        if (bookData.coverImageUrl) {
            coverPreview.src = bookData.coverImageUrl;
        } else {
            coverPreview.src = '../assets/images/book-placeholder.jpg';
        }
        
        document.getElementById('bookTitlePreview').textContent = bookData.title || 'No Title';
        document.getElementById('bookAuthorPreview').textContent = bookData.author || 'Unknown Author';
        
        // **FIX**: Populate the correct form fields (price and quantity)
        document.getElementById('price').value = bookData.price || '';
        document.getElementById('quantity').value = bookData.quantity ?? 0;

        const editBookModal = new bootstrap.Modal(document.getElementById('editBookModal'));
        editBookModal.show();
    } catch (error) {
        console.error('Error opening edit modal:', error);
        showToast(`Error loading book details: ${error.message}`, true);
    }
};

async function handleEditBookFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const bookId = document.getElementById('bookId').value;
    
    const price = document.getElementById('price').value;
    const quantity = document.getElementById('quantity').value;
    
    if (price.trim() === '' || quantity.trim() === '') {
        alert('Price and Quantity cannot be empty.');
        return;
    }
    
    const bookData = {
        price: parseFloat(price),
        quantity: parseInt(quantity, 10)
    };
    
    if (isNaN(bookData.price) || bookData.price < 0 || isNaN(bookData.quantity) || bookData.quantity < 0) {
        alert('Please enter valid, non-negative numbers for price and quantity.');
        return;
    }
    
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Updating...`;
    
    try {
        await updateDoc(doc(db, 'books', bookId), { ...bookData, updatedAt: serverTimestamp() });
        
        const toastEl = document.getElementById('successToast');
        const toastBody = document.getElementById('toastMessage');
        toastBody.textContent = 'Book updated successfully!';
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('editBookModal'));
        modal.hide();
        
        // **FIX**: Refresh the store books list if it's open
        const storeBooksList = document.getElementById('storeBooksList');
        if (storeBooksList && storeBooksList.dataset.storeId) {
            viewStore(storeBooksList.dataset.storeId);
        }

    } catch (error) {
        showToast(`Failed to update book: ${error.message}`, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // **FIX**: Expose functions to global scope for HTML onclick attributes
    window.viewStore = viewStore;
    window.editStore = editStore;
    window.deleteStore = deleteStore;

    document.getElementById('add-store-btn').addEventListener('click', openAddModal);
    storeForm.addEventListener('submit', handleFormSubmit);
    searchBar.addEventListener('input', applyFilters);
    statusFilter.addEventListener('change', applyFilters);

    const editBookForm = document.getElementById('editBookForm');
    if (editBookForm) {
        editBookForm.addEventListener('submit', handleEditBookFormSubmit);
    }
    
    loadStores();
});