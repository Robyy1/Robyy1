// Keystroke — Scroll-reveal utility
// Hand-rolled IntersectionObserver + CSS transitions. No animation library.
//
// Elements opt in with:
//   data-reveal            -> plain fade + rise
//   data-reveal="stagger"  -> children get a small nth-child transition-delay
//
// Reveals once per element (unobserved after entering the viewport). Honors
// both the OS reduced-motion preference and the manual override from Addendum
// 01 (data-motion="on" forces static, data-motion="off" allows motion).
//
// Kept as a plain script (window.initScrollReveal) so any page can load it with
// a plain <script> tag, consistent with the rest of the codebase.

(function () {
  'use strict';

  function isReducedMotion() {
    var osReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var motion = document.documentElement.dataset.motion || 'system';
    if (motion === 'on') return true;
    if (motion === 'off') return false;
    return osReduced;
  }

  function initScrollReveal(root) {
    root = root || document;
    var els = root.querySelectorAll('[data-reveal]');
    var reduced = isReducedMotion();
    var observer = null;

    if (reduced) {
      // Static: no transition, just show everything immediately.
      for (var i = 0; i < els.length; i++) {
        els[i].classList.add('is-visible');
      }
      return;
    }

    if (!('IntersectionObserver' in window)) {
      for (var j = 0; j < els.length; j++) {
        els[j].classList.add('is-visible');
      }
      return;
    }

    observer = new IntersectionObserver(function (entries) {
      for (var k = 0; k < entries.length; k++) {
        var entry = entries[k];
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    for (var m = 0; m < els.length; m++) {
      observer.observe(els[m]);
    }
  }

  // Re-evaluate when the user flips the reduce-motion override mid-session
  // (Settings -> Appearance -> Reduce motion). Elements already revealed stay
  // revealed; anything still hidden honors the new setting immediately.
  document.addEventListener('keystroke-motion-changed', function () {
    var els = document.querySelectorAll('[data-reveal]:not(.is-visible)');
    if (isReducedMotion()) {
      for (var i = 0; i < els.length; i++) {
        els[i].classList.add('is-visible');
      }
    } else {
      initScrollReveal();
    }
  });

  window.initScrollReveal = initScrollReveal;
})();