/* === JS Block 1 === */
// Set worker source for pdf.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        /**
         * @typedef {Object} UploadedItem
         * @property {string} id - A unique identifier for the item.
         * @property {'pdf-page' | 'pdf-file' | 'image'} type - The type of the item.
         * @property {string} sourceFileName - The name of the original file.
         * @property {number} [originalPageNum] - The original page number within the source PDF.
         * @property {HTMLCanvasElement} canvas - The canvas element containing the rendered preview.
         * @property {string} dataUrl - The data URL for the preview image.
         * @property {ArrayBuffer} [sourcePdfBytes] - The raw byte data of the source PDF, for pdf-lib operations.
         */

        // --- GLOBAL STATE MANAGEMENT ---
        /** @type {UploadedItem[]} */
        let uploadedItems = [];
        /** @type {Set<string>} */
        let selectedItems = new Set();
        let draggedElement = null;
        let draggedId = null;
        let touchReorderState = null;
        let currentPreviewIndex = -1;
        let focusedIndex = -1;
        let selectionAnchorIndex = -1;
        let mobileGridColumns = 2;
        const isMemorySensitiveDevice = () => window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
        const getSafeCanvasLimit = () => isMemorySensitiveDevice() ? 1200 : 2400;
        const getSafePreviewQuality = () => isMemorySensitiveDevice() ? 0.68 : 0.78;
        const waitForUiBreath = () => new Promise(resolve => setTimeout(resolve, 0));
        const defaultSettings = {
            newFeatures: true,
            imagePdfMode: 'exact',
            doubleClickPreview: true,
            rightClickMenu: true,
            directDownloads: true,
            explorerSelection: true,
            jpgQuality: 90,
            downloadGap: 120,
        };
        let appSettings = { ...defaultSettings };

        // --- DOM ELEMENT REFERENCES ---
        const DOMElements = {
            uploadZone: document.querySelector('.upload-zone'),
            fileInput: document.getElementById('fileInput'),
            splitPdfPages: document.getElementById('splitPdfPages'),
            progressContainer: document.getElementById('progressContainer'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            controls: document.getElementById('controls'),
            loading: document.getElementById('loading'),
            pagesGrid: document.getElementById('pagesGrid'),
            gridToggleBtn: document.getElementById('gridToggleBtn'),
            selectionInfo: document.getElementById('selectionInfo'),
            selectedCount: document.getElementById('selectedCount'),
            previewModal: document.getElementById('previewModal'),
            previewSlider: document.getElementById('previewSlider'),
            previewTitle: document.getElementById('previewTitle'),
            errorMessage: document.getElementById('errorMessage'),
            itemContextMenu: document.getElementById('itemContextMenu'),
            mergeRenamePopover: document.getElementById('mergeRenamePopover'),
            mergeFileNameInput: document.getElementById('mergeFileNameInput'),
            guideModal: document.getElementById('guideModal'),
            settingsModal: document.getElementById('settingsModal'),
            settingNewFeatures: document.getElementById('settingNewFeatures'),
            settingImagePdfMode: document.getElementById('settingImagePdfMode'),
            settingDoubleClickPreview: document.getElementById('settingDoubleClickPreview'),
            settingRightClickMenu: document.getElementById('settingRightClickMenu'),
            settingDirectDownloads: document.getElementById('settingDirectDownloads'),
            settingExplorerSelection: document.getElementById('settingExplorerSelection'),
            settingJpgQuality: document.getElementById('settingJpgQuality'),
            jpgQualityValue: document.getElementById('jpgQualityValue'),
            settingDownloadGap: document.getElementById('settingDownloadGap'),
        };

        // --- INITIALIZATION ---
        document.addEventListener('DOMContentLoaded', initialize);

        /**
         * Initializes all event listeners for the application.
         */
        function initialize() {
            const { uploadZone, fileInput, previewModal } = DOMElements;
            loadSettings();
            bindSettingsControls();
            document.body.appendChild(DOMElements.itemContextMenu);
            bindGlobalErrorGuards();

            // File Upload Listeners
            uploadZone.addEventListener('click', () => fileInput.click());
            uploadZone.addEventListener('dragover', handleDragOver);
            uploadZone.addEventListener('dragleave', handleDragLeave);
            uploadZone.addEventListener('drop', handleFileDrop);
            fileInput.addEventListener('change', handleFileSelect);

            // Clipboard Paste Listener
            document.addEventListener('paste', handlePaste);

            // Global Click Listener for closing dropdowns
            document.addEventListener('click', handleGlobalClick);
            
            // Preview Modal Listeners
            previewModal.addEventListener('click', (e) => e.target === previewModal && closePreview());
            document.addEventListener('keydown', handleKeyDown);
            DOMElements.guideModal.addEventListener('click', (e) => e.target === DOMElements.guideModal && closeGuide());
            DOMElements.settingsModal.addEventListener('click', (e) => e.target === DOMElements.settingsModal && closeSettings());
            
            // Mouse Drag Navigation for Preview
            let isDragging = false, startX, scrollLeft;
            DOMElements.previewSlider.addEventListener('mousedown', (e) => {
                isDragging = true;
                startX = e.pageX - DOMElements.previewSlider.offsetLeft;
                e.preventDefault(); // Prevents text selection
            });
            DOMElements.previewSlider.addEventListener('mouseleave', () => isDragging = false);
            DOMElements.previewSlider.addEventListener('mouseup', (e) => {
                if (!isDragging) return;
                isDragging = false;
                const endX = e.pageX - DOMElements.previewSlider.offsetLeft;
                const diffX = startX - endX;
                if (Math.abs(diffX) > 50) { // Threshold for swipe
                    if (diffX > 0) showNextItem();
                    else showPreviousItem();
                }
            });
            DOMElements.previewSlider.addEventListener('mousemove', (e) => {
                if(!isDragging) return;
                e.preventDefault();
            });

            let touchPreviewStartX = 0;
            DOMElements.previewSlider.addEventListener('touchstart', (e) => {
                if (!e.changedTouches.length) return;
                touchPreviewStartX = e.changedTouches[0].clientX;
            }, { passive: true });
            DOMElements.previewSlider.addEventListener('touchend', (e) => {
                if (!e.changedTouches.length) return;
                const diffX = touchPreviewStartX - e.changedTouches[0].clientX;
                if (Math.abs(diffX) > 44) {
                    if (diffX > 0) showNextItem();
                    else showPreviousItem();
                }
            }, { passive: true });
        }

        function bindGlobalErrorGuards() {
            window.addEventListener('error', (event) => {
                console.error('App error:', event.error || event.message);
                DOMElements.loading.classList.remove('show');
                DOMElements.progressContainer.style.display = 'none';
                showError('This file was too heavy for the browser. Try fewer pages or a smaller file.');
            });

            window.addEventListener('unhandledrejection', (event) => {
                console.error('App promise error:', event.reason);
                DOMElements.loading.classList.remove('show');
                DOMElements.progressContainer.style.display = 'none';
                showError('This file was too heavy for the browser. Try fewer pages or a smaller file.');
            });
        }
        
        // --- EVENT HANDLERS ---

        function handleDragOver(e) {
            e.preventDefault();
            DOMElements.uploadZone.classList.add('dragover');
        }

        function handleDragLeave() {
            DOMElements.uploadZone.classList.remove('dragover');
        }

        function handleFileDrop(e) {
            e.preventDefault();
            DOMElements.uploadZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                processFiles(e.dataTransfer.files);
            }
        }

        function handleFileSelect(e) {
            if (e.target.files.length > 0) {
                processFiles(e.target.files);
            }
        }

        function handlePaste(e) {
            const items = (e.clipboardData || window.clipboardData).items;
            const files = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
                    const file = items[i].getAsFile();
                    files.push(file);
                }
            }
            if (files.length > 0) {
                processFiles(files);
            }
        }
        
        function handleGlobalClick(e) {
            document.querySelectorAll('.dropdown').forEach(dropdown => {
                if (!dropdown.contains(e.target)) {
                    dropdown.classList.remove('active');
                    dropdown.querySelector('.dropdown-content').classList.remove('show');
                }
            });
            if (!DOMElements.itemContextMenu.contains(e.target)) {
                hideContextMenu();
            }
            if (!DOMElements.mergeRenamePopover.contains(e.target) && !e.target.closest('[data-merge-button]')) {
                closeMergeRenamePopover();
            }
        }
        
        function handleKeyDown(e) {
            if (e.key === 'Escape' && DOMElements.guideModal.classList.contains('show')) {
                closeGuide();
                return;
            }
            if (e.key === 'Escape' && DOMElements.settingsModal.classList.contains('show')) {
                closeSettings();
                return;
            }
            if (e.key === 'Escape' && DOMElements.mergeRenamePopover.classList.contains('show')) {
                closeMergeRenamePopover();
                return;
            }
            if (e.key === 'Enter' && DOMElements.mergeRenamePopover.classList.contains('show') && document.activeElement === DOMElements.mergeFileNameInput) {
                mergeWithCustomName();
                return;
            }
            if (DOMElements.previewModal.classList.contains('show')) {
                if (e.key === 'Escape') closePreview();
                if (e.key === 'ArrowLeft') showPreviousItem();
                if (e.key === 'ArrowRight') showNextItem();
                return;
            }

            if (isFeatureEnabled('explorerSelection') && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                if (uploadedItems.length === 0 || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
                e.preventDefault();
                selectAllItems();
                return;
            }

            if (isFeatureEnabled('explorerSelection') && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', ' ', 'Enter', 'Delete'].includes(e.key)) {
                if (uploadedItems.length === 0 || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
                const columns = getGridColumnCount();
                const extend = e.shiftKey;

                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    moveFocusBy(-1, extend);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    moveFocusBy(1, extend);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    moveFocusBy(-columns, extend);
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    moveFocusBy(columns, extend);
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    if (extend) handleExplorerSelection(0, { range: true });
                    else {
                        focusedIndex = 0;
                        selectionAnchorIndex = 0;
                        updateSelectionUI();
                    }
                    scrollFocusedItemIntoView();
                } else if (e.key === 'End') {
                    e.preventDefault();
                    const last = uploadedItems.length - 1;
                    if (extend) handleExplorerSelection(last, { range: true });
                    else {
                        focusedIndex = last;
                        selectionAnchorIndex = last;
                        updateSelectionUI();
                    }
                    scrollFocusedItemIntoView();
                } else if (e.key === ' ') {
                    e.preventDefault();
                    const index = focusedIndex === -1 ? 0 : focusedIndex;
                    handleExplorerSelection(index, { toggle: true });
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (focusedIndex !== -1) showPreview(focusedIndex);
                } else if (e.key === 'Delete') {
                    e.preventDefault();
                    removeItemsBySelection('selected');
                }
            }
        }

        // --- CORE FILE PROCESSING LOGIC ---

        /**
         * Processes a list of files from any source (input, drop, paste).
         * @param {FileList | File[]} files - The files to process.
         */
        async function processFiles(files) {
            const { progressContainer, progressFill, progressText, controls } = DOMElements;
            
            showError(null); // Clear previous errors
            progressContainer.style.display = 'block';
            controls.classList.remove('active');
            
            let totalProcessed = 0;
            const newItems = [];

            for (const file of files) {
                const fileType = file.type;
                try {
                    if (fileType === 'application/pdf') {
                        const pdfBytes = await file.arrayBuffer();
                        const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;

                        if (!DOMElements.splitPdfPages.checked) {
                            const firstPage = await pdfDoc.getPage(1);
                            const canvas = await renderPageToCanvas(firstPage);
                            newItems.push({
                                id: `item-${Date.now()}-${Math.random()}`,
                                type: 'pdf-file',
                                sourceFileName: file.name,
                                pageCount: pdfDoc.numPages,
                                canvas: canvas,
                                dataUrl: canvasToPreviewDataUrl(canvas),
                                sourcePdfBytes: pdfBytes
                            });
                            firstPage.cleanup?.();
                            totalProcessed++;
                            progressText.textContent = `Processing ${file.name} (whole PDF, ${pdfDoc.numPages} pages)...`;
                            progressFill.style.width = `${(totalProcessed / files.length) * 100}%`;
                            await waitForUiBreath();
                        } else {
                            for (let i = 1; i <= pdfDoc.numPages; i++) {
                                const page = await pdfDoc.getPage(i);
                                const canvas = await renderPageToCanvas(page);
                                newItems.push({
                                    id: `item-${Date.now()}-${Math.random()}`,
                                    type: 'pdf-page',
                                    sourceFileName: file.name,
                                    originalPageNum: i,
                                    canvas: canvas,
                                    dataUrl: canvasToPreviewDataUrl(canvas),
                                    sourcePdfBytes: pdfBytes
                                });
                                page.cleanup?.();
                                totalProcessed++;
                                progressText.textContent = `Processing ${file.name} (Page ${i}/${pdfDoc.numPages})...`;
                                progressFill.style.width = `${(totalProcessed / (files.length + pdfDoc.numPages - 1)) * 100}%`;
                                await waitForUiBreath();
                            }
                        }
                        await pdfDoc.cleanup?.();
                        await pdfDoc.destroy?.();
                    } else if (fileType.startsWith('image/')) {
                        const canvas = await createCanvasFromImageFile(file);
                        newItems.push({
                            id: `item-${Date.now()}-${Math.random()}`,
                            type: 'image',
                            sourceFileName: file.name,
                            canvas: canvas,
                            dataUrl: canvasToPreviewDataUrl(canvas)
                        });
                        totalProcessed++;
                        progressText.textContent = `Processing ${file.name}...`;
                        progressFill.style.width = `${(totalProcessed / files.length) * 100}%`;
                        await waitForUiBreath();
                    }
                } catch (error) {
                    console.error("Error processing file:", file.name, error);
                    showError(`Failed to process ${file.name}. It might be corrupted or an unsupported format.`);
                }
            }

            uploadedItems.push(...newItems);
            renderGridItems();
            
            if (uploadedItems.length > 0) {
                controls.classList.add('active');
            }
            progressContainer.style.display = 'none';
        }

        /**
         * Renders a PDF page to a canvas element.
         * @param {pdfjsLib.PDFPageProxy} page - The PDF page object.
         * @returns {Promise<HTMLCanvasElement>} A promise that resolves with the canvas.
         */
        async function renderPageToCanvas(page) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const baseViewport = page.getViewport({ scale: 1 });
            const maxDimension = getSafeCanvasLimit();
            const scale = Math.min(isMemorySensitiveDevice() ? 1.05 : 1.35, maxDimension / Math.max(baseViewport.width, baseViewport.height));
            const viewport = page.getViewport({ scale });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: context, viewport }).promise;
            return canvas;
        }

        /**
         * Reads a file and returns its data URL.
         * @param {File} file - The image file.
         * @returns {Promise<string>} A promise that resolves with the data URL.
         */
        function readFileAsDataURL(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
        
        /**
         * Creates a canvas from an image data URL.
         * @param {string} dataUrl - The data URL of the image.
         * @returns {Promise<HTMLCanvasElement>} A promise that resolves with the canvas.
         */
        function createCanvasFromImageFile(file) {
            return new Promise((resolve, reject) => {
                const objectUrl = URL.createObjectURL(file);
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxDimension = getSafeCanvasLimit();
                    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
                    canvas.width = Math.max(1, Math.round(img.width * scale));
                    canvas.height = Math.max(1, Math.round(img.height * scale));
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(objectUrl);
                    resolve(canvas);
                };
                img.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error('Image load failed'));
                };
                img.src = objectUrl;
            });
        }

        function canvasToPreviewDataUrl(canvas) {
            return canvas.toDataURL('image/jpeg', getSafePreviewQuality());
        }


        // --- UI RENDERING AND MANIPULATION ---

        /**
         * Renders all uploaded items into the main grid.
         */
        function renderGridItems() {
            const { pagesGrid } = DOMElements;
            pagesGrid.innerHTML = '';
            
            uploadedItems.forEach((item, index) => {
                const pageItem = document.createElement('div');
                pageItem.className = 'page-item';
                pageItem.draggable = true;
                pageItem.dataset.id = item.id;
                
                const titleText = item.type === 'pdf-page'
                    ? `Page ${index + 1} (from ${item.sourceFileName})`
                    : item.type === 'pdf-file'
                        ? `PDF ${index + 1} (${item.pageCount} pages) - ${item.sourceFileName}`
                        : `Image ${index + 1} (${item.sourceFileName})`;

                pageItem.innerHTML = `
                    <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
                    <input type="checkbox" class="selection-checkbox" onchange="event.stopPropagation(); setSelectionFocus(${index}); toggleItemSelection('${item.id}', this.checked);">
                    <img class="page-preview" src="${item.dataUrl}" alt="${titleText}">
                    <div class="page-title">${titleText}</div>
                    <button type="button" class="page-view-btn" onclick="event.stopPropagation(); showPreview(${index});" title="View page" aria-label="View page">👁</button>
                `;
                const dragHandle = pageItem.querySelector('.drag-handle');
                
                // Event listeners for selection, preview, and drag-drop
                let clickTimer = null;
                pageItem.addEventListener('click', (e) => {
                    if (e.target.matches('input, button, .drag-handle')) return;
                    if (clickTimer) {
                        clearTimeout(clickTimer);
                        clickTimer = null;
                    }
                    if (e.ctrlKey || e.metaKey) {
                        handleExplorerSelection(index, { toggle: true });
                    } else if (isFeatureEnabled('explorerSelection') && e.shiftKey) {
                        handleExplorerSelection(index, { range: true });
                    } else {
                        clickTimer = setTimeout(() => {
                            handleExplorerSelection(index, { toggle: true });
                            clickTimer = null;
                        }, 220);
                    }
                });

                pageItem.addEventListener('dblclick', (e) => {
                    if (!isFeatureEnabled('doubleClickPreview')) return;
                    if (e.target.matches('input, button, .drag-handle')) return;
                    e.preventDefault();
                    if (clickTimer) {
                        clearTimeout(clickTimer);
                        clickTimer = null;
                    }
                    showPreview(index);
                });

                pageItem.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (window.matchMedia('(pointer: coarse)').matches) return;
                    if (!isFeatureEnabled('rightClickMenu')) return;
                    openItemContextMenu(e, index);
                });
                
                pageItem.addEventListener('dragstart', (e) => {
                    draggedElement = pageItem;
                    draggedId = item.id;
                    pageItem.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                });

                pageItem.addEventListener('dragend', () => {
                    pageItem.classList.remove('dragging');
                    draggedElement = null;
                    draggedId = null;
                    document.querySelectorAll('.page-item').forEach(p => p.classList.remove('drag-over'));
                });

                pageItem.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedElement && draggedElement !== pageItem) {
                        pageItem.classList.add('drag-over');
                    }
                });

                pageItem.addEventListener('dragleave', () => pageItem.classList.remove('drag-over'));
                pageItem.addEventListener('drop', (e) => {
                    e.preventDefault();
                    pageItem.classList.remove('drag-over');
                    if (draggedId) {
                        const fromIndex = uploadedItems.findIndex(i => i.id === draggedId);
                        const toIndex = index;
                        reorderItems(fromIndex, toIndex);
                    }
                });

                dragHandle.addEventListener('pointerdown', (e) => startTouchReorder(e, pageItem, item.id));
                dragHandle.addEventListener('pointermove', updateTouchReorder);
                dragHandle.addEventListener('pointerup', finishTouchReorder);
                dragHandle.addEventListener('pointercancel', cancelTouchReorder);
                pageItem.addEventListener('pointermove', updateTouchReorder);
                pageItem.addEventListener('pointerup', finishTouchReorder);
                pageItem.addEventListener('pointercancel', cancelTouchReorder);
                
                pagesGrid.appendChild(pageItem);
            });
            
            updateSelectionUI();
        }
        
        /**
         * Reorders items in the global array and re-renders the grid.
         * @param {number} fromIndex - The starting index.
         * @param {number} toIndex - The destination index.
         */
        function reorderItems(fromIndex, toIndex) {
            if (fromIndex === toIndex) return;
            const [movedItem] = uploadedItems.splice(fromIndex, 1);
            uploadedItems.splice(toIndex, 0, movedItem);
            focusedIndex = toIndex;
            selectionAnchorIndex = toIndex;
            renderGridItems();
        }

        function toggleMobileGrid() {
            mobileGridColumns = mobileGridColumns === 2 ? 3 : 2;
            DOMElements.pagesGrid.classList.toggle('mobile-grid-3', mobileGridColumns === 3);
            DOMElements.gridToggleBtn?.setAttribute('aria-label', `${mobileGridColumns} column page grid`);
        }

        function startTouchReorder(e, pageItem, itemId) {
            if (e.pointerType === 'mouse') return;
            e.preventDefault();
            touchReorderState = {
                itemId,
                pageItem,
                captureTarget: e.currentTarget,
                overId: null,
                pointerId: e.pointerId
            };
            draggedId = itemId;
            pageItem.classList.add('touch-dragging');
            e.currentTarget.setPointerCapture?.(e.pointerId);
        }

        function updateTouchReorder(e) {
            if (!touchReorderState || touchReorderState.pointerId !== e.pointerId) return;
            e.preventDefault();
            autoScrollPagesGrid(e.clientY);

            const target = getTouchReorderTarget(e.clientX, e.clientY);
            document.querySelectorAll('.page-item.drag-over').forEach(item => item.classList.remove('drag-over'));

            if (target && target !== touchReorderState.pageItem) {
                target.classList.add('drag-over');
                touchReorderState.overId = target.dataset.id;
            } else {
                touchReorderState.overId = null;
            }
        }

        function finishTouchReorder(e) {
            if (!touchReorderState || touchReorderState.pointerId !== e.pointerId) return;
            const { itemId, overId, pageItem, captureTarget } = touchReorderState;
            captureTarget.releasePointerCapture?.(e.pointerId);
            pageItem.classList.remove('touch-dragging');
            document.querySelectorAll('.page-item.drag-over').forEach(item => item.classList.remove('drag-over'));
            touchReorderState = null;
            draggedId = null;

            if (!overId) return;
            const fromIndex = uploadedItems.findIndex(item => item.id === itemId);
            const toIndex = uploadedItems.findIndex(item => item.id === overId);
            if (fromIndex !== -1 && toIndex !== -1) {
                reorderItems(fromIndex, toIndex);
            }
        }

        function cancelTouchReorder(e) {
            if (!touchReorderState || touchReorderState.pointerId !== e.pointerId) return;
            touchReorderState.pageItem.classList.remove('touch-dragging');
            document.querySelectorAll('.page-item.drag-over').forEach(item => item.classList.remove('drag-over'));
            touchReorderState = null;
            draggedId = null;
        }

        function autoScrollPagesGrid(clientY) {
            const grid = DOMElements.pagesGrid;
            const rect = grid.getBoundingClientRect();
            const edge = 54;
            if (clientY < rect.top + edge) {
                grid.scrollBy({ top: -14, behavior: 'auto' });
            } else if (clientY > rect.bottom - edge) {
                grid.scrollBy({ top: 14, behavior: 'auto' });
            }
        }

        function getTouchReorderTarget(clientX, clientY) {
            const cards = [...DOMElements.pagesGrid.querySelectorAll('.page-item')]
                .filter(card => card.dataset.id !== touchReorderState?.itemId);
            let closest = null;
            let closestDistance = Infinity;

            cards.forEach(card => {
                const rect = card.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const distance = Math.hypot(clientX - centerX, clientY - centerY);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closest = card;
                }
            });

            return closest;
        }

        function setSelectionFocus(index) {
            if (uploadedItems.length === 0) {
                focusedIndex = -1;
                selectionAnchorIndex = -1;
                return;
            }
            focusedIndex = Math.max(0, Math.min(index, uploadedItems.length - 1));
            if (selectionAnchorIndex === -1) selectionAnchorIndex = focusedIndex;
        }

        function handleExplorerSelection(index, mode = {}) {
            const item = uploadedItems[index];
            if (!item) return;
            focusedIndex = index;

            if (mode.range) {
                const anchor = selectionAnchorIndex === -1 ? index : selectionAnchorIndex;
                selectedItems.clear();
                const start = Math.min(anchor, index);
                const end = Math.max(anchor, index);
                for (let i = start; i <= end; i++) {
                    selectedItems.add(uploadedItems[i].id);
                }
            } else if (mode.toggle) {
                if (selectedItems.has(item.id)) {
                    selectedItems.delete(item.id);
                } else {
                    selectedItems.add(item.id);
                }
                selectionAnchorIndex = index;
            } else {
                selectedItems.clear();
                selectedItems.add(item.id);
                selectionAnchorIndex = index;
            }

            updateSelectionUI();
        }

        function getGridColumnCount() {
            const items = [...document.querySelectorAll('.page-item')];
            if (items.length < 2) return 1;
            const firstTop = items[0].offsetTop;
            const firstRowCount = items.filter(item => item.offsetTop === firstTop).length;
            return Math.max(1, firstRowCount);
        }

        function moveFocusBy(delta, extendSelection) {
            if (uploadedItems.length === 0) return;
            const current = focusedIndex === -1 ? 0 : focusedIndex;
            const next = Math.max(0, Math.min(current + delta, uploadedItems.length - 1));
            if (extendSelection) {
                handleExplorerSelection(next, { range: true });
            } else {
                focusedIndex = next;
                selectionAnchorIndex = next;
                updateSelectionUI();
            }
            scrollFocusedItemIntoView();
        }

        function scrollFocusedItemIntoView() {
            const focusedItem = document.querySelector('.page-item.focused');
            if (focusedItem) focusedItem.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        }

        /**
         * Toggles the selection state of an item.
         * @param {string} itemId - The ID of the item to toggle.
         * @param {boolean} isSelected - The new selection state.
         */
        function toggleItemSelection(itemId, isSelected) {
            if (isSelected) {
                selectedItems.add(itemId);
            } else {
                selectedItems.delete(itemId);
            }
            updateSelectionUI();
        }

        /**
         * Updates the UI elements related to selection (count, info box, item styles).
         */
        function updateSelectionUI() {
            const { selectedCount, selectionInfo } = DOMElements;
            selectedCount.textContent = selectedItems.size;
            selectionInfo.classList.toggle('show', selectedItems.size > 0);
            
            document.querySelectorAll('.page-item').forEach((item, index) => {
                const id = item.dataset.id;
                const isSelected = selectedItems.has(id);
                item.classList.toggle('selected', isSelected);
                item.classList.toggle('focused', index === focusedIndex);
                const checkbox = item.querySelector('.selection-checkbox');
                if (checkbox) checkbox.checked = isSelected;
            });
        }
        
        function selectAllItems() {
            uploadedItems.forEach(item => selectedItems.add(item.id));
            focusedIndex = uploadedItems.length > 0 ? 0 : -1;
            selectionAnchorIndex = focusedIndex;
            updateSelectionUI();
        }

        function deselectAllItems() {
            selectedItems.clear();
            selectionAnchorIndex = focusedIndex;
            updateSelectionUI();
        }

        function toggleDropdown(dropdownId) {
            const dropdown = document.getElementById(dropdownId);
            dropdown.classList.toggle('active');
            dropdown.querySelector('.dropdown-content').classList.toggle('show');
        }

        function isFeatureEnabled(name) {
            if (['doubleClickPreview', 'rightClickMenu', 'directDownloads', 'explorerSelection'].includes(name) && !appSettings.newFeatures) {
                return false;
            }
            return Boolean(appSettings[name]);
        }

        function loadSettings() {
            try {
                const saved = JSON.parse(localStorage.getItem('splitToolSettings') || '{}');
                appSettings = { ...defaultSettings, ...saved };
            } catch (error) {
                appSettings = { ...defaultSettings };
            }
            syncSettingsUI();
        }

        function saveSettings() {
            localStorage.setItem('splitToolSettings', JSON.stringify(appSettings));
        }

        function bindSettingsControls() {
            const bindings = [
                ['settingNewFeatures', 'newFeatures', 'checked'],
                ['settingImagePdfMode', 'imagePdfMode', 'value'],
                ['settingDoubleClickPreview', 'doubleClickPreview', 'checked'],
                ['settingRightClickMenu', 'rightClickMenu', 'checked'],
                ['settingDirectDownloads', 'directDownloads', 'checked'],
                ['settingExplorerSelection', 'explorerSelection', 'checked'],
                ['settingJpgQuality', 'jpgQuality', 'value'],
                ['settingDownloadGap', 'downloadGap', 'value'],
            ];

            bindings.forEach(([elementKey, settingKey, prop]) => {
                DOMElements[elementKey].addEventListener('input', () => {
                    const value = prop === 'checked' ? DOMElements[elementKey].checked : DOMElements[elementKey].value;
                    appSettings[settingKey] = ['jpgQuality', 'downloadGap'].includes(settingKey) ? Number(value) : value;
                    syncSettingsUI();
                    saveSettings();
                });
            });
        }

        function syncSettingsUI() {
            DOMElements.settingNewFeatures.checked = appSettings.newFeatures;
            DOMElements.settingImagePdfMode.value = appSettings.imagePdfMode;
            DOMElements.settingDoubleClickPreview.checked = appSettings.doubleClickPreview;
            DOMElements.settingRightClickMenu.checked = appSettings.rightClickMenu;
            DOMElements.settingDirectDownloads.checked = appSettings.directDownloads;
            DOMElements.settingExplorerSelection.checked = appSettings.explorerSelection;
            DOMElements.settingJpgQuality.value = appSettings.jpgQuality;
            DOMElements.jpgQualityValue.textContent = `${appSettings.jpgQuality}%`;
            DOMElements.settingDownloadGap.value = appSettings.downloadGap;

            const dependentControls = [
                DOMElements.settingDoubleClickPreview,
                DOMElements.settingRightClickMenu,
                DOMElements.settingDirectDownloads,
                DOMElements.settingExplorerSelection,
            ];
            dependentControls.forEach(control => {
                control.disabled = !appSettings.newFeatures;
                control.closest('.setting-row').style.opacity = appSettings.newFeatures ? '1' : '0.55';
            });
        }

        function openSettings() {
            syncSettingsUI();
            DOMElements.settingsModal.classList.add('show');
            hideContextMenu();
        }

        function closeSettings() {
            DOMElements.settingsModal.classList.remove('show');
        }

        function openGuide() {
            DOMElements.guideModal.classList.add('show');
            closeSettings();
            hideContextMenu();
        }

        function closeGuide() {
            DOMElements.guideModal.classList.remove('show');
        }

        function resetSettings() {
            appSettings = { ...defaultSettings };
            saveSettings();
            syncSettingsUI();
        }

        const contextIcons = {
            eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
            check: '<svg viewBox="0 0 24 24"><path d="m20 6-11 11-5-5"/></svg>',
            download: '<svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
            file: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>',
            image: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="m21 15-5-5L5 19"/></svg>',
            up: '<svg viewBox="0 0 24 24"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>',
            down: '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>',
            trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>',
        };

        function menuIcon(name) {
            return `<span class="context-menu-icon">${contextIcons[name]}</span>`;
        }

        function escapeHtml(value) {
            return String(value).replace(/[&<>"']/g, char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            }[char]));
        }

        function openItemContextMenu(e, index) {
            const item = uploadedItems[index];
            if (!item) return;
            const { itemContextMenu } = DOMElements;
            const selectLabel = selectedItems.has(item.id) ? 'Unselect Item' : 'Select Item';
            const itemLabel = item.type === 'pdf-page'
                ? `PDF Page ${item.originalPageNum}`
                : item.type === 'pdf-file'
                    ? `Whole PDF • ${item.pageCount} pages`
                    : 'Image File';

            itemContextMenu.innerHTML = `
                <div class="context-menu-header">
                    <div class="context-menu-title">${escapeHtml(item.sourceFileName)}</div>
                    <div class="context-menu-subtitle">${itemLabel} • Item ${index + 1}</div>
                </div>
                <div class="context-download-grid">
                    <button class="context-download-btn" onclick="downloadSingleItemAs('${item.id}', 'pdf')">${menuIcon('file')}<span>PDF</span></button>
                    <button class="context-download-btn" onclick="downloadSingleItemAs('${item.id}', 'png')">${menuIcon('image')}<span>PNG</span></button>
                    <button class="context-download-btn" onclick="downloadSingleItemAs('${item.id}', 'jpg')">${menuIcon('image')}<span>JPG</span></button>
                </div>
                <div class="context-divider"></div>
                <button class="context-menu-item" onclick="showPreview(${index}); hideContextMenu();">${menuIcon('eye')}<span>Preview</span></button>
                <button class="context-menu-item" onclick="setItemSelected('${item.id}', ${!selectedItems.has(item.id)}); hideContextMenu();">${menuIcon('check')}<span>${selectLabel}</span></button>
                <button class="context-menu-item" onclick="moveItemToEdge('${item.id}', 'first'); hideContextMenu();">${menuIcon('up')}<span>Move First</span></button>
                <button class="context-menu-item" onclick="moveItemToEdge('${item.id}', 'last'); hideContextMenu();">${menuIcon('down')}<span>Move Last</span></button>
                <div class="context-divider"></div>
                <button class="context-menu-item danger" onclick="removeItem('${item.id}'); hideContextMenu();">${menuIcon('trash')}<span>Remove</span></button>
            `;

            itemContextMenu.classList.add('show');
            const menuRect = itemContextMenu.getBoundingClientRect();
            const maxLeft = window.scrollX + window.innerWidth - menuRect.width - 12;
            const maxTop = window.scrollY + window.innerHeight - menuRect.height - 12;
            const left = Math.min(e.pageX + 8, maxLeft);
            const top = Math.min(e.pageY + 8, maxTop);
            itemContextMenu.style.left = `${Math.max(window.scrollX + 12, left)}px`;
            itemContextMenu.style.top = `${Math.max(window.scrollY + 12, top)}px`;
        }

        function hideContextMenu() {
            DOMElements.itemContextMenu.classList.remove('show');
        }

        function sanitizePdfFileName(name) {
            const cleaned = String(name || '')
                .replace(/\.pdf$/i, '')
                .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
                .replace(/\s+/g, ' ')
                .trim();
            return cleaned || 'merged-pdf';
        }

        function openMergeRenamePopover(e) {
            e.preventDefault();
            if (selectedItems.size === 0) {
                showError('Please select items to merge.');
                return;
            }
            hideContextMenu();
            const { mergeRenamePopover, mergeFileNameInput } = DOMElements;
            mergeFileNameInput.value = `merged-${selectedItems.size}-items`;
            mergeRenamePopover.classList.add('show');
            const popoverRect = mergeRenamePopover.getBoundingClientRect();
            const maxLeft = window.scrollX + window.innerWidth - popoverRect.width - 12;
            const maxTop = window.scrollY + window.innerHeight - popoverRect.height - 12;
            const left = Math.min(e.pageX + 8, maxLeft);
            const top = Math.min(e.pageY + 8, maxTop);
            mergeRenamePopover.style.left = `${Math.max(window.scrollX + 12, left)}px`;
            mergeRenamePopover.style.top = `${Math.max(window.scrollY + 12, top)}px`;
            setTimeout(() => {
                mergeFileNameInput.focus();
                mergeFileNameInput.select();
            }, 0);
        }

        function closeMergeRenamePopover() {
            DOMElements.mergeRenamePopover.classList.remove('show');
        }

        async function mergeWithCustomName() {
            const fileName = sanitizePdfFileName(DOMElements.mergeFileNameInput.value);
            closeMergeRenamePopover();
            await mergeSelectedItems(fileName);
        }

        function setItemSelected(itemId, isSelected) {
            toggleItemSelection(itemId, isSelected);
        }

        function removeItem(itemId) {
            uploadedItems = uploadedItems.filter(item => item.id !== itemId);
            selectedItems.delete(itemId);
            focusedIndex = Math.min(focusedIndex, uploadedItems.length - 1);
            if (focusedIndex < 0 && uploadedItems.length > 0) focusedIndex = 0;
            selectionAnchorIndex = focusedIndex;
            renderGridItems();
        }

        function removeItemsBySelection(mode) {
            if (uploadedItems.length === 0) return showError('There are no items to remove.');
            const shouldRemove = mode === 'selected'
                ? item => selectedItems.has(item.id)
                : item => !selectedItems.has(item.id);
            const removeCount = uploadedItems.filter(shouldRemove).length;
            if (removeCount === 0) return showError('No matching items to remove.');

            uploadedItems = uploadedItems.filter(item => !shouldRemove(item));
            selectedItems = new Set([...selectedItems].filter(id => uploadedItems.some(item => item.id === id)));
            focusedIndex = Math.min(focusedIndex, uploadedItems.length - 1);
            if (focusedIndex < 0 && uploadedItems.length > 0) focusedIndex = 0;
            selectionAnchorIndex = focusedIndex;
            hideContextMenu();
            renderGridItems();
            showError(null);
        }

        function moveItemToEdge(itemId, edge) {
            const index = uploadedItems.findIndex(item => item.id === itemId);
            if (index === -1) return;
            const [item] = uploadedItems.splice(index, 1);
            if (edge === 'first') {
                uploadedItems.unshift(item);
            } else {
                uploadedItems.push(item);
            }
            renderGridItems();
        }

        // --- PREVIEW MODAL LOGIC ---

        /**
         * Shows the preview modal starting at a specific item index.
         * @param {number} startIndex - The index of the item to show first.
         */
        function showPreview(startIndex) {
            currentPreviewIndex = startIndex;
            updatePreviewSlider();
            DOMElements.previewModal.classList.add('show');
        }
        
        function closePreview() {
            DOMElements.previewModal.classList.remove('show');
            DOMElements.previewSlider.innerHTML = '';
            currentPreviewIndex = -1;
        }

        function showNextItem() {
            if (currentPreviewIndex < uploadedItems.length - 1) {
                currentPreviewIndex++;
                updatePreviewSlider();
            }
        }

        function showPreviousItem() {
            if (currentPreviewIndex > 0) {
                currentPreviewIndex--;
                updatePreviewSlider();
            }
        }

        /**
         * Updates the classes on slider items for smooth transitions.
         */
        function updatePreviewSlider() {
            const { previewTitle, previewSlider } = DOMElements;
            previewSlider.innerHTML = '';
            const previewIndexes = [currentPreviewIndex - 1, currentPreviewIndex, currentPreviewIndex + 1]
                .filter(index => index >= 0 && index < uploadedItems.length);

            previewIndexes.forEach(index => {
                const item = uploadedItems[index];
                const container = document.createElement('div');
                container.className = 'preview-image-container';
                container.dataset.index = index;
                if (index === currentPreviewIndex) container.classList.add('active');
                else if (index < currentPreviewIndex) container.classList.add('prev');
                else container.classList.add('next');
                container.innerHTML = `<img src="${item.dataUrl}" class="preview-image" alt="Preview">`;
                previewSlider.appendChild(container);
            });

            const currentItem = uploadedItems[currentPreviewIndex];
            previewTitle.textContent = currentItem.type === 'pdf-page'
                ? `Item ${currentPreviewIndex + 1}/${uploadedItems.length} (Page ${currentItem.originalPageNum} from ${currentItem.sourceFileName})`
                : currentItem.type === 'pdf-file'
                    ? `Item ${currentPreviewIndex + 1}/${uploadedItems.length} (PDF with ${currentItem.pageCount} pages from ${currentItem.sourceFileName})`
                    : `Item ${currentPreviewIndex + 1}/${uploadedItems.length} (${currentItem.sourceFileName})`;
        }


        // --- ACTION & DOWNLOAD LOGIC ---

        function canvasToBlob(canvas, mimeType, quality) {
            return new Promise((resolve, reject) => {
                canvas.toBlob(blob => {
                    if (blob) resolve(blob);
                    else reject(new Error('Could not create image data for PDF.'));
                }, mimeType, quality);
            });
        }

        async function addImageAsExactPdfPage(pdfDoc, item) {
            const imageBlob = await canvasToBlob(item.canvas, 'image/png');
            const imageBytes = await imageBlob.arrayBuffer();
            const image = await pdfDoc.embedPng(imageBytes);

            if (appSettings.imagePdfMode === 'a4') {
                const page = pdfDoc.addPage([595.28, 841.89]);
                const { width, height } = image.scaleToFit(page.getWidth(), page.getHeight());
                page.drawImage(image, {
                    x: page.getWidth() / 2 - width / 2,
                    y: page.getHeight() / 2 - height / 2,
                    width,
                    height,
                });
                return page;
            }

            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });
            return page;
        }

        function getItemBaseFileName(item) {
            const index = uploadedItems.findIndex(i => i.id === item.id);
            const safeName = item.sourceFileName.replace(/(\.pdf|\.png|\.jpg|\.jpeg)$/i, '');
            return `${String(index + 1).padStart(3, '0')}-${safeName}`;
        }

        async function createPdfBytesForItem(item, sourcePdfDocs = new Map()) {
            const newPdfDoc = await PDFLib.PDFDocument.create();
            if (item.type === 'pdf-page') {
                const { sourcePdfBytes, originalPageNum } = item;
                let sourcePdf = sourcePdfDocs.get(item.sourceFileName);
                if (!sourcePdf) {
                    sourcePdf = await PDFLib.PDFDocument.load(sourcePdfBytes);
                    sourcePdfDocs.set(item.sourceFileName, sourcePdf);
                }
                const [copiedPage] = await newPdfDoc.copyPages(sourcePdf, [originalPageNum - 1]);
                newPdfDoc.addPage(copiedPage);
            } else if (item.type === 'pdf-file') {
                let sourcePdf = sourcePdfDocs.get(item.sourceFileName);
                if (!sourcePdf) {
                    sourcePdf = await PDFLib.PDFDocument.load(item.sourcePdfBytes);
                    sourcePdfDocs.set(item.sourceFileName, sourcePdf);
                }
                const copiedPages = await newPdfDoc.copyPages(sourcePdf, sourcePdf.getPageIndices());
                copiedPages.forEach(page => newPdfDoc.addPage(page));
            } else {
                await addImageAsExactPdfPage(newPdfDoc, item);
            }
            return newPdfDoc.save();
        }

        async function downloadItemAs(item, format, sourcePdfDocs = new Map()) {
            const fileName = getItemBaseFileName(item);
            if (format === 'pdf') {
                const pdfBytes = await createPdfBytesForItem(item, sourcePdfDocs);
                downloadFile(pdfBytes, `${fileName}.pdf`, 'application/pdf');
                return;
            }

            const mimeType = `image/${format}`;
            const quality = format === 'jpg' ? appSettings.jpgQuality / 100 : undefined;
            const blob = await new Promise(resolve => item.canvas.toBlob(resolve, mimeType, quality));
            downloadFile(blob, `${fileName}.${format}`, mimeType);
        }

        async function downloadSingleItemAs(itemId, format) {
            const item = uploadedItems.find(i => i.id === itemId);
            if (!item) return;
            DOMElements.loading.classList.add('show');
            showError(null);
            try {
                await downloadItemAs(item, format);
                hideContextMenu();
            } catch (error) {
                console.error("Single item download error:", error);
                showError('An error occurred while preparing the download.');
            } finally {
                DOMElements.loading.classList.remove('show');
            }
        }

        /**
         * Merges selected items into a single PDF. Images are embedded into pages.
         */
        async function mergeSelectedItems(customFileName = null) {
            if (selectedItems.size === 0) return showError('Please select items to merge.');
            
            DOMElements.loading.classList.add('show');
            showError(null);

            try {
                const mergedPdfDoc = await PDFLib.PDFDocument.create();
                const sortedSelectedIds = uploadedItems
                    .map(item => item.id)
                    .filter(id => selectedItems.has(id));

                // A map to cache loaded source PDFs for performance
                const sourcePdfDocs = new Map();

                for (const id of sortedSelectedIds) {
                    const item = uploadedItems.find(i => i.id === id);
                    if (item.type === 'pdf-page') {
                        const { sourcePdfBytes, originalPageNum } = item;
                        let sourcePdf = sourcePdfDocs.get(item.sourceFileName);
                        if (!sourcePdf) {
                            sourcePdf = await PDFLib.PDFDocument.load(sourcePdfBytes);
                            sourcePdfDocs.set(item.sourceFileName, sourcePdf);
                        }
                        const [copiedPage] = await mergedPdfDoc.copyPages(sourcePdf, [originalPageNum - 1]);
                        mergedPdfDoc.addPage(copiedPage);

                    } else if (item.type === 'pdf-file') {
                        let sourcePdf = sourcePdfDocs.get(item.sourceFileName);
                        if (!sourcePdf) {
                            sourcePdf = await PDFLib.PDFDocument.load(item.sourcePdfBytes);
                            sourcePdfDocs.set(item.sourceFileName, sourcePdf);
                        }
                        const copiedPages = await mergedPdfDoc.copyPages(sourcePdf, sourcePdf.getPageIndices());
                        copiedPages.forEach(page => mergedPdfDoc.addPage(page));

                    } else if (item.type === 'image') {
                        await addImageAsExactPdfPage(mergedPdfDoc, item);
                    }
                }

                const pdfBytes = await mergedPdfDoc.save();
                const finalName = customFileName
                    ? `${sanitizePdfFileName(customFileName)}.pdf`
                    : `merged-${sortedSelectedIds.length}-items.pdf`;
                downloadFile(pdfBytes, finalName, 'application/pdf');

            } catch (error) {
                console.error("Merge error:", error);
                showError('An error occurred while merging the files.');
            } finally {
                DOMElements.loading.classList.remove('show');
            }
        }
        
        /**
         * Downloads selected items directly as individual files.
         * @param {'pdf' | 'png' | 'jpg'} format - The desired output format.
         */
        async function downloadSelectedAs(format) {
            if (selectedItems.size === 0) return showError('Please select items to download.');
            
            DOMElements.loading.classList.add('show');
            showError(null);

            try {
                if (!isFeatureEnabled('directDownloads')) {
                    await downloadSelectedAsZip(format);
                    return;
                }

                const sortedSelectedIds = uploadedItems
                    .map(item => item.id)
                    .filter(id => selectedItems.has(id));
                
                const sourcePdfDocs = new Map();

                for (const id of sortedSelectedIds) {
                    const item = uploadedItems.find(i => i.id === id);
                    await downloadItemAs(item, format, sourcePdfDocs);
                    await new Promise(resolve => setTimeout(resolve, appSettings.downloadGap));
                }

            } catch (error) {
                console.error("Download error:", error);
                showError('An error occurred while preparing the download.');
            } finally {
                DOMElements.loading.classList.remove('show');
            }
        }

        async function downloadSelectedAsZip(format) {
            const zip = new JSZip();
            const sourcePdfDocs = new Map();
            const sortedSelectedIds = uploadedItems
                .map(item => item.id)
                .filter(id => selectedItems.has(id));

            for (const id of sortedSelectedIds) {
                const item = uploadedItems.find(i => i.id === id);
                const fileName = getItemBaseFileName(item);

                if (format === 'pdf') {
                    const pdfBytes = await createPdfBytesForItem(item, sourcePdfDocs);
                    zip.file(`${fileName}.pdf`, pdfBytes);
                } else {
                    const mimeType = `image/${format}`;
                    const quality = format === 'jpg' ? appSettings.jpgQuality / 100 : undefined;
                    const blob = await new Promise(resolve => item.canvas.toBlob(resolve, mimeType, quality));
                    zip.file(`${fileName}.${format}`, blob);
                }
            }

            const zipBlob = await zip.generateAsync({ type: "blob" });
            downloadFile(zipBlob, `selected-items-${format}.zip`, 'application/zip');
        }
        
        /**
         * Downloads all items in a structured ZIP file with folders for each format.
         */
        async function downloadAllInZip() {
            if (uploadedItems.length === 0) return showError('There are no items to download.');

            DOMElements.loading.classList.add('show');
            showError(null);

            try {
                const zip = new JSZip();
                const pdfsFolder = zip.folder('PDFs');
                const pngsFolder = zip.folder('PNGs');
                const jpgsFolder = zip.folder('JPGs');

                const sourcePdfDocs = new Map();

                for (let i = 0; i < uploadedItems.length; i++) {
                    const item = uploadedItems[i];
                    const fileName = `${String(i + 1).padStart(3, '0')}-${item.sourceFileName.replace(/(\.pdf|\.png|\.jpg|\.jpeg)$/, '')}`;

                    // --- Create PDF version ---
                    const pdfBytes = await createPdfBytesForItem(item, sourcePdfDocs);
                    pdfsFolder.file(`${fileName}.pdf`, pdfBytes);
                    
                    // --- Create PNG version ---
                    const pngBlob = await new Promise(resolve => item.canvas.toBlob(resolve, 'image/png'));
                    pngsFolder.file(`${fileName}.png`, pngBlob);

                    // --- Create JPG version ---
                    const jpgBlob = await new Promise(resolve => item.canvas.toBlob(resolve, 'image/jpeg', 0.9));
                    jpgsFolder.file(`${fileName}.jpg`, jpgBlob);
                }

                const zipBlob = await zip.generateAsync({ type: "blob" });
                downloadFile(zipBlob, 'All-Items-Export.zip', 'application/zip');

            } catch (error) {
                console.error("ZIP All error:", error);
                showError('An error occurred while creating the ZIP archive.');
            } finally {
                DOMElements.loading.classList.remove('show');
            }
        }


        // --- UTILITY FUNCTIONS ---

        /**
         * Triggers a file download in the browser.
         * @param {BlobPart} data - The data to download (e.g., ArrayBuffer).
         * @param {string} filename - The name of the file.
         * @param {string} mimeType - The MIME type of the file.
         */
        function downloadFile(data, filename, mimeType) {
            const blob = new Blob([data], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        /**
         * Displays an error message or clears it.
         * @param {string|null} message - The message to show, or null to hide.
         */
        function showError(message) {
            const { errorMessage } = DOMElements;
            if (message) {
                errorMessage.textContent = message;
                errorMessage.classList.add('show');
            } else {
                errorMessage.classList.remove('show');
            }
        }