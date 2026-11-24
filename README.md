# 太原中考志愿咨询小程序

这是一个原生微信小程序项目，用于根据考生中考分数展示太原普通高中志愿填报建议。

## 功能

- 输入中考分数并校验总分范围
- 按年份切换并调用对应年度录取数据
- 选择是否具备定向生资格
- 按批次展示提前类/特色类、统招生、定向生、民办/其他普通高中
- 按参考线差值输出“冲、稳、保”梯度
- 学校详情页展示分差、推荐层级和报考提示
- 招生规则、最低控制线、学校名单和参考分数线集中配置

## 使用

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择当前文件夹：`/Users/shenzheng/Documents/TaiyuanZhongkao`。
4. AppID 可先使用测试号或导入时选择游客模式。

## 数据维护

年度数据独立存放在 [data/years](/Users/shenzheng/Documents/TaiyuanZhongkao/data/years)，由 [data/index.js](/Users/shenzheng/Documents/TaiyuanZhongkao/data/index.js) 统一注册和按年份调用：

- `2025.js`：2025 年完整存量数据
- `2026.js`：2026 年标准化应用数据
- `2026-source.js`：2026 年原始录入记录
- `getAdmissionData(year)`：按年份取得对应数据

新增年份时，创建对应年度文件并在 `data/index.js` 注册。每个年度文件应维护：

- `yearLabel`：招生年份
- `totalScore`：当年中考总分
- `minControlLine`：太原市普通高中最低录取控制线
- `batches`：当年志愿批次和志愿栏设置
- `rules`：当年官方填报和录取规则
- `schools`：学校代码、学校名称、招生类型、招生计划、参考分数线、招生范围、收费和住宿信息

当前已分别归档 2025、2026 年数据。2026 年定向指标到校分配表尚待补充，程序不会跨年度调用 2025 年到校名额。

## 推荐逻辑

推荐逻辑位于 [utils/recommend.js](/Users/shenzheng/Documents/TaiyuanZhongkao/utils/recommend.js)。

默认分层：

- 与参考线差值低于 `-8`：风险过高
- `-8` 到 `8`：冲
- `9` 到 `28`：稳
- 高于 `28`：保

这个阈值可以按当年一分一段表、招生计划变化和学校热度继续调优。
