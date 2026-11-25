-- 太原中考志愿咨询系统 - 迁移003
-- 支持"分志愿录取线"与"特色办学实验班线"
-- 创建时间: 2026-11-25
--
-- 背景：
--   太原中考实行"段段清"分段录取，同一所学校的第一~第五志愿录取线往往不同
--   （例：2026年山大附中第一志愿802.0、第二志愿804.1）。
--   2026年 OCR 分数线表提供了完整分档线，此前表结构只能存一个统招线。
--
--   last_line          仍表示统招录取线（通常取第一志愿）
--   choice_lines       完整分档线 {first,second,third,fourth,fifth}
--   special_line       特色办学实验班录取线（统招各志愿为空时使用）
--   line_choice        标明 last_line 取自哪个志愿，便于追溯

ALTER TABLE admission_lines
  ADD COLUMN choice_lines JSON DEFAULT NULL
    COMMENT '分志愿录取线 {"first":..,"second":..,...}',
  ADD COLUMN special_line DECIMAL(5,1) DEFAULT NULL
    COMMENT '特色办学实验班录取线',
  ADD COLUMN line_choice VARCHAR(16) DEFAULT NULL
    COMMENT 'last_line 来源志愿：first/second/.../special';
