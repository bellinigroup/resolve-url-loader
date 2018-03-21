'use strict';

const {promisify} = require('util');
const mkdirp = promisify(require('mkdirp'));
const compose = require('compose-function');
const sequence = require('promise-compose');
const {assign} = Object;

const {joi, getLog} = require('../lib/options');
const {assertContext, assertOutLayer} = require('../lib/types/assert');
const {withLog, lens, doFirst, doLast} = require('../lib/promise');

const createLayer = () => ({
  undo: () => Promise.resolve(),
  isSealed: false
});

const sealLayer = (layer) => assign({}, layer, {
  isSealed: true
});

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
   * A simple lens into layers that creates a new layer.
   *
   * @type {function(...function):Promise} A sequence monad
   */
  return compose(
    labelled('layer'),
    doFirst(
      onActivity,
      assertContext('layer() needs a preceding init or is otherwise without context'),
      compose(lens('layers', 'layers'), sequence)(
        assertOutLayer('layer() cannot be called within another layer()'),
        (layers) => ([createLayer(), ...layers])
      ),
      lens()(() => mkdirp(root))
    ),
    doLast(
      lens('layers', 'layers')(([layer, ...layers]) => ([sealLayer(layer), ...layers]))
    ),
    sequence
  );
};
