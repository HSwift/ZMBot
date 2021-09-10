/* eslint-disable no-console */

function getCallerFile() {
  try {
    const err = new Error();
    let callerfile;

    Error.prepareStackTrace = (_, stack) => stack;
    const currentfile = err.stack.shift().getFileName();

    while (err.stack.length) {
      callerfile = err.stack.shift().getFileName();
      if (currentfile !== callerfile) return callerfile;
    }
  } catch (err) {
    return undefined;
  }
  return undefined;
}

function logInfo(...args) {
  const file = getCallerFile().match(/\/([a-z]*).js/)[1];
  console.log(`[${file}]`, ...args);
}

function logError(...args) {
  console.error(...args);
}

function logDebug(...args) {
  if (process.env.debug !== 1) return;
  const file = getCallerFile().match(/\/([a-z]*).js/)[1];
  console.log(`[${file}]`, ...args);
}

module.exports = { logInfo, logError, logDebug };
