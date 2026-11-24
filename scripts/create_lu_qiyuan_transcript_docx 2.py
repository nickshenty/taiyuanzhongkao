import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


BLUE = RGBColor(46, 116, 181)
DARK_BLUE = RGBColor(31, 77, 120)
GRAY = RGBColor(100, 100, 100)
LIGHT_GRAY = RGBColor(242, 244, 247)
BODY_FONT = "Calibri"
EAST_ASIA_FONT = "STHeiti"


def set_font(run, size=None, bold=None, color=None, italic=None):
    run.font.name = BODY_FONT
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), EAST_ASIA_FONT)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color is not None:
        run.font.color.rgb = color
    if italic is not None:
        run.italic = italic


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run("第 ")
    set_font(run, 9, color=GRAY)
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, end])
    suffix = paragraph.add_run(" 页")
    set_font(suffix, 9, color=GRAY)


def configure_document(doc):
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)
    section.header_distance = Inches(0.492)
    section.footer_distance = Inches(0.492)

    normal = doc.styles["Normal"]
    normal.font.name = BODY_FONT
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), EAST_ASIA_FONT)
    normal.font.size = Pt(11)
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.25

    for name, size, color, before, after in (
        ("Heading 1", 16, BLUE, 18, 10),
        ("Heading 2", 13, BLUE, 14, 7),
        ("Heading 3", 12, DARK_BLUE, 10, 5),
    ):
        style = doc.styles[name]
        style.font.name = BODY_FONT
        style._element.rPr.rFonts.set(qn("w:eastAsia"), EAST_ASIA_FONT)
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = color
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True

    header = section.header.paragraphs[0]
    header.text = "卢麒元讲课整理 | 投资的中庸之道"
    header.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_font(header.runs[0], 9, color=GRAY)
    add_page_number(section.footer.paragraphs[0])


def add_cover(doc):
    for _ in range(5):
        doc.add_paragraph()
    kicker = doc.add_paragraph()
    kicker.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(kicker.add_run("讲课文字整理"), 11, bold=True, color=BLUE)
    kicker.paragraph_format.space_after = Pt(18)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(title.add_run("投资的中庸之道"), 28, bold=True, color=DARK_BLUE)
    title.paragraph_format.space_after = Pt(10)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(subtitle.add_run("卢麒元老师讲课提炼与完整文字稿"), 15, color=BLUE)
    subtitle.paragraph_format.space_after = Pt(28)

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(meta.add_run("录音日期：2026年7月11日\n音频时长：约63分钟\n整理日期：2026年7月12日"), 10.5, color=GRAY)
    meta.paragraph_format.line_spacing = 1.5
    meta.paragraph_format.space_after = Pt(46)

    note = doc.add_paragraph()
    note.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(note.add_run("本稿由语音识别生成并进行结构化整理。\n专有名词、数字及个别同音词请结合原音和图表复核。"), 10, color=GRAY, italic=True)
    doc.add_page_break()


def add_bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.left_indent = Inches(0.375)
    p.paragraph_format.first_line_indent = Inches(-0.188)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.25
    set_font(p.add_run(text), 11)


