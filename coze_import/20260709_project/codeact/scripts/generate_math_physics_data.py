#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为申奇峰暑假学习计划生成每天数学和物理的详细知识点数据文件。

按天生成高一复习知识点，每条包含 content（详细讲解 500+ 字）、formulas、key_points、common_mistakes。
通过 LLM 并发生成全部 57 个知识点（数学 33 + 物理 24），输出 JSON 到指定路径。

参数：
  result_mode  - 提交模式，默认 display_only
  output_path  - 输出 JSON 文件路径，默认 ./codeact/scripts/math_physics_data.json
"""

import asyncio
import json
import os
import sys
import traceback

from pydantic import BaseModel, Field
from codeact_sdk import CodeActSDK

# ===== 配置 =====
CONCURRENCY = 4          # LLM 并发上限
MAX_RETRY = 2            # 单知识点失败后最大重试次数（不含首次）
SAVE_INTERVAL = 10       # 每完成 N 个知识点保存一次中间结果

# ===== 知识点定义 =====
KNOWLEDGE_POINTS = [
    # ===== 数学（33个）=====
    {"day": 1, "subject": "数学", "topic": "集合与常用逻辑用语",
     "outline": "集合概念与表示、交并补运算、充分必要条件、量词命题否定",
     "detail": "集合的表示方法（列举法、描述法、Venn图）、集合间关系（子集、真子集、相等）、交集并集补集的运算性质、充分条件必要条件充要条件的判断、全称量词与存在量词命题的否定"},
    {"day": 3, "subject": "数学", "topic": "函数概念与基本初等函数(上)",
     "outline": "函数三要素、定义域/值域、单调性、奇偶性、分段函数",
     "detail": "函数的定义（映射观点）、定义域的求法（分式、根式、对数等限制）、值域的求法（配方法、判别式法、单调性法）、单调性的定义与证明、奇偶性的定义与判断（定义域对称性先检查）、分段函数的图像与性质"},
    {"day": 5, "subject": "数学", "topic": "函数概念与基本初等函数(下)",
     "outline": "指数/对数函数图像与性质、幂函数、函数零点",
     "detail": "指数函数y=a^x的图像与性质（a>1递增, 0<a<1递减）、对数函数y=log_a(x)的图像与性质、指数与对数的互化关系、幂函数y=x^a的图像规律、函数零点定理（零点存在性定理）、二分法求零点近似值"},
    {"day": 7, "subject": "数学", "topic": "周日复习：集合+函数默写",
     "outline": "集合与函数核心概念默写复习",
     "detail": "集合运算性质默写、充分必要条件判断方法回顾、函数三要素复习、单调性奇偶性证明格式默写、指数对数函数性质对比表、函数零点定理条件",
     "day_type": "review"},
    {"day": 8, "subject": "数学", "topic": "三角函数(上)",
     "outline": "弧度制、三角函数定义、同角关系、诱导公式",
     "detail": "弧度制与角度制互化（π=180°）、任意角三角函数定义（坐标比定义）、同角三角函数基本关系式（sin²x+cos²x=1, tanx=sinx/cosx）、诱导公式（奇变偶不变符号看象限）"},
    {"day": 10, "subject": "数学", "topic": "三角函数(下)",
     "outline": "sin/cos/tan图像、y=Asin(ωx+φ)变换、两角和差公式、二倍角公式",
     "detail": "正弦余弦正切函数的图像与性质（周期、单调性、对称性）、y=Asin(ωx+φ)的振幅周期相位及图像变换（平移与伸缩顺序）、两角和与差公式、二倍角公式（含降幂公式）"},
    {"day": 12, "subject": "数学", "topic": "数列",
     "outline": "等差/等比数列通项与前n项和、裂项相消法、错位相减法",
     "detail": "等差数列通项a_n=a_1+(n-1)d、前n项和S_n=na_1+n(n-1)d/2、等比数列通项a_n=a_1·q^(n-1)、前n项和公式（q≠1时S_n=a_1(1-q^n)/(1-q)）、裂项相消法（1/n(n+1)型）、错位相减法（等差×等比型）"},
    {"day": 14, "subject": "数学", "topic": "周日复习：三角数列公式默写",
     "outline": "三角函数与数列公式默写复习",
     "detail": "弧度制换算默写、同角关系式默写、诱导公式默写、和差公式与二倍角公式默写、等差等比数列通项与求和公式默写",
     "day_type": "review"},
    {"day": 15, "subject": "数学", "topic": "平面向量",
     "outline": "线性运算、共线定理、坐标运算、数量积、夹角与垂直",
     "detail": "向量的加减法（三角形法则、平行四边形法则）、数乘运算、共线向量定理（a=λb）、向量的坐标表示与坐标运算、数量积a·b=|a||b|cosθ= x1x2+y1y2、向量夹角公式、垂直条件a·b=0"},
    {"day": 17, "subject": "数学", "topic": "立体几何(一)：空间几何体",
     "outline": "棱柱/锥/台、三视图、表面积体积公式",
     "detail": "棱柱棱锥棱台的结构特征、圆柱圆锥圆台、球的性质、三视图（正视图、侧视图、俯视图）的画法与还原、空间几何体的表面积与体积公式（柱、锥、台、球）"},
    {"day": 19, "subject": "数学", "topic": "立体几何(二)：点线面位置关系",
     "outline": "平面三公理、异面直线、所成角",
     "detail": "平面基本性质三条公理、空间中点线面的位置关系分类、异面直线的判定与所成角的求法（平移法）、线面角的概念与求法"},
    {"day": 21, "subject": "数学", "topic": "周日复习：立体几何梳理",
     "outline": "立体几何知识梳理复习",
     "detail": "空间几何体分类与公式梳理、三视图还原方法复习、点线面位置关系总结、异面直线角与线面角求法回顾",
     "day_type": "review"},
    {"day": 22, "subject": "数学", "topic": "立体几何(三)：平行关系",
     "outline": "线面/面面平行判定与性质",
     "detail": "线面平行的判定定理（面外线与面内线平行则线面平行）、线面平行的性质定理、面面平行的判定定理（一面上两相交线平行于另一面）、面面平行的性质定理"},
    {"day": 24, "subject": "数学", "topic": "立体几何(四)：垂直关系",
     "outline": "线面/面面垂直判定与性质",
     "detail": "线面垂直的判定定理（一条直线与平面内两条相交直线垂直）、线面垂直的性质定理、三垂线定理及其逆定理、面面垂直的判定定理（一面内交线垂直线垂直另一面）、面面垂直的性质定理"},
    {"day": 26, "subject": "数学", "topic": "立体几何(五)：空间角与空间向量",
     "outline": "线面角、二面角、法向量",
     "detail": "线面角的定义与求法、二面角的定义与求法（定义法、三垂线法）、空间向量的坐标运算、平面法向量的求法、用向量法求线面角和二面角"},
    {"day": 28, "subject": "数学", "topic": "周日复习：立体几何证明重做",
     "outline": "立体几何证明题重做复习",
     "detail": "平行关系证明方法梳理与典型题重做、垂直关系证明方法梳理与典型题重做、空间角计算方法复习、向量法求空间角步骤回顾",
     "day_type": "review"},
    {"day": 29, "subject": "数学", "topic": "概率统计(一)",
     "outline": "随机事件与古典概型",
     "detail": "随机事件、必然事件、不可能事件的概念、事件的关系与运算（包含、并、交、互斥、对立）、概率的基本性质、古典概型的两个特点（有限性、等可能性）、古典概型概率公式P(A)=m/n"},
    {"day": 31, "subject": "数学", "topic": "概率统计(二)",
     "outline": "条件概率与全概率公式",
     "detail": "条件概率的定义P(A|B)=P(AB)/P(B)、条件概率的性质、乘法公式P(AB)=P(B)P(A|B)、全概率公式、贝叶斯公式简介"},
    {"day": 33, "subject": "数学", "topic": "概率统计(三)",
     "outline": "离散型随机变量：分布列、期望、方差",
     "detail": "离散型随机变量的概念、分布列的性质（概率和为1）、数学期望E(X)=Σx_i·p_i、方差D(X)=Σ(x_i-E(X))²·p_i、标准差、期望与方差的性质（E(aX+b)=aE(X)+b, D(aX+b)=a²D(X)）"},
    {"day": 35, "subject": "数学", "topic": "周日复习：概率统计公式默写",
     "outline": "概率统计公式默写复习",
     "detail": "古典概型公式默写、条件概率公式默写、全概率公式默写、期望方差公式默写、期望方差性质默写",
     "day_type": "review"},
    {"day": 36, "subject": "数学", "topic": "概率统计(四)",
     "outline": "常见分布：二项分布、超几何分布",
     "detail": "n次独立重复试验（伯努利试验）、二项分布X~B(n,p)及其期望E(X)=np、方差D(X)=np(1-p)、超几何分布的概念与公式、二项分布与超几何分布的区别与联系"},
    {"day": 38, "subject": "数学", "topic": "概率统计(五)",
     "outline": "正态分布与统计：3σ原则、回归方程、独立性检验",
     "detail": "正态分布N(μ,σ²)的图像与性质、3σ原则（P(μ-σ<X<μ+σ)≈0.683, P(μ-2σ<X<μ+2σ)≈0.954, P(μ-3σ<X<μ+3σ)≈0.997）、线性回归方程y=bx+a的求法、独立性检验（卡方统计量）"},
    {"day": 40, "subject": "数学", "topic": "概率统计综合强化",
     "outline": "概率统计综合应用",
     "detail": "古典概型与条件概率综合题、分布列与期望方差综合应用、二项分布与超几何分布综合辨析、正态分布综合应用",
     "day_type": "comprehensive"},
    {"day": 42, "subject": "数学", "topic": "周日复习：概率统计综合重做",
     "outline": "概率统计综合重做复习",
     "detail": "概率统计综合题型方法梳理、典型错题重做、公式应用条件检查清单",
     "day_type": "review"},
    {"day": 43, "subject": "数学", "topic": "立体几何+概率统计综合强化",
     "outline": "立体几何与概率统计综合",
     "detail": "立体几何与概率统计跨板块综合题型分析、空间几何体中的概率问题、综合解题策略",
     "day_type": "comprehensive"},
    {"day": 45, "subject": "数学", "topic": "函数与三角综合",
     "outline": "函数与三角函数综合应用",
     "detail": "函数性质与三角函数综合、三角函数图像变换综合、函数零点与三角方程综合、分段函数与三角综合",
     "day_type": "comprehensive"},
    {"day": 47, "subject": "数学", "topic": "数列与向量综合",
     "outline": "数列与平面向量综合应用",
     "detail": "数列与向量综合题型、向量的坐标运算与数列结合、数量积与数列不等式综合、数列求和与向量模长综合",
     "day_type": "comprehensive"},
    {"day": 49, "subject": "数学", "topic": "周日复习：全板块默写",
     "outline": "全板块公式默写复习",
     "detail": "集合与逻辑公式默写、函数与三角公式默写、数列公式默写、向量公式默写、立体几何定理默写、概率统计公式默写",
     "day_type": "review"},
    {"day": 50, "subject": "数学", "topic": "全卷模拟(一)",
     "outline": "全卷模拟练习一",
     "detail": "覆盖集合与逻辑、函数、三角函数、数列、向量等板块的综合模拟卷，重点考查函数与三角综合、数列求和",
     "day_type": "simulation"},
    {"day": 52, "subject": "数学", "topic": "全卷模拟(二)",
     "outline": "全卷模拟练习二",
     "detail": "覆盖立体几何、概率统计等板块的综合模拟卷，重点考查空间向量法、分布列与期望",
     "day_type": "simulation"},
    {"day": 54, "subject": "数学", "topic": "全卷模拟(三)",
     "outline": "全卷模拟练习三",
     "detail": "全覆盖综合模拟卷，重点考查跨板块综合题型、易错点辨析",
     "day_type": "simulation"},
    {"day": 56, "subject": "数学", "topic": "周日复习：模拟错题重做",
     "outline": "模拟错题重做复习",
     "detail": "三次模拟卷错题分类重做、高频错题知识点回溯、薄弱环节针对性强化",
     "day_type": "review"},
    {"day": 57, "subject": "数学", "topic": "总复盘",
     "outline": "全部知识点总复盘",
     "detail": "全部数学板块知识体系梳理、高频考点总结、易错知识点终极清单、考前策略",
     "day_type": "review"},

    # ===== 物理（24个）=====
    {"day": 2, "subject": "物理", "topic": "运动学(上)：匀变速直线运动",
     "outline": "v=v0+at, x=v0t+1/2at^2, v^2-v0^2=2ax, 逐差法",
     "detail": "匀变速直线运动的四个基本公式（速度公式、位移公式、速度位移公式、平均速度公式）、逐差法求加速度的原理与公式、打点计时器实验数据处理"},
    {"day": 4, "subject": "物理", "topic": "运动学(下)：图像与追及相遇",
     "outline": "x-t/v-t图、自由落体、追及相遇",
     "detail": "x-t图像的物理意义（斜率=速度）、v-t图像的物理意义（斜率=加速度，面积=位移）、自由落体运动公式（v=gt, h=1/2gt^2）、追及相遇问题的分析方法（速度相等时距离极值）"},
    {"day": 6, "subject": "物理", "topic": "力与牛顿定律(上)",
     "outline": "重力/弹力/摩擦力、正交分解",
     "detail": "重力的方向与计算G=mg、弹力的方向（垂直接触面）与胡克定律F=kx、静摩擦力与滑动摩擦力的判断、滑动摩擦力公式f=μN、力的正交分解法步骤"},
    {"day": 9, "subject": "物理", "topic": "力与牛顿定律(下)",
     "outline": "牛顿三大定律应用、超重失重、连接体",
     "detail": "牛顿第一定律（惯性）、牛顿第二定律F=ma的方向性与瞬时性、牛顿第三定律（作用力与反作用力）、超重与失重的条件与判断、连接体问题的整体法与隔离法"},
    {"day": 11, "subject": "物理", "topic": "曲线运动(上)：平抛运动",
     "outline": "运动分解、平抛公式",
     "detail": "曲线运动的条件（合外力与速度方向不在同一直线）、运动的合成与分解、平抛运动的分解（水平匀速+竖直自由落体）、平抛运动公式（x=v0t, y=1/2gt^2, v=√(vx²+vy²)）、平抛运动的推论"},
    {"day": 13, "subject": "物理", "topic": "曲线运动(下)：圆周运动基础",
     "outline": "线速度/角速度、向心加速度、向心力",
     "detail": "线速度v=2πr/T、角速度ω=2π/T=2πf、线速度与角速度关系v=ωr、向心加速度a=v²/r=ω²r、向心力F=mv²/r=mω²r、周期与频率的关系"},
    {"day": 16, "subject": "物理", "topic": "圆周运动(一)：临界问题",
     "outline": "绳模型v_min=√(gr)、杆模型、圆锥摆",
     "detail": "竖直平面圆周运动绳模型（最高点最小速度v_min=√(gr)，只有拉力无支持力）、杆模型（最高点速度可为零，杆既能拉也能推）、圆锥摆的受力分析与向心力来源"},
    {"day": 18, "subject": "物理", "topic": "圆周运动(二)：综合应用",
     "outline": "圆周运动综合应用",
     "detail": "汽车转弯问题（内外侧倾斜路面）、火车转弯问题、圆周运动与牛顿定律综合应用、圆锥摆与圆盘问题综合分析",
     "day_type": "comprehensive"},
    {"day": 20, "subject": "物理", "topic": "万有引力(一)",
     "outline": "开普勒三定律、黄金代换",
     "detail": "开普勒第一定律（轨道定律）、开普勒第二定律（面积定律）、开普勒第三定律（a³/T²=k）、万有引力定律F=Gm1m2/r²、黄金代换GM=gR²（忽略自转时）"},
    {"day": 23, "subject": "物理", "topic": "万有引力(二)",
     "outline": "三个宇宙速度、同步卫星",
     "detail": "第一宇宙速度v1=√(gR)≈7.9km/s（近地卫星速度）、第二宇宙速度v2≈11.2km/s、第三宇宙速度v3≈16.7km/s、同步卫星的六个一定（周期、轨道、高度、速率、加速度、轨道平面）"},
    {"day": 25, "subject": "物理", "topic": "万有引力(三)",
     "outline": "变轨问题、双星系统",
     "detail": "卫星变轨问题（加速离心到高轨道、减速向心到低轨道）、双星系统特点（角速度相同、向心力相同、轨道半径与质量成反比）、双星周期计算"},
    {"day": 27, "subject": "物理", "topic": "圆周运动+万有引力综合强化",
     "outline": "圆周运动与万有引力综合",
     "detail": "圆周运动与万有引力综合题型分析、卫星运动参量比较、天体表面重力加速度问题、圆周运动临界问题与万有引力综合",
     "day_type": "comprehensive"},
    {"day": 30, "subject": "物理", "topic": "功和能(一)：功与功率",
     "outline": "W=Flcosα、P=Fv、汽车启动",
     "detail": "功的定义W=Flcosα（α为力与位移的夹角）、正功负功的判断、功率的定义P=W/t、瞬时功率P=Fvcosα、汽车恒定功率启动（a减小到零匀速）、汽车恒定加速度启动（功率增大到额定功率后改恒功率）"},
    {"day": 32, "subject": "物理", "topic": "功和能(二)：动能定理",
     "outline": "Ek=1/2mv^2、W总=ΔEk",
     "detail": "动能的表达式Ek=1/2mv²、动能定理W合=ΔEk=Ek2-Ek1、动能定理的应用步骤（确定研究对象、受力分析、确定初末态、列方程）、变力做功与曲线运动中的动能定理应用"},
    {"day": 34, "subject": "物理", "topic": "功和能(三)：势能与机械能守恒",
     "outline": "重力势能、弹性势能、机械能守恒定律",
     "detail": "重力势能Ep=mgh（参考面的选取）、弹性势能Ep=1/2kx²、机械能守恒条件（只有重力弹力做功）、机械能守恒定律的表达式（Ek1+Ep1=Ek2+Ep2）、机械能守恒定律的应用步骤"},
    {"day": 37, "subject": "物理", "topic": "功和能(四)：功能关系综合",
     "outline": "功能原理、能量转化",
     "detail": "功能关系（合外力做功等于动能变化、重力做功等于重力势能变化、非保守力做功等于机械能变化）、各种力做功与对应能量变化的关系、能量守恒定律的应用",
     "day_type": "comprehensive"},
    {"day": 39, "subject": "物理", "topic": "功和能综合强化(一)",
     "outline": "功和能综合应用一",
     "detail": "动能定理与机械能守恒综合应用、多过程问题中的能量分析、变力做功问题、功能关系在复杂运动中的应用",
     "day_type": "comprehensive"},
    {"day": 41, "subject": "物理", "topic": "功和能综合强化(二)",
     "outline": "传送带、板块模型",
     "detail": "传送带问题的能量分析（摩擦生热Q=fx相对）、传送带匀速与加速过程的能量转化、板块模型（滑块在木板上滑动）的受力分析与能量分析、相对位移与摩擦生热的计算",
     "day_type": "comprehensive"},
    {"day": 44, "subject": "物理", "topic": "动量(上)：动量定理",
     "outline": "p=mv、I=Ft、Ft=Δp",
     "detail": "动量的定义p=mv（矢量，方向与速度方向相同）、冲量的定义I=Ft（恒力冲量）、动量定理F合t=Δp=p2-p1、动量定理的应用（打击碰撞问题、流体冲击力问题）、动量定理的矢量性"},
    {"day": 46, "subject": "物理", "topic": "动量(下)：动量守恒与碰撞",
     "outline": "动量守恒定律、弹性碰撞、非弹性碰撞",
     "detail": "动量守恒条件（系统不受外力或合外力为零）、动量守恒定律m1v1+m2v2=m1v1'+m2v2'、弹性碰撞（动量和动能都守恒）、非弹性碰撞（动量守恒动能不守恒）、完全非弹性碰撞（碰后粘在一起，动能损失最大）"},
    {"day": 48, "subject": "物理", "topic": "力学综合(一)：能量+动量",
     "outline": "能量与动量综合应用",
     "detail": "动量守恒与机械能守恒综合应用、子弹打木块问题、弹簧连接体问题、碰撞中能量损失的计算、多过程力学综合题分析方法",
     "day_type": "comprehensive"},
    {"day": 51, "subject": "物理", "topic": "力学综合(二)：牛顿定律+能量",
     "outline": "牛顿定律与能量综合应用",
     "detail": "牛顿运动定律与动能定理综合应用、多过程问题中牛顿定律与能量方法的交替使用、临界状态分析、整体法与隔离法在能量问题中的应用",
     "day_type": "comprehensive"},
    {"day": 53, "subject": "物理", "topic": "全卷模拟(一)",
     "outline": "全卷模拟练习一",
     "detail": "覆盖运动学、力与牛顿定律、曲线运动等板块的综合模拟卷，重点考查牛顿定律应用与运动学综合",
     "day_type": "simulation"},
    {"day": 55, "subject": "物理", "topic": "全卷模拟(二)",
     "outline": "全卷模拟练习二",
     "detail": "覆盖万有引力、功和能、动量等板块的综合模拟卷，重点考查能量动量综合与力学综合",
     "day_type": "simulation"},
]


class KnowledgePointData(BaseModel):
    """LLM 生成的单个知识点结构化输出。"""
    content: str = Field(description="详细的复习内容（至少500字），包含概念定义、重要公式/定理、解题方法、典型例题思路")
    formulas: list[str] = Field(description="重要公式列表，用纯文本表示")
    key_points: list[str] = Field(description="核心要点列表，每个要点一句话")
    common_mistakes: list[str] = Field(description="常见易错点列表，每个易错点一句话")


def build_prompt(kp: dict) -> str:
    subject = kp["subject"]
    topic = kp["topic"]
    outline = kp["outline"]
    detail = kp.get("detail", outline)
    day_type = kp.get("day_type", "normal")

    if day_type == "review":
        type_instruction = (
            "这是一节复习课。请生成详细的复习要点清单和默写内容，包括：\n"
            "- 需要默写记忆的核心公式与定理（逐条列出）\n"
            "- 概念定义的精确表述\n"
            "- 方法步骤的总结\n"
            "- 典型易错提醒\n"
            "重点在于帮助学生系统梳理已学知识，巩固记忆。"
        )
    elif day_type == "simulation":
        type_instruction = (
            "这是一节模拟考试课。请生成考试备考指导，包括：\n"
            "- 本卷覆盖的知识板块与重点题型\n"
            "- 各板块的考试重点与高频考点\n"
            "- 解题策略与时间分配建议\n"
            "- 常见失分点与注意事项"
        )
    elif day_type == "comprehensive":
        type_instruction = (
            "这是一节综合强化课。请生成综合应用指导，包括：\n"
            "- 综合题型的分类与分析方法\n"
            "- 跨知识点联系与解题思路\n"
            "- 典型综合题型及解题步骤\n"
            "- 常见错误与规避策略"
        )
    else:
        type_instruction = (
            "这是一节知识点复习课。请生成详细的知识点讲解内容，包括：\n"
            "- 概念的精确定义与物理/数学意义\n"
            "- 重要公式/定理的推导或来源\n"
            "- 公式适用条件与注意事项\n"
            "- 典型题型与解题方法步骤\n"
            "- 关键结论与推论"
        )

    return f"""你是经验丰富的高中{subject}教师，正在为一名高一升高二的学生编写暑假复习资料。
