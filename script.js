pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const KRUTI_FULL_MAP = {
  'd':'क','D':'ख','e':'ग','E':'घ','f':'ङ','g':'च','G':'छ','h':'ज','H':'झ',
  'i':'ट','I':'ठ','j':'ड','J':'ढ','k':'ण','l':'त','L':'थ','m':'द','M':'ध',
  'n':'न','o':'प','O':'फ','p':'ब','P':'भ','q':'म','Q':'य','r':'र','R':'ल',
  's':'ळ','t':'व','T':'श','u':'ष','U':'स','v':'ह',
  'a':'ा','A':'ॉ','b':'ि','B':'ी','c':'ु','C':'ू','w':'े','W':'ै',
  'x':'ो','X':'ौ','y':'ं','Y':'ँ','z':'ः','`':'्','~':'र्',
  '0':'०','1':'१','2':'२','3':'३','4':'४','5':'५','6':'६','7':'७','8':'८','9':'९',
  ']':'।','\\':'॥'
};

const state = {
  pdfDoc: null, pdfBytes: null,
  currentPage: 1, totalPages: 0, scale: 1.5,
  tool: 'select',
  pages: [],
  annotations: {},
  pageRotations: {},
  deletedPages: new Set(),
  history: [], historyIndex: -1,
  selectedTextObj: null, activeTextBox: null,
  isDrawing: false, currentStroke: null,
  pencilColor: '#dc2626', pencilSize: 3, pencilOpacity: 1,
  highlightColor: '#fde047', highlightOpacity: 0.4,
  textColor: '#000000', fontFamily: 'Auto Detect',
  fontSize: 14, bold: false, italic: false, underline: false,
  krutiFontsLoaded: { 'Kruti Dev 010': false, 'Kruti Dev 014': false },
  pinchState: null,
  fileName: 'edited-document.pdf',
  textDrag: null,
  selectedTextEditIdx: -1,
  isDraggingTextEdit: false,
  dragStartPdf: null,
  dragOrigPos: null,
  // NEW: rectangle drag on Select tool for capturing original text
  selectRectDrag: null
};

const $ = id => document.getElementById(id);
const homeScreen = $('homeScreen');
const editorScreen = $('editorScreen');
const fileInput = $('fileInput');
const importCard = $('importCard');
const pdfCanvas = $('pdfCanvas');
const textLayer = $('textLayer');
const annotationCanvas = $('annotationCanvas');
const pdfView = $('pdfView');
const pdfCanvasWrap = $('pdfCanvasWrap');
const thumbList = $('thumbList');
const drawerThumbList = $('drawerThumbList');
const secondaryToolbar = $('secondaryToolbar');
const propsPanel = $('propsPanel');
const pageLabel = $('pageLabel');
const zoomLabel = $('zoomLabel');
const toast = $('toast');
const loadingOverlay = $('loadingOverlay');
const loadingText = $('loadingText');
const progressFill = $('progressFill');
const modalBackdrop = $('modalBackdrop');
const modalTitle = $('modalTitle');
const modalBody = $('modalBody');
const modalFooter = $('modalFooter');
const drawer = $('drawer');
const drawerBackdrop = $('drawerBackdrop');
const textEditActions = $('textEditActions');
const deleteSelectedTextBtn = $('deleteSelectedTextBtn');
const editSelectedTextBtn = $('editSelectedTextBtn');
const fontDetectBadge = $('fontDetectBadge');
const fontDetectText = $('fontDetectText');

function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.className = 'toast ' + type, 2500);
}
function showLoading(text = 'Processing…', pct = null) {
  loadingText.textContent = text;
  progressFill.style.width = pct == null ? '0%' : pct + '%';
  loadingOverlay.classList.add('active');
}
function updateLoading(pct, text) {
  if (pct != null) progressFill.style.width = pct + '%';
  if (text) loadingText.textContent = text;
}
function hideLoading() { loadingOverlay.classList.remove('active'); }
function isMobile() { return window.innerWidth <= 900; }

function openModal(title, bodyHTML, footerHTML) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHTML;
  modalFooter.innerHTML = footerHTML || '';
  modalBackdrop.classList.add('active');
}
function closeModal() { modalBackdrop.classList.remove('active'); }
function openDrawer() { drawer.classList.add('active'); drawerBackdrop.classList.add('active'); }
function closeDrawer() { drawer.classList.remove('active'); drawerBackdrop.classList.remove('active'); }

async function checkKrutiFonts() {
  try {
    if (document.fonts) {
      await document.fonts.ready;
      state.krutiFontsLoaded['Kruti Dev 010'] = document.fonts.check('16px "Kruti Dev 010"');
      state.krutiFontsLoaded['Kruti Dev 014'] = document.fonts.check('16px "Kruti Dev 014"');
    }
  } catch (e) {}
}

function looksLikeKruti(text) {
  if (!text) return false;
  if (/[\u0900-\u097F]/.test(text)) return false;
  const krutiChars = 'dDefghHijJkKlLmMnoOpPqQrRsStTuUvVwWxXyYzZ`~0123456789';
  let matches = 0;
  for (const ch of text) {
    if (krutiChars.includes(ch) && KRUTI_FULL_MAP[ch]) matches++;
  }
  return matches > text.length * 0.3;
}

function detectFontFromName(fontName) {
  if (!fontName) return 'Auto Detect';
  const lower = fontName.toLowerCase();
  if (lower.includes('kruti') && lower.includes('010')) return 'Kruti Dev 010';
  if (lower.includes('kruti') && lower.includes('014')) return 'Kruti Dev 014';
  if (lower.includes('kruti')) return 'Kruti Dev 010';
  if (lower.includes('mangal') || lower.includes('devanagari')) return 'Noto Sans Devanagari';
  if (lower.includes('arial')) return 'Arial';
  if (lower.includes('times')) return 'Times New Roman';
  if (lower.includes('helvetica')) return 'Helvetica';
  if (lower.includes('courier')) return 'Courier';
  return 'Auto Detect';
}

/* ---------- NEW: Detect font from a collection of spans ---------- */
function detectFontFromSpans(spans) {
  if (!spans || spans.length === 0) return { font: 'Auto Detect', type: 'english' };

  const combinedText = spans.map(s => s.textContent).join('');
  const fontNames = spans.map(s => s.dataset.fontName || '').filter(Boolean);

  // Check for Kruti Dev in font names
  const kruti010 = fontNames.some(f => /kruti.*010/i.test(f) || (/kruti/i.test(f) && !/014/i.test(f)));
  const kruti014 = fontNames.some(f => /kruti.*014/i.test(f));

  // Check for Devanagari Unicode
  const hasDevanagari = /[\u0900-\u097F]/.test(combinedText);

  // Check for Kruti Dev encoding in text
  const textLooksKruti = looksLikeKruti(combinedText);

  if (kruti014) return { font: 'Kruti Dev 014', type: 'kruti' };
  if (kruti010) return { font: 'Kruti Dev 010', type: 'kruti' };
  if (hasDevanagari) return { font: 'Noto Sans Devanagari', type: 'hindi' };
  if (textLooksKruti) return { font: 'Kruti Dev 010', type: 'kruti' };

  // Fall back to most common font name
  const counts = {};
  fontNames.forEach(f => { counts[f] = (counts[f] || 0) + 1; });
  let topFont = '';
  let topCount = 0;
  for (const f in counts) {
    if (counts[f] > topCount) { topCount = counts[f]; topFont = f; }
  }
  const detected = detectFontFromName(topFont);
  return { font: detected === 'Auto Detect' ? 'Arial' : detected, type: 'english' };
}

/* ---------- NEW: Find text spans inside a CSS-pixel rectangle ---------- */
function findSpansInCssRect(cssX, cssY, cssW, cssH) {
  const spans = textLayer.querySelectorAll('span');
  const found = [];
  spans.forEach(span => {
    const rect = span.getBoundingClientRect();
    const layerRect = textLayer.getBoundingClientRect();
    const sx = rect.left - layerRect.left;
    const sy = rect.top - layerRect.top;
    const sw = rect.width;
    const sh = rect.height;
    // Check overlap
    if (sx + sw > cssX && sx < cssX + cssW &&
        sy + sh > cssY && sy < cssY + cssH) {
      found.push(span);
    }
  });
  // Sort by y then x for reading order
  found.sort((a, b) => {
    const ay = parseFloat(a.style.top);
    const by = parseFloat(b.style.top);
    if (Math.abs(ay - by) > 4) return ay - by;
    return parseFloat(a.style.left) - parseFloat(b.style.left);
  });
  return found;
}

/* ---------- NEW: Combine spans into lines of text ---------- */
function combineSpansToText(spans) {
  if (spans.length === 0) return '';
  // Group by approximate y
  const lines = [];
  let currentLine = [spans[0]];
  let lastY = parseFloat(spans[0].style.top);
  for (let i = 1; i < spans.length; i++) {
    const y = parseFloat(spans[i].style.top);
    if (Math.abs(y - lastY) > 4) {
      lines.push(currentLine);
      currentLine = [spans[i]];
      lastY = y;
    } else {
      currentLine.push(spans[i]);
    }
  }
  lines.push(currentLine);
  // Join each line with spaces, join lines with newlines
  return lines.map(line => line.map(s => s.textContent).join(' ')).join('\n');
}

/* ---------- NEW: Get average font size from spans ---------- */
function getAverageFontSize(spans) {
  if (spans.length === 0) return state.fontSize;
  let sum = 0;
  spans.forEach(s => { sum += parseFloat(s.style.fontSize) || 12; });
  return Math.round(sum / spans.length);
}

/* ---------- NEW: Create editable text box from captured spans ---------- */
function createEditBoxFromSpans(spans, cssX, cssY, cssW, cssH) {
  if (state.activeTextBox) commitTextBox();
  const text = combineSpansToText(spans);
  if (!text.trim()) {
    showToast('No text found in selection', 'error');
    return;
  }

  const detection = detectFontFromSpans(spans);
  const avgSize = getAverageFontSize(spans);

  // Show font detection badge
  showFontDetectBadge(detection, cssX + cssW + 8, cssY);

  // Update state with detected font
  state.fontFamily = detection.font;
  state.fontSize = avgSize / state.scale; // convert from CSS px to "PDF" px

  // Hide original spans
  spans.forEach(s => { s.dataset.wasHiddenByCapture = 'true'; s.style.visibility = 'hidden'; });

  // Create editable box
  const box = document.createElement('div');
  box.className = 'text-edit-box';
  box.contentEditable = 'true';
  box.textContent = text;
  box.style.left = cssX + 'px';
  box.style.top = cssY + 'px';
  box.style.width = cssW + 'px';
  box.style.minWidth = cssW + 'px';
  box.style.minHeight = cssH + 'px';
  box.style.fontSize = avgSize + 'px';
  const ff = detection.font;
  box.style.fontFamily = ff.includes(' ') ? `"${ff}"` : ff;
  box.style.color = '#000';
  box.style.fontWeight = 'normal';
  box.style.fontStyle = 'normal';
  box.style.textDecoration = 'none';
  box.dataset.isNew = 'true';
  box.dataset.bold = 'false';
  box.dataset.italic = 'false';
  box.dataset.underline = 'false';
  box.dataset.capturedSpans = spans.map(s => s.dataset.idx).join(',');
  textLayer.appendChild(box);
  state.activeTextBox = box;
  box.focus();

  // Select all text
  const range = document.createRange();
  range.selectNodeContents(box);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  updateSecondaryToolbar();
  updatePropsPanel();

  box.addEventListener('blur', () => {
    hideFontDetectBadge();
    commitTextBox();
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { box.blur(); }
  });
}

