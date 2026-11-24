# 2025 年太原中考数据来源

已核对的官方来源：

- 太原市教育局：太原市2025年初中学业水平考试成绩揭晓（公告第一号）
  https://jyj.taiyuan.gov.cn/zkzx/20250710/30239975.html
- 太原市教育局：2025年普通高中学校招生计划
  https://jyj.taiyuan.gov.cn/zkzx/20250623/30227623.html
- 太原市教育局：2025年普通高中、职业高中填报志愿说明
  https://jyj.taiyuan.gov.cn/zkzx/20250623/30227567.html
- 太原市教育局：太原市2025年定向分数线（公告第二号）
  https://jyj.taiyuan.gov.cn/zkzx/20250714/30240491.html
- 太原市教育局：太原市2025年定向二次分配分数线（公告第三号）
  https://jyj.taiyuan.gov.cn/zkzx/20250714/30240492.html
- 太原市教育局：2025年普通高中定向生招生计划
  https://jyj.taiyuan.gov.cn/zkzx/20250623/30227612.html

当前录入说明：

- `data/years/2025.js` 已录入 2025 年普通高中最低录取控制线 615 分。
- 已录入部分普通高中统招生分数线，主要来自公告第一号图片表的“第一志愿”总分。
- 已录入部分招生计划人数，主要来自招生计划图片表第一页。
- 已从用户提供的《附件：太原市2025年优质普通高中招生指标到校分配表.pdf》提取完整指标到校分配表：145 所初中学校、21 所优质高中，指标合计 4806。
- 小程序已支持选择初中毕业学校，并按“初中学校 × 高中学校”定向名额匹配推荐；定向分数线仍使用官方“定向二次分配分数线”作为参考线。
- 官方分数线与招生计划多为图片表，当前没有完整 OCR 工具，因此仍需继续人工核对补全。

本地留存的核对图片：

- `data/source-images/2025/score-lines.png`
- `data/source-images/2025/plan-1.png`
- `data/source-images/2025/quota-plan-1.png`
- `data/source-images/2025/quota-second-lines.jpg`
- `data/extracted/2025/quota_allocations/`
