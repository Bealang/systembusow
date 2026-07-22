import { initMobileToggle } from './ui.js?v=1.0.1';
import { initLogout } from './auth.js?v=1.0.1';
import { initAccount } from './account.js?v=1.0.1';

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('mobile-toggle')) {
        initMobileToggle();
    }
    if (document.getElementById('logout-btn-header')) {
        initLogout();
    }
    initAccount();
});
