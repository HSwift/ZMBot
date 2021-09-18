const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const { GoalNear } = require('../plugins/pathfinder/index').goals;
const { logError } = require('../utils');

class AutoSleep {
  /**
   *
   * @param {mineflayer.Bot} bot
   */
  constructor(bot) {
    this.bot = bot;
    this.myBed = null;
    this.enable = true;
    this.prefix = 'sleep';
  }

  init() {
    this.bot.on('time', () => {
      if (this.bot.pathfinder && this.bot.pathfinder.isMoving()) return;
      if (this.myBed === null) return;
      if (this.bot.isSleeping) return;
      if (this.bot.time.isDay) return;
      if (!this.enable) return;
      this.doSleep();
    });
  }

  readMemory(data) {
    this.enable = data.enable;
    this.myBed = data.myBed;
  }

  writeMemory() {
    return { myBed: this.myBed, enable: this.enable };
  }

  async chat(args, target) {
    if (args.length === 0) {
      if (this.bot.time.isDay) {
        this.bot.chat('not time to sleep');
      } else {
        await this.doSleep();
      }
    }
    if (args[0] === 'bed' && args.length === 4) {
      this.myBed = Vec3(args[1], args[2], args[3]);
    }
    if (args[0] === 'on') {
      this.enable = true;
    }
    if (args[0] === 'off') {
      this.enable = false;
    }
  }

  async doSleep() {
    if (this.myBed === null) {
      this.bot.chat('no bed for me');
      this.enable = false;
      return false;
    }
    if (this.bot.isSleeping) {
      this.bot.chat('sleeping now');
      return false;
    }
    await this.bot.pathfinder.goto(
      new GoalNear(this.myBed.x, this.myBed.y, this.myBed.z, 2),
    );
    const bedBlock = this.bot.blockAt(this.myBed);

    if (!bedBlock.name.endsWith('_bed')) {
      this.bot.chat('my bed lost');
      this.myBed = null;
      return false;
    }

    try {
      this.bot.sleep(bedBlock);
    } catch (error) {
      logError(error);
      return false;
    }
    return true;
  }
}

module.exports = AutoSleep;
