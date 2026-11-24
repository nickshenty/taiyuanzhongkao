// scripts/calculate-volatility.js
const fs = require('fs');
const path = require('path');

/**
 * 计算学校分数线波动率（标准差）
 * @param {Array} lines - 历年分数线 [2023, 2024, 2025, 2026]
 * @returns {Object} 波动统计
 */
function calculateVolatility(lines) {
  // 过滤无效数据
  const validLines = lines.filter(l => l !== null && !isNaN(l));
  
  if (validLines.length < 2) {
    return {
      volatility: 5,  // 默认值
      mean: validLines[0] || 0,
      stdDev: 0,
      range: 0,
      trend: 'insufficient_data',
      dataPoints: validLines.length
    };
  }
  
  // 计算均值
  const mean = validLines.reduce((sum, v) => sum + v, 0) / validLines.length;
  
  // 计算标准差
  const squaredDiffs = validLines.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / validLines.length;
  const stdDev = Math.sqrt(variance);
  
  // 计算极差
  const max = Math.max(...validLines);
  const min = Math.min(...validLines);
  const range = max - min;
  
  // 判断趋势
  let trend = 'stable';
  if (validLines.length >= 3) {
    const recent = validLines.slice(-3);
    if (recent[2] > recent[1] && recent[1] > recent[0]) {
      trend = 'rising';
    } else if (recent[2] < recent[1] && recent[1] < recent[0]) {
      trend = 'falling';
    }
  }
  
  return {
    volatility: Math.round(stdDev * 10) / 10,
    mean: Math.round(mean * 10) / 10,
    stdDev: Math.round(stdDev * 10) / 10,
    range,
    trend,
    dataPoints: validLines.length
  };
}

/**
 * 批量计算所有学校的波动率
 */
