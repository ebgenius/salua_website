/* Scroll-position indicator for the top navigation.
 *
 * Sets --nav-progress (0-1) on each nav link; assets/css/main.css turns that
 * into the scaleX of the bar underneath it. Exactly one link is ever non-zero,
 * so the bar reads as "how far through the current section you are" and hands
 * over cleanly at each boundary.
 *
 * Each nav item owns everything from its own section down to the next linked
 * section: the research highlights sit between #two and #three without
 * ids of their own, and the RESEARCH bar should keep filling across them.
 *
 * On a sub-page the nav's target sections don't exist, so the link named by
 * <body data-nav-current="#one"> is filled from whole-page scroll progress
 * instead. Same meaning, no special-casing in the CSS.
 *
 * Performance: section geometry is measured only on load/resize/content change,
 * never inside the scroll handler — reading getBoundingClientRect() every frame
 * forces a synchronous layout and makes scrolling choppy.
 *
 * Deliberately separate from assets/js/main.js: that file's scrollex handlers
 * also drive the .inactive class behind the section fade-ins, and must keep
 * working untouched.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  // Disables the no-JS fallback rule in main.css.
  root.className += (root.className ? ' ' : '') + 'js-nav-progress';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var links = [].slice.call(document.querySelectorAll('#sidebar nav a'));
    if (!links.length) return;

    var clamp = function (n) { return n < 0 ? 0 : n > 1 ? 1 : n; };

    // Only touch the DOM when the value actually moved. A filled bar no longer
    // means "current" (passed sections stay full), so the highlight is passed
    // in separately.
    var last = new WeakMap();
    var set = function (link, value, isCurrent) {
      var previous = last.get(link);
      if (previous === undefined || Math.abs(previous - value) >= 0.002) {
        last.set(link, value);
        link.style.setProperty('--nav-progress', value.toFixed(3));
      }
      link.classList.toggle('is-current', !!isCurrent);
    };

    // Links whose target section exists on this page.
    var targets = links.map(function (link) {
      var href = link.getAttribute('href') || '';
      var el = href.charAt(0) === '#' && href.length > 1 ? document.querySelector(href) : null;
      return el ? { link: link, el: el } : null;
    }).filter(Boolean);

    var subPage = targets.length === 0;
    var owner = null;

    if (subPage) {
      var currentHref = document.body.getAttribute('data-nav-current');
      owner = currentHref && links.filter(function (link) {
        var href = link.getAttribute('href') || '';
        return href === currentHref || href === '/' + currentHref;
      })[0];
      if (!owner) return;
    }

    function docHeight() {
      return Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight
      );
    }

    // Cached geometry — the only place that reads layout.
    var blocks = [];
    var scrollable = 0;

    var documentHeight = 0;

    function measure() {
      documentHeight = docHeight();
      scrollable = Math.max(documentHeight - window.innerHeight, 1);
      if (subPage) return;

      var starts = targets.map(function (t) {
        return { link: t.link, start: t.el.getBoundingClientRect().top + window.pageYOffset };
      }).sort(function (a, b) { return a.start - b.start; });

      blocks = starts.map(function (s, i) {
        var end = i + 1 < starts.length ? starts[i + 1].start : documentHeight;
        return { link: s.link, start: s.start, span: Math.max(end - s.start, 1) };
      });
    }

    // Sections already scrolled past stay at 1: the bar accumulates left to
    // right across the nav, so it doubles as a progress bar for the whole page.
    function update() {
      var y = window.pageYOffset;
      var values = [];
      var currentIndex = -1;
      var i;

      if (subPage) {
        // A page shorter than the viewport counts as fully read.
        var progress = scrollable > 1 ? clamp(y / scrollable) : 1;
        var ownerIndex = links.indexOf(owner);
        for (i = 0; i < links.length; i++) {
          values.push(i < ownerIndex ? 1 : i === ownerIndex ? progress : 0);
        }
        currentIndex = ownerIndex;
      } else {
        // Reference point slides from the top of the viewport at the top of the
        // page to its bottom at the very end, so it spans the full document:
        // nothing is filled at the top and everything is filled at the bottom,
        // including a last section too short to ever reach the viewport top.
        var read = y + window.innerHeight * (y / scrollable);
        for (i = 0; i < blocks.length; i++) {
          var p = clamp((read - blocks[i].start) / blocks[i].span);
          values.push(p);
          // The one still filling is the current section.
          if (currentIndex === -1 && p < 1) currentIndex = i;
        }
        if (currentIndex === -1) currentIndex = blocks.length - 1;
      }

      var order = subPage ? links : blocks.map(function (b) { return b.link; });
      for (i = 0; i < order.length; i++) {
        set(order[i], values[i], i === currentIndex);
      }
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        update();
        ticking = false;
      });
    }

    function remeasure() {
      measure();
      update();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', remeasure);
    // Lazy images and the spotlight video change the page height after load.
    window.addEventListener('load', remeasure);
    if (window.ResizeObserver) {
      var observer = new ResizeObserver(remeasure);
      observer.observe(document.documentElement);
    }

    remeasure();
  });
})();
