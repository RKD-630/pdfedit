// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

class PDFEditor {
    constructor() {
        this.pdfDoc = null;
        this.pdfBytes = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.zoom = 1.0;
        this.scale = 1.5;
        this.textElements = [];
        this.selectedElement = null;
        this.isDrawing = false;
        this.isEditMode = false;
        this.currentTool = 'select'; // select, text, draw, highlight
        this.undoStack = [];
        this.redoStack = [];
        this.canvas = null;
        this.ctx = null;

        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.updateToolbar();
    }

    cacheElements() {
        // File handling
        this.uploadBtn = document.getElementById('uploadBtn');
        this.fileInput = document.getElementById('fileInput');
        this.saveBtn = document.getElementById('saveBtn');
        this.downloadBtn = document.getElementById('downloadBtn');

        // PDF viewer
        this.pdfContainer = document.getElementById('pdfContainer');
        this.pdfPlaceholder = document.getElementById('pdfPlaceholder');
        this.pdfViewer = document.getElementById('pdfViewer');

        // Toolbar controls
        this.fontFamily = document.getElementById('fontFamily');
        this.fontSize = document.getElementById('fontSize');
        this.fontColor = document.getElementById('fontColor');
        this.fontColorHex = document.getElementById('fontColorHex');
        this.highlightColor = document.getElementById('highlightColor');
        this.highlightColorGroup = document.getElementById('highlightColorGroup');

        // Format buttons
        this.boldBtn = document.getElementById('boldBtn');
        this.italicBtn = document.getElementById('italicBtn');
        this.underlineBtn = document.getElementById('underlineBtn');
        this.strikeBtn = document.getElementById('strikeBtn');

        // Alignment buttons
        this.alignLeft = document.getElementById('alignLeft');
        this.alignCenter = document.getElementById('alignCenter');
        this.alignRight = document.getElementById('alignRight');
        this.alignJustify = document.getElementById('alignJustify');

        // Tool buttons
        this.addTextBtn = document.getElementById('addTextBtn');
        this.addImageBtn = document.getElementById('addImageBtn');
        this.drawBtn = document.getElementById('drawBtn');
        this.highlightBtn = document.getElementById('highlightBtn');
        this.eraserBtn = document.getElementById('eraserBtn');

        // History buttons
        this.undoBtn = document.getElementById('undoBtn');
        this.redoBtn = document.getElementById('redoBtn');
        this.deleteBtn = document.getElementById('deleteBtn');

        // Zoom controls
        this.zoomOut = document.getElementById('zoomOut');
        this.zoomIn = document.getElementById('zoomIn');
        this.zoomFit = document.getElementById('zoomFit');
        this.zoomLevel = document.getElementById('zoomLevel');

        // Page navigation
        this.prevPage = document.getElementById('prevPage');
        this.nextPage = document.getElementById('nextPage');
        this.currentPageInput = document.getElementById('currentPage');
        this.totalPagesSpan = document.getElementById('totalPages');

        // Status bar
        this.statusMessage = document.getElementById('statusMessage');
        this.editModeSpan = document.getElementById('editMode');
        this.pageInfoSpan = document.getElementById('pageInfo');
    }

