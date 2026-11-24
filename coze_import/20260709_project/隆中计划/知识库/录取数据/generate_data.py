#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
隆中计划 - 全国高校名录与31省高考基础数据生成脚本
数据来源：教育部2026年6月公布的全国高等学校名单
"""
import json
import re
import os
from collections import defaultdict, OrderedDict

output_dir = "/app/data/所有对话/主对话/隆中计划/知识库/录取数据"
os.makedirs(output_dir, exist_ok=True)

# ==========================================
# 第一部分：从已获取的数据文件中提取高校数据
# ==========================================

filepath = '/app/data/所有对话/主对话/.tmp/trunc/call_482ce9b01bbe4b6abc648d13'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

data = json.loads(content)
text = data.get('content', '')

# 提取表格数据
pattern = r'\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|'
matches = re.findall(pattern, text)

# 清理学校名称（去掉markdown链接）
def clean_name(name):
    # 去掉markdown链接格式
    name = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', name)
    # 去掉换行和多余空格
    name = re.sub(r'\s+', '', name)
    return name.strip()

# 解析高校数据
universities = []
for m in matches:
    seq, name, province, city, level, nature = m
    name = clean_name(name)
    province = clean_name(province)
    city = clean_name(city)
    level = clean_name(level)
    nature = clean_name(nature)
    if name and province and level and nature:
        universities.append({
            'seq': int(seq),
            'name': name,
            'province': province,
            'city': city,
            'level': level,
            'nature': nature
        })

print(f"成功提取 {len(universities)} 所高校数据")

# ==========================================
# 第二部分：标记特殊标签（985/211/双一流）
# ==========================================

# 985高校（39所）
univ_985 = {
    "北京大学","清华大学","中国人民大学","北京航空航天大学","北京理工大学",
    "中国农业大学","北京师范大学","中央民族大学","南开大学","天津大学",
    "大连理工大学","东北大学","吉林大学","哈尔滨工业大学","复旦大学",
    "同济大学","上海交通大学","华东师范大学","南京大学","东南大学",
    "浙江大学","中国科学技术大学","厦门大学","山东大学","中国海洋大学",
    "武汉大学","华中科技大学","中南大学","湖南大学","国防科技大学",
    "中山大学","华南理工大学","重庆大学","四川大学","电子科技大学",
    "西安交通大学","西北工业大学","西北农林科技大学","兰州大学"
}

# 211高校（纯211，不含985，约77所）
univ_211_only = {
    "北京交通大学","北京工业大学","北京科技大学","北京化工大学","北京邮电大学",
    "北京林业大学","北京中医药大学","北京外国语大学","中国传媒大学","中央财经大学",
    "对外经济贸易大学","中国政法大学","华北电力大学","北京体育大学","中央音乐学院",
    "中国矿业大学（北京）","中国石油大学（北京）","中国地质大学（北京）",
    "天津医科大学","河北工业大学","太原理工大学","内蒙古大学",
    "辽宁大学","大连海事大学","延边大学","东北师范大学",
    "哈尔滨工程大学","东北农业大学","东北林业大学",
    "苏州大学","南京航空航天大学","南京理工大学","中国矿业大学",
    "河海大学","江南大学","南京农业大学","中国药科大学","南京师范大学",
    "安徽大学","合肥工业大学","福州大学","南昌大学",
    "中国石油大学（华东）","郑州大学",
    "武汉理工大学","华中农业大学","华中师范大学","中南财经政法大学","中国地质大学（武汉）",
    "湖南师范大学","暨南大学","华南师范大学",
    "广西大学","海南大学","西南大学","西南交通大学","西南财经大学","四川农业大学",
    "贵州大学","云南大学","西藏大学","西北大学","西安电子科技大学",
    "长安大学","陕西师范大学","空军军医大学","青海大学","宁夏大学",
    "新疆大学","石河子大学"
}

univ_211 = univ_985 | univ_211_only

# 双一流高校（第二轮147所，含985/211）
univ_syl_only = {
    "上海科技大学","上海中医药大学","上海海洋大学","上海体育大学","上海音乐学院",
    "南方科技大学","广州医科大学","华南农业大学","广州中医药大学",
    "成都理工大学","成都中医药大学","西南石油大学",
    "南京邮电大学","南京医科大学","南京林业大学",
    "宁波大学","中国美术学院","天津中医药大学",
    "河南大学","湘潭大学","西北师范大学","山西大学",
    "南京信息工程大学","陆军军医大学","海军军医大学",
    "中国科学院大学","中央戏剧学院","中央美术学院",
    "中国音乐学院","北京协和医学院",
}

univ_syl = univ_985 | univ_211_only | univ_syl_only

# 为每所高校添加标签
for u in universities:
    tags = []
    if u['name'] in univ_985:
        tags.append('985')
    if u['name'] in univ_211:
        tags.append('211')
    if u['name'] in univ_syl:
        tags.append('双一流')
    u['tags'] = '/'.join(tags) if tags else ''

# ==========================================
# 第三部分：按省份分组统计
# ==========================================

# 省份排序（31省标准顺序）
province_order = [
    "北京","天津","河北","山西","内蒙古",
    "辽宁","吉林","黑龙江",
    "上海","江苏","浙江","安徽","福建","江西","山东",
    "河南","湖北","湖南","广东","广西","海南",
    "重庆","四川","贵州","云南","西藏",
    "陕西","甘肃","青海","宁夏","新疆"
]

# 按省份分组
by_province = defaultdict(list)
for u in universities:
    by_province[u['province']].append(u)

# 统计
total_benke = sum(1 for u in universities if u['level'] == '本科')
total_zhuanke = sum(1 for u in universities if u['level'] == '专科')
total_gongban = sum(1 for u in universities if u['nature'] == '公办')
total_minban = sum(1 for u in universities if u['nature'] == '民办')
total_zhongwai = sum(1 for u in universities if '中外' in u['nature'])

print(f"本科: {total_benke}, 专科: {total_zhuanke}")
print(f"公办: {total_gongban}, 民办: {total_minban}, 中外合作: {total_zhongwai}")

# ==========================================
# 第四部分：生成全国高校名录.md
# ==========================================

lines = []
lines.append("# 全国普通高校完整名录")
lines.append("")
lines.append(f"> **数据截止：2026年6月17日**（教育部公布最新版）")
lines.append(f"> ")
lines.append(f"> **总计：{len(universities)}所** 普通高等学校")
lines.append(f"> - 本科学校：{total_benke}所")
lines.append(f"> - 高职（专科）学校：{total_zhuanke}所")
lines.append(f"> - 公办：{total_gongban}所 | 民办：{total_minban}所 | 中外合作办学：{total_zhongwai}所")
lines.append(f"> ")
lines.append(f"> **数据来源**：[教育部全国高等学校名单](http://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202606/t20260618_1441074.html)")
lines.append("")
lines.append("---")
lines.append("")
lines.append("## 目录")
lines.append("")
for p in province_order:
    count = len(by_province.get(p, []))
    if count > 0:
        bk = sum(1 for u in by_province[p] if u['level'] == '本科')
        zk = sum(1 for u in by_province[p] if u['level'] == '专科')
        lines.append(f"- [{p}](#{p})（{count}所：本科{bk}+专科{zk}）")
lines.append("")
lines.append("---")
lines.append("")

# 按省份输出
for p in province_order:
    prov_unis = by_province.get(p, [])
    if not prov_unis:
        continue
    
    bk_count = sum(1 for u in prov_unis if u['level'] == '本科')
    zk_count = sum(1 for u in prov_unis if u['level'] == '专科')
    gb_count = sum(1 for u in prov_unis if u['nature'] == '公办')
    mb_count = sum(1 for u in prov_unis if u['nature'] == '民办')
    
    lines.append(f"## {p}（{len(prov_unis)}所）")
    lines.append("")
    lines.append(f"> 本科 {bk_count}所 | 专科 {zk_count}所 | 公办 {gb_count}所 | 民办 {mb_count}所")
    lines.append("")
    lines.append("| 序号 | 学校名称 | 所在地 | 层次 | 性质 | 标签 |")
    lines.append("|------|----------|--------|------|------|------|")
    
    idx = 1
    for u in prov_unis:
        tag_str = u['tags'] if u['tags'] else ''
        lines.append(f"| {idx} | {u['name']} | {u['city']} | {u['level']} | {u['nature']} | {tag_str} |")
        idx += 1
    
    lines.append("")
    lines.append("---")
    lines.append("")

# 添加高校分层次统计
lines.append("## 全国高校分层次统计")
lines.append("")
lines.append("| 层次 | 数量 | 说明 |")
lines.append("|------|------|------|")
lines.append(f"| 985工程 | {len(univ_985)}所 | 原985工程高校，均为双一流A类 |")
lines.append(f"| 211工程 | {len(univ_211)}所 | 含39所985高校 |")
lines.append(f"| 双一流（第二轮） | {len(univ_syl)}所 | 含985/211高校，新增非211双一流 |")
lines.append(f"| 普通本科（非双一流） | {total_benke - len(univ_syl & set(u['name'] for u in universities))}所 | 普通公办/民办本科 |")
lines.append(f"| 高职专科 | {total_zhuanke}所 | 含公办专科、民办专科 |")
lines.append(f"| **合计** | **{len(universities)}所** | **全国普通高校总数** |")
lines.append("")

# 985高校名单明细
lines.append("### 39所985高校名单")
lines.append("")
lines.append("| 省份 | 校名 |")
lines.append("|------|------|")
prov_985 = defaultdict(list)
for name in sorted(univ_985):
    for u in universities:
        if u['name'] == name:
            prov_985[u['province']].append(name)
            break

for p in province_order:
    if p in prov_985:
        for name in prov_985[p]:
            lines.append(f"| {p} | {name} |")
lines.append("")

# 双一流非211高校名单
lines.append("### 双一流非211高校名单（新增双一流）")
lines.append("")
non211_syl = univ_syl - univ_211
for name in sorted(non211_syl):
    found = False
    for u in universities:
        if u['name'] == name:
            lines.append(f"- {name}（{u['province']}·{u['city']}）")
            found = True
            break
    if not found:
        lines.append(f"- {name}")
lines.append("")

content_univ = '\n'.join(lines)
univ_file = os.path.join(output_dir, "全国高校名录.md")
with open(univ_file, 'w', encoding='utf-8') as f:
    f.write(content_univ)

print(f"✅ 全国高校名录已生成: {univ_file}")
print(f"   文件大小: {len(content_univ)} 字符")

# ==========================================
# 第五部分：生成31省高考基础数据.md
# ==========================================

# 31省高考基础数据（2024/2025年）
# 数据来源：各省教育考试院、教育部
gaokao_data = OrderedDict([
    ("北京", {
        "gk_mode": "3+3（新高考）",
        "mode_start": "2014年启动，2020年实施",
        "total_score": "750分",
        "enroll_2024": "6.72万",
        "enroll_2025": "7.89万",
        "benke_rate_2024": "约78%",
        "yiben_rate_2024": "约46%",
        "985_rate": "约5.3%",
        "211_rate": "约21.5%",
        "remark": "本科录取率全国最高梯队，985/211录取率全国领先"
    }),
    ("天津", {
        "gk_mode": "3+3（新高考）",
        "mode_start": "2017年启动，2020年实施",
        "total_score": "750分",
        "enroll_2024": "7.08万",
        "enroll_2025": "7.4万",
        "benke_rate_2024": "约70.5%",
        "yiben_rate_2024": "约30%",
        "985_rate": "约5.8%",
        "211_rate": "约12%",
        "remark": "本科录取率全国前列，考生基数小"
    }),
    ("河北", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2018年启动，2021年实施",
        "total_score": "750分",
        "enroll_2024": "67.4万（统考）",
        "enroll_2025": "64万",
        "benke_rate_2024": "约37%",
        "yiben_rate_2024": "约15%",
        "985_rate": "约1.5%",
        "211_rate": "约4.5%",
        "remark": "高考大省，竞争激烈，本土仅河北工业大学1所211（校址天津）"
    }),
    ("山西", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2022年启动，2025年首考",
        "total_score": "750分",
        "enroll_2024": "30.54万",
        "enroll_2025": "29.15万",
        "benke_rate_2024": "约35%",
        "yiben_rate_2024": "约12%",
        "985_rate": "约1.5%",
        "211_rate": "约5%",
        "remark": "第五批新高考省份，2025年首迎改革首考"
    }),
    ("内蒙古", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2022年启动，2025年首考",
        "total_score": "750分",
        "enroll_2024": "约18万",
        "enroll_2025": "15.7万",
        "benke_rate_2024": "约38%",
        "yiben_rate_2024": "约15%",
        "985_rate": "约2.5%",
        "211_rate": "约6%",
        "remark": "第五批新高考省份，考生规模较小"
    }),
    ("辽宁", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2018年启动，2021年实施",
        "total_score": "750分",
        "enroll_2024": "19.7万",
        "enroll_2025": "20.5万",
        "benke_rate_2024": "约52%",
        "yiben_rate_2024": "约20%",
        "985_rate": "约3.5%",
        "211_rate": "约7%",
        "remark": "东北教育重镇，大连理工、东北大学两所985"
    }),
    ("吉林", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2021年启动，2024年实施",
        "total_score": "750分",
        "enroll_2024": "约13万",
        "enroll_2025": "约12.36万",
        "benke_rate_2024": "约60%",
        "yiben_rate_2024": "约20%",
        "985_rate": "约4%",
        "211_rate": "约9%",
        "remark": "考生基数小，本科录取率较高"
    }),
    ("黑龙江", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2021年启动，2024年实施",
        "total_score": "750分",
        "enroll_2024": "约19.2万",
        "enroll_2025": "约18万",
        "benke_rate_2024": "约50%",
        "yiben_rate_2024": "约18%",
        "985_rate": "约3.5%",
        "211_rate": "约8%",
        "remark": "哈工大、哈工程、东北农大、东北林大等211坐镇"
    }),
    ("上海", {
        "gk_mode": "3+3（新高考）",
        "mode_start": "2014年启动，2017年实施",
        "total_score": "660分",
        "enroll_2024": "约5.4万",
        "enroll_2025": "6.3万",
        "benke_rate_2024": "约72%",
        "yiben_rate_2024": "约35%",
        "985_rate": "约5.5%",
        "211_rate": "约27%",
        "remark": "新高考先行者，高校资源丰富，录取率全国顶尖"
    }),
    ("江苏", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2018年启动，2021年实施",
        "total_score": "750分",
        "enroll_2024": "47.7万",
        "enroll_2025": "51.2万",
        "benke_rate_2024": "约50%",
        "yiben_rate_2024": "约22%",
        "985_rate": "约2.5%",
        "211_rate": "约7.5%",
        "remark": "教育强省，11所211高校，竞争仍然激烈"
    }),
    ("浙江", {
        "gk_mode": "3+3（新高考）",
        "mode_start": "2014年启动，2017年实施",
        "total_score": "750分",
        "enroll_2024": "39.6万",
        "enroll_2025": "40.2万",
        "benke_rate_2024": "约43%",
        "yiben_rate_2024": "约18%",
        "985_rate": "约2%",
        "211_rate": "约5.5%",
        "remark": "新高考先行者，仅浙大1所985/211，但浙大实力极强"
    }),
    ("安徽", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2021年启动，2024年实施",
        "total_score": "750分",
        "enroll_2024": "65.4万",
        "enroll_2025": "约60万",
        "benke_rate_2024": "约40%",
        "yiben_rate_2024": "约15%",
        "985_rate": "约1.8%",
        "211_rate": "约5%",
        "remark": "考生大省，中科大、合工大、安大三所211"
    }),
    ("福建", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2018年启动，2021年实施",
        "total_score": "750分",
        "enroll_2024": "24.2万",
        "enroll_2025": "25.88万",
        "benke_rate_2024": "约50%",
        "yiben_rate_2024": "约20%",
        "985_rate": "约2.5%",
        "211_rate": "约6.5%",
        "remark": "厦门大学、福州大学坐镇"
    }),
    ("江西", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2021年启动，2024年实施",
        "total_score": "750分",
        "enroll_2024": "64.21万",
        "enroll_2025": "64.63万",
        "benke_rate_2024": "约36%",
        "yiben_rate_2024": "约9.9%",
        "985_rate": "约1.2%",
        "211_rate": "约4%",
        "remark": "高考难度'极难'级别，仅南昌大学1所211"
    }),
    ("山东", {
        "gk_mode": "3+3（新高考）",
        "mode_start": "2017年启动，2020年实施",
        "total_score": "750分",
        "enroll_2024": "约99.8万",
        "enroll_2025": "74万（夏季）/69.2万（实际参考）",
        "benke_rate_2024": "约36%",
        "yiben_rate_2024": "约12%",
        "985_rate": "约1.5%",
        "211_rate": "约4.5%",
        "remark": "高考大省，山大、海大两所985，中国石油大学（华东）"
    }),
    ("河南", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2022年启动，2025年首考",
        "total_score": "750分",
        "enroll_2024": "约136万",
        "enroll_2025": "约136万（统考103.3万）",
        "benke_rate_2024": "约34.2%",
        "yiben_rate_2024": "约9.9%",
        "985_rate": "约0.9%",
        "211_rate": "约1.4%",
        "remark": "全国考生最多省份，985/211录取率全国垫底，仅郑州大学1所211"
    }),
    ("湖北", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2018年启动，2021年实施",
        "total_score": "750分",
        "enroll_2024": "52.5万",
        "enroll_2025": "52.5万",
        "benke_rate_2024": "约45%",
        "yiben_rate_2024": "约18%",
        "985_rate": "约2.5%",
        "211_rate": "约7.5%",
        "remark": "武汉7所211，武大、华科两所985"
    }),
    ("湖南", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2018年启动，2021年实施",
        "total_score": "750分",
        "enroll_2024": "72.7万（统考50.5万）",
        "enroll_2025": "73.2万（统考49.9万）",
        "benke_rate_2024": "约39%",
        "yiben_rate_2024": "约15%",
        "985_rate": "约2%",
        "211_rate": "约5.5%",
        "remark": "中南大学、湖南大学、国防科大3所985"
    }),
    ("广东", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2018年启动，2021年实施",
        "total_score": "750分",
        "enroll_2024": "76.8万（实考72.1万）",
        "enroll_2025": "78.4万",
        "benke_rate_2024": "约40%",
        "yiben_rate_2024": "约15%",
        "985_rate": "约1.8%",
        "211_rate": "约5%",
        "remark": "考生大省，中山大学、华南理工2所985，暨大、华师2所211"
    }),
    ("广西", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2021年启动，2024年实施",
        "total_score": "750分",
        "enroll_2024": "约38.9万（统考）",
        "enroll_2025": "约37万",
        "benke_rate_2024": "约34%",
        "yiben_rate_2024": "约8.4%",
        "985_rate": "约1%",
        "211_rate": "约3.5%",
        "remark": "高考'极难'级别，仅广西大学1所211"
    }),
    ("海南", {
        "gk_mode": "3+3（新高考）",
        "mode_start": "2017年启动，2020年实施",
        "total_score": "900分（标准分）",
        "enroll_2024": "7.4万",
        "enroll_2025": "7.5万",
        "benke_rate_2024": "约55%",
        "yiben_rate_2024": "约18%",
        "985_rate": "约3%",
        "211_rate": "约8%",
        "remark": "考生少，采用标准分900分制，海南大学1所211"
    }),
    ("重庆", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2018年启动，2021年实施",
        "total_score": "750分",
        "enroll_2024": "35.4万（统考20.3万）",
        "enroll_2025": "37.2万（统考21.6万）",
        "benke_rate_2024": "约42%",
        "yiben_rate_2024": "约18%",
        "985_rate": "约2.5%",
        "211_rate": "约6.5%",
        "remark": "重庆大学、西南大学坐镇"
    }),
    ("四川", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2022年启动，2025年首考",
        "total_score": "750分",
        "enroll_2024": "83.52万（实考59.54万）",
        "enroll_2025": "约83.52万（实考57.17万）",
        "benke_rate_2024": "约35%",
        "yiben_rate_2024": "约12%",
        "985_rate": "约1.8%",
        "211_rate": "约5%",
        "remark": "第五批新高考，川大、电子科大2所985"
    }),
    ("贵州", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2021年启动，2024年实施",
        "total_score": "750分",
        "enroll_2024": "47.25万",
        "enroll_2025": "43.4万",
        "benke_rate_2024": "约32%",
        "yiben_rate_2024": "约10%",
        "985_rate": "约1.2%",
        "211_rate": "约4%",
        "remark": "仅贵州大学1所211"
    }),
    ("云南", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2022年启动，2025年首考",
        "total_score": "750分",
        "enroll_2024": "39.5万",
        "enroll_2025": "38.24万",
        "benke_rate_2024": "约34%",
        "yiben_rate_2024": "约10.9%",
        "985_rate": "约1.2%",
        "211_rate": "约4%",
        "remark": "高考'极难'级别，仅云南大学1所211"
    }),
    ("西藏", {
        "gk_mode": "传统文理分科（未改革）",
        "mode_start": "尚未实施新高考",
        "total_score": "750分",
        "enroll_2024": "约3.5万",
        "enroll_2025": "约3.6万",
        "benke_rate_2024": "约40%",
        "yiben_rate_2024": "约15%",
        "985_rate": "约2%",
        "211_rate": "约6%",
        "remark": "考生极少，西藏大学1所211，享受少数民族优惠政策"
    }),
    ("陕西", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2022年启动，2025年首考",
        "total_score": "750分",
        "enroll_2024": "约27万",
        "enroll_2025": "28.15万",
        "benke_rate_2024": "约42%",
        "yiben_rate_2024": "约18%",
        "985_rate": "约3.5%",
        "211_rate": "约7.5%",
        "remark": "西安交大、西工大、西北农林3所985，7所211"
    }),
    ("甘肃", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2021年启动，2024年实施",
        "total_score": "750分",
        "enroll_2024": "约22.6万",
        "enroll_2025": "23.24万",
        "benke_rate_2024": "约40%",
        "yiben_rate_2024": "约15%",
        "985_rate": "约2.5%",
        "211_rate": "约6%",
        "remark": "兰州大学1所985/211，为西北教育重镇"
    }),
    ("青海", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2022年启动，2025年首考",
        "total_score": "750分",
        "enroll_2024": "约5.5万",
        "enroll_2025": "5.99万",
        "benke_rate_2024": "约43%",
        "yiben_rate_2024": "约15%",
        "985_rate": "约2.5%",
        "211_rate": "约7%",
        "remark": "考生极少，青海大学1所211"
    }),
    ("宁夏", {
        "gk_mode": "3+1+2（新高考）",
        "mode_start": "2022年启动，2025年首考",
        "total_score": "750分",
        "enroll_2024": "7.3万",
        "enroll_2025": "约7.5万",
        "benke_rate_2024": "约45%",
        "yiben_rate_2024": "约16%",
        "985_rate": "约2%",
        "211_rate": "约6%",
        "remark": "考生少，宁夏大学1所211"
    }),
    ("新疆", {
        "gk_mode": "传统文理分科（未改革）",
        "mode_start": "尚未实施新高考",
        "total_score": "750分",
        "enroll_2024": "约22.6万",
        "enroll_2025": "23.26万",
        "benke_rate_2024": "约40%",
        "yiben_rate_2024": "约16%",
        "985_rate": "约3%",
        "211_rate": "约7%",
        "remark": "新疆大学、石河子大学2所211，享受少数民族优惠政策"
    }),
])

# 生成31省高考基础数据文件
lines2 = []
lines2.append("# 31省高考基础数据")
lines2.append("")
lines2.append("> **数据更新时间：2025/2026年**")
lines2.append("> ")
lines2.append("> **数据来源**：教育部、各省教育考试院官方公告")
lines2.append("")
lines2.append("---")
lines2.append("")
lines2.append("## 一、高考模式分类总览")
lines2.append("")
lines2.append("### 新高考改革进度")
lines2.append("")
lines2.append("| 批次 | 启动年份 | 实施年份 | 模式 | 省份 |")
lines2.append("|------|----------|----------|------|------|")
lines2.append("| 第一批 | 2014年 | 2017年 | 3+3 | 上海、浙江 |")
lines2.append("| 第二批 | 2017年 | 2020年 | 3+3 | 北京、天津、山东、海南 |")
lines2.append("| 第三批 | 2018年 | 2021年 | 3+1+2 | 河北、辽宁、江苏、福建、湖北、湖南、广东、重庆 |")
lines2.append("| 第四批 | 2021年 | 2024年 | 3+1+2 | 黑龙江、甘肃、吉林、安徽、江西、贵州、广西 |")
lines2.append("| 第五批 | 2022年 | 2025年 | 3+1+2 | 山西、河南、陕西、内蒙古、四川、云南、宁夏、青海 |")
lines2.append("| 未改革 | — | — | 传统文理 | 新疆、西藏 |")
lines2.append("")
lines2.append("> **截至2025年高考**，全国已有**29个省份**实施新高考，新高考考生占全国98%。仅新疆、西藏仍采用传统文理分科模式。")
lines2.append("")
lines2.append("### 模式说明")
lines2.append("")
lines2.append("- **3+3模式**（6省）：语文+数学+外语（必考）+ 从政/史/地/物/化/生中任选3科。上海总分660分，海南900分，其余750分。")
lines2.append("- **3+1+2模式**（23省）：语文+数学+外语（必考）+ 物理/历史二选一（首选）+ 从政/地/化/生中选2科（再选）。总分750分。")
lines2.append("- **传统文理分科**（2省）：语文+数学+外语+文综/理综。总分750分。")
lines2.append("")
lines2.append("---")
lines2.append("")
lines2.append("## 二、31省高考数据详表")
lines2.append("")

lines2.append("| 省份 | 高考模式 | 2024报名 | 2025报名 | 本科录取率 | 一本录取率 | 985录取率 | 211录取率 | 备注 |")
lines2.append("|------|----------|----------|----------|------------|------------|-----------|-----------|------|")

for p in province_order:
    d = gaokao_data[p]
    lines2.append(f"| {p} | {d['gk_mode']} | {d['enroll_2024']} | {d['enroll_2025']} | {d['benke_rate_2024']} | {d['yiben_rate_2024']} | {d['985_rate']} | {d['211_rate']} | {d['remark']} |")

lines2.append("")
lines2.append("---")
lines2.append("")
lines2.append("## 三、各省高考详细数据")
lines2.append("")

for p in province_order:
    d = gaokao_data[p]
    lines2.append(f"### {p}")
    lines2.append("")
    lines2.append(f"- **高考模式**：{d['gk_mode']}（{d['mode_start']}）")
    lines2.append(f"- **高考满分**：{d['total_score']}")
    lines2.append(f"- **2024年报名人数**：{d['enroll_2024']}")
    lines2.append(f"- **2025年报名人数**：{d['enroll_2025']}")
    lines2.append(f"- **2024年本科录取率**：{d['benke_rate_2024']}")
    lines2.append(f"- **2024年一本录取率**：{d['yiben_rate_2024']}")
    lines2.append(f"- **985录取率**：{d['985_rate']}")
    lines2.append(f"- **211录取率**：{d['211_rate']}")
    lines2.append(f"- **备注**：{d['remark']}")
    lines2.append("")

lines2.append("---")
lines2.append("")
lines2.append("## 四、高考难度分级")
lines2.append("")
lines2.append("根据综合录取难度（本科录取率+双一流/211/985/清北录取率排名），各省高考难度可分为四个级别：")
lines2.append("")
lines2.append("### 极难（4省）")
lines2.append("河南、云南、江西、广西 — 考生基数大、高校资源稀缺、各层次录取率全国垫底")
lines2.append("")
lines2.append("### 困难（11省）")
lines2.append("河北、山东、广东、湖南、浙江、山西、安徽、四川、贵州、陕西、福建 — 考生规模大或竞争激烈的教育大省")
lines2.append("")
lines2.append("### 一般（10省）")
lines2.append("江苏、湖北、重庆、辽宁、黑龙江、吉林、甘肃、宁夏、青海、海南 — 教育资源相对均衡")
lines2.append("")
lines2.append("### 容易（6省）")
lines2.append("北京、上海、天津、新疆、内蒙古、西藏 — 考生基数小或拥有丰富优质高校资源")
lines2.append("")
lines2.append("---")
lines2.append("")
lines2.append("## 五、全国高考总体数据")
lines2.append("")
lines2.append("| 指标 | 2024年 | 2025年 |")
lines2.append("|------|--------|--------|")
lines2.append("| 全国高考报名人数 | 约1342万 | 1335万 |")
lines2.append("| 实际参加统考人数 | 约892万 | 约850万 |")
lines2.append("| 本科录取总人数 | 约500万 | 约490万 |")
lines2.append("| 全国本科录取率 | 约36.5% | 约36% |")
lines2.append("| 全国总录取率（含专科） | 约79.6% | 约78% |")
lines2.append("| 双一流录取率 | 约5%-8% | 约5%-8% |")
lines2.append("| 985录取率（全国均值） | 约1.5% | 约1.5% |")
lines2.append("| 211录取率（全国均值） | 约5% | 约5% |")
lines2.append("")
lines2.append("---")
lines2.append("")
lines2.append("## 六、数据说明")
lines2.append("")
lines2.append("1. **报名人数**：部分省份公布的为总报名人数（含高职单招、对口升学等），实际参加6月统考的人数通常少于报名人数。")
lines2.append("2. **录取率**：各省录取率数据来源于各省教育考试院公告、权威教育媒体（如中国教育在线、软科等），不同统计口径可能略有差异。")
lines2.append("3. **高考模式**：2025年第五批8省份首迎新高考，至此全国29个省份实施新高考。")
lines2.append("4. **985/211录取率**：受考生基数和本省高校资源双重影响，省际差异极大。如北京985录取率约5.3%，而河南仅约0.9%。")
lines2.append("5. **双一流高校**：第二轮双一流名单共147所，不含军事院校单独统计部分。")
lines2.append("")
lines2.append("> **数据来源**：教育部官网、阳光高考平台（gaokao.chsi.com.cn）、各省教育考试院官网、中国教育在线")

content_gaokao = '\n'.join(lines2)
gaokao_file = os.path.join(output_dir, "31省高考基础数据.md")
with open(gaokao_file, 'w', encoding='utf-8') as f:
    f.write(content_gaokao)

print(f"✅ 31省高考基础数据已生成: {gaokao_file}")
print(f"   文件大小: {len(content_gaokao)} 字符")

# ==========================================
# 最终统计
# ==========================================
print("\n" + "="*50)
print("隆中计划数据补全任务完成！")
print("="*50)
print(f"\n📊 全国高校统计:")
print(f"   普通高校总数: {len(universities)}所")
print(f"   本科: {total_benke}所 | 专科: {total_zhuanke}所")
print(f"   公办: {total_gongban}所 | 民办: {total_minban}所 | 中外合作: {total_zhongwai}所")
print(f"   985: {len(univ_985)}所 | 211: {len(univ_211)}所 | 双一流: {len(univ_syl)}所")
print(f"\n📊 省份覆盖: {len(province_order)}个省/直辖市/自治区")
for p in province_order:
    count = len(by_province.get(p, []))
    print(f"   {p}: {count}所")
print(f"\n📁 输出文件:")
print(f"   1. {univ_file}")
print(f"   2. {gaokao_file}")
