'use strict';

const {readdirSync} = require('fs');
const {join} = require('path');
const {assign} = Object;

// handle these events unless somebody else does
['uncaughtException', 'unhandledRejection'].forEach((event) => {
  process.on(event, (error) => {
    if (process.listenerCount(event) === 1) {
      console.error(error);
    }
  });
});

// export create() function of each operation
module.exports = readdirSync(join(__dirname, 'operations'))
  .reduce((exports, v) => {
    const name = v.slice(0, -3);
    return assign(exports, {
      [name]: require(`./operations/${name}`).create
    });
  }, {});
