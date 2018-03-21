'use strict';

const {join, dirname} = require('path');
const compose = require('compose-function');
const sequence = require('promise-compose');
const {keys, entries, assign} = Object;

const {joi, getLog} = require('../lib/options');
const {assertContext, assertInLayer} = require('../lib/types/assert');
const {indent} = require('../lib/string');
const {testIsFile, testIsDir, MkDirOp, CleanOp, SymLinkOp, CopyOp, WriteOp} = require('../lib/fs');
const {withLog, lens, mapSerial, mapParallel, constant} = require('../lib/promise');

const mergeUndos = ([{undo, ...layer}, ...rest]) => (undos) => ([
  assign({undo: sequence(...undos, undo)}, layer),
  ...rest
]);

const getOperations = ({root, log}) => mapParallel(
  ([srcPath, destPath]) => {
    switch (true) {
      case (srcPath === null):
        return (destPath === root) ?
          [] :
          [new MkDirOp({path: destPath, log}), new CleanOp({path: destPath, log})];

      case (typeof srcPath === 'string'):
        if (destPath.startsWith(root)) {
          return Promise.all([testIsFile(srcPath), testIsDir(srcPath)])
            .then(([isSrcFile, isSrcDir]) =>
              isSrcDir ? new SymLinkOp({srcPath, destPath, log}) :
                isSrcFile ? new CopyOp({srcPath, destPath, log}) :
                  new WriteOp({content: srcPath, destPath, log})
            )
            .then((op) => {
              const destDir = dirname(destPath);
              return (destDir === root) ?
                op :
                [new MkDirOp({path: destDir, log}), op];
            });
        } else {
          throw new Error(`Given path is outside the root: "${destPath}"`);
        }

      default:
        throw new Error(`Expected key to be null|string, saw ${typeof srcPath}`);
    }
  }
);

const flatten = (array) =>
  array.reduce((r, element) => r.concat(element), []);

const reverse = (array) =>
  [...array].reverse();

exports.schema = {
  debug: joi.debug().optional()
};

exports.create = (options) => {
  joi.assert(
    options,
    joi.object(assign({}, exports.schema, {
      root: joi.path().absolute().required(),
      onActivity: joi.func().required()
    })).unknown(true).required(),
    'options'
  );

  const {debug, root, onActivity} = options;
  const log = getLog(debug);
  const labelled = withLog(log);

  /**
   * Given a command the method will execute in shell and resolve the results, discarding layers.
   *
   * @param {string} command A shell command
   * @return {function(Array):Array} A pure function of layers
   */
  return (hash) => {

    // check the keys are simple filepaths
    joi.assert(
      keys(hash),
      joi.array().items(
        joi.path().relative().required()
      ).required(),
      'single hash of path:content'
    );

    return compose(labelled('fs'), sequence)(
      onActivity,
      assertContext('fs() needs a preceding init or is otherwise without context'),
      compose(lens('layers', 'layers'), sequence)(
        assertInLayer('fs() may only be used inside layer()'),
        compose(lens(null, mergeUndos), sequence)(
          constant(entries(hash).map(([k, v]) => [v, join(root, k)])),
          getOperations({root, log: compose(log, indent(2))}),
          flatten,
          mapSerial((op) => op.exec()),
          reverse,
          mapSerial((op) => () => op.undo())
        )
      )
    );
  };
};
