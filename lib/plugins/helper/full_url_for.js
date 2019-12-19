'use strict';

module.exports = ctx => function(path) {
  return ctx.utils.full_url_for(path);
};