    bindEvents() {
        // File handling
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.saveBtn.addEventListener('click', () => this.savePDF());
        this.downloadBtn.addEventListener('click', () => this.downloadPDF());

        // Drag and drop
        this.pdfContainer.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.pdfContainer.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.pdfContainer.addEventListener('drop', (e) => this.handleDrop(e));

        // Font controls
        this.fontFamily.addEventListener('change', () => this.applyFontChanges());
        this.fontSize.addEventListener('change', () => this.applyFontChanges());
        this.fontColor.addEventListener('input', () => this.updateFontColorDisplay());
        this.fontColor.addEventListener('change', () => this.applyFontChanges());

        // Format buttons
        this.boldBtn.addEventListener('click', () => this.toggleFormat('bold', this.boldBtn));
        this.italicBtn.addEventListener('click', () => this.toggleFormat('italic', this.italicBtn));
        this.underlineBtn.addEventListener('click', () => this.toggleFormat('underline', this.underlineBtn));
        this.strikeBtn.addEventListener('click', () => this.toggleFormat('lineThrough', this.strikeBtn));

        // Alignment buttons
        this.alignLeft.addEventListener('click', () => this.setAlignment('left', this.alignLeft));
        this.alignCenter.addEventListener('click', () => this.setAlignment('center', this.alignCenter));
        this.alignRight.addEventListener('click', () => this.setAlignment('right', this.alignRight));
        this.alignJustify.addEventListener('click', () => this.setAlignment('justify', this.alignJustify));

        // Tool buttons
        this.addTextBtn.addEventListener('click', () => this.setTool('text'));
        this.addImageBtn.addEventListener('click', () => this.addImage());
        this.drawBtn.addEventListener('click', () => this.setTool('draw'));
        this.highlightBtn.addEventListener('click', () => this.toggleHighlight());
        this.eraserBtn.addEventListener('click', () => this.setTool('eraser'));

        // History buttons
        this.undoBtn.addEventListener('click', () => this.undo());
        this.redoBtn.addEventListener('click', () => this.redo());
        this.deleteBtn.addEventListener('click', () => this.deleteSelected());

        // Zoom controls
        this.zoomOut.addEventListener('click', () => this.changeZoom(-0.1));
        this.zoomIn.addEventListener('click', () => this.changeZoom(0.1));
        this.zoomFit.addEventListener('click', () => this.fitToPage());

        // Page navigation
        this.prevPage.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        this.nextPage.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        this.currentPageInput.addEventListener('change', () => this.goToPage(parseInt(this.currentPageInput.value)));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Click outside to deselect
        this.pdfViewer.addEventListener('click', (e) => {
            if (e.target === this.pdfViewer || e.target.classList.contains('text-layer')) {
                this.deselectAll();
            }
        });
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            await this.loadPDF(file);
        }
    }

    async loadPDF(file) {
        try {
            this.showLoading();
            this.statusMessage.textContent = 'Loading PDF...';

            // Read file
            const arrayBuffer = await file.arrayBuffer();
            this.pdfBytes = new Uint8Array(arrayBuffer);

            // Load PDF
            const loadingTask = pdfjsLib.getDocument({ data: this.pdfBytes.slice() });
            this.pdfDoc = await loadingTask.promise;

            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;

            // Update UI
            this.pdfPlaceholder.style.display = 'none';
            this.pdfViewer.style.display = 'flex';
            this.saveBtn.disabled = false;
            this.downloadBtn.disabled = false;

            this.updatePageInfo();
            await this.renderPage(this.currentPage);

            this.statusMessage.textContent = `Loaded: ${file.name}`;
            this.setEditMode(true);
            this.hideLoading();

        } catch (error) {
            console.error('Error loading PDF:', error);
            this.statusMessage.textContent = 'Error loading PDF';
            this.hideLoading();
            alert('Failed to load PDF file. Please try another file.');
        }
    }

    async renderPage(pageNum) {
        if (!this.pdfDoc) return;

        try {
            const page = await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.scale * this.zoom });

            // Clear viewer
            this.pdfViewer.innerHTML = '';

            // Create page wrapper
            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'pdf-page-wrapper';
            pageWrapper.style.width = viewport.width + 'px';
            pageWrapper.style.height = viewport.height + 'px';

            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-page-canvas';
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const ctx = canvas.getContext('2d');
            this.canvas = canvas;
            this.ctx = ctx;

            // Render PDF page
            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;

            // Create text layer
            const textLayer = document.createElement('div');
            textLayer.className = 'text-layer';
            textLayer.style.width = viewport.width + 'px';
            textLayer.style.height = viewport.height + 'px';

            // Create SVG drawing layer
            const svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svgLayer.classList.add('drawing-layer');
            svgLayer.style.position = 'absolute';
            svgLayer.style.top = '0';
            svgLayer.style.left = '0';
            svgLayer.style.width = viewport.width + 'px';
            svgLayer.style.height = viewport.height + 'px';
            svgLayer.style.pointerEvents = 'none'; // Only enable when drawing
            this.svgLayer = svgLayer;

            // Add click handler for adding text
            textLayer.addEventListener('click', (e) => this.handleTextLayerClick(e));

            // Setup drawing handlers
            this.setupDrawingHandlers(textLayer);

            pageWrapper.appendChild(canvas);
            pageWrapper.appendChild(svgLayer);
            pageWrapper.appendChild(textLayer);
            this.pdfViewer.appendChild(pageWrapper);

            // Load existing text elements for this page
            this.loadTextElementsForPage(pageNum);

        } catch (error) {
            console.error('Error rendering page:', error);
            this.statusMessage.textContent = 'Error rendering page';
        }
    }

    handleTextLayerClick(event) {
        if (this.currentTool === 'text') {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            this.addTextElement(x, y);
            this.setTool('select');
        }
    }

    setupDrawingHandlers(layer) {
        let isDrawing = false;
        let currentPath = null;
        let pathData = '';

        layer.addEventListener('mousedown', (e) => {
            if (this.currentTool !== 'draw' && this.currentTool !== 'highlight') return;
            
            isDrawing = true;
            const rect = layer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            currentPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            currentPath.classList.add('drawing-path');
            
            if (this.currentTool === 'highlight') {
                currentPath.setAttribute('stroke', this.highlightColor.value);
                currentPath.setAttribute('stroke-width', '15');
                currentPath.setAttribute('opacity', '0.4');
            } else {
                currentPath.setAttribute('stroke', this.fontColor.value);
                currentPath.setAttribute('stroke-width', '3');
                currentPath.setAttribute('opacity', '1');
            }
            
            currentPath.setAttribute('fill', 'none');
            currentPath.setAttribute('stroke-linecap', 'round');
            currentPath.setAttribute('stroke-linejoin', 'round');

            // Eraser logic for drawn paths
            currentPath.addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (this.currentTool === 'eraser') {
                    currentPath.remove();
                    this.saveState();
                }
            });

            pathData = `M ${x} ${y}`;
            currentPath.setAttribute('d', pathData);
            
            if (this.svgLayer) {
                this.svgLayer.appendChild(currentPath);
                // Make sure the path can be clicked by eraser
                this.svgLayer.style.pointerEvents = 'auto'; 
            }
        });

        layer.addEventListener('mousemove', (e) => {
            if (!isDrawing || !currentPath) return;

            const rect = layer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            pathData += ` L ${x} ${y}`;
            currentPath.setAttribute('d', pathData);
        });

        const stopDrawing = () => {
            if (isDrawing) {
                isDrawing = false;
                currentPath = null;
                this.saveState();
            }
        };

        layer.addEventListener('mouseup', stopDrawing);
        layer.addEventListener('mouseleave', stopDrawing);
    }

    addTextElement(x, y, text = 'Double-click to edit', options = {}) {
        const textLayer = this.pdfViewer.querySelector('.text-layer');
        if (!textLayer) return;

        const element = document.createElement('div');
        element.className = 'text-element';
        element.contentEditable = false;
        element.textContent = text;

        // Apply styles
        const styles = {
            left: x + 'px',
            top: y + 'px',
            fontFamily: options.fontFamily || this.fontFamily.value,
            fontSize: options.fontSize || this.fontSize.value + 'px',
            color: options.color || this.fontColor.value,
            fontWeight: options.fontWeight || 'normal',
            fontStyle: options.fontStyle || 'normal',
            textDecoration: options.textDecoration || 'none',
            textAlign: options.textAlign || 'left',
            lineHeight: '1.2',
            minWidth: '50px',
            maxWidth: '300px',
            pointerEvents: 'auto'
        };

        Object.assign(element.style, styles);

        // Make draggable
        this.makeDraggable(element);

        // Add event listeners
        element.addEventListener('dblclick', (e) => this.startEditing(e));
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.currentTool === 'eraser') {
                this.selectedElement = element;
                this.deleteSelected();
                return;
            }
            if (element.contentEditable === 'true') {
                return; // Let browser handle text cursor placement
            }
            this.selectElement(element);
        });
        element.addEventListener('blur', (e) => this.stopEditing(e));
        element.addEventListener('input', () => this.saveState());

        textLayer.appendChild(element);
        this.textElements.push({
            element,
            page: this.currentPage,
            styles: { ...styles }
        });

        this.selectElement(element);
        this.saveState();
        this.statusMessage.textContent = 'Text added. Double-click to edit.';
    }

    makeDraggable(element) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        element.addEventListener('mousedown', (e) => {
            if (element.contentEditable === 'true') return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(element.style.left) || 0;
            startTop = parseInt(element.style.top) || 0;
            element.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            element.style.left = (startLeft + dx) + 'px';
            element.style.top = (startTop + dy) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'move';
                this.saveState();
            }
        });
    }

    selectElement(element) {
        this.deselectAll();
        element.classList.add('selected');
        this.selectedElement = element;

        // Update toolbar to match element styles
        this.updateToolbarFromElement(element);
    }

    deselectAll() {
        this.pdfViewer.querySelectorAll('.text-element').forEach(el => {
            el.classList.remove('selected', 'editing');
            el.contentEditable = 'false';
        });
        this.selectedElement = null;
    }

    startEditing(event) {
        const element = event.target;
        element.contentEditable = 'true';
        element.classList.add('editing');
        element.focus();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    stopEditing(event) {
        const element = event.target;
        element.contentEditable = 'false';
        element.classList.remove('editing');
        this.saveState();
    }

    updateToolbarFromElement(element) {
        const styles = window.getComputedStyle(element);
        this.fontFamily.value = styles.fontFamily.split(',')[0].replace(/"/g, '');
        this.fontSize.value = parseInt(styles.fontSize);
        this.fontColor.value = this.rgbToHex(styles.color);
        this.updateFontColorDisplay();

        // Update format buttons
        this.boldBtn.classList.toggle('active', styles.fontWeight === 'bold' || parseInt(styles.fontWeight) >= 700);
        this.italicBtn.classList.toggle('active', styles.fontStyle === 'italic');
        this.underlineBtn.classList.toggle('active', styles.textDecoration.includes('underline'));
        this.strikeBtn.classList.toggle('active', styles.textDecoration.includes('line-through'));

        // Update alignment buttons
        this.alignLeft.classList.toggle('active', styles.textAlign === 'left');
        this.alignCenter.classList.toggle('active', styles.textAlign === 'center');
        this.alignRight.classList.toggle('active', styles.textAlign === 'right');
        this.alignJustify.classList.toggle('active', styles.textAlign === 'justify');
    }

    applyFontChanges() {
        if (!this.selectedElement) return;

        const element = this.selectedElement;
        element.style.fontFamily = this.fontFamily.value;
        element.style.fontSize = this.fontSize.value + 'px';
        element.style.color = this.fontColor.value;

        this.updateFontColorDisplay();
        this.saveState();
    }

    updateFontColorDisplay() {
        this.fontColorHex.textContent = this.fontColor.value;
    }

    toggleFormat(format, button) {
        if (!this.selectedElement) return;

        const element = this.selectedElement;
        const styles = window.getComputedStyle(element);

        let newValue;
        switch (format) {
            case 'bold':
                newValue = styles.fontWeight === 'bold' || parseInt(styles.fontWeight) >= 700 ? 'normal' : 'bold';
                element.style.fontWeight = newValue;
                break;
            case 'italic':
                newValue = styles.fontStyle === 'italic' ? 'normal' : 'italic';
                element.style.fontStyle = newValue;
                break;
            case 'underline':
                const hasUnderline = styles.textDecoration.includes('underline');
                const currentDecoration = styles.textDecoration.replace('underline', '').trim() || 'none';
                element.style.textDecoration = hasUnderline ? currentDecoration : (currentDecoration === 'none' ? 'underline' : currentDecoration + ' underline');
                break;
            case 'lineThrough':
                const hasStrike = styles.textDecoration.includes('line-through');
                const currentDec = styles.textDecoration.replace('line-through', '').trim() || 'none';
                element.style.textDecoration = hasStrike ? currentDec : (currentDec === 'none' ? 'line-through' : currentDec + ' line-through');
                break;
        }

        button.classList.toggle('active');
        this.saveState();
    }

    setAlignment(alignment, button) {
        if (!this.selectedElement) return;

        // Deactivate all alignment buttons
        [this.alignLeft, this.alignCenter, this.alignRight, this.alignJustify].forEach(btn => {
            btn.classList.remove('active');
        });

        this.selectedElement.style.textAlign = alignment;
        button.classList.add('active');
        this.saveState();
    }

    setTool(tool) {
        // Deactivate all tool buttons
        [this.addTextBtn, this.drawBtn, this.highlightBtn, this.eraserBtn].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });

        this.currentTool = tool;
        
        const textLayer = this.pdfViewer.querySelector('.text-layer');
        const svgLayer = this.pdfViewer.querySelector('.drawing-layer');

        // Manage pointer events for layers based on tool
        if (textLayer && svgLayer) {
            if (tool === 'eraser' || tool === 'select') {
                // Let clicks pass through empty text layer space to hit SVG paths
                textLayer.style.pointerEvents = 'none';
                svgLayer.style.pointerEvents = 'auto';
                // But keep text elements clickable
                textLayer.querySelectorAll('.text-element').forEach(el => el.style.pointerEvents = 'auto');
            } else {
                // Text, Draw, Highlight need the text layer to catch clicks/drags anywhere
                textLayer.style.pointerEvents = 'auto';
                svgLayer.style.pointerEvents = 'none';
                textLayer.querySelectorAll('.text-element').forEach(el => el.style.pointerEvents = 'auto');
            }
        }

        switch (tool) {
            case 'text':
                this.addTextBtn.classList.add('active');
                this.pdfViewer.style.cursor = 'text';
                this.statusMessage.textContent = 'Click on the PDF to add text';
                break;
            case 'draw':
                this.drawBtn.classList.add('active');
                this.pdfViewer.style.cursor = 'crosshair';
                this.statusMessage.textContent = 'Drawing mode - Click and drag to draw';
                break;
            case 'highlight':
                this.highlightBtn.classList.add('active');
                this.pdfViewer.style.cursor = 'crosshair';
                this.highlightColorGroup.style.display = 'flex';
                this.statusMessage.textContent = 'Highlight mode - Click and drag to highlight';
                break;
            case 'eraser':
                this.eraserBtn.classList.add('active');
                this.pdfViewer.style.cursor = 'not-allowed';
                this.statusMessage.textContent = 'Eraser mode - Click on text to delete it';
                break;
            default:
                this.pdfViewer.style.cursor = 'default';
                this.statusMessage.textContent = 'Select mode';
        }
    }

    toggleHighlight() {
        if (this.currentTool === 'highlight') {
            this.setTool('select');
            this.highlightColorGroup.style.display = 'none';
        } else {
            this.setTool('highlight');
        }
    }

    addImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const textLayer = this.pdfViewer.querySelector('.text-layer');
                        if (!textLayer) return;

                        const element = document.createElement('div');
                        element.className = 'text-element';
                        element.style.left = '100px';
                        element.style.top = '100px';
                        element.style.maxWidth = '300px';

                        const imgElement = document.createElement('img');
                        imgElement.src = event.target.result;
                        imgElement.style.width = '100%';
                        imgElement.style.pointerEvents = 'none';

                        element.appendChild(imgElement);
                        this.makeDraggable(element);

                        element.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.selectElement(element);
                        });

                        textLayer.appendChild(element);
                        this.selectElement(element);
                        this.saveState();
                        this.statusMessage.textContent = 'Image added';
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }

    deleteSelected() {
        if (!this.selectedElement) {
            this.statusMessage.textContent = 'No element selected';
            return;
        }

        this.selectedElement.remove();
        this.textElements = this.textElements.filter(item => item.element !== this.selectedElement);
        this.selectedElement = null;
        this.saveState();
        this.statusMessage.textContent = 'Element deleted';
    }

    changeZoom(delta) {
        this.zoom = Math.max(0.5, Math.min(2.0, this.zoom + delta));
        this.zoomLevel.textContent = Math.round(this.zoom * 100) + '%';
        this.renderPage(this.currentPage);
    }

    fitToPage() {
        this.zoom = 1.0;
        this.zoomLevel.textContent = '100%';
        this.renderPage(this.currentPage);
    }

    goToPage(pageNum) {
        if (pageNum < 1 || pageNum > this.totalPages) return;
        this.currentPage = pageNum;
        this.updatePageInfo();
        this.renderPage(pageNum);
    }

    updatePageInfo() {
        this.currentPageInput.value = this.currentPage;
        this.currentPageInput.min = 1;
        this.currentPageInput.max = this.totalPages;
        this.totalPagesSpan.textContent = `/ ${this.totalPages}`;
        this.prevPage.disabled = this.currentPage <= 1;
        this.nextPage.disabled = this.currentPage >= this.totalPages;
        this.pageInfoSpan.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
    }

    saveState() {
        // Save current state for undo
        const state = {
            page: this.currentPage,
            elements: this.getTextElementsData()
        };
        this.undoStack.push(JSON.stringify(state));
        this.redoStack = [];

        // Limit stack size
        if (this.undoStack.length > 50) {
            this.undoStack.shift();
        }

        this.updateHistoryButtons();
    }

    undo() {
        if (this.undoStack.length === 0) return;

        const currentState = {
            page: this.currentPage,
            elements: this.getTextElementsData()
        };
        this.redoStack.push(JSON.stringify(currentState));

        const previousState = JSON.parse(this.undoStack.pop());
        this.restoreState(previousState);
        this.updateHistoryButtons();
    }

    redo() {
        if (this.redoStack.length === 0) return;

        const currentState = {
            page: this.currentPage,
            elements: this.getTextElementsData()
        };
        this.undoStack.push(JSON.stringify(currentState));

        const nextState = JSON.parse(this.redoStack.pop());
        this.restoreState(nextState);
        this.updateHistoryButtons();
    }

    restoreState(state) {
        this.currentPage = state.page;
        this.updatePageInfo();
        this.renderPage(this.currentPage);

        // Restore text elements
        setTimeout(() => {
            const textLayer = this.pdfViewer.querySelector('.text-layer');
            if (!textLayer) return;

            // Clear existing elements
            textLayer.innerHTML = '';

            // Recreate elements
            state.elements.forEach(data => {
                if (data.page === this.currentPage) {
                    const element = document.createElement('div');
                    element.className = 'text-element';
                    element.contentEditable = 'false';
                    element.textContent = data.text;

                    Object.assign(element.style, data.styles);
                    element.style.pointerEvents = 'auto'; // Ensure it remains clickable
                    this.makeDraggable(element);

                    element.addEventListener('dblclick', (e) => this.startEditing(e));
                    element.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (this.currentTool === 'eraser') {
                            this.selectedElement = element;
                            this.deleteSelected();
                            return;
                        }
                        if (element.contentEditable === 'true') {
                            return; // Let browser handle text cursor placement
                        }
                        this.selectElement(element);
                    });
                    element.addEventListener('blur', (e) => this.stopEditing(e));
                    element.addEventListener('input', () => this.saveState());

                    textLayer.appendChild(element);
                    this.textElements.push({
                        element,
                        page: this.currentPage,
                        styles: { ...data.styles }
                    });
                }
            });
        }, 100);
    }

    getTextElementsData() {
        const data = [];
        this.pdfViewer.querySelectorAll('.text-element').forEach(element => {
            data.push({
                page: this.currentPage,
                text: element.textContent,
                styles: {
                    left: element.style.left,
                    top: element.style.top,
                    fontFamily: element.style.fontFamily,
                    fontSize: element.style.fontSize,
                    color: element.style.color,
                    fontWeight: element.style.fontWeight,
                    fontStyle: element.style.fontStyle,
                    textDecoration: element.style.textDecoration,
                    textAlign: element.style.textAlign
                }
            });
        });
        return data;
    }

    loadTextElementsForPage(pageNum) {
        // This would load saved elements from localStorage or a database
        // For now, we'll keep it empty
    }

    updateHistoryButtons() {
        this.undoBtn.disabled = this.undoStack.length === 0;
        this.redoBtn.disabled = this.redoStack.length === 0;
    }

    updateToolbar() {
        this.updateFontColorDisplay();
        this.updateHistoryButtons();
    }

    setEditMode(isEdit) {
        this.isEditMode = isEdit;
        this.editModeSpan.textContent = isEdit ? 'Edit Mode' : 'View Mode';
    }

    handleDragOver(event) {
        event.preventDefault();
        this.pdfContainer.classList.add('drag-over');
    }

    handleDragLeave(event) {
        event.preventDefault();
        this.pdfContainer.classList.remove('drag-over');
    }

    handleDrop(event) {
        event.preventDefault();
        this.pdfContainer.classList.remove('drag-over');

        const files = event.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/pdf') {
            this.loadPDF(files[0]);
        }
    }

    handleKeyboard(event) {
        // Ctrl+S to save
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            this.savePDF();
        }

        // Ctrl+Z to undo
        if (event.ctrlKey && event.key === 'z') {
            event.preventDefault();
            this.undo();
        }

        // Ctrl+Y to redo
        if (event.ctrlKey && event.key === 'y') {
            event.preventDefault();
            this.redo();
        }

        // Delete key
        if (event.key === 'Delete' && this.selectedElement) {
            this.deleteSelected();
        }

        // Page navigation
        if (event.key === 'ArrowLeft' && this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
        if (event.key === 'ArrowRight' && this.currentPage < this.totalPages) {
            this.goToPage(this.currentPage + 1);
        }

        // Zoom with Ctrl + Mouse Wheel
        if (event.ctrlKey && event.key === 'WheelUp') {
            event.preventDefault();
            this.changeZoom(0.1);
        }
        if (event.ctrlKey && event.key === 'WheelDown') {
            event.preventDefault();
            this.changeZoom(-0.1);
        }
    }

    async savePDF() {
        try {
            this.statusMessage.textContent = 'Saving PDF...';

            // Load original PDF
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            const pdfDoc = await PDFDocument.load(this.pdfBytes);

            // Embed font
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

            // Get all pages
            const pages = pdfDoc.getPages();

            // Add text elements to PDF
            this.pdfViewer.querySelectorAll('.text-element').forEach(element => {
                const page = pages[this.currentPage - 1];
                const { width, height } = page.getSize();

                const styles = window.getComputedStyle(element);
                const x = parseFloat(styles.left);
                const y = height - parseFloat(styles.top) - parseFloat(styles.fontSize);

                const fontSize = parseFloat(styles.fontSize);
                const color = this.hexToRgb(styles.color);

                page.drawText(element.textContent, {
                    x: x,
                    y: y,
                    size: fontSize,
                    font: font,
                    color: rgb(color.r / 255, color.g / 255, color.b / 255),
                });
            });

            // Save
            const pdfBytes = await pdfDoc.save();
            this.savedPdfBytes = pdfBytes;

            this.statusMessage.textContent = 'PDF saved successfully';
            this.showNotification('PDF saved successfully!', 'success');

        } catch (error) {
            console.error('Error saving PDF:', error);
            this.statusMessage.textContent = 'Error saving PDF';
            this.showNotification('Failed to save PDF', 'error');
        }
    }

    async downloadPDF() {
        if (!this.savedPdfBytes) {
            await this.savePDF();
        }

        if (this.savedPdfBytes) {
            const blob = new Blob([this.savedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'edited_document.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.statusMessage.textContent = 'PDF downloaded';
        }
    }

    showLoading() {
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.id = 'loadingSpinner';
        loading.innerHTML = `
            <div class="spinner"></div>
            <p>Loading PDF...</p>
        `;
        this.pdfContainer.appendChild(loading);
        loading.classList.add('active');
    }

    hideLoading() {
        const loading = document.getElementById('loadingSpinner');
        if (loading) {
            loading.remove();
        }
    }

    showNotification(message, type = 'info') {
        // Simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#4a90e2'};
            color: white;
            border-radius: 6px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    rgbToHex(rgb) {
        if (rgb.startsWith('#')) return rgb;
        const result = rgb.match(/\d+/g);
        if (!result || result.length < 3) return '#000000';
        return '#' + result.slice(0, 3).map(x => {
            const hex = parseInt(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }
}

// Initialize the editor
document.addEventListener('DOMContentLoaded', () => {
    window.pdfEditor = new PDFEditor();
});

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
