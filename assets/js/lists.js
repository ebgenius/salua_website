/* Renders the news and publications lists from their JSON at runtime, so edits
 * to data/*.json show up without rebuilding.
 *
 * Any <ul data-list="news|publications"> on the page is filled; news lists may
 * add data-filter="current|archived" to select on the entry's `archived` flag.
 * The same markup is baked into the HTML by _tools/build-lists.js for crawlers
 * that do not run JavaScript — keep the two renderers in step.
 */
(function () {
  'use strict';

  function button(url, label) {
    return url
      ? '<a href="' + url + '" class="button small" target="_blank" rel="noopener noreferrer">' + label + '</a>'
      : '';
  }

  function row(dateLabel, url, title, buttons, meta) {
    return '<li><span class="list-date">' + dateLabel + '</span><div class="list-item">'
      + '<a href="' + url + '" target="_blank" rel="noopener noreferrer"><p>' + title + '</p></a>'
      + (buttons ? '<div class="list-buttons">' + buttons + '</div>' : '')
      + (meta ? '<span class="list-meta">' + meta + '</span>' : '')
      + '</div></li>';
  }

  function newsRow(item) {
    var btns = [button(item.article, 'Article'), button(item.video, 'Video'), button(item.linkedin, 'LinkedIn')]
      .filter(Boolean).join(' ');
    // Split a leading "JUN '26 - " off the title so the date can be styled as a
    // label; titles without that prefix are left untouched.
    var m = item.title.match(/^([A-Za-z]{3} '\d{2})\s*-\s*([\s\S]+)$/);
    return row(m ? m[1] : '', item.url, m ? m[2] : item.title, btns, '');
  }

  function publicationRow(item) {
    var btns = [button(item.pdf, 'PDF'), button(item.video, 'Video'), button(item.code, 'Code')]
      .filter(Boolean).join(' ');
    var meta = [item.authors, item.venue].filter(Boolean).join(' · ');
    return row(item.year || '', item.url, item.title, btns, meta);
  }

  var sources = {
    news: { file: '/data/news.json', toRow: newsRow },
    publications: { file: '/data/publications.json', toRow: publicationRow }
  };

  var lists = [].slice.call(document.querySelectorAll('ul[data-list]'));
  if (!lists.length) return;

  var cache = {};
  lists.forEach(function (ul) {
    var kind = ul.getAttribute('data-list');
    var source = sources[kind];
    if (!source) return;

    if (!cache[kind]) {
      cache[kind] = fetch(source.file, { cache: 'no-store' }).then(function (r) { return r.json(); });
    }

    var filter = ul.getAttribute('data-filter');
    cache[kind]
      .then(function (items) {
        var selected = items;
        if (filter === 'archived') selected = items.filter(function (i) { return i.archived === true; });
        else if (filter === 'current') selected = items.filter(function (i) { return i.archived !== true; });
        ul.innerHTML = selected.map(source.toRow).join('');
      })
      .catch(function () { /* keep the pre-rendered markup */ });
  });
})();
