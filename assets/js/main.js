document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    const sidebarCollapse = document.getElementById('sidebarCollapse');
    const overlay = document.querySelector('.overlay');

    const openSidebar = () => {
        if (sidebar) sidebar.classList.add('active');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    };

    const closeSidebar = () => {
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    if (sidebarCollapse) {
        sidebarCollapse.addEventListener('click', function(e) {
            e.stopPropagation();
            if (sidebar && sidebar.classList.contains('active')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar && sidebar.classList.contains('active')) {
            closeSidebar();
        }
    });

    window.addEventListener('resize', function() {
        if (window.innerWidth > 991.98 && sidebar && sidebar.classList.contains('active')) {
            closeSidebar();
        }
    });

    // Initialize Bootstrap components
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function(popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Handle restock buttons
    const restockButtons = document.querySelectorAll('.btn-outline-primary');
    restockButtons.forEach(button => {
        button.addEventListener('click', function() {
            alert('Restock request sent!');
        });
    });
});
