'use strict';

describe('url_for', () => {
  const Hexo = require('../../../lib/hexo');
  const hexo = new Hexo();
  const after_init = require('../../../lib/plugins/filter/after_init');
  const applyConfigChange = () => after_init.call(hexo);
  const ctx = {
    config: { url: 'https://example.com' },
    relative_url: require('../../../lib/plugins/helper/relative_url')
  };
  hexo.config = Object.assign(hexo.config, ctx.config);

  const urlFor = require('../../../lib/plugins/helper/url_for')(hexo).bind(ctx);

  before(() => hexo.init());

  it('should encode path', () => {
    hexo.config.root = '/';
    applyConfigChange();
    urlFor('fôo.html').should.eql('/f%C3%B4o.html');

    hexo.config.root = '/fôo/';
    applyConfigChange();
    urlFor('bár.html').should.eql('/f%C3%B4o/b%C3%A1r.html');
  });

  it('internal url (relative off)', () => {
    hexo.config.root = '/';
    applyConfigChange();
    urlFor('index.html').should.eql('/index.html');
    urlFor('/').should.eql('/');
    urlFor('/index.html').should.eql('/index.html');

    hexo.config.root = '/blog/';
    applyConfigChange();
    urlFor('index.html').should.eql('/blog/index.html');
    urlFor('/').should.eql('/blog/');
    urlFor('/index.html').should.eql('/blog/index.html');
  });

  it('internal url (relative on)', () => {
    hexo.config.relative_link = true;
    hexo.config.root = '/';
    applyConfigChange();

    ctx.path = '';
    urlFor('index.html').should.eql('index.html');

    ctx.path = 'foo/bar/';
    urlFor('index.html').should.eql('../../index.html');

    hexo.config.relative_link = false;
    applyConfigChange();
  });

  it('internal url (options.relative)', () => {
    ctx.path = '';
    urlFor('index.html', {relative: true}).should.eql('index.html');

    ctx.config.relative_link = true;
    urlFor('index.html', {relative: false}).should.eql('/index.html');
    ctx.config.relative_link = false;
  });

  it('internel url (pretty_urls.trailing_index disabled)', () => {
    hexo.config.pretty_urls = { trailing_index: false };
    hexo.config.root = '/';
    applyConfigChange();
    ctx.path = '';
    urlFor('index.html').should.eql('/');
    urlFor('/index.html').should.eql('/');

    hexo.config.root = '/blog/';
    applyConfigChange();
    urlFor('index.html').should.eql('/blog/');
    urlFor('/index.html').should.eql('/blog/');
  });

  it('external url', () => {
    [
      'https://hexo.io/',
      '//google.com/',
      // 'index.html' in external link should not be removed
      '//google.com/index.html'
    ].forEach(url => {
      urlFor(url).should.eql(url);
    });
  });

  it('only hash', () => {
    urlFor('#test').should.eql('#test');
  });
});
