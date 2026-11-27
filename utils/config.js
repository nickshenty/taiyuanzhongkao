/**
 * 小程序环境配置
 *
 * 域名要求（微信强制）：
 *   - 必须 HTTPS，不支持 http，不支持非标准端口（必须 443）
 *   - 域名必须完成 ICP 备案，否则无法在小程序后台配置
 *   - 需在小程序后台「开发管理 → 服务器域名 → request 合法域名」中添加
 *
 * 本地联调（域名尚未备案时）：
 *   开发者工具 → 右上角「详情」→「本地设置」→ 勾选
 *   「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」
 *   此时可用 http://localhost:3002 调试
 */

// 开发环境地址（仅开发者工具勾选"不校验合法域名"后可用）
const DEV_BASE = 'http://localhost:3002'

// 生产环境地址：备案完成后改成你的域名（不要带结尾斜杠、不要带端口）
const PROD_BASE = 'https://your-domain.com'

/**
 * 自动选择环境：
 *   develop / trial → DEV_BASE
 *   release         → PROD_BASE
 */
function resolveBase() {
  try {
    const info = wx.getAccountInfoSync()
    const env = info && info.miniProgram && info.miniProgram.envVersion
    if (env === 'release') return PROD_BASE
    return DEV_BASE
  } catch (e) {
    return DEV_BASE
  }
}

module.exports = {
  API_BASE: resolveBase(),
  DEV_BASE,
  PROD_BASE,
  TARGET_YEAR: 2027,
  APP_NAME: '太原中考志愿推荐',
  DISCLAIMER: '预测数据仅供参考，实际录取以太原市教育局官方发布为准'
}
