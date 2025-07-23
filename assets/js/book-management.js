import { db, collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from './firebase-config.js';

let booksData = [];
let currentSearchTerm = '';
let currentAuthor = '';
let currentSort = 'newest'; // Default sort order

// Toast elements and instance
const toastElement = document.getElementById('successToast');
const toastMessageEl = document.getElementById('toastMessage');
const toastInstance = toastElement ? new bootstrap.Toast(toastElement) : null;

// Show success toast
function showSuccess(message) {
  if (!toastInstance || !toastMessageEl) return;
  toastMessageEl.textContent = message;
  toastInstance.show();
}

// Show error toast (fallback with console.error)
function showError(message) {
  console.error(message);
  // You could create a separate error toast if desired.
  // For now, fallback with alert or extend this.
  alert(message);
}

const fetchBooks = async () => {
  const booksSnapshot = await getDocs(collection(db, 'books'));
  booksData = booksSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  populateAuthorFilter();
  applyFiltersAndDisplay();
};

const populateAuthorFilter = () => {
  const authorFilter = document.getElementById('authorFilter');
  if (!authorFilter) return;

  const authors = [...new Set(booksData.map((book) => book.author))].sort();

  authorFilter.innerHTML = '<option value=""> All Author</option>';

  authors.forEach((author) => {
    const option = document.createElement('option');
    option.value = author;
    option.textContent = author;
    authorFilter.appendChild(option);
  });
};

const applyFiltersAndDisplay = () => {
  let processedBooks = [...booksData];

  if (currentSearchTerm) {
    const lowerSearchTerm = currentSearchTerm.toLowerCase();
    processedBooks = processedBooks.filter(
      ({ title, author, id }) =>
        title?.toLowerCase().includes(lowerSearchTerm) ||
        author?.toLowerCase().includes(lowerSearchTerm) ||
        (id && id.toString().includes(currentSearchTerm))
    );
  }

  if (currentAuthor) {
    processedBooks = processedBooks.filter((book) => book.author === currentAuthor);
  }

  if (currentSort === 'newest') {
    processedBooks.sort((a, b) => parseInt(b.id, 10) - parseInt(a.id, 10));
  } else if (currentSort === 'oldest') {
    processedBooks.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  }

  displayBooks(processedBooks);
};

const getRatingStars = (rating = 0) => {
  const totalStars = 5;
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 !== 0;
  let starsHtml = '';

  for (let i = 0; i < fullStars; i++) starsHtml += '<i class="bi bi-star-fill text-warning"></i>';
  if (halfStar) starsHtml += '<i class="bi bi-star-half text-warning"></i>';
  for (let i = 0; i < totalStars - fullStars - (halfStar ? 1 : 0); i++)
    starsHtml += '<i class="bi bi-star text-warning"></i>';

  return starsHtml;
};

const getQuantityBadge = (quantity) => {
  if (quantity >= 10) return `<span class="badge bg-success">${quantity} In Stock</span>`;
  if (quantity > 0) return `<span class="badge bg-warning">${quantity} Low Stock</span>`;
  return `<span class="badge bg-danger">Out of Stock</span>`;
};

const displayBooks = (booksToDisplay) => {
  const mainTableBody = document.querySelector('table:not(.low-stock-alerts) tbody');
  if (!mainTableBody) return;

  mainTableBody.innerHTML = booksToDisplay
    .map(
      ({
        coverImageUrl,
        title,
        author,
        genre,
        quantity,
        price,
        storeId,
        id,
      }) => `
      <tr>
        <td data-label="Image">
          <img src="${coverImageUrl || '../assets/images/placeholder.png'}" alt="${title}" class="book-cover" />
        </td>
        <td data-label="Title">${title}</td>
        <td data-label="Author">${author}</td>
        <td data-label="Category">${genre}</td>
        <td data-label="Quantity">${getQuantityBadge(quantity)}</td>
        <td data-label="Price">₹${Number(price).toFixed(2)}</td>
        <td data-label="Store ID">${storeId}</td>
        <td data-label="Actions">
          <button class="btn btn-sm btn-outline-secondary me-2 eye-btn" data-id="${id}">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-sm btn-outline-primary me-2 edit-btn" data-id="${id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${id}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `
    )
    .join('');
};

window.openViewModal = (bookId) => {
  const book = booksData.find((b) => b.id === bookId);
  if (!book) return;

  const modalEl = document.getElementById('viewBookModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  document.getElementById('viewBookTitle').textContent = book.title;
  document.getElementById('viewCoverImage').src = book.coverImageUrl || '../assets/images/placeholder.png';

  const detailsContainer = document.getElementById('viewBookDetails');
  detailsContainer.innerHTML = /*html*/ `
    <div class="row mb-2"><div class="col-sm-4"><strong>Author:</strong></div><div class="col-sm-8">${book.author}</div></div>
    <div class="row mb-2"><div class="col-sm-4"><strong>Genre:</strong></div><div class="col-sm-8">${book.genre}</div></div>
    <div class="row mb-2"><div class="col-sm-4"><strong>Price:</strong></div><div class="col-sm-8">₹${Number(book.price).toFixed(2)}</div></div>
    <div class="row mb-2"><div class="col-sm-4"><strong>Quantity:</strong></div><div class="col-sm-8">${getQuantityBadge(book.quantity)}</div></div>
    <div class="row mb-2"><div class="col-sm-4"><strong>Rating:</strong></div><div class="col-sm-8">${getRatingStars(book.rating)}</div></div>
    <div class="row mb-2"><div class="col-sm-4"><strong>Store:</strong></div><div class="col-sm-8">${book.storeName} (ID: ${book.storeId})</div></div>
    <hr />
    <div class="row mb-2"><div class="col-12"><strong>Author Bio:</strong></div><div class="col-12"><p>${book.authorBio || 'N/A'}</p></div></div>
    <div class="row mb-2"><div class="col-12"><strong>Description:</strong></div><div class="col-12"><p>${book.description || 'N/A'}</p></div></div>
    <div class="row mb-2"><div class="col-12"><strong>Preview:</strong></div><div class="col-12"><p>${book.preview || 'N/A'}</p></div></div>
  `;

  modal.show();
};

window.openEditModal = (bookId) => {
  const book = booksData.find((b) => b.id === bookId);
  if (!book) return;

  const modalEl = document.getElementById('addBookModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  modalEl.querySelector('.modal-title').textContent = 'Edit Book';
  document.getElementById('addBookSubmitBtn').textContent = 'Save Changes';

  const form = modalEl.querySelector('form');

  form.querySelector('#bookId').value = book.id;
  form.querySelector('#title').value = book.title;
  form.querySelector('#author').value = book.author;
  form.querySelector('#authorBio').value = book.authorBio ?? '';
  form.querySelector('#genre').value = book.genre;
  form.querySelector('#coverImageUrl').value = book.coverImageUrl ?? '';
  form.querySelector('#description').value = book.description ?? '';
  form.querySelector('#preview').value = book.preview ?? '';
  form.querySelector('#price').value = book.price;
  form.querySelector('#originalPrice').value = book.originalPrice ?? '';
  form.querySelector('#quantity').value = book.quantity;
  form.querySelector('#rating').value = book.rating ?? '';
  form.querySelector('#store').value = book.storeId;

  const imagePreview = document.getElementById('imagePreview');
  if (book.coverImageUrl) {
    imagePreview.src = book.coverImageUrl;
    imagePreview.style.display = 'block';
  } else {
    imagePreview.style.display = 'none';
  }

  modal.show();
};

window.deleteBook = async (bookId) => {
  if (!confirm('Are you sure you want to delete this book?')) return;
  
  try {
    await deleteDoc(doc(db, 'books', bookId));
    showSuccess('Book deleted successfully!');
    await fetchBooks();
  } catch (error) {
    console.error('Error deleting book:', error);
    showError('Failed to delete book.');
  }
};

window.updateBook = async (bookId, formData) => {
  const storeSelect = document.getElementById('store');
  if (!storeSelect) return;
  const selectedStoreOption = storeSelect.options[storeSelect.selectedIndex];

  const updatedBookData = {
    title: formData.get('title'),
    author: formData.get('author'),
    authorBio: formData.get('authorBio'),
    genre: formData.get('genre'),
    quantity: Number(formData.get('quantity')),
    price: Number(formData.get('price')),
    originalPrice: Number(formData.get('originalPrice')),
    rating: Number(formData.get('rating')),
    storeId: selectedStoreOption.value,
    storeName: selectedStoreOption.textContent,
    coverImageUrl: formData.get('coverImageUrl'),
    description: formData.get('description'),
    preview: formData.get('preview'),
  };

  try {
    await updateDoc(doc(db, 'books', bookId), updatedBookData);
    showSuccess('Book updated successfully!');
    await fetchBooks();
  } catch (error) {
    showError('Failed to update book.');
  }
};

window.addBook = async (formData) => {
  let maxId = booksData.reduce((max, book) => {
    const numericId = parseInt(book.id, 10);
    return isNaN(numericId) ? max : Math.max(max, numericId);
  }, 0);

  const newId = (maxId > 0 ? maxId + 1 : 1023).toString();

  const storeSelect = document.getElementById('store');
  if (!storeSelect) return;
  const selectedStoreOption = storeSelect.options[storeSelect.selectedIndex];

  const newBook = {
    id: newId,
    title: formData.get('title'),
    author: formData.get('author'),
    authorBio: formData.get('authorBio'),
    genre: formData.get('genre'),
    quantity: Number(formData.get('quantity')),
    price: Number(formData.get('price')),
    originalPrice: Number(formData.get('originalPrice')),
    rating: Number(formData.get('rating')),
    storeId: selectedStoreOption.value,
    storeName: selectedStoreOption.textContent,
    coverImageUrl: formData.get('coverImageUrl'),
    description: formData.get('description'),
    preview: formData.get('preview'),
  };

  try {
    await setDoc(doc(db, 'books', newId), newBook);
    showSuccess('Book added successfully!');
    await fetchBooks();
  } catch (error) {
    showError('Failed to add book.');
  }
};

const populateStoresDropdown = async () => {
  const storeSelect = document.getElementById('store');
  if (!storeSelect) return;

  try {
    const storesSnapshot = await getDocs(collection(db, 'stores'));

    storeSelect.innerHTML = '<option value="" disabled selected>Select a Store</option>';

    storesSnapshot.forEach((doc) => {
      const store = doc.data();
      const option = document.createElement('option');
      option.value = store.id;
      option.textContent = store.name;
      storeSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error fetching stores:', error);
    storeSelect.innerHTML = '<option value="" disabled>Could not load stores</option>';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  fetchBooks();
  populateStoresDropdown();

  const searchInput = document.querySelector('input[placeholder="Search by title, author, or ISBN"]');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value;
      applyFiltersAndDisplay();
    });
  }

  const authorFilter = document.getElementById('authorFilter');
  if (authorFilter) {
    authorFilter.addEventListener('change', (e) => {
      currentAuthor = e.target.value;
      applyFiltersAndDisplay();
    });
  }

  const dateSort = document.getElementById('dateSort');
  if (dateSort) {
    dateSort.addEventListener('change', (e) => {
      currentSort = e.target.value;
      applyFiltersAndDisplay();
    });
  }

  document.body.addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;

    if (btn.classList.contains('edit-btn')) {
      window.openEditModal(btn.dataset.id);
    } else if (btn.classList.contains('delete-btn')) {
      window.deleteBook(btn.dataset.id);
    } else if (btn.classList.contains('eye-btn')) {
      window.openViewModal(btn.dataset.id);
    }
  });

  const addBookModal = document.getElementById('addBookModal');
  if (!addBookModal) return;

  const addBookForm = addBookModal.querySelector('form');
  const imagePreview = document.getElementById('imagePreview');
  const coverImageUrlInput = document.getElementById('coverImageUrl');

  if (addBookForm) {
    addBookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(addBookForm);
      const bookId = formData.get('bookId');

      if (bookId) {
        await window.updateBook(bookId, formData);
      } else {
        await window.addBook(formData);
      }

      const modalInstance = bootstrap.Modal.getInstance(addBookModal);
      if (modalInstance) modalInstance.hide();
    });
  }

  addBookModal.addEventListener('hidden.bs.modal', () => {
    if (addBookForm) addBookForm.reset();

    if (imagePreview) {
      imagePreview.style.display = 'none';
      imagePreview.src = '';
    }

    addBookModal.querySelector('.modal-title').textContent = 'Add New Book';
    if (addBookForm) addBookForm.querySelector('#bookId').value = '';
    const submitBtn = document.getElementById('addBookSubmitBtn');
    if (submitBtn) submitBtn.textContent = 'Add Book';
  });

  if (coverImageUrlInput && imagePreview) {
    coverImageUrlInput.addEventListener('input', () => {
      const url = coverImageUrlInput.value.trim();
      if (url) {
        imagePreview.src = url;
        imagePreview.style.display = 'block';
      } else {
        imagePreview.style.display = 'none';
      }
    });
  }
});
