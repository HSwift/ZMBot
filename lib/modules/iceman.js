const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');
const { logInfo, logError } = require('../utils');
const { Goal } = require('../plugins/pathfinder/lib/goals');
const { GoalNear } = require('../plugins/pathfinder/index').goals;

class Iceman {
  /**
   *
   * @param {mineflayer.Bot} bot
   */
  constructor(bot) {
    this.bot = bot;
    this.enable = true;
    this.prefix = '';
    this.mcData = null;
  }

  init() {
    this.mcData = this.bot.mcData;
  }

  async chat(args, target) {
    const { bot } = this;
    const { health } = bot;
    const { food } = bot;
    const { position } = bot.entity;
    const dimension = bot.game.dimension.substr(10);
    switch (args[0]) {
      case 'iceman':
        await this.iceCollect();
        this.bot.chat('冰采集结束！');
        break;
      case 'digIce':
        await this.handleTool();
        await this.digIce();
        break;
      case 'dig':
        await this.dig();
        break;
      case 'sortTower':
        await this.bot.modules.Storage.loadFromStorage('tower1');
        await this.bot.modules.StoreKeeper.rearrange();
        await this.bot.modules.Storage.loadFromStorage('tower1');
        await this.bot.modules.StoreKeeper.rearrange();
        await this.bot.modules.Storage.loadFromStorage('tower2');
        await this.bot.modules.StoreKeeper.rearrange();
        await this.bot.modules.Storage.loadFromStorage('tower2');
        await this.bot.modules.StoreKeeper.rearrange();
        await this.bot.modules.Storage.loadFromStorage('tower3');
        await this.bot.modules.StoreKeeper.rearrange();
        await this.bot.modules.Storage.loadFromStorage('tower3');
        await this.bot.modules.StoreKeeper.rearrange();
        await this.bot.modules.Storage.loadFromStorage('tower4');
        await this.bot.modules.StoreKeeper.rearrange();
        await this.bot.modules.Storage.loadFromStorage('tower4');
        await this.bot.modules.StoreKeeper.rearrange();
        await this.bot.modules.Storage.loadFromStorage('tower5');
        await this.bot.modules.StoreKeeper.rearrange();
        await this.bot.modules.Storage.loadFromStorage('tower5');
        await this.bot.modules.StoreKeeper.rearrange();
        this.bot.chat('收拾刷怪箱完毕！');
        break;
      default:
        break;
    }
  }

  async digIce(round = 0) {
    if (round >= 30) {
      this.bot.chat('挖掘完成');
      return;
    }
    // const startTime = performance.now();
    const ids = this.mcData.blocksByName.ice.id;
    const blocks = this.bot.findBlocks({
      matching: ids, maxDistance: 19, point: this.bot.entity.position, count: 64,
    }).filter((x) => x.y === 117);
    // const time = (performance.now() - startTime).toFixed(2);
    // this.bot.chat(`我在附近找到 ${blocks.length} 个冰，用时 ${time} 毫秒！`);
    let iCount = 0;
    let lastNotDiggable = null;
    for (const block of blocks) {
      // await this.bot.lookAt(block);
      const realBlock = this.bot.blockAt(block);
      if (this.bot.canDigBlock(realBlock)) {
        iCount++;
        await this.handleTool();
        await this.bot.dig(realBlock);
      } else {
        lastNotDiggable = realBlock;
      }
    }
    this.bot.chat(`第 ${round} 轮挖掘了 ${iCount} 个冰`);
    if (lastNotDiggable !== null) {
      await this.bot.pathfinder.goto(
        // eslint-disable-next-line max-len
        new GoalNear(lastNotDiggable.position.x, lastNotDiggable.position.y, lastNotDiggable.position.z, 1),
      );
      await this.digIce(round + 1);
    }
  }

  async dig() {
    let target;
    if (this.bot.targetDigBlock) {
      this.bot.chat(`already digging ${this.bot.targetDigBlock.name}`);
    } else {
      target = this.bot.blockAt(this.bot.entity.position.offset(0, -1, 0));
      if (target && this.bot.canDigBlock(target)) {
        this.bot.chat(`starting to dig ${target.name}`);
        try {
          await this.bot.dig(target);
          this.bot.chat(`finished digging ${target.name}`);
        } catch (err) {
          console.log(err.stack);
        }
      } else {
        this.bot.chat('cannot dig');
      }
    }
  }

  async iceCollect() {
    const handleResult = await this.handleTool();
    if (!handleResult) {
      // 工具没拿在手上，要找工具，去箱子里找
      this.bot.chat('工具没在手里，我去箱子里先找找');
      await this.bot.pathfinder.goto(
        new GoalNear(-9, 48, 8, 2),
      );
      const block = this.bot.blockAt(new Vec3(-9, 48, 8));
      const chest = await this.bot.openChest(block);
      for (const item of chest.containerItems()) {
        try {
          if (item.customName !== null && JSON.parse(item.customName).text === 'bot-tool') {
            await chest.withdraw(item.type, null, 1);
            chest.close();
            const bHandleResult = await this.handleTool();
            if (!bHandleResult) {
              this.bot.chat('装备失败');
            } else {
              this.bot.chat('工具装备好辣！');
              await this.gotoIce();
              await this.digIce();
              await this.goHome();
            }
            return;
          }
        } catch (err) {
          if (err.message.includes('full')) {
            break;
          }
        }
      }
      this.bot.chat('我的工具不见了，快帮我找找？TAT');
      chest.close();
    } else {
      this.bot.chat('工具装备好辣！');
      await this.gotoIce();
      await this.digIce();
      await this.goHome();
    }
  }

  async goHome() {
    this.bot.chat('准备回家收拾！');
    await this.bot.modules.StoreKeeper.rearrange();
    this.bot.chat('收拾完成！');
  }

  async gotoIce() {
    this.bot.chat('我去挖冰了！');
    await this.bot.pathfinder.goto(
      new GoalNear(146, 118, -221, 1),
    );
    this.bot.chat('我到现场啦');
  }

  async handleTool() {
    const items = this.bot.inventory.items();
    for (const item of items) {
      // console.log(`Searching ${item.displayName}`);
      if (item.customName === null) {
        continue;
      }
      if (JSON.parse(item.customName).text !== 'bot-tool') {
        continue;
      }
      // this.bot.chat('找到工具了，拿在手上');
      // console.log(item);
      await this.bot.equip(item, 'hand');
      return true;
    }
    return false;
  }
}

module.exports = Iceman;
