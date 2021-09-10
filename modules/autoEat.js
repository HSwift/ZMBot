const mineflayer = require('mineflayer');
const { logInfo, logError } = require('../utils');

class AutoEat {
  /**
   *
   * @param {mineflayer.Bot} bot
   */
  constructor(bot) {
    this.bot = bot;
    this.food = [];
    this.enable = true;
    this.isEating = false;
    this.noFood = false;
    this.prefix = 'eat';
    this.mcData = null;
  }

  init() {
    this.bot.on('physicsTick', () => {
      if (this.bot.food >= 20) return;
      if (this.noFood) return;
      if (!this.enable) return;
      if (this.bot.pathfinder) {
        if (this.bot.pathfinder.isMining() || this.bot.pathfinder.isBuilding()) { return; }
      }

      this.doEat();
      if (this.noFood) {
        this.bot.chat('not enough food');
      }
    });
    this.bot.foodToEat = this.food;
    this.mcData = this.bot.mcData;
  }

  readMemory(data) {
    this.food = data.food;
    this.enable = data.enable;
  }

  writeMemory() {
    return { food: this.food, enable: this.enable };
  }

  setFood(food = '') {
    const foodList = food.split(',');
    this.food.clear();
    for (const i of foodList) {
      if (this.mcData.blocksByName[i]) {
        this.food.push(i);
      }
    }
  }

  async doEat() {
    if (this.isEating) return false;
    this.isEating = true;

    const choices = this.bot.inventory
      .items()
      .filter((x) => this.food.includes(x.name));

    if (choices.length === 0) {
      this.isEating = false;
      this.noFood = true;
      return false;
    }

    const chosenFood = choices[0];
    logInfo('eat', chosenFood.name);

    try {
      await this.bot.equip(chosenFood, 'hand');
      await this.bot.consume();
    } catch (error) {
      this.isEating = false;
      logError(error);
      return false;
    }
    this.isEating = false;
    return true;
  }

  async chat(args, target) {
    if (args.length === 0) {
      this.noFood = false;
      if (this.bot.food >= 20) {
        this.bot.chat('not hungry');
      } else {
        this.doEat();
      }
    } else if (args[0] === 'on') {
      this.enable = true;
    } else if (args[0] === 'off') {
      this.enable = false;
    } else if (args[0] === 'set') {
      this.setFood(args[1]);
      this.bot.chat(this.food.join(','));
    } else if (args[0] === 'get') {
      this.bot.chat(this.food.join(','));
    }
  }
}

module.exports = AutoEat;
