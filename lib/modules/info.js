const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const { execSync } = require('child_process');
const { logInfo } = require('../utils');

class Info {
  /**
   *
   * @param {mineflayer.Bot} bot
   */
  constructor(bot) {
    this.bot = bot;
    this.prefix = '';
    this.mcData = null;
  }

  init() {
    this.mcData = this.bot.mcData;
  }

  getBlockInfo(block) {
    if (/^\d+$/.test(block)) {
      return this.mcData.blocks[block];
    }
    return this.mcData.blocksByName[block];
  }

  getItemInfo(item) {
    if (/^\d+$/.test(item)) {
      return this.mcData.items[item];
    }
    return this.mcData.blocksByName[item];
  }

  async chat(args, target) {
    const { bot } = this;
    const { health } = bot;
    const { food } = bot;
    const { position } = bot.entity;
    const dimension = bot.game.dimension.substr(10);
    switch (args[0]) {
      case 'info':
        console.log('info');
        break;
      default:
        console.log('unknown command');
        break;
    }
    if (args[0] === 'info') {
      let p = execSync('git show HEAD | head -n1 | awk \'{print $2}\'', { encoding: 'utf-8' });
      console.log(p);
      p = p.substr(0, 7);
      this.bot.chat(
        `HP: ${health} FOOD: ${food} POS: ${dimension}:${position
          .floored()
          .toString()}`,
      );
      this.bot.chat(`Now HEAD is ${p}`);
    } else if (args[0] === 'health') {
      this.bot.chat(health);
    } else if (args[0] === 'food') {
      const saturation = this.bot.foodSaturation;
      this.bot.chat(`${food} saturation:${saturation}`);
    } else if (args[0] === 'position') {
      this.bot.chat(`${dimension}:${position.floored().toString()}`);
    } else if (args[0] === 'block' && args.length === 2) {
      logInfo('block info');
      console.log(this.getBlockInfo(args[1]));
    } else if (args[0] === 'block' && args.length === 4) {
      const blockPos = Vec3(args[1], args[2], args[3]);
      const block = this.bot.blockAt(blockPos);
      logInfo('block info');
      console.log(block);
    } else if (args[0] === 'item' && args.length === 2) {
      logInfo('item info');
      console.log(this.getItemInfo(args[1]));
    }
  }
}

module.exports = Info;
