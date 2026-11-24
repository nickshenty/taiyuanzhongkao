/**
 * 从新东方网页表格提取的2017-2018年完整数据
 */

const fs = require('fs');
const path = require('path');

// 从新东方表格提取的真实数据（第一志愿）
const xdfData = {
  2017: {
    '太原市外国语学校': 655,
    '太原市第二中学校': 440,
    '太原市成成中学校': 641,
    '太原市实验中学校': 614,
    '太原市第五中学校': 667,
    '太原市进山中学校': 589,
    '山西省实验中学': 664,
    '太原市第十一中学校': 440,
    '太原市第十二中学校': 633,
    '太原市第十三中学校': 446,
    '太原师范学院附属中学': 653,
    '太原市第十五中学校': 605,
    '太原市第十六中学校': 481,
    '太原市第二实验中学校': 521,
    '太原市第十八中学校': 633,
    '太原市第十九中学校': 511,
    '太原市第二十中学校': 486,
    '太原市第二十一中学校': 505,
    '太原市第三实验中学校': 576,
    '太原市第二十四中学校': 504,
    '太原市第四实验中学校': 552,
    '太原市育英中学校': 596,
    '太原市第二十七中学校': 535,
    '山西大学附属中学': 674,
    '太原市第二十九中学校': 461,
    '太原市第三十中学校': 551,
    '太原市第五实验中学校': 466,
    '太原市综合高级中学校': 440,
    '太原外语科技实验中学': 496,
    '太原市尖草坪区第一中学校': 588,
    '太原市小店区第一中学校': 621,
    '太原市晋源区实验中学校': 536,
    '古交市第一中学校': 571,
    '古交市第二高级中学校': 487,
    '娄烦县娄烦中学校': 440,
    '阳曲县第一中学校': 446,
    '清徐县清徐中学校': 608,
    '清徐县徐沟中学校': 621,
    '古交市第三中学校': 454,
    '太原市第四十八中学校': 623,
    '太原市第四十九中学校': 536,
    '太原市第五十二中学校': 466,
    '太原市第五十三中学校': 505,
    '太原市第五十五中学校': 537,
    '太原市第五十六中学校': 466,
    '太原市第五十九中学校': 528,
    '太原市第六十中学校': 486,
    '太原市第六十一中学校': 543
  },
  2018: {
    '太原市外国语学校': 645,
    '太原市第二中学校': 446,
    '太原市成成中学校': 631,
    '太原市实验中学校': 606,
    '太原市第五中学校': 663,
    '太原市进山中学校': 581,
    '山西省实验中学': 651,
    '太原市第十一中学校': 446,
    '太原市第十二中学校': 621,
    '太原市第十三中学校': 451,
    '太原师范学院附属中学': 647,
    '太原市第十五中学校': 586,
    '太原市第十六中学校': 466,
    '太原市第二实验中学校': 500,
    '太原市第十八中学校': 616,
    '太原市第十九中学校': 496,
    '太原市第二十中学校': 466,
    '太原市第二十一中学校': 496,
    '太原市第三实验中学校': 556,
    '太原市第二十四中学校': 471,
    '太原市第四实验中学校': 531,
    '太原市育英中学校': 593,
    '太原市第二十七中学校': 523,
    '山西大学附属中学': 670,
    '太原市第二十九中学校': 453,
    '太原市第三十中学校': 536,
    '太原市第五实验中学校': 456,
    '太原市综合高级中学校': 446,
    '太原外语科技实验中学': 476,
    '太原市尖草坪区第一中学校': 571,
    '太原市小店区第一中学校': 616,
    '太原市晋源区实验中学校': 525,
    '古交市第一中学校': 553,
    '古交市第二高级中学校': 506,
    '娄烦县娄烦中学校': 446,
    '阳曲县第一中学校': 503,
    '清徐县清徐中学校': 607,
    '清徐县徐沟中学校': 634,
    '古交市第三中学校': 457,
    '太原市第四十八中学校': 616,
    '太原市第四十九中学校': 528,
    '太原市第五十二中学校': 453,
    '太原市第五十三中学校': 486,
    '太原市第五十五中学校': 528,
    '太原市第五十六中学校': 453,
    '太原市第五十九中学校': 511,
    '太原市第六十中学校': 466,
    '太原市第六十一中学校': 554
  }
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

console.log('🔄 从新东方数据源提取2017-2018年数据...\n');

let totalAdded = 0;

// 更新每一年的数据
[2017, 2018].forEach(year => {
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
  Object.entries(xdfData[year] || {}).forEach(([name, score]) => {
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
      totalAdded++;
      console.log(`✅ ${year}年: 新增 ${name} - ${score}分`);
    }
  });
  
  // 按分数排序
  yearData.schools.sort((a, b) => b.lastLine - a.lastLine);
  
  // 保存文件
  fs.writeFileSync(filePath, JSON.stringify(yearData, null, 2));
  console.log(`\n📊 ${year}年更新完成: 新增${addedCount}所, 跳过${skippedCount}所, 总计${yearData.schools.length}所学校\n`);
});

console.log('='.repeat(80));
console.log(`✅ 新东方数据提取完成！共新增 ${totalAdded} 条数据点`);
console.log('='.repeat(80));

// 生成更新后的统计
console.log('\n📈 更新后覆盖率:\n');
[2017, 2018, 2019].forEach(year => {
  const filePath = path.join(__dirname, `../data/years/${year}.json`);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const coverage = (data.schools.length / 94 * 100).toFixed(1);
    const status = data.schools.length >= 60 ? '✅ 达标' : data.schools.length >= 50 ? '🟡 接近' : '⚠️  继续';
    console.log(`  ${year}年: ${data.schools.length}所学校 (${coverage}%) ${status}`);
  }
});
