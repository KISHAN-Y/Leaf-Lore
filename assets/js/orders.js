import { 
    collection, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js';
import { db } from './firebase-config.js';

// Global variables
let allOrders = [];
let filteredOrders = [];

// DOM elements
const ordersTableBody = document.getElementById('orders-table-body');
const ordersLoader = document.getElementById('orders-loader');
const noOrdersMessage = document.getElementById('no-orders-message');
const searchBar = document.getElementById('order-search-bar');
const statusFilter = document.getElementById('order-status-filter');
const sortSelect = document.getElementById('order-sort-select');
const totalOrdersElement = document.getElementById('total-orders');
const pendingOrdersElement = document.getElementById('pending-orders');
const deliveredOrdersElement = document.getElementById('delivered-orders');
const totalRevenueElement = document.getElementById('total-revenue');

// --- Utility Functions ---
function showLoader(show = true) {
    if (ordersLoader) ordersLoader.style.display = show ? 'block' : 'none';
}

function showSuccess(message) {
    alert(message); // Replace with a proper toast notification
}

function showError(message) {
    console.error(message);
    alert(message); // Replace with a proper toast notification
}

function formatDate(date) {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getStatusBadgeClass(status) {
    if (!status) return 'secondary';
    switch (status.toLowerCase()) {
        case 'delivered': return 'success';
        case 'shipped': return 'info';
        case 'cancelled':
        case 'canceled': return 'danger';
        case 'pending':
        case 'processing': return 'warning';
        default: return 'secondary';
    }
}

// --- Core Functions ---
async function loadOrders() {
    try {
        showLoader(true);
        allOrders = [];
        
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        
        if (usersSnapshot.empty) {
            displayOrders();
            return;
        }
        
        const orderPromises = usersSnapshot.docs.map(userDoc => {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const userOrdersRef = collection(db, 'users', userId, 'orders');
            const userOrdersQuery = query(userOrdersRef, orderBy('createdAt', 'desc'));
            
            return getDocs(userOrdersQuery).then(ordersSnapshot => {
                return ordersSnapshot.docs.map(orderDoc => {
                    const orderData = orderDoc.data();
                    return {
                        id: orderDoc.id,
                        userId: userId,
                        userEmail: userData.email || orderData.userEmail || 'N/A',
                        userName: userData.name || orderData.userName || 'Customer',
                        amount: orderData.total || orderData.amount || 0,
                        items: orderData.items || [],
                        status: orderData.status || 'pending',
                        createdAt: orderData.createdAt?.toDate() || new Date()
                    };
                });
            });
        });
        
        const allUserOrders = await Promise.all(orderPromises);
        allOrders = allUserOrders.flat().sort((a, b) => b.createdAt - a.createdAt);
        
        filteredOrders = [...allOrders];
        displayOrders();
        updateStatistics();
        
    } catch (error) {
        console.error('Error loading orders:', error);
        showError('Error loading orders. Please check console for details.');
    } finally {
        showLoader(false);
    }
}

function displayOrders() {
    if (!ordersTableBody) return;

    ordersTableBody.innerHTML = '';
    if (noOrdersMessage) {
        noOrdersMessage.style.display = filteredOrders.length === 0 ? 'block' : 'none';
    }

    if (filteredOrders.length === 0) return;

    ordersTableBody.innerHTML = filteredOrders.map(order => {
        let booksInfo = 'N/A';
        if (order.items && order.items.length > 0) {
            const firstItem = order.items[0];
            booksInfo = `${firstItem.title || 'N/A'}`;
            if (order.items.length > 1) {
                booksInfo += ` (+${order.items.length - 1} more)`;
            }
        }

        return `
        <tr>
            <td data-label="Order ID"><strong>#${order.id.substring(0, 8)}</strong></td>
            <td data-label="Customer">
                <div class="customer-info">
                    ${order.userName}<br/><small class="text-muted">${order.userEmail}</small>
                </div>
            </td>
            <td data-label="Books">${booksInfo}</td>
            <td data-label="Amount">₹${(order.amount || 0).toFixed(2)}</td>
            <td data-label="Status">
                <span class="badge bg-${getStatusBadgeClass(order.status)} rounded-pill">
                    ${order.status}
                </span>
            </td>
            <td data-label="Date">${formatDate(order.createdAt)}</td>
            <td data-label="Actions">
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary" onclick="viewOrder('${order.id}', '${order.userId}')" title="View Details"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-outline-success" onclick="updateOrderStatus('${order.id}', 'delivered')" title="Mark as Delivered" ${order.status === 'delivered' ? 'disabled' : ''}><i class="fas fa-check-circle"></i></button>
                    <button class="btn btn-outline-danger" onclick="deleteOrder('${order.id}')" title="Delete Order"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function applyFiltersAndSort() {
    const searchTerm = searchBar?.value.toLowerCase() || '';
    const status = statusFilter?.value || '';
    const sortValue = sortSelect?.value || 'date-desc';

    filteredOrders = allOrders.filter(order => {
        const matchesSearch = !searchTerm || 
            order.id.toLowerCase().includes(searchTerm) ||
            order.userEmail.toLowerCase().includes(searchTerm) ||
            order.userName.toLowerCase().includes(searchTerm) ||
            (order.items && order.items.some(item => (item.title || '').toLowerCase().includes(searchTerm)));
        
        const matchesStatus = !status || order.status === status;
        return matchesSearch && matchesStatus;
    });

    filteredOrders.sort((a, b) => {
        switch(sortValue) {
            case 'date-asc': return a.createdAt - b.createdAt;
            case 'amount-asc': return a.amount - b.amount;
            case 'amount-desc': return b.amount - a.amount;
            default: return b.createdAt - a.createdAt; // date-desc
        }
    });
    
    displayOrders();
    updateStatistics();
}

function updateStatistics() {
    const total = allOrders.length;
    const pending = allOrders.filter(o => o.status === 'pending').length;
    const delivered = allOrders.filter(o => o.status === 'delivered').length;
    const totalRevenue = allOrders.reduce((sum, order) => sum + order.amount, 0);

    if (totalOrdersElement) totalOrdersElement.textContent = total;
    if (pendingOrdersElement) pendingOrdersElement.textContent = pending;
    if (deliveredOrdersElement) deliveredOrdersElement.textContent = delivered;
    if (totalRevenueElement) totalRevenueElement.textContent = `₹${totalRevenue.toFixed(2)}`;
}

// --- Event Handlers ---
async function updateOrderStatus(orderId, newStatus) {
    // Only show confirmation if triggered from modal
    const modalElement = document.getElementById('orderDetailsModal');
    const isModalOpen = modalElement && modalElement.classList.contains('show');
    if (isModalOpen && !confirm(`Are you sure you want to mark this order as ${newStatus}?`)) {
        return;
    }

    try {
        const order = allOrders.find(o => o.id === orderId);
        if (!order) throw new Error('Order not found.');
        
        const orderRef = doc(db, 'users', order.userId, 'orders', orderId);
        await updateDoc(orderRef, { status: newStatus, updatedAt: serverTimestamp() });
        
        // Step 1: Update the status in our local array
        order.status = newStatus;
        
        // FIXED: Step 2: Always redraw the main order list to reflect the change
        applyFiltersAndSort();
        
        // OPTIMIZED: Step 3: If the modal is open, just update its UI elements directly
        if (isModalOpen) {
            // Update the status badge in the modal header
            const orderStatusBadge = modalElement.querySelector('#orderStatus');
            orderStatusBadge.textContent = newStatus;
            orderStatusBadge.className = `badge rounded-pill bg-${getStatusBadgeClass(newStatus)}`;
            
            // Update the active state of the status buttons
            modalElement.querySelectorAll('[data-status]').forEach(button => {
                 button.classList.toggle('active', button.dataset.status === newStatus);
            });
        }

        if (isModalOpen) {
            showSuccess(`Order status updated to ${newStatus}.`);
        }
    } catch (error) {
        showError(`Error updating order status: ${error.message}`);
    }
}

async function deleteOrder(orderId) {
    if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) return;
    try {
        const order = allOrders.find(o => o.id === orderId);
        if (!order) throw new Error('Order not found.');
        
        const orderRef = doc(db, 'users', order.userId, 'orders', orderId);
        await deleteDoc(orderRef);
        
        allOrders = allOrders.filter(o => o.id !== orderId);
        applyFiltersAndSort();
        showSuccess('Order deleted successfully.');
    } catch (error) {
        showError(`Error deleting order: ${error.message}`);
    }
}

const formatCurrency = (amount) => `₹${(amount || 0).toFixed(2)}`;

async function viewOrder(orderId, userId) {
    if (!userId) {
        showError('Could not view order details. User information is missing.');
        return;
    }

    const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
    const modalElement = document.getElementById('orderDetailsModal');
    
    modalElement.querySelector('#orderId').textContent = `#${orderId}`;
    modalElement.querySelector('#orderStatus').textContent = 'Loading...';
    modal.show();

    try {
        const orderRef = doc(db, 'users', userId, 'orders', orderId);
        const userRef = doc(db, 'users', userId);
        const [orderSnap, userSnap] = await Promise.all([getDoc(orderRef), getDoc(userRef)]);

        if (!orderSnap.exists()) {
            throw new Error('Order not found');
        }

        const orderData = orderSnap.data();
        const userData = userSnap.exists() ? userSnap.data() : {};
        
        modalElement.querySelector('#orderId').textContent = `#${orderId}`;
        modalElement.querySelector('#orderStatus').textContent = orderData.status || 'Pending';
        modalElement.querySelector('#orderStatus').className = `badge rounded-pill bg-${getStatusBadgeClass(orderData.status)}`;
        modalElement.querySelector('#orderDate').textContent = formatDate(orderData.createdAt);
        
        modalElement.querySelector('#customerName').textContent = userData.name || orderData.userName || 'N/A';
        modalElement.querySelector('#customerEmail').textContent = userData.email || orderData.userEmail || 'N/A';
        
        const getPhoneNumber = () => {
            const address = orderData.shippingAddress || orderData.address || {};
            const phoneFields = [address.phone, orderData.phone, userData.phone, userData.phoneNumber, address.phoneNumber];
            const phone = phoneFields.find(p => p && p.toString().trim() !== '');
            return phone ? phone.toString() : 'N/A';
        };
        modalElement.querySelector('#customerPhone').textContent = getPhoneNumber();
        
        const address = orderData.shippingAddress || orderData.address || orderData.shipping || {};
        
        const getAddressPart = (possibleKeys, defaultValue = '') => {
            for (const key of possibleKeys) {
                if (address[key]) return address[key];
            }
            return defaultValue;
        };

        const line1 = getAddressPart(['line1', 'addressLine1', 'street']);
        const city = getAddressPart(['city', 'town']);
        const state = getAddressPart(['state', 'province']);
        const country = getAddressPart(['country']);
        const postalCode = getAddressPart(['postalCode', 'pincode', 'zip']);

        const addressLine1 = [line1].filter(Boolean).join(', ');
        const addressLine2 = [city, state, country, postalCode].filter(Boolean).join(', ');
        
        const addressElement = modalElement.querySelector('#shippingAddressContent');
        if (addressLine1 || addressLine2) {
            addressElement.innerHTML = `
                ${addressLine1 ? `<span class="d-block">${addressLine1}</span>` : ''}
                ${addressLine2 ? `<span class="d-block">${addressLine2}</span>` : ''}
            `;
        } else if (typeof address === 'string' && address.trim()) {
            addressElement.textContent = address;
        } else {
            addressElement.textContent = 'N/A';
        }
        
        const itemsTable = modalElement.querySelector('#orderItemsTable');
        itemsTable.innerHTML = (orderData.items || []).map(item => `
            <tr>
                <td data-label="Item">
                    <strong>${item.title || 'N/A'}</strong><br>
                    <small class="text-muted">${item.author || 'N/A'}</small>
                </td>
                <td data-label="Price">${formatCurrency(item.price)}</td>
                <td data-label="Qty">${item.quantity || 1}</td>
                <td data-label="Total" class="text-end">${formatCurrency((item.price || 0) * (item.quantity || 1))}</td>
            </tr>
        `).join('');
        
        modalElement.querySelector('#subtotal').textContent = formatCurrency(orderData.subtotal);
        modalElement.querySelector('#shipping').textContent = formatCurrency(orderData.shipping);
        modalElement.querySelector('#taxes').textContent = formatCurrency(orderData.taxes);
        modalElement.querySelector('#orderTotal').textContent = formatCurrency(orderData.total);
        
        const statusButtons = modalElement.querySelectorAll('[data-status]');
        statusButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.status === orderData.status);
            button.onclick = () => updateOrderStatus(orderId, button.dataset.status);
        });
        
        const printButton = modalElement.querySelector('#printInvoice');
        printButton.onclick = () => window.print();
        
    } catch (error) {
        console.error('Error loading order details:', error);
        showError(`Failed to load order details: ${error.message}`);
        modal.hide();
    }
}

// --- Initialization ---
function setupEventListeners() {
    if (searchBar) searchBar.addEventListener('input', applyFiltersAndSort);
    if (statusFilter) statusFilter.addEventListener('change', applyFiltersAndSort);
    if (sortSelect) sortSelect.addEventListener('change', applyFiltersAndSort);
}

document.addEventListener('DOMContentLoaded', () => {
    window.viewOrder = viewOrder;
    window.updateOrderStatus = updateOrderStatus;
    window.deleteOrder = deleteOrder;

    setupEventListeners();
    loadOrders();
});