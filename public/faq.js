// ============================================================================
// Testbus - FAQ Accordion Module (faq.js)
// Lazily loads FAQ data and handles smooth details/summary toggling
// ============================================================================

(function() {
    function initFaq() {
        const faqContainer = document.getElementById('faq-dynamic-container');
        if (!faqContainer) return;

        const faqSection = document.querySelector('.faq-section');

        if (faqSection) {
            const fObs = new IntersectionObserver((entries, obs) => {
                if (entries[0].isIntersecting) {
                    fetchFaqs();
                    obs.disconnect();
                }
            }, { rootMargin: '200px' });
            fObs.observe(faqSection);
        }

        async function fetchFaqs() {
            try {
                if (window.fetchWithCache) {
                    const data = await window.fetchWithCache('/api/faq', 'pytania', 86400000);
                    renderFaqs(data);
                }
            } catch (e) {
                console.error("Error fetching FAQs:", e);
                if (faqContainer) faqContainer.innerHTML = '<p class="text-center">Błąd ładowania pytań.</p>';
            }
        }

        function renderFaqs(faqs) {
            if (!faqContainer) return;

            if (faqs.length === 0) {
                faqContainer.innerHTML = '<p class="text-center">Brak pytań FAQ.</p>';
                return;
            }

            faqContainer.innerHTML = faqs.map((faq, index) => `
                <details class="faq-item reveal reveal-up" style="transition-delay: ${index * 0.1}s">
                    <summary>
                        <h3>${window.escapeHTML ? window.escapeHTML(faq.question) : faq.question}</h3>
                        <div class="faq-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                    </summary>
                    <div class="faq-content">
                        <p>${faq.answer}</p>
                    </div>
                </details>
            `).join('');

            if (window.observeNewElements) window.observeNewElements();

            // Smooth Accordion Logic (Single-Open Details)
            const faqItems = faqContainer.querySelectorAll('.faq-item');
            faqItems.forEach(el => {
                const summary = el.querySelector('summary');
                const content = el.querySelector('.faq-content');

                summary.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (el.open) {
                        closeItem(el, content);
                    } else {
                        faqItems.forEach(item => {
                            if (item.open && item !== el) {
                                closeItem(item, item.querySelector('.faq-content'));
                            }
                        });
                        openItem(el, content);
                    }
                });
            });

            function openItem(el, content) {
                const startHeight = el.offsetHeight;
                el.open = true;
                const contentHeight = content.offsetHeight;
                const endHeight = startHeight + contentHeight;

                el.style.height = startHeight + 'px';

                requestAnimationFrame(() => {
                    el.animate([
                        { height: startHeight + 'px' },
                        { height: endHeight + 'px' }
                    ], {
                        duration: 300,
                        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
                    }).onfinish = () => el.style.height = 'auto';
                });
            }

            function closeItem(el, content) {
                const startHeight = el.offsetHeight;
                const contentHeight = content.offsetHeight;
                const endHeight = startHeight - contentHeight;

                el.style.height = startHeight + 'px';

                requestAnimationFrame(() => {
                    const anim = el.animate([
                        { height: startHeight + 'px' },
                        { height: endHeight + 'px' }
                    ], {
                        duration: 300,
                        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
                    });

                    anim.onfinish = () => {
                        el.open = false;
                        el.style.height = 'auto';
                    };
                });
            }
        }
    }

    document.addEventListener('DOMContentLoaded', initFaq);
})();
