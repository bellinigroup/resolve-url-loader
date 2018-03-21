'use strict';

const {joi} = require('../options');

const {layer} = require('./layer');
const {exec} = require('./exec');

exports.context = joi.object({
  test: joi.test().instanceofTape().required(),
  layers: joi.array().items(layer.optional()).required(),
  exec: exec.optional()
}).unknown(false);
