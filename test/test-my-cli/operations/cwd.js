'use strict';

const {join} = require('path');
const compose = require('compose-function');
const sequence = require('promise-compose');
const {assign} = Object;

const {joi, getLog} = require('../lib/options');
const {assertContext, assertInLayer} = require('../lib/types/assert');
const {indent} = require('../lib/string');
const {withLog, lens} = require('../lib/promise');

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
  const logIndented = compose(log, indent(2));

  /**
   * Given a directory the method will present this as the working directory.
   *
   * @param {string} directory A working directory
   * @return {function(Array):Array} A pure function of layers
   */
  return (directory) => {
    joi.assert(
      directory,
      joi.path().relative().required(),
      'single directory'
    );

    // we can calculate now since CWD is invariant
    const cwd = join(root, directory);

    return compose(labelled('cwd'), sequence)(
      onActivity,
      assertContext('cwd() needs a preceding init or is otherwise without context'),
      compose(lens('layers', 'layers'), sequence)(
        assertInLayer('cwd() may only be used inside layer()'),
        (layers) => {
          logIndented(
            `layer ${layers.length}`,
            JSON.stringify(cwd)
          );

          const [layer, ...rest] = layers;
          return [assign({}, layer, {cwd: () => cwd}), ...rest];
        }
      )
    );
  };
};
