const mineflayer = require('mineflayer');
const { GoalNear, GoalFollow, GoalInvert } = require('../plugins/pathfinder/index').goals;
const { logInfo, logError } = require('../utils');

class Movement {
  /**
   *
   * @param {mineflayer.Bot} bot
   */
  constructor(bot) {
    this.bot = bot;
    this.prefix = '';
  }

  init() {
    this.bot.on('path_update', (r) => {
      const path = r.path.map((x) => x.hash);
      const { goal } = r.context;
      if(goal instanceof GoalInvert) {
        logInfo('path invert', goal.goal.x, goal.goal.y, goal.goal.z, ':', path.slice(0, 6).join(' '));
      } else {
        logInfo('path', goal.x, goal.y, goal.z, ':', path.slice(0, 6).join(' '));
      }
    });
    this.bot.on('goal_reached', (goal) => {
      if(goal instanceof GoalInvert) {
        logInfo('reached invert', goal.goal.x, goal.goal.y, goal.goal.z);
      } else {
        logInfo('reached', goal.x, goal.y, goal.z);
      }
    });
  }

  async chat(args, target) {
    if (args[0] === 'come') {
      if (!target) {
        this.bot.chat("can't see you");
        return;
      }
      if (this.bot.pathfinder.isMoving()) {
        this.bot.chat('task running');
        return;
      }
      const p = target.position;
      this.bot.pathfinder.setGoal(new GoalNear(p.x, p.y, p.z, 1));
    } else if (args[0] === 'follow') {
      if (!target) {
        this.bot.chat("can't see you");
        return;
      }
      if (this.bot.pathfinder.isMoving()) {
        this.bot.chat('task running');
      }
      this.bot.pathfinder.setGoal(new GoalFollow(target, 3), true);
    } else if (args[0] === 'stop') {
      this.bot.pathfinder.stop();
    }
  }
}

module.exports = Movement;
