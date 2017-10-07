const {
  allPass, always, anyPass, both, cond, curry, equals, gt, has, is,
  length, lt, map, match, not, pipe, prop, propEq, reduce, reduced,
  split, T, takeLast, tap, zip
} = require('ramda');

const rules = require('./rules.js');

const matchPatternsToPath = curry((patterns, path) => patterns.length === path.length && pipe(
  zip,
  reduce((result, [pattern, path]) => {
    if (!result) {
      return reduced(result);
    }

    if (is(RegExp, pattern)) {
      return result && match(pattern, path);
    }

    if (pattern === "*") {
      return result && true;
    }

    return result && equals(pattern, path);
  }, true),
)(patterns, path));

const test = {
  atPath: path => (config, currentPath) => equals(path, currentPath),
  pathEndsWith: path => (config, currentPath) => endsWith(path, currentPath),
  hasPath: path => config => !!pathOr(false, path, config),
  matchPath: patterns => (config, path) => matchPatternsToPath(patterns, path),
  pathEndsWithMatch: patterns => (config, path) => matchPatternsToPath(patterns, takeLast(patterns.length, path)),
};

const backendExists = rules.error({
  name: 'backendExists',
  match: test.atPath([]),
  test: has('backend'),
  failure: () => 'The config should have backend settings!',
  fix: obj => set(lensProp('backend'), { name: '<backend-type>', repo: '<your-username/your-repo>' }, obj),
  success: () => 'Config has backend settings.',
});

const backendTypeSupported = rules.error({
  name: 'backendTypeSupported',
  match: test.atPath(['backend']),
  test: both(
    has('name'),
    obj => ['git-gateway', 'github', 'test-repo'].includes(obj.name)
  ),
  failure: obj => `"${obj.name}" is not a supported backend!`,
  success: obj => `"${obj.name}" is a supported backend.`,
});

const validateGithubBackend = rules.error({
  name: 'validateGithubBackend',
  match: allPass([
    test.atPath(['backend']),
    has('name'),
    propEq('name', 'github'),
  ]),
  test: both(
    has('repo'),
    pipe(prop('repo'), split('/'), length, equals(2))
  ),
  failure: obj => `${
    has('repo', obj)
      ? `"${obj.repo}" is not a valid repo name.`
      : 'The GitHub backend requires a "repo" setting.'
  }`,
  success: obj => `Repo name is present, and "${obj.repo}" is a valid repo name.'` 
});

const containsNetlifyDomain = str => str.indexOf("netlify.com") !== -1

const unnecessaryDomainSettings = ['api_root', 'site_domain', 'base_url'];
const noUnnecessaryDomainSettings = rules.warning({
  name: 'noUnnecessaryDomainSettings',
  match: allPass([
    test.atPath(['backend']),
    anyPass(map(has, unnecessaryDomainSettings)),
  ]),
  test: anyPass(map(
    key => both(has(key), pipe(prop(key), containsNetlifyDomain, not)),
    unnecessaryDomainSettings,
  )),
  failure: always('You don\'t need to set "api_root", "site_domain", or "base_url" if you\'re hosting on Netlify.'),
  success: always('No unnecessary domain settings set.'),
});

const hasAtLeastOneCollection = rules.error({
  name: 'hasAtLeastOneCollection',
  match: test.atPath([]),
  test: allPass([
    has('collections'),
    o => console.log(pipe(prop('collections'), length))|| true,
    pipe(prop('collections'), length, lt(0)),
  ]),
    failure: always('There are no "collections" defined!'),
  success: always('There is at least one collection defined.'),
});

const requiredCollectionProps = ['name', 'label'];
const collectionHasRequiredProps = rules.error({
  name: 'collectionHasRequiredProps',
  match: test.matchPath(['collections', '*']),
  test: allPass(map(has, requiredCollectionProps)),
  failure: always(`Collection does not have required settings: ${requiredCollectionProps.join(", ")}!`),
  success: always(`Collection has required settings: ${requiredCollectionProps.join(", ")}.`),
});


const collectionIsFolderOrFilesCollection = rules.error({
  name: 'collectionIsFolderOrFilesCollection',
  match: test.matchPath(['collections', '*']),
  test: anyPass([
    both(has('files')),
    both(has('folder'), has('fields')),
  ]),
  failure: always('Collection should either have "folder" and "fields" settings or have a "files" setting!'),
  success: cond([
    [o => has('folder'), always("Collection is a folder-based collection.")],
    [o => has('files'), always("Collection is a files-based collection.")],
  ]),
});

const requiredFieldProps = ['name', 'label', 'widget'];
const fieldHasRequiredProps = rules.error({
  name: 'fieldHasRequiredProps',
  match: test.pathEndsWithMatch(['fields', '*']),
  test: allPass(map(has, requiredFieldProps)),
  failure: always(`Field is missing one of its required props: ${requiredFieldProps.join(', ')}!`),
  success: always(`Field has required props: ${requiredFieldProps.join(', ')}`),
});

const selectWidgetHasOptions = rules.error({
  name: 'selectWidgetHasOptions',
  match: allPass([
    test.pathEndsWithMatch(['fields', '*']),
    propEq('widget', 'select'),
  ]),
  test: both(has('options'), pipe(prop('options'), is(Array))),
  failure: always('"select" widget does not have an "options" array!'),
  success: always('"select" widget has an "options" array.'),
})

module.exports = [
  backendExists,
  backendTypeSupported,
  validateGithubBackend,
  noUnnecessaryDomainSettings,
  hasAtLeastOneCollection,
  collectionHasRequiredProps,
  collectionIsFolderOrFilesCollection,
  fieldHasRequiredProps,
  selectWidgetHasOptions,
];