function calculateAllVolatility() {
  const yearsDir = './data/years';
  const results = {};
  
  // 加载所有年份数据
  const yearData = {};
  const years = ['2023', '2024', '2025', '2026'];
  
  years.forEach(year => {
    try {
      const filePath = path.join(yearsDir, `${year}.json`);
      if (fs.existsSync(filePath)) {
        yearData[year] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (error) {
      console.warn(`⚠️ 无法读取 ${year}.json:`, error.message);
    }
  });
  
  // 收集所有学校代码
  const allCodes = new Set();
  Object.values(yearData).forEach(data => {
    data.schools.forEach(school => allCodes.add(school.code));
  });
  
  // 为每所学校计算波动率
  allCodes.forEach(code => {
    const lines = [];
    const schoolInfo = {};
    
    years.forEach(year => {
      if (yearData[year]) {
        const school = yearData[year].schools.find(s => s.code === code);
        if (school) {
          lines.push(school.lastLine);
          Object.assign(schoolInfo, {
            name: school.name,
            tier: school.tier
          });
        } else {
          lines.push(null);
        }
      } else {
        lines.push(null);
      }
    });
    
    if (Object.keys(schoolInfo).length > 0) {
      const volatilityData = calculateVolatility(lines);
      results[code] = {
        ...schoolInfo,
        lines: {
          2023: lines[0],
          2024: lines[1],
          2025: lines[2],
          2026: lines[3]
        },
        ...volatilityData
      };
    }
  });
  
  return results;
}

/**
 * 生成波动率分析报告
 */
function generateVolatilityReport(volatilityData) {
  console.log('\n' + '='.repeat(100));
  console.log('太原中考分数线波动率分析报告（2023-2026）'.padStart(65));
  console.log('='.repeat(100));
  
  // 按层次分组
  const byTier = {
    '省级示范': [],
    '市级示范': [],
    '一般高中': [],
    '民办': []
  };
  
  Object.values(volatilityData).forEach(school => {
    if (byTier[school.tier]) {
      byTier[school.tier].push(school);
    }
  });
  
  // 总体统计
  const allVolatility = Object.values(volatilityData).map(s => s.volatility);
  const avgVolatility = allVolatility.reduce((sum, v) => sum + v, 0) / allVolatility.length;
  const maxVolatility = Math.max(...allVolatility);
  const minVolatility = Math.min(...allVolatility);
  
  console.log(`\n📊 总体统计（${Object.keys(volatilityData).length}所学校）`);
  console.log('-'.repeat(100));
  console.log(`  平均波动率: ${avgVolatility.toFixed(1)}分  |  最大: ${maxVolatility.toFixed(1)}分  |  最小: ${minVolatility.toFixed(1)}分`);
  
  // 按层次统计
  console.log(`\n📈 按层次统计波动率`);
  console.log('-'.repeat(100));
  
  Object.entries(byTier).forEach(([tier, schools]) => {
    if (schools.length === 0) return;
    
    const avgTierVolatility = schools.reduce((sum, s) => sum + s.volatility, 0) / schools.length;
    const avgRange = schools.reduce((sum, s) => sum + s.range, 0) / schools.length;
    
    console.log(`\n【${tier}】 (${schools.length}所学校)`);
    console.log('  平均波动: ' + avgTierVolatility.toFixed(1).padStart(5) + '分  |  平均极差: ' + avgRange.toFixed(1).padStart(5) + '分');
    console.log('  ' + '-'.repeat(95));
    console.log('  学校名称'.padEnd(35) + '波动率  2023   2024   2025   2026  极差  趋势');
    console.log('  ' + '-'.repeat(95));
    
    schools
      .sort((a, b) => b.volatility - a.volatility)
      .forEach(school => {
        const nameDisplay = (school.name || '').substring(0, 32).padEnd(35);
        const volatilityDisplay = school.volatility.toFixed(1).padStart(5);
        const line2023 = (school.lines[2023] || '-').toString().padStart(5);
        const line2024 = (school.lines[2024] || '-').toString().padStart(5);
        const line2025 = (school.lines[2025] || '-').toString().padStart(5);
        const line2026 = (school.lines[2026] || '-').toString().padStart(5);
        const rangeDisplay = school.range.toString().padStart(4);
        const trendDisplay = getTrendIcon(school.trend).padStart(3);
        
        console.log(`  ${nameDisplay} ${volatilityDisplay}  ${line2023}  ${line2024}  ${line2025}  ${line2026}  ${rangeDisplay}  ${trendDisplay}`);
      });
  });
  
  // 高波动学校
  console.log('\n' + '='.repeat(100));
  console.log('⚠️ 高波动学校（波动率>10分）- 需要特别关注');
  console.log('='.repeat(100));
  
  const highVolatility = Object.values(volatilityData)
    .filter(s => s.volatility > 10)
    .sort((a, b) => b.volatility - a.volatility);
  
  if (highVolatility.length > 0) {
    highVolatility.forEach(school => {
      console.log(`  ${school.name.padEnd(35)} 波动率: ${school.volatility}分  |  极差: ${school.range}分  |  趋势: ${getTrendDesc(school.trend)}`);
    });
  } else {
    console.log('  无高波动学校 ✅');
  }
  
  // 稳定学校
  console.log('\n' + '='.repeat(100));
  console.log('✅ 稳定学校（波动率<3分）- 分数线稳定');
  console.log('='.repeat(100));
  
  const stable = Object.values(volatilityData)
    .filter(s => s.volatility < 3)
    .sort((a, b) => a.volatility - b.volatility);
  
  if (stable.length > 0) {
    stable.forEach(school => {
      console.log(`  ${school.name.padEnd(35)} 波动率: ${school.volatility}分  |  平均线: ${school.mean.toFixed(0)}分`);
    });
  } else {
    console.log('  无特别稳定的学校');
  }
  
  // 上升/下降趋势
  console.log('\n' + '='.repeat(100));
  console.log('📊 分数线趋势分析');
  console.log('='.repeat(100));
  
  const rising = Object.values(volatilityData)
    .filter(s => s.trend === 'rising')
    .sort((a, b) => b.volatility - a.volatility);
  
  const falling = Object.values(volatilityData)
    .filter(s => s.trend === 'falling')
    .sort((a, b) => b.volatility - a.volatility);
  
  console.log(`\n📈 上升趋势（${rising.length}所）: 分数线逐年上升，竞争加剧`);
  rising.slice(0, 10).forEach(school => {
    const trend = `${school.lines[2023]} → ${school.lines[2024]} → ${school.lines[2025]} → ${school.lines[2026]}`;
    console.log(`  ${school.name.padEnd(35)} ${trend}`);
  });
  
  console.log(`\n📉 下降趋势（${falling.length}所）: 分数线逐年下降，录取相对容易`);
  falling.slice(0, 10).forEach(school => {
    const trend = `${school.lines[2023]} → ${school.lines[2024]} → ${school.lines[2025]} → ${school.lines[2026]}`;
    console.log(`  ${school.name.padEnd(35)} ${trend}`);
  });
  
  console.log('\n' + '='.repeat(100) + '\n');
}

function getTrendIcon(trend) {
  const icons = {
    rising: '↗',
    falling: '↘',
    stable: '→',
    insufficient_data: '?'
  };
  return icons[trend] || '?';
}

function getTrendDesc(trend) {
  const desc = {
    rising: '上升趋势',
    falling: '下降趋势',
    stable: '稳定',
    insufficient_data: '数据不足'
  };
  return desc[trend] || '未知';
}

// 主执行
function main() {
  console.log('正在计算波动率...\n');
  
  const volatilityData = calculateAllVolatility();
  
  // 生成报告
  generateVolatilityReport(volatilityData);
  
  // 保存JSON结果
  fs.writeFileSync(
    './data/analysis/volatility-analysis.json',
    JSON.stringify(volatilityData, null, 2)
  );
  
  console.log('✅ 波动率分析完成！');
  console.log('   结果已保存到: data/analysis/volatility-analysis.json\n');
}

if (require.main === module) {
  main();
}

module.exports = { calculateVolatility, calculateAllVolatility, generateVolatilityReport };
