import { initMobileToggle } from './ui.js?v=1.0.1';
import { initLoginForm, initLogout } from './auth.js?v=1.0.1';
import { initImageEditor } from './imageEditor.js?v=1.0.1';
import { initNews, initQuickNews } from './news.js?v=1.0.1';
import { initSchedule } from './schedule.js?v=1.0.1';
import { initPricing, initQuickBulkPrice } from './pricing.js?v=1.0.1';
import { initFaq } from './faq.js?v=1.0.1';
import { initAttributes } from './attributes.js?v=1.0.1';
import { initAlert } from './alert.js?v=1.0.1';
import { initAccount } from './account.js?v=1.0.1';

document.addEventListener('DOMContentLoaded', () => {
    // Shared elements
    if (document.getElementById('mobile-toggle')) {
        initMobileToggle();
    }
    if (document.getElementById('logout-btn-header')) {
        initLogout();
    }

    // Login screen
    if (document.getElementById('login-form')) {
        initLoginForm();
    }

    // Alert (can be on dashboard or news page)
    if (document.getElementById('alert-form')) {
        initAlert();
    }

    // Dashboard quick news
    if (document.getElementById('quick-news-form')) {
        initQuickNews();
    }

    // Dashboard quick bulk price
    if (document.getElementById('quick-bulk-price-btn')) {
        initQuickBulkPrice();
    }

    // Schedule page
    if (document.getElementById('schedule-table-container')) {
        initSchedule();
        initAttributes();
        initImageEditor();
    }

    // Schedule image upload or Regulamin PDF upload
    if (document.getElementById('upload-form') || document.getElementById('upload-regulamin-form')) {
        initNews();
    }

    // News/Aktualnosci editor page
    if (document.getElementById('news-form')) {
        initNews();
        initImageEditor();
    }

    // Pricing/Cennik page
    if (document.getElementById('stops-list-container')) {
        initPricing();
    }

    // FAQ page
    if (document.getElementById('faq-form')) {
        initFaq();
    }

    // Account page
    if (document.getElementById('tab-konto') || document.getElementById('form-change-username')) {
        initAccount();
    }
});
