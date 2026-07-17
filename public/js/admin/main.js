import { initTabs, initMobileToggle } from './ui.js';
import { checkAuth, initLoginForm, initLogout } from './auth.js';
import { initImageEditor } from './imageEditor.js';

document.addEventListener('DOMContentLoaded', () => {
    initImageEditor();
    initTabs();
    initMobileToggle();
    initLoginForm();
    initLogout();
    checkAuth();
});
