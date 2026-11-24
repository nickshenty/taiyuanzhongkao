# AI学习第一阶段（7/1-7/7）进度记录

## Day1 完成记录
日期：2026-07-02
### 完成内容
1. 解决国内网络GFW拦截问题，使用gh-proxy GitHub镜像成功下载安装Ollama v0.31.1
2. 成功拉取4.7GB大小的Qwen2.5:7b大模型
3. 中文对话测试通过，模型正常返回自我介绍结果
### 后续
Day2 2026-07-02 20:30 模型选型对比

---

## Day2 执行状态
日期：2026-07-02 20:30
### 状态：待主人手动执行
### 原因
MacBook Air M5 桌面设备不在线（localhost状态Offline），无法远程执行终端命令。与Day1情况相同。
### 已准备材料
1. `Day2_执行指南.md` —— 详细的手动操作步骤，含两种执行方式
2. `Day2_模型对比结果.md` —— 对比表模板，测试后填写
3. `day2_auto_test.sh` —— 自动化测试脚本（可选）
4. `day2_model_comparison_test.sh` —— 手动版测试脚本
### 任务内容
1. 下载 deepseek-r1:7b 和 gemma4:12b（或gemma3:12b）
2. 对3个模型执行4组场景测试：公文润色、数据分析、政策解读、写作辅助
3. 记录每个模型的响应速度、质量表现
4. 填写"模型-场景对照表"
### 下一步
主人手动完成测试后，根据结果整理最终的模型选型对照表。
Day3（7/3）：Web界面部署（Open WebUI / LM Studio）
---
## Day2 实际进度更新（2026-07-02 23:34）
### 大模型下载结果
1. ✅ 已成功下载部署4个模型：
   - qwen2.5:7b（4.7GB，此前已有）
   - glm4:9b（5.5GB）
   - gemma3:12b（8.1GB）
   - alibayram/hunyuan（2.6GB，腾讯混元社区版）
2. ❌ 3个模型远程下载超时（均因文件体积较大触发900秒工具硬超时），待用户手动在本地终端执行命令下载：
   - deepseek-r1:7b（4.7GB）
   - yi:9b（5.4GB）
   - phi3:14b（7.9GB）
3. 已备好手动下载指南，全部下载完成后将启动4组场景对比测试：公文润色、数据分析、政策解读、写作辅助，最终产出不同场景下的最优模型选型对照表。

---

## Day3 执行状态
日期：2026-07-03 20:30
### 状态：待主人手动执行
### 原因
MacBook Air M5 桌面设备不在线（localhost状态Offline），无法远程执行终端命令。与Day1、Day2情况相同。
### 已准备材料
1. `Day3_执行指南.md` —— 完整的Web界面部署指南
### 任务内容
1. 安装 Docker Desktop（Mac Apple Silicon 版）
2. 部署 Open WebUI 容器，连接本地 Ollama
3. 浏览器访问 http://localhost:3000 使用 Web 界面
4. 备选方案：安装 LM Studio（零命令行，支持MLX加速，苹果M5官方推荐）
5. 配置 Ollama 性能优化参数（环境变量方式）
### 关键技术要点
- Open WebUI 在 Docker 中运行时，需用 `host.docker.internal:11434` 连接宿主机的 Ollama（不是 localhost）
- Docker 命令需加 `--add-host=host.docker.internal:host-gateway` 参数
- LM Studio 支持 MLX 后端，在 M5 上推理速度约为 Ollama 的 2 倍
- Ollama 性能优化：OLLAMA_NUM_PARALLEL=2, OLLAMA_MAX_LOADED_MODELS=2, OLLAMA_KEEP_ALIVE=10m, OLLAMA_FLASH_ATTENTION=1
### 下一步
Day4（7/4 周六）：AI写作实战（Apple Intelligence + 本地模型写公文）