const mineflayer = require('mineflayer');
const { logInfo, logError } = require('../utils');

class Inventory {
  /**
   *
   * @param {mineflayer.Bot} bot
   */
  constructor(bot) {
    this.bot = bot;
    this.prefix = 'invt';
  }

  async tossStack(name) {
    const items = this.bot.inventory.items();
    if (name === undefined) {
      const { heldItem } = this.bot;
      await this.bot.tossStack(heldItem);
      return;
    }
    const selectedItem = items.filter((x) => x.name === name);
    if (selectedItem.length === 0) {
      throw new Error(`${name} not exist`);
    }
    await this.bot.tossStack(selectedItem[0]);
  }

  async equip(name, dest = 'hand') {
    const items = this.bot.inventory.items();
    const selectedItem = items.filter((x) => x.name === name);
    if (selectedItem.length === 0) {
      throw new Error(`${name} not exist`);
    }
    await this.bot.equip(selectedItem[0], dest);
  }

  async unequip(dest = 'hand') {
    await this.bot.unequip(dest);
  }

  async chat(args, target) {
    try {
      if (args.length === 0) {
        const items = this.bot.inventory.items();
        this.bot.chat(items.map((x) => `${x.name}*${x.count}`).join(', '));
        logInfo(items.map((x) => `${x.name}[${x.slot}]:${x.count}`).join(', '));
      } else if (args[0] === 'toss') {
        await this.tossStack(args[1]);
      } else if (args[0] === 'equip') {
        await this.equip(args[1], args[2]);
      } else if (args[0] === 'unequip') {
        await this.unequip(args[1]);
      }
    } catch (err) {
      this.bot.chat(err.message);
      logError(err);
    }
  }
}

module.exports = Inventory;
