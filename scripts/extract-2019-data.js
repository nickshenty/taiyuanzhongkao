/**
 * 从太原教育局官网和完整表格提取的2019年数据
 */

const fs = require('fs');
const path = require('path');

// 从官方和网易数据源提取的2019年真实数据（第一志愿）
const data2019 = {
  '太原市外国语学校': 654,
  '太原市第二中学校': 470,
  '太原市成成中学校': 644,
  '太原市实验中学校': 616,
  '太原市第五中学校（青年路校区）': 671,
  '太原市第五中学校（龙城校区）': 662,
  '太原市进山中学校': 592,
  '山西省实验中学': 661,
  '太原市第十一中学校': 470,
  '太原市第十二中学校': 636,
  '太原师范学院附属中学': 656,
  '太原市第十五中学校': 616,
  '太原市第十六中学校': 490,
  '太原市第二实验中学校': 536,
  '太原市第十八中学校': 629,
  '太原市第十九中学校': 516,
  '太原市第二十中学校': 496,
  '太原市第二十一中学校': 516,
  '太原市第三实验中学校': 576,
  '太原市第二十四中学校': 511,
  '太原市第四实验中学校': 576,
  '太原市育英中学校': 606,
  '太原市第二十七中学校': 536,
  '山西大学附属中学': 678,
  '太原市第二十九中学校': 461,
  '太原市第三十中学校': 546,
  '太原市第五实验中学校': 471,
  '太原市综合高级中学校': 470,
  '太原外语科技实验中学': 476,
  '太原市尖草坪区第一中学校': 601,
  '太原市小店区第一中学校': 626,
  '太原市晋源区实验中学校': 541,
  '古交市第一中学校': 573,
  '古交市第二高级中学校': 516,
  '阳曲县第一中学校': 511,
  '清徐县清徐中学校': 621,
  '清徐县徐沟中学校': 639,
  '古交市第三中学校': 470,
  '太原市第四十八中学校': 631,
  '太原市第四十九中学校': 541,
  '太原市第五十二中学校': 466,
  '太原市第五十三中学校': 491,
  '太原市第五十五中学校': 536,
  '太原市第五十六中学校': 466,
  '太原市第五十九中学校': 521,
  '太原市第六十中学校': 486,
  '太原市第六十一中学校': 556
};

// 2026年学校名称到代码的映射
const schools2026 = require('../data/years/2026.js');
const nameToCode = {};
schools2026.schools.forEach(school => {
  nameToCode[school.name] = school.code;
  
  // 添加名称变体映射
  if (school.name.includes('（')) {
    const baseName = school.name.split('（')[0];
    if (!nameToCode[baseName]) {
      nameToCode[baseName] = school.code;
    }
  }
});

console.log('🔄 从官方数据源提取2019年数据...\n');

const year = 2019;
const filePath = path.join(__dirname, `../data/years/${year}.json`);
let yearData = { year, totalScore: 730, schools: [] };

if (fs.existsSync(filePath)) {
  yearData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// 创建现有学校的映射
const existingSchools = {};
yearData.schools.forEach(school => {
  existingSchools[school.code] = school;
});

let addedCount = 0;
let skippedCount = 0;

// 添加新数据
Object.entries(data2019).forEach(([name, score]) => {
  const code = nameToCode[name];
  if (!code) {
    console.log(`⚠️  ${year}年: 未找到学校代码 "${name}"`);
    skippedCount++;
    return;
  }
  
  if (existingSchools[code]) {
    // console.log(`ℹ️  ${year}年: ${name} 已存在 (${existingSchools[code].lastLine}分)`);
  } else {
    yearData.schools.push({
      code,
      name,
      lastLine: score
    });
    addedCount++;
    console.log(`✅ ${year}年: 新增 ${name} - ${score}分`);
  }
});

// 按分数排序
yearData.schools.sort((a, b) => b.lastLine - a.lastLine);

// 保存文件
fs.writeFileSync(filePath, JSON.stringify(yearData, null, 2));

console.log(`\n📊 ${year}年更新完成: 新增${addedCount}所, 跳过${skippedCount}所, 总计${yearData.schools.length}所学校\n`);

console.log('='.repeat(80));
console.log(`✅ 2019年数据提取完成！新增 ${addedCount} 条数据点`);
console.log('='.repeat(80));

// 生成更新后的统计
console.log('\n📈 最终覆盖率统计:\n');
[2017, 2018, 2019].forEach(y => {
  const fp = path.join(__dirname, `../data/years/${y}.json`);
  if (fs.existsSync(fp)) {
    const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    const coverage = (data.schools.length / 94 * 100).toFixed(1);
    const status = data.schools.length >= 60 ? '✅ 达标' : data.schools.length >= 50 ? '🟡 接近' : '⚠️  继续';
    console.log(`  ${y}年: ${data.schools.length}所学校 (${coverage}%) ${status}`);
  }
});
