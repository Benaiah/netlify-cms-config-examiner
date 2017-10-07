const { chain, curry, flip, has, merge} = require('ramda');

const run = curry((rules, config, path) => chain(rule => {
  if (!rule.match(config, path)) {
    return [];
  }
  if (rule.test(config, path)) {
    return { name: rule.name, path, type: 'success', message: rule.success(config, path) };
  }

  const message = rule.failure(config, path);
  const fix = !has('fix', rule) ? null : rule.fix(config, path);

  return { name: rule.name, path, type: rule.type, message, fix };
})(rules));

const error = flip(merge)({ type: 'error' });
const warning = flip(merge)({ type: 'warning' });

module.exports = {
  run,
  error,
  warning,
};
