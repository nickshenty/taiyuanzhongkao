# 数据库安装与初始化指南

本文档说明如何为太原中考志愿咨询系统设置MySQL数据库。

---

## 📋 前置要求

- MySQL 8.0+ 或 MariaDB 10.5+
- Node.js 18+

---

## 🚀 快速安装

### 1. 安装MySQL（如果尚未安装）

**macOS (使用Homebrew):**
```bash
brew install mysql
brew services start mysql
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
```

**Windows:**
从 [MySQL官网](https://dev.mysql.com/downloads/mysql/) 下载安装包

---

### 2. 创建数据库

登录MySQL：
```bash
mysql -u root -p
```

创建数据库：
```sql
CREATE DATABASE taiyuan_zhongkao CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

创建数据库用户（可选，推荐）：
```sql
CREATE USER 'taiyuan'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON taiyuan_zhongkao.* TO 'taiyuan'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

### 3. 配置环境变量

在 `backend` 目录下创建 `.env` 文件：

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，配置数据库连接：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=taiyuan
DB_PASSWORD=your_secure_password
DB_NAME=taiyuan_zhongkao
```

---

### 4. 创建数据库表结构

使用MySQL命令行执行迁移脚本：

```bash
mysql -u taiyuan -p taiyuan_zhongkao < database/migrations/001_create_tables.sql
```

或者使用MySQL客户端工具导入 `001_create_tables.sql` 文件。

---

### 5. 导入历史数据

确保已安装Node.js依赖：

```bash
cd backend
npm install
```

运行数据导入脚本：

```bash
node database/seeds/import_data.js
```

预期输出：
```
===========================================================
🚀 太原中考数据导入工具
===========================================================

📡 连接数据库...
✅ 数据库连接成功

📂 发现 8 个年份数据: 2017, 2018, 2019, 2020, 2021, 2023, 2024, 2025

📅 导入 2017 年数据...
  ✅ 年份信息已插入
  ✅ 60 所学校信息已插入
  ✅ 60 条分数线记录已插入

...

===========================================================
📊 数据导入统计
===========================================================
年份数据: 8 条
学校数据: 65 所
分数线数据: 480 条
初中学校: 150 所
定向名额: 2500 条

✅ 数据导入完成！
```

---

## 🔍 验证安装

检查数据是否导入成功：

```sql
USE taiyuan_zhongkao;

-- 检查年份数据
SELECT * FROM years ORDER BY year;

-- 检查学校数量
SELECT COUNT(*) as school_count FROM schools;

-- 检查分数线数据
SELECT 
  y.year, 
  s.name, 
  a.last_line, 
  a.quota_line 
FROM admission_lines a
JOIN schools s ON a.school_code = s.code
JOIN years y ON a.year = y.year
WHERE y.year = 2024
ORDER BY a.last_line DESC
LIMIT 10;
```

---

## 🗂️ 数据库表结构说明

### 核心表

| 表名 | 说明 | 主键 |
|------|------|------|
| `years` | 年份基础信息 | `year` |
| `schools` | 学校基础信息 | `code` |
| `admission_lines` | 历年录取分数线 | `id` |
| `predictions` | 分数线预测 | `id` |
| `junior_schools` | 初中学校 | `id` |
| `quota_allocations` | 定向名额分配 | `id` |
| `batches` | 志愿批次配置 | `id` |

### 关系说明

```
years (1) ─┬─→ (N) admission_lines
           ├─→ (N) predictions
           ├─→ (N) quota_allocations
           └─→ (N) batches

schools (1) ─┬─→ (N) admission_lines
             └─→ (N) predictions

junior_schools (1) ─→ (N) quota_allocations
```

---

## 🔧 常见问题

### 1. 连接失败：Access denied

**原因**：用户名或密码错误

**解决**：检查 `.env` 文件中的 `DB_USER` 和 `DB_PASSWORD` 配置

---

### 2. 导入失败：Table doesn't exist

**原因**：未创建表结构

**解决**：先执行步骤4创建表，再执行步骤5导入数据

---

### 3. 数据重复导入

**原因**：多次运行导入脚本

**说明**：脚本使用 `INSERT IGNORE` 和 `ON DUPLICATE KEY UPDATE`，重复导入不会产生重复数据，只会更新现有记录

---

### 4. 数据库字符集问题

**原因**：MySQL默认字符集不是utf8mb4

**解决**：
```sql
ALTER DATABASE taiyuan_zhongkao CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 📊 数据备份

### 备份数据库

```bash
mysqldump -u taiyuan -p taiyuan_zhongkao > backup_$(date +%Y%m%d).sql
```

### 恢复数据库

```bash
mysql -u taiyuan -p taiyuan_zhongkao < backup_20241124.sql
```

---

## 🔄 更新数据

### 添加新年份数据

1. 在 `data/years/` 目录下创建新的年份JSON文件（如 `2026.json`）
2. 重新运行导入脚本：
```bash
node database/seeds/import_data.js
```

### 更新现有数据

修改JSON文件后重新运行导入脚本，会自动更新现有记录。

---

## 🚀 生产环境建议

1. **使用专用数据库用户**：不要使用root用户
2. **设置强密码**：至少16位，包含大小写字母、数字和符号
3. **限制远程访问**：只允许应用服务器IP访问
4. **定期备份**：使用cron定时备份数据库
5. **监控性能**：使用MySQL慢查询日志监控性能

---

## 📞 技术支持

遇到问题请查看：
- [backend/README.md](../README.md) - 后端项目文档
- MySQL错误日志：`/var/log/mysql/error.log`

---

更新时间：2024-11-24
