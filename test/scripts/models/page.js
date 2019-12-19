'use strict';

const sinon = require('sinon');
const pathFn = require('path');
const { full_url_for } = require('hexo-util');

describe('Page', () => {
  const Hexo = require('../../../lib/hexo');
  const hexo = new Hexo();
  const Page = hexo.model('Page');
  const after_init = require('../../../lib/plugins/filter/after_init');
  const applyConfigChange = () => after_init.call(hexo);

  before(() => hexo.init());

  it('default values', () => {
    const now = Date.now();

    return Page.insert({
      source: 'foo',
      path: 'bar'
    }).then(data => {
      data.title.should.eql('');
      data.date.valueOf().should.gte(now);
      data.updated.valueOf().should.gte(now);
      data.comments.should.be.true;
      data.layout.should.eql('page');
      data._content.should.eql('');
      data.raw.should.eql('');
      should.not.exist(data.content);
      should.not.exist(data.excerpt);
      should.not.exist(data.more);

      return Page.removeById(data._id);
    });
  });

  it('source - required', () => {
    const errorCallback = sinon.spy(err => {
      err.should.have.property('message', '`source` is required!');
    });

    return Page.insert({}).catch(errorCallback).finally(() => {
      errorCallback.calledOnce.should.be.true;
    });
  });

  it('path - required', () => {
    const errorCallback = sinon.spy(err => {
      err.should.have.property('message', '`path` is required!');
    });

    return Page.insert({
      source: 'foo'
    }).catch(errorCallback).finally(() => {
      errorCallback.calledOnce.should.be.true;
    });
  });

  it('permalink - virtual', () => Page.insert({
    source: 'foo',
    path: 'bar'
  }).then(data => {
    data.permalink.should.eql(hexo.config.url + '/' + data.path);
    return Page.removeById(data._id);
  }));

  it('permalink - trailing_index', () => {
    hexo.config.pretty_urls.trailing_index = false;
    applyConfigChange();
    return Page.insert({
      source: 'foo.md',
      path: 'bar/index.html'
    }).then(data => {
      data.permalink.should.eql(hexo.config.url + '/' + data.path.replace(/index\.html$/, ''));
      hexo.config.pretty_urls.trailing_index = true;
      applyConfigChange();
      return Page.removeById(data._id);
    });
  });

  it('permalink - trailing_html', () => {
    hexo.config.pretty_urls.trailing_html = false;
    applyConfigChange();
    return Page.insert({
      source: 'foo.md',
      path: 'bar/foo.html'
    }).then(data => {
      data.permalink.should.eql(hexo.config.url + '/' + data.path.replace(/\.html$/, ''));
      hexo.config.pretty_urls.trailing_html = true;
      applyConfigChange();
      return Page.removeById(data._id);
    });
  });

  it('permalink - trailing_html - index.html', () => {
    hexo.config.pretty_urls.trailing_html = false;
    applyConfigChange();
    return Page.insert({
      source: 'foo.md',
      path: 'bar/index.html'
    }).then(data => {
      data.permalink.should.eql(hexo.config.url + '/' + data.path);
      hexo.config.pretty_urls.trailing_html = true;
      applyConfigChange();
      return Page.removeById(data._id);
    });
  });

  it('permalink - should be encoded', () => {
    hexo.config.url = 'http://fôo.com';
    applyConfigChange();
    const path = 'bár';
    return Page.insert({
      source: 'foo',
      path
    }).then(data => {
      data.permalink.should.eql(full_url_for.call(hexo, data.path));
      hexo.config.url = 'http://yoursite.com';
      applyConfigChange();
      return Page.removeById(data._id);
    });
  });

  it('full_source - virtual', () => Page.insert({
    source: 'foo',
    path: 'bar'
  }).then(data => {
    data.full_source.should.eql(pathFn.join(hexo.source_dir, data.source));
    return Page.removeById(data._id);
  }));
});
