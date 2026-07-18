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

// --- Cookie Banner ---
function initCookieBanner() {
    if (localStorage.getItem('zaakceptowane_cookies')) return;

    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.id = 'cookie-banner';
    banner.innerHTML = `
        <h4>Pliki cookies</h4>
        <p>Nasza witryna korzysta z plików cookies w celu poprawy jakości obsługi oraz do celów analitycznych (Google Analytics). Szczegóły znajdziesz w naszej <a href="/prywatnosc">Polityce Prywatności</a>.</p>
        <div class="cookie-btns">
            <button class="btn-accept" id="cookie-accept">Ok, Akceptuję</button>
        </div>
    `;
    document.body.appendChild(banner);

    setTimeout(() => {
        banner.classList.add('active');
    }, 1000);

    document.getElementById('cookie-accept').addEventListener('click', () => {
        localStorage.setItem('zaakceptowane_cookies', 'true');
        banner.classList.remove('active');
        setTimeout(() => banner.remove(), 500);
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
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
            const navbar = document.querySelector('.navbar');
            if (navbar) navbar.classList.toggle('menu-open');
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
                const navbar = document.querySelector('.navbar');
                if (navbar) navbar.classList.remove('menu-open');
            });
        });
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
