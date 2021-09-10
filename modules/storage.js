const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const { GoalNear } = require('../plugins/pathfinder/index').goals;
const { logError } = require('../utils');

class Storage {
  /**
   *
   * @param {mineflayer.Bot} bot
   */
  constructor(bot) {
    this.bot = bot;
    this.storages = new Map();
    this.storageType = ['chest', 'shulker_box', 'ender_chest'];
    this.prefix = 'storage';
  }

  readMemory(data) {
    this.storages = data.storages;
  }

  writeMemory() {
    return { storages: this.storages };
  }

  setStorage(position, tag = 'default') {
    this.storages.set(tag, position);
  }

  getStorage(tag = 'default') {
    return this.storages.get(tag);
  }

  async loadFromStorage(tag = 'default') {
    const position = this.storages.get(tag);
    if (position === undefined) throw new Error('storage name incorrect');
    await this.bot.pathfinder.goto(
      new GoalNear(position.x, position.y, position.z, 2),
    );
    const block = this.bot.blockAt(position);
    if (!this.storageType.includes(block.name)) { throw new Error('unsupported target'); }
    const chest = await this.bot.openChest(block);
    for (const item of chest.containerItems()) {
      try {
        await chest.withdraw(item.type, null, item.count);
      } catch (err) {
        if (err.message.includes('full')) {
          break;
        }
      }
    }
    chest.close();
  }

  async dumpToStorage(tag = 'default') {
    const position = this.storages.get(tag);
    if (position === undefined) throw new Error('storage name incorrect');
    await this.bot.pathfinder.goto(
      new GoalNear(position.x, position.y, position.z, 2),
    );
    const block = this.bot.blockAt(position);
    if (!this.storageType.includes(block.name)) { throw new Error('unsupported target'); }
    const chest = await this.bot.openChest(block);
    for (const item of chest.items()) {
      try {
        await chest.deposit(item.type, null, item.count);
      } catch (err) {
        if (err.message.includes('full')) {
          break;
        }
      }
    }
    chest.close();
  }

  async chat(args, target) {
    if (args.length === 0) {
      const storagePos = this.getStorage();
      if (storagePos === undefined) {
        this.bot.chat('no default storage set');
      } else {
        this.bot.chat(storagePos.toString());
      }
    } else if (args[0] === 'set' && args.length >= 4) {
      const position = Vec3(args[1], args[2], args[3]);
      this.setStorage(position, args[4]);
    } else if (args[0] === 'load') {
      try {
        await this.loadFromStorage(args[1]);
      } catch (err) {
        this.bot.chat(err.message);
        logError(err);
      }
    } else if (args[0] === 'dump') {
      try {
        await this.dumpToStorage(args[1]);
      } catch (err) {
        this.bot.chat(err.message);
        logError(err);
      }
    } else {
      const storagePos = this.getStorage(args[0]);
      if (storagePos === undefined) {
        this.bot.chat('no default storage set');
      } else {
        this.bot.chat(storagePos.toString());
      }
    }
  }
}

module.exports = Storage;
