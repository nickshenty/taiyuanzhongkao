-- 太原中考志愿咨询系统 - 迁移005
-- 新增"招生计划"表
-- 创建时间: 2026-11-26
--
-- 用途：
--   招生计划数（各校当年招多少人）是分数线波动的重要外生变量。
--   计划大幅增减会显著改变录取线，而现有预测模型尚未使用该特征。
--   先把数据落地，待覆盖年份足够（至少连续三年）再纳入模型。
--
-- 数据来源：太原市教育局「普通高中学校招生计划」公告
--   2019 https://jyj.taiyuan.gov.cn/zkzx/20190621/1042522.html
--   2024 https://jyj.taiyuan.gov.cn/zkzx/20240623/30137622.html

CREATE TABLE IF NOT EXISTS enrollment_plans (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
  year INT NOT NULL COMMENT '年份',
  school_code VARCHAR(20) NOT NULL COMMENT '学校代码',
  plan_count INT DEFAULT NULL COMMENT '招生计划数（人）',
  mark VARCHAR(16) DEFAULT NULL COMMENT '编码标记（★省级示范/☆市级示范）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (year) REFERENCES years(year) ON DELETE CASCADE,
  FOREIGN KEY (school_code) REFERENCES schools(code) ON DELETE CASCADE,
  UNIQUE KEY unique_year_school_plan (year, school_code),
  INDEX idx_year (year),
  INDEX idx_school (school_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='普通高中招生计划表';