function showFontDetectBadge(detection, x, y) {
  fontDetectBadge.className = '';
  fontDetectBadge.classList.add(detection.type);
  let label = '';
  if (detection.type === 'kruti') label = 'Kruti Dev detected';
  else if (detection.type === 'hindi') label = 'Hindi Unicode detected';
  else label = 'English detected';
  fontDetectText.textContent = `${label}: ${detection.font}`;
  fontDetectBadge.style.display = 'block';
  fontDetectBadge.style.left = x + 'px';
  fontDetectBadge.style.top = y + 'px';
  // Auto-hide after 3s
  clearTimeout(fontDetectBadge._hideT);
  fontDetectBadge._hideT = setTimeout(hideFontDetectBadge, 3000);
}
function hideFontDetectBadge() {
  fontDetectBadge.style.display = 'none';
}

function getTextEditBounds(te) {
  const ctx = annotationCanvas.getContext('2d');
  const fontStyle = (te.italic ? 'italic ' : '') + (te.bold ? 'bold ' : '');
  const fontFam = te.fontFamily && te.fontFamily.includes(' ') ? `"${te.fontFamily}"` : (te.fontFamily || 'sans-serif');
  ctx.font = `${fontStyle}${te.size}px ${fontFam}`;
  const lines = te.text.split('\n');
  let maxWidth = 0;
  lines.forEach(line => { maxWidth = Math.max(maxWidth, ctx.measureText(line).width); });
  const totalHeight = lines.length * te.size * 1.2;
  return { x: te.x, y: te.y, w: maxWidth, h: totalHeight };
}

async function loadPDF(fileOrBytes) {
  try {
    showLoading('Loading PDF…', 10);
    let bytes;
    if (fileOrBytes instanceof File) {
      bytes = new Uint8Array(await fileOrBytes.arrayBuffer());
      state.fileName = fileOrBytes.name.replace(/\.pdf$/i, '') + '-edited.pdf';
    } else {
      bytes = fileOrBytes;
    }
    state.pdfBytes = bytes;
    updateLoading(30, 'Parsing PDF…');
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    state.pdfDoc = pdf;
    state.totalPages = pdf.numPages;
    state.currentPage = 1;
    state.pages = [];
    state.annotations = {};
    state.pageRotations = {};
    state.deletedPages = new Set();
    state.selectedTextEditIdx = -1;

    updateLoading(50, 'Extracting text…');
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      state.pages.push({ pdfPage: page });
      state.annotations[i] = { drawings: [], highlights: [], textEdits: [], erasures: [], pageNumbers: [] };
      state.pageRotations[i] = 0;
      updateLoading(50 + (i / pdf.numPages) * 30);
    }

    state.history = [JSON.parse(JSON.stringify({ annotations: state.annotations, deletedPages: [], pageRotations: state.pageRotations }))];
    state.historyIndex = 0;

    updateLoading(85, 'Rendering thumbnails…');
    await renderThumbnails();
    updateLoading(95, 'Preparing editor…');
    await renderCurrentPage();

    hideLoading();
    homeScreen.style.display = 'none';
    editorScreen.classList.add('active');
    setTool('select');
    updatePageLabel();
    updateHistoryButtons();
    autosave();
    showToast('PDF loaded successfully', 'success');
  } catch (err) {
    console.error(err);
    hideLoading();
    showToast('Failed to load PDF: ' + err.message, 'error');
  }
}

function buildThumbItem(i) {
  const dataUrl = state.pages[i-1].thumbDataUrl;
  const item = document.createElement('div');
  const isDeleted = state.deletedPages.has(i);
  item.className = 'thumb-item' + (i === state.currentPage ? ' active' : '') + (isDeleted ? ' deleted' : '');
  item.dataset.page = i;
  item.innerHTML = `
    <img class="thumb-canvas" src="${dataUrl}" alt="Page ${i}" />
    <div class="thumb-label">Page ${i}${isDeleted ? ' (deleted)' : ''}</div>
    <div class="thumb-actions">
      <button class="thumb-action-btn" data-action="rotate" title="Rotate">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      </button>
      <button class="thumb-action-btn" data-action="delete" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
  `;
  item.addEventListener('click', (e) => {
    if (e.target.closest('.thumb-action-btn')) return;
    goToPage(i);
    if (isMobile()) closeDrawer();
  });
  const rotBtn = item.querySelector('[data-action="rotate"]');
  const delBtn = item.querySelector('[data-action="delete"]');
  if (rotBtn) rotBtn.addEventListener('click', (e) => { e.stopPropagation(); rotatePage(i); });
  if (delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); deletePage(i); });
  return item;
}

async function renderThumbnails() {
  thumbList.innerHTML = '';
  drawerThumbList.innerHTML = '';
  for (let i = 1; i <= state.totalPages; i++) {
    const page = state.pages[i-1].pdfPage;
    const viewport = page.getViewport({ scale: 0.2, rotate: state.pageRotations[i] || 0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    state.pages[i-1].thumbDataUrl = canvas.toDataURL('image/jpeg', 0.6);
    thumbList.appendChild(buildThumbItem(i));
    drawerThumbList.appendChild(buildThumbItem(i));
  }
}

async function renderCurrentPage() {
  const page = state.pages[state.currentPage - 1].pdfPage;
  const rotation = state.pageRotations[state.currentPage] || 0;
  const viewport = page.getViewport({ scale: state.scale, rotate: rotation });

  pdfCanvas.width = viewport.width;
  pdfCanvas.height = viewport.height;
  const ctx = pdfCanvas.getContext('2d');
  ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  annotationCanvas.width = viewport.width;
  annotationCanvas.height = viewport.height;
  annotationCanvas.style.width = viewport.width + 'px';
  annotationCanvas.style.height = viewport.height + 'px';

  await renderTextLayer(page, viewport);
  renderAnnotations();

  pdfCanvasWrap.style.width = viewport.width + 'px';
  pdfCanvasWrap.style.height = viewport.height + 'px';
}

async function renderTextLayer(page, viewport) {
  textLayer.innerHTML = '';
  textLayer.style.width = viewport.width + 'px';
  textLayer.style.height = viewport.height + 'px';

  const textContent = await page.getTextContent();
  state.pages[state.currentPage - 1].textItems = textContent.items;
  state.pages[state.currentPage - 1].viewport = viewport;

  textContent.items.forEach((item, idx) => {
    if (!item.str) return;
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]);
    const span = document.createElement('span');
    span.textContent = item.str;
    span.style.left = tx[4] + 'px';
    span.style.top = (tx[5] - fontHeight) + 'px';
    span.style.fontSize = fontHeight + 'px';
    span.style.fontFamily = item.fontName || 'sans-serif';
    span.dataset.idx = idx;
    span.dataset.fontName = item.fontName || '';
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentVp = state.pages[state.currentPage - 1].viewport;
      if (state.tool === 'edit') startEditSpan(span, item, currentVp);
      else if (state.tool === 'highlight') highlightSpan(span, item, currentVp);
      else if (state.tool === 'eraser') eraseSpan(span, item, currentVp);
    });
    textLayer.appendChild(span);
  });
}

function renderAnnotations() {
  const ctx = annotationCanvas.getContext('2d');
  ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  const ann = state.annotations[state.currentPage] || { drawings: [], highlights: [], textEdits: [], erasures: [], pageNumbers: [] };
  const s = state.scale;

  ann.erasures.forEach(er => {
    ctx.fillStyle = 'white';
    ctx.fillRect(er.x * s, er.y * s, er.w * s, er.h * s);
  });

  ann.highlights.forEach(hl => {
    ctx.globalAlpha = hl.opacity || 0.4;
    ctx.fillStyle = hl.color;
    ctx.fillRect(hl.x * s, hl.y * s, hl.w * s, hl.h * s);
    ctx.globalAlpha = 1;
  });

  ann.drawings.forEach(d => {
    if (d.points.length < 2) return;
    ctx.globalAlpha = d.opacity || 1;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.size * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(d.points[0].x * s, d.points[0].y * s);
    for (let i = 1; i < d.points.length - 1; i++) {
      const xc = (d.points[i].x + d.points[i+1].x) / 2 * s;
      const yc = (d.points[i].y + d.points[i+1].y) / 2 * s;
      ctx.quadraticCurveTo(d.points[i].x * s, d.points[i].y * s, xc, yc);
    }
    const last = d.points[d.points.length - 1];
    ctx.lineTo(last.x * s, last.y * s);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  ann.textEdits.forEach((te, idx) => {
    if (te.hidden) return;
    ctx.save();
    ctx.fillStyle = te.color || '#000';
    const fontStyle = (te.italic ? 'italic ' : '') + (te.bold ? 'bold ' : '');
    const fontFam = te.fontFamily && te.fontFamily.includes(' ') ? `"${te.fontFamily}"` : (te.fontFamily || 'sans-serif');
    ctx.font = `${fontStyle}${te.size * s}px ${fontFam}`;
    ctx.textBaseline = 'top';
    const lines = te.text.split('\n');
    let maxWidth = 0;
    lines.forEach((line, i) => {
      const lineY = (te.y + i * te.size * 1.2) * s;
      ctx.fillText(line, te.x * s, lineY);
      const metrics = ctx.measureText(line);
      maxWidth = Math.max(maxWidth, metrics.width);
      if (te.underline && line) {
        const underlineY = lineY + te.size * s * 1.05;
        ctx.strokeStyle = te.color || '#000';
        ctx.lineWidth = Math.max(1, te.size * s * 0.08);
        ctx.beginPath();
        ctx.moveTo(te.x * s, underlineY);
        ctx.lineTo(te.x * s + metrics.width, underlineY);
        ctx.stroke();
      }
    });
    if (idx === state.selectedTextEditIdx && state.tool === 'select') {
      const totalHeight = lines.length * te.size * 1.2 * s;
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(te.x * s - 4, te.y * s - 4, maxWidth + 8, totalHeight + 8);
      ctx.setLineDash([]);
      const handleSize = 6;
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(te.x * s - 4 - handleSize/2, te.y * s - 4 - handleSize/2, handleSize, handleSize);
      ctx.fillRect(te.x * s + maxWidth + 4 - handleSize/2, te.y * s - 4 - handleSize/2, handleSize, handleSize);
      ctx.fillRect(te.x * s - 4 - handleSize/2, te.y * s + totalHeight + 4 - handleSize/2, handleSize, handleSize);
      ctx.fillRect(te.x * s + maxWidth + 4 - handleSize/2, te.y * s + totalHeight + 4 - handleSize/2, handleSize, handleSize);
    }
    ctx.restore();
  });

  ann.pageNumbers.forEach(pn => {
    ctx.save();
    ctx.fillStyle = pn.color || '#000';
    const fontStyle = (pn.italic ? 'italic ' : '') + (pn.bold ? 'bold ' : '');
    const fontFam = pn.fontFamily && pn.fontFamily.includes(' ') ? `"${pn.fontFamily}"` : (pn.fontFamily || 'sans-serif');
    ctx.font = `${fontStyle}${pn.size * s}px ${fontFam}`;
    ctx.textBaseline = 'top';
    const metrics = ctx.measureText(pn.text);
    let x = pn.x * s, y = pn.y * s;
    if (pn.align === 'center') x = pn.x * s - metrics.width / 2;
    else if (pn.align === 'right') x = pn.x * s - metrics.width;
    ctx.fillText(pn.text, x, y);
    if (pn.underline) {
      const underlineY = y + pn.size * s * 1.05;
      ctx.strokeStyle = pn.color || '#000';
      ctx.lineWidth = Math.max(1, pn.size * s * 0.08);
      ctx.beginPath();
      ctx.moveTo(x, underlineY);
      ctx.lineTo(x + metrics.width, underlineY);
      ctx.stroke();
    }
    ctx.restore();
  });

  updateTextEditActions();
}

function updateTextEditActions() {
  if (state.tool !== 'select' || state.selectedTextEditIdx < 0) {
    textEditActions.style.display = 'none';
    return;
  }
  const ann = state.annotations[state.currentPage];
  const te = ann.textEdits[state.selectedTextEditIdx];
  if (!te || te.hidden) {
    textEditActions.style.display = 'none';
    return;
  }
  const bounds = getTextEditBounds(te);
  const x = (bounds.x + bounds.w) * state.scale + 10;
  const y = bounds.y * state.scale - 10;
  textEditActions.style.display = 'flex';
  textEditActions.style.left = x + 'px';
  textEditActions.style.top = Math.max(0, y) + 'px';
}

deleteSelectedTextBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (state.selectedTextEditIdx < 0) return;
  pushHistory();
  const ann = state.annotations[state.currentPage];
  ann.textEdits.splice(state.selectedTextEditIdx, 1);
  state.selectedTextEditIdx = -1;
  renderAnnotations();
  autosave();
  showToast('Text deleted');
});

editSelectedTextBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (state.selectedTextEditIdx < 0) return;
  openTextEditBox(state.selectedTextEditIdx);
});

function startEditSpan(span, item, viewport) {
  if (state.activeTextBox) commitTextBox();
  const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
  const fontHeight = Math.hypot(tx[2], tx[3]);

  const box = document.createElement('div');
  box.className = 'text-edit-box';
  box.contentEditable = 'true';
  box.textContent = item.str;
  box.style.left = tx[4] + 'px';
  box.style.top = (tx[5] - fontHeight) + 'px';
  box.style.fontSize = fontHeight + 'px';
  const resolvedFont = resolveFontFamily(item.fontName, item.str);
  box.style.fontFamily = resolvedFont.includes(' ') && !resolvedFont.startsWith('"') ? `"${resolvedFont}"` : resolvedFont;
  box.style.color = 'black';
  box.style.fontWeight = 'normal';
  box.style.fontStyle = 'normal';
  box.style.textDecoration = 'none';
  box.style.minWidth = Math.max(40, span.offsetWidth) + 'px';
  box.dataset.origIdx = span.dataset.idx;
  box.dataset.origText = item.str;
  box.dataset.fontName = item.fontName;
  box.dataset.bold = 'false';
  box.dataset.italic = 'false';
  box.dataset.underline = 'false';

  span.style.visibility = 'hidden';
  textLayer.appendChild(box);
  state.activeTextBox = box;
  box.focus();

  const range = document.createRange();
  range.selectNodeContents(box);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  updatePropsForText({
    fontFamily: detectFontFromName(item.fontName),
    fontSize: Math.round(fontHeight / state.scale),
    text: item.str
  });

  box.addEventListener('blur', () => commitTextBox());
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { box.blur(); }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); box.blur(); }
  });
}

function resolveFontFamily(fontName, text) {
  const detected = detectFontFromName(fontName);
  if (detected === 'Kruti Dev 010' || detected === 'Kruti Dev 014') {
    if (state.krutiFontsLoaded[detected]) return detected;
    return detected;
  }
  if (looksLikeKruti(text)) {
    if (state.krutiFontsLoaded['Kruti Dev 010']) return 'Kruti Dev 010';
    if (state.krutiFontsLoaded['Kruti Dev 014']) return 'Kruti Dev 014';
  }
  if (/[\u0900-\u097F]/.test(text)) return 'Noto Sans Devanagari, Mangal, sans-serif';
  return 'sans-serif';
}

function commitTextBox() {
  const box = state.activeTextBox;
  if (!box) return;
  const newText = box.textContent;
  const origText = box.dataset.origText;
  const capturedSpans = box.dataset.capturedSpans;

  if (newText !== origText || box.dataset.isNew === 'true' || capturedSpans) {
    pushHistory();
    const ann = state.annotations[state.currentPage];
    const idx = box.dataset.origIdx != null ? parseInt(box.dataset.origIdx) : -1;
    const viewport = state.pages[state.currentPage - 1].viewport;

    let x, y, width, height;
    if (idx >= 0) {
      const item = state.pages[state.currentPage - 1].textItems[idx];
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const fontHeight = Math.hypot(tx[2], tx[3]);
      x = tx[4] / state.scale;
      y = (tx[5] - fontHeight) / state.scale;
      width = Math.max(box.offsetWidth, 40) / state.scale;
      height = fontHeight * 1.3 / state.scale;
    } else {
      x = parseFloat(box.style.left) / state.scale;
      y = parseFloat(box.style.top) / state.scale;
      width = Math.max(box.offsetWidth, 40) / state.scale;
      height = parseFloat(box.style.fontSize);
    }

    // If we captured original spans, erase them
    if (capturedSpans) {
      const spanIdxs = capturedSpans.split(',').map(s => parseInt(s)).filter(n => !isNaN(n));
      // Compute bounding box of all captured spans
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      spanIdxs.forEach(si => {
        const item = state.pages[state.currentPage - 1].textItems[si];
        if (!item) return;
        const vp = state.pages[state.currentPage - 1].viewport;
        const tx = pdfjsLib.Util.transform(vp.transform, item.transform);
        const fh = Math.hypot(tx[2], tx[3]);
        minX = Math.min(minX, tx[4] / state.scale);
        minY = Math.min(minY, (tx[5] - fh) / state.scale);
        const spanW = (textLayer.querySelector(`span[data-idx="${si}"]`)?.offsetWidth || 40) / state.scale;
        maxX = Math.max(maxX, (tx[4] / state.scale) + spanW);
        maxY = Math.max(maxY, (tx[5] / state.scale));
      });
      if (minX !== Infinity) {
        ann.erasures.push({
          x: minX - 2 / state.scale,
          y: minY - 2 / state.scale,
          w: (maxX - minX) + 4 / state.scale,
          h: (maxY - minY) + 4 / state.scale
        });
      }
    } else if (idx >= 0) {
      ann.erasures.push({ x, y, w: width + 4 / state.scale, h: height });
    }

    const fontFam = box.style.fontFamily.replace(/^"(.*)"$/, '$1');
    ann.textEdits.push({
      x, y,
      text: newText,
      size: parseFloat(box.style.fontSize) / state.scale,
      fontFamily: fontFam,
      color: rgbToHex(box.style.color) || '#000',
      bold: box.dataset.bold === 'true',
      italic: box.dataset.italic === 'true',
      underline: box.dataset.underline === 'true'
    });
    renderAnnotations();
    autosave();
  }
  box.remove();
  state.activeTextBox = null;
}

function rgbToHex(rgb) {
  if (!rgb) return null;
  if (rgb.startsWith('#')) return rgb;
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return null;
  return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

function highlightSpan(span, item, viewport) {
  pushHistory();
  const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
  const fontHeight = Math.hypot(tx[2], tx[3]);
  const width = span.offsetWidth || 40;
  const ann = state.annotations[state.currentPage];
  ann.highlights.push({
    x: tx[4] / state.scale, y: (tx[5] - fontHeight) / state.scale,
    w: width / state.scale, h: fontHeight * 1.1 / state.scale,
    color: state.highlightColor, opacity: state.highlightOpacity
  });
  renderAnnotations();
  autosave();
  showToast('Highlighted', 'success');
}

function eraseSpan(span, item, viewport) {
  pushHistory();
  const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
  const fontHeight = Math.hypot(tx[2], tx[3]);
  const width = span.offsetWidth || 40;
  const ann = state.annotations[state.currentPage];
  ann.erasures.push({
    x: tx[4] / state.scale, y: (tx[5] - fontHeight) / state.scale,
    w: (width + 4) / state.scale, h: fontHeight * 1.3 / state.scale
  });
  span.style.visibility = 'hidden';
  renderAnnotations();
  autosave();
  showToast('Erased', 'success');
}

function getCanvasPoint(e) {
  const rect = annotationCanvas.getBoundingClientRect();
  const scaleX = annotationCanvas.width / rect.width;
  const scaleY = annotationCanvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: ((clientX - rect.left) * scaleX) / state.scale,
    y: ((clientY - rect.top) * scaleY) / state.scale,
    cssX: (clientX - rect.left) * scaleX,
    cssY: (clientY - rect.top) * scaleY
  };
}

/* ---------- Text Tool: click / drag-to-create ---------- */
function startTextDrag(e) {
  if (state.tool !== 'text') return;
  if (e.touches && e.touches.length > 1) return;
  e.preventDefault();
  const pt = getCanvasPoint(e);
  state.textDrag = {
    startPdf: { x: pt.x, y: pt.y }, startCss: { x: pt.cssX, y: pt.cssY },
    currentPdf: { x: pt.x, y: pt.y }, currentCss: { x: pt.cssX, y: pt.cssY },
    moved: false
  };
}

function moveTextDrag(e) {
  if (!state.textDrag) return;
  if (e.touches && e.touches.length > 1) return;
  e.preventDefault();
  const pt = getCanvasPoint(e);
  state.textDrag.currentPdf = { x: pt.x, y: pt.y };
  state.textDrag.currentCss = { x: pt.cssX, y: pt.cssY };
  const dx = pt.cssX - state.textDrag.startCss.x;
  const dy = pt.cssY - state.textDrag.startCss.y;
  if (Math.hypot(dx, dy) > 5) state.textDrag.moved = true;

  renderAnnotations();
  if (state.textDrag.moved) {
    const ctx = annotationCanvas.getContext('2d');
    const x = Math.min(state.textDrag.startCss.x, state.textDrag.currentCss.x);
    const y = Math.min(state.textDrag.startCss.y, state.textDrag.currentCss.y);
    const w = Math.abs(state.textDrag.currentCss.x - state.textDrag.startCss.x);
    const h = Math.abs(state.textDrag.currentCss.y - state.textDrag.startCss.y);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }
}

function endTextDrag(e) {
  if (!state.textDrag) return;
  const drag = state.textDrag;
  state.textDrag = null;

  if (drag.moved) {
    const x = Math.min(drag.startCss.x, drag.currentCss.x);
    const y = Math.min(drag.startCss.y, drag.currentCss.y);
    const w = Math.abs(drag.currentCss.x - drag.startCss.x);
    const h = Math.abs(drag.currentCss.y - drag.startCss.y);
    renderAnnotations();
    createTextBox(x, y, w, h);
  } else {
    renderAnnotations();
    createTextBox(drag.startCss.x, drag.startCss.y, null, null);
  }
}

function createTextBox(cssX, cssY, cssWidth, cssHeight) {
  if (state.activeTextBox) commitTextBox();
  const box = document.createElement('div');
  box.className = 'text-edit-box';
  box.contentEditable = 'true';
  box.textContent = '';
  box.style.left = cssX + 'px';
  box.style.top = cssY + 'px';
  box.style.fontSize = state.fontSize + 'px';
  const ff = state.fontFamily === 'Auto Detect' ? 'sans-serif' : state.fontFamily;
  box.style.fontFamily = ff.includes(' ') ? `"${ff}"` : ff;
  box.style.color = state.textColor;
  box.style.fontWeight = state.bold ? 'bold' : 'normal';
  box.style.fontStyle = state.italic ? 'italic' : 'normal';
  box.style.textDecoration = state.underline ? 'underline' : 'none';
  if (cssWidth != null) {
    box.style.width = cssWidth + 'px';
    box.style.minWidth = cssWidth + 'px';
  } else {
    box.style.minWidth = '120px';
  }
  if (cssHeight != null) box.style.minHeight = cssHeight + 'px';
  box.dataset.isNew = 'true';
  box.dataset.bold = state.bold ? 'true' : 'false';
  box.dataset.italic = state.italic ? 'true' : 'false';
  box.dataset.underline = state.underline ? 'true' : 'false';
  textLayer.appendChild(box);
  state.activeTextBox = box;
  box.focus();
  box.addEventListener('blur', () => {
    if (!box.textContent.trim()) { box.remove(); state.activeTextBox = null; return; }
    pushHistory();
    const ann = state.annotations[state.currentPage];
    ann.textEdits.push({
      x: parseFloat(box.style.left) / state.scale,
      y: parseFloat(box.style.top) / state.scale,
      text: box.textContent,
      size: parseFloat(box.style.fontSize),
      fontFamily: box.style.fontFamily.replace(/^"(.*)"$/, '$1'),
      color: rgbToHex(box.style.color) || state.textColor,
      bold: box.dataset.bold === 'true',
      italic: box.dataset.italic === 'true',
      underline: box.dataset.underline === 'true'
    });
    box.remove();
    state.activeTextBox = null;
    renderAnnotations();
    autosave();
  });
}

