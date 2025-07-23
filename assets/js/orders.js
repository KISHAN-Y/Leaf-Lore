import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp,
  } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js';
  import { db } from './firebase-config.js';
  
  // Global state
  let allOrders = [];
  let filteredOrders = [];
  
  // DOM Elements
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
  const showLoader = (show = true) => {
    if (!ordersLoader) return;
    ordersLoader.style.display = show ? 'block' : 'none';
  };
  
  const showSuccess = (message) => {
    // Replace this alert with your toast notification if available
    alert(message);
  };
  
  const showError = (message) => {
    console.error(message);
    alert(message);
  };
  
  // Format Firestore or JS Date into readable format
  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = typeof date.toDate === 'function' ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  
  // Provide Bootstrap badge color classes based on order status
  const getStatusBadgeClass = (status) => {
    if (!status) return 'secondary';
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'success';
      case 'shipped':
        return 'info';
      case 'cancelled':
      case 'canceled':
        return 'danger';
      case 'pending':
      case 'processing':
        return 'warning';
      default:
        return 'secondary';
    }
  };
  
  // --- Core Functions ---
  
  const loadOrders = async () => {
    try {
      showLoader(true);
      allOrders = [];
  
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
  
      if (usersSnapshot.empty) {
        filteredOrders = [];
        displayOrders();
        updateStatistics();
        return;
      }
  
      const orderPromises = usersSnapshot.docs.map(async (userDoc) => {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const userOrdersRef = collection(db, 'users', userId, 'orders');
        const userOrdersQuery = query(userOrdersRef, orderBy('createdAt', 'desc'));
  
        const ordersSnapshot = await getDocs(userOrdersQuery);
  
        return ordersSnapshot.docs.map((orderDoc) => {
          const orderData = orderDoc.data();
          return {
            id: orderDoc.id,
            userId,
            userEmail: userData.email || orderData.userEmail || 'N/A',
            userName: userData.name || orderData.userName || 'Customer',
            amount: orderData.total || orderData.amount || 0,
            items: orderData.items || [],
            status: orderData.status || 'pending',
            createdAt: orderData.createdAt?.toDate ? orderData.createdAt.toDate() : new Date(),
          };
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
  };
  
  const displayOrders = () => {
    if (!ordersTableBody) return;
  
    ordersTableBody.innerHTML = '';
  
    if (noOrdersMessage) {
      noOrdersMessage.style.display = filteredOrders.length === 0 ? 'block' : 'none';
    }
  
    if (filteredOrders.length === 0) return;
  
    ordersTableBody.innerHTML = filteredOrders
      .map((order) => {
        let booksInfo = 'N/A';
  
        if (order.items && order.items.length > 0) {
          const firstItem = order.items[0];
          booksInfo = firstItem.title || 'N/A';
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
            <td data-label="Amount">₹${Number(order.amount).toFixed(2)}</td>
            <td data-label="Status">
              <span class="badge bg-${getStatusBadgeClass(order.status)} rounded-pill">
                ${order.status}
              </span>
            </td>
            <td data-label="Date">${formatDate(order.createdAt)}</td>
            <td data-label="Actions">
              <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-outline-primary" onclick="viewOrder('${order.id}', '${order.userId}')" title="View Details">
                  <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-outline-success" onclick="updateOrderStatus('${order.id}', 'delivered')" title="Mark as Delivered" ${
                  order.status === 'delivered' ? 'disabled' : ''
                }>
                  <i class="fas fa-check-circle"></i>
                </button>
                <button class="btn btn-outline-danger" onclick="deleteOrder('${order.id}')" title="Delete Order">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  };
  
  const applyFiltersAndSort = () => {
    const searchTerm = searchBar ? searchBar.value.trim().toLowerCase() : '';
    const status = statusFilter ? statusFilter.value : '';
    const sortValue = sortSelect ? sortSelect.value : 'date-desc';
  
    filteredOrders = allOrders.filter((order) => {
      const matchesSearch =
        !searchTerm ||
        order.id.toLowerCase().includes(searchTerm) ||
        order.userEmail.toLowerCase().includes(searchTerm) ||
        order.userName.toLowerCase().includes(searchTerm) ||
        (order.items && order.items.some((item) => (item.title || '').toLowerCase().includes(searchTerm)));
  
      const matchesStatus = !status || order.status === status;
  
      return matchesSearch && matchesStatus;
    });
  
    filteredOrders.sort((a, b) => {
      switch (sortValue) {
        case 'date-asc':
          return a.createdAt - b.createdAt;
        case 'amount-asc':
          return a.amount - b.amount;
        case 'amount-desc':
          return b.amount - a.amount;
        default:
          return b.createdAt - a.createdAt; // date-desc default
      }
    });
  
    displayOrders();
    updateStatistics();
  };
  
  const updateStatistics = () => {
    const total = allOrders.length;
    const pending = allOrders.filter((o) => o.status === 'pending').length;
    const delivered = allOrders.filter((o) => o.status === 'delivered').length;
    const totalRevenue = allOrders.reduce((sum, order) => sum + order.amount, 0);
  
    if (totalOrdersElement) totalOrdersElement.textContent = total;
    if (pendingOrdersElement) pendingOrdersElement.textContent = pending;
    if (deliveredOrdersElement) deliveredOrdersElement.textContent = delivered;
    if (totalRevenueElement) totalRevenueElement.textContent = `₹${totalRevenue.toFixed(2)}`;
  };
  
  // --- Event Handlers ---
  
  const updateOrderStatus = async (orderId, newStatus) => {
    const modalElement = document.getElementById('orderDetailsModal');
    const isModalOpen = modalElement && modalElement.classList.contains('show');
  
    if (isModalOpen && !confirm(`Are you sure you want to mark this order as ${newStatus}?`)) {
      return;
    }
  
    try {
      const order = allOrders.find((o) => o.id === orderId);
      if (!order) throw new Error('Order not found.');
  
      const orderRef = doc(db, 'users', order.userId, 'orders', orderId);
      await updateDoc(orderRef, { status: newStatus, updatedAt: serverTimestamp() });
  
      // Update locally
      order.status = newStatus;
  
      // Refresh list UI
      applyFiltersAndSort();
  
      if (isModalOpen) {
        const orderStatusBadge = modalElement.querySelector('#orderStatus');
        if (orderStatusBadge) {
          orderStatusBadge.textContent = newStatus;
          orderStatusBadge.className = `badge rounded-pill bg-${getStatusBadgeClass(newStatus)}`;
        }
  
        modalElement.querySelectorAll('[data-status]').forEach((button) => {
          button.classList.toggle('active', button.dataset.status === newStatus);
        });
  
        showSuccess(`Order status updated to ${newStatus}.`);
      }
    } catch (error) {
      showError(`Error updating order status: ${error.message}`);
    }
  };
  
  const deleteOrder = async (orderId) => {
    if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) return;
  
    try {
      const order = allOrders.find((o) => o.id === orderId);
      if (!order) throw new Error('Order not found.');
  
      const orderRef = doc(db, 'users', order.userId, 'orders', orderId);
      await deleteDoc(orderRef);
  
      allOrders = allOrders.filter((o) => o.id !== orderId);
      applyFiltersAndSort();
  
      showSuccess('Order deleted successfully.');
    } catch (error) {
      showError(`Error deleting order: ${error.message}`);
    }
  };
  
  const formatCurrency = (amount) => `₹${(amount || 0).toFixed(2)}`;
  
  const viewOrder = async (orderId, userId) => {
    if (!userId) {
      showError('Could not view order details. User information is missing.');
      return;
    }
  
    const modalElement = document.getElementById('orderDetailsModal');
    const modal = new bootstrap.Modal(modalElement);
    
    if (!modalElement) {
      showError('Order details modal not found.');
      return;
    }
  
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
  
      const orderStatusEl = modalElement.querySelector('#orderStatus');
      if (orderStatusEl) {
        orderStatusEl.textContent = orderData.status || 'Pending';
        orderStatusEl.className = `badge rounded-pill bg-${getStatusBadgeClass(orderData.status)}`;
      }
  
      const orderDateEl = modalElement.querySelector('#orderDate');
      if (orderDateEl) orderDateEl.textContent = formatDate(orderData.createdAt);
  
      const customerNameEl = modalElement.querySelector('#customerName');
      if (customerNameEl) customerNameEl.textContent = userData.name || orderData.userName || 'N/A';
  
      const customerEmailEl = modalElement.querySelector('#customerEmail');
      if (customerEmailEl) customerEmailEl.textContent = userData.email || orderData.userEmail || 'N/A';
  
      // Phone number lookup
      const getPhoneNumber = () => {
        const address = orderData.shippingAddress || orderData.address || {};
        const phoneCandidates = [
          address?.phone,
          orderData?.phone,
          userData?.phone,
          userData?.phoneNumber,
          address?.phoneNumber,
        ];
        const phone = phoneCandidates.find((p) => p && p.toString().trim() !== '');
        return phone ? phone.toString() : 'N/A';
      };
  
      const customerPhoneEl = modalElement.querySelector('#customerPhone');
      if (customerPhoneEl) customerPhoneEl.textContent = getPhoneNumber();
  
      const address = orderData.shippingAddress || orderData.address || orderData.shipping || {};
      const getAddressPart = (keys, defaultValue = '') => {
        for (const key of keys) {
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
      if (addressElement) {
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
      }
  
      // Items table
      const itemsTable = modalElement.querySelector('#orderItemsTable');
      if (itemsTable) {
        itemsTable.innerHTML = (orderData.items || [])
          .map(
            (item) => `
              <tr>
                <td data-label="Item">
                  <strong>${item.title || 'N/A'}</strong><br>
                  <small class="text-muted">${item.author || 'N/A'}</small>
                </td>
                <td data-label="Price">${formatCurrency(item.price)}</td>
                <td data-label="Qty">${item.quantity || 1}</td>
                <td data-label="Total" class="text-end">${formatCurrency((item.price || 0) * (item.quantity || 1))}</td>
              </tr>
            `
          )
          .join('');
      }
  
      // Cost breakdown
      const setTextContent = (selector, value) => {
        const el = modalElement.querySelector(selector);
        if (el) el.textContent = formatCurrency(value);
      };
  
      setTextContent('#subtotal', orderData.subtotal);
      setTextContent('#shipping', orderData.shipping);
      setTextContent('#taxes', orderData.taxes);
      setTextContent('#orderTotal', orderData.total);
  
      // Status buttons
      modalElement.querySelectorAll('[data-status]').forEach((button) => {
        button.classList.toggle('active', button.dataset.status === orderData.status);
        button.onclick = () => updateOrderStatus(orderId, button.dataset.status);
      });
  
      // Print invoice button
      const printButton = modalElement.querySelector('#printInvoice');
      if (printButton) {
        printButton.onclick = () => window.print();
      }
    } catch (error) {
      console.error('Error loading order details:', error);
      showError(`Failed to load order details: ${error.message}`);
      modal.hide();
    }
  };
  
  // --- Initialization ---
  const setupEventListeners = () => {
    if (searchBar) searchBar.addEventListener('input', applyFiltersAndSort);
    if (statusFilter) statusFilter.addEventListener('change', applyFiltersAndSort);
    if (sortSelect) sortSelect.addEventListener('change', applyFiltersAndSort);
  };
  
  document.addEventListener('DOMContentLoaded', () => {
    window.viewOrder = viewOrder;
    window.updateOrderStatus = updateOrderStatus;
    window.deleteOrder = deleteOrder;
  
    setupEventListeners();
    loadOrders();
  });
  