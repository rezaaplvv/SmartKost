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
 * Compress & resize image file via canvas before saving to MySQL
 * @param {File} file
 * @param {number} maxWidth
 * @param {number} quality
 * @returns {Promise<string>}
 */
function compressImageToBase64(file, maxWidth = 1200, quality = 0.82) {
    return new Promise((resolve) => {
        if (!file) {
            resolve(null);
            return;
        }
        fileToBase64(file).then((rawDataUrl) => {
            if (!rawDataUrl) {
                resolve(null);
                return;
            }
            const img = new Image();
            img.onload = () => {
                try {
                    let targetW = img.width;
                    let targetH = img.height;
                    if (targetW > maxWidth) {
                        targetH = Math.round((targetH * maxWidth) / targetW);
                        targetW = maxWidth;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = targetW;
                    canvas.height = targetH;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, targetW, targetH);
                    const compressed = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressed || rawDataUrl);
                } catch (e) {
                    resolve(rawDataUrl);
                }
            };
            img.onerror = () => resolve(rawDataUrl);
            img.src = rawDataUrl;
        }).catch(() => resolve(null));
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

/**
 * Resolve room image URL (uploaded custom image or matching room preset asset)
 * @param {object} room
 * @returns {string}
 */
function getRoomPhotoUrl(room) {
    if (room && Array.isArray(room.galeri_foto) && room.galeri_foto.length > 0 && room.galeri_foto[0]) {
        return room.galeri_foto[0];
    }
    if (room && room.foto_kamar && String(room.foto_kamar).trim() !== '') {
        return room.foto_kamar;
    }
    const tipe = (room && room.tipe ? room.tipe : '').toLowerCase();
    if (tipe === 'eksklusif') return 'assets/img/room-front.jpg';
    if (tipe === 'vip') return 'assets/img/room-middle.jpg';
    return 'assets/img/room-back.jpg';
}

/**
 * Resolve full room photo gallery array (always returns >= 1 image)
 * @param {object} room
 * @returns {string[]}
 */
function getRoomGallery(room) {
    if (room && Array.isArray(room.galeri_foto)) {
        const list = room.galeri_foto.map(x => String(x || '').trim()).filter(Boolean);
        if (list.length > 0) return list;
    }
    return [getRoomPhotoUrl(room)];
}

/**
 * Notify other open tabs (e.g. Landing Page) when room data/photos change
 */
function notifyRoomCatalogUpdated() {
    try {
        localStorage.setItem('smartkost_rooms_updated', String(Date.now()));
    } catch (e) {
        // ignore storage errors
    }
}

/**
 * Custom SmartKost Select Engine
 * Menggantikan popup <select> bawaan browser/OS pada seluruh halaman & modal
 * tanpa mengubah logika, value binding, maupun event handler asli.
 */
(function () {
    const ARROW_SVG = '<svg class="sk-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    const CHECK_SVG = '<svg class="sk-select-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';

    let activeInstance = null;
    let portalMenu = null;
    let globalBound = false;

    function ensurePortalMenu() {
        if (portalMenu) return portalMenu;
        portalMenu = document.createElement('div');
        portalMenu.className = 'sk-select-menu';
        portalMenu.setAttribute('role', 'listbox');
        document.body.appendChild(portalMenu);
        return portalMenu;
    }

    function positionPortalMenu(instance) {
        if (!portalMenu || !instance) return;
        const rect = instance.trigger.getBoundingClientRect();
        const viewportH = window.innerHeight || document.documentElement.clientHeight;
        const viewportW = window.innerWidth || document.documentElement.clientWidth;

        const minW = Math.max(rect.width, 165);
        portalMenu.style.minWidth = `${minW}px`;
        portalMenu.style.maxWidth = `${Math.min(Math.max(rect.width + 60, 260), viewportW - 24)}px`;

        const estimatedH = Math.min(portalMenu.scrollHeight || 220, 268);
        const spaceBelow = viewportH - rect.bottom - 12;
        const spaceAbove = rect.top - 12;
        const openUp = spaceBelow < Math.min(estimatedH, 160) && spaceAbove > spaceBelow;

        let left = rect.left;
        if (left + minW > viewportW - 12) {
            left = Math.max(12, viewportW - minW - 12);
        }

        portalMenu.style.left = `${left}px`;
        portalMenu.classList.toggle('open-up', openUp);

        if (openUp) {
            const bottomVal = viewportH - rect.top + 6;
            portalMenu.style.top = 'auto';
            portalMenu.style.bottom = `${bottomVal}px`;
        } else {
            portalMenu.style.bottom = 'auto';
            portalMenu.style.top = `${rect.bottom + 6}px`;
        }
    }

    function closeActiveMenu(restoreFocus = false) {
        if (!activeInstance) return;
        const prev = activeInstance;
        activeInstance = null;
        prev.wrap.classList.remove('is-open');
        prev.trigger.setAttribute('aria-expanded', 'false');
        if (portalMenu) {
            portalMenu.classList.remove('is-open');
        }
        if (restoreFocus) {
            prev.trigger.focus();
        }
    }

    function renderMenuOptions(instance) {
        const menu = ensurePortalMenu();
        menu.innerHTML = '';

        const options = Array.from(instance.select.options);
        if (!options.length) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'sk-select-option';
            emptyEl.style.opacity = '0.55';
            emptyEl.style.cursor = 'default';
            emptyEl.textContent = 'Tidak ada pilihan';
            menu.appendChild(emptyEl);
            return;
        }

        const currentVal = instance.select.value;
        options.forEach((opt) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sk-select-option';
            btn.setAttribute('role', 'option');
            const isSel = opt.value === currentVal && !opt.disabled;
            btn.classList.toggle('is-selected', isSel);
            btn.setAttribute('aria-selected', isSel ? 'true' : 'false');
            if (opt.disabled) btn.disabled = true;

            const span = document.createElement('span');
            span.className = 'sk-select-opt-text';
            span.textContent = opt.textContent || opt.label || '';
            btn.appendChild(span);
            btn.insertAdjacentHTML('beforeend', CHECK_SVG);

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (opt.disabled) return;
                const changed = instance.select.value !== opt.value;
                instance.select.value = opt.value;
                instance.syncLabel();
                closeActiveMenu(true);
                if (changed) {
                    instance.select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            menu.appendChild(btn);
        });
    }

    function openMenuFor(instance) {
        if (activeInstance === instance) {
            closeActiveMenu(false);
            return;
        }
        closeActiveMenu(false);
        activeInstance = instance;
        renderMenuOptions(instance);
        positionPortalMenu(instance);
        instance.wrap.classList.add('is-open');
        instance.trigger.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => {
            if (activeInstance === instance && portalMenu) {
                portalMenu.classList.add('is-open');
                const selItem = portalMenu.querySelector('.sk-select-option.is-selected');
                if (selItem) selItem.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    function bindGlobalEvents() {
        if (globalBound) return;
        globalBound = true;

        document.addEventListener('click', (e) => {
            if (!activeInstance) return;
            if (activeInstance.wrap.contains(e.target)) return;
            if (portalMenu && portalMenu.contains(e.target)) return;
            closeActiveMenu(false);
        });

        document.addEventListener('keydown', (e) => {
            if (!activeInstance) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                closeActiveMenu(true);
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const items = Array.from(portalMenu.querySelectorAll('.sk-select-option:not(:disabled)'));
                if (!items.length) return;
                const focusedIdx = items.findIndex(el => el.classList.contains('is-focused'));
                const selectedIdx = items.findIndex(el => el.classList.contains('is-selected'));
                let idx = focusedIdx >= 0 ? focusedIdx : selectedIdx;
                idx = e.key === 'ArrowDown'
                    ? (idx + 1) % items.length
                    : (idx - 1 + items.length) % items.length;
                items.forEach(el => el.classList.remove('is-focused'));
                items[idx].classList.add('is-focused');
                items[idx].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                const focused = portalMenu.querySelector('.sk-select-option.is-focused:not(:disabled)');
                if (focused) {
                    e.preventDefault();
                    focused.click();
                }
            }
        });

        window.addEventListener('resize', () => {
            if (activeInstance) positionPortalMenu(activeInstance);
        });

        document.addEventListener('scroll', (e) => {
            if (!activeInstance) return;
            if (portalMenu && portalMenu.contains(e.target)) return;
            positionPortalMenu(activeInstance);
        }, true);
    }

    function enhanceSelect(selectEl) {
        if (!selectEl || selectEl.dataset.skEnhanced === '1') return;
        selectEl.dataset.skEnhanced = '1';

        const isSm = selectEl.classList.contains('admin-select-sm');
        const isForm = selectEl.classList.contains('form-control');
        const isHero = Boolean(selectEl.closest('.search-field-select'));
        const isBlock = isForm || selectEl.style.width === '100%';

        const wrap = document.createElement('div');
        wrap.className = 'sk-select-wrap';
        if (isSm) wrap.classList.add('is-sm');
        if (isForm) wrap.classList.add('is-form');
        if (isHero) wrap.classList.add('is-hero');
        if (isBlock) wrap.classList.add('is-block');

        selectEl.parentNode.insertBefore(wrap, selectEl);
        wrap.appendChild(selectEl);
        selectEl.classList.add('sk-select-native');
        selectEl.tabIndex = -1;

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'sk-select-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        const labelAttr = selectEl.getAttribute('aria-label');
        if (labelAttr) trigger.setAttribute('aria-label', labelAttr);

        const labelSpan = document.createElement('span');
        labelSpan.className = 'sk-select-label';
        trigger.appendChild(labelSpan);
        trigger.insertAdjacentHTML('beforeend', ARROW_SVG);
        wrap.appendChild(trigger);

        const instance = {
            select: selectEl,
            wrap,
            trigger,
            syncLabel() {
                const selectedOpt = selectEl.options[selectEl.selectedIndex] || selectEl.options[0];
                labelSpan.textContent = selectedOpt ? (selectedOpt.textContent || selectedOpt.label || '-') : '-';
                if (activeInstance === instance) {
                    renderMenuOptions(instance);
                    positionPortalMenu(instance);
                }
            }
        };

        // Patch .value setter agar assignment programatik (misal form edit) langsung sinkron UI
        const nativeDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
        if (nativeDesc && nativeDesc.configurable) {
            Object.defineProperty(selectEl, 'value', {
                configurable: true,
                get() {
                    return nativeDesc.get.call(this);
                },
                set(val) {
                    nativeDesc.set.call(this, val);
                    instance.syncLabel();
                }
            });
        }

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            openMenuFor(instance);
        });

        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ' || e.key === 'Enter') {
                if (activeInstance !== instance) {
                    e.preventDefault();
                    openMenuFor(instance);
                }
            }
        });

        selectEl.addEventListener('change', () => instance.syncLabel());

        const formEl = selectEl.closest('form');
        if (formEl && !formEl.dataset.skResetBound) {
            formEl.dataset.skResetBound = '1';
            formEl.addEventListener('reset', () => {
                setTimeout(() => {
                    formEl.querySelectorAll('select[data-sk-enhanced="1"]').forEach(s => {
                        if (typeof s._skSync === 'function') s._skSync();
                    });
                }, 0);
            });
        }

        const observer = new MutationObserver(() => instance.syncLabel());
        observer.observe(selectEl, { childList: true, subtree: true, attributes: true });

        selectEl._skSync = () => instance.syncLabel();
        instance.syncLabel();
    }

    window.initCustomSelects = function (root = document) {
        bindGlobalEvents();
        (root || document).querySelectorAll('select').forEach(enhanceSelect);
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.initCustomSelects(document);
    });
})();

// Inisialisasi tema saat script dimuat
document.addEventListener('DOMContentLoaded', initTheme);

