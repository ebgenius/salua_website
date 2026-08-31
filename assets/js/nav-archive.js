/* The ARCHIVE entry in the nav, and its open/close slide.
 *
 * The nav carries one collapsed <li class="nav-archive"> per archive page (see
 * _tools/partials/nav.html). A page names the one it belongs to with
 * <body data-archive="news">; this file opens it, and – crucially – closes it
 * again on the *next* page.
 *
 * Two page loads, one continuous animation:
 *
 *   /news-archive/                       ->  /
 *   entry slides open on load                entry starts open, slides shut
 *   pagehide writes                          the inline <head> script in
 *   sessionStorage['nav:archive-exit']       _tools/partials/head-common.html
 *     = 'news'                               reads and clears that key before
 *                                            the first paint, sets
 *                                            window.navArchiveReturn and
 *                                            html.nav-archive-return (which
 *                                            suppresses the staggered intro)
 *
 * The open state is a class rather than a CSS match on [data-archive], so the
 * transition can be armed one frame after load instead of the entry simply
 * being open when the page paints. assets/css/noscript.css re-implements the
 * open state statically for the no-JS case.
 *
 * Deliberately separate from assets/js/main.js: that file is stock theme code,
 * and the site's own behaviour lives beside it rather than inside it. Same
 * shape as assets/js/nav-toggle.js.
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function entryFor(key) {
    return key ? document.querySelector('#sidebar nav .nav-archive[data-archive="' + key + '"]') : null;
  }

  ready(function () {
    var key = document.body.getAttribute('data-archive');
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Leaving an archive page: tell the next page which entry to close. pagehide
    // covers both a nav click and the back button, and fires for bfcache unloads
    // where beforeunload does not.
    if (key) {
      window.addEventListener('pagehide', function () {
        try {
          sessionStorage.setItem('nav:archive-exit', key);
        } catch (e) { /* private mode – the entry just will not animate shut */ }
      });
    }

    if (key) {
      var open = entryFor(key);
      if (!open) return;

      var link = open.querySelector('a');
      if (link) link.setAttribute('aria-current', 'page');

      // One frame late, so the browser has a collapsed state to transition from.
      if (reduced) open.classList.add('is-open');
      else window.requestAnimationFrame(function () { open.classList.add('is-open'); });
      return;
    }

    // Arriving back on the home page: show the entry as the previous page left
    // it, then let it fall shut.
    var closing = entryFor(window.navArchiveReturn);
    if (!closing) return;

    if (reduced) return;   // nothing to animate; it is already collapsed

    closing.classList.add('is-open', 'no-anim');
    void closing.offsetWidth;                     // flush the open state before arming the transition
    closing.classList.remove('no-anim');
    window.requestAnimationFrame(function () {
      closing.classList.remove('is-open');
    });
  });
})();
