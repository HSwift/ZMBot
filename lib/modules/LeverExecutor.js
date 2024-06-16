const Vec3 = require('vec3');

class LeverExecutor {
  /**
   *
   * @param {mineflayer.Bot} bot
   */
  constructor(bot) {
    this.bot = bot;
    this.prefix = 'lever';
    this.lastTime = 0;
  }

  init() {
    this.bot.on('blockUpdate', async (oldBlock, newBlock) => {
      if (newBlock.name === 'lever') {
        console.log(newBlock);
        const tmpBlock = this.bot.blockAt(
          new Vec3(newBlock.position.x, newBlock.position.y + 1, newBlock.position.z),
        );
        if (tmpBlock.name.endsWith('wall_sign')) {
          let txt = tmpBlock.signText.split("\n");
		if (txt[0] === '[ZMBot]') {
            const ts = Date.parse(new Date());
            if ((ts - this.lastTime) <= 5000) {
              return;
            }
            this.executeLeverCmd(txt);
          }
        }
      }
    });
  }

  executeLeverCmd(tmpBlock) {
    this.lastTime = Date.parse(new Date());
    const cmd = tmpBlock[1]
        + tmpBlock[2]
        + tmpBlock[3];
    if (cmd !== '') {
      const target = null;
      this.bot.chat(`executing ${cmd}`);
      for (const module of this.bot.modules.values()) {
        const args = cmd.split(' ');
        if (module.prefix === '') {
          module.chat(args, target);
        } else if (module.prefix === args[0]) {
          module.chat(args.splice(1), target);
        }
      }
    }
  }
}

module.exports = LeverExecutor;