学生需要复习高一知识点，请确保内容准确、完整、详实。

科目：{subject}
主题：{topic}
知识点范围：{outline}
详细内容要点：{detail}

{type_instruction}

请严格按照以下结构生成内容：

1. content: 详细的复习内容（至少500字）。要求：
   - 概念定义准确完整
   - 公式定理清晰列出并说明含义
   - 解题方法步骤化
   - 关键结论突出
   - 可以包含典型例题的解题思路
   - 用纯文本表示，不使用LaTeX

2. formulas: 重要公式列表。要求：
   - 用纯文本表示，如 v=v0+at, x=v0t+1/2at^2
   - 每个公式单独一行（列表的一项）
   - 至少列出5个核心公式
   - 对每个公式可简要标注其含义

3. key_points: 核心要点列表。要求：
   - 每个要点一句话，简洁明了
   - 至少列出5个核心要点
   - 覆盖概念、方法、结论

4. common_mistakes: 常见易错点列表。要求：
   - 每个易错点一句话，具体到操作层面
   - 至少列出3个易错点
   - 指出错误原因和正确做法"""


async def generate_one(sdk: CodeActSDK, kp: dict, sem: asyncio.Semaphore) -> dict:
    """生成单个知识点的详细内容，带重试。"""
    day = kp["day"]
    topic = kp["topic"]
    prompt = build_prompt(kp)
    last_error = "未知错误"

    for attempt in range(MAX_RETRY + 1):
        try:
            async with sem:
                result = await sdk.call_llm(
                    messages=[{"role": "user", "content": prompt}],
                    response_format=KnowledgePointData,
                )

            # 提取数据（兼容 Pydantic 实例和 dict）
            if isinstance(result, KnowledgePointData):
                data = result
            elif isinstance(result, dict):
                data = KnowledgePointData(**result)
            elif isinstance(result, str):
                # 兜底：尝试解析 JSON 字符串
                try:
                    parsed = json.loads(result)
                    data = KnowledgePointData(**parsed)
                except (json.JSONDecodeError, Exception):
                    data = KnowledgePointData(
                        content=result,
                        formulas=[],
                        key_points=[],
                        common_mistakes=[],
                    )
            else:
                data = KnowledgePointData(
                    content=str(result),
                    formulas=[],
                    key_points=[],
                    common_mistakes=[],
                )

            content_len = len(data.content)
            print(f"  [OK] Day{day} {topic} ({content_len}字, {len(data.formulas)}公式)")

            return {
                "subject": kp["subject"],
                "topic": topic,
                "content": data.content,
                "formulas": data.formulas,
                "key_points": data.key_points,
                "common_mistakes": data.common_mistakes,
            }
        except Exception as e:
            last_error = str(e)
            if attempt < MAX_RETRY:
                print(f"  [重试 {attempt+1}/{MAX_RETRY}] Day{day} {topic}: {e}")
                await asyncio.sleep(2 * (attempt + 1))
            else:
                print(f"  [失败] Day{day} {topic}: {e}")

    # 所有重试失败后返回占位数据
    return {
        "subject": kp["subject"],
        "topic": topic,
        "content": f"生成失败，请手动补充。知识点范围：{kp['outline']}。错误：{last_error}",
        "formulas": [],
        "key_points": [],
        "common_mistakes": [],
    }


async def wrapped_generate(sdk: CodeActSDK, kp: dict, sem: asyncio.Semaphore) -> tuple:
    """包装生成函数，返回 (kp, result) 以便 as_completed 能识别。"""
    result = await generate_one(sdk, kp, sem)
    return kp, result


def save_output(output: dict, output_path: str):
    """保存结果到 JSON 文件。"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)