def add_summary(doc):
    doc.add_heading("第一部分　核心提炼", level=1)
    lead = doc.add_paragraph()
    lead.paragraph_format.space_after = Pt(12)
    set_font(lead.add_run("核心结论："), 11, bold=True, color=DARK_BLUE)
    set_font(lead.add_run("先选对长期方向，再通过分批进出降低持仓成本，不执着于最低点买入和最高点卖出。"), 11, bold=True)

    sections = [
        ("一、投资的基本认识", [
            "工资和劳动主要解决生活问题；要获得一定程度的经济自由，还需要长期投资。",
            "投资的第一目标不是暴利，而是在安全和保本的前提下抵御通货膨胀。",
            "其体系可概括为：‘道’判断趋势，‘中’选择方向，‘庸’管理过程。",
        ]),
        ("二、‘中’：选择大于努力", [
            "宏观上观察货币、通胀和资产供求，先确定长期赛道。",
            "技术上结合年K、季K、月K、MACD和成交量，确认趋势所处阶段。",
            "课中用‘短房长金’和‘金转油’说明资产切换逻辑；这些是讲者的个人判断，具体价格和收益需要独立核实。",
        ]),
        ("三、‘庸’：三三四仓位原则", [
            "将计划资金分为30%、30%、40%，根据趋势信号分批进入和退出。",
            "分批操作的实质是保留纠错空间，避免一次判断决定全部结果。",
            "通过价格波动反复调整仓位，逐渐降低平均持仓成本。",
        ]),
        ("四、技术工具与观察周期", [
            "主要工具是价格K线、MACD和成交量；工具不必多，但必须足够熟练。",
            "年K、季K用于判断大方向；月K、周K用于重要仓位；日K辅助短期操作。",
            "原始录音对个别‘金叉、死叉’表述可能存在转写错位，具体规则应对照原音和图表。",
        ]),
        ("五、不执着于顶和底", [
            "不要求买在绝对最低点，也不要求卖在绝对最高点。",
            "合理目标是获取中间相对确定的一段收益，而不是追求完美交易。",
            "执着低点会导致迟迟不入场，执着高点则可能错过退出时机。",
        ]),
        ("六、先评估最坏结果", [
            "买入后下跌50%能否承受？三年不赚钱能否坚持？",
            "投入资金是否影响家庭生活、现金流和正常工作？",
            "仓位必须与个人风险承受能力匹配，不能只想象最好的收益。",
        ]),
        ("七、减少资讯依赖和情绪交易", [
            "提前确定方向、仓位和买卖条件，到达条件后执行。",
            "不过度依赖每日资讯、分析师观点和市场情绪。",
            "价格上涨时已有仓位获利，价格下跌时预留资金可以调整，从而减少焦虑和盯盘。",
        ]),
    ]
    for heading, bullets in sections:
        doc.add_heading(heading, level=2)
        for bullet in bullets:
            add_bullet(doc, bullet)

    doc.add_heading("八、可执行框架", level=2)
    steps = [
        "明确投资目的：抗通胀、现金流或长期增长。",
        "用宏观逻辑筛选长期方向。",
        "用年K、季K确认大趋势。",
        "评估最坏情况和家庭承受能力。",
        "按照30%、30%、40%分批建立仓位。",
        "用月、周、日周期管理分批进出。",
        "放弃捕捉绝对顶部和底部。",
        "预先制定规则，减少临时决策。",
        "定期复盘持仓成本，而不是只看当日盈亏。",
        "只有长期逻辑发生根本变化时，才进行赛道切换。",
    ]
    for item in steps:
        p = doc.add_paragraph(style="List Number")
        p.paragraph_format.left_indent = Inches(0.5)
        p.paragraph_format.first_line_indent = Inches(-0.25)
        p.paragraph_format.space_after = Pt(4)
        set_font(p.add_run(item), 11)

    concluding = doc.add_paragraph()
    concluding.paragraph_format.space_before = Pt(10)
    concluding.paragraph_format.space_after = Pt(8)
    set_font(concluding.add_run("整理者提示："), 10.5, bold=True, color=DARK_BLUE)
    set_font(concluding.add_run("最值得吸收的是长期选择、分批仓位、风险承受和情绪管理的方法，而不是机械照搬某个具体标的或时间判断。"), 10.5)
    doc.add_page_break()


def add_transcript(doc, markdown_path):
    doc.add_heading("第二部分　完整文字稿", level=1)
    intro = doc.add_paragraph("以下内容按约30至40秒合并短句，并保留录音时间戳，便于返回原音核对。")
    set_font(intro.runs[0], 10.5, color=GRAY, italic=True)
    intro.paragraph_format.space_after = Pt(12)

    lines = markdown_path.read_text(encoding="utf-8").splitlines()
    current_time = None
    for line in lines:
        if line.startswith("### "):
            current_time = line[4:].strip()
            continue
        if not line or line.startswith("# ") or line.startswith("- "):
            continue
        if current_time:
            p_time = doc.add_paragraph()
            p_time.paragraph_format.space_before = Pt(8)
            p_time.paragraph_format.space_after = Pt(3)
            p_time.paragraph_format.keep_with_next = True
            set_font(p_time.add_run(current_time), 9.5, bold=True, color=BLUE)
            current_time = None
        p = doc.add_paragraph()
        p.paragraph_format.first_line_indent = Inches(0.29)
        p.paragraph_format.space_after = Pt(7)
        p.paragraph_format.line_spacing = 1.35
        p.paragraph_format.widow_control = True
        set_font(p.add_run(line), 10.5)


def main():
    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    doc = Document()
    configure_document(doc)
    add_cover(doc)
    add_summary(doc)
    add_transcript(doc, source)
    doc.core_properties.title = "投资的中庸之道：卢麒元老师讲课提炼与完整文字稿"
    doc.core_properties.subject = "2026年7月11日讲课音频整理"
    doc.core_properties.author = "申正"
    doc.core_properties.keywords = "卢麒元, 投资, 中庸之道, 三三四原则, 音频文字稿"
    output.parent.mkdir(parents=True, exist_ok=True)
    doc.save(output)


if __name__ == "__main__":
    main()
