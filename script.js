/* === JS Block 1 === */
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        let uploadedItems = [];
        let selectedItems = new Set();
        let draggedElement = null;
        let draggedId = null;
        let currentPreviewIndex = -1;
        let focusedIndex = -1;
        let selectionAnchorIndex = -1;

        const defaultSettings = {
            theme: 'light',
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
            settingTheme: document.getElementById('settingTheme'),
            settingNewFeatures: document.getElementById('settingNewFeatures'),
            settingImagePdfMode: document.getElementById('settingImagePdfMode'),
            settingDoubleClickPreview: document.getElementById('settingDoubleClickPreview'),
            settingRightClickMenu: document.getElementById('settingRightClickMenu'),
            settingDirectDownloads: document.getElementById('settingDirectDownloads'),
            settingExplorerSelection: document.getElementById('settingExplorerSelection'),
            settingJpgQuality: document.getElementById('settingJpgQuality'),
            jpgQualityValue: document.getElementById('jpgQualityValue'),
            settingDownloadGap: document.getElementById('settingDownloadGap'),
            themeToggleBtn: document.getElementById('themeToggleBtn'),
        };

        // ===== THEME SYSTEM =====
        function applyTheme(theme) {
            let dark = false;
            if (theme === 'dark') dark = true;
            else if (theme === 'device') dark = window.matchMedia('(prefers-color-scheme: dark)').matches;

            document.documentElement.classList.toggle('dark', dark);
        }

        function toggleThemeManual() {
            const current = appSettings.theme;
            const next = current === 'light' ? 'dark' : 'light';
            appSettings.theme = next;
            DOMElements.settingTheme.value = next;
            applyTheme(next);
            saveSettings();
        }

        // Listen for device theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (appSettings.theme === 'device') applyTheme('device');
        });

        // ===== INIT =====
        document.addEventListener('DOMContentLoaded', initialize);

        function initialize() {
            const { uploadZone, fileInput, previewModal } = DOMElements;
            loadSettings();
            bindSettingsControls();
            document.body.appendChild(DOMElements.itemContextMenu);

            uploadZone.addEventListener('click', () => fileInput.click());
            uploadZone.addEventListener('dragover', handleDragOver);
            uploadZone.addEventListener('dragleave', handleDragLeave);
            uploadZone.addEventListener('drop', handleFileDrop);
            fileInput.addEventListener('change', handleFileSelect);
            document.addEventListener('paste', handlePaste);
            document.addEventListener('click', handleGlobalClick);
            previewModal.addEventListener('click', (e) => e.target === previewModal && closePreview());
            document.addEventListener('keydown', handleKeyDown);
            DOMElements.guideModal.addEventListener('click', (e) => e.target === DOMElements.guideModal && closeGuide());
            DOMElements.settingsModal.addEventListener('click', (e) => e.target === DOMElements.settingsModal && closeSettings());

            // Preview swipe (mouse + touch)
            let isDrag = false, sX;
            const slider = DOMElements.previewSlider;
            slider.addEventListener('mousedown', (e) => { isDrag = true; sX = e.pageX; e.preventDefault(); });
            slider.addEventListener('mouseleave', () => isDrag = false);
            slider.addEventListener('mouseup', (e) => { if (!isDrag) return; isDrag = false; const d = sX - e.pageX; if (Math.abs(d) > 50) { d > 0 ? showNextItem() : showPreviousItem(); } });
            slider.addEventListener('mousemove', (e) => { if (isDrag) e.preventDefault(); });
            // Touch swipe for preview
            let tSX = 0;
            slider.addEventListener('touchstart', (e) => { tSX = e.touches[0].pageX; }, { passive: true });
            slider.addEventListener('touchend', (e) => { const d = tSX - e.changedTouches[0].pageX; if (Math.abs(d) > 40) { d > 0 ? showNextItem() : showPreviousItem(); } }, { passive: true });

            // Touch drag reorder for mobile
            initTouchDragReorder();
        }

        // ===== CUSTOM DRAG REORDER (WORKS ON DESKTOP + MOBILE DESKTOP MODE + TOUCH) =====
        let customDragState = null;

        function initTouchDragReorder() {
            const grid = DOMElements.pagesGrid;

            // ---- MOUSE DRAG (works on desktop AND mobile-desktop-mode) ----
            grid.addEventListener('mousedown', (e) => {
                const pageItem = e.target.closest('.page-item');
                if (!pageItem) return;
                if (e.target.closest('.selection-checkbox')) return;

                const isHandle = !!e.target.closest('.drag-handle');

                // Prevent text selection on any mousedown on page items
                e.preventDefault();

                // Save coordinates (don't rely on stale event object)
                const savedX = e.clientX;
                const savedY = e.clientY;
                let dragStarted = false;
                let holdTimer = null;
                let dragReady = false; // visual feedback state

                if (isHandle) {
                    // Handle: drag starts on small movement (8px)
                } else {
                    // Card body: long press 250ms → card "lifts" → then move to drag
                    holdTimer = setTimeout(() => {
                        holdTimer = null;
                        dragReady = true;
                        // Visual feedback: card lifts up
                        pageItem.style.transform = 'scale(1.04)';
                        pageItem.style.boxShadow = '0 12px 30px rgba(102,126,234,0.3)';
                        pageItem.style.borderColor = 'var(--primary)';
                        pageItem.style.zIndex = '100';
                        // Start drag immediately with saved position
                        startDragAtPosition(pageItem, savedX, savedY);
                        dragStarted = true;
                    }, 70);
                }

                function onMouseMove(ev) {
                    ev.preventDefault();
                    const dx = ev.clientX - savedX;
                    const dy = ev.clientY - savedY;
                    const dist = Math.sqrt(dx*dx + dy*dy);

                    if (!dragStarted) {
                        if (isHandle && dist > 6) {
                            // Handle: start drag after small movement
                            if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
                            startDragAtPosition(pageItem, ev.clientX, ev.clientY);
                            dragStarted = true;
                        } else if (!isHandle && !dragReady && dist > 25) {
                            // Card body moved too much before hold fired → it's a scroll, cancel
                            if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
                            resetPageItemStyle(pageItem);
                            cleanup();
                            return;
                        }
                        // If dragReady but not yet started (edge case), start now
                        if (dragReady && !dragStarted) {
                            startDragAtPosition(pageItem, ev.clientX, ev.clientY);
                            dragStarted = true;
                        }
                    }

                    if (dragStarted && customDragState) {
                        moveCustomDrag(ev.clientX, ev.clientY);
                    }
                }

                function onMouseUp(ev) {
                    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
                    resetPageItemStyle(pageItem);
                    if (dragStarted && customDragState) {
                        endCustomDrag();
                    }
                    cleanup();
                }

                function cleanup() {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                }

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            // Prevent context menu on page items (blocks long-press menu on mobile desktop mode)
            grid.addEventListener('contextmenu', (e) => {
                const pageItem = e.target.closest('.page-item');
                if (pageItem) {
                    e.preventDefault();
                    // Still open custom context menu if feature enabled
                    if (isFeatureEnabled('rightClickMenu')) {
                        const index = uploadedItems.findIndex(i => i.id === pageItem.dataset.id);
                        if (index !== -1) openItemContextMenu(e, index);
                    }
                }
            });

            // ---- TOUCH DRAG (for actual touch devices) ----
            let touchLongPressTimer = null;

            grid.addEventListener('touchstart', (e) => {
                const handle = e.target.closest('.drag-handle');
                const pageItem = e.target.closest('.page-item');
                if (!pageItem) return;

                // Drag handle: immediate drag start
                if (handle) {
                    e.preventDefault();
                    startDragFromTouch(pageItem, e.touches[0]);
                    return;
                }

                if (e.target.closest('.selection-checkbox')) return;

                // Card body: long press to start drag
                const touch = e.touches[0];
                const startX = touch.clientX;
                const startY = touch.clientY;

                touchLongPressTimer = setTimeout(() => {
                    touchLongPressTimer = null;
                    if (navigator.vibrate) navigator.vibrate(30);
                    // Visual feedback
                    pageItem.style.transform = 'scale(1.04)';
                    pageItem.style.boxShadow = '0 12px 30px rgba(102,126,234,0.3)';
                    pageItem.style.borderColor = 'var(--primary)';
                    pageItem.style.zIndex = '100';
                    startDragFromTouch(pageItem, { clientX: startX, clientY: startY });
                }, 150);

                const cancelCheck = (ev) => {
                    if (!ev.touches[0]) return;
                    const t = ev.touches[0];
                    if (Math.abs(t.clientX - startX) > 20 || Math.abs(t.clientY - startY) > 20) {
                        if (touchLongPressTimer) {
                            clearTimeout(touchLongPressTimer);
                            touchLongPressTimer = null;
                        }
                        grid.removeEventListener('touchmove', cancelCheck);
                    }
                };
                grid.addEventListener('touchmove', cancelCheck, { passive: true });

                const cancelEnd = () => {
                    if (touchLongPressTimer) {
                        clearTimeout(touchLongPressTimer);
                        touchLongPressTimer = null;
                    }
                    grid.removeEventListener('touchmove', cancelCheck);
                };
                grid.addEventListener('touchend', cancelEnd, { once: true, passive: true });
            }, { passive: false });

            grid.addEventListener('touchmove', (e) => {
                if (!customDragState) return;
                e.preventDefault();
                e.stopPropagation();
                const touch = e.touches[0];
                moveCustomDrag(touch.clientX, touch.clientY);

                // Auto-scroll near edges
                const edgeZone = 60, scrollSpeed = 10;
                if (touch.clientY < edgeZone) window.scrollBy(0, -scrollSpeed);
                else if (touch.clientY > window.innerHeight - edgeZone) window.scrollBy(0, scrollSpeed);
            }, { passive: false });

            grid.addEventListener('touchend', () => {
                if (!customDragState) return;
                endCustomDrag();
            }, { passive: true });

            grid.addEventListener('touchcancel', () => {
                if (!customDragState) return;
                cancelCustomDrag();
            }, { passive: true });
        }

        function resetPageItemStyle(el) {
            el.style.transform = '';
            el.style.boxShadow = '';
            el.style.borderColor = '';
            el.style.zIndex = '';
        }

        function startDragAtPosition(pageItem, clientX, clientY) {
            const rect = pageItem.getBoundingClientRect();
            const ghost = pageItem.cloneNode(true);
            ghost.className = 'page-item custom-drag-ghost';
            ghost.style.width = (rect.width * 0.8) + 'px';
            ghost.style.height = (rect.height * 0.8) + 'px';
            ghost.style.left = (clientX - rect.width * 0.4) + 'px';
            ghost.style.top = (clientY - rect.height * 0.4) + 'px';
            document.body.appendChild(ghost);
            pageItem.classList.add('dragging');
            document.body.style.cursor = 'grabbing';

            customDragState = {
                sourceItem: pageItem,
                sourceId: pageItem.dataset.id,
                offsetX: rect.width * 0.4,
                offsetY: rect.height * 0.4,
                ghost: ghost,
                currentOver: null,
            };
        }

        function startDragFromTouch(pageItem, touch) {
            const rect = pageItem.getBoundingClientRect();
            const ghost = pageItem.cloneNode(true);
            ghost.className = 'page-item custom-drag-ghost';
            ghost.style.width = (rect.width * 0.8) + 'px';
            ghost.style.height = (rect.height * 0.8) + 'px';
            ghost.style.left = (touch.clientX - rect.width * 0.4) + 'px';
            ghost.style.top = (touch.clientY - rect.height * 0.4) + 'px';
            document.body.appendChild(ghost);
            pageItem.classList.add('dragging');
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';

            customDragState = {
                sourceItem: pageItem,
                sourceId: pageItem.dataset.id,
                offsetX: rect.width * 0.4,
                offsetY: rect.height * 0.4,
                ghost: ghost,
                currentOver: null,
            };
        }

        function moveCustomDrag(clientX, clientY) {
            if (!customDragState) return;
            const { ghost, offsetX, offsetY } = customDragState;
            ghost.style.left = (clientX - offsetX) + 'px';
            ghost.style.top = (clientY - offsetY) + 'px';

            // Find target under cursor
            ghost.style.display = 'none';
            const el = document.elementFromPoint(clientX, clientY);
            ghost.style.display = '';
            const targetItem = el ? el.closest('.page-item') : null;

            if (customDragState.currentOver && customDragState.currentOver !== targetItem) {
                customDragState.currentOver.classList.remove('drag-over');
            }
            if (targetItem && targetItem !== customDragState.sourceItem && !targetItem.classList.contains('custom-drag-ghost')) {
                targetItem.classList.add('drag-over');
                customDragState.currentOver = targetItem;
            } else {
                customDragState.currentOver = null;
            }
        }

        function endCustomDrag() {
            if (!customDragState) return;
            const { sourceItem, sourceId, ghost, currentOver } = customDragState;
            sourceItem.classList.remove('dragging');
            resetPageItemStyle(sourceItem);
            if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
            document.body.style.cursor = '';
            document.body.style.overflow = '';
            document.body.style.touchAction = '';

            if (currentOver) {
                currentOver.classList.remove('drag-over');
                const fromIndex = uploadedItems.findIndex(i => i.id === sourceId);
                const toIndex = uploadedItems.findIndex(i => i.id === currentOver.dataset.id);
                if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
                    reorderItems(fromIndex, toIndex);
                }
            }
            document.querySelectorAll('.page-item.drag-over').forEach(el => el.classList.remove('drag-over'));
            customDragState = null;
        }

        function cancelCustomDrag() {
            if (!customDragState) return;
            customDragState.sourceItem.classList.remove('dragging');
            resetPageItemStyle(customDragState.sourceItem);
            if (customDragState.ghost && customDragState.ghost.parentNode) customDragState.ghost.parentNode.removeChild(customDragState.ghost);
            document.body.style.cursor = '';
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.querySelectorAll('.page-item.drag-over').forEach(el => el.classList.remove('drag-over'));
            customDragState = null;
        }

        // ===== EVENT HANDLERS =====
        function handleDragOver(e) { e.preventDefault(); DOMElements.uploadZone.classList.add('dragover'); }
        function handleDragLeave() { DOMElements.uploadZone.classList.remove('dragover'); }
        function handleFileDrop(e) { e.preventDefault(); DOMElements.uploadZone.classList.remove('dragover'); if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files); }
        function handleFileSelect(e) { if (e.target.files.length > 0) processFiles(e.target.files); }
        function handlePaste(e) {
            const items = (e.clipboardData || window.clipboardData).items;
            const files = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file' && items[i].type.startsWith('image/')) files.push(items[i].getAsFile());
            }
            if (files.length > 0) processFiles(files);
        }
        function handleGlobalClick(e) {
            document.querySelectorAll('.dropdown').forEach(d => { if (!d.contains(e.target)) { d.classList.remove('active'); d.querySelector('.dropdown-content').classList.remove('show'); } });
            if (!DOMElements.itemContextMenu.contains(e.target)) hideContextMenu();
            if (!DOMElements.mergeRenamePopover.contains(e.target) && !e.target.closest('[data-merge-button]')) closeMergeRenamePopover();
        }
        function handleKeyDown(e) {
            if (e.key === 'Escape' && DOMElements.guideModal.classList.contains('show')) { closeGuide(); return; }
            if (e.key === 'Escape' && DOMElements.settingsModal.classList.contains('show')) { closeSettings(); return; }
            if (e.key === 'Escape' && DOMElements.mergeRenamePopover.classList.contains('show')) { closeMergeRenamePopover(); return; }
            if (e.key === 'Enter' && DOMElements.mergeRenamePopover.classList.contains('show') && document.activeElement === DOMElements.mergeFileNameInput) { mergeWithCustomName(); return; }
            if (DOMElements.previewModal.classList.contains('show')) {
                if (e.key === 'Escape') closePreview();
                if (e.key === 'ArrowLeft') showPreviousItem();
                if (e.key === 'ArrowRight') showNextItem();
                return;
            }
            if (isFeatureEnabled('explorerSelection') && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                if (uploadedItems.length === 0 || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
                e.preventDefault(); selectAllItems(); return;
            }
            if (isFeatureEnabled('explorerSelection') && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End',' ','Enter','Delete'].includes(e.key)) {
                if (uploadedItems.length === 0 || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
                const cols = getGridColumnCount();
                const ext = e.shiftKey;
                if (e.key === 'ArrowLeft') { e.preventDefault(); moveFocusBy(-1, ext); }
                else if (e.key === 'ArrowRight') { e.preventDefault(); moveFocusBy(1, ext); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocusBy(-cols, ext); }
                else if (e.key === 'ArrowDown') { e.preventDefault(); moveFocusBy(cols, ext); }
                else if (e.key === 'Home') { e.preventDefault(); if (ext) handleExplorerSelection(0,{range:true}); else { focusedIndex=0; selectionAnchorIndex=0; updateSelectionUI(); } scrollFocusedItemIntoView(); }
                else if (e.key === 'End') { e.preventDefault(); const l=uploadedItems.length-1; if (ext) handleExplorerSelection(l,{range:true}); else { focusedIndex=l; selectionAnchorIndex=l; updateSelectionUI(); } scrollFocusedItemIntoView(); }
                else if (e.key === ' ') { e.preventDefault(); handleExplorerSelection(focusedIndex===-1?0:focusedIndex,{toggle:true}); }
                else if (e.key === 'Enter') { e.preventDefault(); if (focusedIndex!==-1) showPreview(focusedIndex); }
                else if (e.key === 'Delete') { e.preventDefault(); removeItemsBySelection('selected'); }
            }
        }

        // ===== FILE PROCESSING (ULTRA-FAST) =====
        let _uidC = 0;
        function uid() { return `i-${Date.now()}-${(++_uidC).toString(36)}-${Math.random().toString(36).slice(2,5)}`; }

        async function processFiles(files) {
            const { progressContainer, progressFill, progressText, controls } = DOMElements;
            showError(null);
            progressContainer.style.display = 'block';
            controls.classList.remove('active');

            // SPEED: tiny thumbnails — preview is only 260px, 0.3 scale is plenty
            // Full quality re-rendered on-demand during merge/download via getFullCanvas()
            const THUMB_SCALE = 0.3;
            const THUMB_Q     = 0.3;
            const BATCH       = 6;   // concurrent pages at a time

            let fileIdx = 0;
            const totalFiles = files.length;

            for (const file of files) {
                fileIdx++;
                try {
                    if (file.type === 'application/pdf') {
                        const pdfBytes = await file.arrayBuffer();
                        const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;

                        if (!DOMElements.splitPdfPages.checked) {
                            // Single card per PDF — render only page 1 thumbnail
                            const page = await pdfDoc.getPage(1);
                            const canvas = await renderPageToCanvas(page, THUMB_SCALE);
                            uploadedItems.push({
                                id: uid(), type:'pdf-file', sourceFileName: file.name,
                                pageCount: pdfDoc.numPages, canvas,
                                dataUrl: canvas.toDataURL('image/jpeg', THUMB_Q),
                                sourcePdfBytes: pdfBytes
                            });
                            progressText.textContent = `✓ ${file.name} (${pdfDoc.numPages} pages)`;
                            progressFill.style.width = `${(fileIdx / totalFiles) * 100}%`;
                            renderGridItems();
                            controls.classList.add('active');
                        } else {
                            // Split pages — process BATCH pages concurrently
                            const numPages = pdfDoc.numPages;
                            for (let b = 0; b < numPages; b += BATCH) {
                                const batchEnd = Math.min(b + BATCH, numPages);
                                const promises = [];
                                for (let i = b; i < batchEnd; i++) {
                                    const pageNum = i + 1;
                                    promises.push((async () => {
                                        const page = await pdfDoc.getPage(pageNum);
                                        const canvas = await renderPageToCanvas(page, THUMB_SCALE);
                                        return {
                                            id: uid(), type:'pdf-page',
                                            sourceFileName: file.name,
                                            originalPageNum: pageNum,
                                            canvas,
                                            dataUrl: canvas.toDataURL('image/jpeg', THUMB_Q),
                                            sourcePdfBytes: pdfBytes
                                        };
                                    })());
                                }
                                const results = await Promise.all(promises);
                                // Sort by page number to maintain order
                                results.sort((a, b) => a.originalPageNum - b.originalPageNum);
                                uploadedItems.push(...results);

                                progressText.textContent = `${file.name} — ${batchEnd}/${numPages} pages`;
                                progressFill.style.width = `${(batchEnd / numPages) * 100}%`;

                                // Progressive grid update — pages appear as they load
                                renderGridItems();
                                controls.classList.add('active');
                                await new Promise(r => setTimeout(r, 0));
                            }
                        }
                    } else if (file.type.startsWith('image/')) {
                        const dataUrl = await readFileAsDataURL(file);
                        const canvas = await createCanvasFromImage(dataUrl);
                        uploadedItems.push({
                            id: uid(), type:'image', sourceFileName: file.name,
                            canvas, dataUrl
                        });
                        progressText.textContent = `✓ ${file.name}`;
                        progressFill.style.width = `${(fileIdx / totalFiles) * 100}%`;
                        renderGridItems();
                        controls.classList.add('active');
                    }
                } catch (err) {
                    console.error("Error processing:", file.name, err);
                    showError(`Failed to process ${file.name}.`);
                }
            }
            renderGridItems();
            if (uploadedItems.length > 0) controls.classList.add('active');
            progressContainer.style.display = 'none';
        }

        async function renderPageToCanvas(page, scale) {
            const c = document.createElement('canvas');
            const ctx = c.getContext('2d');
            const vp = page.getViewport({ scale });
            c.width = vp.width; c.height = vp.height;
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            return c;
        }

        // On-demand full quality canvas — PDF pages only store tiny thumbnails for speed
        // This re-renders at high resolution when downloading as PNG/JPG
        async function getFullCanvas(item) {
            if (item.type === 'image') return item.canvas;
            // Re-render PDF page at full 1.5x scale for crisp output
            const pdfDoc = await pdfjsLib.getDocument({ data: item.sourcePdfBytes.slice(0) }).promise;
            const pageNum = item.type === 'pdf-page' ? item.originalPageNum : 1;
            const page = await pdfDoc.getPage(pageNum);
            return renderPageToCanvas(page, 1.5);
        }
        function readFileAsDataURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
        function createCanvasFromImage(dataUrl) {
            return new Promise((res, rej) => {
                const img = new Image();
                img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); res(c); };
                img.onerror = rej; img.src = dataUrl;
            });
        }

        function renderGridItems() {
            const { pagesGrid } = DOMElements;
            pagesGrid.innerHTML = '';
            const frag = document.createDocumentFragment();
            uploadedItems.forEach((item, index) => {
                const el = document.createElement('div');
                el.className = 'page-item';
                el.draggable = false;
                el.dataset.id = item.id;
                const title = item.type === 'pdf-page' ? `Page ${index+1} (${item.sourceFileName})`
                    : item.type === 'pdf-file' ? `PDF ${index+1} (${item.pageCount}p) - ${item.sourceFileName}`
                    : `Image ${index+1} (${item.sourceFileName})`;
                el.innerHTML = `<div class="drag-handle" title="Drag to reorder">⋮⋮</div>
                    <input type="checkbox" class="selection-checkbox" onmousedown="event.stopPropagation();" onmouseup="event.stopPropagation();" onchange="event.stopPropagation();setSelectionFocus(${index});toggleItemSelection('${item.id}',this.checked);">
                    <img class="page-preview" src="${item.dataUrl}" alt="${title}" loading="lazy" decoding="async" draggable="false">
                    <div class="page-title">${title}</div>`;

                // Prevent ALL text selection and native drag on page items
                el.addEventListener('selectstart', (e) => e.preventDefault());
                el.addEventListener('dragstart', (e) => e.preventDefault());

                let clickTimer = null;
                el.addEventListener('click', (e) => {
                    if (e.target.matches('input,.drag-handle')) return;
                    if (customDragState) return; // Don't select during drag
                    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
                    if (e.ctrlKey || e.metaKey) handleExplorerSelection(index,{toggle:true});
                    else if (isFeatureEnabled('explorerSelection') && e.shiftKey) handleExplorerSelection(index,{range:true});
                    else { clickTimer = setTimeout(() => { handleExplorerSelection(index,{toggle:true}); clickTimer=null; }, 200); }
                });
                el.addEventListener('dblclick', (e) => { if (!isFeatureEnabled('doubleClickPreview') || e.target.matches('input,.drag-handle')) return; e.preventDefault(); if (clickTimer) { clearTimeout(clickTimer); clickTimer=null; } showPreview(index); });
                el.addEventListener('contextmenu', (e) => { if (!isFeatureEnabled('rightClickMenu')) { e.preventDefault(); return; } e.preventDefault(); openItemContextMenu(e, index); });
                frag.appendChild(el);
            });
            pagesGrid.appendChild(frag);
            updateSelectionUI();
        }

        function reorderItems(from, to) { if (from===to) return; const [m]=uploadedItems.splice(from,1); uploadedItems.splice(to,0,m); focusedIndex=to; selectionAnchorIndex=to; renderGridItems(); }
        function setSelectionFocus(i) { if (!uploadedItems.length) { focusedIndex=-1; selectionAnchorIndex=-1; return; } focusedIndex=Math.max(0,Math.min(i,uploadedItems.length-1)); if (selectionAnchorIndex===-1) selectionAnchorIndex=focusedIndex; }
        function handleExplorerSelection(i, mode={}) {
            const item=uploadedItems[i]; if(!item) return; focusedIndex=i;
            if (mode.range) { const a=selectionAnchorIndex===-1?i:selectionAnchorIndex; selectedItems.clear(); for(let j=Math.min(a,i);j<=Math.max(a,i);j++) selectedItems.add(uploadedItems[j].id); }
            else if (mode.toggle) { selectedItems.has(item.id)?selectedItems.delete(item.id):selectedItems.add(item.id); selectionAnchorIndex=i; }
            else { selectedItems.clear(); selectedItems.add(item.id); selectionAnchorIndex=i; }
            updateSelectionUI();
        }
        function getGridColumnCount() { const items=[...document.querySelectorAll('.page-item')]; if(items.length<2) return 1; const ft=items[0].offsetTop; return Math.max(1,items.filter(i=>i.offsetTop===ft).length); }
        function moveFocusBy(d, ext) { if(!uploadedItems.length) return; const c=focusedIndex===-1?0:focusedIndex; const n=Math.max(0,Math.min(c+d,uploadedItems.length-1)); if(ext) handleExplorerSelection(n,{range:true}); else { focusedIndex=n; selectionAnchorIndex=n; updateSelectionUI(); } scrollFocusedItemIntoView(); }
        function scrollFocusedItemIntoView() { const f=document.querySelector('.page-item.focused'); if(f) f.scrollIntoView({block:'nearest',behavior:'smooth'}); }

        function toggleItemSelection(id, sel) { sel ? selectedItems.add(id) : selectedItems.delete(id); updateSelectionUI(); }
        function updateSelectionUI() {
            DOMElements.selectedCount.textContent=selectedItems.size;
            DOMElements.selectionInfo.classList.toggle('show',selectedItems.size>0);
            document.querySelectorAll('.page-item').forEach((el,i)=>{
                const id=el.dataset.id, sel=selectedItems.has(id);
                el.classList.toggle('selected',sel);
                el.classList.toggle('focused',i===focusedIndex);
                const cb=el.querySelector('.selection-checkbox'); if(cb) cb.checked=sel;
            });
        }
        function selectAllItems() { uploadedItems.forEach(i=>selectedItems.add(i.id)); focusedIndex=uploadedItems.length>0?0:-1; selectionAnchorIndex=focusedIndex; updateSelectionUI(); }
        function deselectAllItems() { selectedItems.clear(); selectionAnchorIndex=focusedIndex; updateSelectionUI(); }
        function toggleDropdown(id) { const d=document.getElementById(id); d.classList.toggle('active'); d.querySelector('.dropdown-content').classList.toggle('show'); }
        function isFeatureEnabled(n) { if(['doubleClickPreview','rightClickMenu','directDownloads','explorerSelection'].includes(n)&&!appSettings.newFeatures) return false; return Boolean(appSettings[n]); }

        // ===== SETTINGS =====
        function loadSettings() { try { const s=JSON.parse(localStorage.getItem('splitToolSettings')||'{}'); appSettings={...defaultSettings,...s}; } catch(e) { appSettings={...defaultSettings}; } syncSettingsUI(); applyTheme(appSettings.theme); }
        function saveSettings() { localStorage.setItem('splitToolSettings',JSON.stringify(appSettings)); }
        function bindSettingsControls() {
            const bindings=[['settingNewFeatures','newFeatures','checked'],['settingImagePdfMode','imagePdfMode','value'],['settingDoubleClickPreview','doubleClickPreview','checked'],['settingRightClickMenu','rightClickMenu','checked'],['settingDirectDownloads','directDownloads','checked'],['settingExplorerSelection','explorerSelection','checked'],['settingJpgQuality','jpgQuality','value'],['settingDownloadGap','downloadGap','value']];
            bindings.forEach(([ek,sk,prop])=>{ DOMElements[ek].addEventListener('input',()=>{ const v=prop==='checked'?DOMElements[ek].checked:DOMElements[ek].value; appSettings[sk]=['jpgQuality','downloadGap'].includes(sk)?Number(v):v; syncSettingsUI(); saveSettings(); }); });
            DOMElements.settingTheme.addEventListener('change', () => { appSettings.theme = DOMElements.settingTheme.value; applyTheme(appSettings.theme); saveSettings(); });
        }
        function syncSettingsUI() {
            DOMElements.settingTheme.value=appSettings.theme;
            DOMElements.settingNewFeatures.checked=appSettings.newFeatures;
            DOMElements.settingImagePdfMode.value=appSettings.imagePdfMode;
            DOMElements.settingDoubleClickPreview.checked=appSettings.doubleClickPreview;
            DOMElements.settingRightClickMenu.checked=appSettings.rightClickMenu;
            DOMElements.settingDirectDownloads.checked=appSettings.directDownloads;
            DOMElements.settingExplorerSelection.checked=appSettings.explorerSelection;
            DOMElements.settingJpgQuality.value=appSettings.jpgQuality;
            DOMElements.jpgQualityValue.textContent=`${appSettings.jpgQuality}%`;
            DOMElements.settingDownloadGap.value=appSettings.downloadGap;
            [DOMElements.settingDoubleClickPreview,DOMElements.settingRightClickMenu,DOMElements.settingDirectDownloads,DOMElements.settingExplorerSelection].forEach(c=>{ c.disabled=!appSettings.newFeatures; c.closest('.setting-row').style.opacity=appSettings.newFeatures?'1':'0.5'; });
        }
        function openSettings() { syncSettingsUI(); DOMElements.settingsModal.classList.add('show'); hideContextMenu(); }
        function closeSettings() { DOMElements.settingsModal.classList.remove('show'); }
        function openGuide() { DOMElements.guideModal.classList.add('show'); closeSettings(); hideContextMenu(); }
        function closeGuide() { DOMElements.guideModal.classList.remove('show'); }
        function resetSettings() { appSettings={...defaultSettings}; saveSettings(); syncSettingsUI(); applyTheme(appSettings.theme); }

        // ===== CONTEXT MENU =====
        const contextIcons = {
            eye:'<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
            check:'<svg viewBox="0 0 24 24"><path d="m20 6-11 11-5-5"/></svg>',
            file:'<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>',
            image:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="m21 15-5-5L5 19"/></svg>',
            up:'<svg viewBox="0 0 24 24"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>',
            down:'<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>',
            trash:'<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>',
        };
        function menuIcon(n) { return `<span class="context-menu-icon">${contextIcons[n]}</span>`; }
        function escapeHtml(v) { return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

        function openItemContextMenu(e, index) {
            const item=uploadedItems[index]; if(!item) return;
            const {itemContextMenu}=DOMElements;
            const selLabel=selectedItems.has(item.id)?'Unselect':'Select';
            const iLabel=item.type==='pdf-page'?`PDF Page ${item.originalPageNum}`:item.type==='pdf-file'?`PDF • ${item.pageCount} pages`:'Image';
            itemContextMenu.innerHTML=`<div class="context-menu-header"><div class="context-menu-title">${escapeHtml(item.sourceFileName)}</div><div class="context-menu-subtitle">${iLabel} • #${index+1}</div></div>
                <div class="context-download-grid"><button class="context-download-btn" onclick="downloadSingleItemAs('${item.id}','pdf')">${menuIcon('file')}<span>PDF</span></button><button class="context-download-btn" onclick="downloadSingleItemAs('${item.id}','png')">${menuIcon('image')}<span>PNG</span></button><button class="context-download-btn" onclick="downloadSingleItemAs('${item.id}','jpg')">${menuIcon('image')}<span>JPG</span></button></div>
                <div class="context-divider"></div>
                <button class="context-menu-item" onclick="showPreview(${index});hideContextMenu();">${menuIcon('eye')}<span>Preview</span></button>
                <button class="context-menu-item" onclick="setItemSelected('${item.id}',${!selectedItems.has(item.id)});hideContextMenu();">${menuIcon('check')}<span>${selLabel}</span></button>
                <button class="context-menu-item" onclick="moveItemToEdge('${item.id}','first');hideContextMenu();">${menuIcon('up')}<span>Move First</span></button>
                <button class="context-menu-item" onclick="moveItemToEdge('${item.id}','last');hideContextMenu();">${menuIcon('down')}<span>Move Last</span></button>
                <div class="context-divider"></div>
                <button class="context-menu-item danger" onclick="removeItem('${item.id}');hideContextMenu();">${menuIcon('trash')}<span>Remove</span></button>`;
            itemContextMenu.classList.add('show');
            const mr=itemContextMenu.getBoundingClientRect();
            const ml=Math.min(e.pageX+8,window.scrollX+window.innerWidth-mr.width-12);
            const mt=Math.min(e.pageY+8,window.scrollY+window.innerHeight-mr.height-12);
            itemContextMenu.style.left=`${Math.max(window.scrollX+12,ml)}px`;
            itemContextMenu.style.top=`${Math.max(window.scrollY+12,mt)}px`;
        }
        function hideContextMenu() { DOMElements.itemContextMenu.classList.remove('show'); }

        function sanitizePdfFileName(n) { const c=String(n||'').replace(/\.pdf$/i,'').replace(/[<>:"/\\|?*\x00-\x1F]/g,'-').replace(/\s+/g,' ').trim(); return c||'merged-pdf'; }
        function openMergeRenamePopover(e) {
            e.preventDefault(); if(selectedItems.size===0){showError('Select items to merge.');return;}
            hideContextMenu();const{mergeRenamePopover,mergeFileNameInput}=DOMElements;
            mergeFileNameInput.value=`merged-${selectedItems.size}-items`;
            mergeRenamePopover.classList.add('show');
            const pr=mergeRenamePopover.getBoundingClientRect();
            mergeRenamePopover.style.left=`${Math.max(12,Math.min(e.pageX+8,window.scrollX+window.innerWidth-pr.width-12))}px`;
            mergeRenamePopover.style.top=`${Math.max(12,Math.min(e.pageY+8,window.scrollY+window.innerHeight-pr.height-12))}px`;
            setTimeout(()=>{mergeFileNameInput.focus();mergeFileNameInput.select();},0);
        }
        function closeMergeRenamePopover() { DOMElements.mergeRenamePopover.classList.remove('show'); }
        async function mergeWithCustomName() { const n=sanitizePdfFileName(DOMElements.mergeFileNameInput.value); closeMergeRenamePopover(); await mergeSelectedItems(n); }
        function setItemSelected(id,sel) { toggleItemSelection(id,sel); }
        function removeItem(id) { uploadedItems=uploadedItems.filter(i=>i.id!==id); selectedItems.delete(id); focusedIndex=Math.min(focusedIndex,uploadedItems.length-1); if(focusedIndex<0&&uploadedItems.length>0)focusedIndex=0; selectionAnchorIndex=focusedIndex; renderGridItems(); }
        function removeItemsBySelection(mode) {
            if(!uploadedItems.length) return showError('No items to remove.');
            const fn=mode==='selected'?i=>selectedItems.has(i.id):i=>!selectedItems.has(i.id);
            if(!uploadedItems.filter(fn).length) return showError('No matching items.');
            uploadedItems=uploadedItems.filter(i=>!fn(i));
            selectedItems=new Set([...selectedItems].filter(id=>uploadedItems.some(i=>i.id===id)));
            focusedIndex=Math.min(focusedIndex,uploadedItems.length-1); if(focusedIndex<0&&uploadedItems.length>0)focusedIndex=0;
            selectionAnchorIndex=focusedIndex; hideContextMenu(); renderGridItems(); showError(null);
        }
        function moveItemToEdge(id,edge) { const i=uploadedItems.findIndex(x=>x.id===id); if(i===-1) return; const[item]=uploadedItems.splice(i,1); edge==='first'?uploadedItems.unshift(item):uploadedItems.push(item); renderGridItems(); }

        // ===== PREVIEW =====
        function showPreview(si) {
            currentPreviewIndex=si;
            const{previewModal,previewSlider}=DOMElements;
            previewSlider.innerHTML='';
            uploadedItems.forEach((item,i)=>{
                const c=document.createElement('div');c.className='preview-image-container';c.dataset.index=i;
                c.innerHTML=`<img src="${item.dataUrl}" class="preview-image" alt="Preview" loading="lazy">`;
                previewSlider.appendChild(c);
            });
            updatePreviewSlider(); previewModal.classList.add('show');
        }
        function closePreview() { DOMElements.previewModal.classList.remove('show'); currentPreviewIndex=-1; }
        function showNextItem() { if(currentPreviewIndex<uploadedItems.length-1){currentPreviewIndex++;updatePreviewSlider();} }
        function showPreviousItem() { if(currentPreviewIndex>0){currentPreviewIndex--;updatePreviewSlider();} }
        function updatePreviewSlider() {
            document.querySelectorAll('.preview-image-container').forEach((c,i)=>{
                c.classList.remove('active','prev','next');
                c.classList.add(i===currentPreviewIndex?'active':i<currentPreviewIndex?'prev':'next');
            });
            const ci=uploadedItems[currentPreviewIndex];
            DOMElements.previewTitle.textContent=ci.type==='pdf-page'?`${currentPreviewIndex+1}/${uploadedItems.length} — Page ${ci.originalPageNum} from ${ci.sourceFileName}`
                :ci.type==='pdf-file'?`${currentPreviewIndex+1}/${uploadedItems.length} — PDF (${ci.pageCount}p) ${ci.sourceFileName}`
                :`${currentPreviewIndex+1}/${uploadedItems.length} — ${ci.sourceFileName}`;
        }

        // ===== DOWNLOAD / MERGE =====
        function canvasToBlob(c,m,q) { return new Promise((r,j)=>{ c.toBlob(b=>b?r(b):j(new Error('Blob fail')),m,q); }); }
        async function addImageAsExactPdfPage(doc,item) {
            const blob=await canvasToBlob(item.canvas,'image/png');
            const bytes=await blob.arrayBuffer();
            const img=await doc.embedPng(bytes);
            if(appSettings.imagePdfMode==='a4'){const p=doc.addPage([595.28,841.89]);const{width,height}=img.scaleToFit(p.getWidth(),p.getHeight());p.drawImage(img,{x:p.getWidth()/2-width/2,y:p.getHeight()/2-height/2,width,height});return p;}
            const p=doc.addPage([img.width,img.height]);p.drawImage(img,{x:0,y:0,width:img.width,height:img.height});return p;
        }
        function getItemBaseFileName(item) { const i=uploadedItems.findIndex(x=>x.id===item.id); return `${String(i+1).padStart(3,'0')}-${item.sourceFileName.replace(/(\\.pdf|\\.png|\\.jpg|\\.jpeg)$/i,'')}`; }
        async function createPdfBytesForItem(item,cache=new Map()) {
            const doc=await PDFLib.PDFDocument.create();
            if(item.type==='pdf-page'){let s=cache.get(item.sourceFileName);if(!s){s=await PDFLib.PDFDocument.load(item.sourcePdfBytes);cache.set(item.sourceFileName,s);}const[cp]=await doc.copyPages(s,[item.originalPageNum-1]);doc.addPage(cp);}
            else if(item.type==='pdf-file'){let s=cache.get(item.sourceFileName);if(!s){s=await PDFLib.PDFDocument.load(item.sourcePdfBytes);cache.set(item.sourceFileName,s);}(await doc.copyPages(s,s.getPageIndices())).forEach(p=>doc.addPage(p));}
            else await addImageAsExactPdfPage(doc,item);
            return doc.save();
        }
        async function downloadItemAs(item,fmt,cache=new Map()) {
            const fn=getItemBaseFileName(item);
            if(fmt==='pdf'){downloadFile(await createPdfBytesForItem(item,cache),`${fn}.pdf`,'application/pdf');return;}
            // Use getFullCanvas for high quality — thumbnails are tiny 0.3x scale
            const fullCanvas = await getFullCanvas(item);
            const mt=`image/${fmt}`;const q=fmt==='jpg'?appSettings.jpgQuality/100:undefined;
            downloadFile(await new Promise(r=>fullCanvas.toBlob(r,mt,q)),`${fn}.${fmt}`,mt);
        }
        async function downloadSingleItemAs(id,fmt) { const item=uploadedItems.find(i=>i.id===id);if(!item)return; DOMElements.loading.classList.add('show');showError(null); try{await downloadItemAs(item,fmt);hideContextMenu();}catch(e){console.error(e);showError('Download error.');}finally{DOMElements.loading.classList.remove('show');} }

        async function mergeSelectedItems(customName=null) {
            if(!selectedItems.size) return showError('Select items to merge.');
            DOMElements.loading.classList.add('show');showError(null);
            try {
                const doc=await PDFLib.PDFDocument.create();
                const ids=uploadedItems.map(i=>i.id).filter(id=>selectedItems.has(id));
                const cache=new Map();
                for(const id of ids){
                    const item=uploadedItems.find(i=>i.id===id);
                    if(item.type==='pdf-page'){let s=cache.get(item.sourceFileName);if(!s){s=await PDFLib.PDFDocument.load(item.sourcePdfBytes);cache.set(item.sourceFileName,s);}const[cp]=await doc.copyPages(s,[item.originalPageNum-1]);doc.addPage(cp);}
                    else if(item.type==='pdf-file'){let s=cache.get(item.sourceFileName);if(!s){s=await PDFLib.PDFDocument.load(item.sourcePdfBytes);cache.set(item.sourceFileName,s);}(await doc.copyPages(s,s.getPageIndices())).forEach(p=>doc.addPage(p));}
                    else await addImageAsExactPdfPage(doc,item);
                    // yield
                    if(ids.indexOf(id)%3===2) await new Promise(r=>setTimeout(r,0));
                }
                const name=customName?`${sanitizePdfFileName(customName)}.pdf`:`merged-${ids.length}-items.pdf`;
                downloadFile(await doc.save(),name,'application/pdf');
            }catch(e){console.error(e);showError('Merge error.');}finally{DOMElements.loading.classList.remove('show');}
        }

        // ===== QUICK MERGE (Fast — low quality JPEG, all types compressed via canvas) =====
        // Helper: embed any canvas as compressed JPEG page into pdf-lib doc
        async function embedCanvasAsJpegPage(doc, canvas, quality) {
            // Full resolution — 1.0 scale keeps every pixel sharp
            const SCALE = 1.0; // no downscaling
            const oc = document.createElement('canvas');
            oc.width  = Math.max(1, Math.round(canvas.width  * SCALE));
            oc.height = Math.max(1, Math.round(canvas.height * SCALE));
            oc.getContext('2d').drawImage(canvas, 0, 0, oc.width, oc.height);
            const jpegBlob  = await canvasToBlob(oc, 'image/jpeg', quality);
            const jpegBytes = await jpegBlob.arrayBuffer();
            const jpegImg   = await doc.embedJpg(jpegBytes);
            if (appSettings.imagePdfMode === 'a4') {
                const p = doc.addPage([595.28, 841.89]);
                const {width, height} = jpegImg.scaleToFit(p.getWidth(), p.getHeight());
                p.drawImage(jpegImg, {x: p.getWidth()/2 - width/2, y: p.getHeight()/2 - height/2, width, height});
            } else {
                const p = doc.addPage([jpegImg.width, jpegImg.height]);
                p.drawImage(jpegImg, {x:0, y:0, width:jpegImg.width, height:jpegImg.height});
            }
        }

        async function quickMergeSelectedItems() {
            if(!selectedItems.size) return showError('Select items to quick merge.');
            const btn = document.getElementById('quickMergeBtn');
            if(btn) { btn.disabled=true; btn.innerHTML='⚡ Merging...'; }
            const loadingEl = DOMElements.loading;
            const loadingP  = loadingEl.querySelector('p');
            loadingEl.classList.add('show'); showError(null);

            try {
                const JPEG_Q = 1.0;   // maximum JPEG quality — crystal clear text
                const doc    = await PDFLib.PDFDocument.create();
                const ids    = uploadedItems.map(i=>i.id).filter(id=>selectedItems.has(id));
                // pdfjs cache for rendering pdf pages to canvas
                const pdfDocCache = new Map();

                for(let idx=0; idx<ids.length; idx++) {
                    const item = uploadedItems.find(i=>i.id===ids[idx]);
                    if(loadingP) loadingP.textContent = `⚡ Quick Compressing ${idx+1}/${ids.length}…`;

                    if(item.type === 'pdf-page') {
                        // Re-render PDF page at LOW scale via pdfjs, then embed as JPEG
                        let pdfJs = pdfDocCache.get(item.sourceFileName);
                        if(!pdfJs) {
                            pdfJs = await pdfjsLib.getDocument({data: item.sourcePdfBytes.slice(0)}).promise;
                            pdfDocCache.set(item.sourceFileName, pdfJs);
                        }
                        const page   = await pdfJs.getPage(item.originalPageNum);
                        const canvas = await renderPageToCanvas(page, 1.5); // high-res render
                        await embedCanvasAsJpegPage(doc, canvas, JPEG_Q);

                    } else if(item.type === 'pdf-file') {
                        // Re-render ALL pages of this PDF at low scale
                        let pdfJs = pdfDocCache.get(item.sourceFileName);
                        if(!pdfJs) {
                            pdfJs = await pdfjsLib.getDocument({data: item.sourcePdfBytes.slice(0)}).promise;
                            pdfDocCache.set(item.sourceFileName, pdfJs);
                        }
                        for(let p=1; p<=pdfJs.numPages; p++) {
                            const page   = await pdfJs.getPage(p);
                            const canvas = await renderPageToCanvas(page, 1.5); // high-res render
                            await embedCanvasAsJpegPage(doc, canvas, JPEG_Q);
                        }

                    } else {
                        // IMAGE: use existing canvas, compress to JPEG
                        await embedCanvasAsJpegPage(doc, item.canvas, JPEG_Q);
                    }

                    // Yield every 3 items to keep UI alive
                    if(idx % 3 === 2) await new Promise(r=>setTimeout(r, 0));
                }

                if(loadingP) loadingP.textContent = 'Finalizing PDF…';
                const pdfBytes = await doc.save();
                downloadFile(pdfBytes, `quick-merged-${ids.length}-items.pdf`, 'application/pdf');

            } catch(e) {
                console.error(e); showError('Quick Merge error: ' + e.message);
            } finally {
                loadingEl.classList.remove('show');
                if(loadingP) loadingP.textContent = 'Performing requested operation...';
                if(btn) { btn.disabled=false; btn.innerHTML='⚡ Quick Merge<span class="quick-badge">FAST</span>'; }
            }
        }
        async function downloadSelectedAs(fmt) {
            if(!selectedItems.size) return showError('Select items to download.');
            DOMElements.loading.classList.add('show');showError(null);
            try{
                if(!isFeatureEnabled('directDownloads')){await downloadSelectedAsZip(fmt);return;}
                const ids=uploadedItems.map(i=>i.id).filter(id=>selectedItems.has(id));
                const cache=new Map();
                for(const id of ids){await downloadItemAs(uploadedItems.find(i=>i.id===id),fmt,cache);await new Promise(r=>setTimeout(r,appSettings.downloadGap));}
            }catch(e){console.error(e);showError('Download error.');}finally{DOMElements.loading.classList.remove('show');}
        }
        async function downloadSelectedAsZip(fmt) {
            const zip=new JSZip();const cache=new Map();
            const ids=uploadedItems.map(i=>i.id).filter(id=>selectedItems.has(id));
            for(const id of ids){
                const item=uploadedItems.find(i=>i.id===id);const fn=getItemBaseFileName(item);
                if(fmt==='pdf') zip.file(`${fn}.pdf`,await createPdfBytesForItem(item,cache));
                else { const mt=`image/${fmt}`;const q=fmt==='jpg'?appSettings.jpgQuality/100:undefined;zip.file(`${fn}.${fmt}`,await new Promise(r=>item.canvas.toBlob(r,mt,q))); }
            }
            downloadFile(await zip.generateAsync({type:"blob"}),`selected-${fmt}.zip`,'application/zip');
        }
        async function downloadAllInZip() {
            if(!uploadedItems.length) return showError('No items to download.');
            DOMElements.loading.classList.add('show');showError(null);
            try{
                const zip=new JSZip();const pf=zip.folder('PDFs'),nf=zip.folder('PNGs'),jf=zip.folder('JPGs');
                const cache=new Map();
                for(let i=0;i<uploadedItems.length;i++){
                    const item=uploadedItems[i];const fn=`${String(i+1).padStart(3,'0')}-${item.sourceFileName.replace(/(\\.pdf|\\.png|\\.jpg|\\.jpeg)$/,'')}`;
                    pf.file(`${fn}.pdf`,await createPdfBytesForItem(item,cache));
                    nf.file(`${fn}.png`,await new Promise(r=>item.canvas.toBlob(r,'image/png')));
                    jf.file(`${fn}.jpg`,await new Promise(r=>item.canvas.toBlob(r,'image/jpeg',0.9)));
                    if(i%3===2) await new Promise(r=>setTimeout(r,0));
                }
                downloadFile(await zip.generateAsync({type:"blob"}),'All-Items-Export.zip','application/zip');
            }catch(e){console.error(e);showError('ZIP error.');}finally{DOMElements.loading.classList.remove('show');}
        }

        function downloadFile(data,name,mime) {
            const b=new Blob([data],{type:mime});
            const u=URL.createObjectURL(b);
            const a=document.createElement('a');
            a.href=u; a.download=name;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(()=>URL.revokeObjectURL(u),1000);
            // Show MB size toast
            if(mime==='application/pdf' || mime==='application/zip') {
                const sizeBytes = b.size;
                let sizeStr;
                if(sizeBytes >= 1024*1024) sizeStr = (sizeBytes/(1024*1024)).toFixed(2)+' MB';
                else sizeStr = (sizeBytes/1024).toFixed(1)+' KB';
                const toast = document.getElementById('mbToast');
                const toastTitle = document.getElementById('mbToastTitle');
                const toastSize = document.getElementById('mbToastSize');
                if(toast) {
                    toastTitle.textContent = `📥 ${name}`;
                    toastSize.textContent = `Size: ${sizeStr}`;
                    toast.classList.add('show');
                    clearTimeout(toast._hideTimer);
                    toast._hideTimer = setTimeout(()=>toast.classList.remove('show'), 4000);
                }
            }
        }
        function showError(msg) { const{errorMessage}=DOMElements; if(msg){errorMessage.textContent=msg;errorMessage.classList.add('show');}else errorMessage.classList.remove('show'); }
