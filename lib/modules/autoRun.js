/* eslint-disable no-else-return */
const Vec3 = require('vec3');
const mineflayer = require('mineflayer');
const {
  GoalBlock, GoalNear, GoalY, GoalInvert, GoalCompositeAny, GoalCompositeAll,
} = require('../plugins/pathfinder/index').goals;

class AutoRun {
  /**
   *
   * @param {mineflayer.Bot} bot
   */
  constructor(bot) {
    this.bot = bot;
    this.enable = true;
    this.prefix = 'run';
    this.mcData = null;

    this.running = false;
    this.desperateRun = false;
  }

  init() {
    this.mcData = this.bot.mcData;

    this.bot.on('death', () => this.onDeath());
    this.bot.on('health', () => this.onHealthChange(this.bot.health));
    this.bot.on('message', (x, y) => this.onMessage(x, y));
    this.bot.on('path_stop', () => this.onPathStop());

    // XXX: Buggy AF
    // https://github.com/PrismarineJS/mineflayer/blob/3.11.1/lib/plugins/breath.js
    // this.bot.on('breath', () => this.onOxygenChange(this.bot.oxygenLevel));
    this.bot._client.on('entity_metadata', (x) => this.onClientEntityMetadata(x));
  }

  readMemory(data) {
    this.enable = data.enable;
  }

  writeMemory() {
    return { enable: this.enable };
  }

  async chat(args, target) {
    if (args.length === 0) {
      const pos = this.bot.entity.position;
      const blockAbove = this.bot.blockAt(new Vec3(pos.x, pos.y + 1, pos.z));
      if (this.isWaterLike(blockAbove)) {
        await this.runToAir();
      } else {
        await this.runAway();
      }
    } else if (args[0] === 'on') {
      this.enable = true;
    } else if (args[0] === 'off') {
      this.enable = false;
    } else if (args[0] === 'stop') {
      this.bot.pathfinder.stop();
      this.bot.pathfinder.setGoal(null); // Force stop
    } else {
      const goal = this.parseGoal(args);
      if (goal) await this.run(goal);
    }
  }

  // ---

  parseGoal(args) {
    const getInt = () => {
      const val = parseInt(args.shift(), 10);
      if (isNaN(val)) { throw new Error('invalid integer'); }
      return val;
    }
    const getGoal = () => {
      const val = this.parseGoal(args);
      if (!val) { throw new Error('invalid sub goal'); }
      return val;
    };
    const getGoals = () => {
      const goals = [];
      for (let goal = this.parseGoal(args); args.length > 0 && goal; goal = this.parseGoal(args)) {
        goals.push(goal);
      }
      if (goals.length === 0) { throw new Error('empty goal set'); }
      return goals;
    };

    // Here comes the big bois
    try {
      const type = args.shift();
      if (type === 'block') {
        return new GoalBlock(getInt(), getInt(), getInt());
      } else if (type === 'near') {
        return new GoalNear(getInt(), getInt(), getInt(), getInt());
      } else if (type === 'y') {
        return new GoalY(getInt());
      } else if (type === 'invert') {
        return new GoalInvert(getGoal());
      } else if (type === 'any') {
        return new GoalCompositeAny(getGoals());
      } else if (type === 'all') {
        return new GoalCompositeAll(getGoals());
      }
    } catch (err) {
      this.bot.chat('invalid goal: ' + err.message);
    }
    return null;
  }

  couldRun() {
    return this.enable
      && !this.running
      && this.bot.pathfinder
      && !this.bot.pathfinder.isMoving()
      && !this.bot.pathfinder.isBuilding()
      && !this.bot.pathfinder.isMining();
  }

  isWaterLike(block) {
    // I know I know this is not the correct way to check for a waterlogged block
    // But this is how prismarine-physics deals with it, and there's no better way
    // Mineflayer really is not a good framework to work with
    const waterLikeBlocks = [
      'water', 'seagrass', 'tall_seagrass', 'kelp', 'bubble_column'
    ];
    return waterLikeBlocks.includes(block.name);
  }

  async run(goal) {
    this.running = true;
    try {
      await this.bot.pathfinder.goto(goal);
    } catch {
      // pass
    }
    this.onPathStop();
  }

  async runAway() {
    const pos = this.bot.entity.position;
    const goal = new GoalInvert(new GoalNear(pos.x, pos.y, pos.z, 7));
    await this.run(goal);
  }

  async runToAir() {
    const airBlocks = this.bot.findBlocks({
      matching: this.mcData.blocksByName.air.id,
      maxDistance: 7,
      count: 64,
    });

    let goal = null;
    for (const airBlock of airBlocks) {
      const blockAbove = this.bot.blockAt(new Vec3(airBlock.x, airBlock.y + 1, airBlock.z));
      const blockBelow = this.bot.blockAt(new Vec3(airBlock.x, airBlock.y - 1, airBlock.z));
      if (blockAbove && (blockAbove.name === 'air' || blockAbove.name.endsWith('_air')) && blockBelow && blockBelow.boundingBox === 'block') {
        goal = new GoalBlock(airBlock.x, airBlock.y, airBlock.z);
        const path = this.bot.pathfinder.getPathTo(this.bot.pathfinder.movements, goal, 1000);
        if (path.status === 'success' || path.status === 'partial') {
          break;
        } else {
          goal = null;
        }
      }
    }
    if (!goal) {
      // Nowhere to run to. nu blyat
      this.desperateRun = true;
      this.bot.chat('AAAAAA');
      goal = new GoalY(999);
    }

    await this.run(goal);
  }

  onDeath() {
    if (this.running) this.bot.pathfinder.stop();
  }

  async onHealthChange(health) {
    if (!(this.couldRun() && health <= 5 && health > 0)) return;

    this.bot.chat('HELP');
    await this.runAway();
  }

  async onOxygenChange(oxygen) {
    const pos = this.bot.entity.position;
    const blockAbove = this.bot.blockAt(new Vec3(pos.x, pos.y + 1, pos.z));
    if (blockAbove && !this.isWaterLike(blockAbove)) {
      // If just floating desperately and found air, regain hope on life
      if (this.running && this.desperateRun && oxygen >= 20) this.bot.pathfinder.stop();
      return;
    }

    if (!(this.couldRun() && oxygen < 10)) return;

    this.bot.chat('HELP');
    await this.runToAir();
  }

  onMessage(msg, pos) {
    if (msg.translate
      && msg.translate.startsWith('death.')
      && (msg.translate.endsWith('.player') || msg.translate.endsWith('.player.item'))
      && msg.with[0].insertion === this.bot.player.name
      && msg.with[1]?.hoverEvent?.contents?.type === 'minecraft:player') this.bot.chat('why you bulli me');
  }

  onPathStop() {
    // Clear the goal ASAP to prevent race condition on states
    this.bot.pathfinder.setGoal(null);

    this.running = false;
    this.desperateRun = false;
  }

  onClientEntityMetadata(packet) {
    if (this.bot.entity.id !== packet.entityId) return;

    for (const metadata of packet.metadata) {
      if (metadata.key === 1) {
        this.onOxygenChange(metadata.value / 15);
        break;
      }
    }
  }
}

module.exports = AutoRun;
