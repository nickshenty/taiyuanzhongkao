const config = require('./utils/config')

App({
  globalData: {
    apiBase: config.API_BASE,
    targetYear: config.TARGET_YEAR
  },

  onLaunch() {
    console.log('[app] API:', config.API_BASE, '| 目标年:', config.TARGET_YEAR)
  }
})
