const Vec3 = require('vec3');

class SortButton {
  /**
     *
     * @param {mineflayer.Bot} bot
     */
  constructor(bot) {
    this.bot = bot;
    this.prefix = 'button';
  }

  init() {
    this.bot.on('blockUpdate', async (oldBlock, newBlock) => {
      const availableButtons = [
        [15, 48, 8, '3'],
        [15, 49, 8, '1'],
        [15, 49, 11, '2'],
        [15, 48, 11, '4'],
      ];
      for (const t of availableButtons) {
        if (
          newBlock.position.x === t[0]
                    && newBlock.position.y === t[1]
                    && newBlock.position.z === t[2]) {
          if (newBlock.metadata === 12) {
            if (this.bot.pathfinder.isMoving()) {
              this.bot.chat('task running');
              return;
            }
            await this.bot.modules.Storage.loadFromStorage(t[3]);
            await this.bot.modules.StoreKeeper.rearrange();
            this.bot.chat('rearrange done');
          }
        }
      }
    });
  }
}

module.exports = SortButton;
