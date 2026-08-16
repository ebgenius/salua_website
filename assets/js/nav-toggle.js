/* Hamburger menu for the mobile top bar (<=736px).
 *
 * Below 736px the horizontal nav strip has no room for six labels, so the bar
 * shows the site title plus a hamburger and the links drop down as a panel.
 * This file owns nothing but the open/closed state: it toggles .is-menu-open on
 * #sidebar and keeps aria-expanded in step, and assets/css/main.css does the
 * rest.
 *
 * The .js-nav-toggle class on <html> lets the CSS hide the button when this
 * script never ran — without it the panel could never be opened, and a dead
 * control is worse than no control. Same trick as nav-progress.js.
 *
 * Deliberately separate from assets/js/main.js: that file is stock theme code
 * driving scrollex and the section fade-ins, and is easier to keep upgradable
 * if the site's own behaviour lives beside it rather than inside it.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  root.className += (root.className ? ' ' : '') + 'js-nav-toggle';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    var toggle = sidebar.querySelector('.nav-toggle');
    var menu = sidebar.querySelector('nav');
    if (!toggle || !menu) return;

    // Matches the breakpoint the bar is styled at; above it the bar is
    // display:none, so any leftover open state has to be cleared.
    var mobile = window.matchMedia('(max-width: 736px)');

    function setOpen(open) {
      sidebar.classList.toggle('is-menu-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    function isOpen() {
      return sidebar.classList.contains('is-menu-open');
    }

    toggle.addEventListener('click', function (event) {
      event.preventDefault();
      setOpen(!isOpen());
    });

    // Tapping a link scrolls the page behind the panel; close it so the section
    // it just jumped to is actually visible.
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('click', function (event) {
      if (isOpen() && !sidebar.contains(event.target)) setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    function onBreakpointChange() {
      if (!mobile.matches) setOpen(false);
    }

    if (mobile.addEventListener) mobile.addEventListener('change', onBreakpointChange);
    else if (mobile.addListener) mobile.addListener(onBreakpointChange);
  });
})();