function openTextEditBox(idx) {
  if (state.activeTextBox) commitTextBox();
  const ann = state.annotations[state.currentPage];
  const te = ann.textEdits[idx];
  if (!te) return;

  const cssX = te.x * state.scale;
  const cssY = te.y * state.scale;
  const box = document.createElement('div');
  box.className = 'text-edit-box';
  box.contentEditable = 'true';
  box.textContent = te.text;
  box.style.left = cssX + 'px';
  box.style.top = cssY + 'px';
  box.style.fontSize = (te.size * state.scale) + 'px';
  const fontFam = te.fontFamily && te.fontFamily.includes(' ') ? `"${te.fontFamily}"` : (te.fontFamily || 'sans-serif');
  box.style.fontFamily = fontFam;
  box.style.color = te.color || '#000';
  box.style.fontWeight = te.bold ? 'bold' : 'normal';
  box.style.fontStyle = te.italic ? 'italic' : 'normal';
  box.style.textDecoration = te.underline ? 'underline' : 'none';
  box.dataset.editIdx = idx;
  textLayer.appendChild(box);
  state.activeTextBox = box;
  box.focus();

  const range = document.createRange();
  range.selectNodeContents(box);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  box.addEventListener('blur', () => {
    const newText = box.textContent;
    if (newText !== te.text) {
      pushHistory();
      te.text = newText;
      autosave();
    }
    box.remove();
    state.activeTextBox = null;
    state.selectedTextEditIdx = -1;
    renderAnnotations();
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { box.blur(); }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); box.blur(); }
  });
}

pdfCanvasWrap.addEventListener('dblclick', (e) => {
  if (state.activeTextBox) return;
  if (e.target.closest('.text-edit-box')) return;
  if (e.target.closest('#textEditActions')) return;
  if (e.target.tagName === 'SPAN' && state.tool === 'edit') return;
  e.preventDefault();
  const pt = getCanvasPoint(e);
  createTextBox(pt.cssX, pt.cssY, null, null);
});

annotationCanvas.addEventListener('dblclick', (e) => {
  if (state.activeTextBox) return;
  const pt = getCanvasPoint(e);
  const ann = state.annotations[state.currentPage];

  for (let i = ann.textEdits.length - 1; i >= 0; i--) {
    const te = ann.textEdits[i];
    if (te.hidden) continue;
    const bounds = getTextEditBounds(te);
    if (pt.x >= bounds.x && pt.x <= bounds.x + bounds.w &&
        pt.y >= bounds.y && pt.y <= bounds.y + bounds.h) {
      state.selectedTextEditIdx = i;
      openTextEditBox(i);
      renderAnnotations();
      return;
    }
  }
});

/* ---------- Pencil drawing ---------- */
function startDraw(e) {
  if (state.tool !== 'pencil') return;
  if (e.touches && e.touches.length > 1) return;
  e.preventDefault();
  state.isDrawing = true;
  const pt = getCanvasPoint(e);
  state.currentStroke = {
    points: [{ x: pt.x, y: pt.y }],
    color: state.pencilColor,
    size: state.pencilSize / state.scale,
    opacity: state.pencilOpacity
  };
}

