const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const { GoalNear, GoalNearXZ } = require('../plugins/pathfinder/index').goals;
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
      if (i[0] === pos.x && i[1] === pos.y && i[2] === pos.z) {
        logInfo('chest unavailable', pos);
        return false;
      }
    }
    return true;
  }

  async scanOneChest(chestPos) {
    const chestToOpen = this.bot.blockAt(chestPos);
    logInfo('open chest', chestPos);
    const chest = await this.bot.openContainer(chestToOpen);
    const chestType = new Set(chest.containerItems().map((item) => item.type));
    await chest.close();

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
    const currentPos = this.bot.entity.position.floor();
    const bestPos = this.getNearestChest(currentPos);
    if (bestPos === null || bestPos.distanceTo(currentPos) > 3) {
      this.path.push(currentPos.toArray());
    }

    for (const pos of posArray) {
      if (this.scannedChests.has(pos.toString())) continue;
      if (!this.chestAvailable(pos)) continue;

      this.scannedChests.add(pos.toString());
      await this.scanOneChest(pos);
    }
  }

  async scanAllChests(checkPoints) {
    for (const point of checkPoints) {
      console.log(point);
      await this.bot.pathfinder.goto(
        new GoalNear(point[0], point[1], point[2], 2),
      );
      await this.scanChests();
    }
  }

  async rearrange() {
    // eslint-disable-next-line max-len
    const items = this.bot.inventory.items();// === null ? true : (x.customName.text !== 'bot-tool')));

    // 初步处理背包，排除要单独放到toolbox的工具
    for (const item of items) {
      if (item.customName !== null) {
        console.log(`putting custom item: ${item.customName}`);
        const itemName = JSON.parse(item.customName).text;
        if (itemName === 'bot-tool') {
          this.bot.chat('I got my own tool, put it to my chest!');
          console.log(item.type);

          // 说明是工具，要单独放，就排除掉
          await this.bot.pathfinder.goto(
            new GoalNear(-9, 48, 8, 2),
          );
          this.bot.chat('I go to my chest');
          const result = await this.putToChest(item.type, Vec3(-9, 48, 8), 1);
          this.bot.chat(`put one bot-tool ${result ? 'success' : 'fail'}`);
        }
      }
    }
    const itemTypes = new Set(items.map((x) => x.type));
    let foodIgnored = false;

    // 循环背包所有物品
    for (const itemId of itemTypes) {
      // 物品名称
      const itemName = this.mcData.items[itemId].name;
      // 找到存放本物品ID的箱子们
      let chestPosSet = this.typesToChest.get(itemId);
      // 列出相似物品的ID
      const similarItemId = this.matchSimilarTypes(itemName);
      // 找到存放相似物品ID的箱子们
      const similarChestPosSet = this.typesToChest.get(similarItemId);
      let givenCount;

      console.log('rearrange', itemName);

      // 如果所在物品没有存放的箱子，则跳过
      if (chestPosSet === undefined && similarChestPosSet === undefined) {
        logInfo(`unknown item type ${itemName}`);
        continue;
      }
      if (chestPosSet === undefined) {
        chestPosSet = similarChestPosSet;
      }
      if (!foodIgnored && this.bot.foodToEat.includes(itemName)) {
        foodIgnored = true;
        const foodCount = this.bot.inventory.count(itemId);
        givenCount = foodCount > 64 ? foodCount - 64 : 0;
        if (givenCount === 0) continue;
      }
      for (const chestPos of chestPosSet) {
        const chestVec = Vec3(chestPos);
        const bestPos = this.getNearestChest(chestVec);
        if (bestPos === null) continue;
        await this.bot.pathfinder.goto(
          new GoalNear(bestPos.x, bestPos.y, bestPos.z, 2),
        );
        await this.bot.pathfinder.goto(
          new GoalNear(chestVec.x, bestPos.y, chestVec.z, 1),
        );
        if (itemName === 'end_portal_frame') {
          this.bot.chat('end_portal_frame found, game process +1 !!!');
        }
        const result = await this.putToChest(itemId, chestVec, givenCount);
        if (result) break;
        logInfo(`chest ${chestPos} full`);
        this.bot.chat(`chest ${chestPos} full`);
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

  async putToChest(itemId, chestPos, givenCount) {
    const chestToOpen = this.bot.blockAt(chestPos);
    const chest = await this.bot.openContainer(chestToOpen);
    let count = chest.count(itemId);
    if (givenCount !== undefined) {
      count = count < givenCount ? count : givenCount;
    }
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
    switch (args[0]) {
      case 'scanAll':
        if (!this.bot.wayPoints.has('store')) {
          this.bot.chat('store path not set');
        } else {
          const path = this.bot.wayPoints.get('store');
          await this.scanAllChests(path);
          this.bot.chat('scan all chests done');
        }
        break;
      case 'scanHere':
        this.scannedChests.clear();
        await this.scanChests();
        this.bot.chat('scan chests done');
        break;
      case 'rearrange':
        await this.rearrange();
        this.bot.chat('rearrange done');
        break;
      case 'types':
        logInfo('knownTypes');
        console.log(this.knownTypes);
        break;
      case 'clear':
        this.typesToChest = new Map();
        this.scannedChests = new Set();
        this.knownTypes = new Set();
        this.path = [];
        break;
      case 'path':
        logInfo('store path');
        console.log(this.path);
        break;
      case 'mask':
        if (args.length === 4) {
          const chestPos = [args[1], args[2], args[3]];
          const unavailablePos = chestPos.map((x) => parseInt(x, 10));
          this.unavailable.push(unavailablePos);
          logInfo('unavailable', chestPos);
        }
        break;
      case 'sub':
        if (args.length === 3) {
          const similarName = args[1];
          const similarId = parseInt(args[2], 10);
          this.similarTypes.set(similarName, similarId);
        }
        break;
      case 'set':
        if (args.length === 5) {
          const itemName = args[1];
          const chestPos = Vec3(args[2], args[3], args[4]);
          const chestBlock = this.bot.blockAt(chestPos);
          const item = this.mcData.itemsByName[itemName];
          if (chestBlock.name === 'chest' && item !== undefined) {
            this.setItemId(item.id, chestPos);
          } else {
            this.bot.chat('item id or chest position incorrect');
          }
        }
        break;
      case 'sethand':
        console.log(target);
        if (args.length === 4) {
          // eslint-disable-next-line max-len
          const item = target.equipment[0];
          const chestPos = Vec3(args[1], args[2], args[3]);
          if (item !== null) {
            this.setItemId(item.type, chestPos);
            this.bot.chat(`[storeKeeper] Successfully set your hand item ${item.name}(${item.type}) to chest ${chestPos.toString()}`);
          } else {
            this.bot.chat('Your hand seems has nothing');
          }
        }
        break;
      case 'del':
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
        break;
      case 'locate':
        if (args[1] !== undefined) {
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
        break;
      default:
        break;
    }
  }
}

module.exports = StoreKeeper;
