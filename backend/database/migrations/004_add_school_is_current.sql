-- 太原中考志愿咨询系统 - 迁移004
-- 标记"当前在用"学校，隔离跨年份代码变更产生的陈旧条目
-- 创建时间: 2026-11-25
--
-- 背景：
--   部分学校在不同年份使用不同招生代码，例如：
--     娄烦县娄烦中学   2024年=68001 → 2026年=65041
--     阳曲县第一中学校 2024年=67001 → 2026年=65042
--   导入后 schools 表同时存在新旧代码条目（124 条），
--   而 2026 年实际只有 90 个招生单元、84 所高中。
--   若前端直接列出 schools 表，会出现同一学校的重复/陈旧条目。
--
-- 方案：
--   is_current = 1 表示该代码在"最近一次导入的年份"仍有招生数据；
--   列表类接口默认只返回 is_current = 1，
--   查询历史时仍可通过 ?includeLegacy=true 拿到全部。

ALTER TABLE schools
  ADD COLUMN is_current TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '是否为当前在用招生代码（最近年份有数据）';

ALTER TABLE schools
  ADD INDEX idx_is_current (is_current);

-- 初始化：以数据库中最新年份有录取数据的学校为"当前在用"
UPDATE schools s
SET s.is_current = 1
WHERE EXISTS (
  SELECT 1 FROM admission_lines a
  WHERE a.school_code = s.code
    AND a.year = (SELECT MAX(year) FROM admission_lines)
);