function moveDraw(e) {
  if (!state.isDrawing || !state.currentStroke) return;
  if (e.touches && e.touches.length > 1) return;
  e.preventDefault();
  const pt = getCanvasPoint(e);
  state.currentStroke.points.push({ x: pt.x, y: pt.y });
  renderAnnotations();
  const ctx = annotationCanvas.getContext('2d');
  const d = state.currentStroke;
  const s = state.scale;
  ctx.globalAlpha = d.opacity;
  ctx.strokeStyle = d.color;
  ctx.lineWidth = d.size * s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (d.points.length === 1) {
    ctx.arc(d.points[0].x * s, d.points[0].y * s, d.size * s / 2, 0, Math.PI * 2);
    ctx.fillStyle = d.color;
    ctx.fill();
  } else {
    ctx.moveTo(d.points[0].x * s, d.points[0].y * s);
    for (let i = 1; i < d.points.length - 1; i++) {
      const xc = (d.points[i].x + d.points[i+1].x) / 2 * s;
      const yc = (d.points[i].y + d.points[i+1].y) / 2 * s;
      ctx.quadraticCurveTo(d.points[i].x * s, d.points[i].y * s, xc, yc);
    }
    const last = d.points[d.points.length - 1];
    ctx.lineTo(last.x * s, last.y * s);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function endDraw(e) {
  if (!state.isDrawing) return;
  state.isDrawing = false;
  if (state.currentStroke && state.currentStroke.points.length > 0) {
    pushHistory();
    state.annotations[state.currentPage].drawings.push(state.currentStroke);
    autosave();
  }
  state.currentStroke = null;
  renderAnnotations();
}

/* ---------- Area eraser ---------- */
let areaEraseRect = null;
function startAreaErase(e) {
  if (state.tool !== 'eraser') return;
  if (e.target.closest('.text-edit-box')) return;
  if (e.target.tagName === 'SPAN') return;
  e.preventDefault();
  state.isDrawing = true;
  areaEraseRect = { start: getCanvasPoint(e), end: null };
}
function moveAreaErase(e) {
  if (!state.isDrawing || !areaEraseRect) return;
  e.preventDefault();
  areaEraseRect.end = getCanvasPoint(e);
  renderAnnotations();
  const ctx = annotationCanvas.getContext('2d');
  const s = state.scale;
  const x = Math.min(areaEraseRect.start.x, areaEraseRect.end.x) * s;
  const y = Math.min(areaEraseRect.start.y, areaEraseRect.end.y) * s;
  const w = Math.abs(areaEraseRect.end.x - areaEraseRect.start.x) * s;
  const h = Math.abs(areaEraseRect.end.y - areaEraseRect.start.y) * s;
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}
function endAreaErase(e) {
  if (!state.isDrawing || !areaEraseRect || !areaEraseRect.end) {
    state.isDrawing = false; areaEraseRect = null; return;
  }
  const x = Math.min(areaEraseRect.start.x, areaEraseRect.end.x);
  const y = Math.min(areaEraseRect.start.y, areaEraseRect.end.y);
  const w = Math.abs(areaEraseRect.end.x - areaEraseRect.start.x);
  const h = Math.abs(areaEraseRect.end.y - areaEraseRect.start.y);
  if (w > 5 / state.scale && h > 5 / state.scale) {
    pushHistory();
    const ann = state.annotations[state.currentPage];
    ann.drawings = ann.drawings.filter(d =>
      !d.points.some(p => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h)
    );
    ann.highlights = ann.highlights.filter(hl =>
      !(hl.x + hl.w < x || hl.x > x + w || hl.y + hl.h < y || hl.y > y + h)
    );
    ann.erasures.push({ x, y, w, h });
    renderAnnotations();
    autosave();
    showToast('Area erased', 'success');
  }
  state.isDrawing = false;
  areaEraseRect = null;
  renderAnnotations();
}

/* ---------- Select tool: click to select text edit, drag to capture original text ---------- */
function startSelectDrag(e) {
  if (state.tool !== 'select') return;
  if (e.touches && e.touches.length > 1) return;
  if (e.target.closest('#textEditActions')) return;
  e.preventDefault();
  const pt = getCanvasPoint(e);
  const ann = state.annotations[state.currentPage];

  // First check if clicking on an existing text edit
  let clickedIdx = -1;
  for (let i = ann.textEdits.length - 1; i >= 0; i--) {
    const te = ann.textEdits[i];
    if (te.hidden) continue;
    const bounds = getTextEditBounds(te);
    if (pt.x >= bounds.x && pt.x <= bounds.x + bounds.w &&
        pt.y >= bounds.y && pt.y <= bounds.y + bounds.h) {
      clickedIdx = i;
      break;
    }
  }

  if (clickedIdx >= 0) {
    // Select existing text edit for moving
    state.selectedTextEditIdx = clickedIdx;
    state.isDraggingTextEdit = true;
    state.dragStartPdf = { x: pt.x, y: pt.y };
    state.dragOrigPos = { x: ann.textEdits[clickedIdx].x, y: ann.textEdits[clickedIdx].y };
    state.selectRectDrag = null;
    renderAnnotations();
  } else {
    // Start rectangle drag to capture original text
    state.selectedTextEditIdx = -1;
    state.selectRectDrag = {
      startCss: { x: pt.cssX, y: pt.cssY },
      currentCss: { x: pt.cssX, y: pt.cssY },
      moved: false
    };
    renderAnnotations();
  }
}

function moveSelectDrag(e) {
  if (state.tool !== 'select') return;
  if (e.touches && e.touches.length > 1) return;

  if (state.isDraggingTextEdit) {
    e.preventDefault();
    const pt = getCanvasPoint(e);
    const dx = pt.x - state.dragStartPdf.x;
    const dy = pt.y - state.dragStartPdf.y;
    const ann = state.annotations[state.currentPage];
    ann.textEdits[state.selectedTextEditIdx].x = state.dragOrigPos.x + dx;
    ann.textEdits[state.selectedTextEditIdx].y = state.dragOrigPos.y + dy;
    renderAnnotations();
  } else if (state.selectRectDrag) {
    e.preventDefault();
    const pt = getCanvasPoint(e);
    state.selectRectDrag.currentCss = { x: pt.cssX, y: pt.cssY };
    const dx = pt.cssX - state.selectRectDrag.startCss.x;
    const dy = pt.cssY - state.selectRectDrag.startCss.y;
    if (Math.hypot(dx, dy) > 5) state.selectRectDrag.moved = true;

    renderAnnotations();
    if (state.selectRectDrag.moved) {
      const ctx = annotationCanvas.getContext('2d');
      const x = Math.min(state.selectRectDrag.startCss.x, state.selectRectDrag.currentCss.x);
      const y = Math.min(state.selectRectDrag.startCss.y, state.selectRectDrag.currentCss.y);
      const w = Math.abs(state.selectRectDrag.currentCss.x - state.selectRectDrag.startCss.x);
      const h = Math.abs(state.selectRectDrag.currentCss.y - state.selectRectDrag.startCss.y);
      // Draw selection rectangle with green tint to indicate capture mode
      ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);

      // Preview: highlight spans that will be captured
      const spans = findSpansInCssRect(x, y, w, h);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
      spans.forEach(span => {
        const rect = span.getBoundingClientRect();
        const layerRect = textLayer.getBoundingClientRect();
        ctx.fillRect(rect.left - layerRect.left, rect.top - layerRect.top, rect.width, rect.height);
      });
    }
  }
}

function endSelectDrag(e) {
  if (state.tool !== 'select') return;

  if (state.isDraggingTextEdit) {
    state.isDraggingTextEdit = false;
    const ann = state.annotations[state.currentPage];
    const te = ann.textEdits[state.selectedTextEditIdx];
    if (te.x !== state.dragOrigPos.x || te.y !== state.dragOrigPos.y) {
      pushHistory();
      autosave();
    }
    state.dragStartPdf = null;
    state.dragOrigPos = null;
  } else if (state.selectRectDrag) {
    const drag = state.selectRectDrag;
    state.selectRectDrag = null;

    if (drag.moved) {
      const x = Math.min(drag.startCss.x, drag.currentCss.x);
      const y = Math.min(drag.startCss.y, drag.currentCss.y);
      const w = Math.abs(drag.currentCss.x - drag.startCss.x);
      const h = Math.abs(drag.currentCss.y - drag.startCss.y);

      // Find spans in the rectangle
      const spans = findSpansInCssRect(x, y, w, h);

      renderAnnotations();

      if (spans.length === 0) {
        showToast('No text found in selection', 'error');
      } else {
        // Create editable text box from captured spans
        createEditBoxFromSpans(spans, x, y, w, h);
        showToast(`${spans.length} text span(s) captured — font auto-detected`, 'success');
      }
    } else {
      // Just a click on empty area — deselect
      renderAnnotations();
    }
  }
}

/* ---------- Tool switching ---------- */
function setTool(tool) {
  state.tool = tool;
  document.querySelectorAll('[data-tool]').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
  if (state.activeTextBox) commitTextBox();
  if (tool !== 'select') state.selectedTextEditIdx = -1;

  annotationCanvas.classList.remove('active');
  annotationCanvas.style.cursor = 'default';
  textLayer.style.pointerEvents = 'none';

  if (tool === 'pencil') {
    annotationCanvas.classList.add('active');
    annotationCanvas.style.cursor = 'crosshair';
  } else if (tool === 'eraser') {
    annotationCanvas.classList.add('active');
    annotationCanvas.style.cursor = 'cell';
    textLayer.style.pointerEvents = 'auto';
  } else if (tool === 'text') {
    annotationCanvas.classList.add('active');
    annotationCanvas.style.cursor = 'text';
  } else if (tool === 'select') {
    annotationCanvas.classList.add('active');
    annotationCanvas.style.cursor = 'default';
    // Enable textLayer pointer events so spans can be detected during rect drag
    textLayer.style.pointerEvents = 'auto';
  } else if (tool === 'edit' || tool === 'highlight') {
    textLayer.style.pointerEvents = 'auto';
    annotationCanvas.style.cursor = tool === 'highlight' ? 'help' : 'text';
  }

  updateSecondaryToolbar();
  updatePropsPanel();
  renderAnnotations();
}

function updateSecondaryToolbar() {
  const t = state.tool;
  let html = '';
  if (t === 'pencil') {
    html = `
      <span style="font-size:12px;color:var(--muted);margin-right:4px;">Color</span>
      <input type="color" class="color-swatch" id="pencilColorInput" value="${state.pencilColor}" />
      <span style="font-size:12px;color:var(--muted);margin:0 4px 0 12px;">Size</span>
      <select class="sec-select" id="pencilSizeSelect">
        ${[1,2,3,5,8,12].map(s => `<option value="${s}" ${s===state.pencilSize?'selected':''}>${s} px</option>`).join('')}
      </select>
      <span style="font-size:12px;color:var(--muted);margin:0 4px 0 12px;">Opacity</span>
      <input type="range" min="0.1" max="1" step="0.1" value="${state.pencilOpacity}" id="pencilOpacity" style="width:80px;" />
    `;
  } else if (t === 'highlight') {
    html = `
      <span style="font-size:12px;color:var(--muted);">Color</span>
      ${['#fde047','#86efac','#93c5fd','#f9a8d4','#fdba74'].map(c =>
        `<div class="color-swatch" style="background:${c};${c===state.highlightColor?'outline:2px solid var(--accent);':''}" data-hl-color="${c}"></div>`
      ).join('')}
      <input type="color" class="color-swatch" id="hlColorInput" value="${state.highlightColor}" />
      <span style="font-size:12px;color:var(--muted);margin-left:12px;">Opacity</span>
      <input type="range" min="0.1" max="1" step="0.1" value="${state.highlightOpacity}" id="hlOpacity" style="width:80px;" />
    `;
  } else if (t === 'edit' || t === 'text') {
    html = `
      <select class="sec-select" id="fontFamilySelect">
        <option ${state.fontFamily==='Auto Detect'?'selected':''}>Auto Detect</option>
        <option ${state.fontFamily==='Kruti Dev 010'?'selected':''}>Kruti Dev 010</option>
        <option ${state.fontFamily==='Kruti Dev 014'?'selected':''}>Kruti Dev 014</option>
        <option ${state.fontFamily==='Arial'?'selected':''}>Arial</option>
        <option ${state.fontFamily==='Times New Roman'?'selected':''}>Times New Roman</option>
        <option ${state.fontFamily==='Helvetica'?'selected':''}>Helvetica</option>
        <option ${state.fontFamily==='Courier'?'selected':''}>Courier</option>
        <option ${state.fontFamily==='Noto Sans Devanagari'?'selected':''}>Noto Sans Devanagari</option>
      </select>
      <button class="sec-btn" id="fontSizeDec">−</button>
      <input type="number" class="sec-input" id="fontSizeInput" value="${state.fontSize}" min="6" max="200" />
      <button class="sec-btn" id="fontSizeInc">+</button>
      <button class="sec-btn ${state.bold?'active':''}" id="boldBtn" title="Bold"><b>B</b></button>
      <button class="sec-btn ${state.italic?'active':''}" id="italicBtn" title="Italic"><i>I</i></button>
      <button class="sec-btn ${state.underline?'active':''}" id="underlineBtn" title="Underline"><u>U</u></button>
      <input type="color" class="color-swatch" id="textColorInput" value="${state.textColor}" />
      ${t === 'text' ? '<span style="font-size:11px;color:var(--muted);margin-left:8px;">Tip: click, drag, or double-click page</span>' : ''}
    `;
  } else if (t === 'eraser') {
    html = `
      <span style="font-size:12px;color:var(--muted);">Click text to erase, or drag to erase an area</span>
      <button class="sec-btn" id="clearPageAnnsBtn">Clear page annotations</button>
    `;
  } else if (t === 'select') {
    html = `
      <span style="font-size:12px;color:var(--muted);">
        <b>Select:</b> click added text to move · drag rectangle over original text to capture & auto-detect font
      </span>
    `;
  } else {
    html = `<span style="font-size:12px;color:var(--muted);">Tip: double-click anywhere on the page to add text</span>`;
  }
  secondaryToolbar.innerHTML = html;
  secondaryToolbar.classList.add('active');
  bindSecondaryEvents();
}

function bindSecondaryEvents() {
  const pencilColor = $('pencilColorInput');
  if (pencilColor) pencilColor.addEventListener('input', e => state.pencilColor = e.target.value);
  const pencilSize = $('pencilSizeSelect');
  if (pencilSize) pencilSize.addEventListener('change', e => state.pencilSize = parseInt(e.target.value));
  const pencilOp = $('pencilOpacity');
  if (pencilOp) pencilOp.addEventListener('input', e => state.pencilOpacity = parseFloat(e.target.value));

  const hlColor = $('hlColorInput');
  if (hlColor) hlColor.addEventListener('input', e => state.highlightColor = e.target.value);
  document.querySelectorAll('[data-hl-color]').forEach(el => {
    el.addEventListener('click', () => { state.highlightColor = el.dataset.hlColor; updateSecondaryToolbar(); });
  });
  const hlOp = $('hlOpacity');
  if (hlOp) hlOp.addEventListener('input', e => state.highlightOpacity = parseFloat(e.target.value));

  const ff = $('fontFamilySelect');
  if (ff) ff.addEventListener('change', e => {
    state.fontFamily = e.target.value;
    if (state.activeTextBox) {
      const v = e.target.value === 'Auto Detect' ? 'sans-serif' : e.target.value;
      state.activeTextBox.style.fontFamily = v.includes(' ') ? `"${v}"` : v;
    }
  });
  const fsInput = $('fontSizeInput');
  if (fsInput) fsInput.addEventListener('change', e => {
    state.fontSize = parseInt(e.target.value) || 14;
    if (state.activeTextBox) state.activeTextBox.style.fontSize = state.fontSize + 'px';
  });
  const fsDec = $('fontSizeDec');
  if (fsDec) fsDec.addEventListener('click', () => {
    state.fontSize = Math.max(6, state.fontSize - 1);
    const inp = $('fontSizeInput'); if (inp) inp.value = state.fontSize;
    if (state.activeTextBox) state.activeTextBox.style.fontSize = state.fontSize + 'px';
  });
  const fsInc = $('fontSizeInc');
  if (fsInc) fsInc.addEventListener('click', () => {
    state.fontSize = Math.min(200, state.fontSize + 1);
    const inp = $('fontSizeInput'); if (inp) inp.value = state.fontSize;
    if (state.activeTextBox) state.activeTextBox.style.fontSize = state.fontSize + 'px';
  });
  const boldBtn = $('boldBtn');
  if (boldBtn) boldBtn.addEventListener('click', () => {
    state.bold = !state.bold;
    boldBtn.classList.toggle('active', state.bold);
    if (state.activeTextBox) {
      state.activeTextBox.style.fontWeight = state.bold ? 'bold' : 'normal';
      state.activeTextBox.dataset.bold = state.bold ? 'true' : 'false';
    }
  });
  const italicBtn = $('italicBtn');
  if (italicBtn) italicBtn.addEventListener('click', () => {
    state.italic = !state.italic;
    italicBtn.classList.toggle('active', state.italic);
    if (state.activeTextBox) {
      state.activeTextBox.style.fontStyle = state.italic ? 'italic' : 'normal';
      state.activeTextBox.dataset.italic = state.italic ? 'true' : 'false';
    }
  });
  const underlineBtn = $('underlineBtn');
  if (underlineBtn) underlineBtn.addEventListener('click', () => {
    state.underline = !state.underline;
    underlineBtn.classList.toggle('active', state.underline);
    if (state.activeTextBox) {
      state.activeTextBox.style.textDecoration = state.underline ? 'underline' : 'none';
      state.activeTextBox.dataset.underline = state.underline ? 'true' : 'false';
    }
  });
  const textColor = $('textColorInput');
  if (textColor) textColor.addEventListener('input', e => {
    state.textColor = e.target.value;
    if (state.activeTextBox) state.activeTextBox.style.color = e.target.value;
  });

  const clearBtn = $('clearPageAnnsBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (confirm('Clear all annotations on this page?')) {
      pushHistory();
      state.annotations[state.currentPage] = { drawings: [], highlights: [], textEdits: [], erasures: [], pageNumbers: [] };
      state.selectedTextEditIdx = -1;
      renderAnnotations();
      autosave();
      showToast('Page annotations cleared', 'success');
    }
  });
}

