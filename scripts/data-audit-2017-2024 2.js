/**
 * 2017-2024年历史数据采集与审核脚本
 * 
 * 目标：
 * 1. 以2026年学校列表为基准（94所普通高中）
 * 2. 采集2017-2024年每所学校的录取分数线
 * 3. 识别新成立学校（某些年份无数据）
 * 4. 标记数据完整性
 */

const fs = require('fs');
const path = require('path');

// 加载2026年学校列表作为主列表
const data2026 = require('../data/years/2026.js');

// 提取普通高中学校（排除特色班和综合高中试点）
const masterSchoolList = data2026.schools
  .filter(s => s.batch === 'unified' || s.batch === 'private')
  .map(s => ({
    code: s.code,
    name: s.name,
    type: s.tags[0],
    district: s.district,
    line2026: s.lastLine
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

console.log('='.repeat(100));
console.log('太原中考历史数据采集与审核系统 (2017-2024)');
console.log('='.repeat(100));
console.log(`\n📊 基准学校列表: ${masterSchoolList.length}所学校 (基于2026年)`);
console.log('\n' + '-'.repeat(100));

// 手工采集的历史数据（从网络搜索结果整理）
const historicalData = {
  2017: {
    totalScore: 730,
    minControlLine: 440,
    sources: [
      'http://91zhongkao.com/zhongkao/fenshuxian/201710/zhongkao_580679.html',
      'https://m.sohu.com/a/155643218_707634/'
    ],
    schools: [
      { code: '65028', name: '山西大学附属中学校', lastLine: 674 },
      { code: '65005', name: '太原市第五中学校（青年路校区）', lastLine: 667 },
      { code: '66005', name: '太原市第五中学校（龙城校区）', lastLine: 667 }, // 合并报考
      { code: '65010', name: '山西省实验中学（晋阳街校区）', lastLine: 664 },
      { code: '65001', name: '太原市外国语学校（漪汾校区）', lastLine: 655 },
      { code: '65014', name: '太原师范学院附属中学', lastLine: 653 },
      { code: '65003', name: '太原市成成中学校（迎泽校区）', lastLine: 641 },
      { code: '66003', name: '太原市成成中学校（晋源校区）', lastLine: 641 }, // 合并报考
      { code: '65012', name: '太原市第十二中学校（旱西关校区）', lastLine: 633 },
      { code: '65018', name: '太原市第十八中学校（坝陵校区）', lastLine: 633 },
      { code: '65004', name: '太原市实验中学校', lastLine: 614 },
      { code: '65026', name: '太原市育英中学校', lastLine: 596 },
      { code: '65006', name: '太原市进山中学校', lastLine: 589 },
      { code: '65023', name: '太原市第三实验中学校', lastLine: 576 },
      { code: '65025', name: '太原市第四实验中学校', lastLine: 552 },
      { code: '65030', name: '太原市第三十中学校', lastLine: 551 },
      { code: '65027', name: '太原市第二十七中学校', lastLine: 535 },
      { code: '65017', name: '太原市第二实验中学校', lastLine: 521 },
      { code: '65019', name: '太原市第十九中学校', lastLine: 511 },
      { code: '65021', name: '太原市第二十一中学校', lastLine: 505 },
      { code: '65024', name: '太原市第二十四中学校', lastLine: 504 },
      { code: '65020', name: '太原市第二十中学校', lastLine: 486 },
      { code: '65016', name: '太原市第十六中学校', lastLine: 481 },
      { code: '65029', name: '太原市第二十九中学校', lastLine: 461 },
      { code: '65031', name: '太原市第五实验中学校', lastLine: 466 },
      { code: '65013', name: '太原市第五职业中学校（太原市第十三中学校）', lastLine: 446 },
      { code: '65011', name: '太原市第十一中学校', lastLine: 440 },
      { code: '65002', name: '太原市第二中学校', lastLine: 440 },
      { code: '65034', name: '太原市尖草坪区第一中学校', lastLine: 588 },
      { code: '65036', name: '太原市小店区第一中学校', lastLine: 621 },
      { code: '65039', name: '古交市第一中学校', lastLine: 596 },
      { code: '65040', name: '古交市第二高级中学校', lastLine: 487 },
      { code: '65041', name: '娄烦县娄烦中学', lastLine: 576 },
      { code: '65042', name: '阳曲县第一中学校', lastLine: 535 },
      { code: '65043', name: '清徐县清徐中学校', lastLine: 608 },
      { code: '65044', name: '清徐县徐沟中学校', lastLine: 676 },
      { code: '65048', name: '太原市第四十八中学校', lastLine: 576 }
    ]
  },
  
  2018: {
    totalScore: 730,
    minControlLine: 446,
    sources: [
      'https://news.sina.com.cn/o/2018-07-07/doc-ihexfcvk9304457.shtml',
      'https://baijiahao.baidu.com/s?id=1605240621297066525'
    ],
    schools: [
      { code: '65028', name: '山西大学附属中学校', lastLine: 670 },
      { code: '65005', name: '太原市第五中学校（青年路校区）', lastLine: 663 },
      { code: '66005', name: '太原市第五中学校（龙城校区）', lastLine: 663 },
      { code: '65010', name: '山西省实验中学（晋阳街校区）', lastLine: 651 },
      { code: '65014', name: '太原师范学院附属中学', lastLine: 647 },
      { code: '65001', name: '太原市外国语学校（漪汾校区）', lastLine: 645 },
      { code: '65003', name: '太原市成成中学校（迎泽校区）', lastLine: 631 },
      { code: '66003', name: '太原市成成中学校（晋源校区）', lastLine: 631 },
      { code: '65012', name: '太原市第十二中学校（旱西关校区）', lastLine: 621 },
      { code: '65018', name: '太原市第十八中学校（坝陵校区）', lastLine: 616 },
      { code: '65026', name: '太原市育英中学校', lastLine: 593 },
      { code: '65006', name: '太原市进山中学校', lastLine: 581 },
      // 民办学校
      { code: '65092', name: '山西现代双语学校南校', lastLine: 633 },
      { code: '65098', name: '太原新希望双语学校', lastLine: 636 },
      { code: '65089', name: '太原杏岭实验学校', lastLine: 616 }
    ]
  },
  
  2019: {
    totalScore: 730,
    minControlLine: 470,
    sources: [
      'http://www.sxfxj.com/szyw/show.php?itemid=323',
      'https://m.thepaper.cn/newsDetail_forward_3865859',
      'https://news.koolearn.com/20190710/1182325.html'
    ],
    schools: [
      { code: '65028', name: '山西大学附属中学校', lastLine: 678 },
      { code: '65005', name: '太原市第五中学校（青年路校区）', lastLine: 671 },
      { code: '66005', name: '太原市第五中学校（龙城校区）', lastLine: 662 },
      { code: '65010', name: '山西省实验中学（晋阳街校区）', lastLine: 661 },
      { code: '65014', name: '太原师范学院附属中学', lastLine: 656 },
      { code: '65001', name: '太原市外国语学校（漪汾校区）', lastLine: 654 },
      { code: '65003', name: '太原市成成中学校（迎泽校区）', lastLine: 644 },
      { code: '66003', name: '太原市成成中学校（晋源校区）', lastLine: 644 },
      // 民办学校
      { code: '65070', name: '太原市常青藤中学校', lastLine: 654 }, // 原知达常青藤
      { code: '65092', name: '山西现代双语学校南校', lastLine: 644 },
      { code: '65098', name: '太原新希望双语学校', lastLine: 649 },
      { code: '65072', name: '太原市五育中学校', lastLine: 641 },
      { code: '65084', name: '太原北辰双语学校', lastLine: 641 }
    ]
  },
  
  // 2020-2022年数据待补充（需要进一步网络搜索）
  2020: {
    totalScore: 730,
    minControlLine: null,
    sources: [],
    schools: []
  },
  
  2021: {
    totalScore: 730,
    minControlLine: null,
    sources: [],
    schools: []
  },
  
  2022: {
    totalScore: 730,
    minControlLine: null,
    sources: [],
    schools: []
  },
  
  2023: {
    totalScore: 730,
    minControlLine: 525,
    sources: [
      'https://www.centv.cn/p/470425.html',
      'https://finance.sina.com.cn/jjxw/2023-07-09/doc-imzaazyi5866780.shtml'
    ],
    schools: require('./years/2023.json').schools.map(s => ({
      code: s.code,
      name: s.name,
      lastLine: s.lastLine
    }))
  },
  
  2024: {
    totalScore: 730,
    minControlLine: 523,
    sources: [
      'https://www.163.com/dy/article/J6QC5DUT0552FDTY.html',
      'https://mp.weixin.qq.com/s?__biz=MzUzNzk5NDU0Ng=='
    ],
    schools: require('./years/2024.json').schools.map(s => ({
      code: s.code,
      name: s.name,
      lastLine: s.lastLine
    }))
  }
};

// 审核数据完整性
console.log('\n📋 数据完整性审核:\n');

const years = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const auditReport = {};

years.forEach(year => {
  const yearData = historicalData[year];
  const schoolCount = yearData.schools.length;
  const coverage = (schoolCount / masterSchoolList.length * 100).toFixed(1);
  
  auditReport[year] = {
    totalScore: yearData.totalScore,
    schoolCount,
    coverage: `${coverage}%`,
    status: schoolCount > 0 ? (schoolCount >= 40 ? '✅ 良好' : '⚠️ 部分') : '❌ 缺失'
  };
  
  console.log(`${year}年: ${schoolCount.toString().padStart(2)}所学校 (${coverage.padStart(5)}%) ${auditReport[year].status}`);
});

// 生成学校维度的数据矩阵
console.log('\n' + '='.repeat(100));
console.log('学校维度数据完整性矩阵');
console.log('='.repeat(100));

const schoolMatrix = {};

masterSchoolList.forEach(school => {
  schoolMatrix[school.code] = {
    name: school.name,
    type: school.type,
    dataPoints: {}
  };
  
  years.forEach(year => {
    const yearData = historicalData[year];
    const found = yearData.schools.find(s => s.code === school.code);
    
    if (found) {
      schoolMatrix[school.code].dataPoints[year] = found.lastLine;
    } else {
      schoolMatrix[school.code].dataPoints[year] = null;
    }
  });
  
  // 计算数据完整度
  const validYears = years.filter(y => schoolMatrix[school.code].dataPoints[y] !== null);
  schoolMatrix[school.code].completeness = validYears.length;
  schoolMatrix[school.code].completenessPct = (validYears.length / years.length * 100).toFixed(0);
});

// 按数据完整度排序
const sortedSchools = Object.entries(schoolMatrix)
  .sort((a, b) => b[1].completeness - a[1].completeness);

console.log('\n完整度排名 (Top 30):');
console.log('排名  代码   学校名称                               2017  2018  2019  2020  2021  2022  2023  2024  完整度');
console.log('-'.repeat(100));

sortedSchools.slice(0, 30).forEach(([code, data], index) => {
  const rank = (index + 1).toString().padStart(3);
  const nameDisplay = data.name.substring(0, 32).padEnd(35);
  const lines = years.map(y => {
    const val = data.dataPoints[y];
    return val ? val.toString().padStart(5) : '  -  ';
  }).join(' ');
  const completeness = `${data.completeness}/8 (${data.completenessPct}%)`;
  
  console.log(`${rank}  ${code}  ${nameDisplay} ${lines}  ${completeness}`);
});

// 识别新成立学校
console.log('\n' + '='.repeat(100));
console.log('新成立学校识别 (数据点<3个)');
console.log('='.repeat(100));

const newSchools = sortedSchools.filter(([code, data]) => data.completeness < 3);

console.log(`\n共识别 ${newSchools.length} 所可能的新成立学校:\n`);

newSchools.forEach(([code, data]) => {
  const firstYear = years.find(y => data.dataPoints[y] !== null);
  console.log(`${code}  ${data.name.padEnd(40)}  首次出现: ${firstYear || '未知'}`);
});

// 数据缺失警告
console.log('\n' + '='.repeat(100));
console.log('⚠️ 数据缺失警告');
console.log('='.repeat(100));

const missingYears = years.filter(y => historicalData[y].schools.length === 0);
if (missingYears.length > 0) {
  console.log(`\n以下年份数据完全缺失，需要紧急补充:`);
  missingYears.forEach(year => {
    console.log(`  - ${year}年`);
  });
  console.log(`\n建议操作:`);
  console.log(`  1. 搜索 "太原 ${missingYears[0]}年 中考录取分数线"`);
  console.log(`  2. 查找官方教育网站、新闻媒体报道`);
  console.log(`  3. 更新 historicalData 对象`);
}

// 生成待办清单
console.log('\n' + '='.repeat(100));
console.log('📝 数据补充待办清单');
console.log('='.repeat(100));

const todoList = [];

// 1. 补充缺失年份
missingYears.forEach(year => {
  todoList.push({
    priority: 'HIGH',
    task: `补充${year}年完整数据`,
    target: '至少40所主要学校',
    method: '网络搜索 + 官方资料'
  });
});

// 2. 补充2017-2019年部分学校
[2017, 2018, 2019].forEach(year => {
  const currentCount = historicalData[year].schools.length;
  if (currentCount < 60) {
    todoList.push({
      priority: 'MEDIUM',
      task: `补充${year}年剩余学校数据`,
      target: `从${currentCount}所扩充到60+所`,
      method: '查找历年招生简章、教育局文件'
    });
  }
});

// 3. 验证2023-2024年数据
todoList.push({
  priority: 'LOW',
  task: '验证2023-2024年数据准确性',
  target: '与官方公布对比',
  method: '交叉验证多个来源'
});

console.log('');
todoList.forEach((item, index) => {
  console.log(`${index + 1}. [${item.priority}] ${item.task}`);
  console.log(`   目标: ${item.target}`);
  console.log(`   方法: ${item.method}\n`);
});

// 保存审核报告
const report = {
  auditDate: new Date().toISOString(),
  masterListCount: masterSchoolList.length,
  yearRange: '2017-2024',
  yearlyStatus: auditReport,
  schoolMatrix: schoolMatrix,
  newSchools: newSchools.map(([code, data]) => ({
    code,
    name: data.name,
    firstAppearance: years.find(y => data.dataPoints[y] !== null)
  })),
  todoList,
  recommendations: [
    '优先补充2020-2022年数据（旧考试体系最后3年）',
    '对于新成立学校，在模型中标记为null而非0',
    '在预测时，数据点<3个的学校降低置信度',
    '建立数据源可信度评级体系'
  ]
};

const reportPath = path.join(__dirname, '../data/analysis/data-audit-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('='.repeat(100));
console.log(`\n✅ 审核报告已保存到: ${reportPath}\n`);
console.log('='.repeat(100));
