const fs = require('fs').promises;
const path = require('path');
const Vec3 = require('vec3');

function replacer(key, value) {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()),
    };
  } if (value instanceof Set) {
    return {
      dataType: 'Set',
      value: Array.from(value),
    };
  } if (value instanceof Vec3.Vec3) {
    return {
      dataType: 'Vec3',
      value: value.toArray(),
    };
  }
  return value;
}

function reviver(key, value) {
  if (typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
    if (value.dataType === 'Set') {
      return new Set(value.value);
    }
    if (value.dataType === 'Vec3') {
      return Vec3(value.value);
    }
  }
  return value;
}

async function readMemory(instance) {
  if (instance.readMemory === undefined) return;
  const moduleName = instance.constructor.name;
  const memoryFile = path.join(process.cwd(), 'memory', `${moduleName}.json`);
  try {
    const data = await fs.readFile(memoryFile);
    instance.readMemory(JSON.parse(data, reviver));
  } catch (err) {
    if (err.message.startsWith('ENOENT:')) {
      await fs.touch(memoryFile);
    } else {
      throw err;
    }
  }
}

async function writeMemory(instance) {
  if (instance.writeMemory === undefined) return;
  const moduleName = instance.constructor.name;
  const memoryFile = path.join(process.cwd(), 'memory', `${moduleName}.json`);
  try {
    const data = JSON.stringify(instance.writeMemory(), replacer);
    await fs.writeFile(memoryFile, data);
  } catch (err) {
    console.log(err);
  }
}

async function checkMemoryWritable() {
  const memoryDir = path.join(process.cwd(), 'memory');
  try {
    await fs.access(memoryDir);
  } catch (err) {
    if (err.message.startsWith('ENOENT:')) {
      await fs.mkdir(memoryDir);
    } else {
      throw err;
    }
  }
}

module.exports = { readMemory, writeMemory, checkMemoryWritable };
