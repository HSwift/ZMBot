/* eslint-disable no-console */

const path = require('path');

function getCallerFile() {
  try {
    const err = new Error();
    let callerfile;
    const orig = Error.prepareStackTrace;

    Error.prepareStackTrace = (_, stack) => stack;
    const currentfile = err.stack.shift().getFileName();

    while (err.stack.length) {
      callerfile = err.stack.shift().getFileName();
      if (currentfile !== callerfile) {
        Error.prepareStackTrace = orig;
        const basename = path.basename(callerfile, path.extname(callerfile));
        return [callerfile, basename];
      }
    }

    Error.prepareStackTrace = orig;
  } catch (err) {
    return [undefined, undefined];
  }
  return [undefined, undefined];
}

function logInfo(...args) {
  console.log(`[${getCallerFile()[1]}]`, ...args);
}

function logError(...args) {
  console.error(...args);
}

function logDebug(...args) {
  if (process.env.debug !== 1) return;
  console.debug(`[${getCallerFile()[1]}]`, ...args);
}

module.exports = { logInfo, logError, logDebug };
