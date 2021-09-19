const Vec3 = require('vec3');
const mineflayer = require('mineflayer');
const { logInfo, logError } = require('../utils');
const { GoalBlock, GoalNear, GoalInvert } = require('../plugins/pathfinder/index').goals;

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
    //this.bot.on('breath', () => this.onOxygenChange(this.bot.oxygenLevel));
    this.bot._client.on('entity_metadata', x => this.onClientEntityMetadata(x));
  }

  readMemory(data) {
    this.enable = data.enable;
  }

  writeMemory() {
    return { enable: this.enable };
  }

  async chat(args, target) {
    if (args.length === 0) {
      if(!this.couldRun())
        this.bot.chat('could not run');
      else
        this.runAway();
    } else if (args[0] === 'on') {
      this.enable = true;
    } else if (args[0] === 'off') {
      this.enable = false;
    }
  }
  
  // ---
  
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
    this.bot.pathfinder.goto(goal)
        .then(res => this.onPathStop())
        .catch(err => this.onPathStop());
  }
  
  async runAway() {
    let pos = this.bot.entity.position;
    let goal = new GoalInvert(new GoalNear(pos.x, pos.y, pos.z, 7));
    this.run(goal);
  }
  
  async runToAir() {
    let airBlocks = this.bot.findBlocks({
      matching: this.mcData.blocksByName.air.id,
      maxDistance: 7,
      count: 64
    });
    
    let goal = null;
    for(let airBlock of airBlocks) {
      let blockAbove = this.bot.blockAt(new Vec3(airBlock.x, airBlock.y + 1, airBlock.z));
      let blockBelow = this.bot.blockAt(new Vec3(airBlock.x, airBlock.y - 1, airBlock.z));
      if(blockAbove && (blockAbove.name === 'air' || blockAbove.name.endsWith('_air'))
       && blockBelow && blockBelow.name !== 'water' && blockBelow.name !== 'lava') {
        goal = new GoalBlock(airBlock.x, airBlock.y, airBlock.z);
        let path = this.bot.pathfinder.getPathTo(this.bot.pathfinder.movements, goal, 1000);
        if(path.status === 'success' || path.status === 'partial')
          break;
        else
          goal = null;
      }
    }
    if(!goal) {
      // Nowhere to run to. nu blyat
      this.desperateRun = true;
      this.bot.chat('AAAAAA');
      
      let pos = this.bot.entity.position;
      goal = new GoalBlock(pos.x, 999, pos.z);
    }
    
    this.run(goal);
  }
  
  async onDeath() {
    if(this.running)
      this.bot.pathfinder.stop();
  }
  
  async onHealthChange(health) {
    if(!(this.couldRun() && health <= 5 && health > 0))
      return;
    
    this.bot.chat('HELP');
    this.runAway();
  }
  
  async onOxygenChange(oxygen) {
    let pos = this.bot.entity.position;
    let blockAbove = this.bot.blockAt(new Vec3(pos.x, pos.y + 1, pos.z));
    if(blockAbove.name !== 'water') {
      // If just floating desperately and found air, regain hope on life
      if(this.running && this.desperateRun && oxygen > 15)
        this.bot.pathfinder.stop();
      return;
    }
    
    if(!(this.couldRun() && oxygen < 10))
      return;
    
    this.bot.chat('HELP');
    this.runToAir();
  }
  
  async onMessage(msg, pos) {
    if(msg.translate
      && msg.translate.startsWith('death.')
      && msg.translate.endsWith('.player')
      && msg.with[0].insertion === this.bot.player.name)
      this.bot.chat('why you bulli me');
  }
  
  async onPathStop() {
    this.running = false;
    this.desperateRun = false;
  }
  
  async onClientEntityMetadata(packet) {
    if(this.bot.entity.id !== packet.entityId)
      return;
    
    for(let metadata of packet.metadata) {
      if(metadata.key === 1) {
        this.onOxygenChange(metadata.value / 15);
        break;
      }
    }
  }
}

module.exports = AutoRun;
