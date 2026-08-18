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
            demoPdf: true,
            imageEditor: true,
            quickMerge: true,
            zipExport: true,
            renamePopup: true,
            jpgQuality: 90,
            downloadGap: 120,
            fastLowRes: false,
            fastCompress: false,
            fastBatch: false,
            fastNoAnim: false,
            fastNoShadow: false,
            fastNoBlur: false,
            fastNoScroll: false,
            fastNoGridAnim: false,
            fastNoDragAnim: false,
            fastLowHD: false,
            fastDisableHeavy: false,
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
            settingDemoPdf: document.getElementById('settingDemoPdf'),
            settingRenamePopup: document.getElementById('settingRenamePopup'),
            settingImageEditor: document.getElementById('settingImageEditor'),
            settingQuickMerge: document.getElementById('settingQuickMerge'),
            settingZipExport: document.getElementById('settingZipExport'),
            settingJpgQuality: document.getElementById('settingJpgQuality'),
            jpgQualityValue: document.getElementById('jpgQualityValue'),
            settingDownloadGap: document.getElementById('settingDownloadGap'),
            themeToggleBtn: document.getElementById('themeToggleBtn'),
            settingFastLowRes: document.getElementById('settingFastLowRes'),
            settingFastCompress: document.getElementById('settingFastCompress'),
            settingFastBatch: document.getElementById('settingFastBatch'),
            settingFastNoAnim: document.getElementById('settingFastNoAnim'),
            settingFastNoShadow: document.getElementById('settingFastNoShadow'),
            settingFastNoBlur: document.getElementById('settingFastNoBlur'),
            settingFastNoScroll: document.getElementById('settingFastNoScroll'),
            settingFastNoGridAnim: document.getElementById('settingFastNoGridAnim'),
            settingFastNoDragAnim: document.getElementById('settingFastNoDragAnim'),
            settingFastLowHD: document.getElementById('settingFastLowHD'),
            settingFastDisableHeavy: document.getElementById('settingFastDisableHeavy'),
            fastResetRow: document.getElementById('fastResetRow'),
        };

        // ===== FULLSCREEN =====
        function toggleFullscreen() {
            if(!document.fullscreenElement){
                (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen || document.documentElement.msRequestFullscreen)?.call(document.documentElement);
            } else {
                (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)?.call(document);
            }
        }
        function updateFullscreenIcon() {
            const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
            const btn=document.getElementById('fullscreenBtn');
            if(btn) btn.classList.toggle('is-fullscreen', isFs);
        }
        document.addEventListener('fullscreenchange', updateFullscreenIcon);
        document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);

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
            document.getElementById('demoPdfTrigger').addEventListener('click', loadColorfulDemoPdf);
            attachLongPressRename(document.querySelector('[data-merge-button]'), 'merge');
            attachLongPressRename(document.getElementById('quickMergeBtn'), 'quick');
            document.addEventListener('paste', handlePaste);
            document.addEventListener('click', handleGlobalClick);
            previewModal.addEventListener('click', (e) => { if (!e.target.closest('.preview-image') && !e.target.closest('.preview-nav') && !e.target.closest('.preview-close') && !e.target.closest('.preview-title')) closePreview(); });
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
                    // Card body: a real long press starts reordering.  A short click
                    // must never trigger the lift/drag animation.
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
                    }, 235);
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
                }, 450);

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

        async function loadColorfulDemoPdf() {
            if(!appSettings.demoPdf) return;
            try {
                const pdf=await PDFLib.PDFDocument.create();
                const bold=await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
                const regular=await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
                const themes=[
                    [[0.40,0.49,0.92],[0.09,0.64,0.72],'Welcome'],
                    [[0.95,0.34,0.45],[0.98,0.62,0.20],'Creative'],
                    [[0.10,0.66,0.48],[0.20,0.75,0.83],'Explore'],
                    [[0.47,0.30,0.76],[0.94,0.34,0.69],'Ideas'],
                    [[0.95,0.55,0.13],[0.92,0.24,0.27],'Focus'],
                    [[0.08,0.35,0.65],[0.31,0.74,0.86],'Finish']
                ];
                themes.forEach(([a,b,title],index)=>{
                    const page=pdf.addPage([595.28,841.89]);
                    page.drawRectangle({x:0,y:0,width:595.28,height:841.89,color:PDFLib.rgb(...a)});
                    page.drawCircle({x:520,y:730,size:180,color:PDFLib.rgb(...b),opacity:0.8});
                    page.drawCircle({x:65,y:105,size:120,color:PDFLib.rgb(...b),opacity:0.55});
                    page.drawRectangle({x:48,y:170,width:499,height:395,color:PDFLib.rgb(1,1,1),opacity:0.94,borderColor:PDFLib.rgb(...b),borderWidth:2});
                    page.drawText(`PDF STUDIO  /  ${String(index+1).padStart(2,'0')}`,{x:54,y:755,size:12,font:bold,color:PDFLib.rgb(1,1,1)});
                    page.drawText(title,{x:82,y:470,size:54,font:bold,color:PDFLib.rgb(...a)});
                    page.drawText('A colorful six-page demo document',{x:84,y:426,size:18,font:regular,color:PDFLib.rgb(0.18,0.22,0.34)});
                    page.drawText('Use this sample to try crop, text, filters, rotate,', {x:84,y:360,size:15,font:regular,color:PDFLib.rgb(0.30,0.34,0.45)});
                    page.drawText('selection, reordering and PDF merge.', {x:84,y:334,size:15,font:regular,color:PDFLib.rgb(0.30,0.34,0.45)});
                    page.drawRectangle({x:84,y:245,width:185,height:42,color:PDFLib.rgb(...b),borderRadius:8});
                    page.drawText(`PAGE ${index+1} OF 6`,{x:105,y:259,size:14,font:bold,color:PDFLib.rgb(1,1,1)});
                });
                const bytes=await pdf.save();
                const file=new File([bytes],'PDF-Studio-Colorful-Demo-6-Pages.pdf',{type:'application/pdf'});
                await processFiles([file]);
            } catch(err) { console.error(err); showError('Demo PDF could not be created.'); }
        }

        async function processFiles(files) {
            const { progressContainer, progressFill, progressText, controls } = DOMElements;
            showError(null);
            progressContainer.style.display = 'block';
            controls.classList.remove('active');

            // Sharp grid previews: render above the visible card size so text and
            // graphics stay clear on high-DPI desktop and mobile screens.
            // Fast Mode settings (from Settings > ⚡ Fast HTML) reduce these to fix lag/hang.
            const { THUMB_SCALE, THUMB_Q, BATCH } = getRenderSettings();

            let fileIdx = 0;
            const totalFiles = files.length;

            for (const file of files) {
                fileIdx++;
                try {
                    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
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
                    } else if (file.name.toLowerCase().endsWith('.docx')) {
                        const bytes = await file.arrayBuffer();
                        const pages = await renderWordPages(bytes);
                        pages.forEach((canvas, pageIndex) => uploadedItems.push({
                            id:uid(), type:'word-page', sourceFileName:file.name, originalPageNum:pageIndex+1,
                            canvas, dataUrl:canvas.toDataURL('image/jpeg', THUMB_Q)
                        }));
                        progressText.textContent = `✓ ${file.name} (${pages.length} preview page${pages.length===1?'':'s'})`;
                        progressFill.style.width = `${(fileIdx / totalFiles) * 100}%`;
                        renderGridItems(); controls.classList.add('active');
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
                    if ((file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) && isPasswordError(err)) {
                        const bytes = await file.arrayBuffer();
                        const canvas = makeLockedPdfCanvas(file.name);
                        uploadedItems.push({id:uid(), type:'locked-pdf', sourceFileName:file.name, sourcePdfBytes:bytes, canvas, dataUrl:canvas.toDataURL('image/jpeg', THUMB_Q), locked:true});
                        progressText.textContent = `🔒 ${file.name} needs a password — use Unlock`;
                        renderGridItems(); controls.classList.add('active');
                    } else showError(`Failed to process ${file.name}.`);
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
            if (item.type === 'image' || item.type === 'word-page') return item.canvas;
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

        function makeLockedPdfCanvas(name) {
            const c=document.createElement('canvas'); c.width=800; c.height=1040; const x=c.getContext('2d');
            x.fillStyle='#f8fafc'; x.fillRect(0,0,c.width,c.height); x.fillStyle='#e11d48'; x.fillRect(0,0,c.width,16);
            x.fillStyle='#1e293b'; x.font='bold 210px Arial'; x.textAlign='center'; x.fillText('🔒',400,470);
            x.font='bold 34px Arial'; x.fillText('PASSWORD PROTECTED PDF',400,580); x.font='24px Arial'; x.fillStyle='#64748b';
            x.fillText(name,400,640); x.fillText('Click Unlock to open this file',400,700); return c;
        }
        async function renderWordPages(bytes) {
            if(!window.docx || !window.html2canvas) throw new Error('Word preview renderer did not load. Please check your internet connection and retry.');
            const stage=document.createElement('div'); stage.className='word-render-stage'; document.body.appendChild(stage);
            try {
                await docx.renderAsync(bytes.slice(0), stage, null, {inWrapper:true, breakPages:true, ignoreWidth:false, ignoreHeight:false, useBase64URL:true, renderHeaders:true, renderFooters:true});
                await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                const pageNodes=[...stage.querySelectorAll('section.docx')];
                if(!pageNodes.length) throw new Error('No readable pages found in this Word file.');
                const canvases=[];
                for(const page of pageNodes) {
                    const canvas=await html2canvas(page,{backgroundColor:'#ffffff',scale:1.25,useCORS:true,logging:false});
                    canvases.push(canvas);
                }
                return canvases;
            } finally { stage.remove(); }
        }
        function isPasswordError(err) { return err && (err.name==='PasswordException' || /password/i.test(err.message||'')); }

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
                    : item.type === 'word-page' ? `Word page ${item.originalPageNum} (${item.sourceFileName})`
                    : item.type === 'locked-pdf' ? `🔒 Locked PDF (${item.sourceFileName})`
                    : `Image ${index+1} (${item.sourceFileName})`;
                el.innerHTML = `<div class="drag-handle" title="Drag to reorder">⋮⋮</div>
                    <input type="checkbox" class="selection-checkbox" onmousedown="event.stopPropagation();" onmouseup="event.stopPropagation();" onchange="event.stopPropagation();setSelectionFocus(${index});toggleItemSelection('${item.id}',this.checked);">
                    <img class="page-preview" src="${item.dataUrl}" alt="${title}" loading="lazy" decoding="async" draggable="false">
                    ${item.type==='word-page'?'<span class="file-kind-badge">WORD</span>':''}
                    ${item.type==='locked-pdf'?`<button class="unlock-card-btn" onclick="event.stopPropagation();openPasswordDialog('unlock','${item.id}')">🔓 Unlock</button>`:''}
                    <div class="page-title">${title}</div>`;

                // Prevent ALL text selection and native drag on page items
                el.addEventListener('selectstart', (e) => e.preventDefault());
                el.addEventListener('dragstart', (e) => e.preventDefault());

                el.addEventListener('click', (e) => {
                    if (e.target.matches('input,.drag-handle')) return;
                    if (customDragState) return; // Don't select during drag
                    if (e.ctrlKey || e.metaKey) handleExplorerSelection(index,{toggle:true});
                    else if (isFeatureEnabled('explorerSelection') && e.shiftKey) handleExplorerSelection(index,{range:true});
                    else handleExplorerSelection(index,{toggle:true});
                });
                el.addEventListener('dblclick', (e) => { if (!isFeatureEnabled('doubleClickPreview') || e.target.matches('input,.drag-handle')) return; e.preventDefault(); showPreview(index); });
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
        function applyFeatureVisibility() {
            const demoTitle=document.getElementById('demoPdfTrigger');
            const demoOn = appSettings.demoPdf && !appSettings.fastDisableHeavy;
            const editorOn = appSettings.imageEditor && !appSettings.fastDisableHeavy;
            demoTitle.classList.toggle('demo-trigger',demoOn);
            demoTitle.querySelector('.demo-badge').style.display=demoOn?'inline-block':'none';
            document.querySelector('.preview-edit-btn').style.display=editorOn?'flex':'none';
            document.getElementById('quickMergeBtn').style.display=appSettings.quickMerge?'inline-flex':'none';
            document.querySelector('.btn-zip').style.display=appSettings.zipExport?'inline-flex':'none';
            applyFastMode();
        }

        // ===== FAST MODE (Lag Fix) =====
        function applyFastMode() {
            const html = document.documentElement;
            html.classList.toggle('fast-no-anim', appSettings.fastNoAnim);
            html.classList.toggle('fast-no-shadow', appSettings.fastNoShadow);
            html.classList.toggle('fast-no-blur', appSettings.fastNoBlur);
            html.classList.toggle('fast-no-smooth-scroll', appSettings.fastNoScroll);
            html.classList.toggle('fast-no-grid-anim', appSettings.fastNoGridAnim);
            html.classList.toggle('fast-no-drag-anim', appSettings.fastNoDragAnim);
            const anyFastOn = appSettings.fastLowRes || appSettings.fastCompress || appSettings.fastBatch ||
                appSettings.fastNoAnim || appSettings.fastNoShadow || appSettings.fastNoBlur ||
                appSettings.fastNoScroll || appSettings.fastNoGridAnim || appSettings.fastNoDragAnim ||
                appSettings.fastLowHD || appSettings.fastDisableHeavy;
            if (DOMElements.fastResetRow) DOMElements.fastResetRow.classList.toggle('show', anyFastOn);
        }
        // Current render settings — reduced automatically when Fast Mode toggles are ON
        function getRenderSettings() {
            return {
                THUMB_SCALE: appSettings.fastLowRes ? 1 : 2,
                THUMB_Q: appSettings.fastCompress ? 0.55 : 1,
                BATCH: appSettings.fastBatch ? 1 : 2,
                HD_SCALE: appSettings.fastLowHD ? 1.5 : 2.5,
            };
        }

        // ===== SETTINGS =====
        function loadSettings() { try { const s=JSON.parse(localStorage.getItem('splitToolSettings')||'{}'); appSettings={...defaultSettings,...s}; } catch(e) { appSettings={...defaultSettings}; } syncSettingsUI(); applyTheme(appSettings.theme); applyFeatureVisibility(); }
        function saveSettings() { localStorage.setItem('splitToolSettings',JSON.stringify(appSettings)); }
        function bindSettingsControls() {
            const bindings=[['settingNewFeatures','newFeatures','checked'],['settingImagePdfMode','imagePdfMode','value'],['settingDoubleClickPreview','doubleClickPreview','checked'],['settingRightClickMenu','rightClickMenu','checked'],['settingDirectDownloads','directDownloads','checked'],['settingExplorerSelection','explorerSelection','checked'],['settingDemoPdf','demoPdf','checked'],['settingRenamePopup','renamePopup','checked'],['settingImageEditor','imageEditor','checked'],['settingQuickMerge','quickMerge','checked'],['settingZipExport','zipExport','checked'],['settingJpgQuality','jpgQuality','value'],['settingDownloadGap','downloadGap','value'],['settingFastLowRes','fastLowRes','checked'],['settingFastCompress','fastCompress','checked'],['settingFastBatch','fastBatch','checked'],['settingFastNoAnim','fastNoAnim','checked'],['settingFastNoShadow','fastNoShadow','checked'],['settingFastNoBlur','fastNoBlur','checked'],['settingFastNoScroll','fastNoScroll','checked'],['settingFastNoGridAnim','fastNoGridAnim','checked'],['settingFastNoDragAnim','fastNoDragAnim','checked'],['settingFastLowHD','fastLowHD','checked'],['settingFastDisableHeavy','fastDisableHeavy','checked']];
            bindings.forEach(([ek,sk,prop])=>{ DOMElements[ek].addEventListener('input',()=>{ const v=prop==='checked'?DOMElements[ek].checked:DOMElements[ek].value; appSettings[sk]=['jpgQuality','downloadGap'].includes(sk)?Number(v):v; syncSettingsUI(); applyFeatureVisibility(); saveSettings(); }); });
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
            DOMElements.settingDemoPdf.checked=appSettings.demoPdf;
            DOMElements.settingRenamePopup.checked=appSettings.renamePopup;
            DOMElements.settingImageEditor.checked=appSettings.imageEditor;
            DOMElements.settingQuickMerge.checked=appSettings.quickMerge;
            DOMElements.settingZipExport.checked=appSettings.zipExport;
            DOMElements.settingJpgQuality.value=appSettings.jpgQuality;
            DOMElements.jpgQualityValue.textContent=`${appSettings.jpgQuality}%`;
            DOMElements.settingDownloadGap.value=appSettings.downloadGap;
            [DOMElements.settingDoubleClickPreview,DOMElements.settingRightClickMenu,DOMElements.settingDirectDownloads,DOMElements.settingExplorerSelection].forEach(c=>{ c.disabled=!appSettings.newFeatures; c.closest('.setting-row').style.opacity=appSettings.newFeatures?'1':'0.5'; });
            DOMElements.settingFastLowRes.checked=appSettings.fastLowRes;
            DOMElements.settingFastCompress.checked=appSettings.fastCompress;
            DOMElements.settingFastBatch.checked=appSettings.fastBatch;
            DOMElements.settingFastNoAnim.checked=appSettings.fastNoAnim;
            DOMElements.settingFastNoShadow.checked=appSettings.fastNoShadow;
            DOMElements.settingFastNoBlur.checked=appSettings.fastNoBlur;
            DOMElements.settingFastNoScroll.checked=appSettings.fastNoScroll;
            DOMElements.settingFastNoGridAnim.checked=appSettings.fastNoGridAnim;
            DOMElements.settingFastNoDragAnim.checked=appSettings.fastNoDragAnim;
            DOMElements.settingFastLowHD.checked=appSettings.fastLowHD;
            DOMElements.settingFastDisableHeavy.checked=appSettings.fastDisableHeavy;
        }
        function openSettings() { syncSettingsUI(); DOMElements.settingsModal.classList.add('show'); hideContextMenu(); }
        function closeSettings() { DOMElements.settingsModal.classList.remove('show'); }
        function openGuide() { DOMElements.guideModal.classList.add('show'); closeSettings(); hideContextMenu(); }
        function closeGuide() { DOMElements.guideModal.classList.remove('show'); }
        function resetSettings() { appSettings={...defaultSettings}; saveSettings(); syncSettingsUI(); applyTheme(appSettings.theme); applyFeatureVisibility(); }
        function restoreDefaultSettings() {
            if(!confirm('Saari settings default par reset ho jaayengi. Continue?')) return;
            appSettings={...defaultSettings};
            saveSettings();
            location.reload();
        }

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

        let activeRenameMode = 'merge';
        function sanitizePdfFileName(n) { const c=String(n||'').replace(/\.pdf$/i,'').replace(/[<>:"/\\|?*\x00-\x1F]/g,'-').replace(/\s+/g,' ').trim(); return c||'merged-pdf'; }
        function openRenamePopover(e, mode) {
            if(!appSettings.renamePopup) return;
            e.preventDefault(); if(selectedItems.size===0){showError('Select items to merge.');return;}
            hideContextMenu();
            activeRenameMode = mode || 'merge';
            const{mergeRenamePopover,mergeFileNameInput}=DOMElements;
            const ids = uploadedItems.map(i=>i.id).filter(id=>selectedItems.has(id));
            mergeFileNameInput.value = getGroupDefaultName(ids);
            const titleEl = mergeRenamePopover.querySelector('.rename-title span:last-child');
            if(titleEl) titleEl.textContent = activeRenameMode==='quick' ? 'Rename quick merge' : 'Rename merged PDF';
            mergeRenamePopover.classList.add('show');
            const px = e.pageX ?? (e.touches && e.touches[0] && e.touches[0].pageX) ?? window.scrollX+window.innerWidth/2;
            const py = e.pageY ?? (e.touches && e.touches[0] && e.touches[0].pageY) ?? window.scrollY+window.innerHeight/2;
            const pr=mergeRenamePopover.getBoundingClientRect();
            mergeRenamePopover.style.left=`${Math.max(12,Math.min(px+8,window.scrollX+window.innerWidth-pr.width-12))}px`;
            mergeRenamePopover.style.top=`${Math.max(12,Math.min(py+8,window.scrollY+window.innerHeight-pr.height-12))}px`;
            setTimeout(()=>{mergeFileNameInput.focus();mergeFileNameInput.select();},0);
        }
        function openMergeRenamePopover(e) { openRenamePopover(e, 'merge'); }
        function closeMergeRenamePopover() { DOMElements.mergeRenamePopover.classList.remove('show'); }
        async function mergeWithCustomName() {
            const n=sanitizePdfFileName(DOMElements.mergeFileNameInput.value);
            const mode = activeRenameMode;
            closeMergeRenamePopover();
            if(mode==='quick') await quickMergeSelectedItems(n);
            else await mergeSelectedItems(n);
        }
        // Long-press support (mobile) — opens the rename popover on Merge / Quick Merge buttons
        function attachLongPressRename(el, mode) {
            if(!el) return;
            let timer=null, moved=false, startX=0, startY=0, fired=false;
            el.addEventListener('touchstart', (e)=>{
                if(!appSettings.renamePopup) return;
                moved=false; fired=false;
                const t=e.touches[0]; startX=t.clientX; startY=t.clientY;
                timer=setTimeout(()=>{
                    if(!moved && selectedItems.size){
                        fired=true;
                        if(navigator.vibrate) navigator.vibrate(15);
                        openRenamePopover({pageX:t.clientX,pageY:t.clientY}, mode);
                    }
                }, 500);
            }, {passive:true});
            el.addEventListener('touchmove', (e)=>{
                const t=e.touches[0];
                if(Math.abs(t.clientX-startX)>10||Math.abs(t.clientY-startY)>10){ moved=true; clearTimeout(timer); }
            }, {passive:true});
            el.addEventListener('touchend', ()=>{ clearTimeout(timer); }, {passive:true});
            el.addEventListener('touchcancel', ()=>{ clearTimeout(timer); }, {passive:true});
            el.addEventListener('click', (e)=>{ if(fired){ e.preventDefault(); e.stopPropagation(); fired=false; } }, true);
        }
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
        // Cache for HD data URLs so re-opening is instant
        const hdCache = new Map();
        async function getHDDataUrl(item) {
            if (hdCache.has(item.id)) return hdCache.get(item.id);
            let hdDataUrl;
            if (item.type === 'image' || item.type === 'word-page') {
                hdDataUrl = item.dataUrl;
            } else {
                const pdfDoc = await pdfjsLib.getDocument({ data: item.sourcePdfBytes.slice(0) }).promise;
                const pageNum = item.type === 'pdf-page' ? item.originalPageNum : 1;
                const page = await pdfDoc.getPage(pageNum);
                const hdCanvas = await renderPageToCanvas(page, getRenderSettings().HD_SCALE);
                hdDataUrl = hdCanvas.toDataURL('image/png');
            }
            hdCache.set(item.id, hdDataUrl);
            return hdDataUrl;
        }
        async function showPreview(si) {
            if(uploadedItems[si]?.type==='locked-pdf') { openPasswordDialog('unlock',uploadedItems[si].id); return; }
            currentPreviewIndex=si;
            const{previewModal,previewSlider}=DOMElements;
            previewSlider.innerHTML='';
            // Pre-load HD for current item before showing
            const currentHD = await getHDDataUrl(uploadedItems[si]);
            uploadedItems.forEach((item,i)=>{
                const c=document.createElement('div');c.className='preview-image-container';c.dataset.index=i;
                const src = (i === si) ? currentHD : item.dataUrl;
                c.innerHTML=`<img src="${src}" class="preview-image" alt="Preview" loading="lazy">`;
                previewSlider.appendChild(c);
            });
            updatePreviewSlider(); previewModal.classList.add('show');
        }
        function closePreview() { DOMElements.previewModal.classList.remove('show'); currentPreviewIndex=-1; }
        async function showNextItem() { if(currentPreviewIndex<uploadedItems.length-1){currentPreviewIndex++;const hd=await getHDDataUrl(uploadedItems[currentPreviewIndex]);const c=document.querySelector(`.preview-image-container[data-index="${currentPreviewIndex}"] .preview-image`);if(c)c.src=hd;updatePreviewSlider();} }
        async function showPreviousItem() { if(currentPreviewIndex>0){currentPreviewIndex--;const hd=await getHDDataUrl(uploadedItems[currentPreviewIndex]);const c=document.querySelector(`.preview-image-container[data-index="${currentPreviewIndex}"] .preview-image`);if(c)c.src=hd;updatePreviewSlider();} }
        function updatePreviewSlider() {
            document.querySelectorAll('.preview-image-container').forEach((c,i)=>{
                c.classList.remove('active','prev','next');
                c.classList.add(i===currentPreviewIndex?'active':i<currentPreviewIndex?'prev':'next');
            });
            const ci=uploadedItems[currentPreviewIndex];
            DOMElements.previewTitle.textContent=ci.type==='pdf-page'?`${currentPreviewIndex+1}/${uploadedItems.length} — Page ${ci.originalPageNum} from ${ci.sourceFileName}`
                :ci.type==='pdf-file'?`${currentPreviewIndex+1}/${uploadedItems.length} — PDF (${ci.pageCount}p) ${ci.sourceFileName}`
                :ci.type==='word-page'?`${currentPreviewIndex+1}/${uploadedItems.length} — Word page ${ci.originalPageNum} ${ci.sourceFileName}`
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
        function getItemBaseFileName(item) {
            const source=String(item.sourceFileName||'document').replace(/(\.pdf|\.docx|\.png|\.jpg|\.jpeg)$/i,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'document';
            if(item.type==='pdf-page') return `${source}-${item.originalPageNum}`;
            return source;
        }
        function getGroupDefaultName(ids) {
            const items = ids.map(id=>uploadedItems.find(i=>i.id===id)).filter(Boolean);
            if(!items.length) return 'Merged';
            const sources = new Set(items.map(i=>String(i.sourceFileName||'document').replace(/(\.pdf|\.png|\.jpg|\.jpeg)$/i,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'document'));
            if(sources.size===1) return [...sources][0];
            return `Merged-${items.length}-Files`;
        }
        async function createPdfBytesForItem(item,cache=new Map()) {
            const doc=await PDFLib.PDFDocument.create();
            if(item.type==='pdf-page'){let s=cache.get(item.sourceFileName);if(!s){s=await PDFLib.PDFDocument.load(item.sourcePdfBytes);cache.set(item.sourceFileName,s);}const[cp]=await doc.copyPages(s,[item.originalPageNum-1]);doc.addPage(cp);}
            else if(item.type==='pdf-file'){let s=cache.get(item.sourceFileName);if(!s){s=await PDFLib.PDFDocument.load(item.sourcePdfBytes);cache.set(item.sourceFileName,s);}(await doc.copyPages(s,s.getPageIndices())).forEach(p=>doc.addPage(p));}
            else await addImageAsExactPdfPage(doc,item);
            return doc.save();
        }

        let passwordDialogState = null;
        function cleanPdfName(name) { return (String(name||'merged-file').trim().replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'-') || 'merged-file'); }
        function openLockFromRename() { closeMergeRenamePopover(); openPasswordDialog('lock'); }
        function openPasswordDialog(mode, itemId=null) {
            passwordDialogState={mode,itemId};
            const modal=document.getElementById('passwordModal'), title=document.getElementById('passwordModalTitle'), text=document.getElementById('passwordModalText'), name=document.getElementById('passwordFileName'), nameLabel=document.getElementById('passwordNameLabel'), confirm=document.getElementById('passwordConfirmBtn'), pass=document.getElementById('passwordInput');
            const item=itemId && uploadedItems.find(x=>x.id===itemId);
            const unlocking=mode==='unlock'; title.textContent=unlocking?'🔓 Unlock PDF':'🔒 Lock merged PDF'; text.textContent=unlocking?'Enter this PDF password to load its pages.':'Set a password for your merged PDF. Default password is 123.';
            nameLabel.style.display=unlocking?'none':'block'; name.style.display=unlocking?'none':'block'; name.value=unlocking?'':getGroupDefaultName(uploadedItems.map(i=>i.id).filter(id=>selectedItems.has(id))); confirm.textContent=unlocking?'Unlock':'Lock & Download'; pass.value=unlocking?'':'123'; pass.autocomplete=unlocking?'current-password':'new-password'; modal.classList.add('show'); setTimeout(()=>pass.focus(),0);
        }
        function closePasswordDialog() { document.getElementById('passwordModal').classList.remove('show'); passwordDialogState=null; }
        async function confirmPasswordDialog() {
            const state=passwordDialogState; if(!state) return; const password=document.getElementById('passwordInput').value;
            if(!password) return showError('Please enter a password.');
            if(state.mode==='unlock') await unlockProtectedPdf(state.itemId,password); else await lockSelectedItems(password,document.getElementById('passwordFileName').value);
        }
        async function unlockProtectedPdf(id,password) {
            const item=uploadedItems.find(x=>x.id===id); if(!item) return; DOMElements.loading.classList.add('show');
            try { const pdfDoc=await pdfjsLib.getDocument({data:item.sourcePdfBytes.slice(0),password}).promise; const {THUMB_SCALE,THUMB_Q}=getRenderSettings(); const fresh=[];
                if(!DOMElements.splitPdfPages.checked){const canvas=await renderPageToCanvas(await pdfDoc.getPage(1),THUMB_SCALE);fresh.push({id:uid(),type:'pdf-file',sourceFileName:item.sourceFileName,pageCount:pdfDoc.numPages,canvas,dataUrl:canvas.toDataURL('image/jpeg',THUMB_Q),sourcePdfBytes:item.sourcePdfBytes});}
                else for(let n=1;n<=pdfDoc.numPages;n++){const canvas=await renderPageToCanvas(await pdfDoc.getPage(n),THUMB_SCALE);fresh.push({id:uid(),type:'pdf-page',sourceFileName:item.sourceFileName,originalPageNum:n,canvas,dataUrl:canvas.toDataURL('image/jpeg',THUMB_Q),sourcePdfBytes:item.sourcePdfBytes});}
                uploadedItems.splice(uploadedItems.findIndex(x=>x.id===id),1,...fresh); closePasswordDialog(); renderGridItems(); showError(null);
            } catch(err) { showError(isPasswordError(err)?'Wrong password. Please try again.':'Unable to unlock this PDF.'); }
            finally { DOMElements.loading.classList.remove('show'); }
        }
        async function lockSelectedItems(password,fileName) {
            if(!selectedItems.size) return showError('Select pages or files to lock.'); DOMElements.loading.classList.add('show');
            try { const ids=uploadedItems.map(i=>i.id).filter(id=>selectedItems.has(id)); if(ids.some(id=>uploadedItems.find(i=>i.id===id).type==='locked-pdf')) throw new Error('Unlock protected PDFs before merging.');
                const {jsPDF}=window.jspdf; let pdf=null;
                for(const id of ids){const item=uploadedItems.find(i=>i.id===id);const lockedPage=await getLockQualityPage(item);const {canvas,w,h}=lockedPage; if(!pdf) pdf=new jsPDF({unit:'pt',format:[w,h],encryption:{userPassword:password,ownerPassword:password,userPermissions:['print']}}); else pdf.addPage([w,h]); pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,w,h,undefined,'NONE');}
                downloadFile(pdf.output('arraybuffer'),`${cleanPdfName(fileName)}.pdf`,'application/pdf'); closePasswordDialog();
            } catch(err) { console.error(err); showError(err.message||'Could not lock the PDF.'); }
            finally { DOMElements.loading.classList.remove('show'); }
        }
        async function getLockQualityPage(item) {
            // PDF pages stay at their real physical page size, but render at 2.5x before
            // lossless PNG embedding. This prevents the blurry, JPEG-compressed lock export.
            if(item.type==='pdf-page' || item.type==='pdf-file') {
                const pdfDoc=await pdfjsLib.getDocument({data:item.sourcePdfBytes.slice(0)}).promise;
                const page=await pdfDoc.getPage(item.type==='pdf-page'?item.originalPageNum:1);
                const base=page.getViewport({scale:1});
                return {canvas:await renderPageToCanvas(page,2.5),w:base.width,h:base.height};
            }
            const canvas=await getFullCanvas(item);
            return {canvas,w:canvas.width,h:canvas.height};
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
                const name=customName?`${sanitizePdfFileName(customName)}.pdf`:`${getGroupDefaultName(ids)}.pdf`;
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

        async function quickMergeSelectedItems(customName=null) {
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
                const name=customName?`${sanitizePdfFileName(customName)}.pdf`:`${getGroupDefaultName(ids)}.pdf`;
                downloadFile(pdfBytes, name, 'application/pdf');

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
                    const item=uploadedItems[i];const fn=getItemBaseFileName(item);
                    pf.file(`${fn}.pdf`,await createPdfBytesForItem(item,cache));
                    nf.file(`${fn}.png`,await new Promise(r=>item.canvas.toBlob(r,'image/png')));
                    jf.file(`${fn}.jpg`,await new Promise(r=>item.canvas.toBlob(r,'image/jpeg',0.9)));
                    if(i%3===2) await new Promise(r=>setTimeout(r,0));
                }
                downloadFile(await zip.generateAsync({type:"blob"}),'PDF-Studio-All-Files.zip','application/zip');
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

        // ===== IMAGE EDITOR =====
        const editor = {
            overlay: null, canvas: null, ctx: null, wrap: null,
            currentTool: 'draw', color: '#ff3b3b', strokeWidth: 3,
            isDrawing: false, startX: 0, startY: 0,
            history: [], redoStack: [], editingItemIndex: -1,
            textBoxes: [], activeTextBox: null, scaleX: 1, scaleY: 1
        };
        let drawSnap = null;
        let strokePoints = [];
        let cropSelectDraw = { ox:0, oy:0, startX:0, startY:0 };

        function initEditor() {
            editor.overlay = document.getElementById('editorOverlay');
            editor.canvas = document.getElementById('editorCanvas');
            editor.ctx = editor.canvas.getContext('2d');
            editor.wrap = document.getElementById('editorCanvasWrap');
            const c = editor.canvas;
            c.addEventListener('mousedown', eDown);
            c.addEventListener('mousemove', eMove);
            c.addEventListener('mouseup', eUp);
            c.addEventListener('mouseleave', eUp);
            c.addEventListener('touchstart', (e)=>{e.preventDefault();eDown(e.touches[0]);},{passive:false});
            c.addEventListener('touchmove', (e)=>{e.preventDefault();eMove(e.touches[0]);},{passive:false});
            c.addEventListener('touchend', ()=>eUp(null));
            document.getElementById('editorStroke').addEventListener('input', e=>{
                editor.strokeWidth=+e.target.value;
                document.getElementById('editorStrokeLabel').textContent=e.target.value;
            });
            document.getElementById('editorColor').addEventListener('input', e=>editor.color=e.target.value);
            initCropHandles();
        }

        function ePos(e) {
            if(!e) return {x:editor.startX,y:editor.startY};
            const r=editor.canvas.getBoundingClientRect();
            editor.scaleX=editor.canvas.width/r.width;
            editor.scaleY=editor.canvas.height/r.height;
            return {x:(e.clientX-r.left)*editor.scaleX, y:(e.clientY-r.top)*editor.scaleY};
        }
        function eDown(e){const p=ePos(e);editorStart(p);}
        function eMove(e){if(!editor.isDrawing)return;editorMove(ePos(e));}
        function eUp(e){if(!editor.isDrawing)return;editorEnd(ePos(e));}

        function editorStart(p) {
            if(editor.currentTool==='text'){createTextBox(p);return;}
            if(editor.currentTool==='crop'){return;}
            if(editor.currentTool==='cropSelect'){
                editor.isDrawing=true;
                const r=editor.canvas.getBoundingClientRect();
                const wr=editor.wrap.getBoundingClientRect();
                const ox=r.left-wr.left, oy=r.top-wr.top;
                cropSelectDraw.ox=ox; cropSelectDraw.oy=oy;
                cropSelectDraw.startX = p.x/editor.scaleX + ox;
                cropSelectDraw.startY = p.y/editor.scaleY + oy;
                cropState.x=cropSelectDraw.startX; cropState.y=cropSelectDraw.startY; cropState.w=0; cropState.h=0;
                document.getElementById('cropUI').classList.add('show');
                document.getElementById('cropBorder').classList.add('drawing');
                updateCropBorder();
                return;
            }
            editor.isDrawing=true; editor.startX=p.x; editor.startY=p.y;
            const ctx=editor.ctx;
            if(editor.currentTool==='draw'||editor.currentTool==='eraser'){
                strokePoints = [p];
                ctx.beginPath(); ctx.moveTo(p.x,p.y);
                ctx.strokeStyle= editor.currentTool==='eraser'?'rgba(0,0,0,1)':editor.color;
                ctx.lineWidth=(editor.currentTool==='eraser'?editor.strokeWidth*3:editor.strokeWidth)*editor.scaleX;
                ctx.lineCap='round'; ctx.lineJoin='round';
                ctx.globalCompositeOperation=editor.currentTool==='eraser'?'destination-out':'source-over';
            } else {
                drawSnap=ctx.getImageData(0,0,editor.canvas.width,editor.canvas.height);
            }
        }
        function editorMove(p) {
            const ctx=editor.ctx;
            if(editor.currentTool==='cropSelect'){
                const curX = p.x/editor.scaleX + cropSelectDraw.ox;
                const curY = p.y/editor.scaleY + cropSelectDraw.oy;
                cropState.x = Math.min(cropSelectDraw.startX, curX);
                cropState.y = Math.min(cropSelectDraw.startY, curY);
                cropState.w = Math.abs(curX - cropSelectDraw.startX);
                cropState.h = Math.abs(curY - cropSelectDraw.startY);
                updateCropBorder();
                return;
            }
            if(editor.currentTool==='draw'||editor.currentTool==='eraser'){
                strokePoints.push(p);
                ctx.strokeStyle= editor.currentTool==='eraser'?'rgba(0,0,0,1)':editor.color;
                ctx.lineWidth=(editor.currentTool==='eraser'?editor.strokeWidth*3:editor.strokeWidth)*editor.scaleX;
                ctx.lineCap='round'; ctx.lineJoin='round';
                ctx.globalCompositeOperation=editor.currentTool==='eraser'?'destination-out':'source-over';
                
                if (strokePoints.length > 2) {
                    const lastThree = strokePoints.slice(-3);
                    const p0 = lastThree[0];
                    const p1 = lastThree[1];
                    const p2 = lastThree[2];
                    const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
                    const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                    ctx.beginPath();
                    ctx.moveTo(mid1.x, mid1.y);
                    ctx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.moveTo(strokePoints[0].x, strokePoints[0].y);
                    ctx.lineTo(p.x, p.y);
                    ctx.stroke();
                }
            } else if(editor.currentTool==='rect'||editor.currentTool==='circle'){
                if(drawSnap) ctx.putImageData(drawSnap,0,0);
                const x=Math.min(editor.startX,p.x),y=Math.min(editor.startY,p.y);
                const w=Math.abs(p.x-editor.startX),h=Math.abs(p.y-editor.startY);
                ctx.strokeStyle=editor.color; ctx.lineWidth=editor.strokeWidth*editor.scaleX;
                ctx.globalCompositeOperation='source-over';
                if(editor.currentTool==='rect'){ ctx.strokeRect(x,y,w,h); }
                else { ctx.beginPath(); ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2); ctx.stroke(); }
            }
        }
        function editorEnd(p) {
            if(!editor.isDrawing) return;
            editor.isDrawing=false;
            if(editor.currentTool==='cropSelect'){
                document.getElementById('cropBorder').classList.remove('drawing');
                if(cropState.w<24||cropState.h<24){ showCropUI(); }
                cropState.active=true; cropState.dragging=null;
                editor.currentTool='crop';
                document.querySelectorAll('.editor-toolbar .tool-btn[id^="tool"]').forEach(b=>b.classList.remove('active'));
                const btn=document.getElementById('toolCrop'); if(btn) btn.classList.add('active');
                editor.canvas.style.cursor='default';
                return;
            }
            editor.ctx.globalCompositeOperation='source-over';
            drawSnap=null; strokePoints=[]; pushHistory();
        }

        // ===== CROP TOOL (Constrained Professional Dragging) =====
        let cropState = { active:false, x:0, y:0, w:0, h:0, dragging:null, dragStart:null };

        function initCropHandles() {
            const border = document.getElementById('cropBorder');
            const handles = border.querySelectorAll('.crop-handle');
            handles.forEach(h => {
                h.addEventListener('mousedown', e=>{e.stopPropagation();startCropDrag(h.dataset.handle,e);});
                h.addEventListener('touchstart', e=>{e.stopPropagation();e.preventDefault();startCropDrag(h.dataset.handle,e.touches[0]);},{passive:false});
            });
            border.addEventListener('mousedown', e=>{if(e.target===border)startCropDrag('move',e);});
            border.addEventListener('touchstart', e=>{if(e.target===border){e.preventDefault();startCropDrag('move',e.touches[0]);}},{passive:false});
            document.addEventListener('mousemove', moveCropDrag);
            document.addEventListener('mouseup', endCropDrag);
            document.addEventListener('touchmove', e=>{if(cropState.dragging){e.preventDefault();moveCropDrag(e.touches[0]);}},{passive:false});
            document.addEventListener('touchend', endCropDrag);
        }

        function setEditorTool(tool) {
            editor.currentTool=tool;
            if(tool!=='text') finalizeAllTextBoxes();
            if(tool!=='crop') hideCropUI();
            if(tool==='crop') showCropUI();
            document.querySelectorAll('.editor-toolbar .tool-btn[id^="tool"]').forEach(b=>b.classList.remove('active'));
            const btn=document.getElementById('tool'+tool.charAt(0).toUpperCase()+tool.slice(1));
            if(btn) btn.classList.add('active');
            editor.canvas.style.cursor=tool==='text'?'text':tool==='eraser'?'cell':tool==='crop'?'default':'crosshair';
        }

        function showCropUI() {
            const ui=document.getElementById('cropUI');
            const r=editor.canvas.getBoundingClientRect();
            const wr=editor.wrap.getBoundingClientRect();
            const inset=10;
            const cw=r.width, ch=r.height;
            const ox=r.left-wr.left, oy=r.top-wr.top;
            cropState={active:true, x:ox+inset, y:oy+inset, w:cw-inset*2, h:ch-inset*2, dragging:null, dragStart:null};
            updateCropBorder();
            ui.classList.add('show');
            editor.canvas.style.cursor='default';
        }
        function hideCropUI() { document.getElementById('cropUI').classList.remove('show'); document.getElementById('cropBorder').classList.remove('drawing'); cropState.active=false; }
        function updateCropBorder() {
            const b=document.getElementById('cropBorder');
            b.style.left=cropState.x+'px'; b.style.top=cropState.y+'px';
            b.style.width=cropState.w+'px'; b.style.height=cropState.h+'px';
        }
        function startCropDrag(handle,e) {
            cropState.dragging=handle;
            cropState.dragStart={mx:e.clientX,my:e.clientY,x:cropState.x,y:cropState.y,w:cropState.w,h:cropState.h};
        }
        function moveCropDrag(e) {
            if(!cropState.dragging) return;
            const d=cropState.dragStart, dx=e.clientX-d.mx, dy=e.clientY-d.my;
            const h=cropState.dragging;
            
            const r=editor.canvas.getBoundingClientRect();
            const wr=editor.wrap.getBoundingClientRect();
            const ox=r.left-wr.left, oy=r.top-wr.top;
            const cw=r.width, ch=r.height;
            
            let nx=cropState.x, ny=cropState.y, nw=cropState.w, nh=cropState.h;
            
            if(h==='move'){
                nx=d.x+dx; ny=d.y+dy;
                if (nx < ox) nx = ox;
                if (nx + d.w > ox + cw) nx = ox + cw - d.w;
                if (ny < oy) ny = oy;
                if (ny + d.h > oy + ch) ny = oy + ch - d.h;
                cropState.x = nx; cropState.y = ny;
            }
            else if(h==='br'){
                nw=Math.max(30,d.w+dx); nh=Math.max(30,d.h+dy);
                if (d.x + nw > ox + cw) nw = ox + cw - d.x;
                if (d.y + nh > oy + ch) nh = oy + ch - d.y;
                cropState.w = nw; cropState.h = nh;
            }
            else if(h==='bl'){
                nx=d.x+dx; nw=Math.max(30,d.w-dx);
                if (nx < ox) { nx = ox; nw = d.x + d.w - ox; }
                nh=Math.max(30,d.h+dy);
                if (d.y + nh > oy + ch) nh = oy + ch - d.y;
                cropState.x = nx; cropState.w = nw; cropState.h = nh;
            }
            else if(h==='tr'){
                nw=Math.max(30,d.w+dx);
                if (d.x + nw > ox + cw) nw = ox + cw - d.x;
                ny=d.y+dy; nh=Math.max(30,d.h-dy);
                if (ny < oy) { ny = oy; nh = d.y + d.h - oy; }
                cropState.w = nw; cropState.y = ny; cropState.h = nh;
            }
            else if(h==='tl'){
                nx=d.x+dx; nw=Math.max(30,d.w-dx);
                if (nx < ox) { nx = ox; nw = d.x + d.w - ox; }
                ny=d.y+dy; nh=Math.max(30,d.h-dy);
                if (ny < oy) { ny = oy; nh = d.y + d.h - oy; }
                cropState.x = nx; cropState.y = ny; cropState.w = nw; cropState.h = nh;
            }
            else if(h==='tm'){
                ny=d.y+dy; nh=Math.max(30,d.h-dy);
                if (ny < oy) { ny = oy; nh = d.y + d.h - oy; }
                cropState.y = ny; cropState.h = nh;
            }
            else if(h==='bm'){
                nh=Math.max(30,d.h+dy);
                if (d.y + nh > oy + ch) nh = oy + ch - d.y;
                cropState.h = nh;
            }
            else if(h==='ml'){
                nx=d.x+dx; nw=Math.max(30,d.w-dx);
                if (nx < ox) { nx = ox; nw = d.x + d.w - ox; }
                cropState.x = nx; cropState.w = nw;
            }
            else if(h==='mr'){
                nw=Math.max(30,d.w+dx);
                if (d.x + nw > ox + cw) nw = ox + cw - d.x;
                cropState.w = nw;
            }
            updateCropBorder();
        }
        function endCropDrag(){cropState.dragging=null;}

        function applyCrop() {
            if(!cropState.active) return;
            const r=editor.canvas.getBoundingClientRect();
            const wr=editor.wrap.getBoundingClientRect();
            const ox=r.left-wr.left, oy=r.top-wr.top;
            // Use the canvas's current displayed size.  editor.scaleX can be stale
            // after a resize/orientation change, which previously made crop only look applied.
            const scaleX=editor.canvas.width/r.width, scaleY=editor.canvas.height/r.height;
            const sx=(cropState.x-ox)*scaleX, sy=(cropState.y-oy)*scaleY;
            const sw=cropState.w*scaleX, sh=cropState.h*scaleY;
            const cx=Math.max(0,Math.round(sx)),cy=Math.max(0,Math.round(sy));
            const cw=Math.min(Math.round(sw),editor.canvas.width-cx);
            const ch=Math.min(Math.round(sh),editor.canvas.height-cy);
            if(cw<10||ch<10) return;

            // Copy the selected pixels before resizing. Resizing clears a canvas,
            // so drawing from a separate canvas guarantees the crop is retained.
            const cropped=document.createElement('canvas');
            cropped.width=cw; cropped.height=ch;
            cropped.getContext('2d').drawImage(editor.canvas,cx,cy,cw,ch,0,0,cw,ch);
            editor.canvas.width=cw; editor.canvas.height=ch;
            editor.ctx=editor.canvas.getContext('2d');
            editor.ctx.drawImage(cropped,0,0);
            hideCropUI(); pushHistory(); updateEditorMeta();
            requestAnimationFrame(()=>{const nr=editor.canvas.getBoundingClientRect();editor.scaleX=editor.canvas.width/nr.width;editor.scaleY=editor.canvas.height/nr.height;});
        }
        function cancelCrop(){hideCropUI();setEditorTool('draw');}

        // ===== TEXT TOOL (Rich Formatting Sync) =====
        function createTextBox(p) {
            finalizeAllTextBoxes();
            const box=document.createElement('div');
            box.className='editor-text-box';
            box.style.left=(p.x/editor.scaleX)+'px'; box.style.top=(p.y/editor.scaleY)+'px';
            const ce=document.createElement('div');
            ce.contentEditable='true';
            ce.style.color=document.getElementById('fmtColor').value;
            ce.style.fontFamily=document.getElementById('fmtFont').value;
            ce.style.fontSize=document.getElementById('fmtSize').value+'px';
            ce.innerHTML='<br>';
            box.appendChild(ce); editor.wrap.appendChild(box); ce.focus();
            
            const tb = {box, ce};
            editor.textBoxes.push(tb);
            
            ce.addEventListener('focus', ()=>selectTextBox(tb));
            ce.addEventListener('click', ()=>selectTextBox(tb));
            ce.addEventListener('input', ()=>repositionFormatBar(box));
            
            let isDrag=false,offX=0,offY=0;
            box.addEventListener('mousedown',e=>{if(e.target!==ce){isDrag=true;offX=e.offsetX;offY=e.offsetY;e.preventDefault();}});
            document.addEventListener('mousemove',e=>{if(!isDrag)return;const wr=editor.wrap.getBoundingClientRect();box.style.left=(e.clientX-wr.left-offX)+'px';box.style.top=(e.clientY-wr.top-offY)+'px';repositionFormatBar(box);});
            document.addEventListener('mouseup',()=>isDrag=false);
            box.addEventListener('touchstart',e=>{if(e.target!==ce){isDrag=true;const t=e.touches[0],br=box.getBoundingClientRect();offX=t.clientX-br.left;offY=t.clientY-br.top;e.preventDefault();}},{passive:false});
            document.addEventListener('touchmove',e=>{if(!isDrag)return;const t=e.touches[0],wr=editor.wrap.getBoundingClientRect();box.style.left=(t.clientX-wr.left-offX)+'px';box.style.top=(t.clientY-wr.top-offY)+'px';repositionFormatBar(box);});
            document.addEventListener('touchend',()=>isDrag=false);
            
            selectTextBox(tb);
        }
        function selectTextBox(tb) {
            editor.activeTextBox = tb;
            showFormatBar(tb.box);
            const ce=tb.ce;
            document.getElementById('fmtColor').value=rgbToHex(ce.style.color)||'#ff3b3b';
            document.getElementById('fmtFont').value=ce.style.fontFamily||'Inter';
            document.getElementById('fmtSize').value=parseInt(ce.style.fontSize)||24;
            document.getElementById('fmtBold').classList.toggle('on', ce.style.fontWeight==='bold');
            document.getElementById('fmtItalic').classList.toggle('on', ce.style.fontStyle==='italic');
            document.getElementById('fmtUnderline').classList.toggle('on', ce.style.textDecoration==='underline');
            const align = ce.style.textAlign||'left';
            document.getElementById('fmtAlignLeft').classList.toggle('on', align==='left');
            document.getElementById('fmtAlignCenter').classList.toggle('on', align==='center');
            document.getElementById('fmtAlignRight').classList.toggle('on', align==='right');
        }
        function showFormatBar(box) {
            const bar=document.getElementById('textFormatBar');
            bar.classList.add('show'); repositionFormatBar(box);
        }
        function repositionFormatBar(box) {
            const bar=document.getElementById('textFormatBar');
            const br=box.getBoundingClientRect(), wr=editor.wrap.getBoundingClientRect();
            bar.style.left=Math.max(0,(br.left-wr.left))+'px';
            bar.style.top=Math.max(0,(br.top-wr.top-44))+'px';
        }
        function hideFormatBar(){document.getElementById('textFormatBar').classList.remove('show');}
        function toggleFmt(type) {
            const btn=document.getElementById(type==='bold'?'fmtBold':type==='italic'?'fmtItalic':'fmtUnderline');
            const active=btn.classList.toggle('on');
            const tb=editor.activeTextBox;
            if(tb){
                if(type==='bold') tb.ce.style.fontWeight=active?'bold':'normal';
                else if(type==='italic') tb.ce.style.fontStyle=active?'italic':'normal';
                else tb.ce.style.textDecoration=active?'underline':'none';
            }
        }
        function setTextAlign(align) {
            ['fmtAlignLeft','fmtAlignCenter','fmtAlignRight'].forEach(id=>document.getElementById(id).classList.remove('on'));
            document.getElementById('fmtAlign'+align.charAt(0).toUpperCase()+align.slice(1)).classList.add('on');
            const tb=editor.activeTextBox;
            if(tb){ tb.ce.style.textAlign=align; tb.ce.style.width=tb.ce.style.width||'auto'; }
        }
        function deleteActiveTextBox() {
            const tb=editor.activeTextBox;
            if(!tb) return;
            tb.box.remove();
            editor.textBoxes = editor.textBoxes.filter(x=>x!==tb);
            editor.activeTextBox = null;
            hideFormatBar();
        }
        document.addEventListener('DOMContentLoaded',()=>{
            const ff=document.getElementById('fmtFont'),fs=document.getElementById('fmtSize'),fc=document.getElementById('fmtColor');
            if(ff) ff.addEventListener('change',()=>{if(editor.activeTextBox) editor.activeTextBox.ce.style.fontFamily=ff.value;});
            if(fs) fs.addEventListener('input',()=>{if(editor.activeTextBox) editor.activeTextBox.ce.style.fontSize=fs.value+'px';});
            if(fc) fc.addEventListener('input',()=>{if(editor.activeTextBox) editor.activeTextBox.ce.style.color=fc.value;});
        });
        function finalizeAllTextBoxes() {
            hideFormatBar();
            editor.textBoxes.forEach(({box,ce})=>{
                const text=ce.innerText.trim();
                if(!text){box.remove();return;}
                const ctx=editor.ctx;
                const wr=editor.wrap.getBoundingClientRect(),br=box.getBoundingClientRect();
                const boxX=(br.left-wr.left)*editor.scaleX, y=(br.top-wr.top)*editor.scaleY;
                const boxW=br.width*editor.scaleX;
                const style=window.getComputedStyle(ce);
                const fSize=parseFloat(style.fontSize)*editor.scaleX;
                const align = style.textAlign==='center'?'center':style.textAlign==='right'?'right':'left';
                const underline = style.textDecorationLine==='underline' || String(style.textDecoration).includes('underline');
                const pad=4*editor.scaleX;
                let anchorX;
                if(align==='center') anchorX = boxX + boxW/2;
                else if(align==='right') anchorX = boxX + boxW - pad;
                else anchorX = boxX + pad;
                ctx.font=`${style.fontStyle} ${style.fontWeight} ${fSize}px ${style.fontFamily}`;
                ctx.fillStyle=style.color; ctx.textBaseline='top'; ctx.textAlign=align;
                ctx.globalCompositeOperation='source-over';
                text.split('\n').forEach((line,i)=>{
                    const lineY=y+(i*fSize*1.2)+4*editor.scaleY;
                    ctx.fillText(line, anchorX, lineY);
                    if(underline && line){
                        const w=ctx.measureText(line).width;
                        let lx0 = align==='center' ? anchorX-w/2 : align==='right' ? anchorX-w : anchorX;
                        const uy = lineY + fSize*0.92;
                        ctx.save();
                        ctx.strokeStyle=style.color; ctx.lineWidth=Math.max(1,fSize*0.06);
                        ctx.beginPath(); ctx.moveTo(lx0,uy); ctx.lineTo(lx0+w,uy); ctx.stroke();
                        ctx.restore();
                    }
                });
                ctx.textAlign='left';
                box.remove();
            });
            editor.textBoxes=[]; editor.activeTextBox=null; pushHistory();
        }
        function rgbToHex(rgb) {
            if(!rgb||rgb.startsWith('#')) return rgb;
            const m=rgb.match(/\d+/g);
            if(!m||m.length<3) return '#ff3b3b';
            return '#'+m.slice(0,3).map(x=>(+x).toString(16).padStart(2,'0')).join('');
        }

        // ===== FILTERS & TINTS =====
        function toggleFilterPanel() {
            document.getElementById('filterPanel').classList.toggle('show');
            document.getElementById('toolFilter').classList.toggle('active');
        }
        function updateFilter() {
            const b=document.getElementById('fBright').value,c=document.getElementById('fContrast').value;
            const s=document.getElementById('fSaturate').value,g=document.getElementById('fGray').value,sp=document.getElementById('fSepia').value;
            const h=document.getElementById('fHue').value,inv=document.getElementById('fInvert').value;
            document.getElementById('fvBright').textContent=b; document.getElementById('fvContrast').textContent=c;
            document.getElementById('fvSaturate').textContent=s; document.getElementById('fvGray').textContent=g;
            document.getElementById('fvSepia').textContent=sp; document.getElementById('fvHue').textContent=h;
            document.getElementById('fvInvert').textContent=inv;
            editor.canvas.style.filter=`brightness(${b}%) contrast(${c}%) saturate(${s}%) grayscale(${g}%) sepia(${sp}%) hue-rotate(${h}deg) invert(${inv}%)`;
        }
        function setPageTint(tintType, btn) {
            const overlay = document.getElementById('editorTintOverlay');
            document.querySelectorAll('.tint-presets .tint-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            if(tintType==='sepia') overlay.style.backgroundColor='rgba(244, 237, 216, 0.4)';
            else if(tintType==='green') overlay.style.backgroundColor='rgba(227, 249, 229, 0.4)';
            else if(tintType==='blue') overlay.style.backgroundColor='rgba(227, 239, 249, 0.4)';
            else overlay.style.backgroundColor='transparent';
        }
        function resetFilters() {
            ['fBright','fContrast','fSaturate'].forEach(id=>{document.getElementById(id).value=100;});
            ['fGray','fSepia','fHue','fInvert'].forEach(id=>{document.getElementById(id).value=0;});
            updateFilter(); editor.canvas.style.filter='none';
            const noneBtn = document.querySelector('.tint-presets .tint-btn[title="None"]');
            if(noneBtn) setPageTint('none', noneBtn);
        }
        function applyFilters() {
            const f=editor.canvas.style.filter;
            const tint=document.getElementById('editorTintOverlay').style.backgroundColor;
            if((!f||f==='none') && (!tint || tint==='transparent')) return;
            
            const oc=document.createElement('canvas');
            oc.width=editor.canvas.width; oc.height=editor.canvas.height;
            const octx=oc.getContext('2d');
            if(f && f!=='none') octx.filter=f;
            octx.drawImage(editor.canvas,0,0);
            
            if(tint && tint!=='transparent') {
                octx.fillStyle=tint;
                octx.globalCompositeOperation='multiply';
                octx.fillRect(0,0,oc.width,oc.height);
            }
            
            editor.ctx.clearRect(0,0,editor.canvas.width,editor.canvas.height);
            editor.ctx.drawImage(oc,0,0);
            editor.canvas.style.filter='none';
            resetFilters(); pushHistory();
            document.getElementById('filterPanel').classList.remove('show');
            document.getElementById('toolFilter').classList.remove('active');
        }

        // ===== UNDO / REDO =====
        function pushHistory() {
            const d=editor.canvas.toDataURL('image/png');
            if(editor.history.length>0&&editor.history[editor.history.length-1]===d) return;
            editor.history.push(d); editor.redoStack=[];
            if(editor.history.length>20) editor.history.shift();
            updateUndoRedoButtons();
        }
        function editorUndo() {
            if(editor.history.length<=1) return;
            editor.redoStack.push(editor.history.pop());
            restoreHistory(editor.history[editor.history.length-1]); updateUndoRedoButtons();
        }
        function editorRedo() {
            if(!editor.redoStack.length) return;
            const s=editor.redoStack.pop(); editor.history.push(s);
            restoreHistory(s); updateUndoRedoButtons();
        }
        function restoreHistory(d) {
            const img=new Image();
            img.onload=()=>{editor.canvas.width=img.width;editor.canvas.height=img.height;editor.ctx.drawImage(img,0,0);updateEditorMeta();requestAnimationFrame(()=>{const r=editor.canvas.getBoundingClientRect();editor.scaleX=editor.canvas.width/r.width;editor.scaleY=editor.canvas.height/r.height;});};
            img.src=d;
        }
        function updateUndoRedoButtons() {
            document.getElementById('editorUndo').disabled=editor.history.length<=1;
            document.getElementById('editorRedo').disabled=!editor.redoStack.length;
        }
        function updateEditorMeta() {
            const meta=document.getElementById('editorMeta');
            if(meta&&editor.canvas) meta.textContent=`${editor.canvas.width} × ${editor.canvas.height} px`;
        }
        function rotateEditor(degrees) {
            if(!editor.canvas) return;
            finalizeAllTextBoxes(); hideCropUI();
            const source=document.createElement('canvas');
            source.width=editor.canvas.width; source.height=editor.canvas.height;
            source.getContext('2d').drawImage(editor.canvas,0,0);
            editor.canvas.width=source.height; editor.canvas.height=source.width;
            editor.ctx=editor.canvas.getContext('2d');
            editor.ctx.translate(editor.canvas.width/2,editor.canvas.height/2);
            editor.ctx.rotate(degrees*Math.PI/180);
            editor.ctx.drawImage(source,-source.width/2,-source.height/2);
            editor.ctx.setTransform(1,0,0,1,0,0);
            pushHistory(); updateEditorMeta();
            requestAnimationFrame(()=>{const r=editor.canvas.getBoundingClientRect();editor.scaleX=editor.canvas.width/r.width;editor.scaleY=editor.canvas.height/r.height;});
        }

        // ===== OPEN / CLOSE / SAVE =====
        async function openEditor() {
            if(currentPreviewIndex===-1) return;
            if(!editor.canvas) initEditor();
            editor.editingItemIndex=currentPreviewIndex;
            const item=uploadedItems[currentPreviewIndex];
            const img=new Image();
            const hdUrl=await getHDDataUrl(item);
            await new Promise((r,j)=>{img.onload=r;img.onerror=j;img.src=hdUrl;});
            editor.canvas.width=img.width; editor.canvas.height=img.height;
            editor.ctx.drawImage(img,0,0);
            editor.canvas.style.filter='none';
            editor.history=[editor.canvas.toDataURL('image/png')]; editor.redoStack=[]; editor.textBoxes=[];
            updateUndoRedoButtons();
            updateEditorMeta();
            editor.wrap.querySelectorAll('.editor-text-box').forEach(el=>el.remove());
            hideCropUI(); hideFormatBar();
            DOMElements.previewModal.classList.remove('show');
            editor.overlay.classList.add('show');
            setEditorTool('draw');
            requestAnimationFrame(()=>{const r=editor.canvas.getBoundingClientRect();editor.scaleX=editor.canvas.width/r.width;editor.scaleY=editor.canvas.height/r.height;});
        }
        function closeEditor() {
            editor.overlay.classList.remove('show');
            DOMElements.previewModal.classList.add('show');
            editor.wrap.querySelectorAll('.editor-text-box').forEach(el=>el.remove());
            editor.textBoxes=[]; hideFormatBar(); hideCropUI();
            editor.canvas.style.filter='none';
            document.getElementById('filterPanel').classList.remove('show');
        }
        async function saveEditorChanges() {
            finalizeAllTextBoxes();
            if(editor.canvas.style.filter&&editor.canvas.style.filter!=='none') applyFilters();
            const idx=editor.editingItemIndex; if(idx===-1) return;
            const item=uploadedItems[idx];
            const editedUrl=editor.canvas.toDataURL('image/png');
            // Keep a full-resolution copy for PDF/PNG/JPG export. The small canvas
            // below is only for the grid thumbnail; using it for export caused
            // edited pages to be downloaded at low quality.
            const fullCanvas=document.createElement('canvas'),fullCtx=fullCanvas.getContext('2d');
            fullCanvas.width=editor.canvas.width; fullCanvas.height=editor.canvas.height;
            fullCtx.drawImage(editor.canvas,0,0);
            const thumbC=document.createElement('canvas'),thumbCtx=thumbC.getContext('2d');
            const img=new Image();
            await new Promise(r=>{img.onload=r;img.src=editedUrl;});
            const sc=Math.min(400/img.width,400/img.height,1);
            thumbC.width=img.width*sc; thumbC.height=img.height*sc;
            thumbCtx.drawImage(img,0,0,thumbC.width,thumbC.height);
            item.dataUrl=thumbC.toDataURL('image/jpeg',0.9); item.canvas=fullCanvas;
            hdCache.set(item.id,editedUrl);
            if(item.type==='pdf-page'||item.type==='pdf-file'){item.type='image';item.editedDataUrl=editedUrl;}
            renderGridItems();
            editor.overlay.classList.remove('show');
            editor.textBoxes=[]; hideFormatBar(); hideCropUI(); editor.canvas.style.filter='none';
            showPreview(idx);
        }
        document.addEventListener('keydown', e=>{
            if(!editor.overlay||!editor.overlay.classList.contains('show')) return;
            if(e.ctrlKey&&e.key==='z'){e.preventDefault();editorUndo();}
            else if(e.ctrlKey&&e.key==='y'){e.preventDefault();editorRedo();}
            else if(e.key==='Escape') closeEditor();
        });
