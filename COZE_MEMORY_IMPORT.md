# Coze 记忆导入总入口

导入日期：2026-07-10

来源文件：
- `/Users/shenzheng/Downloads/_app_data_所有对话_主对话_安西教练_项目文件备份_20260709.tar.gz`
- `/Users/shenzheng/Downloads/_app_data_所有对话_主对话_安西教练_用户上传文件_20260709.tar.gz`

本地导入位置：
- 核心项目文件：`coze_import/20260709_project/`
- 用户上传附件：`coze_import/20260709_uploads/`
- 文件清单：`coze_import/indexes/project_files.txt`
- 附件清单：`coze_import/indexes/upload_files.txt`

导入规模：
- 核心项目包：约 13MB，568 个文件
- 用户上传包：约 398MB，351 个文件
- 合计：约 411MB

## 恢复上下文时优先读取

以后新线程要恢复 Coze 上下文时，优先读取这些文件：

1. `COZE_MEMORY_IMPORT.md`
2. `coze_import/20260709_project/安西教练_备份索引.md`
3. `coze_import/20260709_project/USER.md`
4. `coze_import/20260709_project/MEMORY.md`
5. `coze_import/20260709_project/recent_memory/index.json`
6. 对具体项目，再读取 `coze_import/20260709_project/recent_memory/project/*.md`

敏感文件 `SECRET.md` 已随包导入，但默认不读取、不复述、不传播。只有用户明确要求处理凭证迁移或配置时再打开。

## 用户画像核心

用户为申正，男，1981-04-08 生，山西左权人。职业身份为建行朔州分行副行长，分管普惠、乡村金融、个贷；高级经济师，具备基金从业资格，在读山西大学工商管理硕士，本科为北理工计算机。近期重点身份包括金融科技方向专家级人才库成员、党建培训与高管任前谈话相关事项完成者。

常用设备包括 iPad、MacBook Air M5。关注方向包括党建知识、建行历史文化、数字化经营、股票投资分析、MacBook AI 应用、公共营养师、家庭健康、孩子学习规划、跑步半马训练。

大模型偏好：国内大模型可广泛接入；海外模型优先保留 Google、OpenAI、微软三大系，排除 Meta/Llama 等其他海外模型。

重要家庭学习对象：大儿子申奇峰，太原五中高一升高二，2026 年高一期末总分 494.5/750，薄弱科目为物理、化学、英语。当前大量项目围绕申奇峰高考突破、暑假学习计划、飞书推送和 PDF 学习资料生成。

## 长期交互规则

- 深夜 23:00 至次日 07:00 不推送非紧急提醒。
- 用户正式参会期间不推送非紧急通知。
- 如日程回调不可靠，通过 19:50 心跳检查当日待推送内容。
- 新项目倾向使用中国古代名人作代号。
- 涉及手机号、邮箱、账号注册等操作，必须先征得用户同意。
- 推送到飞书或其他渠道的内容，应同步在主对话展示给主人。
- 申奇峰学习资料推送规则：每日学习内容和测试卷 PDF 提前生成，先给主人审核，通过后再推送；固定早 7 点发学习内容 PDF，晚 8 点发测试卷 PDF，22 点后不推送。

## 项目代号与状态

运行中：
- 孔子：申奇峰高考突破计划。核心项目，含 57 天暑假学习计划、六科资料、PDF 生成、飞书推送、错题和知识点数据。
- 墨子：AI 学习课程规划。MacBook AI、本地模型、Open WebUI、数据分析、知识管理、个人 AI 工作流。
- 范蠡：股票关注追踪。半导体、机器人、金转油能源方向，含财经快讯扫描和日报。
- 戴宗：太原半马训练。目标为 2026-09-27 太原半马，目标完赛 2:00-2:20，并包含周边马拉松赛事扫描。
- 计然：卢麒元微博追踪。
- 洪迈：个人详细资料记录，持续补充用户职业、家庭、健康和偏好。

已完成或阶段完成：
- 公共营养师备考：2026-06-27 考试已完成，复习资料、真题核对和知识库已闭环。
- 孟母：山西/太原中考志愿资料，含 2025 太原中考录取分数线汇总。
- 白圭：金转油投资标的推荐。
- 伊尹：家庭一周食谱及备料。
- 党建培训、高管谈话、建行情景沙盘等阶段任务已有成品资料。

暂停、关闭或待启动：
- 隆中：高考志愿 AI Agent，数据底座完成，但项目已关闭；本地资料仍完整。
- 桑弘羊：中国资产重新定价系列报道，待启动。
- 归有光：小说《生存边界》，已有第一章初稿和四卷规划，等待继续创作。
- 鲁班：Codex 升级/OpenAI API Key，等待 Key。
- 张衡：ComfyUI 安装，用户自行安装中。

## 我对用户长期目标的理解

用户不是只做单点任务，而是在建立一个“个人 AI 助理 + 家庭教育 + 职业经营 + 投资研究 + 健康训练”的长期工作系统。

核心目标包括：
- 把 AI 用到真实工作中：党建、普惠金融、数字化经营、材料写作、数据分析、知识管理和自动化脚本。
- 建立孩子申奇峰的高考突破系统：诊断薄弱科目，生成六科学习材料，自动化 PDF 和飞书推送，持续跟踪错题与知识点掌握。
- 管理个人发展：职业履历、党建培训、建行历史文化、高管谈话、金融科技能力建设。
- 管理家庭健康与生活：体检分析、家庭食谱、营养知识、公共营养师学习成果复用。
- 做投资与宏观跟踪：股票标的、板块扫描、卢麒元观点、中国资产重估、能源与机器人等方向。
- 做长期内容创作：包括科幻小说《生存边界》、中国资产重估系列、短视频或文章脚本。
- 建立可迁移、可复用的本地知识库，避免平台迁移导致项目成果丢失。

## 主要资料入口

核心记忆：
- `coze_import/20260709_project/USER.md`
- `coze_import/20260709_project/MEMORY.md`
- `coze_import/20260709_project/recent_memory/index.json`
- `coze_import/20260709_project/recent_memory/project/`

孔子项目：
- `coze_import/20260709_project/孔子学习辅助/`
- `coze_import/20260709_project/codeact/scripts/daily_study_push.py`
- `coze_import/20260709_project/codeact/scripts/generate_week1_pdfs.py`
- `coze_import/20260709_project/codeact/scripts/generate_week1_tests.py`
- `coze_import/20260709_project/codeact/scripts/realloc_science_study_plan.py`

墨子项目：
- `coze_import/20260709_project/AI学习计划/`
- `coze_import/20260709_project/recent_memory/project/ai_learning_phase1.md`
- `coze_import/20260709_project/recent_memory/project/open_webui_deploy_success_20260704.md`

金融与投资：
- `coze_import/20260709_project/热点资讯追踪/`
- `coze_import/20260709_project/codeact/scripts/financial_news_scanner.py`
- `coze_import/20260709_project/codeact/scripts/lu_qiyuan_weibo_tracker.py`
- `coze_import/20260709_project/比亚迪分析/`
- `coze_import/20260709_project/中远海能分析报告.md`

公共营养师与健康：
- `coze_import/20260709_project/公共营养师备考/`
- `coze_import/20260709_project/健康档案/2026年体检分析.md`
- `coze_import/20260709_uploads/用户上传/`

创作：
- `coze_import/20260709_project/归有光小说/`

自动化脚本：
- `coze_import/20260709_project/codeact/index.json`
- `coze_import/20260709_project/codeact/scripts/`