def norm_mode(raw: str) -> str:
    mode = (raw or "display_only").strip().lower()
    return mode if mode in {"display_only", "notify", "no_reply"} else "display_only"


def load_existing(output_path: str) -> dict:
    """加载已有结果，支持断点续跑。"""
    if os.path.exists(output_path):
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "math" in data and "physics" in data:
                    return data
        except Exception:
            pass
    return {"math": {}, "physics": {}}


def is_complete(item: dict) -> bool:
    """检查某个知识点是否已完整生成（非占位数据）。"""
    content = item.get("content", "")
    return len(content) > 100 and "生成失败" not in content


async def main():
    result_mode = norm_mode(sys.argv[1] if len(sys.argv) > 1 else "display_only")
    output_path = sys.argv[2] if len(sys.argv) > 2 else "./codeact/scripts/math_physics_data.json"

    print(f"[参数] result_mode={result_mode}, output_path={output_path}")

    # 加载已有结果（断点续跑）
    output = load_existing(output_path)
    existing_math = set(output["math"].keys())
    existing_phys = set(output["physics"].keys())
    print(f"[已有] 数学 {len(existing_math)} 个, 物理 {len(existing_phys)} 个")

    # 筛选需要生成的知识点
    todo_points = []
    for kp in KNOWLEDGE_POINTS:
        day_key = str(kp["day"])
        section = "math" if kp["subject"] == "数学" else "physics"
        existing_set = existing_math if section == "math" else existing_phys
        if day_key not in existing_set or not is_complete(output[section].get(day_key, {})):
            todo_points.append(kp)

    print(f"[知识点] 共 {len(KNOWLEDGE_POINTS)} 个, 待生成 {len(todo_points)} 个（数学{sum(1 for kp in todo_points if kp['subject']=='数学')}个 + 物理{sum(1 for kp in todo_points if kp['subject']=='物理')}个）")

    sdk = CodeActSDK()

    if not todo_points:
        print("[完成] 所有知识点已生成，无需重新生成")
        math_count = len(output["math"])
        physics_count = len(output["physics"])
        abs_path = os.path.abspath(output_path)
        message = (
            f"数学+物理知识点数据已全部生成完成：数学{math_count}个、物理{physics_count}个。\n"
            f"文件路径：[查看数据文件](computer://{abs_path})"
        )
        await sdk.submit_result(
            result_mode=result_mode, status="success", message=message,
            data={"output_path": abs_path, "math_count": math_count, "physics_count": physics_count},
        )
        return

    try:
        sem = asyncio.Semaphore(CONCURRENCY)
        total = len(todo_points)

        # 创建所有任务
        pending = [wrapped_generate(sdk, kp, sem) for kp in todo_points]

        completed = 0
        failed = []

        # 按完成顺序处理结果
        for fut in asyncio.as_completed(pending):
            try:
                kp, result = await fut
                day_key = str(kp["day"])
                if kp["subject"] == "数学":
                    output["math"][day_key] = result
                else:
                    output["physics"][day_key] = result

                completed += 1
                print(f"[进度] {completed}/{total}")

                # 定期保存中间结果
                if completed % SAVE_INTERVAL == 0 or completed == total:
                    save_output(output, output_path)
                    print(f"  [保存] 中间结果已写入 {output_path}")

            except Exception as e:
                completed += 1
                print(f"[异常] 结果处理失败: {e}")

        # 最终保存
        save_output(output, output_path)

        math_count = len(output["math"])
        physics_count = len(output["physics"])

        # 统计失败项
        for section, data in [("math", output["math"]), ("physics", output["physics"])]:
            for day_key, item in data.items():
                if "生成失败" in item.get("content", ""):
                    failed.append(f"Day{day_key}({section})")

        failed_count = len(failed)
        print(f"\n[完成] 数学: {math_count}个, 物理: {physics_count}个, 失败: {failed_count}个")
        if failed:
            print(f"[失败列表] {', '.join(failed)}")

        # 构建消息
        abs_path = os.path.abspath(output_path)
        if failed_count > 0:
            message = (
                f"数学+物理知识点数据已生成：数学{math_count}个、物理{physics_count}个，"
                f"其中{failed_count}个生成失败需手动补充。\n"
                f"文件路径：[查看数据文件](computer://{abs_path})"
            )
        else:
            message = (
                f"数学+物理知识点数据已全部生成完成：数学{math_count}个、物理{physics_count}个。\n"
                f"文件路径：[查看数据文件](computer://{abs_path})"
            )

        await sdk.submit_result(
            result_mode=result_mode,
            status="success",
            message=message,
            data={
                "output_path": abs_path,
                "math_count": math_count,
                "physics_count": physics_count,
                "total_count": math_count + physics_count,
                "failed_count": failed_count,
                "failed_days": failed,
            },
        )

    except Exception as e:
        print(traceback.format_exc())
        await sdk.submit_result(
            result_mode="notify",
            status="error",
            message=f"执行失败: {e}",
            data={"error_type": type(e).__name__},
        )


if __name__ == "__main__":
    asyncio.run(main())