function updatePropsPanel() {
  const t = state.tool;
  let html = '';
  if (t === 'pencil') {
    html = `
      <div class="prop-section">
        <div class="prop-title">Pencil</div>
        <div class="prop-row">
          <label style="font-size:12px;width:100%;">Color</label>
          <input type="color" class="prop-input" style="height:40px;padding:2px;" value="${state.pencilColor}" id="propPencilColor" />
        </div>
        <div class="prop-row">
          <label style="font-size:12px;width:100%;">Size</label>
          <select class="prop-select" id="propPencilSize">
            ${[1,2,3,5,8,12].map(s => `<option value="${s}" ${s===state.pencilSize?'selected':''}>${s} px</option>`).join('')}
          </select>
        </div>
        <div class="prop-row">
          <label style="font-size:12px;width:100%;">Opacity: ${Math.round(state.pencilOpacity*100)}%</label>
          <input type="range" min="0.1" max="1" step="0.1" value="${state.pencilOpacity}" style="width:100%;" id="propPencilOp" />
        </div>
      </div>
    `;
  } else if (t === 'highlight') {
    html = `
      <div class="prop-section">
        <div class="prop-title">Highlight</div>
        <div class="prop-row"><label style="font-size:12px;width:100%;">Color</label></div>
        <div class="color-grid">
          ${['#fde047','#86efac','#93c5fd','#f9a8d4','#fdba74','#c4b5fd','#fca5a5','#a7f3d0'].map(c =>
            `<div class="color-tile ${c===state.highlightColor?'active':''}" style="background:${c}" data-hl-tile="${c}"></div>`
          ).join('')}
        </div>
        <div class="prop-row" style="margin-top:12px;">
          <label style="font-size:12px;width:100%;">Opacity: ${Math.round(state.highlightOpacity*100)}%</label>
          <input type="range" min="0.1" max="1" step="0.1" value="${state.highlightOpacity}" style="width:100%;" id="propHlOp" />
        </div>
        <p style="font-size:12px;color:var(--muted);margin-top:8px;">Click on any text to highlight it.</p>
      </div>
    `;
  } else if (t === 'edit' || t === 'text') {
    html = `
      <div class="prop-section">
        <div class="prop-title">Font</div>
        <div class="prop-row">
          <select class="prop-select" id="propFontFamily">
            <option ${state.fontFamily==='Auto Detect'?'selected':''}>Auto Detect</option>
            <option ${state.fontFamily==='Kruti Dev 010'?'selected':''}>Kruti Dev 010</option>
            <option ${state.fontFamily==='Kruti Dev 014'?'selected':''}>Kruti Dev 014</option>
            <option ${state.fontFamily==='Arial'?'selected':''}>Arial</option>
            <option ${state.fontFamily==='Times New Roman'?'selected':''}>Times New Roman</option>
            <option ${state.fontFamily==='Helvetica'?'selected':''}>Helvetica</option>
            <option ${state.fontFamily==='Courier'?'selected':''}>Courier</option>
            <option ${state.fontFamily==='Noto Sans Devanagari'?'selected':''}>Noto Sans Devanagari</option>
          </select>
        </div>
        <div class="prop-row">
          <button class="prop-btn" id="propFsDec">−</button>
          <input type="number" class="prop-input" value="${state.fontSize}" min="6" max="200" id="propFsInput" />
          <button class="prop-btn" id="propFsInc">+</button>
        </div>
        <div class="prop-row">
          <button class="prop-btn ${state.bold?'active':''}" id="propBold" title="Bold"><b>B</b></button>
          <button class="prop-btn ${state.italic?'active':''}" id="propItalic" title="Italic"><i>I</i></button>
          <button class="prop-btn ${state.underline?'active':''}" id="propUnderline" title="Underline"><u>U</u></button>
        </div>
        <div class="prop-row">
          <label style="font-size:12px;width:100%;">Color</label>
          <input type="color" class="prop-input" style="height:40px;padding:2px;" value="${state.textColor}" id="propTextColor" />
        </div>
      </div>
      <div class="prop-section">
        <div class="prop-title">Tip</div>
        <p style="font-size:12px;color:var(--muted);margin:0;">
          ${t === 'edit' ? 'Click on any text in the PDF to edit it. Hindi/Kruti Dev fonts are auto-detected.' : 'Click to add text, drag a rectangle for a sized box, or double-click anywhere on the page.'}
        </p>
      </div>
    `;
  } else if (t === 'eraser') {
    html = `
      <div class="prop-section">
        <div class="prop-title">Eraser</div>
        <p style="font-size:13px;color:var(--muted);">
          <b>Text mode:</b> Click text to erase.<br>
          <b>Area mode:</b> Click and drag to erase a region.
        </p>
        <p style="font-size:12px;color:var(--muted);margin-top:8px;">
          Erasures are non-destructive — they cover original content with white.
        </p>
        <button class="prop-btn" style="width:100%;margin-top:8px;" id="propClearPage">Clear all annotations</button>
      </div>
    `;
  } else if (t === 'select') {
    html = `
      <div class="prop-section">
        <div class="prop-title">Select & Capture</div>
        <p style="font-size:13px;color:var(--muted);">
          <b>Click</b> on text you've added to select it → drag to move.<br><br>
          <b>Drag a rectangle</b> over original PDF text to capture it. The app will auto-detect the font (English, Hindi, or Kruti Dev) and open an editable box.<br><br>
          Use the <b>✎</b> button to edit or <b>🗑</b> button to delete the selected added text.
        </p>
      </div>
    `;
  } else {
    html = `
      <div class="prop-section">
        <div class="prop-title">Welcome</div>
        <p style="font-size:13px;color:var(--muted);">Choose a tool from the top toolbar to start editing.</p>
        <ul style="font-size:12px;color:var(--muted);padding-left:18px;margin:8px 0;">
          <li><b>Edit</b> — modify existing text</li>
          <li><b>Text</b> — click, drag, or double-click to add text</li>
          <li><b>Select</b> — move added text, or drag rectangle to capture &amp; edit original text (auto-detects font)</li>
          <li><b>Highlight</b> — mark text</li>
          <li><b>Pencil</b> — draw freely</li>
          <li><b>Eraser</b> — remove annotations</li>
          <li><b>Page #</b> — add page numbers</li>
        </ul>
      </div>
    `;
  }
  propsPanel.innerHTML = html;
  bindPropsEvents();
}

function bindPropsEvents() {
  const pc = $('propPencilColor'); if (pc) pc.addEventListener('input', e => { state.pencilColor = e.target.value; updateSecondaryToolbar(); });
  const ps = $('propPencilSize'); if (ps) ps.addEventListener('change', e => { state.pencilSize = parseInt(e.target.value); updateSecondaryToolbar(); });
  const po = $('propPencilOp');
  if (po) po.addEventListener('input', e => {
    state.pencilOpacity = parseFloat(e.target.value);
    const lbl = po.previousElementSibling; if (lbl) lbl.textContent = 'Opacity: ' + Math.round(e.target.value*100) + '%';
    updateSecondaryToolbar();
  });
  const ho = $('propHlOp');
  if (ho) ho.addEventListener('input', e => {
    state.highlightOpacity = parseFloat(e.target.value);
    const lbl = ho.previousElementSibling; if (lbl) lbl.textContent = 'Opacity: ' + Math.round(e.target.value*100) + '%';
    updateSecondaryToolbar();
  });
  document.querySelectorAll('[data-hl-tile]').forEach(el => {
    el.addEventListener('click', () => {
      state.highlightColor = el.dataset.hlTile;
      updateSecondaryToolbar();
      updatePropsPanel();
    });
  });
  const ff = $('propFontFamily');
  if (ff) ff.addEventListener('change', e => {
    state.fontFamily = e.target.value;
    if (state.activeTextBox) {
      const v = e.target.value === 'Auto Detect' ? 'sans-serif' : e.target.value;
      state.activeTextBox.style.fontFamily = v.includes(' ') ? `"${v}"` : v;
    }
    updateSecondaryToolbar();
  });
  const fsi = $('propFsInput');
  if (fsi) fsi.addEventListener('change', e => {
    state.fontSize = parseInt(e.target.value) || 14;
    if (state.activeTextBox) state.activeTextBox.style.fontSize = state.fontSize + 'px';
    updateSecondaryToolbar();
  });
  const fd = $('propFsDec'); if (fd) fd.addEventListener('click', () => changeFontSize(-1));
  const fi = $('propFsInc'); if (fi) fi.addEventListener('click', () => changeFontSize(1));
  const bb = $('propBold'); if (bb) bb.addEventListener('click', () => toggleBold());
  const bi = $('propItalic'); if (bi) bi.addEventListener('click', () => toggleItalic());
  const bu = $('propUnderline'); if (bu) bu.addEventListener('click', () => toggleUnderline());
  const tc = $('propTextColor');
  if (tc) tc.addEventListener('input', e => {
    state.textColor = e.target.value;
    if (state.activeTextBox) state.activeTextBox.style.color = e.target.value;
    updateSecondaryToolbar();
  });
  const cp = $('propClearPage'); if (cp) cp.addEventListener('click', () => clearPageAnnotations());
}

function changeFontSize(delta) {
  state.fontSize = Math.max(6, Math.min(200, state.fontSize + delta));
  updateSecondaryToolbar();
  updatePropsPanel();
  if (state.activeTextBox) state.activeTextBox.style.fontSize = state.fontSize + 'px';
}
function toggleBold() {
  state.bold = !state.bold;
  updateSecondaryToolbar();
  updatePropsPanel();
  if (state.activeTextBox) {
    state.activeTextBox.style.fontWeight = state.bold ? 'bold' : 'normal';
    state.activeTextBox.dataset.bold = state.bold ? 'true' : 'false';
  }
}
function toggleItalic() {
  state.italic = !state.italic;
  updateSecondaryToolbar();
  updatePropsPanel();
  if (state.activeTextBox) {
    state.activeTextBox.style.fontStyle = state.italic ? 'italic' : 'normal';
    state.activeTextBox.dataset.italic = state.italic ? 'true' : 'false';
  }
}
function toggleUnderline() {
  state.underline = !state.underline;
  updateSecondaryToolbar();
  updatePropsPanel();
  if (state.activeTextBox) {
    state.activeTextBox.style.textDecoration = state.underline ? 'underline' : 'none';
    state.activeTextBox.dataset.underline = state.underline ? 'true' : 'false';
  }
}
function clearPageAnnotations() {
  if (confirm('Clear all annotations on this page?')) {
    pushHistory();
    state.annotations[state.currentPage] = { drawings: [], highlights: [], textEdits: [], erasures: [], pageNumbers: [] };
    state.selectedTextEditIdx = -1;
    renderAnnotations();
    autosave();
    showToast('Page annotations cleared', 'success');
  }
}

function updatePropsForText(info) {
  if (info.fontFamily) state.fontFamily = info.fontFamily;
  if (info.fontSize) state.fontSize = info.fontSize;
  updateSecondaryToolbar();
  updatePropsPanel();
}

function goToPage(n) {
  if (n < 1 || n > state.totalPages) return;
  if (state.activeTextBox) commitTextBox();
  state.currentPage = n;
  state.selectedTextEditIdx = -1;
  renderCurrentPage();
  updatePageLabel();
  updateThumbsActive();
  pdfView.scrollTop = 0;
}
function updatePageLabel() {
  pageLabel.textContent = `Page ${state.currentPage} of ${state.totalPages}`;
}
function updateThumbsActive() {
  document.querySelectorAll('.thumb-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.page) === state.currentPage);
  });
}

function setZoom(scale) {
  state.scale = Math.max(0.25, Math.min(5, scale));
  zoomLabel.textContent = Math.round(state.scale * 100) + '%';
  renderCurrentPage();
}

function pushHistory() {
  state.history = state.history.slice(0, state.historyIndex + 1);
  const snapshot = {
    annotations: JSON.parse(JSON.stringify(state.annotations)),
    deletedPages: Array.from(state.deletedPages),
    pageRotations: { ...state.pageRotations }
  };
  state.history.push(snapshot);
  state.historyIndex = state.history.length - 1;
  if (state.history.length > 50) {
    state.history.shift();
    state.historyIndex--;
  }
  updateHistoryButtons();
}
function undo() {
  if (state.historyIndex <= 0) { showToast('Nothing to undo'); return; }
  state.historyIndex--;
  const snap = state.history[state.historyIndex];
  state.annotations = JSON.parse(JSON.stringify(snap.annotations));
  state.deletedPages = new Set(snap.deletedPages || []);
  state.pageRotations = { ...snap.pageRotations };
  state.selectedTextEditIdx = -1;
  renderAnnotations();
  renderThumbnails();
  updateHistoryButtons();
  autosave();
  showToast('Undone');
}
function redo() {
  if (state.historyIndex >= state.history.length - 1) { showToast('Nothing to redo'); return; }
  state.historyIndex++;
  const snap = state.history[state.historyIndex];
  state.annotations = JSON.parse(JSON.stringify(snap.annotations));
  state.deletedPages = new Set(snap.deletedPages || []);
  state.pageRotations = { ...snap.pageRotations };
  state.selectedTextEditIdx = -1;
  renderAnnotations();
  renderThumbnails();
  updateHistoryButtons();
  autosave();
  showToast('Redone');
}
function updateHistoryButtons() {
  $('undoBtn').disabled = state.historyIndex <= 0;
  $('redoBtn').disabled = state.historyIndex >= state.history.length - 1;
}

