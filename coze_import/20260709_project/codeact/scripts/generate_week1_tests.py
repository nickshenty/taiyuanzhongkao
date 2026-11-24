#!/usr/bin/env python3
"""
Generate daily test papers for 申奇峰's summer study plan (any Day range).
Each day generates a Markdown test paper, then converts to PDF via md_to_pdf.py.

Pulls science content from study_data.json's daily_learning field.
English and Poetry tests use vocab_data.json and poetry_data.json.
Subject type (math/physics, chem/bio) is derived from study_data.json's
main_subject.name and science_subject.name fields.

Usage:
    python3 generate_week1_tests.py                     # 默认生成 Day1-7（第一周）
    python3 generate_week1_tests.py --start 8 --end 14  # 生成第二周
    python3 generate_week1_tests.py --start 15 --end 21  # 生成第三周

Output:
    Markdown + PDF files in 孔子学习辅助/第N周PDF/
    Named: Day{N}_测试卷.md / Day{N}_测试卷.pdf
"""

import json
import os
import sys
import random
import re
import subprocess
import argparse

# ==================== Paths ====================
WORK_DIR = '/app/data/所有对话/主对话'
SCRIPTS_DIR = os.path.join(WORK_DIR, 'codeact', 'scripts')
STUDY_BASE_DIR = os.path.join(WORK_DIR, '孔子学习辅助')
MD_TO_PDF = os.path.join(SCRIPTS_DIR, 'md_to_pdf.py')

# ==================== Week Directory ====================
CN_NUMS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']


def week_cn(n):
    """将周序号转为中文数字"""
    if n <= 10:
        return CN_NUMS[n]
    if n < 20:
        return '十' + CN_NUMS[n - 10]
    tens = n // 10
    ones = n % 10
    result = CN_NUMS[tens] + '十'
    if ones:
        result += CN_NUMS[ones]
    return result


def get_week_dir(start_day):
    """根据起始Day计算输出目录名"""
    week_num = (start_day - 1) // 7 + 1
    return os.path.join(STUDY_BASE_DIR, f"第{week_cn(week_num)}周PDF")


# ==================== Date / Subject Extraction ====================

def get_date_info(day_num, study_data):
    """从 study_data.json 提取日期和星期信息"""
    entry = study_data.get(str(day_num), {})
    date_str = entry.get('date', '')  # e.g., "2026-07-06"
    weekday = entry.get('weekday', '')  # e.g., "周一"
    if date_str:
        parts = date_str.split('-')
        date_display = f"{int(parts[1])}/{int(parts[2])}"
    else:
        date_display = f"Day{day_num}"
    return date_display, weekday


def get_subjects(day_num, study_data):
    """从 study_data.json 提取当天主科和理科科目名称"""
    entry = study_data.get(str(day_num), {})
    main_name = entry.get('main_subject', {}).get('name', '')
    science_name = entry.get('science_subject', {}).get('name', '')
    return main_name, science_name


# ==================== Data Storage ====================
DATA = {}


def load_data():
    """Load JSON data files."""
    with open(os.path.join(SCRIPTS_DIR, 'study_data.json'), 'r', encoding='utf-8') as f:
        DATA['study'] = json.load(f)
    with open(os.path.join(SCRIPTS_DIR, 'poetry_data.json'), 'r', encoding='utf-8') as f:
        DATA['poetry'] = json.load(f)
    with open(os.path.join(SCRIPTS_DIR, 'vocab_data.json'), 'r', encoding='utf-8') as f:
        DATA['vocab'] = json.load(f)


# ==================== Helper Functions ====================

def escape_md_line(line):
    """Escape lines that would be misinterpreted by md_to_pdf.py parser."""
    stripped = line.lstrip()
    if stripped.startswith('#'):
        return '\\' + line
    if stripped.startswith('|'):
        return '\\' + line
    return line


def escape_md_text(text):
    """Escape multi-line text, line by line."""
    lines = text.split('\n')
    return '\n'.join(escape_md_line(l) for l in lines)


def cn_num(n):
    """Convert number to Chinese numeral for section headers."""
    cn = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
    if n <= 10:
        return cn[n]
    if n < 20:
        return '十' + cn[n - 10]
    return str(n)


def format_options(options, short=False):
    """Format MCQ options."""
    letters = ['A', 'B', 'C', 'D', 'E', 'F']
    if short and len(options) == 4:
        line1 = f"A. {options[0]}　　B. {options[1]}"
        line2 = f"C. {options[2]}　　D. {options[3]}"
        return line1 + '\n' + line2
    else:
        return '\n'.join(f"{letters[i]}. {opt}" for i, opt in enumerate(options))


def split_poem_lines(original):
    """Split poem original text into individual sentences."""
    lines = original.strip().split('\n')
    sentences = []
    for line in lines:
        parts = re.split(r'([。！？；])', line.strip())
        current = ''
        for part in parts:
            current += part
            if part in '。！？；':
                if current.strip():
                    sentences.append(current.strip())
                current = ''
        if current.strip():
            sentences.append(current.strip())
    return sentences


def get_daily_learning(day_num, subject):
    """Get daily_learning data for a specific subject on a specific day."""
    key = str(day_num)
    dl = DATA['study'].get(key, {}).get('daily_learning', {})
    return dl.get(subject, {})


