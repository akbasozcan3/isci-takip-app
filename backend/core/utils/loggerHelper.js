function getLogger(context) {
  try {
    const { getLogger: loggerGetter } = require('./logger');
    return loggerGetter(context);
  } catch (err) {
    return {
      warn: (...args) => console.warn(`[${context}]`, ...args),
      error: (...args) => console.error(`[${context}]`, ...args),
      info: (...args) => console.log(`[${context}]`, ...args),
      debug: (...args) => console.debug(`[${context}]`, ...args)
    };
  }
}

module.exports = { getLogger };
