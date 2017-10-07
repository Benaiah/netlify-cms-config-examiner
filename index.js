const fs = require('fs');
const { inspect, promisify } = require('util');
const yaml = require('js-yaml');
const chalk = require('chalk');
const {
  allPass, always, anyPass, both, call, chain, cond, curry, concat,
  equals, flatten, flip, gt, has, join, keys, length, lensIndex,
  lensProp, map, merge, mergeAll, not, over, pathOr, pipe, prop,
  propEq, reduce, set, split, T, tap, view,
} = require('ramda');

const { run } = require('./rules.js')
const configRules = require('./configRules.js');
const runConfigRules = run(configRules);

const examine = (config, path=[]) => {
  const rulesResults = runConfigRules(config, path);
  
  return flatten([...rulesResults, ...map(propName => examine(config[propName], [...path, propName]), keys(config))]);
};

const printLogsForTerminal = pipe(
  map(({ name, path, message, type }) =>
    [type, `root${ path.length > 0 ? "." + path.join('.') : '' }/${ name }`, message]
  ),
  logs => {
    const maxPathLength = pipe(
      map(arr => arr[1]),
      reduce((length, str) => (str.length > length ? str.length : length), 0),
    )(logs);
    
    return map(
      ([type, path, message]) => [type, path, '\n'+message],
      logs,
    );
  },
  map(([type, path, message]) => {
    const color = cond([
      [equals('success'), () => 'green'],
      [equals('error'), () => 'red'],
      [equals('warning'), () => 'yellow'],
      [T, () => 'white']
    ])(type);
    return `${chalk.keyword(color)(path)}${message}`
  }),
  join('\n\n')
);

const readFile = promisify(fs.readFile);
const configPromise = readFile("../netlify-cms/example/config.yml", { encoding: 'utf8' })
  .then(yaml.safeLoad)
  .then(examine)
  .then(printLogsForTerminal)
  .then(console.log)
  .catch(console.error);
