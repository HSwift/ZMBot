const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const { GoalNear } = require('../plugins/pathfinder/index').goals;
const { logInfo } = require('../utils');

class StoreKeeper {
  /**
   *
   * @param {mineflayer.Bot} bot
   */
  constructor(bot) {
    this.bot = bot;
    this.enable = true;
    this.prefix = 'store';
    this.path = [];
    this.similarTypes = new Map();
    this.typesToChest = new Map();
    this.scannedChests = new Set();
    this.knownTypes = new Set();
    this.unavailable = [];
    this.mcData = null;
  }

  init() {
    this.mcData = this.bot.mcData;
  }

  readMemory(data) {
    this.similarTypes = data.similarTypes;
    this.typesToChest = data.typesToChest;
    this.knownTypes = data.knownTypes;
    this.unavailable = data.unavailable;
    this.path = data.path;
  }

  writeMemory() {
    return {
      path: this.path,
      similarTypes: this.similarTypes,
      typesToChest: this.typesToChest,
      knownTypes: this.knownTypes,
      unavailable: this.unavailable,
    };
  }

  setItemId(itemId, chestPos) {
    if (!this.typesToChest.has(itemId)) this.typesToChest.set(itemId, new Set());
    this.typesToChest.get(itemId).add(chestPos.toString());
  }

  deleteItemId(itemId) {
    return this.typesToChest.delete(itemId);
  }

  deleteChest(chestPos) {
    let deleteCount = 0;
    for (const [itemId, chestSet] of this.typesToChest) {
      chestSet.delete(chestPos.toString()) && deleteCount++;
    }
    return deleteCount;
  }

  chestAvailable(pos) {
    for (const i of this.unavailable) {
      if (i[0] === pos.x && i[1] === pos.y && i[2] === pos.z) return false;
    }
    return true;
  }

  async scanOneChest(chestPos) {
    const chestToOpen = this.bot.blockAt(chestPos);
    const chest = await this.bot.openChest(chestToOpen);
    const chestType = new Set(chest.containerItems().map((item) => item.type));
    chest.close();

    chest.containerItems().forEach((item) => this.knownTypes.add(item.name));
    chestType.forEach((itemId) => {
      this.setItemId(itemId, chestPos);
    });
  }

  async scanChests() {
    const posArray = this.bot.findBlocks({
      matching: this.mcData.blocksByName.chest.id,
      maxDistance: 6,
      count: 100,
    });
    this.path.push(this.bot.entity.position.toArray());

    for (const pos of posArray) {
      if (this.scannedChests.has(pos.toString())) continue;
      if (!this.chestAvailable(pos)) continue;

      this.scannedChests.add(pos.toString());
      await this.scanOneChest(pos);
    }
  }

  async scanAllChests(checkPoints) {
    for (const point of checkPoints) {
      await this.bot.pathfinder.goto(
        new GoalNear(point[0], point[1], point[2], 2),
      );
      await this.scanChests();
    }
  }

  async rearrange() {
    const items = this.bot.inventory.items();
    const itemTypes = new Set(items.map((x) => x.type));

    for (const itemId of itemTypes) {
      const itemName = this.mcData.items[itemId].name;
      if (this.bot.foodToEat.includes(itemName)) continue;

      let chestPosSet = this.typesToChest.get(itemId);
      const similarItemId = this.matchSimilarTypes(itemName);
      const similarChestPosSet = this.typesToChest.get(similarItemId);
      if (chestPosSet === undefined && similarChestPosSet === undefined) {
        logInfo(`unknown item type ${itemName}`);
        continue;
      }
      if (chestPosSet === undefined) {
        chestPosSet = similarChestPosSet;
      }
      for (const chestPos of chestPosSet) {
        const bestPos = this.getNearestChest(Vec3(chestPos));
        await this.bot.pathfinder.goto(
          new GoalNear(bestPos.x, bestPos.y, bestPos.z, 2),
        );
        const result = await this.putToChest(itemId, Vec3(chestPos));
        if (result) break;
        logInfo(`chest ${chestPos} full`);
      }
    }
  }

