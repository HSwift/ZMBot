/* eslint-disable global-require */
const moduleClass = {
  AutoEat: require('./modules/autoEat'),
  AutoSleep: require('./modules/autoSleep'),
  wayPoint: require('./modules/wayPoint'),
  StoreKeeper: require('./modules/storeKeeper'),
  Storage: require('./modules/storage'),
  Info: require('./modules/info'),
  Movement: require('./modules/movement'),
  Inventory: require('./modules/inventory'),
  AutoRun: require('./modules/autoRun'),
  LeverExecutor: require('./modules/LeverExecutor'),
};

function loader(bot) { // you can get module with modules[name]
  const modules = {};
  for (const [name, Module] of Object.entries(moduleClass)) {
    modules[name] = new Module(bot);
  }
  modules.map = (x) => Object.values(modules).map(x);
  modules.keys = () => Object.keys(modules);
  modules.values = () => Object.values(modules);
  modules[Symbol.iterator] = function* iterator() {
    for (const module of modules.values()) {
      yield module;
    }
  };
  return modules;
}

module.exports = loader;
