const isDev = process.env.NODE_ENV === 'development'

const logger = {
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error(...args)
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args)
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args)
    }
  },
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args)
    }
  },
}

export default logger
