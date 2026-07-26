# PDF Editor Pro

A powerful web-based PDF editor with comprehensive text editing capabilities, font customization, and color tools.

## Features

### ✏️ Text Editing
- **Add Text**: Click anywhere on the PDF to add text
- **Edit Text**: Double-click any text element to edit
- **Drag & Drop**: Move text elements anywhere on the page
- **Delete**: Remove selected text elements

### 🎨 Font Customization
- **Font Family**: Choose from 13 popular fonts
  - Arial, Helvetica, Times New Roman, Courier New
  - Georgia, Verdana, Comic Sans MS, Impact
  - Trebuchet MS, Palatino Linotype, Lucida Console, Tahoma, Garamond

- **Font Size**: Adjustable from 8px to 120px
- **Font Color**: Full color picker with hex value display
- **Text Formatting**:
  - Bold
  - Italic
  - Underline
  - Strikethrough

### 📐 Text Alignment
- Align Left
- Align Center
- Align Right
- Justify

### 🛠️ Tools
- **Select Tool**: Select and modify text elements
- **Add Text Tool**: Click to add new text
- **Add Image**: Insert images into the PDF
- **Draw Tool**: Freehand drawing mode
- **Highlight Tool**: Highlight text with customizable colors

### 📄 Page Management
- Navigate between pages
- Page counter display
- Quick page jump

### 🔍 Zoom Controls
- Zoom In/Out
- Fit to page
- Zoom percentage display
- Range: 50% - 200%

### ⌨️ Keyboard Shortcuts
- `Ctrl + S`: Save PDF
- `Ctrl + Z`: Undo
- `Ctrl + Y`: Redo
- `Delete`: Delete selected element
- `Arrow Left`: Previous page
- `Arrow Right`: Next page

### 💾 Save & Export
- **Save**: Apply changes to the PDF
- **Download**: Download the edited PDF file

### 🎯 Additional Features
- **Drag & Drop Upload**: Drop PDF files directly
- **Undo/Redo**: Full history management (up to 50 states)
- **Real-time Preview**: See changes instantly
- **Responsive Design**: Works on different screen sizes

## How to Use

### 1. Open the Application
Open your browser and navigate to:
```
http://localhost:8080
```

### 2. Upload a PDF
- Click "Open PDF" button, OR
- Drag and drop a PDF file onto the upload area

### 3. Edit Your PDF

#### Adding Text:
1. Click the **Font** icon (T) in the toolbar
2. Click anywhere on the PDF page
3. Double-click the text to edit
4. Type your content

#### Changing Font:
1. Select a text element
2. Choose font from the **Font Family** dropdown
3. Adjust **Size** using the number input
4. Pick a **Color** using the color picker

#### Formatting Text:
1. Select a text element
2. Click formatting buttons (Bold, Italic, Underline, Strikethrough)
3. Choose text alignment

#### Moving Text:
1. Click and drag any text element
2. Position it anywhere on the page

#### Deleting Text:
1. Select the text element
2. Click the **Trash** icon or press `Delete` key

### 4. Save Your Work
- Click **Save PDF** to apply changes
- Click **Download** to save to your computer

## Installation

No installation required! The application runs in your browser.

### Option 1: Using Python (Already Running)
```bash
cd /home/ram/Music/pdf-editor
python3 -m http.server 8080
```

### Option 2: Using Node.js
```bash
cd /home/ram/Music/pdf-editor
npx http-server -p 8080
```

### Option 3: Using PHP
```bash
cd /home/ram/Music/pdf-editor
php -S localhost:8080
```

## Browser Compatibility

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

## Technical Details

### Technologies Used
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **PDF Rendering**: PDF.js (Mozilla)
- **PDF Editing**: PDF-lib
- **Icons**: Font Awesome

### Architecture
- **PDFEditor Class**: Main application controller
- **Text Element Management**: Dynamic DOM manipulation
- **State Management**: Undo/Redo stack
- **Event Handling**: Comprehensive event listeners

### File Structure
```
pdf-editor/
├── index.html          # Main HTML file
├── style.css           # Styles and animations
├── script.js           # Application logic
└── README.md           # This file
```

## Tips & Tricks

1. **Quick Text Addition**: Use the Text tool and click anywhere
2. **Precise Positioning**: Use small drag movements for fine-tuning
3. **Consistent Styling**: Set font properties before adding new text
4. **Undo Mistakes**: Use Ctrl+Z for quick undo
5. **Navigation**: Use arrow keys for quick page navigation
6. **Zoom for Details**: Zoom in for precise text placement

## Limitations

- Text elements are added as overlays
- Original PDF content cannot be deleted
- Font embedding depends on PDF-lib support
- Complex PDFs may render differently

## Troubleshooting

### PDF won't load
- Ensure the file is a valid PDF
- Check browser console for errors
- Try a different PDF file

### Text not editable
- Double-click to enter edit mode
- Ensure you're not in drawing mode
- Click the Select tool first

### Changes not saving
- Check browser console for errors
- Ensure PDF is not password-protected
- Try downloading instead of saving

## Future Enhancements

- [ ] Text extraction from PDF
- [ ] OCR support
- [ ] More font options
- [ ] Shape tools
- [ ] Annotation tools
- [ ] Form filling
- [ ] Digital signatures
- [ ] Cloud storage integration

## License

MIT License - Free for personal and commercial use.

## Support

For issues or questions, please check the browser console or review this documentation.

---

**Enjoy editing your PDFs! 🎉**
