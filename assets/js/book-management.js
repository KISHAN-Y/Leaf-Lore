import { db, collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from './firebase-config.js';

let booksData = [];
let filteredBooksData = [];

async function fetchBooks() {
    const booksCollection = collection(db, 'books');
    const booksSnapshot = await getDocs(booksCollection);
    booksData = booksSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    displayBooks();
}

// Helper function to generate star ratings
function getRatingStars(rating) {
    const totalStars = 5;
    let starsHtml = '';
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
        starsHtml += '<i class="bi bi-star-fill text-warning"></i>';
    }
    if (halfStar) {
        starsHtml += '<i class="bi bi-star-half text-warning"></i>';
    }
    for (let i = 0; i < totalStars - fullStars - (halfStar ? 1 : 0); i++) {
        starsHtml += '<i class="bi bi-star text-warning"></i>';
    }
    return starsHtml;
}

// Helper function to generate quantity badges
function getQuantityBadge(quantity) {
    if (quantity >= 10) {
        return `<span class="badge bg-success">${quantity} In Stock</span>`;
    } else if (quantity > 0) {
        return `<span class="badge bg-warning">${quantity} Low Stock</span>`;
    } else {
        return `<span class="badge bg-danger">Out of Stock</span>`;
    }
}

function displayBooks() {
    const mainTableBody = document.querySelector('table:not(.low-stock-alerts) tbody');

    if (mainTableBody) {
        mainTableBody.innerHTML = '';
        const booksToDisplay = filteredBooksData.length > 0 ? filteredBooksData : booksData;
        booksToDisplay.forEach(book => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Image">
                    <img src="${book.coverImageUrl || '../assets/images/placeholder.png'}" alt="${book.title}" class="book-cover">
                </td>
                <td data-label="Title">${book.title}</td>
                <td data-label="Author">${book.author}</td>
                <td data-label="Category">${book.genre}</td>
                <td data-label="Quantity">${getQuantityBadge(book.quantity)}</td>
                <td data-label="Price">₹${Number(book.price).toFixed(2)}</td>
                <td data-label="Store ID">${book.storeId}</td>
                <td data-label="Actions">
                    <button class="btn btn-sm btn-outline-secondary me-2 eye-btn" data-id="${book.id}"><i class="bi bi-eye"></i></button>
                    <button class="btn btn-sm btn-outline-primary me-2 edit-btn" data-id="${book.id}"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${book.id}"><i class="bi bi-trash"></i></button>
                </td>
            `;
            mainTableBody.appendChild(row);
        });
    }
}

window.openViewModal = function(bookId) {
    const book = booksData.find(b => b.id === bookId);
    if (!book) return;

    const modalElement = document.getElementById('viewBookModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

    document.getElementById('viewBookTitle').textContent = book.title;
    document.getElementById('viewCoverImage').src = book.coverImageUrl || '../assets/images/placeholder.png';

    const detailsContainer = document.getElementById('viewBookDetails');
    detailsContainer.innerHTML = `
        <div class="row mb-2">
            <div class="col-sm-4"><strong>Author:</strong></div>
            <div class="col-sm-8">${book.author}</div>
        </div>
        <div class="row mb-2">
            <div class="col-sm-4"><strong>Genre:</strong></div>
            <div class="col-sm-8">${book.genre}</div>
        </div>
        <div class="row mb-2">
            <div class="col-sm-4"><strong>Price:</strong></div>
            <div class="col-sm-8">₹${Number(book.price).toFixed(2)}</div>
        </div>
        <div class="row mb-2">
            <div class="col-sm-4"><strong>Quantity:</strong></div>
            <div class="col-sm-8">${getQuantityBadge(book.quantity)}</div>
        </div>
        <div class="row mb-2">
            <div class="col-sm-4"><strong>Rating:</strong></div>
            <div class="col-sm-8">${getRatingStars(book.rating)}</div>
        </div>
        <div class="row mb-2">
            <div class="col-sm-4"><strong>Store:</strong></div>
            <div class="col-sm-8">${book.storeName} (ID: ${book.storeId})</div>
        </div>
        <hr>
        <div class="row mb-2">
            <div class="col-12"><strong>Author Bio:</strong></div>
            <div class="col-12"><p>${book.authorBio || 'N/A'}</p></div>
        </div>
        <div class="row mb-2">
            <div class="col-12"><strong>Description:</strong></div>
            <div class="col-12"><p>${book.description || 'N/A'}</p></div>
        </div>
        <div class="row mb-2">
            <div class="col-12"><strong>Preview:</strong></div>
            <div class="col-12"><p>${book.preview || 'N/A'}</p></div>
        </div>
    `;

    modal.show();
}

window.openEditModal = function(bookId) {
    const book = booksData.find(b => b.id === bookId);
    if (!book) return;

    const modalElement = document.getElementById('addBookModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    
    modalElement.querySelector('.modal-title').textContent = 'Edit Book';
    document.getElementById('addBookSubmitBtn').textContent = 'Save Changes';
    const form = modalElement.querySelector('form');

    form.querySelector('#bookId').value = book.id;
    form.querySelector('#title').value = book.title;
    form.querySelector('#author').value = book.author;
    form.querySelector('#authorBio').value = book.authorBio || '';
    form.querySelector('#genre').value = book.genre;
    form.querySelector('#coverImageUrl').value = book.coverImageUrl || '';
    form.querySelector('#description').value = book.description || '';
    form.querySelector('#preview').value = book.preview || '';
    form.querySelector('#price').value = book.price;
    form.querySelector('#originalPrice').value = book.originalPrice || '';
    form.querySelector('#quantity').value = book.quantity;
    form.querySelector('#rating').value = book.rating || '';
    form.querySelector('#store').value = book.storeId;

    const imagePreview = document.getElementById('imagePreview');
    if (book.coverImageUrl) {
        imagePreview.src = book.coverImageUrl;
        imagePreview.style.display = 'block';
    } else {
        imagePreview.style.display = 'none';
    }

    modal.show();
}

window.deleteBook = async function(bookId) {
    if (confirm('Are you sure you want to delete this book?')) {
        try {
            await deleteDoc(doc(db, 'books', bookId));
            await fetchBooks(); // Refresh the book list
        } catch (error) {
            console.error("Error deleting book: ", error);
            alert('Failed to delete book.');
        }
    }
}

window.updateBook = async function(bookId, formData) {
    const storeSelect = document.getElementById('store');
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

    const bookRef = doc(db, 'books', bookId);
    await updateDoc(bookRef, updatedBookData);
    await fetchBooks();
};

window.addBook = async function(formData) {
    // Find the highest numeric ID from the existing books
    let maxId = 0;
    booksData.forEach(book => {
        const numericId = parseInt(book.id, 10);
        if (!isNaN(numericId) && numericId > maxId) {
            maxId = numericId;
        }
    });

    // If no numeric ID found, start from 1022, so the first one will be 1023
    const newId = (maxId > 0 ? maxId + 1 : 1023).toString();
    const storeSelect = document.getElementById('store');
    const selectedStoreOption = storeSelect.options[storeSelect.selectedIndex];

    const newBook = {
        id: newId, // Storing the new ID within the document
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
    // Use setDoc to create a document with a custom ID
    const newBookRef = doc(db, 'books', newId);
    await setDoc(newBookRef, newBook);
    await fetchBooks();
}

window.editBook = function(bookId) {
    const book = booksData.find(b => b.id === bookId);
    if (!book) return;
    console.log('Editing book:', book);
    // Modal population logic would go here
}

window.deleteBook = async function(bookId) {
    if (confirm('Are you sure you want to delete this book?')) {
        await deleteDoc(doc(db, 'books', bookId));
        await fetchBooks();
    }
}

function handleSearch(searchTerm) {
    if (!searchTerm) {
        filteredBooksData = [];
    } else {
        filteredBooksData = booksData.filter(book => 
            book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            book.author.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    displayBooks();
}

async function populateStoresDropdown() {
    const storeSelect = document.getElementById('store');
    if (!storeSelect) return;

    try {
        const storesCollection = collection(db, 'stores');
        const storesSnapshot = await getDocs(storesCollection);
        
        storeSelect.innerHTML = '<option value="" disabled selected>Select a Store</option>';
        
        storesSnapshot.forEach(doc => {
            const store = doc.data();
            const option = document.createElement('option');
            option.value = store.id; // Using the 'id' field from the document
            option.textContent = store.name;
            storeSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error fetching stores: ", error);
        storeSelect.innerHTML = '<option value="" disabled>Could not load stores</option>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchBooks();
    populateStoresDropdown();

    const searchInput = document.querySelector('input[placeholder="Search by title, author, or ISBN"]');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
    }

    const addBookModal = document.getElementById('addBookModal');
    document.body.addEventListener('click', function(event) {
        const editBtn = event.target.closest('.edit-btn');
        if (editBtn) {
            const bookId = editBtn.dataset.id;
            window.openEditModal(bookId);
            return;
        }

        const deleteBtn = event.target.closest('.delete-btn');
        if (deleteBtn) {
            const bookId = deleteBtn.dataset.id;
            window.deleteBook(bookId);
            return;
        }

        const viewBtn = event.target.closest('.eye-btn');
        if (viewBtn) {
            const bookId = viewBtn.dataset.id;
            window.openViewModal(bookId);
        }
    });

    if (addBookModal) {
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
                
                const modal = bootstrap.Modal.getInstance(addBookModal);
                modal.hide();
            });
        }

        addBookModal.addEventListener('hidden.bs.modal', () => {
            addBookForm.reset();
            if (imagePreview) {
                imagePreview.style.display = 'none';
                imagePreview.src = '';
            }
            addBookModal.querySelector('.modal-title').textContent = 'Add New Book';
            addBookForm.querySelector('#bookId').value = '';
            document.getElementById('addBookSubmitBtn').textContent = 'Add Book';
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
    }
});