# ==================== English Question Generators ====================

def gen_placement_test():
    """Day1: 20 MCQ placement test (5 from each level A2/B1/B2/C1)."""
    levels_words = {'A2': [], 'B1': [], 'B2': [], 'C1': []}
    for day_key, batch in DATA['vocab'].items():
        level = batch.get('level', '')
        if level in levels_words:
            levels_words[level].extend(batch['words'])

    questions = []
    answers = []
    q_num = 1

    for level in ['A2', 'B1', 'B2', 'C1']:
        pool = levels_words[level]
        if len(pool) < 5:
            continue
        selected = random.sample(pool, 5)
        for word_obj in selected:
            correct_word = word_obj['word']
            meaning = word_obj['meaning']
            distractor_pool = [w['word'] for w in pool if w['word'] != correct_word]
            if len(distractor_pool) < 3:
                continue
            distractors = random.sample(distractor_pool, 3)
            options = [correct_word] + distractors
            random.shuffle(options)
            correct_idx = options.index(correct_word)
            correct_letter = 'ABCD'[correct_idx]

            questions.append({
                'num': q_num,
                'prompt': f"{meaning}",
                'options': options,
                'short': True,
            })
            answers.append(f"{q_num}. {correct_letter}")
            q_num += 1

    return questions, answers


def gen_vocab_test(day_num):
    """Day2+: vocab test from the day's batch."""
    vocab_key = str(day_num)
    if vocab_key not in DATA['vocab']:
        return [], [], ""

    batch = DATA['vocab'][vocab_key]
    words = batch['words']
    if len(words) >= 20:
        test_words = random.sample(words, 20)
    else:
        test_words = words[:]

    questions = []
    answers = []
    q_num = 1

    # --- Section 1: 英译汉 (10题) ---
    en_to_cn_words = test_words[:10]
    for w in en_to_cn_words:
        questions.append({
            'num': q_num, 'type': 'en_to_cn',
            'prompt': f"{w['word']}（{w.get('pos', '')}）",
            'answer': w['meaning'],
        })
        answers.append(f"{q_num}. {w['meaning']}")
        q_num += 1

    # --- Section 2: 汉译英 (10题) ---
    cn_to_en_words = test_words[10:20] if len(test_words) >= 20 else test_words[10:]
    for w in cn_to_en_words:
        questions.append({
            'num': q_num, 'type': 'cn_to_en',
            'prompt': f"{w['meaning']}",
            'answer': w['word'],
        })
        answers.append(f"{q_num}. {w['word']}（{w.get('pos', '')}）")
        q_num += 1

    # --- Section 3: 选词填空 (5题) ---
    fill_words = random.sample(test_words[:15], min(5, len(test_words)))
    all_pool = [w for w in words if w not in fill_words]
    if len(all_pool) >= 2:
        extra = random.sample(all_pool, 2)
    else:
        extra = []
    bank_words = fill_words + extra
    random.shuffle(bank_words)
    word_bank = ', '.join(w['word'] for w in bank_words)

    for w in fill_words:
        pos = w.get('pos', '').rstrip('.')
        meaning = w['meaning'].split('，')[0].strip()
        word = w['word']
        if pos == 'n':
            sentence = f"The _____ is very important in our daily life.（{meaning}）"
        elif pos == 'v':
            sentence = f"We should _____ every day to improve ourselves.（{meaning}）"
        elif pos == 'adj':
            sentence = f"The _____ weather makes me feel good.（{meaning}）"
        elif pos == 'adv':
            sentence = f"She speaks _____ in front of the audience.（{meaning}）"
        elif pos == 'prep':
            sentence = f"Please look _____ the word in the dictionary.（{meaning}）"
        elif pos == 'conj':
            sentence = f"I will go _____ you come with me.（{meaning}）"
        else:
            sentence = f"Please fill in the blank with the correct word.（{meaning}）"

        questions.append({
            'num': q_num, 'type': 'fill_blank',
            'prompt': sentence, 'answer': word,
        })
        answers.append(f"{q_num}. {word}")
        q_num += 1

    # --- Section 4: 形近词辨析 (5题) ---
    analyze_words = random.sample(test_words[:15], min(5, len(test_words)))
    for w in analyze_words:
        target_word = w['word']
        correct_meaning = w['meaning'].split('，')[0].strip()
        other_words = [ow for ow in words if ow['word'] != target_word]
        if len(other_words) >= 3:
            distractor_words = random.sample(other_words, 3)
            distractor_meanings = [dw['meaning'].split('，')[0].strip() for dw in distractor_words]
        else:
            distractor_meanings = ['其他含义A', '其他含义B', '其他含义C']

        options = [correct_meaning] + distractor_meanings
        random.shuffle(options)
        correct_idx = options.index(correct_meaning)
        correct_letter = 'ABCD'[correct_idx]

        questions.append({
            'num': q_num, 'type': 'analyze',
            'prompt': f"选择单词「{target_word}」的正确释义：",
            'options': options, 'short': True,
        })
        answers.append(f"{q_num}. {correct_letter}（{correct_meaning}）")
        q_num += 1

    return questions, answers, word_bank


# ==================== Poetry Question Generator ====================

