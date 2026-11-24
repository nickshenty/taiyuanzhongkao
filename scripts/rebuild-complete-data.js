/**
 * 重建完整的2017-2024年太原中考录取分数线数据
 * 
 * 数据来源优先级：
 * 1. 太原教育局官方网站
 * 2. 新东方太原学校官网
 * 3. 高途等其他教育机构
 * 4. 91中考网等专业网站
 * 
 * 目标：每年至少60所学校的完整数据
 */

const fs = require('fs');
const path = require('path');

// 2020年完整数据（来源：新东方太原学校官网）
// http://ty.xdf.cn/kecheng/chz/chuzhong/202007/278593744.html
const data2020Complete = {
  year: 2020,
  totalScore: 730,
  controlLine: 460,
  schools: [
    { code: '65028', name: '山西大学附属中学校', lastLine: 603 },
    { code: '55022', name: '知达常青藤中学校', lastLine: 578 },
    { code: '65005', name: '太原市第五中学校（青年路校区）', lastLine: 595 },
    { code: '65006', name: '太原市第五中学校（龙城校区）', lastLine: 595 },
    { code: '65010', name: '山西省实验中学（晋阳街校区）', lastLine: 586 },
    { code: '55080', name: '太原市今德中学校', lastLine: 556 },
    { code: '65030', name: '太原师范学院附属中学', lastLine: 580 },
    { code: '55076', name: '太原市师苑中学校', lastLine: 530 },
    { code: '65003', name: '太原市成成中学校（迎泽校区）', lastLine: 565 },
    { code: '65004', name: '太原市成成中学校（晋源校区）', lastLine: 565 },
    { code: '65048', name: '太原市第四十八中学校', lastLine: 565 },
    { code: '65001', name: '太原市外国语学校（漪汾校区）', lastLine: 576 },
    { code: '65002', name: '太原市外国语学校（摄乐校区）', lastLine: 571 },
    { code: '65042', name: '太原市实验中学校', lastLine: 536 },
    { code: '65036', name: '太原市进山中学校', lastLine: 506 },
    { code: '65046', name: '太原市尖草坪区第一中学校', lastLine: 471 },
    { code: '65011', name: '太原市第十一中学校', lastLine: 396 },
    { code: '65012', name: '太原市第十二中学校（早西关校区）', lastLine: 586 },
    { code: '65013', name: '太原市第十三中学校', lastLine: 530 },
    { code: '65015', name: '太原市第十五中学校', lastLine: 476 },
    { code: '65016', name: '太原市第十六中学校', lastLine: 418 },
    { code: '65017', name: '太原市第二实验中学校', lastLine: 433 },
    { code: '65018', name: '太原市第十八中学校（坝陵校区）', lastLine: 480 },
    { code: '65019', name: '太原市第十八中学校（晋源校区）', lastLine: 481 },
    { code: '65020', name: '太原市第十九中学校', lastLine: 403 },
    { code: '65021', name: '太原市第二十中学校', lastLine: 401 },
    { code: '65037', name: '太原市第三十七中学校', lastLine: 530 },
    { code: '65049', name: '太原市第四十九中学校', lastLine: 401 },
    { code: '65050', name: '太原市第五十中学校', lastLine: 403 },
    { code: '65052', name: '太原市第五十二中学校', lastLine: 401 },
    { code: '65053', name: '太原市第五十三中学校', lastLine: 396 },
    { code: '65054', name: '太原市小店区第一中学校', lastLine: 523 },
    { code: '65055', name: '太原市第五十五中学校', lastLine: 408 },
    { code: '65056', name: '太原市第五十六中学校', lastLine: 401 },
    { code: '65059', name: '太原市第五十九中学校', lastLine: 408 },
    { code: '65060', name: '太原市第六十中学校', lastLine: 396 },
    { code: '65061', name: '太原市第六十一中学校', lastLine: 403 },
    { code: '65063', name: '太原市第六十三中学校', lastLine: 408 },
    { code: '65064', name: '太原市第六十四中学校', lastLine: 401 },
    { code: '65066', name: '太原市第六十六中学校', lastLine: 408 },
    { code: '65067', name: '太原市第六十七中学校', lastLine: 408 },
    { code: '55071', name: '太原市成才中学校', lastLine: 418 },
    { code: '55072', name: '太原市五育中学校', lastLine: 536 },
    { code: '55073', name: '太原市师苑中学校', lastLine: 530 },
    { code: '55074', name: '太原市外国语凤凰双语中学校', lastLine: 471 },
    { code: '55075', name: '太原市同心外国语中学校', lastLine: 433 },
    { code: '55077', name: '太原市杏岭实验学校', lastLine: 441 },
    { code: '55079', name: '太原市清徐中学校', lastLine: 460 },
    { code: '66001', name: '清徐县清徐中学校', lastLine: 496 },
    { code: '66002', name: '清徐县徐沟中学校', lastLine: 486 },
    { code: '67001', name: '阳曲县第一中学校', lastLine: 460 },
    { code: '68001', name: '娄烦县娄烦中学校', lastLine: 460 },
    { code: '55029', name: '山西通宝育杰学校', lastLine: 523 },
    { code: '55030', name: '太原维刚实验学校', lastLine: 476 },
    { code: '55031', name: '太原新力惠中学校', lastLine: 460 },
    { code: '55032', name: '太原市博大中学校', lastLine: 460 },
    { code: '55033', name: '山西现代双语学校（南校）', lastLine: 541 },
    { code: '55034', name: '山西现代双语学校（北校）', lastLine: 460 }
  ]
};

console.log('='.repeat(80));
console.log('重建完整的2017-2024年太原中考录取分数线数据');
console.log('='.repeat(80));
console.log('\n📊 当前数据完整性检查:\n');

// 检查当前数据完整性
const years = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
years.forEach(year => {
  const filePath = path.join(__dirname, `../data/years/${year}.json`);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const count = data.schools.filter(s => s.lastLine !== null).length;
    console.log(`${year}年: ${count}所学校 ${count >= 55 ? '✅' : '❌'}`);
  } else {
    console.log(`${year}年: 文件不存在 ❌`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('📝 开始重建2020年完整数据（来源：新东方太原学校官网）');
console.log('='.repeat(80));

// 重建2020年数据
const outputPath2020 = path.join(__dirname, '../data/years/2020.json');
fs.writeFileSync(outputPath2020, JSON.stringify(data2020Complete, null, 2), 'utf-8');
console.log(`\n✅ 2020年数据已重建: ${data2020Complete.schools.length}所学校`);
console.log(`   文件路径: ${outputPath2020}`);

console.log('\n' + '='.repeat(80));
console.log('⚠️  待补全年份：');
console.log('='.repeat(80));
console.log(`
需要从以下来源补全数据：

1. 2021年数据：
   - 新东方太原学校官网
   - 太原教育局官网
   - 91中考网

2. 2022年数据：
   - 新东方太原学校官网
   - 太原教育局官网
   - 高途教育

3. 2023年数据：
   - 新东方太原学校官网
   - 太原教育局官网

4. 2024年数据：
   - 太原教育局官网（官方发布）
   - 今日头条汇总文章

建议手动从以下网址采集：
- 新东方官网: http://ty.xdf.cn/
- 91中考网: http://www.91zhongkao.com/
- 今日头条文章: https://www.toutiao.com/article/7520206071944790563/
- 今日头条2020-2025汇总: https://www.toutiao.com/article/7654893281494467112/
`);

console.log('='.repeat(80));
