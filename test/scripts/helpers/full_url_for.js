'use strict';

describe('full_url_for', () => {
  const Hexo = require('../../../lib/hexo');
  const hexo = new Hexo();
  const after_init = require('../../../lib/plugins/filter/after_init');
  const applyConfigChange = () => after_init.call(hexo);
  const ctx = hexo;
  ctx.config.url = 'https://example.com';

  const fullUrlFor = require('../../../lib/plugins/helper/full_url_for')(hexo);

  before(() => hexo.init());

  it('no path input', () => {
    fullUrlFor().should.eql(ctx.config.url + '/');
  });

  it('internal url', () => {
    fullUrlFor('index.html').should.eql(ctx.config.url + '/index.html');
    fullUrlFor('/').should.eql(ctx.config.url + '/');
    fullUrlFor('/index.html').should.eql(ctx.config.url + '/index.html');
  });

  it('internel url (pretty_urls.trailing_index disabled)', () => {
    ctx.config.pretty_urls = { trailing_index: false };
    applyConfigChange();
    fullUrlFor('index.html').should.eql(ctx.config.url + '/');
    fullUrlFor('/index.html').should.eql(ctx.config.url + '/');
  });


  it('external url', () => {
    [
      'https://hexo.io/',
      '//google.com/',
      // 'index.html' in external link should not be removed
      '//google.com/index.html'
    ].forEach(url => {
      fullUrlFor(url).should.eql(url);
    });
  });

  it('only hash', () => {
    fullUrlFor('#test').should.eql(ctx.config.url + '/#test');
  });
});
