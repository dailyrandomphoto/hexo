'use strict';

describe('feed_tag', () => {
  const Hexo = require('../../../lib/hexo');
  const hexo = new Hexo(__dirname);

  const ctx = {
    config: hexo.config
  };

  ctx.url_for = require('../../../lib/plugins/helper/url_for')(hexo);

  const feed = require('../../../lib/plugins/helper/feed_tag').bind(ctx);

  before(() => hexo.init());

  it('path', () => {
    feed('atom.xml').should.eql('<link rel="alternate" href="/atom.xml" title="Hexo">');
  });

  it('title', () => {
    feed('atom.xml', {title: 'RSS Feed'}).should.eql('<link rel="alternate" href="/atom.xml" title="RSS Feed">');
  });

  it('type', () => {
    feed('rss.xml', {type: 'rss'}).should.eql('<link rel="alternate" href="/rss.xml" title="Hexo">');
  });
});