  matchSimilarTypes(itemName) {
    for (const [similarName, id] of this.similarTypes) {
      if (itemName.includes(similarName)) return id;
    }
    return -1;
  }

  getNearestChest(chestPos) {
    let nearestChest = null;
    let minimumDistance = 999999;
    for (const point of this.path) {
      if (Vec3(point).distanceTo(chestPos) < minimumDistance) {
        minimumDistance = Vec3(point).distanceTo(chestPos);
        nearestChest = Vec3(point);
      }
    }
    return nearestChest;
  }

  async putToChest(itemId, chestPos) {
    const chestToOpen = this.bot.blockAt(chestPos);
    const chest = await this.bot.openChest(chestToOpen);
    const count = chest.count(itemId);
    const itemName = this.mcData.items[itemId].name;
    const depositingLog = `depositing ${itemName}(${count}) to ${chestPos} `;
    try {
      await chest.deposit(itemId, null, count);
      logInfo(`${depositingLog}success`);
      chest.close();
      return true;
    } catch (err) {
      logInfo(depositingLog + err.message);
      chest.close();
    }
    return false;
  }

  async chat(args, target) {
    if (args.length === 0) return;
    if (args[0] === 'scanAll') {
      if (!this.bot.wayPoints.has('store')) {
        this.bot.chat('store path not set');
      } else {
        const path = this.bot.wayPoints.get('store');
        await this.scanAllChests(path);
        this.bot.chat('scan all chests done');
      }
    } else if (args[0] === 'scanHere') {
      this.scannedChests.clear();
      await this.scanChests();
      this.bot.chat('scan chests done');
    } else if (args[0] === 'rearrange') {
      await this.rearrange();
      this.bot.chat('rearrange done');
    } else if (args[0] === 'types') {
      logInfo('knownTypes');
      console.log(this.knownTypes);
    } else if (args[0] === 'clear') {
      this.typesToChest = new Map();
      this.scannedChests = new Set();
      this.knownTypes = new Set();
      this.path.clear();
    } else if (args[0] === 'path') {
      logInfo('store path');
      console.log(this.path);
    } else if (args[0] === 'sub' && args.length === 3) {
      const similarName = args[1];
      const similarId = parseInt(args[2], 10);
      this.similarTypes.set(similarName, similarId);
    } else if (args[0] === 'set' && args.length === 5) {
      const itemName = args[1];
      const chestPos = Vec3(args[2], args[3], args[4]);
      const chestBlock = this.bot.blockAt(chestPos);
      const item = this.mcData.itemsByName[itemName];
      if (chestBlock.name === 'chest' && item !== undefined) {
        this.setItemId(item.id, chestPos);
      } else {
        this.bot.chat('item id or chest position incorrect');
      }
    } else if (args[0] === 'del') {
      if (args.length === 2) {
        const itemName = args[1];
        const item = this.mcData.itemsByName[itemName];
        if (item === undefined) {
          this.bot.chat(`item name ${itemName} incorrect`);
        } else {
          this.deleteItemId(item.id)
            ? this.bot.chat('success')
            : this.bot.chat('error');
        }
      } else if (args.length === 4) {
        const chestPos = Vec3(args[1], args[2], args[3]);
        const chestBlock = this.bot.blockAt(chestPos);
        if (chestBlock.name === 'chest') {
          const deleteCount = this.deleteChest(chestPos);
          this.bot.chat(`affected ${deleteCount} types`);
        }
      }
    } else if (args[0] === 'locate' && args[1] !== undefined) {
      const item = this.mcData.itemsByName[args[1]];
      if (item === undefined) {
        this.bot.chat(`item name ${args[1]} incorrect`);
      } else {
        const itemId = item.id;
        const chestPos = this.typesToChest.get(itemId);
        if (chestPos === undefined) {
          this.bot.chat(`unable locate item ${args[1]}`);
        } else {
          const chestPosStr = Array.from(chestPos.values())[0].toString();
          this.bot.chat(`${item.name}[${item.id}] ${chestPosStr}`);
        }
      }
    }
  }
}

module.exports = StoreKeeper;