async function rotatePage(n) {
  pushHistory();
  state.pageRotations[n] = ((state.pageRotations[n] || 0) + 90) % 360;
  await renderThumbnails();
  if (n === state.currentPage) await renderCurrentPage();
  showToast(`Page ${n} rotated`, 'success');
}

function deletePage(n) {
  if (state.totalPages - state.deletedPages.size <= 1) {
    showToast('Cannot delete the only remaining page', 'error'); return;
  }
  if (state.deletedPages.has(n)) {
    pushHistory();
    state.deletedPages.delete(n);
    renderThumbnails();
    showToast(`Page ${n} restored`);
    return;
  }
  if (!confirm(`Delete page ${n}?`)) return;
  pushHistory();
  state.deletedPages.add(n);
  renderThumbnails();
  if (state.deletedPages.has(state.currentPage)) {
    for (let i = n + 1; i <= state.totalPages; i++) {
      if (!state.deletedPages.has(i)) { goToPage(i); return; }
    }
    for (let i = n - 1; i >= 1; i--) {
      if (!state.deletedPages.has(i)) { goToPage(i); return; }
    }
  }
  showToast(`Page ${n} marked for deletion`, 'success');
}

function openPageNumberDialog() {
  const body = `
    <div class="form-group">
      <label class="form-label">Position</label>
      <div class="radio-group" id="pnPosition">
        ${['Header Left','Header Center','Header Right','Footer Left','Footer Center','Footer Right'].map((p,i) =>
          `<div class="radio-pill ${i===4?'active':''}" data-pos="${p}">${p}</div>`
        ).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Format</label>
      <div class="radio-group" id="pnFormat">
        <div class="radio-pill active" data-fmt="{n}">1, 2, 3</div>
        <div class="radio-pill" data-fmt="Page {n}">Page 1</div>
        <div class="radio-pill" data-fmt="Page {n} of {total}">Page 1 of 10</div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Start Number</label>
      <input type="number" class="form-control" id="pnStart" value="1" min="0" />
    </div>
    <div class="form-group">
      <label class="form-label">Apply To</label>
      <div class="radio-group" id="pnApply">
        <div class="radio-pill active" data-apply="all">All pages</div>
        <div class="radio-pill" data-apply="current">Current page</div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Font</label>
      <div class="prop-row">
        <select class="prop-select" id="pnFont">
          <option>Arial</option><option>Times New Roman</option><option>Helvetica</option><option>Courier</option>
        </select>
        <input type="number" class="prop-input" id="pnSize" value="12" min="6" max="72" style="width:80px;" />
        <input type="color" class="prop-input" id="pnColor" value="#000000" style="width:60px;height:34px;padding:2px;" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Margin from edge (pt)</label>
      <input type="number" class="form-control" id="pnMargin" value="20" min="0" max="200" />
    </div>
    <div class="form-group">
      <label class="form-label">Preview</label>
      <div id="pnPreview" style="padding:12px;background:#f1f5f9;border-radius:6px;text-align:center;font-size:14px;">Page 1 of ${state.totalPages}</div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" id="pnCancelBtn">Cancel</button>
    <button class="btn btn-primary" id="pnApplyBtn">Apply</button>
  `;
  openModal('Page Numbers', body, footer);

  document.querySelectorAll('#pnPosition .radio-pill').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#pnPosition .radio-pill').forEach(x => x.classList.remove('active'));
      el.classList.add('active'); updatePreview();
    });
  });
  document.querySelectorAll('#pnFormat .radio-pill').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#pnFormat .radio-pill').forEach(x => x.classList.remove('active'));
      el.classList.add('active'); updatePreview();
    });
  });
  document.querySelectorAll('#pnApply .radio-pill').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#pnApply .radio-pill').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
    });
  });
  ['pnStart','pnFont','pnSize','pnColor','pnMargin'].forEach(id => {
    const el = $(id); if (el) el.addEventListener('input', updatePreview);
  });

  function updatePreview() {
    const fmt = document.querySelector('#pnFormat .radio-pill.active').dataset.fmt;
    const start = parseInt($('pnStart').value) || 1;
    const previewText = fmt.replace('{n}', start).replace('{total}', state.totalPages);
    const font = $('pnFont').value;
    const size = $('pnSize').value;
    const color = $('pnColor').value;
    const fontCss = font.includes(' ') ? `"${font}"` : font;
    $('pnPreview').innerHTML = `<span style="font-family:${fontCss};font-size:${size}px;color:${color};">${previewText}</span>`;
  }
  updatePreview();

  $('pnCancelBtn').addEventListener('click', closeModal);
  $('pnApplyBtn').addEventListener('click', () => {
    pushHistory();
    const position = document.querySelector('#pnPosition .radio-pill.active').dataset.pos;
    const fmt = document.querySelector('#pnFormat .radio-pill.active').dataset.fmt;
    const start = parseInt($('pnStart').value) || 1;
    const applyTo = document.querySelector('#pnApply .radio-pill.active').dataset.apply;
    const font = $('pnFont').value;
    const size = parseInt($('pnSize').value) || 12;
    const color = $('pnColor').value;
    const margin = parseInt($('pnMargin').value) || 20;

    if (applyTo === 'all') {
      for (let i = 1; i <= state.totalPages; i++) state.annotations[i].pageNumbers = [];
    } else {
      state.annotations[state.currentPage].pageNumbers = [];
    }

    const pages = applyTo === 'all' ? Array.from({length: state.totalPages}, (_, i) => i + 1) : [state.currentPage];
    pages.forEach((pgIdx, i) => {
      const page = state.pages[pgIdx - 1].pdfPage;
      const viewport = page.getViewport({ scale: 1, rotate: state.pageRotations[pgIdx] || 0 });
      const w = viewport.width, h = viewport.height;
      let x, y, align;
      if (position.startsWith('Header')) {
        y = margin;
        align = position.endsWith('Left') ? 'left' : position.endsWith('Right') ? 'right' : 'center';
        x = align === 'left' ? margin : align === 'right' ? w - margin : w / 2;
      } else {
        y = h - margin - size;
        align = position.endsWith('Left') ? 'left' : position.endsWith('Right') ? 'right' : 'center';
        x = align === 'left' ? margin : align === 'right' ? w - margin : w / 2;
      }
      const pageNum = start + i;
      const text = fmt.replace('{n}', pageNum).replace('{total}', state.totalPages);
      state.annotations[pgIdx].pageNumbers.push({
        x, y, text, align,
        fontFamily: font, size, color, bold: false, italic: false, underline: false,
        applyTo, page: pgIdx
      });
    });

    closeModal();
    renderAnnotations();
    autosave();
    showToast('Page numbers applied', 'success');
  });
}

async function savePDF() {
  const name = prompt('Save as:', state.fileName);
  if (!name) return;
  state.fileName = name.endsWith('.pdf') ? name : name + '.pdf';

  showLoading('Preparing export…', 10);
  try {
    const { PDFDocument } = PDFLib;
    const origPdf = await PDFDocument.load(state.pdfBytes.slice(0));
    const origPages = origPdf.getPages();

    const keepIndices = [];
    for (let i = 0; i < origPages.length; i++) {
      if (!state.deletedPages.has(i + 1)) keepIndices.push(i);
    }

    const newPdf = await PDFDocument.create();

    for (let idx = 0; idx < keepIndices.length; idx++) {
      const i = keepIndices[idx];
      const pageNum = i + 1;
      updateLoading(10 + (idx / keepIndices.length) * 80, `Processing page ${idx + 1} of ${keepIndices.length}…`);

      const pdfJsPage = await state.pdfDoc.getPage(pageNum);
      const rotation = state.pageRotations[pageNum] || 0;
      const viewport = pdfJsPage.getViewport({ scale: 2, rotate: rotation });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await pdfJsPage.render({ canvasContext: ctx, viewport }).promise;

      const origPage = origPages[i];
      const { width: pw, height: ph } = origPage.getSize();
      const isRotated = rotation === 90 || rotation === 270;
      const pageW = isRotated ? ph : pw;
      const pageH = isRotated ? pw : ph;

      const scaleX = canvas.width / pageW;
      const scaleY = canvas.height / pageH;

      const ann = state.annotations[pageNum] || { drawings: [], highlights: [], textEdits: [], erasures: [], pageNumbers: [] };

      ann.erasures.forEach(er => {
        ctx.fillStyle = 'white';
        ctx.fillRect(er.x * scaleX, er.y * scaleY, er.w * scaleX, er.h * scaleY);
      });

      ann.highlights.forEach(hl => {
        ctx.globalAlpha = hl.opacity || 0.4;
        ctx.fillStyle = hl.color;
        ctx.fillRect(hl.x * scaleX, hl.y * scaleY, hl.w * scaleX, hl.h * scaleY);
        ctx.globalAlpha = 1;
      });

      ann.drawings.forEach(d => {
        if (d.points.length < 2) return;
        ctx.globalAlpha = d.opacity || 1;
        ctx.strokeStyle = d.color;
        ctx.lineWidth = d.size * scaleX;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(d.points[0].x * scaleX, d.points[0].y * scaleY);
        for (let j = 1; j < d.points.length - 1; j++) {
          const xc = (d.points[j].x + d.points[j+1].x) / 2 * scaleX;
          const yc = (d.points[j].y + d.points[j+1].y) / 2 * scaleY;
          ctx.quadraticCurveTo(d.points[j].x * scaleX, d.points[j].y * scaleY, xc, yc);
        }
        const last = d.points[d.points.length - 1];
        ctx.lineTo(last.x * scaleX, last.y * scaleY);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      ann.textEdits.forEach((te) => {
        if (te.hidden) return;
        ctx.save();
        ctx.fillStyle = te.color || '#000';
        const fontStyle = (te.italic ? 'italic ' : '') + (te.bold ? 'bold ' : '');
        const fontFam = te.fontFamily && te.fontFamily.includes(' ') ? `"${te.fontFamily}"` : (te.fontFamily || 'sans-serif');
        ctx.font = `${fontStyle}${te.size * scaleY}px ${fontFam}`;
        ctx.textBaseline = 'top';
        const lines = te.text.split('\n');
        lines.forEach((line, li) => {
          const lineY = (te.y + li * te.size * 1.2) * scaleY;
          ctx.fillText(line, te.x * scaleX, lineY);
          if (te.underline && line) {
            const metrics = ctx.measureText(line);
            const underlineY = lineY + te.size * scaleY * 1.05;
            ctx.strokeStyle = te.color || '#000';
            ctx.lineWidth = Math.max(1, te.size * scaleY * 0.08);
            ctx.beginPath();
            ctx.moveTo(te.x * scaleX, underlineY);
            ctx.lineTo(te.x * scaleX + metrics.width, underlineY);
            ctx.stroke();
          }
        });
        ctx.restore();
      });

      ann.pageNumbers.forEach(pn => {
        ctx.save();
        ctx.fillStyle = pn.color || '#000';
        const fontStyle = (pn.italic ? 'italic ' : '') + (pn.bold ? 'bold ' : '');
        const fontFam = pn.fontFamily && pn.fontFamily.includes(' ') ? `"${pn.fontFamily}"` : (pn.fontFamily || 'sans-serif');
        ctx.font = `${fontStyle}${pn.size * scaleY}px ${fontFam}`;
        ctx.textBaseline = 'top';
        const metrics = ctx.measureText(pn.text);
        let x = pn.x * scaleX;
        if (pn.align === 'center') x = pn.x * scaleX - metrics.width / 2;
        else if (pn.align === 'right') x = pn.x * scaleX - metrics.width;
        ctx.fillText(pn.text, x, pn.y * scaleY);
        if (pn.underline) {
          const underlineY = pn.y * scaleY + pn.size * scaleY * 1.05;
          ctx.strokeStyle = pn.color || '#000';
          ctx.lineWidth = Math.max(1, pn.size * scaleY * 0.08);
          ctx.beginPath();
          ctx.moveTo(x, underlineY);
          ctx.lineTo(x + metrics.width, underlineY);
          ctx.stroke();
        }
        ctx.restore();
      });

      const pngBytes = await new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          resolve(new Uint8Array(await blob.arrayBuffer()));
        }, 'image/png');
      });
      const pngImg = await newPdf.embedPng(pngBytes);
      const newPage = newPdf.addPage([pageW, pageH]);
      newPage.drawImage(pngImg, { x: 0, y: 0, width: pageW, height: pageH });
    }

    updateLoading(95, 'Finalizing…');
    const finalBytes = await newPdf.save();
    const blob = new Blob([finalBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = state.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    hideLoading();
    showToast('PDF saved successfully', 'success');
    clearAutosave();
  } catch (err) {
    console.error(err);
    hideLoading();
    showToast('Unable to save PDF: ' + err.message, 'error');
  }
}

