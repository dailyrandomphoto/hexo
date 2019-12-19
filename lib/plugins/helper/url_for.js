'use strict';

module.exports = ctx => function(path, options) {
  return ctx.utils.url_for.call(this, path, options);
};
