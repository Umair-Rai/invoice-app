# Fonts Directory

This directory is for custom fonts used in PDF generation.

## Arabic Font Setup

For Arabic RTL support in PDF exports, you need to add an Arabic font file here.

### Recommended Fonts (Free)
- **Amiri**: https://fonts.google.com/specimen/Amiri
- **Cairo**: https://fonts.google.com/specimen/Cairo
- **Tajawal**: https://fonts.google.com/specimen/Tajawal

### Installation Steps
1. Download the font (TTF format)
2. Place the TTF file in this directory
3. Name it `arabic.ttf` for automatic detection
4. Restart the app

### Example
```
public/fonts/
  ├── arabic.ttf       (your Arabic font)
  └── README.md
```

### Note
If no Arabic font is found, PDFs will use PDFKit's built-in Helvetica font, which may not display Arabic characters correctly.
