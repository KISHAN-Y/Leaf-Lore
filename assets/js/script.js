import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js';

async function fetchAndDisplayLowStockBooks() {
    const lowStockTableBody = document.querySelector('.low-stock-alerts tbody');
    if (!lowStockTableBody) return; // Only run on the dashboard

    const booksCollection = collection(db, 'books');
    const booksSnapshot = await getDocs(booksCollection);
    const booksData = booksSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

    lowStockTableBody.innerHTML = ''; // Clear existing content
    const lowStockBooks = booksData.filter(book => book.quantity <= 10);
    
    lowStockBooks.forEach(book => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="Book Title">${book.title}</td>
            <td data-label="Author">${book.author}</td>
            <td data-label="Stock Level"><span class="badge bg-danger">Low</span></td>
            <td data-label="Action"><button class="btn btn-sm btn-outline-primary">Restock</button></td>
        `;
        lowStockTableBody.appendChild(row);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchAndDisplayLowStockBooks();
});
