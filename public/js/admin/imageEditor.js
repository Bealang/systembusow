import state from './state.js';
import { showStatus } from './ui.js';

let currentSelectedImg = null;
let resizerOverlay = null;

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Niepoprawny plik graficzny.'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Błąd odczytu pliku.'));
        reader.readAsDataURL(file);
    });
}

async function processAndUploadImage(file) {
    showStatus('Przetwarzanie i optymalizacja obrazu...', 'success');

    try {
        const originalName = file.name || 'obraz';
        const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
        const altText = baseName.replace(/[-_]/g, ' ').trim();

        const img = await loadImage(file);

        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const maxDimension = 1200;
        if (width > maxDimension || height > maxDimension) {
            if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
            } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
            }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const webpBlob = await new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.82);
        });

        if (!webpBlob) throw new Error('Kompresja obrazu nie powiodła się.');

        const formData = new FormData();
        formData.append('image', webpBlob, 'image.webp');

        const res = await fetch('/api/admin/upload-news-image', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Wystąpił błąd podczas wgrywania pliku.');

        const quill = state.quill;
        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', { url: data.url, alt: altText }, Quill.sources.USER);

        setTimeout(() => {
            const imgEl = quill.root.querySelector(`img[src="${data.url}"]`);
            if (imgEl) imgEl.setAttribute('alt', altText);
        }, 50);

        quill.setSelection(range.index + 1, Quill.sources.SILENT);
        showStatus('Obraz został pomyślnie dodany i zoptymalizowany!', 'success');
    } catch (err) {
        console.error('Błąd przetwarzania obrazu:', err);
        showStatus(err.message || 'Błąd przetwarzania obrazu.', 'error');
    }
}

function selectImageForResize(img) {
    currentSelectedImg = img;
    repositionResizer();
    resizerOverlay.style.display = 'block';
}

function repositionResizer() {
    if (!currentSelectedImg || !resizerOverlay) return;

    const qlContainer = document.querySelector('#news-editor .ql-container');
    if (!qlContainer) return;

    const imgRect = currentSelectedImg.getBoundingClientRect();
    const containerRect = qlContainer.getBoundingClientRect();

    resizerOverlay.style.top = (imgRect.top - containerRect.top + qlContainer.scrollTop) + 'px';
    resizerOverlay.style.left = (imgRect.left - containerRect.left + qlContainer.scrollLeft) + 'px';
    resizerOverlay.style.width = imgRect.width + 'px';
    resizerOverlay.style.height = imgRect.height + 'px';
}

function initImageResizer() {
    const editorContainer = document.querySelector('#news-editor');
    if (!editorContainer) return;

    resizerOverlay = document.createElement('div');
    resizerOverlay.className = 'quill-image-resizer-overlay';
    resizerOverlay.style.cssText = 'position:absolute;display:none;pointer-events:none;z-index:1000;border:2px dashed var(--primary-color, #2563eb)';

    const handle = document.createElement('div');
    handle.className = 'quill-image-resizer-handle';
    handle.style.cssText = 'position:absolute;width:12px;height:12px;background:var(--primary-color, #2563eb);border:2px solid white;border-radius:50%;bottom:-7px;right:-7px;cursor:se-resize;pointer-events:auto';

    resizerOverlay.appendChild(handle);

    const quillWrapper = editorContainer.querySelector('.ql-container');
    if (quillWrapper) {
        quillWrapper.style.position = 'relative';
        quillWrapper.appendChild(resizerOverlay);
    }

    const qlEditor = editorContainer.querySelector('.ql-editor');
    if (qlEditor) {
        qlEditor.addEventListener('click', (e) => {
            if (e.target.tagName === 'IMG') {
                selectImageForResize(e.target);
                e.stopPropagation();
            } else {
                window.deselectImage();
            }
        });

        qlEditor.addEventListener('scroll', () => {
            if (currentSelectedImg) repositionResizer();
        });
    }

    let isDragging = false;
    let startWidth = 0;
    let startX = 0;

    handle.addEventListener('mousedown', (e) => {
        if (!currentSelectedImg) return;
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        startWidth = currentSelectedImg.clientWidth;
        startX = e.clientX;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        if (!isDragging || !currentSelectedImg) return;
        const deltaX = e.clientX - startX;
        let newWidth = startWidth + deltaX;
        const minWidth = 50;
        const maxWidth = qlEditor.clientWidth - 30;
        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;
        currentSelectedImg.style.width = newWidth + 'px';
        currentSelectedImg.style.height = 'auto';
        repositionResizer();
    }

    function onMouseUp() {
        if (isDragging) {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            state.quill.update();
        }
    }
}

export function initImageEditor() {
    if (!document.getElementById('news-editor')) return;
    if (typeof Quill === 'undefined') return;
    // Register custom Image blot
    const ImageBlot = Quill.import('formats/image');
    class CustomImageBlot extends ImageBlot {
        static create(value) {
            const node = super.create(value);
            if (typeof value === 'object') {
                node.setAttribute('src', this.sanitize(value.url));
                if (value.alt) node.setAttribute('alt', value.alt);
            } else if (typeof value === 'string') {
                node.setAttribute('src', this.sanitize(value));
            }
            return node;
        }
        static value(node) {
            return { url: node.getAttribute('src'), alt: node.getAttribute('alt') };
        }
    }
    Quill.register(CustomImageBlot, true);

    // Initialize Quill Editor
    state.quill = new Quill('#news-editor', {
        theme: 'snow',
        placeholder: 'Wpisz treść komunikatu...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'header': [1, 2, 3, false] }],
                [{ 'size': ['small', false, 'large', 'huge'] }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['image'],
                ['clean']
            ]
        }
    });

    // Override default image handler
    state.quill.getModule('toolbar').addHandler('image', () => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/png, image/jpeg, image/jpg, image/webp, image/avif');
        input.click();
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            await processAndUploadImage(file);
        };
    });

    // Drag & Drop and Paste handlers
    const editorContainer = document.querySelector('#news-editor');
    if (editorContainer) {
        editorContainer.addEventListener('dragover', (e) => e.preventDefault());

        editorContainer.addEventListener('drop', async (e) => {
            e.preventDefault();
            if (e.dataTransfer?.files?.length) {
                for (const file of Array.from(e.dataTransfer.files)) {
                    if (file.type.startsWith('image/')) await processAndUploadImage(file);
                }
            }
        });

        editorContainer.addEventListener('paste', async (e) => {
            if (e.clipboardData?.files?.length) {
                e.preventDefault();
                for (const file of Array.from(e.clipboardData.files)) {
                    if (file.type.startsWith('image/')) await processAndUploadImage(file);
                }
            }
        });
    }

    // Global deselect
    window.deselectImage = () => {
        currentSelectedImg = null;
        if (resizerOverlay) resizerOverlay.style.display = 'none';
    };

    document.addEventListener('click', (e) => {
        const editor = document.querySelector('#news-editor');
        if (editor && !editor.contains(e.target)) window.deselectImage();
    });

    initImageResizer();
}
