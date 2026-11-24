# AI学习计划Day5（数据分析入门）完成记录
记录日期：2026-07-05

## 环境状态
- python3已修复（3.9.6，Day4已解决xcrun问题）
- 7个本地Ollama模型就绪：phi3:14b, yi:9b, deepseek-r1:7b, hunyuan:latest, gemma3:12b, glm4:9b, qwen2.5:7b
- Open WebUI已部署（Docker端口3000，用户选择不保持Docker后台常驻）
- Day5需新安装：pandas, ollama Python库（pip3 install pandas ollama）

## 已准备内容
1. 完整学习指南：`AI学习计划/Day5_数据分析/学习指南_Day5.md`
2. 模拟银行业务数据：80条普惠金融贷款数据（虚构脱敏），含行业、支行、担保、风险等级、逾期等17个字段
3. 5个Python脚本（全部语法验证通过）：
   - 00_环境检查.py：检查Python/pandas/ollama环境
   - 01_数据加载与探索.py：pandas数据加载、统计、可视化分布（云端测试通过✅）
   - 02_AI客户画像分析.py：风险客户画像+高价值客户画像+单客户详细画像
   - 03_业务指标异常检测.py：利率/金额/担保关联/集中度四维检测+AI解读
   - 04_自动生成分析报告.py：pandas统计+GLM4模型一键生成报告

## 核心教学设计
- pandas负责「算」：统计、筛选、分组、异常检测
- AI负责「懂」：解读数字背后的业务含义、写报告
- 关键原则：不把原始数据丢给AI，先用pandas统计，把摘要喂给AI
- 脚本默认用qwen2.5:7b，报告生成用glm4:9b（公文首选），可切换对比

## 文件路径
- 工作目录：/app/data/所有对话/主对话/AI学习计划/Day5_数据分析/
- 需复制到MacBook：~/Desktop/ai_study/Day5_数据分析/

## 待用户完成
1. 终端安装依赖：pip3 install pandas ollama
2. 将Day5文件夹复制到MacBook ~/Desktop/ai_study/
3. 按学习指南顺序运行脚本（00→01→02→03→04）
4. 尝试修改参数对比不同模型效果

## 注意事项
- localhost（MacBook）在本次执行时不可达（超时），材料已在云端准备完毕
- 所有数据均为虚构，仅用于学习
- 脚本01已在云端验证通过，其余脚本依赖本地Ollama无法在云端测试
