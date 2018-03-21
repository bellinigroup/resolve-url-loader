'use strict';

const compose = require('compose-function');
const sequence = require('promise-compose');
const {assign} = Object;

const {joi, getLog} = require('../lib/options');
const {assertContext, assertLayers, assertOutLayer} = require('../lib/types/assert');
const {withLog, lens, constant} = require('../lib/promise');

exports.schema = {
  debug: joi.debug().optional(),
  inhibit: joi.bool().optional()
};

exports.create = (options) => {
  joi.assert(
    options,
    joi.object(assign({}, exports.schema, {
      onActivity: joi.func().required()
    })).unknown(true).required(),
    'options'
  );

  const {debug, inhibit, onActivity} = options;
  const log = getLog(debug);
  const labelled = withLog(log);

  /**
   * Remove the topmost layer and undo its mutable effects.
   *
   * @type {function():Promise} A promise factory
   */
  return compose(labelled('unlayer'), sequence)(
    onActivity,
    assertContext('unlayer() needs a preceding init or is otherwise without context'),
    compose(lens('layers', 'layers'), sequence)(
      assertLayers('unlayer() needs a preceding layer()'),
      assertOutLayer('unlayer() cannot be called within layer()'),
      ([{undo}, ...layers]) => inhibit ? layers : undo().then(constant(layers))
    )
  );
};
