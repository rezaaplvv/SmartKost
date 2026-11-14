/**
 * ==========================================================
 * SmartKost Pro - Global Utility Functions
 * Strict no-emoji policy: Standard clean UI icon glyphs & SVGs
 * ==========================================================
 */

// SVG Icon Library for dynamic injection
const SVG_ICONS = {
    checkCircle: `<svg class="icon toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    alertCircle: `<svg class="icon toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
    info: `<svg class="icon toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    bed: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"></path><path d="M2 8h18a2 2 0 0 1 2 2v10"></path><path d="M2 17h20"></path><path d="M6 8v9"></path></svg>`,
    shield: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    wifi: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>`
};

/**
 * Format integer/float into Indonesian Rupiah format
 * @param {number|string} amount 
 * @returns {string} e.g. "Rp 1.500.000"
 */
function formatRupiah(amount) {
    const num = parseInt(amount, 10) || 0;
    return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Format ISO or standard date string to Indonesian formatted text
 * @param {string} dateStr e.g. "2026-11-14"
 * @returns {string} e.g. "14 Nov 2026"
 */
function formatDateIndo(dateStr) {
    if (!dateStr) return '-';
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            const day = parseInt(parts[2], 10);
            const monthIdx = parseInt(parts[1], 10) - 1;
            const year = parts[0];
            return `${day} ${months[monthIdx] || ''} ${year}`;
        }
        return dateStr;
    } catch (e) {
        return dateStr;
    }
}

/**
 * Convert HTML File Input to Base64 String
 * @param {File} file 
 * @returns {Promise<string>}
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

/**
 * Modern non-blocking Toast notification system
 * @param {string} message 
 * @param {'success'|'error'|'warning'|'info'} type 
 * @param {number} durationMs 
 */
function showToast(message, type = 'info', durationMs = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconHtml = SVG_ICONS.info;
    if (type === 'success') iconHtml = SVG_ICONS.checkCircle;
    else if (type === 'error' || type === 'warning') iconHtml = SVG_ICONS.alertCircle;

    toast.innerHTML = `
        ${iconHtml}
        <div class="toast-content">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, durationMs);
}

/**
 * User Session Management Helpers
 */
const AUTH_KEY = 'smartkost_user_session';

function setAuthSession(userData) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
}

function getAuthSession() {
    try {
        const raw = localStorage.getItem(AUTH_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function clearAuthSession() {
    localStorage.removeItem(AUTH_KEY);
}

/**
 * Theme Toggle Handler (Light/Dark Mode)
 */
function initTheme() {
    const savedTheme = localStorage.getItem('smartkost_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('smartkost_theme', next);
    return next;
}

// Inisialisasi tema saat script dimuat
document.addEventListener('DOMContentLoaded', initTheme);

