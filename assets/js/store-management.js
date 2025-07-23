import {
    collection,
    getDocs,
    getDoc,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    where,
    orderBy,
  } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js';
  import { db } from './firebase-config.js';
  
  // --- Global Variables & DOM Elements ---
  let allStores = [];
  let filteredStores = [];
  
  const storesTableBody = document.getElementById('stores-table-body');
  const noStoresMessage = document.getElementById('no-stores-message');
  
  const storeModalElement = document.getElementById('storeModal');
  const storeModal = storeModalElement ? new bootstrap.Modal(storeModalElement) : null;
  
  const storeModalLabel = document.getElementById('storeModalLabel');
  const storeForm = document.getElementById('store-form');
  const storeSubmitBtn = document.getElementById('store-submit-btn');
  const storeIdInput = document.getElementById('storeId');
  
  const searchBar = document.getElementById('store-search-bar');
  const statusFilter = document.getElementById('store-status-filter');
  
  // --- Utility Functions ---
  const showToast = (message, isError = false) => {
    alert(message);
    if (isError) console.error(message);
  };
  
  const getStatusBadgeClass = (status) => {
    return (status && status.toLowerCase() === 'active') ? 'success' : 'secondary';
  };
  
  // --- Load and Display Stores ---
  async function loadStores() {
    try {
      const storesSnapshot = await getDocs(collection(db, 'stores'));
  
      if (storesSnapshot.empty) {
        allStores = [];
        filteredStores = [];
        applyFilters();
        return;
      }
  
      // Map storeId => count of their books
      const booksSnapshot = await getDocs(collection(db, 'books'));
      const booksByStore = {};
      booksSnapshot.forEach((bookDoc) => {
        const bookData = bookDoc.data();
        if (bookData.storeId) {
          booksByStore[bookData.storeId] = (booksByStore[bookData.storeId] || 0) + 1;
        }
      });
  
      allStores = storesSnapshot.docs.map((storeDoc) => {
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
  
      applyFilters();
    } catch (error) {
      showToast("Error loading stores. See console for details.", true);
      console.error(error);
    }
  }
  
  // Get New Store ID (increment highest or fallback)
  async function getNextStoreId() {
    try {
      const storesSnapshot = await getDocs(collection(db, 'stores'));
      let maxId = 123003; // Initial baseline (one less than starting point)
  
      storesSnapshot.forEach((docSnap) => {
        const idNum = parseInt(docSnap.id, 10);
        if (!isNaN(idNum) && idNum > maxId) {
          maxId = idNum;
        }
      });
  
      return (maxId + 1).toString();
    } catch (error) {
      console.error('Error generating store ID:', error);
      return Date.now().toString(); // fallback
    }
  }
  
  // --- Form Submit Handler for Add/Edit Store ---
  async function handleFormSubmit(event) {
    event.preventDefault();
  
    if (!storeSubmitBtn) return;
    storeSubmitBtn.disabled = true;
  
    try {
      const storeId = storeIdInput.value || (await getNextStoreId());
  
      const storeData = {
        name: document.getElementById('storeName').value,
        ownerName: document.getElementById('ownerName').value,
        email: document.getElementById('storeEmail').value,
        phone: document.getElementById('storePhone').value,
        location: document.getElementById('storeLocation').value,
        status: document.getElementById('storeStatus').value,
        updatedAt: serverTimestamp(),
      };
  
      if (storeIdInput.value) {
        const storeRef = doc(db, 'stores', storeIdInput.value);
        await updateDoc(storeRef, storeData);
        showToast('Store updated successfully!');
      } else {
        const storeRef = doc(db, 'stores', storeId);
        await setDoc(storeRef, storeData);
        showToast('Store added successfully!');
      }
  
      if (storeModal) storeModal.hide();
      loadStores();
    } catch (error) {
      showToast(`Error saving store: ${error.message}`, true);
    } finally {
      storeSubmitBtn.disabled = false;
    }
  }
  
  // --- Delete Store ---
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
  
  // --- Filtering and Display ---
  function applyFilters() {
    const searchTerm = searchBar ? searchBar.value.toLowerCase() : '';
    const status = statusFilter ? statusFilter.value : '';
  
    filteredStores = allStores.filter((store) => {
      const matchesSearch =
        store.name.toLowerCase().includes(searchTerm) ||
        store.ownerName.toLowerCase().includes(searchTerm);
      const matchesStatus = !status || store.status === status;
      return matchesSearch && matchesStatus;
    });
  
    displayStores();
  }
  
  function displayStores() {
    if (!storesTableBody) return;
  
    const loaderRow = document.getElementById('stores-loader-row');
    if (loaderRow) loaderRow.style.display = 'none';
  
    if (filteredStores.length === 0) {
      if (noStoresMessage) {
        noStoresMessage.style.display = 'block';
        noStoresMessage.textContent =
          allStores.length === 0 ? 'No stores available.' : 'No stores match your search.';
      }
      storesTableBody.style.display = 'none';
      storesTableBody.innerHTML = '';
      return;
    }
  
    if (noStoresMessage) noStoresMessage.style.display = 'none';
    storesTableBody.style.display = '';
  
    storesTableBody.innerHTML = filteredStores
      .map((store) => {
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
          </tr>
        `;
      })
      .join('');
  }
  
  // --- View Store Books Modal ---
  async function viewStore(storeId) {
    const modalElement = document.getElementById('viewStoreBooksModal');
    if (!modalElement) return;
  
    const modal = new bootstrap.Modal(modalElement);
    const storeNameTitle = document.getElementById('storeNameTitle');
    const storeBooksList = document.getElementById('storeBooksList');
    const noBooksMessage = document.getElementById('noBooksMessage');
    const booksLoading = document.getElementById('booksLoading');
  
    storeBooksList.dataset.storeId = storeId;
  
    const onModalHidden = () => {
      modalElement.removeEventListener('hidden.bs.modal', onModalHidden);
    };
  
    try {
      storeBooksList.innerHTML = '';
      if (noBooksMessage) noBooksMessage.style.display = 'none';
      if (booksLoading) booksLoading.style.display = 'block';
  
      const storeDoc = await getDoc(doc(db, 'stores', storeId));
      if (!storeDoc.exists()) throw new Error('Store not found');
  
      storeNameTitle.textContent = storeDoc.data().name || 'N/A';
  
      const booksQuery = query(collection(db, 'books'), where('storeId', '==', storeId));
      const booksSnapshot = await getDocs(booksQuery);
  
      if (booksLoading) booksLoading.style.display = 'none';
  
      if (booksSnapshot.empty) {
        if (noBooksMessage) noBooksMessage.style.display = 'block';
        storeBooksList.innerHTML = '';
      } else {
        storeBooksList.innerHTML = booksSnapshot.docs
          .map((bookDoc) => {
            const book = { id: bookDoc.id, ...bookDoc.data() };
            const price =
              book.price != null
                ? `₹${parseFloat(book.price).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : 'N/A';
            return `
              <tr>
                <td data-label="Cover">
                  ${
                    book.coverImageUrl
                      ? `<img src="${book.coverImageUrl}" alt="${book.title || 'Book Cover'}" class="img-thumbnail" style="width: 50px; height: 70px; object-fit: cover;">`
                      : '<div class="bg-light d-flex align-items-center justify-content-center" style="width: 50px; height: 70px;"><i class="fas fa-book text-muted"></i></div>'
                  }
                </td>
                <td data-label="Title">${book.title || 'Untitled'}</td>
                <td data-label="Author">${book.author || 'N/A'}</td>
                <td data-label="Price">${price}</td>
                <td data-label="Stock">${typeof book.quantity !== 'undefined' ? book.quantity : 'N/A'}</td>
                <td data-label="Actions">
                  <button class="btn btn-sm btn-outline-primary edit-book-btn" data-book-id="${book.id}" title="Edit Book">
                    <i class="fas fa-edit me-1"></i>Edit
                  </button>
                </td>
              </tr>
            `;
          })
          .join('');
  
        storeBooksList.querySelectorAll('.edit-book-btn').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const bookId = e.currentTarget.dataset.bookId;
            modal.hide();
            openEditBookModal(bookId);
          });
        });
      }
  
      modalElement.addEventListener('hidden.bs.modal', onModalHidden, { once: true });
      modal.show();
    } catch (error) {
      console.error('Error loading store books:', error);
      showToast('Error loading store books. Please try again.', true);
      if (booksLoading) booksLoading.style.display = 'none';
      if (noBooksMessage) {
        noBooksMessage.style.display = 'block';
        noBooksMessage.textContent = 'Error loading books. Please try again.';
      }
    }
  }
  
  // --- Add/Edit Store Modal Management ---
  function openAddModal() {
    if (!storeForm) return;
    storeForm.reset();
    if (storeIdInput) storeIdInput.value = '';
    if (storeModalLabel) storeModalLabel.textContent = 'Add New Store';
    if (storeSubmitBtn) storeSubmitBtn.textContent = 'Add Store';
    if (storeModal) storeModal.show();
  }
  
  function editStore(id) {
    if (!storeForm) return;
  
    const store = allStores.find((s) => s.id === id);
    if (!store) {
      showToast('Store not found!', true);
      return;
    }
  
    if (storeIdInput) storeIdInput.value = store.id;
    document.getElementById('storeName').value = store.name || '';
    document.getElementById('ownerName').value = store.ownerName || '';
    document.getElementById('storeEmail').value = store.email || '';
    document.getElementById('storePhone').value = store.phone || '';
    document.getElementById('storeLocation').value = store.location || '';
    document.getElementById('storeStatus').value = store.status || '';
  
    if (storeModalLabel) storeModalLabel.textContent = 'Edit Store';
    if (storeSubmitBtn) storeSubmitBtn.textContent = 'Save Changes';
    if (storeModal) storeModal.show();
  }
  
  // --- Book Edit Modal and Submission ---
  
  async function openEditBookModal(bookId) {
    try {
      const bookDoc = await getDoc(doc(db, 'books', bookId));
      if (!bookDoc.exists()) throw new Error('Book not found!');
      const bookData = bookDoc.data();
  
      const bookIdInput = document.getElementById('bookId');
      const coverPreview = document.getElementById('bookCoverPreview');
      const bookTitlePreview = document.getElementById('bookTitlePreview');
      const bookAuthorPreview = document.getElementById('bookAuthorPreview');
      const priceInput = document.getElementById('price');
      const quantityInput = document.getElementById('quantity');
  
      if (bookIdInput) bookIdInput.value = bookId;
      if (coverPreview) coverPreview.src = bookData.coverImageUrl || '../assets/images/book-placeholder.jpg';
      if (bookTitlePreview) bookTitlePreview.textContent = bookData.title || 'No Title';
      if (bookAuthorPreview) bookAuthorPreview.textContent = bookData.author || 'Unknown Author';
      if (priceInput) priceInput.value = bookData.price || '';
      if (quantityInput) quantityInput.value = bookData.quantity ?? 0;
  
      const editBookModal = new bootstrap.Modal(document.getElementById('editBookModal'));
      editBookModal.show();
    } catch (error) {
      console.error('Error opening edit modal:', error);
      showToast(`Error loading book details: ${error.message}`, true);
    }
  }
  
  async function handleEditBookFormSubmit(e) {
    e.preventDefault();
  
    const form = e.target;
    if (!form) return;
  
    const submitBtn = form.querySelector('button[type="submit"]');
    const bookId = document.getElementById('bookId')?.value;
  
    const priceValue = document.getElementById('price')?.value.trim();
    const quantityValue = document.getElementById('quantity')?.value.trim();
  
    if (!priceValue || !quantityValue) {
      alert('Price and Quantity cannot be empty.');
      return;
    }
  
    const price = parseFloat(priceValue);
    const quantity = parseInt(quantityValue, 10);
  
    if (isNaN(price) || price < 0 || isNaN(quantity) || quantity < 0) {
      alert('Please enter valid non-negative numbers for price and quantity.');
      return;
    }
  
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Updating...';
    }
  
    try {
      await updateDoc(doc(db, 'books', bookId), {
        price,
        quantity,
        updatedAt: serverTimestamp(),
      });
  
      const toastEl = document.getElementById('successToast');
      const toastMessage = document.getElementById('toastMessage');
      if (toastMessage) toastMessage.textContent = 'Book updated successfully!';
      if (toastEl) {
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
      }
  
      const editBookModalInstance = bootstrap.Modal.getInstance(document.getElementById('editBookModal'));
      if (editBookModalInstance) editBookModalInstance.hide();
  
      // Refresh the books list if open
      const storeBooksList = document.getElementById('storeBooksList');
      if (storeBooksList && storeBooksList.dataset.storeId) {
        viewStore(storeBooksList.dataset.storeId);
      }
    } catch (error) {
      showToast(`Failed to update book: ${error.message}`, true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Update Book';
      }
    }
  }
  
  // --- Setup Event Listeners ---
  document.addEventListener('DOMContentLoaded', () => {
    // Expose functions for inline handlers
    window.viewStore = viewStore;
    window.editStore = editStore;
    window.deleteStore = deleteStore;
  
    const addStoreBtn = document.getElementById('add-store-btn');
    if (addStoreBtn) addStoreBtn.addEventListener('click', openAddModal);
  
    if (storeForm) storeForm.addEventListener('submit', handleFormSubmit);
    if (searchBar) searchBar.addEventListener('input', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
  
    const editBookForm = document.getElementById('editBookForm');
    if (editBookForm) editBookForm.addEventListener('submit', handleEditBookFormSubmit);
  
    loadStores();
  });
  