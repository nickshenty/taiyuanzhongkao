-- 太原中考志愿咨询系统 - 迁移002
-- 修复 predictions.strategy 枚举与v1.5算法策略值不匹配的问题
-- 创建时间: 2026-11-25
--
-- 背景：001_create_tables.sql 中 strategy 为 ENUM('normal','anomaly')，
-- 但 v1.5 算法实际写入 'normal-relative-position'、'anomaly-trend'、
-- 'anomaly-holdover'、'failed'，会导致插入被截断或报错。

ALTER TABLE predictions
  MODIFY COLUMN strategy VARCHAR(32) DEFAULT 'normal-relative-position'
  COMMENT '预测策略：normal-relative-position/anomaly-trend/anomaly-holdover/failed';

-- 补充索引：推荐查询按年份+策略+分数范围过滤
ALTER TABLE predictions
  ADD INDEX idx_year_strategy_score (year, strategy, predicted_score);

-- 记录算法版本升级说明（2027年预测依据2025+2026数据）
ALTER TABLE years
  MODIFY COLUMN data_status VARCHAR(255) DEFAULT NULL
  COMMENT '数据状态说明';
