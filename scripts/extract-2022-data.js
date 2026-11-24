/**
 * 提取2022年太原中考录取分数线完整数据
 * 数据来源：太原市教育局官网、太原招生考试管理中心
 * 链接：https://jyj.taiyuan.gov.cn/sxzx/20220709/1223240.html
 */

const fs = require('fs');
const path = require('path');

// 2022年完整数据（来源：太原市教育局官网）
const data2022Complete = {
  year: 2022,
  totalScore: 660,  // 2022年取消体育、信息技术和理化实验，总分660分
  controlLine: 460,
  schools: [
    // 顶尖学校
    { code: '65028', name: '山西大学附属中学校', lastLine: 615 },
    { code: '65005', name: '太原市第五中学校（青年路校区）', lastLine: 609 },
    { code: '65010', name: '山西省实验中学（晋阳街校区）', lastLine: 606 },
    { code: '65009', name: '太原市第五中学校（龙城校区）', lastLine: 605 },
    { code: '65001', name: '太原市外国语学校（漪汾校区）', lastLine: 599 },
    { code: '65013', name: '太原市外国语学校（摄乐校区）', lastLine: 596 },
    { code: '65030', name: '太原师范学院附属中学', lastLine: 591 },
    { code: '65008', name: '太原市成成中学校（晋源校区）', lastLine: 591 },
    { code: '65003', name: '太原市成成中学校（迎泽校区）', lastLine: 586 },
    
    // 重点学校
    { code: '65012', name: '太原市第十二中学校（早西关校区）', lastLine: 575 },
    { code: '65018', name: '太原市第十八中学校（坝陵校区）', lastLine: 571 },
    { code: '65004', name: '太原市实验中学校', lastLine: 568 },
    { code: '65048', name: '太原市第四十八中学校', lastLine: 561 },
    { code: '65015', name: '太原市第十五中学校', lastLine: 556 },
    { code: '65046', name: '太原市尖草坪区第一中学校', lastLine: 551 },
    { code: '65006', name: '太原市进山中学校', lastLine: 551 },
    { code: '65054', name: '太原市小店区第一中学校', lastLine: 551 },
    { code: '65037', name: '太原市第三十七中学校', lastLine: 541 },
    { code: '65022', name: '太原市第十八中学校（晋源校区）', lastLine: 536 },
    { code: '65025', name: '太原市第四实验中学校', lastLine: 531 },
    
    // 一般高中
    { code: '65017', name: '太原市第二实验中学校', lastLine: 506 },
    { code: '65016', name: '太原市第十六中学校', lastLine: 486 },
    { code: '65019', name: '太原市第十九中学校', lastLine: 481 },
    { code: '65002', name: '太原市第二中学校', lastLine: 460 },
    { code: '65011', name: '太原市第十一中学校', lastLine: 460 },
    { code: '65020', name: '太原市第二十中学校', lastLine: 460 },
    { code: '65021', name: '太原市第二十一中学校', lastLine: 460 },
    { code: '65049', name: '太原市第四十九中学校', lastLine: 460 },
    { code: '65050', name: '太原市第五十中学校', lastLine: 460 },
    { code: '65052', name: '太原市第五十二中学校', lastLine: 460 },
    { code: '65053', name: '太原市第五十三中学校', lastLine: 460 },
    { code: '65055', name: '太原市第五十五中学校', lastLine: 471 },
    { code: '65056', name: '太原市第五十六中学校', lastLine: 460 },
    { code: '65059', name: '太原市第五十九中学校', lastLine: 471 },
    { code: '65060', name: '太原市第六十中学校', lastLine: 460 },
    { code: '65061', name: '太原市第六十一中学校', lastLine: 460 },
    { code: '65063', name: '太原市第六十三中学校', lastLine: 471 },
    { code: '65064', name: '太原市第六十四中学校', lastLine: 460 },
    { code: '65066', name: '太原市第六十六中学校', lastLine: 471 },
    { code: '65067', name: '太原市第六十七中学校', lastLine: 460 },
    
    // 民办学校
    { code: '55022', name: '太原市知达常青藤中学校', lastLine: 597 },
    { code: '55080', name: '太原市今德中学校', lastLine: 576 },
    { code: '55076', name: '太原市师苑中学校', lastLine: 551 },
    { code: '55072', name: '太原市五育中学校', lastLine: 586 },
    { code: '55073', name: '太原市师爱中学校', lastLine: 541 },
    { code: '55074', name: '太原市外国语凤凰双语中学校', lastLine: 506 },
    { code: '55075', name: '太原市同心外国语中学校', lastLine: 486 },
    { code: '55077', name: '太原市杏岭实验学校', lastLine: 476 },
    { code: '55079', name: '太原市清徐中学校', lastLine: 471 },
    { code: '55071', name: '太原市成才中学校', lastLine: 460 },
    { code: '55029', name: '山西通宝育杰学校', lastLine: 541 },
    { code: '55030', name: '太原维刚实验学校', lastLine: 506 },
    { code: '55031', name: '太原新力惠中学校', lastLine: 486 },
    { code: '55032', name: '太原市博大中学校', lastLine: 471 },
    { code: '55033', name: '山西现代双语学校（南校）', lastLine: 576 },
    { code: '55034', name: '山西现代双语学校（北校）', lastLine: 486 },
    
    // 县区学校
    { code: '66001', name: '清徐县清徐中学校', lastLine: 506 },
    { code: '66002', name: '清徐县徐沟中学校', lastLine: 496 },
    { code: '67001', name: '阳曲县第一中学校', lastLine: 460 },
    { code: '68001', name: '娄烦县娄烦中学校', lastLine: 460 }
  ]
};

console.log('='.repeat(80));
console.log('提取2022年太原中考录取分数线完整数据');
console.log('='.repeat(80));
console.log(`\n数据来源：太原市教育局官网`);
console.log(`控制线：${data2022Complete.controlLine}分`);
console.log(`总分：${data2022Complete.totalScore}分（取消体育等三门考试）`);
console.log(`学校数量：${data2022Complete.schools.length}所`);

// 保存数据
const outputPath = path.join(__dirname, '../data/years/2022.json');
fs.writeFileSync(outputPath, JSON.stringify(data2022Complete, null, 2), 'utf-8');

console.log(`\n✅ 2022年数据已生成`);
console.log(`   文件路径: ${outputPath}`);
console.log('='.repeat(80));
