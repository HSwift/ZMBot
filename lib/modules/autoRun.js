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
      if (!this.couldRun()) {
        this.bot.chat('could not run');
      } else this.runAway();
    } else if (args[0] === 'on') {
      this.enable = true;
    } else if (args[0] === 'off') {
      this.enable = false;
    } else {
      const goal = this.parseGoal(args);
      if (goal) this.run(goal);
    }
  }

  // ---

  parseGoal(args) {
    const getInt = () => parseInt(args.shift(), 10);
    const getGoals = () => {
      const goals = [];
      for (let goal = this.parseGoal(args); args.length > 0 && goal; goal = this.parseGoal(args)) {
        goals.push(goal);
      }
      return goals;
    };

    // Here comes the big bois
    const type = args.shift();
    if (type === 'block') {
      return new GoalBlock(getInt(), getInt(), getInt());
    } else if (type === 'near') {
      return new GoalNear(getInt(), getInt(), getInt(), getInt());
    } else if (type === 'y') {
      return new GoalY(getInt());
    } else if (type === 'invert') {
      return new GoalInvert(this.parseGoal(args));
    } else if (type === 'any') {
      return new GoalCompositeAny(getGoals());
    } else if (type === 'all') {
      return new GoalCompositeAll(getGoals());
    } else if (type === 'stop') {
      this.bot.pathfinder.stop();
      this.bot.pathfinder.setGoal(null); // Force stop
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

  async run(goal) {
    this.running = true;
    try {
      await this.bot.pathfinder.goto(goal);
    } catch {
      // pass
    }
    this.onPathStop();
  }

  runAway() {
    const pos = this.bot.entity.position;
    const goal = new GoalInvert(new GoalNear(pos.x, pos.y, pos.z, 7));
    this.run(goal);
  }

  runToAir() {
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

    this.run(goal);
  }

  onDeath() {
    if (this.running) this.bot.pathfinder.stop();
  }

  onHealthChange(health) {
    if (!(this.couldRun() && health <= 5 && health > 0)) return;

    this.bot.chat('HELP');
    this.runAway();
  }

  onOxygenChange(oxygen) {
    const pos = this.bot.entity.position;
    const blockAbove = this.bot.blockAt(new Vec3(pos.x, pos.y + 1, pos.z));
    if (blockAbove.name !== 'water') {
      // If just floating desperately and found air, regain hope on life
      if (this.running && this.desperateRun && oxygen > 15) this.bot.pathfinder.stop();
      return;
    }

    if (!(this.couldRun() && oxygen < 10)) return;

    this.bot.chat('HELP');
    this.runToAir();
  }

  onMessage(msg, pos) {
    if (msg.translate
      && msg.translate.startsWith('death.')
      && msg.translate.endsWith('.player')
      && msg.with[0].insertion === this.bot.player.name) this.bot.chat('why you bulli me');
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
