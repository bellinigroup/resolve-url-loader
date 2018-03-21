'use strict';

const {joi} = require('../options');

exports.exec = joi.object({
  root: joi.path().absolute().required(),
  time: joi.number().positive().required(),
  code: joi.number().integer().required(),
  stdout: joi.string().allow('').required(),
  stderr: joi.string().allow('').required()
}).unknown(false);
