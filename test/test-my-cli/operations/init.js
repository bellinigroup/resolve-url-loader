'use strict';

const compose = require('compose-function');
const sequence = require('promise-compose');
const {assign} = Object;

const {joi, getLog} = require('../lib/options');
const {assertTape} = require('../lib/types/assert');
const {withLog} = require('../lib/promise');

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
   * A function that accepts a tape test and creates a test context (that includes the test).
   *
   * @param {string} name The name of the test
   * @param {function} fn The test function
   * @return {function(object):Promise} A pure async function of the outer test
   */
  return compose(labelled('init'), sequence)(
    onActivity,
    assertTape('init() expected tape Test instance, ensure init() occurs once as first item'),
    (test) => ({test, layers: []})
  );
};
