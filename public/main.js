// ============================================================================
// Testbus - Common / Core Script (main.js)
// Shared utilities, navigation, cookie banner, scroll effects
// ============================================================================

// --- Configs & Global Constants ---
window.NOTE_DESCRIPTIONS = {};

// --- General Utility Helpers (exposed to window for other scripts) ---
window.timeToMinutes = function(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

window.escapeHTML = function(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[m]));
};

window.fetchWithCache = async function(url, cacheKey, ttlMs) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < ttlMs) {
                return parsed.data;
            }
        } catch (e) {
            // Ignore corrupted cache
        }
    }
    const response = await fetch(url);
    const data = await response.json();
    localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: data
    }));
    return data;
};

// Scroll Reveal Animations Helper (Intersection Observer)
function initRevealAnimations() {
    const revealCallback = (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-visible');
            }
        });
    };

    const revealObserver = new IntersectionObserver(revealCallback, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    const observeNewElements = () => {
        const revealElements = document.querySelectorAll('.reveal:not(.reveal-visible)');
        revealElements.forEach(el => revealObserver.observe(el));
    };

    observeNewElements();

    // Expose to window so dynamically rendered elements (FAQs, prices) can trigger it
    window.observeNewElements = observeNewElements;
}

// --- Cookie Banner & Preference Management ---
function getSavedCookieConsent() {
    try {
        const saved = localStorage.getItem('cookie_consent');
        if (saved) return JSON.parse(saved);
        if (localStorage.getItem('zaakceptowane_cookies') === 'true') {
            return { essential: true, analytics: true };
        }
    } catch (e) {
        console.error('Error reading cookie consent', e);
    }
    return null;
}

function applyCookieConsent(consent) {
    if (!consent) return;
    localStorage.setItem('cookie_consent', JSON.stringify(consent));
    localStorage.setItem('zaakceptowane_cookies', 'true');

    // Google Analytics consent configuration
    if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
            'analytics_storage': consent.analytics ? 'granted' : 'denied'
        });
    }

    if (window.GA_MEASUREMENT_ID) {
        window['ga-disable-' + window.GA_MEASUREMENT_ID] = !consent.analytics;
    }
}

