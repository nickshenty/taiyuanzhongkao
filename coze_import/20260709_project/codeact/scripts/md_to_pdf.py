#!/usr/bin/env python3
"""
Convert Markdown test files to PDF using reportlab.
Manually parses markdown line by line and builds PDF elements.
Usage: python3 md_to_pdf.py <input.md> <output.pdf>
"""

import sys
import os
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, black, white, grey
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ==================== Font Registration ====================

WQY_PATH = '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc'
FONT_NORMAL = 'WQY'
FONT_BOLD = 'WQY-Bold'
MONO_FONT = 'Courier'

# Register normal font (WenQuanYi Micro Hei)
try:
    pdfmetrics.registerFont(TTFont(FONT_NORMAL, WQY_PATH, subfontIndex=0))
    print(f"[OK] Normal font registered: {FONT_NORMAL}")
except Exception as e:
    try:
        pdfmetrics.registerFont(TTFont(FONT_NORMAL, WQY_PATH))
        print(f"[OK] Normal font registered (no index): {FONT_NORMAL}")
    except Exception as e2:
        print(f"[ERROR] Failed to register normal font: {e2}")
        sys.exit(1)

# Try to register a bold variant from available CJK fonts
bold_ok = False
bold_candidates = [
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
]
for path in bold_candidates:
    if not os.path.exists(path):
        continue
    for idx in range(10):
        try:
            pdfmetrics.registerFont(TTFont(FONT_BOLD, path, subfontIndex=idx))
            print(f"[OK] Bold font registered: {FONT_BOLD} from {path} idx={idx}")
            bold_ok = True
            break
        except Exception:
            pass
    if bold_ok:
        break

# Also try subfonts of the regular Noto Sans CJK
if not bold_ok:
    noto_regular = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
    if os.path.exists(noto_regular):
        for idx in range(1, 20):
            try:
                pdfmetrics.registerFont(TTFont(FONT_BOLD, noto_regular, subfontIndex=idx))
                print(f"[OK] Bold font from NotoSansCJK-Regular idx={idx}")
                bold_ok = True
                break
            except Exception:
                pass

if not bold_ok:
    FONT_BOLD = FONT_NORMAL
    print("[INFO] No separate bold font found, using normal font for bold")

# Register font family so <b> and <i> tags work in Paragraphs
registerFontFamily(
    FONT_NORMAL,
    normal=FONT_NORMAL,
    bold=FONT_BOLD,
    italic=FONT_NORMAL,
    boldItalic=FONT_BOLD
)

# ==================== Colors ====================

H1_COLOR = HexColor('#1a1a2e')
H2_COLOR = HexColor('#16213e')
H3_COLOR = HexColor('#0f3460')
QUOTE_BG = HexColor('#F5F5F5')
QUOTE_BORDER = HexColor('#999999')
TABLE_HEADER_BG = HexColor('#D6EAF8')
TABLE_GRID_COLOR = HexColor('#999999')
CODE_BG = HexColor('#F8F8F8')

# ==================== Page Dimensions ====================

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 2 * cm
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN  # ~16.6 cm

# ==================== Paragraph Styles ====================

h1_style = ParagraphStyle(
    'H1', fontName=FONT_BOLD, fontSize=24, leading=32,
    alignment=TA_CENTER, spaceBefore=10, spaceAfter=16,
    textColor=H1_COLOR
)

h2_style = ParagraphStyle(
    'H2', fontName=FONT_BOLD, fontSize=18, leading=26,
    alignment=TA_LEFT, spaceBefore=16, spaceAfter=10,
    textColor=H2_COLOR
)

h3_style = ParagraphStyle(
    'H3', fontName=FONT_BOLD, fontSize=14, leading=20,
    alignment=TA_LEFT, spaceBefore=12, spaceAfter=8,
    textColor=H3_COLOR
)

body_style = ParagraphStyle(
    'Body', fontName=FONT_NORMAL, fontSize=12, leading=18,
    alignment=TA_LEFT, spaceBefore=2, spaceAfter=2,
    textColor=black
)

quote_style = ParagraphStyle(
    'Quote', fontName=FONT_NORMAL, fontSize=12, leading=18,
    alignment=TA_LEFT, textColor=HexColor('#444444')
)

bullet_style = ParagraphStyle(
    'Bullet', fontName=FONT_NORMAL, fontSize=12, leading=18,
    alignment=TA_LEFT, leftIndent=15,
    spaceBefore=2, spaceAfter=2, textColor=black
)

code_style = ParagraphStyle(
    'Code', fontName=MONO_FONT, fontSize=10, leading=14,
    alignment=TA_LEFT, leftIndent=10, rightIndent=10,
    spaceBefore=4, spaceAfter=4,
    backColor=CODE_BG, textColor=HexColor('#333333'),
    borderWidth=0.5, borderColor=HexColor('#DDDDDD'),
    borderPadding=4
)

table_cell_style = ParagraphStyle(
    'TableCell', fontName=FONT_NORMAL, fontSize=10, leading=14,
    alignment=TA_CENTER, textColor=black
)

table_header_style = ParagraphStyle(
    'TableHeader', fontName=FONT_BOLD, fontSize=10, leading=14,
    alignment=TA_CENTER, textColor=black
)

# ==================== Helper Functions ====================

def escape_xml(text):
    """Escape XML special characters for reportlab Paragraph."""
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    return text

def process_inline(text):
    """Process inline markdown formatting (**bold**, `code`) for reportlab."""
    text = escape_xml(text)
    # **bold** -> <b>bold</b>
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    # `code` -> monospace font
    text = re.sub(r'`(.+?)`', r'<font name="' + MONO_FONT + r'">\1</font>', text)
    return text

