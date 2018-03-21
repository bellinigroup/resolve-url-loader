'use strict';

const repeat = require('repeat-element');
const {joi} = require('../options');
const {context} = require('./context');
const {exec} = require('./exec');
const {layer, sealedLayer, unsealedLayer} = require('./layer');

const assertSchema = (schema) => {
  joi.assert(schema, joi.object().schema());

  return (title) => (v) => {
    try {
      joi.assert(v, schema.required());
    } catch (_) {
      throw new Error(title);
    }
    return v;
  };
};

exports.assertTape = assertSchema(
  joi.test().instanceofTape()
);

exports.assertContext = assertSchema(context);

exports.assertExec = assertSchema(exec);

exports.assertInLayer = assertSchema(
  joi.array().ordered(
    unsealedLayer.required(),
    ...repeat(sealedLayer.optional(), 30)
  )
);

exports.assertOutLayer = assertSchema(
  joi.array().items(sealedLayer.optional())
);

exports.assertLayers = assertSchema(
  joi.array().items(layer).min(1)
);
