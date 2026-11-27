/**
 * 后端接口封装（wx.request Promise 化）
 *
 * 统一处理：
 *   - 超时与网络错误
 *   - HTTP 非 2xx（含 429 限流）
 *   - 业务层 success === false
 */

const { API_BASE } = require('./config')

const TIMEOUT = 15000

function request(path, { method = 'GET', data = null, needAuth = false } = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}/api${path}`,
      method,
      data: data || undefined,
      timeout: TIMEOUT,
      header: {
        'content-type': 'application/json'
      },
      success(res) {
        const { statusCode, data: body } = res

        if (statusCode === 429) {
          const retry = (body && body.retryAfter) || 60
          return reject(new Error(`请求过于频繁，请 ${retry} 秒后再试`))
        }

        if (statusCode < 200 || statusCode >= 300) {
          const msg =
            (body && (body.error || body.message)) || `请求失败（HTTP ${statusCode}）`
          return reject(new Error(msg))
        }

        if (body && body.success === false) {
          return reject(new Error(body.error || '请求失败'))
        }

        resolve(body)
      },
      fail(err) {
        // 常见原因：未勾选"不校验合法域名"、域名未备案、证书无效
        const msg = err && err.errMsg ? err.errMsg : '网络请求失败'
        if (msg.indexOf('url not in domain list') >= 0) {
          return reject(
            new Error('域名未在微信后台配置。开发阶段请在开发者工具勾选"不校验合法域名"')
          )
        }
        reject(new Error(msg))
      }
    })
  })
}

module.exports = {
  /** 全部初中学校（用于选校） */
  getJuniorSchools() {
    return request('/junior-schools/list/all').then(res => res.data || [])
  },

  /** 志愿推荐 */
  getRecommendations({ studentScore, juniorSchoolId, targetYear }) {
    return request('/recommendations', {
      method: 'POST',
      data: { studentScore, juniorSchoolId, targetYear }
    }).then(res => res.data)
  },

  /** 学校详情：历年分数线 + 预测 */
  getSchoolDetail(code) {
    return request(`/schools/${encodeURIComponent(code)}/history`).then(res => ({
      school: res.school,
      history: (res.history || []).slice().sort((a, b) => a.year - b.year),
      predictions: res.predictions || []
    }))
  },

  /** 某年预测列表（备用） */
  getPredictions(year, limit = 100) {
    return request(`/predictions/${year}?limit=${limit}`).then(res => res.data || [])
  },

  /** 算法信息（用于"关于"展示） */
  getAlgorithmInfo() {
    return request('/algorithm/info')
  }
}
