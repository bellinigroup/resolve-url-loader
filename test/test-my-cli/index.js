'use strict';

const {readdirSync} = require('fs');
const {join} = require('path');
const {sync: rimrafSync} = require('rimraf');
const {entries, assign} = Object;

const {joi, getLog} = require('./lib/options');
const {schema: multitonSchema, create: createMultiton} = require('./lib/multiton');

const multitons = {};

// handle these events unless somebody else does
['uncaughtException', 'unhandledRejection'].forEach((event) => {
  process.on(event, (error) => {
    if (process.listenerCount(event) === 1) {
      console.error(error);
    }
  });
});

/**
 * Create a set of operations with curried options.
 *
 * Operations each take an object that is passed through with additional state added in `field`.
 *
 * @param {object} options Options hash
 * @return {{layer:function, unlayer:function, fs:function, env:function, exec:function}} operations
 */
module.exports = (options) => {

  // import operations
  const operations = readdirSync(join(__dirname, 'operations'))
    .reduce((r, v) => {
      const name = v.slice(0, -3);
      return assign(r, {[name]: require(`./operations/${name}`)});
    }, {});

  // assert options
  joi.assert(
    options,
    joi.object(assign(
      {
        directory: joi.array().ordered(
          joi.path().directory().required(),
          joi.path().relative().required(),
          joi.path().relative().required()
        ).required(),
        debug: joi.debug().optional()
      },
      multitonSchema,
      ...entries(operations)
        .map(([k, {schema}]) => schema ? ({[k]: joi.object(schema).optional()}) : null)
        .filter(Boolean)
    )).unknown(false).required()
  );

  const {directory: [baseDir, tempDir, namedDir], ttl, field, debug} = options;
  const log = getLog(debug);

  const absTempDir = join(baseDir, tempDir);
  const absNamedDir = join(absTempDir, namedDir);

  log(`new instance "${absNamedDir}"`);

  // we will keep different multitons for each temp directory
  // when a multiton becomes empty we can remove the temp directory
  if (absTempDir in multitons) {
    log(`reuse multiton for path "${absTempDir}"`);
  } else {
    log(`create multiton for path "${absTempDir}"`);
    multitons[absTempDir] = createMultiton({
      onEmpty: () => {
        log(`empty: removing ${absTempDir}`);
        rimrafSync(absTempDir, {glob: false});
      }
    });
  }

  // when an instance disposes we can remove the temp directory
  const {register, deregister} = multitons[absTempDir];
  const instance = {
    ttl,
    dispose() {
      log(`dispose: removing ${absNamedDir}`);
      deregister(instance);
      rimrafSync(absNamedDir, {glob: false});
    }
  };
  const onActivity = register(instance);

  return assign(
    ...entries(operations).map(([k, {create}]) => {
      const opt = assign({debug}, options[k], {field, root: absNamedDir, onActivity});
      return {[k]: create(opt)};
    })
  );
};
