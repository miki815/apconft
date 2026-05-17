export default function genErrHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next)
    } catch (error) {
      const status = error.response?.status
      const data = error.response?.data
      console.error(`[${fn.name}]`, error.message, data)
      res.status(status && status < 600 ? status : 500).json({
        error: error.message,
        apcopay: data,
      })
    }
  }
}
