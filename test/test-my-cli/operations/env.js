'use strict';

const compose = require('compose-function');
const sequence = require('promise-compose');
const {assign} = Object;

const {joi, getLog} = require('../lib/options');
const {assertContext, assertInLayer} = require('../lib/types/assert');
const {indent} = require('../lib/string');
const {withLog, lens} = require('../lib/promise');

const system = process.env;

const defaultDelimiter = (process.platform === 'win32') ? ';' : ':';

exports.schema = {
  debug: joi.debug().optional(),
  append: joi.alternatives().try(
    joi.array().items(joi.string().required()),
    joi.object().pattern(/^[\w-]+$/, joi.alternatives().try(joi.bool(), joi.string()).required())
  ).optional()
};

exports.create = (options) => {
  joi.assert(
    options,
    joi.object(assign({}, exports.schema, {
      onActivity: joi.func().required()
    })).unknown(true).required(),
    'options'
  );

  const {debug, append = {}, onActivity} = options;
  const log = getLog(debug);
  const labelled = withLog(log);
  const logIndented = compose(log, indent(2));

  const delimiters = (Array.isArray(append) ? append : Object.keys(append))
    .reduce((r, k) => assign(r, {
      [k]: (typeof append[k] === 'string') ? append[k] : defaultDelimiter
    }), {});

  const merge = (k, current, previous) => {
    switch (true) {
      case (k in current) && (delimiters[k]) && (k in previous):
        return `${current[k]}${delimiters[k]}${previous[k]}`;

      case (k in current) && (delimiters[k]) && (k in system):
        return `${current[k]}${delimiters[k]}${system[k]}`;

      case (k in current):
        return current[k];

      case (k in previous):
        return previous[k];

      default:
        throw new Error('Reached an illegal state');
    }
  };

  /**
   * Given a hash of new ENV the method will merge this with ENV declared previously in this layer
   * or previous layers.
   *
   * @param {object} hash A hash of ENV values
   * @return {function(Array):Array} A pure function of layers
   */
  return (hash) => {
    joi.assert(
      hash,
      joi.object()
        .pattern(/^[\w-]+$/, joi.string().allow('').required())
        .unknown(false)
        .required(),
      'single hash of ENV:value'
    );

    return compose(labelled('env'), sequence)(
      onActivity,
      assertContext('env() needs a preceding init or is otherwise without context'),
      compose(lens('layers', 'layers'), sequence)(
        assertInLayer('env() may only be used inside layer()'),
        (layers) => {

          // we need to refer to the last env() in this layer, or failing that, previous layers
          const i = layers.findIndex(({env}) => !!env);
          const {env: previousGetter = () => ({})} = (i < 0) ? {} : layers[i];
          const previousLayerN = (i < 0) ? 0 : layers.length - i;

          // merge the current hash with previous values
          return Promise.resolve()
            .then(previousGetter)
            .then((previousHash) => {
              // merge the given hash with the previous one
              // we can calculate now since ENV is invariant
              const result = [...Object.keys(hash), ...Object.keys(previousHash)]
                .filter((v, i, a) => (a.indexOf(v) === i))
                .reduce((r, k) => assign(r, {[k]: merge(k, hash, previousHash)}), {});

              // remember that layers are backwards with most recent first
              logIndented(
                [`layer ${layers.length}`, previousLayerN && `layer ${previousLayerN}`]
                  .filter(Boolean).join(' -> '),
                JSON.stringify(hash),
                JSON.stringify(result)
              );

              const [layer, ...rest] = layers;
              return [assign({}, layer, {env: () => result}), ...rest];
            });
        }
      )
    );
  };
};
