-- 太原中考志愿咨询系统 - 数据库表结构
-- 创建时间: 2024-11-24

-- 1. 年份表
CREATE TABLE IF NOT EXISTS years (
  year INT PRIMARY KEY COMMENT '年份',
  control_line INT NOT NULL COMMENT '普通高中最低录取控制线',
  total_score INT NOT NULL COMMENT '中考总分',
  data_status VARCHAR(255) DEFAULT NULL COMMENT '数据状态说明',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='年份基础信息表';

-- 2. 学校表
CREATE TABLE IF NOT EXISTS schools (
  code VARCHAR(20) PRIMARY KEY COMMENT '学校代码',
  name VARCHAR(100) NOT NULL COMMENT '学校名称',
  type VARCHAR(50) DEFAULT NULL COMMENT '学校类型（公办/民办/其他）',
  district VARCHAR(50) DEFAULT NULL COMMENT '所属区县',
  address VARCHAR(255) DEFAULT NULL COMMENT '学校地址',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_name (name),
  INDEX idx_type (type),
  INDEX idx_district (district)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学校基础信息表';

-- 3. 录取分数线表
CREATE TABLE IF NOT EXISTS admission_lines (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
  year INT NOT NULL COMMENT '年份',
  school_code VARCHAR(20) NOT NULL COMMENT '学校代码',
  last_line DECIMAL(5,1) DEFAULT NULL COMMENT '统招录取分数线',
  quota_line DECIMAL(5,1) DEFAULT NULL COMMENT '定向生录取分数线',
  batch VARCHAR(20) DEFAULT NULL COMMENT '录取批次',
  plan_count INT DEFAULT NULL COMMENT '招生计划数',
  actual_count INT DEFAULT NULL COMMENT '实际录取人数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (year) REFERENCES years(year) ON DELETE CASCADE,
  FOREIGN KEY (school_code) REFERENCES schools(code) ON DELETE CASCADE,
  UNIQUE KEY unique_year_school (year, school_code),
  INDEX idx_year (year),
  INDEX idx_school (school_code),
  INDEX idx_batch (batch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='历年录取分数线表';

-- 4. 分数线预测表
CREATE TABLE IF NOT EXISTS predictions (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
  year INT NOT NULL COMMENT '预测年份',
  school_code VARCHAR(20) NOT NULL COMMENT '学校代码',
  predicted_score INT DEFAULT NULL COMMENT '预测分数',
  actual_score INT DEFAULT NULL COMMENT '实际分数（用于回测）',
  error INT DEFAULT NULL COMMENT '预测误差（实际-预测）',
  strategy ENUM('normal', 'anomaly') DEFAULT 'normal' COMMENT '预测策略',
  confidence ENUM('high', 'medium', 'low') DEFAULT 'medium' COMMENT '置信度',
  algorithm_version VARCHAR(20) DEFAULT 'v1.5' COMMENT '算法版本',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (school_code) REFERENCES schools(code) ON DELETE CASCADE,
  UNIQUE KEY unique_year_school_pred (year, school_code),
  INDEX idx_year (year),
  INDEX idx_school (school_code),
  INDEX idx_confidence (confidence),
  INDEX idx_strategy (strategy)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分数线预测表';

-- 5. 初中学校表
CREATE TABLE IF NOT EXISTS junior_schools (
  id VARCHAR(20) PRIMARY KEY COMMENT '学校ID',
  name VARCHAR(100) NOT NULL COMMENT '学校名称',
  district VARCHAR(50) DEFAULT NULL COMMENT '所属区县',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_name (name),
  INDEX idx_district (district)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='初中学校表';

-- 6. 定向名额分配表
CREATE TABLE IF NOT EXISTS quota_allocations (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
  year INT NOT NULL COMMENT '年份',
  junior_school_id VARCHAR(20) NOT NULL COMMENT '初中学校ID',
  senior_school_code VARCHAR(20) NOT NULL COMMENT '高中学校代码',
  quota_count INT NOT NULL DEFAULT 0 COMMENT '分配名额数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (year) REFERENCES years(year) ON DELETE CASCADE,
  FOREIGN KEY (junior_school_id) REFERENCES junior_schools(id) ON DELETE CASCADE,
  FOREIGN KEY (senior_school_code) REFERENCES schools(code) ON DELETE CASCADE,
  UNIQUE KEY unique_year_junior_senior (year, junior_school_id, senior_school_code),
  INDEX idx_year (year),
  INDEX idx_junior (junior_school_id),
  INDEX idx_senior (senior_school_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定向名额分配表';

-- 7. 志愿批次表
CREATE TABLE IF NOT EXISTS batches (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
  year INT NOT NULL COMMENT '年份',
  batch_code VARCHAR(20) NOT NULL COMMENT '批次代码',
  batch_name VARCHAR(100) NOT NULL COMMENT '批次名称',
  sort_order INT DEFAULT 0 COMMENT '排序顺序',
  max_schools INT DEFAULT 0 COMMENT '最多可填报学校数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (year) REFERENCES years(year) ON DELETE CASCADE,
  UNIQUE KEY unique_year_batch (year, batch_code),
  INDEX idx_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='志愿批次配置表';

-- 插入测试数据（可选）
-- INSERT INTO years (year, control_line, total_score, data_status) VALUES
-- (2024, 523, 730, '数据完整'),
-- (2023, 505, 730, '数据完整');
