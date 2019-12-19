'use strict';

describe('favicon_tag', () => {
  const Hexo = require('../../../lib/hexo');
  const hexo = new Hexo(__dirname);

  const ctx = {
    config: hexo.config
  };

  ctx.url_for = require('../../../lib/plugins/helper/url_for')(hexo);

  const favicon = require('../../../lib/plugins/helper/favicon_tag').bind(ctx);

  before(() => hexo.init());

  it('path', () => {
    favicon('favicon.ico').should.eql('<link rel="shortcut icon" href="/favicon.ico">');
  });
});
