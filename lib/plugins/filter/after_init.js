'use strict';

module.exports = function() {
  const { full_url_for } = require('hexo-util');

  this.utils.full_url_for = full_url_for(this.config);
};
