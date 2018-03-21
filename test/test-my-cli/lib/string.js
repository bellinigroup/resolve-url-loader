'use strict';

exports.indent = (n) => (...lines) =>
  lines
    .map((line) => line
      .match(new RegExp(`.{1,${120 - n}}`, 'g'))
      .map((part, i) => ''.padStart(i ? (n + 2) : n) + part)
    )
    .reduce((line, parts) => line.concat(parts), [])
    .join('\n');
