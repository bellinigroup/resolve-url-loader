'use strict';

const compose = require('compose-function');
const sequence = require('promise-compose');
const {assign} = Object;

const {joi, getLog} = require('../lib/options');
const {assertContext, assertExec} = require('../lib/types/assert');
const {withLog, lens} = require('../lib/promise');

exports.schema = {
  debug: joi.debug().optional()
};

exports.create = (options) => {
  joi.assert(
    options,
    joi.object(assign({}, exports.schema, {
      onActivity: joi.func().required()
    })).unknown(true).required(),
    'options'
  );

  const {debug, onActivity} = options;
  const log = getLog(debug);
  const labelled = withLog(log);

  /**
   * A simple lens into the test and the result of the last exec().
   *
   * @type {function(...function(test, result):Promise):Promise} A sequence monad
   */
  return (...fns) => compose(labelled('assert'), sequence)(
    onActivity,
    assertContext('assert() needs a preceding init or is otherwise without context'),
    lens('exec', null)(assertExec('assert() needs a preceding exec()')),
    ...fns.map((fn) => lens(null, null)(({test, exec}) => fn(test, exec)))
  );
};
