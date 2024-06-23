const { GoalNear } = require('../plugins/pathfinder/lib/goals');

class AutoPickup {
  /**
   *
   * @param {mineflayer.Bot} bot
   */
  constructor(bot) {
    this.bot = bot;
    this.prefix = 'autoPickup';
    this.mcData = null;
    this.pickQueue = [];
    this.pickStatus = false;
    this.distance = -1;
    this.pickRunning = false;
    this.autoRearrange = false;
    // start to pick up items in queue infinitely
    setInterval(async () => {

    }, 1000);
  }

  init() {
    this.mcData = this.bot.mcData;
    setInterval(async () => {
      if (this.pickRunning) return;
      try {
        this.pickRunning = true;
        if (this.pickStatus && this.pickQueue.length > 0 && !this.bot.pathfinder.isMoving()) {
          let searchAgain = false;
          do {
            const entity = this.pickQueue.shift();
            // 计算物品和当前机器人之间的水平距离（仅计算X-Z轴）
            const distance = this.bot.entity.position.distanceTo(entity.position);
            console.log('Picking up item', entity.onGround && entity.isValid ? ' valid' : ' invalid', `, distance: ${distance}`);
            // eslint-disable-next-line max-len
            if (entity.onGround && entity.isValid && (this.distance === -1 || distance <= this.distance)) {
              // eslint-disable-next-line max-len
              await this.bot.pathfinder.setGoal(new GoalNear(entity.position.x, entity.position.y, entity.position.z, 1));
              if (this.bot.inventory.items().length >= 36) {
                // inventory is full
                this.bot.chat('[autoPickup] Inventory is full, start to rearrange');
                this.pickQueue.unshift(entity);
                this.pickStatus = false;
                const currentPos = this.bot.entity.position;
                await this.bot.modules.StoreKeeper.rearrange();
                this.bot.chat('[autoPickup] Sort done, return to pick status and return to previous position');
                // eslint-disable-next-line max-len
                await this.bot.pathfinder.setGoal(new GoalNear(currentPos.x, currentPos.y, currentPos.z, 1));
                this.pickStatus = true;
                break;
              }
            } else {
              searchAgain = true;
            }
            // eslint-disable-next-line max-len
          } while (searchAgain && this.pickQueue.length > 0 && this.pickStatus && !this.bot.pathfinder.isMoving());
        }
        this.pickRunning = false;
      } catch (e) {
        this.bot.chat(`[autoPickup] ${e.message}`);
        this.pickRunning = false;
      }
    }, 1000);
    this.bot.on('itemDrop', async (entity) => {
      if (entity.name === 'item' && this.pickStatus) {
        // pick it up
        // add it to pickQueue
        this.pickQueue.push(entity);
        // eslint-disable-next-line max-len
        // this.bot.pathfinder.setGoal(new GoalNear(entity.position.x, entity.position.y, entity.position.z, 1));
      }
    });
  }

  getItemInfo(item) {
    if (/^\d+$/.test(item)) {
      return this.mcData.items[item];
    }
    return this.mcData.blocksByName[item];
  }

  async chat(args, target) {
    if (args[0] === 'on') {
      const dist = args.length > 1 ? (` in ${args[1]} distance`) : '';
      this.bot.chat(`[autoPickup] Start to pick up items${dist}`);
      this.pickStatus = true;
      if (args.length > 1) {
        this.distance = parseInt(args[1], 10);
      } else {
        this.distance = -1;
      }
      if (args.length > 2) {
        this.autoRearrange = args[2] === 'on';
      } else {
        this.autoRearrange = false;
      }
    } else if (args[0] === 'off') {
      this.bot.chat('[autoPickup] Stop picking up items');
      this.pickStatus = false;
    } else {
      console.log('??????');
    }
  }
}

module.exports = AutoPickup;
