// Dashboard Firebase Integration
// This file handles all Firebase operations for the main dashboard

// Firebase configuration and initialization
const firebaseConfig = {
    apiKey: "AIzaSyASVgYJYiP7B0E1P29prTSbsTiSJvLmPXU",
    authDomain: "leaf-and-lore.firebaseapp.com",
    projectId: "leaf-and-lore",
    storageBucket: "leaf-and-lore.firebasestorage.app",
    messagingSenderId: "506279406729",
    appId: "1:506279406729:web:c7373ad5bf18caf53cea58"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Dashboard data management
class DashboardManager {
    constructor() {
        this.booksData = [];
        this.storesData = [];
        this.usersData = [];
        this.ordersData = [];
        this.init();
    }

    async init() {
        try {
            await this.loadAllData();
            this.updateDashboardStats();
            this.updateLowStockAlerts();
            this.updateActivityFeed();
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async loadAllData() {
        try {
            // Load books collection
            const booksSnapshot = await db.collection('books').get();
            this.booksData = booksSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Load stores collection
            const storesSnapshot = await db.collection('stores').get();
            this.storesData = storesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Load users collection
            const usersSnapshot = await db.collection('users').get();
            this.usersData = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Load all orders from users subcollections (avoid duplicates)
            this.ordersData = [];
            const processedOrderIds = new Set();
            
            for (const user of this.usersData) {
                try {
                    const ordersSnapshot = await db.collection('users').doc(user.id).collection('orders').get();
                    const userOrders = ordersSnapshot.docs.map(doc => ({
                        id: doc.id,
                        userId: user.id,
                        userName: user.name || 'Unknown User',
                        ...doc.data()
                    })).filter(order => {
                        // Avoid duplicate orders
                        const uniqueId = `${order.userId}-${order.id}`;
                        if (processedOrderIds.has(uniqueId)) {
                            console.log(`Skipping duplicate order: ${uniqueId}`);
                            return false;
                        }
                        processedOrderIds.add(uniqueId);
                        return true;
                    });
                    
                    this.ordersData.push(...userOrders);
                } catch (error) {
                    console.error(`Error loading orders for user ${user.id}:`, error);
                }
            }

            console.log('Data loaded successfully:', {
                books: this.booksData.length,
                stores: this.storesData.length,
                users: this.usersData.length,
                orders: this.ordersData.length
            });

        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    updateDashboardStats() {
        try {
            console.log('📊 Updating Dashboard Statistics...');
            console.log(`Total orders in database: ${this.ordersData.length}`);
            
            // Calculate total sales from DELIVERED orders only
            const deliveredOrders = this.ordersData.filter(order => {
                const status = (order.status || '').toLowerCase();
                const isDelivered = status === 'delivered' || status === 'completed';
                console.log(`Order ${order.id}: Status='${order.status}', IsDelivered=${isDelivered}`);
                return isDelivered;
            });
            
            console.log(`Delivered orders count: ${deliveredOrders.length}`);
            
            const totalSales = deliveredOrders.reduce((sum, order) => {
                const orderTotal = parseFloat(order.total) || 0;
                console.log(`Adding to total sales: $${orderTotal} from order ${order.id}`);
                return sum + orderTotal;
            }, 0);

            // Calculate total books sold from DELIVERED orders only
            // Each order has an 'items' array, and each item has its own 'quantity'
            const totalBooksSold = deliveredOrders.reduce((sum, order) => {
                let orderBookCount = 0;
                
                console.log(`📦 Processing delivered order ${order.id}:`);
                
                // Check if order has items array (your actual structure)
                if (order.items && Array.isArray(order.items)) {
                    console.log(`   📋 Order has ${order.items.length} items in the array`);
                    
                    // Loop through each item in the order and sum their quantities
                    order.items.forEach((item, index) => {
                        const itemQuantity = parseInt(item.quantity) || 1;
                        orderBookCount += itemQuantity;
                        console.log(`   📚 Item ${index}: "${item.title}" - Quantity: ${itemQuantity}`);
                    });
                    
                    console.log(`   🔢 Total books in this order: ${orderBookCount}`);
                } 
                // Fallback: if no items array, check for direct quantity field
                else if (order.quantity !== undefined && order.quantity !== null) {
                    orderBookCount = parseInt(order.quantity) || 0;
                    console.log(`   📦 Order has direct quantity field = ${orderBookCount}`);
                }
                // Last resort: assume 1 book
                else {
                    orderBookCount = 1;
                    console.warn(`   ⚠️ Order ${order.id}: No items array or quantity field found!`);
                    console.warn(`   ⚠️ Available fields:`, Object.keys(order));
                    console.warn(`   ⚠️ Assuming 1 book for this order.`);
                }
                
                console.log(`➕ Adding ${orderBookCount} books from order ${order.id} (Running total: ${sum} + ${orderBookCount} = ${sum + orderBookCount})`);
                return sum + orderBookCount;
            }, 0);

            // Calculate REAL active users (not filtered by isActive, show actual count)
            const activeUsers = this.usersData.length;
            console.log(`Total users in database: ${activeUsers}`);

            console.log(`📈 Final Stats: Sales=₹${totalSales}, Books Sold=${totalBooksSold}, Active Users=${activeUsers}`);

            // Update DOM elements
            this.updateStatCard('total-sales', `₹${totalSales.toLocaleString()}`);
            this.updateStatCard('books-sold', totalBooksSold.toLocaleString());
            this.updateStatCard('active-users', activeUsers.toLocaleString());

        } catch (error) {
            console.error('❌ Error updating dashboard stats:', error);
        }
    }

    updateStatCard(cardId, value) {
        const card = document.querySelector(`[data-stat="${cardId}"]`);
        if (card) {
            const valueElement = card.querySelector('.stat-value');
            if (valueElement) valueElement.textContent = value;
        }
    }

    // Removed calculateTrend function - no longer needed since we removed percentage trends

    updateLowStockAlerts() {
        try {
            console.log('📦 Checking Low Stock Alerts...');
            console.log(`Total books in database: ${this.booksData.length}`);
            
            // Find books with CRITICAL low stock (less than 5)
            const lowStockBooks = this.booksData.filter(book => {
                // Try different stock field names that might be used
                const stock = parseInt(book.stock) || parseInt(book.quantity) || parseInt(book.stockLevel) || parseInt(book.inventory) || 0;
                const isLowStock = stock < 5;
                console.log(`Book '${book.title}': Stock=${stock} (from fields: stock=${book.stock}, quantity=${book.quantity}, stockLevel=${book.stockLevel}), IsLowStock=${isLowStock}`);
                return isLowStock;
            });
            
            console.log(`📉 Critical low stock books found: ${lowStockBooks.length}`);
            lowStockBooks.forEach(book => {
                const stockValue = book.stock !== undefined ? book.stock : 'undefined';
                console.log(`⚠️  ALERT: '${book.title}' has only ${stockValue} units left!`);
            });

            const tableBody = document.querySelector('#low-stock-table tbody');
            if (tableBody) {
                tableBody.innerHTML = '';

                if (lowStockBooks.length === 0) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="4" class="text-center text-muted">No low stock alerts</td>
                        </tr>
                    `;
                } else {
                    lowStockBooks.forEach(book => {
                        const stockValue = parseInt(book.stock) || parseInt(book.quantity) || parseInt(book.stockLevel) || parseInt(book.inventory) || 0;
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td data-label="Book Title">${book.title || 'Unknown Title'}</td>
                            <td data-label="Author">${book.author || 'Unknown Author'}</td>
                            <td data-label="Stock Level">
                                <span class="badge ${this.getStockBadgeClass(stockValue)}">${stockValue}</span>
                            </td>
                            <td data-label="Action">
                                <button class="btn btn-sm btn-outline-primary" onclick="dashboard.restockBook('${book.id}')">
                                    Restock
                                </button>
                            </td>
                        `;
                        tableBody.appendChild(row);
                    });
                }
            }
        } catch (error) {
            console.error('Error updating low stock alerts:', error);
        }
    }

    getStockBadgeClass(stock) {
        const stockNum = parseInt(stock) || 0;
        console.log(`🏷️  Getting badge class for stock: ${stockNum}`);
        
        if (stockNum === 0) {
            console.log('🔴 Stock is 0 - CRITICAL (red badge)');
            return 'bg-danger';
        }
        if (stockNum === 1) {
            console.log('🔴 Stock is 1 - CRITICAL (red badge)');
            return 'bg-danger';
        }
        if (stockNum < 3) {
            console.log('🟠 Stock is very low (<3) - URGENT (orange badge)');
            return 'bg-danger';
        }
        if (stockNum < 5) {
            console.log('🟡 Stock is low (<5) - WARNING (yellow badge)');
            return 'bg-warning';
        }
        
        console.log('✅ Stock is adequate (>=5)');
        return 'bg-success';
    }

    updateActivityFeed() {
        try {
            console.log('📰 Updating Activity Feed...');
            const activityContainer = document.querySelector('.activity-feed');
            if (!activityContainer) return;

            const now = new Date();
            const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000));
            console.log(`⏰ Current time: ${now.toISOString()}`);
            console.log(`⏰ 30 minutes ago: ${thirtyMinutesAgo.toISOString()}`);

            // Get orders from last 30 minutes only
            const recentOrders = this.ordersData.filter(order => {
                try {
                    // Handle different date formats
                    let orderDate;
                    if (order.createdAt) {
                        if (typeof order.createdAt === 'number') {
                            orderDate = new Date(order.createdAt);
                        } else if (order.createdAt.seconds) {
                            // Firestore timestamp
                            orderDate = new Date(order.createdAt.seconds * 1000);
                        } else {
                            orderDate = new Date(order.createdAt);
                        }
                    } else {
                        orderDate = new Date(0); // Very old date
                    }
                    
                    const isRecent = orderDate >= thirtyMinutesAgo && orderDate <= now;
                    console.log(`Order ${order.id}: Created=${orderDate.toISOString()}, IsRecent=${isRecent}`);
                    return isRecent;
                } catch (error) {
                    console.log(`Order ${order.id}: Invalid date format, skipping`);
                    return false;
                }
            }).sort((a, b) => {
                try {
                    const dateA = this.parseOrderDate(a.createdAt);
                    const dateB = this.parseOrderDate(b.createdAt);
                    return dateB - dateA;
                } catch {
                    return 0;
                }
            });

            // Get users registered in last 30 minutes only
            const recentUsers = this.usersData.filter(user => {
                try {
                    let userDate;
                    if (user.createdAt) {
                        if (typeof user.createdAt === 'number') {
                            userDate = new Date(user.createdAt);
                        } else if (user.createdAt.seconds) {
                            // Firestore timestamp
                            userDate = new Date(user.createdAt.seconds * 1000);
                        } else {
                            userDate = new Date(user.createdAt);
                        }
                    } else {
                        userDate = new Date(0); // Very old date
                    }
                    
                    const isRecent = userDate >= thirtyMinutesAgo && userDate <= now;
                    console.log(`User ${user.name}: Registered=${userDate.toISOString()}, IsRecent=${isRecent}`);
                    return isRecent;
                } catch (error) {
                    console.log(`User ${user.name}: Invalid date format, skipping`);
                    return false;
                }
            }).sort((a, b) => {
                try {
                    const dateA = this.parseOrderDate(a.createdAt);
                    const dateB = this.parseOrderDate(b.createdAt);
                    return dateB - dateA;
                } catch {
                    return 0;
                }
            });
            
            console.log(`📊 Recent activity: ${recentOrders.length} orders, ${recentUsers.length} users in last 30 minutes`);
            
            if (recentOrders.length > 0) {
                console.log('🛒 Recent orders:');
                recentOrders.forEach(order => {
                    console.log(`  - Order #${order.id.substring(0, 8)} by ${order.userName} at ${new Date(order.createdAt).toLocaleString()}`);
                });
            }
            
            if (recentUsers.length > 0) {
                console.log('👥 Recent users:');
                recentUsers.forEach(user => {
                    console.log(`  - ${user.name} registered at ${new Date(user.createdAt).toLocaleString()}`);
                });
            }

            let activityHTML = '';

            // Add recent orders (last 30 minutes)
            recentOrders.forEach(order => {
                const timeAgo = this.getTimeAgo(order.createdAt);
                activityHTML += `
                    <div class="activity-item">
                        <i class="fas fa-shopping-cart text-success"></i>
                        <div class="activity-content">
                            <h6>New Order Placed</h6>
                            <p><strong>Order #${order.id.substring(0, 8)}</strong> by ${order.userName}</p>
                            <p class="mb-1"><small>📦 Quantity: ${order.quantity} | 💰 Total: ₹${order.total}</small></p>
                            <small class="text-muted">⏰ ${timeAgo} (${this.formatDate(order.createdAt)})</small>
                        </div>
                    </div>
                `;
            });

            // Add recent users (last 30 minutes)
            recentUsers.forEach(user => {
                const timeAgo = this.getTimeAgo(user.createdAt);
                activityHTML += `
                    <div class="activity-item">
                        <i class="fas fa-user-plus text-primary"></i>
                        <div class="activity-content">
                            <h6>👤 New User Registered</h6>
                            <p><strong>${user.name || 'New User'}</strong></p>
                            <p class="mb-1"><small>📧 ${user.email || 'No email provided'}</small></p>
                            <small class="text-muted">⏰ ${timeAgo} (${this.formatDate(user.createdAt)})</small>
                        </div>
                    </div>
                `;
            });

            if (activityHTML === '') {
                activityHTML = `
                    <div class="activity-item">
                        <i class="fas fa-clock text-muted"></i>
                        <div class="activity-content">
                            <h6>🔇 No Recent Activity (Last 30 Minutes)</h6>
                            <p>No new orders or user registrations in the last 30 minutes.</p>
                            <small class="text-muted">Activity will appear here when it happens</small>
                        </div>
                    </div>
                `;
            }

            activityContainer.innerHTML = activityHTML;

        } catch (error) {
            console.error('Error updating activity feed:', error);
        }
    }

    formatDate(dateValue) {
        if (!dateValue) return 'Recently';
        
        try {
            let date;
            
            // Handle Firestore Timestamp objects
            if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
                date = dateValue.toDate();
            }
            // Handle Firestore Timestamp with seconds and nanoseconds
            else if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
                date = new Date(dateValue.seconds * 1000);
            }
            // Handle regular Date objects
            else if (dateValue instanceof Date) {
                date = dateValue;
            }
            // Handle timestamp numbers (milliseconds)
            else if (typeof dateValue === 'number') {
                date = new Date(dateValue);
            }
            // Handle date strings
            else if (typeof dateValue === 'string') {
                date = new Date(dateValue);
            }
            else {
                console.warn('⚠️ Unknown date format:', dateValue);
                return 'Recently';
            }
            
            // Check if date is valid
            if (isNaN(date.getTime())) {
                console.warn('⚠️ Invalid date created from:', dateValue);
                return 'Recently';
            }
            
            // Format the date nicely
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / (1000 * 60));
            
            if (diffMins < 1) {
                return 'Just now';
            } else if (diffMins < 60) {
                return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
            } else if (diffMins < 1440) { // Less than 24 hours
                const hours = Math.floor(diffMins / 60);
                return `${hours} hour${hours === 1 ? '' : 's'} ago`;
            } else {
                return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }
            
        } catch (error) {
            console.error('❌ Error formatting date:', error, 'Input:', dateValue);
            return 'Recently';
        }
    }

    parseOrderDate(dateValue) {
        if (!dateValue) return new Date(0);
        
        try {
            if (typeof dateValue === 'number') {
                return new Date(dateValue);
            } else if (dateValue.seconds) {
                // Firestore timestamp
                return new Date(dateValue.seconds * 1000);
            } else {
                return new Date(dateValue);
            }
        } catch {
            return new Date(0);
        }
    }

    getTimeAgo(dateString) {
        if (!dateString) return 'Just now';
        try {
            const date = this.parseOrderDate(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / (1000 * 60));
            
            if (diffMins < 1) return 'Just now';
            if (diffMins === 1) return '1 minute ago';
            if (diffMins < 60) return `${diffMins} minutes ago`;
            
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours === 1) return '1 hour ago';
            if (diffHours < 24) return `${diffHours} hours ago`;
            
            const diffDays = Math.floor(diffHours / 24);
            if (diffDays === 1) return '1 day ago';
            return `${diffDays} days ago`;
        } catch {
            return 'Recently';
        }
    }

    async restockBook(bookId) {
        try {
            const book = this.booksData.find(b => b.id === bookId);
            if (!book) return;

            const newStock = prompt(`Enter new stock quantity for "${book.title}":`, '50');
            if (newStock === null || isNaN(newStock)) return;

            await db.collection('books').doc(bookId).update({
                stock: parseInt(newStock),
                lastUpdated: new Date().toISOString()
            });

            // Refresh data
            await this.loadAllData();
            this.updateLowStockAlerts();
            this.showSuccess(`Stock updated for "${book.title}"`);

        } catch (error) {
            console.error('Error restocking book:', error);
            this.showError('Failed to update stock');
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    // Real-time listeners (fixed to prevent data duplication)
    setupRealtimeListeners() {
        console.log('🔄 Setting up real-time listeners...');
        
        // Only listen for books changes (for low stock alerts)
        if (!this.booksListener) {
            this.booksListener = db.collection('books').onSnapshot((snapshot) => {
                console.log('📚 Books collection updated');
                this.booksData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.updateLowStockAlerts();
                // Don't update dashboard stats here to prevent conflicts
            });
        }

        // Simplified: Only refresh data every 30 seconds instead of real-time listeners
        // This prevents the data inconsistency issue
        if (!this.refreshInterval) {
            this.refreshInterval = setInterval(() => {
                console.log('🔄 Periodic data refresh...');
                this.loadAllData().then(() => {
                    this.updateDashboardStats();
                    this.updateActivityFeed();
                });
            }, 30000); // Refresh every 30 seconds
        }
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', function() {
    dashboard = new DashboardManager();
    
    // Setup real-time listeners after initial load
    setTimeout(() => {
        dashboard.setupRealtimeListeners();
    }, 2000);
});

// Export for global access
window.dashboard = dashboard;
