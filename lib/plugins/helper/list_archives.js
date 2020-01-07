'use strict';

const { Cache } = require('hexo-util');
const { toMomentLocale } = require('./date');
const cachify = function(fn, keyMaker, thisArg) {
  const cache = new Cache();

  return function(...args) {
    const key = typeof keyMaker === 'function'
      ? Reflect.apply(keyMaker, thisArg || this, args)
      : args[0];
    return cache.apply(key, () => Reflect.apply(fn, thisArg || this, args));
  };
};

function listArchivesHelper(options = {}) {
  const { config } = this;
  const archiveDir = config.archive_dir;
  const { timezone } = config;
  const lang = toMomentLocale(this.page.lang || this.page.language || config.language);
  let { format } = options;
  const type = options.type || 'monthly';
  const { style = 'list', transform, separator = ', ' } = options;
  const showCount = Object.prototype.hasOwnProperty.call(options, 'show_count') ? options.show_count : true;
  const className = options.class || 'archive';
  const order = options.order || -1;
  const compareFunc = type === 'monthly'
    ? (yearA, monthA, yearB, monthB) => yearA === yearB && monthA === monthB
    : (yearA, monthA, yearB, monthB) => yearA === yearB;

  let result = '';

  if (!format) {
    format = type === 'monthly' ? 'MMMM YYYY' : 'YYYY';
  }

  const posts = this.site.posts.sort('date', order);
  if (!posts.length) return result;

  const data = [];
  let length = 0;

  posts.forEach(post => {
    // Clone the date object to avoid pollution
    let date = post.date.clone();

    if (timezone) date = date.tz(timezone);

    const year = date.year();
    const month = date.month() + 1;
    const lastData = data[length - 1];

    if (!lastData || !compareFunc(lastData.year, lastData.month, year, month)) {
      if (lang) date = date.locale(lang);
      const name = date.format(format);
      length = data.push({
        name,
        year,
        month,
        count: 1
      });
    } else {
      lastData.count++;
    }
  });

  const link = item => {
    let url = `${archiveDir}/${item.year}/`;

    if (type === 'monthly') {
      if (item.month < 10) url += '0';
      url += `${item.month}/`;
    }

    return this.url_for(url);
  };

  if (style === 'list') {
    result += `<ul class="${className}-list">`;

    for (let i = 0, len = data.length; i < len; i++) {
      const item = data[i];

      result += `<li class="${className}-list-item">`;

      result += `<a class="${className}-list-link" href="${link(item)}">`;
      result += transform ? transform(item.name) : item.name;
      result += '</a>';

      if (showCount) {
        result += `<span class="${className}-list-count">${item.count}</span>`;
      }

      result += '</li>';
    }

    result += '</ul>';
  } else {
    for (let i = 0, len = data.length; i < len; i++) {
      const item = data[i];

      if (i) result += separator;

      result += `<a class="${className}-link" href="${link(item)}">`;
      result += transform ? transform(item.name) : item.name;

      if (showCount) {
        result += `<span class="${className}-count">${item.count}</span>`;
      }

      result += '</a>';
    }
  }

  return result;
}


listArchivesHelper.cached = cachify(listArchivesHelper, function() {
  const { config, page, path } = this;
  const { relative_link, language } = config;
  const lang = toMomentLocale(page.lang || page.language || language);

  if (!relative_link) {
    // Caching works across different languages
    return lang;
  }

  if (path === undefined || path === null) {
    throw new TypeError('path is required!');
  }

  // Convert the path to a pattern to apply the cache.
  // e.g.
  //   a/b/c => @/@/@
  //   e/f/g => @/@/@
  //   a/ => @/@
  //   '' => @
  //   archives/2019/12/page/2/index.html => archives/2019/12/@/@/@
  const convertedPath = path.indexOf('archives') === 0
    ? path.replace(/page\/\d+\/index\.html/, '@/@/@')
    : path.replace(/[^/]+/g, '@').replace(/(\/)$|^$/, '$1@');

  // Caching works across different languages and paths
  return lang + '-' + convertedPath;
});

module.exports = listArchivesHelper;
