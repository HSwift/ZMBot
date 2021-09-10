const mineflayer = require('mineflayer');
const { GoalNear } = require('../plugins/pathfinder/index').goals;
const { logInfo } = require('../utils');

class WayPoint {
  /**
   *
   * @param {mineflayer.Bot} bot
   */
  constructor(bot) {
    this.bot = bot;
    this.wayPoints = new Map();
    this.currentTag = 'default';
    this.currentPath = [];
    this.targetPlayer = null;
    this.enable = true;
    this.prefix = 'waypoint';
    this.bot.wayPoints = this.wayPoints;
  }

  init() {
    this.bot.on('entityMoved', (entity) => {
      if (entity === this.targetPlayer) {
        const current = entity.position.floored();
        if (this.currentPath.length === 0) {
          this.currentPath.push(current);
        } else if (current.distanceTo(this.currentPath[this.currentPath.length - 1]) > 3) {
          this.currentPath.push(current);
        }
      }
    });
  }

  readMemory(data) {
    this.wayPoints = data.wayPoints;
    this.bot.wayPoints = this.wayPoints;
  }

  writeMemory() {
    return { wayPoints: this.wayPoints };
  }

  async play(tag = 'default') {
    const path = this.wayPoints.get(tag);
    if (path === undefined) {
      this.bot.chat('no path named', tag);
    } else {
      for (const point of path) {
        await this.bot.pathfinder.goto(new GoalNear(point[0], point[1], point[2], 1));
      }
      this.bot.chat('play waypoint done');
    }
  }

  async chat(args, target) {
    if (args.length === 0) {
      if (this.wayPoints.size === 0) {
        this.bot.chat('no way point set');
      } else {
        const tags = Array.from(this.wayPoints.keys()).join();
        this.bot.chat(tags);
      }
    } else if (args[0] === 'record') {
      if (args[1] === undefined) this.currentTag = 'default';
      else [, this.currentTag] = args;
      this.targetPlayer = target;
    } else if (args[0] === 'stop') {
      this.targetPlayer = null;
      const path = this.currentPath.map((x) => x.toArray());
      this.wayPoints.set(this.currentTag, [...path]);
      this.currentPath = [];
    } else if (args[0] === 'play') {
      this.play(args[1]);
    } else if (args[0] === 'add') {
      this.currentPath.push(target.position.floored().toArray());
    } else if (args[0] === 'save') {
      if (args[1] === undefined) this.currentTag = 'default';
      else [, this.currentTag] = args;
      this.wayPoints.set(this.currentTag, [...this.currentPath]);
      this.currentPath = [];
    } else if (args[0] === 'clear') {
      this.currentPath = [];
    } else if (this.wayPoints.has(args[0])) {
      logInfo(args[0]);
      console.log(this.wayPoints.get(args[0]));
    }
  }
}

module.exports = WayPoint;
