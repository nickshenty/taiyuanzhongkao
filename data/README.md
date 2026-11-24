# 年度数据目录

## 调用入口

业务代码统一通过 `data/index.js` 调用：

```js
const { availableYears, defaultYear, getAdmissionData } = require("../../data")
const data = getAdmissionData("2025")
```

`availableYears` 用于年份选择器，`defaultYear` 为当前最新年份。不要在页面中直接引用某个年度文件。

## 目录结构

- `years/2025.js`：2025 年应用数据。
- `years/2026.js`：2026 年应用数据。
- `years/2026-source.js`：2026 年原始录入数据，由 `2026.js` 标准化。
- `extracted/2025/`：从 2025 年 PDF 提取的表格和文本。
- `source-images/2025/`：2025 年来源图片。
- `README-YYYY-sources.md`：各年度来源、口径和待补数据说明。

年度之间不得继承招生计划、定向到校名额或录取线。需要跨年比较时，应由业务层分别调用两个年度，再显式计算。
