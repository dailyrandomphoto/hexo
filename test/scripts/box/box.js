'use strict';

const pathFn = require('path');
const fs = require('hexo-fs');
const Promise = require('bluebird');
const util = require('hexo-util');
const sinon = require('sinon');
const Pattern = util.Pattern;

describe('Box', () => {
  const Hexo = require('../../../lib/hexo');
  const baseDir = pathFn.join(__dirname, 'box_tmp');
  const Box = require('../../../lib/box');

  function newBox(path, config) {
    const hexo = new Hexo(baseDir, {silent: true});
    hexo.config = Object.assign(hexo.config, config);
    const base = path ? pathFn.join(baseDir, path) : baseDir;
    return new Box(hexo, base);
  }

  before(() => fs.mkdir(baseDir));

  after(() => fs.rmdir(baseDir));

  it('constructor - add trailing "/" to the base path', () => {
    const box = newBox('foo');
    box.base.should.eql(pathFn.join(baseDir, 'foo') + pathFn.sep);
  });

  it('constructor - make ignore an array if its not one', () => {
    const box = newBox('foo', {ignore: 'fooDir'});
    box.ignore.should.eql(['fooDir']);
  });

  it('constructor - filter empty values in ignore', () => {
    const box = newBox('foo', {ignore: ['', null, undefined, 'fooDir']});
    box.ignore.should.eql(['fooDir']);
  });

  it('addProcessor() - no pattern', () => {
    const box = newBox();

    box.addProcessor(() => 'test');

    const p = box.processors[0];

    p.pattern.match('').should.eql({});
    p.process().should.eql('test');
  });

  it('addProcessor() - with regex', () => {
    const box = newBox();

    box.addProcessor(/^foo/, () => 'test');

    const p = box.processors[0];

    p.pattern.match('foobar').should.be.ok;
    p.pattern.should.be.an.instanceof(Pattern);
    p.process().should.eql('test');
  });

  it('addProcessor() - with pattern', () => {
    const box = newBox();

    box.addProcessor(new Pattern(/^foo/), () => 'test');

    const p = box.processors[0];

    p.pattern.match('foobar').should.be.ok;
    p.pattern.should.be.an.instanceof(Pattern);
    p.process().should.eql('test');
  });

  it('addProcessor() - no fn', () => {
    const box = newBox();
    const errorCallback = sinon.spy(err => {
      err.should.have.property('message', 'fn must be a function');
    });

    try {
      box.addProcessor('test');
    } catch (err) {
      errorCallback(err);
    }

    errorCallback.calledOnce.should.be.true;
  });

  it('process()', () => {
    const box = newBox('test');
    const data = {};

    box.addProcessor(file => {
      data[file.path] = file;
    });

    return Promise.all([
      fs.writeFile(pathFn.join(box.base, 'a.txt'), 'a'),
      fs.writeFile(pathFn.join(box.base, 'b', 'c.js'), 'c')
    ]).then(() => box.process()).then(() => {
      const keys = Object.keys(data);
      let key, item;

      for (let i = 0, len = keys.length; i < len; i++) {
        key = keys[i];
        item = data[key];

        item.path.should.eql(key);
        item.source.should.eql(pathFn.join(box.base, key));
        item.type.should.eql('create');
        item.params.should.eql({});
      }
    }).finally(() => fs.rmdir(box.base));
  });

  it('process() - do nothing if target does not exist', () => {
    const box = newBox('test');

    return box.process();
  });

  it('process() - create', () => {
    const box = newBox('test');
    const name = 'a.txt';
    const path = pathFn.join(box.base, name);

    const processor = sinon.spy();
    box.addProcessor(processor);

    return fs.writeFile(path, 'a').then(() => box.process()).then(() => {
      const file = processor.args[0][0];
      file.type.should.eql('create');
      file.path.should.eql(name);
    }).finally(() => fs.rmdir(box.base));
  });

  it('process() - update (mtime changed and hash changed)', () => {
    const box = newBox('test');
    const name = 'a.txt';
    const path = pathFn.join(box.base, name);
    const cacheId = 'test/' + name;

    const processor = sinon.spy();
    box.addProcessor(processor);

    return Promise.all([
      fs.writeFile(path, 'a'),
      box.Cache.insert({
        _id: cacheId,
        modified: 0,
        hash: util.hash('b').toString('hex')
      })
    ]).then(() => box.process()).then(() => {
      const file = processor.args[0][0];
      file.type.should.eql('update');
      file.path.should.eql(name);
    }).finally(() => fs.rmdir(box.base));
  });

  it('process() - skip (mtime changed but hash matched)', () => {
    const box = newBox('test');
    const name = 'a.txt';
    const path = pathFn.join(box.base, name);
    const cacheId = 'test/' + name;

    const processor = sinon.spy();
    box.addProcessor(processor);

    return fs.writeFile(path, 'a').then(() => fs.stat(path)).then(stats => box.Cache.insert({
      _id: cacheId,
      modified: 0,
      hash: util.hash('a').toString('hex')
    })).then(() => box.process()).then(() => {
      const file = processor.args[0][0];
      file.type.should.eql('skip');
      file.path.should.eql(name);
    }).finally(() => fs.rmdir(box.base));

  });

  it('process() - skip (hash changed but mtime matched)', () => {
    const box = newBox('test');
    const name = 'a.txt';
    const path = pathFn.join(box.base, name);
    const cacheId = 'test/' + name;

    const processor = sinon.spy();
    box.addProcessor(processor);

    return fs.writeFile(path, 'a').then(() => fs.stat(path)).then(stats => box.Cache.insert({
      _id: cacheId,
      modified: stats.mtime,
      hash: util.hash('b').toString('hex')
    })).then(() => box.process()).then(() => {
      const file = processor.args[0][0];
      file.type.should.eql('skip');
      file.path.should.eql(name);
    }).finally(() => fs.rmdir(box.base));
  });

  it('process() - skip (mtime matched and hash matched)', () => {
    const box = newBox('test');
    const name = 'a.txt';
    const path = pathFn.join(box.base, name);
    const cacheId = 'test/' + name;

    const processor = sinon.spy();
    box.addProcessor(processor);

    return fs.writeFile(path, 'a').then(() => fs.stat(path)).then(stats => box.Cache.insert({
      _id: cacheId,
      modified: stats.mtime,
      hash: util.hash('a').toString('hex')
    })).then(() => box.process()).then(() => {
      const file = processor.args[0][0];
      file.type.should.eql('skip');
      file.path.should.eql(name);
    }).finally(() => fs.rmdir(box.base));
  });

  it('process() - delete', () => {
    const box = newBox('test');
    const cacheId = 'test/a.txt';

    const processor = sinon.spy(file => {
      file.type.should.eql('delete');
    });

    box.addProcessor(processor);

    return Promise.all([
      fs.mkdirs(box.base),
      box.Cache.insert({
        _id: cacheId
      })
    ]).then(() => box.process()).then(() => {
      processor.calledOnce.should.be.true;
    }).finally(() => fs.rmdir(box.base));
  });

  it('process() - params', () => {
    const box = newBox('test');
    const path = pathFn.join(box.base, 'posts', '123456');

    const processor = sinon.spy(file => {
      file.params.id.should.eql('123456');
    });

    box.addProcessor('posts/:id', processor);

    return fs.writeFile(path, 'a').then(() => box.process()).then(() => {
      processor.calledOnce.should.be.true;
    }).finally(() => fs.rmdir(box.base));
  });

  const ignoreBadCases = [
    null,
    [null],
    [''],
    [null, 'bar']
  ];
  ignoreBadCases.forEach(v => {
    it(`process() - handle ${JSON.stringify(v)} ignore`, () => {
      const box = newBox('test', { ignore: v });
      const data = {};

      box.addProcessor(file => {
        data[file.path] = file;
      });

      return Promise.all([
        fs.writeFile(pathFn.join(box.base, 'foo.txt'), 'foo')
      ]).then(() => box.process()).then(() => {
        const keys = Object.keys(data);

        keys.length.should.eql(1);
        keys[0].should.eql('foo.txt');
      }).finally(() => fs.rmdir(box.base));
    });
  });

  it('process() - skip files if they match a glob epression in ignore', () => {
    const box = newBox('test', {ignore: '**/ignore_me'});
    const data = {};

    box.addProcessor(file => {
      data[file.path] = file;
    });

    return Promise.all([
      fs.writeFile(pathFn.join(box.base, 'foo.txt'), 'foo'),
      fs.writeFile(pathFn.join(box.base, 'ignore_me', 'bar.txt'), 'ignore_me')
    ]).then(() => box.process()).then(() => {
      const keys = Object.keys(data);

      keys.length.should.eql(1);
      keys[0].should.eql('foo.txt');
    }).finally(() => fs.rmdir(box.base));
  });

  it('process() - skip files if they match any of the glob expressions in ignore', () => {
    const box = newBox('test', {ignore: ['**/ignore_me', '**/ignore_me_too.txt']});
    const data = {};

    box.addProcessor(file => {
      data[file.path] = file;
    });

    return Promise.all([
      fs.writeFile(pathFn.join(box.base, 'foo.txt'), 'foo'),
      fs.writeFile(pathFn.join(box.base, 'ignore_me', 'bar.txt'), 'ignore_me'),
      fs.writeFile(pathFn.join(box.base, 'ignore_me_too.txt'), 'ignore_me_too')
    ]).then(() => box.process()).then(() => {
      const keys = Object.keys(data);

      keys.length.should.eql(1);
      keys[0].should.eql('foo.txt');
    }).finally(() => fs.rmdir(box.base));
  });

  it('watch() - create', () => {
    const box = newBox('test');
    const path = 'a.txt';
    const src = pathFn.join(box.base, path);
    const processor = sinon.spy();

    box.addProcessor(processor);

    return Promise.all([fs.writeFile(src, 'a')])
      .then(() => box.watch())
      .then(() => box.isWatching().should.be.true)
      .delay(500).then(() => {
        const file = processor.args[0][0];

        file.source.should.eql(src);
        file.path.should.eql(path);
        file.type.should.eql('create');
        file.params.should.eql({});
      }).finally(() => {
        box.unwatch();
        return fs.rmdir(box.base);
      });
  });

  it('watch() - update', () => {
    const box = newBox('test');
    const path = 'a.txt';
    const src = pathFn.join(box.base, path);
    const cacheId = 'test/' + path;
    const Cache = box.Cache;
    const processor = sinon.spy();

    box.addProcessor(processor);

    return Promise.all([
      fs.writeFile(src, 'a'),
      Cache.insert({_id: cacheId})
    ]).then(() => box.watch()).then(() => fs.appendFile(src, 'b')).delay(500).then(() => {
      const file = processor.lastCall.args[0];

      file.source.should.eql(src);
      file.path.should.eql(path);
      file.type.should.eql('update');
      file.params.should.eql({});
    }).finally(() => {
      box.unwatch();
      return fs.rmdir(box.base);
    });
  });

  it('watch() - delete', () => {
    const box = newBox('test');
    const path = 'a.txt';
    const src = pathFn.join(box.base, path);
    const cacheId = 'test/' + path;
    const Cache = box.Cache;
    const processor = sinon.spy();

    box.addProcessor(processor);

    return Promise.all([
      fs.writeFile(src, 'a'),
      Cache.insert({_id: cacheId})
    ]).then(() => box.watch()).then(() => fs.unlink(src)).delay(500).then(() => {
      const file = processor.lastCall.args[0];

      file.source.should.eql(src);
      file.path.should.eql(path);
      file.type.should.eql('delete');
      file.params.should.eql({});
    }).finally(() => {
      box.unwatch();
      return fs.rmdir(box.base);
    });
  });

  it('watch() - rename file', () => {
    const box = newBox('test');
    const path = 'a.txt';
    const src = pathFn.join(box.base, path);
    const newPath = 'b.txt';
    const newSrc = pathFn.join(box.base, newPath);
    const cacheId = 'test/' + path;
    const Cache = box.Cache;
    const processor = sinon.spy();

    box.addProcessor(processor);

    return Promise.all([
      fs.writeFile(src, 'a'),
      Cache.insert({_id: cacheId})
    ]).then(() => box.watch()).then(() => fs.rename(src, newSrc)).delay(500).then(() => {
      const lastTwoCalls = processor.args.slice(processor.args.length - 2, processor.args.length);

      lastTwoCalls.forEach(args => {
        const file = args[0];

        switch (file.type) {
          case 'create':
            file.source.should.eql(newSrc);
            file.path.should.eql(newPath);
            break;

          case 'delete':
            file.source.should.eql(src);
            file.path.should.eql(path);
            break;
        }
      });
    }).finally(() => {
      box.unwatch();
      return fs.rmdir(box.base);
    });
  });

  it('watch() - rename folder', () => {
    const box = newBox('test');
    const path = 'a/b.txt';
    const src = pathFn.join(box.base, path);
    const newPath = 'b/b.txt';
    const newSrc = pathFn.join(box.base, newPath);
    const cacheId = 'test/' + path;
    const Cache = box.Cache;
    const processor = sinon.spy();

    box.addProcessor(processor);

    return Promise.all([
      fs.writeFile(src, 'a'),
      Cache.insert({_id: cacheId})
    ]).then(() => box.watch()).then(() => fs.rename(pathFn.join(box.base, 'a'), pathFn.join(box.base, 'b'))).delay(500).then(() => {
      const lastTwoCalls = processor.args.slice(processor.args.length - 2, processor.args.length);

      lastTwoCalls.forEach(args => {
        const file = args[0];

        switch (file.type) {
          case 'create':
            file.source.should.eql(newSrc);
            file.path.should.eql(newPath);
            break;

          case 'delete':
            file.source.should.eql(src);
            file.path.should.eql(path);
            break;
        }
      });
    }).finally(() => {
      box.unwatch();
      return fs.rmdir(box.base);
    });
  });

  it('watch() - update with simple "ignore" option', () => {
    const box = newBox('test', {ignore: '**/ignore_me'});
    const path1 = 'a.txt';
    const path2 = 'b.txt';
    const src1 = pathFn.join(box.base, path1);
    const src2 = pathFn.join(box.base, 'ignore_me', path2);
    const cacheId1 = 'test/' + path1;
    const cacheId2 = 'test/ignore_me/' + path2;
    const Cache = box.Cache;
    const processor = sinon.spy();

    box.addProcessor(processor);

    let file;
    return Promise.all([
      fs.writeFile(src1, 'a'),
      Cache.insert({_id: cacheId1})
    ]).then(() => Promise.all([
      fs.writeFile(src2, 'b'),
      Cache.insert({_id: cacheId2})
    ])).then(() => box.watch()).then(() => fs.appendFile(src1, 'aaa')).delay(500).then(() => {
      file = processor.lastCall.args[0];

      file.source.should.eql(src1);
      file.path.should.eql(path1);
      file.type.should.eql('update');
      file.params.should.eql({});
    }).then(() => fs.appendFile(src2, 'bbb')).delay(500).then(() => {
      const file2 = processor.lastCall.args[0];
      file2.should.eql(file); // not changed
    }).finally(() => {
      box.unwatch();
      return fs.rmdir(box.base);
    });
  });

  it('watch() - update with complex "ignore" option', () => {
    const box = newBox('test', {ignore: ['**/ignore_me', '**/ignore_me_too.txt']});
    const path1 = 'a.txt';
    const path2 = 'b.txt';
    const path3 = 'ignore_me_too.txt';
    const src1 = pathFn.join(box.base, path1);
    const src2 = pathFn.join(box.base, 'ignore_me', path2);
    const src3 = pathFn.join(box.base, path3);
    const cacheId1 = 'test/' + path1;
    const cacheId2 = 'test/ignore_me/' + path2;
    const cacheId3 = 'test/' + path3;
    const Cache = box.Cache;
    const processor = sinon.spy();

    box.addProcessor(processor);

    let file;
    return Promise.all([
      fs.writeFile(src1, 'a'),
      Cache.insert({_id: cacheId1})
    ]).then(() => Promise.all([
      fs.writeFile(src2, 'b'),
      Cache.insert({_id: cacheId2})
    ])).then(() => Promise.all([
      fs.writeFile(src3, 'c'),
      Cache.insert({_id: cacheId3})
    ])).then(() => box.watch()).then(() => fs.appendFile(src1, 'aaa')).delay(500).then(() => {
      file = processor.lastCall.args[0];

      file.source.should.eql(src1);
      file.path.should.eql(path1);
      file.type.should.eql('update');
      file.params.should.eql({});
    }).then(() => fs.appendFile(src2, 'bbb')).delay(500).then(() => {
      const file2 = processor.lastCall.args[0];
      file2.should.eql(file); // not changed
    }).then(() => fs.appendFile(src3, 'ccc')).delay(500).then(() => {
      const file3 = processor.lastCall.args[0];
      file3.should.eql(file); // not changed
    }).finally(() => {
      box.unwatch();
      return fs.rmdir(box.base);
    });
  });

  it('watch() - watcher has started', () => {
    const box = newBox();

    return box.watch().then(() => {
      const errorCallback = sinon.spy(err => {
        err.should.have.property('message', 'Watcher has already started.');
      });

      return box.watch().catch(errorCallback).then(() => {
        errorCallback.calledOnce.should.be.true;
      });
    }).finally(() => {
      box.unwatch();
    });
  });

  it('watch() - run process() before start watching', () => {
    const box = newBox('test');
    const data = [];

    box.addProcessor(file => {
      data.push(file.path);
    });

    return Promise.all([
      fs.writeFile(pathFn.join(box.base, 'a.txt'), 'a'),
      fs.writeFile(pathFn.join(box.base, 'b', 'c.js'), 'c')
    ]).then(() => box.watch()).then(() => {
      data.should.have.members(['a.txt', 'b/c.js']);
    }).finally(() => {
      box.unwatch();
      return fs.rmdir(box.base);
    });
  });

  it('unwatch()', () => {
    const box = newBox('test');
    const processor = sinon.spy();

    return box.watch().then(() => {
      box.addProcessor(processor);
      box.unwatch();

      return fs.writeFile(pathFn.join(box.base, 'a.txt'), 'a');
    }).then(() => {
      processor.called.should.be.false;
    }).finally(() => {
      box.unwatch();
      return fs.rmdir(box.base);
    });
  });

  it('isWatching()', () => {
    const box = newBox();

    box.isWatching().should.be.false;

    return box.watch().then(() => {
      box.isWatching().should.be.true;
      return box.unwatch();
    }).then(() => {
      box.isWatching().should.be.false;
    }).finally(() => {
      box.unwatch();
    });
  });

  it('processBefore & processAfter events', () => {
    const box = newBox('test');

    const beforeSpy = sinon.spy(file => {
      file.type.should.eql('create');
      file.path.should.eql('a.txt');
    });

    const afterSpy = sinon.spy(file => {
      file.type.should.eql('create');
      file.path.should.eql('a.txt');
    });

    box.on('processBefore', beforeSpy);
    box.on('processAfter', afterSpy);

    return fs.writeFile(pathFn.join(box.base, 'a.txt'), 'a').then(() => box.process()).then(() => {
      beforeSpy.calledOnce.should.be.true;
      afterSpy.calledOnce.should.be.true;
    }).finally(() => fs.rmdir(box.base));
  });
});
