let bot = null;

function unhandledError(err) {
	if(bot) {
		bot.chat('ZMBot已去世： ' + err.toString());
		bot.quit();
	}
	
	throw err;
}

process.on('uncaughtException', unhandledError);
process.on('unhandledRejection', unhandledError);

bot = require('./bot');
