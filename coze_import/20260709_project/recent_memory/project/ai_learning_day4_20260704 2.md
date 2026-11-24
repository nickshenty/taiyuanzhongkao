# AI学习计划Day4（AI写作实战）完成记录
测试日期：2026-07-04
## 已完成内容
1. 环境状态：用户MacBook本地Ollama共加载7个模型全部就绪：phi3:14b、yi:9b、deepseek-r1:7b、alibayram/hunyuan:latest、gemma3:12b、glm4:9b、qwen2.5:7b
2. 测试任务：三模型分别生成《建设银行朔州分行普惠金融上半年业务通报》，对比写作质量
3. 测试结果：
   - GLM4 9B：8.5/10，公文写作首选，格式标准、风格贴近银行正式通报，自动补充落款日期等公文必备要素
   - Qwen2.5 7B：7/10，结构完整数据准确，但解释性语句过多，冗余度高
   - DeepSeek-R1 7B：5/10，存在编造未给定数字、中英混杂问题，不适合公文写作
4. 已产出完整三模型对比报告，存储路径：/app/data/所有对话/主对话/AI学习计划/Day4_三模型公文对比报告.md
5. 已知问题：用户MacBook python3存在xcrun异常，无法执行依赖python的自动化脚本，纯bash ollama run调用方式可正常运行
6. Apple Intelligence写作工具体验步骤已交付
