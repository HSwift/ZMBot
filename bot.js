const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');
const { logInfo, logError } = require('./utils');
const { pathfinder, Movements } = require('./plugins/pathfinder/index');
const AutoEat = require('./modules/autoEat');
const AutoSleep = require('./modules/autoSleep');
const WayPoint = require('./modules/wayPoint');
const StoreKeeper = require('./modules/storeKeeper');
const Storage = require('./modules/storage');
const Info = require('./modules/info');
const Movement = require('./modules/movement');
const Inventory = require('./modules/inventory');
const { readMemory, writeMemory } = require('./memory');
const repl = require('repl');
const Workflow = require('./modules/workflow');

if (process.argv.length > 6) {
  console.log('Usage : node bot.js [<host>] [<port>] [<name>] [<password>]');
  process.exit(1);
}

const bot = mineflayer.createBot({
  host: process.argv[2] || 'localhost',
  port: parseInt(process.argv[3], 10) || 25565,
  username: process.argv[4] || 'ZMBot',
  password: process.argv[5],
});

bot.loadPlugin(pathfinder);

const modules = [];
modules.push(new AutoEat(bot));
modules.push(new AutoSleep(bot));
modules.push(new WayPoint(bot));
modules.push(new StoreKeeper(bot));
modules.push(new Storage(bot));
modules.push(new Info(bot));
modules.push(new Movement(bot));
modules.push(new Inventory(bot));
modules.push(new Workflow(bot));

bot.once('inject_allowed', () => {
  const mcData = minecraftData(bot.version);
  const defaultMove = new Movements(bot, mcData);
  defaultMove.canDig = false;
  bot.mcData = mcData;
  bot.pathfinder.setMovements(defaultMove);
});

async function saveMemory() {
  const readMemoryPromises = modules.map((x) => writeMemory(x));
  await Promise.allSettled(readMemoryPromises);
  logInfo('memory serialized');
}

async function initModule() {
  const readMemoryPromises = modules.map((x) => readMemory(x));
  await Promise.allSettled(readMemoryPromises);
  for (const module of modules) {
    module.init && module.init();
  }
  logInfo('module initialized');
  process.on('SIGINT', async () => {
    bot.quit('user abored');
    await saveMemory();
    process.exit(0);
  });
}

bot.once('spawn', () => {
  initModule();
  logInfo('ZMBot online');
  bot.chat('ZMBot已上线');
});

bot.on('blockUpdate', (oldBlock, newBlock) => {
  if (oldBlock.position.x == 15 && oldBlock.position.y == 48 && oldBlock.position.z == 8) {
    console.log(newBlock);
    let tmp = async function(){
      modules[4].loadFromStorage('3').then(() => {
        modules[3].rearrange().then(() => {
          bot.chat('rearrange done');
        })
      });
    };
    if (newBlock.metadata == 12) {
      tmp();
    }
  }
})

bot.on('error', (error) => {
  logError(error);
});

bot.on('chat', (username, message) => {
  if (username === bot.username || username === 'you') return;
  const target = bot.players[username] ? bot.players[username].entity : null;
  console.log('[chat]', username, ':', message);

  if (message === 'save') {
    saveMemory();
  } else if (message === 'poweroff') {
    saveMemory().then(() => {
      bot.chat('Bye!');
      bot.quit('Bot exit.');
      process.exit(0);
    });
    return;
  }
  for (const module of modules) {
    const args = message.split(' ');
    if (module.prefix === '') {
      module.chat(args, target);
    } else if (module.prefix === args[0]) {
      module.chat(args.splice(1), target);
    }
  }
});

/*
bot.on('login', () => {
  const r = repl.start('> ')
  r.context.bot = bot

  r.on('exit', () => {
    bot.end()
  })
});
*/