function createCookiePreferencesModal() {
    let modal = document.getElementById('cookie-modal-overlay');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'cookie-modal-overlay';
    modal.id = 'cookie-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'cookie-modal-title');
    modal.setAttribute('aria-modal', 'true');

    const currentConsent = getSavedCookieConsent() || { essential: true, analytics: true };

    modal.innerHTML = `
        <div class="cookie-modal-card">
            <div class="cookie-modal-header">
                <h3 id="cookie-modal-title">Preferencje plików cookies</h3>
                <button class="cookie-modal-close" id="cookie-modal-close-btn" aria-label="Zamknij">&times;</button>
            </div>
            <div class="cookie-modal-body">
                <p class="cookie-modal-intro">
                    Szanujemy Twoją prywatność. Poniżej możesz dostosować zgody na wykorzystanie plików cookies w naszym serwisie. Szczegóły znajdziesz w naszej <a href="/prywatnosc" target="_blank">Polityce Prywatności</a>.
                </p>
                
                <div class="cookie-option-group">
                    <div class="cookie-option-header">
                        <div class="cookie-option-info">
                            <strong>Niezbędne pliki cookies</strong>
                            <span class="cookie-badge cookie-badge-required">Zawsze aktywne</span>
                        </div>
                        <label class="cookie-switch">
                            <input type="checkbox" checked disabled>
                            <span class="cookie-slider disabled"></span>
                        </label>
                    </div>
                    <p class="cookie-option-desc">
                        Te pliki cookie są niezbędne do prawidłowego funkcjonowania serwisu, zapewnienia bezpieczeństwa oraz zapamiętania Twoich ustawień prywatności. Nie można ich wyłączyć.
                    </p>
                </div>

                <div class="cookie-option-group">
                    <div class="cookie-option-header">
                        <div class="cookie-option-info">
                            <strong>Analityczne pliki cookies (Google Analytics)</strong>
                            <span class="cookie-badge cookie-badge-optional">Opcjonalne</span>
                        </div>
                        <label class="cookie-switch">
                            <input type="checkbox" id="cookie-analytics-toggle" ${currentConsent.analytics !== false ? 'checked' : ''}>
                            <span class="cookie-slider"></span>
                        </label>
                    </div>
                    <p class="cookie-option-desc">
                        Pozwalają nam zbierać zanonimizowane statystyki dotyczące odwiedzin i ruchu na stronie (Google Analytics), co pomaga nam stale udoskonalać nasz serwis i rozkład jazdy.
                    </p>
                </div>
            </div>
            <div class="cookie-modal-footer">
                <button class="btn-cookie-reject" id="cookie-modal-reject">Odrzuć opcjonalne</button>
                <button class="btn-cookie-save" id="cookie-modal-save">Zapisz preferencje</button>
                <button class="btn-cookie-accept" id="cookie-modal-accept">Zaakceptuj wszystkie</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
        modal.classList.remove('active');
    };

    const openModal = () => {
        const consent = getSavedCookieConsent() || { essential: true, analytics: true };
        const toggle = document.getElementById('cookie-analytics-toggle');
        if (toggle) toggle.checked = consent.analytics !== false;
        modal.classList.add('active');
    };

    modal.querySelector('#cookie-modal-close-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    modal.querySelector('#cookie-modal-save').addEventListener('click', () => {
        const analyticsAllowed = modal.querySelector('#cookie-analytics-toggle').checked;
        applyCookieConsent({ essential: true, analytics: analyticsAllowed });
        closeModal();
        hideBanner();
    });

    modal.querySelector('#cookie-modal-reject').addEventListener('click', () => {
        applyCookieConsent({ essential: true, analytics: false });
        closeModal();
        hideBanner();
    });

    modal.querySelector('#cookie-modal-accept').addEventListener('click', () => {
        applyCookieConsent({ essential: true, analytics: true });
        closeModal();
        hideBanner();
    });

    modal.openModal = openModal;
    return modal;
}

function hideBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
        banner.classList.remove('active');
        setTimeout(() => banner.remove(), 400);
    }
}

function initCookieBanner() {
    const existingConsent = getSavedCookieConsent();
    if (existingConsent) {
        applyCookieConsent(existingConsent);
    }

    const modal = createCookiePreferencesModal();

    const footerLink = document.getElementById('open-cookie-settings');
    if (footerLink) {
        footerLink.addEventListener('click', (e) => {
            e.preventDefault();
            modal.openModal();
        });
    }

    if (existingConsent) return;

    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.id = 'cookie-banner';
    banner.innerHTML = `
        <div class="cookie-banner-content">
            <h4>Pliki cookies i prywatność</h4>
            <p>Nasza witryna korzysta z niezbędnych plików cookies oraz opcjonalnych narzędzi analitycznych (Google Analytics) do zbierania anonimowych statystyk. Wybierz swoje preferencje poniżej. Szczegóły znajdziesz w naszej <a href="/prywatnosc">Polityce Prywatności</a>.</p>
        </div>
        <div class="cookie-btns">
            <button class="btn-cookie-settings" id="cookie-settings-btn">Preferencje</button>
            <button class="btn-cookie-reject" id="cookie-reject-btn">Odrzuć opcjonalne</button>
            <button class="btn-cookie-accept" id="cookie-accept-btn">Akceptuję wszystkie</button>
        </div>
    `;
    document.body.appendChild(banner);

    setTimeout(() => {
        banner.classList.add('active');
    }, 800);

    document.getElementById('cookie-accept-btn').addEventListener('click', () => {
        applyCookieConsent({ essential: true, analytics: true });
        hideBanner();
    });

    document.getElementById('cookie-reject-btn').addEventListener('click', () => {
        applyCookieConsent({ essential: true, analytics: false });
        hideBanner();
    });

    document.getElementById('cookie-settings-btn').addEventListener('click', () => {
        modal.openModal();
    });
}

// --- Bootstrap Core Features ---
document.addEventListener('DOMContentLoaded', () => {
    // Clear legacy customizer cookies once to revert theme changes
    if (document.cookie.includes('testbus_')) {
        document.cookie = 'testbus_font=; Max-Age=-99999999; path=/; SameSite=Lax';
        document.cookie = 'testbus_theme=; Max-Age=-99999999; path=/; SameSite=Lax';
    }

    // 1. Current year in footer
    const yearEl = document.getElementById('current-year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    const copyIcon = document.getElementById('copy-icon');
    if (copyIcon) {
        let copyClicks = 0;
        let copyTimer = null;
        copyIcon.addEventListener('click', () => {
            copyClicks++;
            clearTimeout(copyTimer);
            if (copyClicks >= 3) {
                copyClicks = 0;
                fetch('/action/footer-trigger', { method: 'POST' })
                    .then(res => res.json())
                    .then(data => { if (data.redirectUrl) window.location.href = data.redirectUrl; })
                    .catch(() => {});
            } else {
                copyTimer = setTimeout(() => { copyClicks = 0; }, 1000);
            }
        });
    }

    // 2. Cookie Banner
    initCookieBanner();

    // 3. Scroll Reveal Observer
    initRevealAnimations();

    // 4. Navigation & Hamburger Menu
    const hamburger = document.getElementById('hamburger-btn');
    const navLinks = document.getElementById('nav-links');

    if (hamburger && navLinks) {
        const openMenu = () => {
            hamburger.classList.add('active');
            navLinks.classList.add('active');
            const navbar = document.querySelector('.navbar');
            if (navbar) navbar.classList.add('menu-open');
        };

        const closeMenu = () => {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
            const navbar = document.querySelector('.navbar');
            if (navbar) navbar.classList.remove('menu-open');
        };

        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = hamburger.classList.toggle('active');
            navLinks.classList.toggle('active', isActive);
            const navbar = document.querySelector('.navbar');
            if (navbar) navbar.classList.toggle('menu-open', isActive);
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                closeMenu();
            });
        });

        document.addEventListener('click', (e) => {
            if (navLinks.classList.contains('active') && !navLinks.contains(e.target) && !hamburger.contains(e.target)) {
                closeMenu();
            }
        });

        // Interactive Drag Tracking for Public Mobile Menu (Anywhere on screen)
        let touchStartX = 0;
        let touchStartY = 0;
        let isDragging = false;

        document.addEventListener('touchstart', (e) => {
            if (window.innerWidth > 768) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isDragging = true;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!isDragging || window.innerWidth > 768) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = currentX - touchStartX;
            const deltaY = currentY - touchStartY;
            const menuWidth = navLinks.offsetWidth || window.innerWidth;

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                const isOpen = navLinks.classList.contains('active');
                navLinks.style.transition = 'none';

                let currentTranslateX = 0;
                if (isOpen) {
                    // Dragging right to close (deltaX > 0)
                    currentTranslateX = Math.max(0, Math.min(menuWidth, deltaX));
                } else {
                    // Dragging left to open (deltaX < 0): starting from menuWidth
                    currentTranslateX = Math.max(0, Math.min(menuWidth, menuWidth + deltaX));
                }

                navLinks.style.transform = `translateX(${currentTranslateX}px)`;
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!isDragging || window.innerWidth > 768) return;
            isDragging = false;

            const touchEndX = e.changedTouches[0].clientX;
            const deltaX = touchEndX - touchStartX;
            const isOpen = navLinks.classList.contains('active');

            navLinks.style.transition = '';
            navLinks.style.transform = '';

            if (isOpen) {
                // Dragged right significantly -> close
                if (deltaX > 50) {
                    closeMenu();
                } else {
                    openMenu();
                }
            } else {
                // Dragged left significantly -> open
                if (deltaX < -50) {
                    openMenu();
                } else {
                    closeMenu();
                }
            }
        }, { passive: true });
    }

    // 5. Smooth Scroll for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const navHeight = 100;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 6. Navbar Scroll Styling & Dynamic Navigation Active Link on Scroll
    const mainNav = document.getElementById('main-nav');
    const navLinksList = document.querySelectorAll('.nav-links a[href^="#"]');
    const sections = Array.from(navLinksList).map(link => {
        const id = link.getAttribute('href');
        return document.querySelector(id);
    }).filter(Boolean);

    function updateActiveNavLink(scrollY) {
        let currentActive = null;

        // If at the very top of the page, default to first section (Rozkład)
        if (scrollY < 150) {
            currentActive = document.querySelector('.nav-links a[href="#rozklad"]');
        } else {
            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                // Offset of 150px to trigger the highlight slightly before the section reaches the top
                if (scrollY >= sectionTop - 150) {
                    currentActive = document.querySelector(`.nav-links a[href="#${section.id}"]`);
                }
            });
        }

        navLinksList.forEach(link => {
            if (link === currentActive) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    if (mainNav && mainNav.classList.contains('navbar-home')) {
        let lastKnownScrollPosition = 0;
        let ticking = false;

        window.addEventListener('scroll', () => {
            lastKnownScrollPosition = window.scrollY;

            if (!ticking) {
                window.requestAnimationFrame(() => {
                    // Update navbar styling (scrolled/transparent)
                    if (lastKnownScrollPosition > 150) {
                        mainNav.classList.add('navbar-scrolled');
                        mainNav.classList.remove('navbar-home');
                    } else {
                        mainNav.classList.add('navbar-home');
                        mainNav.classList.remove('navbar-scrolled');
                    }

                    // Update active nav link
                    updateActiveNavLink(lastKnownScrollPosition);
                    ticking = false;
                });
                ticking = true;
            }
        });

        // Run initially to set the correct active class on load
        updateActiveNavLink(window.scrollY);
    }
});