def is_separator_row(cells):
    """Check if a table row is a markdown separator (---|:---|---:)."""
    return all(re.match(r'^[-: ]*$', c) for c in cells if c is not None)

def parse_table(table_lines):
    """Parse markdown table lines and return a list with a reportlab Table."""
    rows = []
    for line in table_lines:
        line = line.strip()
        if line.startswith('|'):
            line = line[1:]
        if line.endswith('|'):
            line = line[:-1]
        cells = [c.strip() for c in line.split('|')]
        if is_separator_row(cells):
            continue
        rows.append(cells)

    if not rows:
        return []

    num_cols = max(len(row) for row in rows)
    for row in rows:
        while len(row) < num_cols:
            row.append('')

    # Build paragraph-based cell data
    data = []
    for row_idx, row in enumerate(rows):
        cell_paras = []
        for cell in row:
            style = table_header_style if row_idx == 0 else table_cell_style
            cell_paras.append(Paragraph(process_inline(cell), style))
        data.append(cell_paras)

    col_width = CONTENT_WIDTH / num_cols
    col_widths = [col_width] * num_cols

    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, TABLE_GRID_COLOR),
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    return [table]

# ==================== Markdown Parser ====================

def parse_markdown(md_text):
    """Parse markdown text into a list of reportlab flowables."""
    flowables = []
    lines = md_text.split('\n')
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]
        stripped = line.strip()

        # --- Empty line -> small spacer ---
        if stripped == '':
            flowables.append(Spacer(1, 6))
            i += 1
            continue

        # --- Code block ---
        if stripped.startswith('```'):
            code_lines = []
            i += 1
            while i < n and not lines[i].strip().startswith('```'):
                code_lines.append(lines[i])
                i += 1
            i += 1  # skip closing ```
            code_text = '<br/>'.join(escape_xml(l) for l in code_lines)
            flowables.append(Paragraph(code_text, code_style))
            flowables.append(Spacer(1, 6))
            continue

        # --- Headers (check ### before ## before #) ---
        if stripped.startswith('### '):
            flowables.append(Paragraph(process_inline(stripped[4:]), h3_style))
            i += 1
            continue
        if stripped.startswith('## '):
            header_text = stripped[3:]
            # 答案/评分相关部分单独起一页
            if any(kw in header_text for kw in ['参考答案', '测试说明与评分', '评分标准']):
                flowables.append(PageBreak())
            flowables.append(Paragraph(process_inline(header_text), h2_style))
            i += 1
            continue
        if stripped.startswith('# '):
            flowables.append(Paragraph(process_inline(stripped[2:]), h1_style))
            i += 1
            continue

        # --- Separator line ---
        if stripped in ('---', '***', '___'):
            flowables.append(Spacer(1, 4))
            flowables.append(HRFlowable(width='100%', thickness=1, color=grey))
            flowables.append(Spacer(1, 6))
            i += 1
            continue

        # --- Block quote (> ...) ---
        if stripped.startswith('>'):
            quote_lines = []
            while i < n and lines[i].strip().startswith('>'):
                content = lines[i].strip()[1:].strip()
                quote_lines.append(content)
                i += 1
            quote_text = '<br/>'.join(process_inline(l) for l in quote_lines)
            quote_para = Paragraph(quote_text, quote_style)
            quote_table = Table([[quote_para]], colWidths=[CONTENT_WIDTH])
            quote_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), QUOTE_BG),
                ('LINEBEFORE', (0, 0), (0, -1), 3, QUOTE_BORDER),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            flowables.append(quote_table)
            flowables.append(Spacer(1, 6))
            continue

        # --- Table (| ... |) ---
        if stripped.startswith('|'):
            table_lines = []
            while i < n and lines[i].strip().startswith('|'):
                table_lines.append(lines[i].strip())
                i += 1
            flowables.extend(parse_table(table_lines))
            flowables.append(Spacer(1, 6))
            continue

        # --- Bullet point (- ... or * ...) ---
        if stripped.startswith('- ') or stripped.startswith('* '):
            bullet_text = stripped[2:]
            text = '\u2022 ' + process_inline(bullet_text)
            flowables.append(Paragraph(text, bullet_style))
            i += 1
            continue

        # --- Normal text: collect consecutive non-special lines ---
        text_lines = []
        while i < n:
            s = lines[i].strip()
            if s == '' or \
               s.startswith('#') or \
               s in ('---', '***', '___') or \
               s.startswith('>') or \
               s.startswith('|') or \
               s.startswith('```') or \
               s.startswith('- ') or \
               s.startswith('* '):
                break
            text_lines.append(lines[i])
            i += 1

        if text_lines:
            text = '<br/>'.join(process_inline(l) for l in text_lines)
            flowables.append(Paragraph(text, body_style))

    return flowables

# ==================== PDF Builder ====================

def convert_md_to_pdf(input_path, output_path):
    """Convert a single markdown file to PDF."""
    print(f"\n{'=' * 60}")
    print(f"Reading: {input_path}")
    with open(input_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    print(f"  File size: {len(md_text)} chars, {len(md_text.splitlines())} lines")
    print(f"Parsing markdown...")
    flowables = parse_markdown(md_text)
    print(f"  Generated {len(flowables)} flowable elements")

    print(f"Building PDF: {output_path}")
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title=os.path.basename(input_path).replace('.md', ''),
        author='Confucius Study Assistant',
    )
    doc.build(flowables)

    file_size = os.path.getsize(output_path)
    print(f"[OK] PDF created: {output_path}")
    print(f"     Size: {file_size:,} bytes ({file_size / 1024:.1f} KB)")
    print(f"{'=' * 60}")
    return output_path

# ==================== Main ====================

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 md_to_pdf.py <input.md> <output.pdf>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    if not os.path.exists(input_path):
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)

    convert_md_to_pdf(input_path, output_path)