def gen_poetry_test(day_num):
    """Generate poetry test: 5 原文填空 + 3 字词解释 + 2 理解性默写."""
    poem_key = str(day_num)
    poem = DATA['poetry'].get(poem_key, {})
    if not poem:
        return [], []

    questions = []
    answers = []
    q_num = 1

    original = poem.get('original', '')
    notes = poem.get('notes', [])
    translation = poem.get('translation', '')
    title = poem.get('title', '')

    # --- 原文填空 (5空) ---
    sentences = split_poem_lines(original)
    pairs = []
    for i in range(0, len(sentences) - 1, 2):
        pairs.append((sentences[i], sentences[i + 1]))
    if len(sentences) % 2 == 1 and len(sentences) >= 2:
        pairs.append((sentences[-2], sentences[-1]))

    if len(pairs) > 5:
        selected_pairs = random.sample(pairs, 5)
    else:
        selected_pairs = pairs[:5]

    for i, (ctx, blank) in enumerate(selected_pairs):
        ctx_clean = ctx.rstrip('。！？；')
        blank_clean = blank.rstrip('。！？；')
        if i % 2 == 0:
            question = f"{ctx_clean}，______________。"
            ans = blank_clean
        else:
            question = f"______________，{blank_clean}。"
            ans = ctx_clean
        questions.append({'num': q_num, 'type': 'fill_original', 'prompt': question})
        answers.append(f"{q_num}. {ans}")
        q_num += 1

    while len(questions) < 5 and sentences:
        idx = len(questions)
        if idx < len(sentences):
            s = sentences[idx]
            if '，' in s:
                parts = s.split('，', 1)
                first_part = parts[0].strip()
                second_part = parts[1].rstrip('。！？；').strip()
                if len(first_part) >= 2 and len(second_part) >= 2:
                    if idx % 2 == 0:
                        question = f"{first_part}，______________。"
                        ans = second_part
                    else:
                        question = f"______________，{second_part}。"
                        ans = first_part
                    questions.append({'num': q_num, 'type': 'fill_original', 'prompt': question})
                    answers.append(f"{q_num}. {ans}")
                    q_num += 1
                    continue
            if len(s) > 6:
                blank_len = min(4, len(s) // 3)
                question = s[:-blank_len].rstrip('，') + '，______________。'
                ans = s[-blank_len:].lstrip('，').rstrip('。！？；')
                questions.append({'num': q_num, 'type': 'fill_original', 'prompt': question})
                answers.append(f"{q_num}. {ans}")
                q_num += 1
            else:
                break
        else:
            break

    # --- 字词解释 (3题) ---
    if notes:
        selected_notes = random.sample(notes, min(3, len(notes)))
        for note in selected_notes:
            word = note.get('word', '')
            meaning = note.get('meaning', '')
            questions.append({'num': q_num, 'type': 'word_explain',
                              'prompt': f"解释「{word}」在诗中的含义。"})
            answers.append(f"{q_num}. {word}：{meaning}")
            q_num += 1

    # --- 理解性默写 (2题) ---
    trans_sentences = [s.strip() for s in re.split(r'[。！？]', translation) if s.strip()]
    if len(trans_sentences) >= 2:
        selected_trans = random.sample(range(len(trans_sentences)), min(2, len(trans_sentences)))
    else:
        selected_trans = list(range(len(trans_sentences)))

    orig_sentences = split_poem_lines(original)
    for trans_idx in selected_trans:
        trans = trans_sentences[trans_idx]
        orig_idx = min(trans_idx, len(orig_sentences) - 1)
        orig_sent = orig_sentences[orig_idx] if orig_sentences else ''
        if len(trans) > 60:
            prompt = f"根据「{trans[:55]}……」的意境，写出对应的原诗句。"
        else:
            prompt = f"根据「{trans}」的意境，写出对应的原诗句。"
        questions.append({'num': q_num, 'type': 'comprehension', 'prompt': prompt})
        answers.append(f"{q_num}. {orig_sent.rstrip('。！？；')}")
        q_num += 1

    while len([q for q in questions if q.get('type') == 'comprehension']) < 2:
        questions.append({'num': q_num, 'type': 'comprehension',
                          'prompt': f"请默写《{title}》中你最喜欢的一句，并简要说明理由。"})
        answers.append(f"{q_num}. （开放题，言之有理即可）")
        q_num += 1

    return questions, answers


# ==================== Science Question Generators ====================

def make_concept_fill_blank(text):
    """Create a fill-in-the-blank question from a key_point text."""
    if not text or not text.strip():
        return text, text

    clauses = re.split(r'[，,。；]', text)
    clauses = [c.strip() for c in clauses if c.strip()]
    if not clauses:
        return text, text

    first_clause = clauses[0]
    rest = '，'.join(clauses[1:]) if len(clauses) > 1 else ''

    match = re.match(r'^(.{2,12}?)(是|为|指|表示|等于|需要|包含|属于|体现|揭示|描述|适用|说明|具有|从|可|能|应|用|对|由)', first_clause)
    if match:
        term = match.group(1)
        remaining = first_clause[len(term):]
        question = '____' + remaining
        if rest:
            question += '，' + rest
        return question, term

    match = re.match(r'^(.{2,8})的(.+)$', first_clause)
    if match:
        term = match.group(1)
        remaining = '的' + match.group(2)
        question = '____' + remaining
        if rest:
            question += '，' + rest
        return question, term

    if '：' in first_clause:
        parts = first_clause.split('：', 1)
        term = parts[0].strip()
        if 2 <= len(term) <= 12:
            question = '____：' + parts[1]
            if rest:
                question += '，' + rest
            return question, term

    suffix_match = re.match(r'^(.+?(?:问题|概念|公式|定律|定理|原理|方法|规律|性质|特征|关系|条件|步骤|法则|定义|含义|内容|表达式|通式|结构|反应|现象|操作|实验|结论|规律|特性|功能|作用|类型|分类|组成|要素))', first_clause)
    if suffix_match:
        term = suffix_match.group(1)
        if 2 <= len(term) <= 15:
            remaining = first_clause[len(term):]
            question = '____' + remaining
            if rest:
                question += '，' + rest
            return question, term

    blank_len = min(4, max(2, len(first_clause) // 3))
    if len(first_clause) > blank_len + 2:
        term = first_clause[:blank_len]
        question = '____' + first_clause[blank_len:]
        if rest:
            question += '，' + rest
        return question, term

    return text, text


def make_formula_question(formula_str):
    """Create a formula writing question."""
    desc = ''
    formula_part = formula_str

    m = re.search(r'（(.+?)）', formula_str)
    if m:
        desc = m.group(1)
        formula_part = formula_str[:m.start()].strip()
    else:
        m = re.search(r'\(([^()]+)\)\s*$', formula_str)
        if m:
            potential_desc = m.group(1)
            if re.search(r'[\u4e00-\u9fff]', potential_desc):
                desc = potential_desc
                formula_part = formula_str[:m.start()].strip()

    if not desc and '：' in formula_str:
        parts = formula_str.split('：', 1)
        potential_desc = parts[0].strip()
        if 2 <= len(potential_desc) <= 15 and re.search(r'[\u4e00-\u9fff]', potential_desc):
            desc = potential_desc
            formula_part = parts[1].strip()

    if desc:
        return f"请写出以下公式/表达式的完整内容：{desc}", formula_str
    else:
        if '——' in formula_str:
            parts = formula_str.split('——', 1)
            return f"请写出以下公式：{parts[1].strip()}", formula_str
        elif '=' in formula_part or '⇌' in formula_part:
            sep = '=' if '=' in formula_part else '⇌'
            lhs = formula_part.split(sep)[0].strip()
            return f"请写出以「{lhs}」为左边的完整公式表达式。", formula_str
        elif '表示' in formula_part:
            parts = formula_part.split('表示', 1)
            desc_text = parts[1].strip()
            if desc_text:
                return f"请写出表示「{desc_text}」的表达式。", formula_str
            else:
                return "请默写本节的一个重要公式。", formula_str
        else:
            return f"请默写本节课的一个重要公式/表达式。", formula_str


def make_short_answer_q(content, topic, count=2):
    """Create short answer questions from content."""
    results = []
    sections = re.findall(r'[一二三四五六七八九十]+、(.+?)(?:\n|$)', content)
    if not sections:
        sections = re.findall(r'\d+[.、]\s*(.+?)(?:\n|$)', content)

    seen = set()
    unique_sections = []
    for s in sections:
        s_clean = s.strip()[:40]
        if s_clean and s_clean not in seen:
            seen.add(s_clean)
            unique_sections.append(s_clean)

    if len(unique_sections) >= count:
        selected = random.sample(unique_sections, count)
    elif unique_sections:
        selected = unique_sections[:]
        while len(selected) < count:
            selected.append(f"{topic}的核心概念")
    else:
        selected = [f"{topic}的核心概念", f"{topic}的应用", f"{topic}的要点"][:count]

    for title in selected:
        q = f"请简述「{title}」的核心概念和要点。"
        pattern = f'{re.escape(title[:10])}.*?(?=[一二三四五六七八九十]+、|\Z)'
        match = re.search(pattern, content, re.DOTALL)
        if match:
            ans_text = match.group()[:300].strip()
            ans_text = re.sub(r'\n{2,}', '\n', ans_text)
            results.append((q, ans_text))
        else:
            results.append((q, f"参考教材中关于「{title}」的内容。"))

    return results


def make_calculation_q(content, formulas, topic, day_num):
    """Create 2 calculation questions for physics."""
    results = []
    examples = re.findall(r'例[题\d]*[：.]\s*(.{20,400}?)(?=\n\n|\n例|\Z)', content, re.DOTALL)

    if len(examples) >= 2:
        for ex in examples[:2]:
            ex_text = ex.strip()[:350]
            for keyword in ['思路', '解：', '解答', '解题步骤', '易错点']:
                idx = ex_text.find(keyword)
                if idx > 10:
                    ex_text = ex_text[:idx].strip()
                    break
            ex_text = escape_md_text(ex_text)
            results.append((ex_text, "请参考课本中的解答步骤，注意公式应用和单位换算。"))
    elif len(examples) == 1:
        ex_text = examples[0].strip()[:350]
        for keyword in ['思路', '解：', '解答', '解题步骤', '易错点']:
            idx = ex_text.find(keyword)
            if idx > 10:
                ex_text = ex_text[:idx].strip()
                break
        ex_text = escape_md_text(ex_text)
        results.append((ex_text, "请参考课本中的解答步骤。"))
        results.append(_create_physics_template_q(topic, formulas))
    else:
        results.append(_create_physics_template_q(topic, formulas))
        results.append(_create_physics_template_q(topic, formulas, variant=2))

    return results


def _create_physics_template_q(topic, formulas, variant=1):
    """Create a template physics calculation question."""
    formula_hints = []
    for f in formulas[:3]:
        m = re.search(r'[（(](.+?)[)）]', f)
        if m:
            formula_hints.append(m.group(1))
        elif '——' in f:
            formula_hints.append(f.split('——')[1].strip())

    hint = formula_hints[0] if formula_hints else topic

    if variant == 1:
        q = (f"运用本节所学公式（{hint}），解决以下问题：\n"
             f"一物体做匀变速直线运动，初速度v₀=10m/s，加速度a=2m/s²。\n"
             f"求：(1) 物体在5秒末的速度；(2) 物体在5秒内的位移。")
        a = ("(1) v = v₀ + at = 10 + 2×5 = 20 m/s\n"
             "(2) x = v₀t + ½at² = 10×5 + ½×2×25 = 75 m")
    else:
        q = (f"运用本节所学公式（{hint}），解决以下问题：\n"
             f"一物体从静止开始做匀加速直线运动，加速度a=3m/s²。\n"
             f"求：(1) 物体在4秒末的速度；(2) 物体在4秒内的位移。")
        a = ("(1) v = v₀ + at = 0 + 3×4 = 12 m/s\n"
             "(2) x = v₀t + ½at² = 0 + ½×3×16 = 24 m")
    return (q, a)


def make_true_false_q(mistakes, count=2):
    """Create true/false questions from common_mistakes."""
    results = []
    if not mistakes:
        return [("判断以下说法是否正确：学习时应注意理解概念本质。", "正确。理解概念本质是学习的关键。")] * count

    selected = random.sample(mistakes, min(count, len(mistakes)))

    for mistake in selected:
        if '错误' in mistake and ('正解' in mistake or '正确' in mistake):
            error_match = re.search(r'错误[：:](.+?)(?=正解|正确|$)', mistake, re.DOTALL)
            if error_match:
                error_stmt = error_match.group(1).strip().rstrip('。')
                correction_match = re.search(r'正解[：:](.+)', mistake, re.DOTALL)
                correction = correction_match.group(1).strip() if correction_match else ''
                q = f"判断以下说法是否正确，若不正确请改正：\n{error_stmt}"
                a = f"不正确。{correction}" if correction else "不正确，请参考教材改正。"
                results.append((q, a))
            else:
                results.append((f"判断以下说法是否正确：\n{mistake[:100]}", "此说法需要仔细辨析，请参考教材。"))
        else:
            stmt = mistake.strip()
            if len(stmt) > 100:
                stmt = stmt[:100] + '...'
            q = f"判断以下说法是否正确：\n{stmt}"
            a = f"正确。这是需要注意的重要知识点。"
            results.append((q, a))

    while len(results) < count:
        remaining = [m for m in mistakes if m not in selected]
        if remaining:
            m = remaining[0]
            q = f"判断以下说法是否正确：\n{m[:100]}"
            a = f"正确。这是需要注意的重要知识点。"
            results.append((q, a))
        else:
            results.append(("判断以下说法是否正确：概念理解是理科学习的基础。", "正确。"))
            break

    return results[:count]


def make_equation_q(equations, count=3):
    """Create equation writing questions from equations list."""
    results = []
    if not equations:
        return [("请默写本节的一个重要化学方程式。", "参考教材。")] * count

    selected = random.sample(equations, min(count, len(equations)))

    for eq in selected:
        desc = ''
        formula = eq
        m = re.search(r'（(.+?)）', eq)
        if m:
            desc = m.group(1)
            formula = eq[:m.start()].strip()
        else:
            m = re.search(r'\(([^()]+)\)\s*$', eq)
            if m:
                potential = m.group(1)
                if len(potential) > 3 and re.search(r'[\u4e00-\u9fff]', potential):
                    desc = potential
                    formula = eq[:m.start()].strip()

        if desc:
            if '=' in formula:
                reactants = formula.split('=')[0].strip()
                q = f"请完成以下化学方程式：{reactants} = ____（{desc}）"
            elif '⇌' in formula:
                reactants = formula.split('⇌')[0].strip()
                q = f"请完成以下化学方程式：{reactants} ⇌ ____（{desc}）"
            else:
                q = f"请写出{desc}的化学方程式。"
            a = eq
        else:
            if '=' in formula:
                reactants = formula.split('=')[0].strip()
                q = f"请完成以下化学方程式：{reactants} = ____"
            elif '⇌' in formula:
                reactants = formula.split('⇌')[0].strip()
                q = f"请完成以下化学方程式：{reactants} ⇌ ____"
            else:
                q = f"请默写本节的一个重要化学方程式。"
            a = eq

        results.append((q, a))

    while len(results) < count:
        remaining = [e for e in equations if e not in selected]
        if remaining:
            eq = remaining[0]
            m = re.search(r'（(.+?)）', eq)
            desc = m.group(1) if m else '本节重要方程式'
            q = f"请写出{desc}的化学方程式。"
            results.append((q, eq))
        else:
            results.append(("请再默写一个本节的化学方程式。", "参考教材。"))
            break

    return results[:count]


# ==================== Science Test Generators (from daily_learning) ====================

def gen_math_test(day_num):
    """Generate math test from daily_learning."""
    math_data = get_daily_learning(day_num, 'math')
    if not math_data:
        return [], []

    questions = []
    answers = []
    q_num = 1

    key_points = math_data.get('key_points', [])
    formulas = math_data.get('formulas', [])
    content = math_data.get('content', '')
    topic = math_data.get('topic', '数学')

    # --- 概念填空 (3题) ---
    if key_points:
        selected_kp = random.sample(key_points, min(3, len(key_points)))
        for kp in selected_kp:
            q_text, a_text = make_concept_fill_blank(kp)
            questions.append({'num': q_num, 'type': 'concept_fill', 'prompt': q_text})
            answers.append(f"{q_num}. {a_text}")
            q_num += 1

    # --- 公式默写 (3题) ---
    if formulas:
        selected_f = random.sample(formulas, min(3, len(formulas)))
        for f in selected_f:
            q_text, a_text = make_formula_question(f)
            questions.append({'num': q_num, 'type': 'formula', 'prompt': q_text})
            answers.append(f"{q_num}. {a_text}")
            q_num += 1

    # --- 简答 (2题) ---
    sa_results = make_short_answer_q(content, topic)
    for q_text, a_text in sa_results[:2]:
        questions.append({'num': q_num, 'type': 'short_answer', 'prompt': q_text})
        answers.append(f"{q_num}. {a_text}")
        q_num += 1

    return questions, answers


def gen_physics_test(day_num):
    """Generate physics test from daily_learning."""
    phys_data = get_daily_learning(day_num, 'physics')
    if not phys_data:
        return [], []

    questions = []
    answers = []
    q_num = 1

    key_points = phys_data.get('key_points', [])
    formulas = phys_data.get('formulas', [])
    content = phys_data.get('content', '')
    topic = phys_data.get('topic', '物理')

    # --- 概念填空 (3题) ---
    if key_points:
        selected_kp = random.sample(key_points, min(3, len(key_points)))
        for kp in selected_kp:
            q_text, a_text = make_concept_fill_blank(kp)
            questions.append({'num': q_num, 'type': 'concept_fill', 'prompt': q_text})
            answers.append(f"{q_num}. {a_text}")
            q_num += 1

    # --- 公式默写 (3题) ---
    if formulas:
        selected_f = random.sample(formulas, min(3, len(formulas)))
        for f in selected_f:
            q_text, a_text = make_formula_question(f)
            questions.append({'num': q_num, 'type': 'formula', 'prompt': q_text})
            answers.append(f"{q_num}. {a_text}")
            q_num += 1

    # --- 计算题 (2题) ---
    calc_results = make_calculation_q(content, formulas, topic, day_num)
    for q_text, a_text in calc_results[:2]:
        questions.append({'num': q_num, 'type': 'calculation', 'prompt': q_text})
        answers.append(f"{q_num}. {a_text}")
        q_num += 1

    return questions, answers


def gen_chem_test(day_num):
    """Generate chemistry test from daily_learning."""
    chem_data = get_daily_learning(day_num, 'chemistry')
    if not chem_data:
        return [], []

    questions = []
    answers = []
    q_num = 1

    equations = chem_data.get('equations', [])
    key_points = chem_data.get('key_points', [])
    common_mistakes = chem_data.get('common_mistakes', [])

    # --- 方程式默写 (3题) ---
    eq_results = make_equation_q(equations, 3)
    for q_text, a_text in eq_results:
        questions.append({'num': q_num, 'type': 'equation', 'prompt': q_text})
        answers.append(f"{q_num}. {a_text}")
        q_num += 1

    # --- 概念填空 (3题) ---
    if key_points:
        selected_kp = random.sample(key_points, min(3, len(key_points)))
        for kp in selected_kp:
            q_text, a_text = make_concept_fill_blank(kp)
            questions.append({'num': q_num, 'type': 'concept_fill', 'prompt': q_text})
            answers.append(f"{q_num}. {a_text}")
            q_num += 1

    # --- 判断对错 (2题) ---
    tf_results = make_true_false_q(common_mistakes, 2)
    for q_text, a_text in tf_results:
        questions.append({'num': q_num, 'type': 'true_false', 'prompt': q_text})
        answers.append(f"{q_num}. {a_text}")
        q_num += 1

    return questions, answers


def gen_bio_test(day_num):
    """Generate biology test from daily_learning."""
    bio_data = get_daily_learning(day_num, 'biology')
    if not bio_data:
        return [], []

    questions = []
    answers = []
    q_num = 1

    key_points = bio_data.get('key_points', [])
    content = bio_data.get('content', '')
    common_mistakes = bio_data.get('common_mistakes', [])
    topic = bio_data.get('topic', '生物')

    # --- 概念填空 (3题) ---
    if key_points:
        selected_kp = random.sample(key_points, min(3, len(key_points)))
        for kp in selected_kp:
            q_text, a_text = make_concept_fill_blank(kp)
            questions.append({'num': q_num, 'type': 'concept_fill', 'prompt': q_text})
            answers.append(f"{q_num}. {a_text}")
            q_num += 1

    # --- 简答 (3题) ---
    sa_results = make_short_answer_q(content, topic, count=3)
    for q_text, a_text in sa_results[:3]:
        questions.append({'num': q_num, 'type': 'short_answer', 'prompt': q_text})
        answers.append(f"{q_num}. {a_text}")
        q_num += 1

    # --- 判断对错 (2题) ---
    tf_results = make_true_false_q(common_mistakes, 2)
    for q_text, a_text in tf_results:
        questions.append({'num': q_num, 'type': 'true_false', 'prompt': q_text})
        answers.append(f"{q_num}. {a_text}")
        q_num += 1

    return questions, answers


# ==================== Markdown Assembly ====================

def build_english_section_md(day_num, questions, answers, word_bank=None):
    """Build markdown for the English test section."""
    md_lines = []
    md_lines.append(f"## 一、英语词汇测试\n")

    if day_num == 1:
        md_lines.append("**词汇摸底测试：以下20题每题给出中文释义，请从A/B/C/D中选择对应的英文单词。**\n")
        for q in questions:
            md_lines.append(f"{q['num']}. {q['prompt']}")
            md_lines.append(format_options(q['options'], short=q.get('short', False)))
            md_lines.append("")
    else:
        en_to_cn = [q for q in questions if q.get('type') == 'en_to_cn']
        cn_to_en = [q for q in questions if q.get('type') == 'cn_to_en']
        fill_blank = [q for q in questions if q.get('type') == 'fill_blank']
        analyze = [q for q in questions if q.get('type') == 'analyze']

        md_lines.append("### （一）英译汉（写出下列单词的中文释义）\n")
        for q in en_to_cn:
            md_lines.append(f"{q['num']}. {q['prompt']}　______________")
        md_lines.append("")

        md_lines.append("### （二）汉译英（根据中文释义写出英文单词）\n")
        for q in cn_to_en:
            md_lines.append(f"{q['num']}. {q['prompt']}　______________")
        md_lines.append("")

        md_lines.append("### （三）选词填空（从词库中选择合适的单词填入空格，每个词限用一次）\n")
        if word_bank:
            md_lines.append(f"**词库：{word_bank}**\n")
        for q in fill_blank:
            md_lines.append(f"{q['num']}. {q['prompt']}")
        md_lines.append("")

        md_lines.append("### （四）形近词辨析（选择正确释义）\n")
        for q in analyze:
            md_lines.append(f"{q['num']}. {q['prompt']}")
            md_lines.append(format_options(q['options'], short=q.get('short', False)))
            md_lines.append("")

    return '\n'.join(md_lines)


def build_poetry_section_md(questions, answers):
    """Build markdown for the poetry test section."""
    md_lines = []
    md_lines.append("## 二、古诗文测试\n")

    fill_original = [q for q in questions if q.get('type') == 'fill_original']
    word_explain = [q for q in questions if q.get('type') == 'word_explain']
    comprehension = [q for q in questions if q.get('type') == 'comprehension']

    md_lines.append("### （一）原文填空（根据上下文补写出空缺部分）\n")
    for q in fill_original:
        md_lines.append(f"{q['num']}. {q['prompt']}")
    md_lines.append("")

    if word_explain:
        md_lines.append("### （二）字词解释（写出下列字词在诗中的含义）\n")
        for q in word_explain:
            md_lines.append(f"{q['num']}. {q['prompt']}")
        md_lines.append("")

    if comprehension:
        md_lines.append("### （三）理解性默写（根据情境描述写出对应的诗句）\n")
        for q in comprehension:
            md_lines.append(f"{q['num']}. {q['prompt']}")
            md_lines.append("　　______________")
        md_lines.append("")

    return '\n'.join(md_lines)


def build_science_section_md(questions, answers, section_title, subject_name):
    """Build markdown for a science test section."""
    md_lines = []
    md_lines.append(f"## {section_title}、{subject_name}测试\n")

    type_labels = {
        'concept_fill': '概念填空',
        'formula': '公式默写',
        'short_answer': '简答',
        'calculation': '计算题',
        'equation': '方程式默写',
        'true_false': '判断对错',
    }

    type_order = ['equation', 'concept_fill', 'formula', 'short_answer', 'calculation', 'true_false']
    present_types = []
    for t in type_order:
        if any(q.get('type') == t for q in questions):
            present_types.append(t)

    sub_idx = 1
    for t in present_types:
        type_qs = [q for q in questions if q.get('type') == t]
        label = type_labels.get(t, t)
        cn_sub = cn_num(sub_idx)
        md_lines.append(f"### （{cn_sub}）{label}\n")
        for q in type_qs:
            md_lines.append(f"{q['num']}. {q['prompt']}")
            if t in ('concept_fill', 'formula', 'equation'):
                md_lines.append("　　______________")
            md_lines.append("")
        sub_idx += 1

    return '\n'.join(md_lines)


def build_answer_section_md(answer_groups):
    """Build the answer section markdown."""
    md_lines = []
    md_lines.append("## 参考答案\n")

    for section_title, answers in answer_groups:
        md_lines.append(f"**{section_title}**\n")
        for ans in answers:
            md_lines.append(ans)
        md_lines.append("")

    return '\n'.join(md_lines)


def generate_day_test(day_num):
    """Generate the complete test paper markdown for a given day."""
    random.seed(day_num * 42 + 7)

    date_str, weekday = get_date_info(day_num, DATA['study'])
    main_name, science_name = get_subjects(day_num, DATA['study'])

    md_parts = []

    # 研学外出日标记
    is_study_tour = DATA['study'].get(str(day_num), {}).get('study_tour', False)
    tour_suffix = "（研学外出日）" if is_study_tour else ""

    # --- Title ---
    md_parts.append(f"# 申奇峰暑假学习 · Day{day_num} 测试卷（{date_str} {weekday}）{tour_suffix}\n")

    # --- Section 1: English ---
    if day_num == 1:
        eng_questions, eng_answers = gen_placement_test()
        word_bank = None
    else:
        eng_questions, eng_answers, word_bank = gen_vocab_test(day_num)

    md_parts.append(build_english_section_md(day_num, eng_questions, eng_answers, word_bank))

    # --- Section 2: Poetry ---
    poe_questions, poe_answers = gen_poetry_test(day_num)
    md_parts.append(build_poetry_section_md(poe_questions, poe_answers))

    # --- Section 3: Main Subject (Math or Physics) ---
    answer_groups = []
    answer_groups.append(('一、英语词汇测试', eng_answers))
    answer_groups.append(('二、古诗文测试', poe_answers))

    section_num = 3
    if main_name == '数学':
        math_questions, math_answers = gen_math_test(day_num)
        md_parts.append(build_science_section_md(math_questions, math_answers,
                                                  cn_num(section_num), '数学'))
        answer_groups.append((f'{cn_num(section_num)}、数学测试', math_answers))
        section_num += 1
    elif main_name == '物理':
        phys_questions, phys_answers = gen_physics_test(day_num)
        md_parts.append(build_science_section_md(phys_questions, phys_answers,
                                                  cn_num(section_num), '物理'))
        answer_groups.append((f'{cn_num(section_num)}、物理测试', phys_answers))
        section_num += 1

    # --- Section 4: Science Subject (Chem or Bio) ---
    if science_name == '化学':
        chem_questions, chem_answers = gen_chem_test(day_num)
        md_parts.append(build_science_section_md(chem_questions, chem_answers,
                                                  cn_num(section_num), '化学'))
        answer_groups.append((f'{cn_num(section_num)}、化学测试', chem_answers))
    elif science_name == '生物':
        bio_questions, bio_answers = gen_bio_test(day_num)
        md_parts.append(build_science_section_md(bio_questions, bio_answers,
                                                  cn_num(section_num), '生物'))
        answer_groups.append((f'{cn_num(section_num)}、生物测试', bio_answers))

    # --- Answer Section ---
    md_parts.append(build_answer_section_md(answer_groups))

    return '\n'.join(md_parts)


# ==================== Main ====================

def main():
    parser = argparse.ArgumentParser(
        description="申奇峰暑假学习计划 - 任意Day范围测试卷PDF生成"
    )
    parser.add_argument(
        '--start', type=int, default=1,
        help='起始Day编号（默认1）'
    )
    parser.add_argument(
        '--end', type=int, default=7,
        help='结束Day编号（默认7）'
    )
    args = parser.parse_args()

    start_day = args.start
    end_day = args.end

    if start_day < 1 or end_day < 1 or start_day > end_day:
        print(f"[ERROR] Invalid day range: start={start_day}, end={end_day}")
        sys.exit(1)

    days = list(range(start_day, end_day + 1))

    # 计算输出目录
    pdf_output_dir = get_week_dir(start_day)

    print("=" * 60)
    print(f"申奇峰暑假学习 · 测试卷生成器 (Day{start_day}-Day{end_day})")
    print("=" * 60)

    # Load data
    load_data()
    print(f"[OK] Data loaded successfully")

    # Ensure output directory exists
    os.makedirs(pdf_output_dir, exist_ok=True)
    print(f"[OK] Output directory: {pdf_output_dir}")

    success_count = 0
    fail_count = 0

    for day in days:
        print(f"\n--- Generating Day{day} ---")
        try:
            md_content = generate_day_test(day)
            md_path = os.path.join(pdf_output_dir, f'Day{day}_测试卷.md')
            pdf_path = os.path.join(pdf_output_dir, f'Day{day}_测试卷.pdf')

            with open(md_path, 'w', encoding='utf-8') as f:
                f.write(md_content)
            print(f"  [OK] Markdown written: {md_path} ({len(md_content)} chars)")

            result = subprocess.run(
                ['python3', MD_TO_PDF, md_path, pdf_path],
                cwd=WORK_DIR,
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode == 0:
                pdf_size = os.path.getsize(pdf_path)
                print(f"  [OK] PDF created: {pdf_path} ({pdf_size:,} bytes)")
                success_count += 1
            else:
                print(f"  [ERROR] PDF conversion failed:")
                print(f"  stderr: {result.stderr[:500]}")
                fail_count += 1

        except Exception as e:
            print(f"  [ERROR] Day{day} failed: {e}")
            import traceback
            traceback.print_exc()
            fail_count += 1

    print(f"\n{'=' * 60}")
    print(f"Completed: {success_count} success, {fail_count} failed")
    print(f"Output directory: {pdf_output_dir}")
    print(f"{'=' * 60}")

    return 0 if fail_count == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
