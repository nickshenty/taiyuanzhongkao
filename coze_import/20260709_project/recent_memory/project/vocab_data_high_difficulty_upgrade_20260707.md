# 孔子项目高考词汇数据生成脚本高难度升级 2026-07-07
## 核心改动
1. 重构generate_vocab_data.py难度分配逻辑，完全移除原A2级极基础词汇（the/be/and/of/a等），适配高二学生词汇水平
2. 新增frq阈值过滤机制，消除ECDICT collins字段异常导致的in/can/up等极基础词出现在高难度区的问题，共过滤99个异常基础词
3. 新增tag=cet4词汇池支持，四级高频部分优先选取高考真题高频超纲词作为拉分词汇
4. 统一所有天为50词/天，总词数2800词，覆盖Day2-Day57共56天，完全兼容原有数据结构
## 难度分布
- B1快速过：Day2-4，3天150词，仅选取collins=4中后50%较难词作为复习
- B2主力：Day5-26，22天1100词，覆盖全部B2级别词汇
- C1进阶：Day27-41，15天750词，覆盖全部C1级别词汇
- 四级高频/高考超纲：Day42-57，16天800词，四级高频高考超纲拉分词
## 验证结果
- Day2（B1）前10词：incident, flow, waste, mass, bomb, decline, narrow, succeed, accuse, useful
- Day30（C1）前5词：flu, mosquito, optional, aloud, cigar
- Day50（四级高频）前5词：doubt, minister, winner, seed, aim
- 全量校验：the/be/and/of/a/in/is/it/to等极基础词完全不在输出vocab_data.json中
- 脚本描述已同步更新到./codeact/index.json
