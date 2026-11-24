/**
 * 2017-2019年数据扩充脚本
 * 从网络搜索结果中提取并更新到历史数据文件
 */

const fs = require('fs');
const path = require('path');

// 从搜索结果提取的新数据
const collectedData = {
  2017: {
    '太原新希望双语学校': 633,
    '山西现代双语学校南校': 627,
    '太原维刚实验学校': 581,
    '太原市第十二中学校（旱西关校区）': 633,
    '太原市第十八中学校（坝陵校区）': 633,
    '太原市育英中学校': 596,
    '太原市实验中学校': 614,
    '太原市第二中学校': 440,
    '清徐县徐沟中学校': 621,
    '太原市知达常青藤中学校': 626,
    '太原市五育中学校': 621,
    '太原杏岭实验学校': 605,
    '太原市第四十八中学校': 623,
    '清徐县清徐中学校': 608,
    '太原市小店区第一中学校': 614,
    '太原市尖草坪区第一中学校': 588,
    '太原市第二十中学校': 486,
    '太原市第三实验中学校': 576,
    '太原市第二十四中学校': 504,
    '太原市第二实验中学校': 521,
    '太原市第十九中学校': 511,
    '太原市第二十一中学校': 505,
    '太原市第二十七中学校': 535,
    '太原市第二十九中学校': 461,
    '太原市第三十中学校': 551,
    '太原市第五实验中学校': 466,
    '太原市第五十五中学校': 537,
    '古交市第二高级中学校': 487
  },
  2018: {
    '太原市第十二中学校（旱西关校区）': 621,
    '太原市第十八中学校（坝陵校区）': 616,
    '太原市育英中学校': 593,
    '清徐县徐沟中学校': 621,
    '太原市五育中学校': 626,
    '太原市知达常青藤中学校': 636,
    '太原新希望双语学校': 636,
    '山西现代双语学校南校': 633,
    '太原杏岭实验学校': 616,
    '太原市实验中学校': 606,
    '太原市第二中学校': 446,
    '太原市第四十八中学校': 581,
    '太原市小店区第一中学校': 525,
    '太原市尖草坪区第一中学校': 571,
    '太原市晋源区实验中学校': 525
  },
  2019: {
    '太原市第十二中学校（旱西关校区）': 636,
    '太原市第十八中学校（坝陵校区）': 629,
    '太原市育英中学校': 606,
    '太原市进山中学校': 592,
    '太原市知达常青藤中学校': 654,
    '太原新希望双语学校': 649,
    '山西现代双语学校南校': 644,
    '太原市五育中学校': 641,
    '太原北辰双语学校': 641
  }
};

// 2026年学校名称到代码的映射
const schools2026 = require('../data/years/2026.js');
const nameToCode = {};
schools2026.schools.forEach(school => {
  nameToCode[school.name] = school.code;
});

console.log('🔄 开始数据扩充...\n');

let totalAdded = 0;

// 更新每一年的数据
[2017, 2018, 2019].forEach(year => {
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
  
  // 添加新数据
  Object.entries(collectedData[year] || {}).forEach(([name, score]) => {
    const code = nameToCode[name];
    if (!code) {
      console.log(`⚠️ ${year}年: 未找到学校代码 "${name}"`);
      return;
    }
    
    if (existingSchools[code]) {
      console.log(`ℹ️ ${year}年: ${name} 已存在 (${existingSchools[code].lastLine}分)`);
    } else {
      yearData.schools.push({
        code,
        name,
        lastLine: score
      });
      addedCount++;
      totalAdded++;
      console.log(`✅ ${year}年: 新增 ${name} - ${score}分`);
    }
  });
  
  // 按分数排序
  yearData.schools.sort((a, b) => b.lastLine - a.lastLine);
  
  // 保存文件
  fs.writeFileSync(filePath, JSON.stringify(yearData, null, 2));
  console.log(`\n📊 ${year}年更新完成: 新增${addedCount}所, 总计${yearData.schools.length}所学校\n`);
});

console.log('='.repeat(80));
console.log(`✅ 数据扩充完成！共新增 ${totalAdded} 条数据点`);
console.log('='.repeat(80));

// 生成更新后的统计
console.log('\n📈 更新后覆盖率:\n');
[2017, 2018, 2019].forEach(year => {
  const filePath = path.join(__dirname, `../data/years/${year}.json`);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const coverage = (data.schools.length / 94 * 100).toFixed(1);
    const status = data.schools.length >= 60 ? '✅ 达标' : '⚠️ 继续';
    console.log(`  ${year}年: ${data.schools.length}所学校 (${coverage}%) ${status}`);
  }
});