function autosave() {
  try {
    const data = {
      annotations: state.annotations,
      currentPage: state.currentPage,
      scale: state.scale,
      fileName: state.fileName,
      deletedPages: Array.from(state.deletedPages),
      pageRotations: state.pageRotations,
      pdfBytesB64: arrayBufferToBase64(state.pdfBytes),
      ts: Date.now()
    };
    if (state.pdfBytes.length < 5 * 1024 * 1024) {
      localStorage.setItem('pdfEditor_autosave', JSON.stringify(data));
    }
  } catch (e) {}
}
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function clearAutosave() {
  try { localStorage.removeItem('pdfEditor_autosave'); } catch (e) {}
}
function checkAutosave() {
  try {
    const raw = localStorage.getItem('pdfEditor_autosave');
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > 24 * 60 * 60 * 1000) { clearAutosave(); return false; }
    if (confirm('Recover previous editing session?')) {
      state.annotations = data.annotations;
      state.currentPage = data.currentPage || 1;
      state.scale = data.scale || 1.5;
      state.fileName = data.fileName || 'edited-document.pdf';
      state.deletedPages = new Set(data.deletedPages || []);
      state.pageRotations = data.pageRotations || {};
      if (data.pdfBytesB64) {
        state.pdfBytes = base64ToArrayBuffer(data.pdfBytesB64);
        return true;
      }
    } else {
      clearAutosave();
    }
  } catch (e) {}
  return false;
}

function handleTouchStart(e) {
  if (e.touches.length === 2) {
    e.preventDefault();
    const t1 = e.touches[0], t2 = e.touches[1];
    state.pinchState = {
      dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
      scale: state.scale
    };
  }
}
function handleTouchMove(e) {
  if (e.touches.length === 2 && state.pinchState) {
    e.preventDefault();
    const t1 = e.touches[0], t2 = e.touches[1];
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const ratio = dist / state.pinchState.dist;
    setZoom(state.pinchState.scale * ratio);
  }
}
function handleTouchEnd(e) {
  if (e.touches.length < 2) state.pinchState = null;
}

$('importBtn').addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
importCard.addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON') return;
  fileInput.click();
});
importCard.addEventListener('dragover', (e) => { e.preventDefault(); importCard.classList.add('dragover'); });
importCard.addEventListener('dragleave', () => importCard.classList.remove('dragover'));
importCard.addEventListener('drop', (e) => {
  e.preventDefault();
  importCard.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) loadPDF(file);
  else showToast('Please drop a PDF file', 'error');
});
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) loadPDF(file);
  fileInput.value = '';
});
$('blankBtn').addEventListener('click', async (e) => {
  e.stopPropagation();
  const { PDFDocument } = PDFLib;
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  const bytes = await pdf.save();
  state.fileName = 'blank.pdf';
  loadPDF(new Uint8Array(bytes));
});

$('backBtn').addEventListener('click', () => {
  if (confirm('Return to home? Unsaved changes will be lost.')) {
    editorScreen.classList.remove('active');
    homeScreen.style.display = 'flex';
    state.pdfDoc = null;
  }
});

document.querySelectorAll('[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => setTool(btn.dataset.tool));
});

$('pagesBtn').addEventListener('click', () => {
  if (isMobile()) openDrawer();
  else {
    const sb = $('sidebarLeft');
    sb.style.display = sb.style.display === 'none' ? '' : 'none';
  }
});
$('drawerCloseBtn').addEventListener('click', closeDrawer);
drawerBackdrop.addEventListener('click', closeDrawer);

$('prevPageBtn').addEventListener('click', () => goToPage(state.currentPage - 1));
$('nextPageBtn').addEventListener('click', () => goToPage(state.currentPage + 1));
$('prevPageBtnTop').addEventListener('click', () => goToPage(state.currentPage - 1));
$('nextPageBtnTop').addEventListener('click', () => goToPage(state.currentPage + 1));
$('zoomInBtn').addEventListener('click', () => setZoom(state.scale + 0.25));
$('zoomOutBtn').addEventListener('click', () => setZoom(state.scale - 0.25));
$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
$('saveBtn').addEventListener('click', savePDF);
$('pageNumBtn').addEventListener('click', openPageNumberDialog);
$('modalCloseBtn').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

$('helpBtn').addEventListener('click', () => {
  openModal('Help', `
    <h4 style="margin:0 0 8px;">Getting Started</h4>
    <ol style="padding-left:20px;line-height:1.8;font-size:14px;">
      <li>Import a PDF from your device</li>
      <li>Use <b>Edit</b> to modify existing text</li>
      <li>Use <b>Text</b> to add new text — <b>click</b>, <b>drag a rectangle</b>, or <b>double-click</b> anywhere on the page</li>
      <li>Use <b>Select</b> to move added text, or <b>drag a rectangle over original text</b> to capture &amp; edit it (auto-detects English / Hindi / Kruti Dev)</li>
      <li>Use <b>Highlight</b> to mark text</li>
      <li>Use <b>Pencil</b> to draw freely</li>
      <li>Use <b>Eraser</b> to remove annotations</li>
      <li>Use <b>Page #</b> to add page numbers</li>
      <li>Use <b>&lt;</b> and <b>&gt;</b> buttons to navigate pages</li>
      <li>Click <b>Save</b> to export</li>
    </ol>
    <h4 style="margin:16px 0 8px;">Hindi / Kruti Dev Support</h4>
    <p style="font-size:14px;line-height:1.6;">The editor auto-detects Kruti Dev 010 and Kruti Dev 014 fonts. Place the font files in <code>/fonts/KrutiDev010.ttf</code> and <code>/fonts/KrutiDev014.ttf</code> next to this HTML file.</p>
    <h4 style="margin:16px 0 8px;">Keyboard Shortcuts</h4>
    <ul style="padding-left:20px;line-height:1.8;font-size:14px;">
      <li><kbd>Ctrl/Cmd + Z</kbd> — Undo</li>
      <li><kbd>Ctrl/Cmd + Shift + Z</kbd> — Redo</li>
      <li><kbd>Ctrl/Cmd + S</kbd> — Save</li>
      <li><kbd>Delete/Backspace</kbd> — Delete selected text</li>
      <li><kbd>Esc</kbd> — Exit current tool</li>
    </ul>
  `, `<button class="btn btn-primary" onclick="document.getElementById('modalBackdrop').classList.remove('active')">Got it</button>`);
});

$('settingsBtn').addEventListener('click', () => {
  openModal('Settings', `
    <div class="form-group">
      <label class="form-label">Kruti Dev Font Status</label>
      <div style="font-size:13px;">
        <div>Kruti Dev 010: <b style="color:${state.krutiFontsLoaded['Kruti Dev 010']?'#16a34a':'#dc2626'}">${state.krutiFontsLoaded['Kruti Dev 010']?'Loaded':'Not loaded'}</b></div>
        <div>Kruti Dev 014: <b style="color:${state.krutiFontsLoaded['Kruti Dev 014']?'#16a34a':'#dc2626'}">${state.krutiFontsLoaded['Kruti Dev 014']?'Loaded':'Not loaded'}</b></div>
      </div>
      <p style="font-size:12px;color:var(--muted);margin-top:8px;">To load Kruti Dev fonts, place <code>KrutiDev010.ttf</code> and <code>KrutiDev014.ttf</code> in a <code>/fonts/</code> folder next to this HTML file, then reload.</p>
    </div>
    <div class="form-group">
      <label class="form-label">Privacy</label>
      <p style="font-size:13px;">Your PDF is processed entirely in your browser. Nothing is uploaded to any server.</p>
    </div>
  `, `<button class="btn btn-primary" onclick="document.getElementById('modalBackdrop').classList.remove('active')">Close</button>`);
});

// Annotation canvas events
annotationCanvas.addEventListener('pointerdown', (e) => {
  if (state.tool === 'pencil') startDraw(e);
  else if (state.tool === 'eraser') startAreaErase(e);
  else if (state.tool === 'text') startTextDrag(e);
  else if (state.tool === 'select') startSelectDrag(e);
});
annotationCanvas.addEventListener('pointermove', (e) => {
  if (state.tool === 'pencil') moveDraw(e);
  else if (state.tool === 'eraser') moveAreaErase(e);
  else if (state.tool === 'text') moveTextDrag(e);
  else if (state.tool === 'select') moveSelectDrag(e);
});
annotationCanvas.addEventListener('pointerup', (e) => {
  if (state.tool === 'pencil') endDraw(e);
  else if (state.tool === 'eraser') endAreaErase(e);
  else if (state.tool === 'text') endTextDrag(e);
  else if (state.tool === 'select') endSelectDrag(e);
});
annotationCanvas.addEventListener('pointercancel', (e) => {
  if (state.tool === 'pencil') endDraw(e);
  else if (state.tool === 'text') { state.textDrag = null; renderAnnotations(); }
  else if (state.tool === 'select') { state.isDraggingTextEdit = false; state.selectRectDrag = null; renderAnnotations(); }
});
annotationCanvas.addEventListener('pointerleave', (e) => {
  if (state.isDrawing && state.tool === 'pencil') endDraw(e);
  if (state.isDrawing && state.tool === 'eraser') endAreaErase(e);
});

pdfView.addEventListener('touchstart', handleTouchStart, { passive: false });
pdfView.addEventListener('touchmove', handleTouchMove, { passive: false });
pdfView.addEventListener('touchend', handleTouchEnd);

document.addEventListener('keydown', (e) => {
  if (!editorScreen.classList.contains('active')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (mod && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  else if (mod && e.key === 's') { e.preventDefault(); savePDF(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.tool === 'select' && state.selectedTextEditIdx >= 0 && !state.activeTextBox) {
      e.preventDefault();
      pushHistory();
      const ann = state.annotations[state.currentPage];
      ann.textEdits.splice(state.selectedTextEditIdx, 1);
      state.selectedTextEditIdx = -1;
      renderAnnotations();
      autosave();
      showToast('Text deleted');
    }
  }
  else if (e.key === 'Escape') {
    if (modalBackdrop.classList.contains('active')) closeModal();
    else if (drawer.classList.contains('active')) closeDrawer();
    else {
      state.selectedTextEditIdx = -1;
      renderAnnotations();
      setTool('select');
    }
  }
});

pdfView.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(state.scale + delta);
  }
}, { passive: false });

document.addEventListener('click', (e) => {
  if (state.activeTextBox && !state.activeTextBox.contains(e.target) && !e.target.closest('#textEditActions')) {
    commitTextBox();
  }
});

(async () => {
  await checkKrutiFonts();
  setTool('select');
  updateHistoryButtons();
  const recovered = checkAutosave();
  if (recovered && state.pdfBytes) {
    try {
      await loadPDF(new Uint8Array(state.pdfBytes));
      renderCurrentPage();
      renderThumbnails();
    } catch (e) { console.error(e); }
  }
})();