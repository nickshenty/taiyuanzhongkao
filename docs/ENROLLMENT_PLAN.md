# 招生计划数据（Enrollment Plans）

> 状态：**部分可用** ｜ 已入库 2019、2024 ｜ 2025/2026 待补

招生计划数（各校当年招多少人）是分数线波动的重要外生变量：
计划大幅扩招通常压低分数线，大幅缩减则抬高。当前预测模型**尚未**使用该特征。

---

## 一、已采集

| 年份 | 学校数 | 计划合计 | 来源 | 采集方式 |
|------|--------|---------|------|---------|
| 2019 | 85 | 26,875 | [教育局 2019 公告](https://jyj.taiyuan.gov.cn/zkzx/20190621/1042522.html) | HTML 表格直取 ✅ |
| 2024 | 92 | 31,595 | [教育局 2024 公告](https://jyj.taiyuan.gov.cn/zkzx/20240623/30137622.html) | HTML 表格直取 ✅ |

数据文件：`data/enrollment/{year}.json`
源文件留存：`data/sources/enrollment/{year}-plan.html`

数据库表：`enrollment_plans`（迁移 005）
- 与 `schools`、`years` 外键关联
- 已校验：2019 年 85 所与当年分数线表 **85/85 完全对应**

---

## 二、待补年份

| 年份 | 页面 | 形式 | 状态 |
|------|------|------|------|
| 2025 | 待确认 | 图片 | ⏳ 需 OCR |
| 2026 | [教育局 2026 公告](https://jyj.taiyuan.gov.cn/zkzx/20260623/30305473.html) | **图片**（1236×8942 PNG）| ⏳ 需 OCR |

2026 年计划页正文只有说明文字，表格以长图发布：
`https://jyj.taiyuan.gov.cn/u/cms/site28/202606/2217182224yv.png`
已下载至 `data/sources/enrollment/2026-plan.png`。

### 为什么没有自动 OCR 成功

尝试用 macOS Vision 框架（`scripts/ocr-image.swift` + `scripts/ocr-plan-image.js`）分块识别：
数字与简单行识别准确（如 `65053 太原市第五十三中学校 430`），但中文校名在部分行丢失，
导致列错位，还原后仅约 60/99 所可匹配，**质量不足以入库**。

建议用现有 OCR 流程（workbuddy）转成 CSV，格式与分数线表一致即可：

```csv
学校代码,招生学校,招生计划-人数
65001,太原市外国语学校（漪汾校区）,299
```

然后：

```bash
cp ~/Desktop/plan2026.csv data/sources/enrollment/2026-plan.csv
node scripts/parse-enrollment-csv.js --year=2026
```

> 若沿用 HTML 版式（如 2019/2024），直接用：
> `node scripts/parse-enrollment.js --year=YYYY --input=页面.html`

---

## 三、纳入预测模型的前提

要让"招生计划"真正提升精度，需满足：

1. **连续年份**：至少 2024→2025→2026 三年齐备，才能计算"计划变化率"；
2. **校区级对齐**：计划表与分数线表同为校区级代码（2024 起已满足）；
3. **变化幅度显著**：计划增减 >10% 的学校才作为特征，避免噪声。

可行性验证计划（待数据齐备后执行）：

- 计算各校逐年 `planChange = (plan_t - plan_{t-1}) / plan_{t-1}`
- 检验 `planChange` 与 `(actual - predicted)` 的相关性
- 若相关性显著，在 `predictFromSeries` 中加入修正项：
  `relPos_pred += k × planChange`（k 由回归标定）
- 用回测确认 MAE 是否下降；若不下降则**不引入**（避免过度拟合）

---

## 四、相关脚本

| 脚本 | 用途 |
|------|------|
| `scripts/parse-enrollment.js` | 解析 HTML 版招生计划页 → `data/enrollment/{year}.json` |
| `scripts/ocr-image.swift` | macOS Vision 中文 OCR（输出带坐标，供表格还原） |
| `scripts/ocr-plan-image.js` | 长图分块 OCR 并还原表格（**当前精度不足，仅供参考**） |
