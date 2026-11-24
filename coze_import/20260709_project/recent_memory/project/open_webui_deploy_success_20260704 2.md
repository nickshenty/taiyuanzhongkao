Open WebUI 部署完成记录（2026-07-04）
- 部署背景：墨子AI学习计划Day3遗留任务，此前因ghcr.io直接拉取失败，通过DaoCloud、Docker Hub镜像尝试均失败，最终使用南京大学ghcr镜像ghcr.nju.edu.cn成功拉取镜像
- 容器配置：端口映射0.0.0.0:3000→8080，开启host-gateway对接本地Ollama服务（localhost:11434），数据持久化存储到open-webui卷，容器自动重启策略设为always
- 访问方式：http://localhost:3000，首次打开需注册本地管理员账号，自动发现本地已部署的7个Ollama模型
- 使用注意：Docker用户选择不后台常驻，下次使用时先手动启动Docker Desktop，容器会自动恢复运行
