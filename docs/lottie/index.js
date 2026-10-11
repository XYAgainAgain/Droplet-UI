/*
 * Lazy Lottie illustrations for the docs pages, kept apart from the zero-dependency library:
 * the lottie-web player and each JSON load on idle, once the container nears the viewport.
 * Reduced motion parks the animation on its first frame; a failed load is silently skipped.
 */

import { prefersReducedMotion } from '../../package.js';

// The dev server streams the player from node_modules/lottie-web and the site build
// copies it into _site/docs/lottie/, so this relative URL holds in both
const PLAYER_URL = new URL('./lottie_light.min.js', import.meta.url).href;

// Inject the UMD player once; it attaches window.lottie
let playerPromise = null;

function loadPlayer () {
  if (window.lottie) {
    return Promise.resolve(window.lottie);
  }

  if (!playerPromise) {
    playerPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');

      script.src    = PLAYER_URL;
      script.async  = true;
      script.onload = () => resolve(window.lottie);
      script.onerror = reject;

      document.head.appendChild(script);
    });
  }

  return playerPromise;
}

// Wait for an idle moment (falling back to a short timeout) so fetching an
// animation never competes with the page's first paint
const whenIdle = () => new Promise((resolve) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => resolve(), { timeout: 1500 });
  } else {
    setTimeout(resolve, 400);
  }
});

function render (container, animationURL) {
  whenIdle()
    .then(loadPlayer)
    .then((lottie) => {
      if (!lottie) {
        return;
      }

      const animation = lottie.loadAnimation({
        container,
        renderer:  'svg',
        loop:      !prefersReducedMotion(),
        autoplay:  !prefersReducedMotion(),
        path:      animationURL,
        rendererSettings: { progressiveLoad: true },
      });

      container.dataset.ready = 'true';

      // Keep a loaded illustration in step with both the operating-system
      // preference and the docs' explicit reduced-motion preview toggle.
      const syncMotion = () => {
        const reduced = prefersReducedMotion();

        animation.loop = !reduced;

        if (reduced) {
          animation.goToAndStop(0, true);
        } else {
          animation.play();
        }
      };

      animation.addEventListener('DOMLoaded', syncMotion);
      matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', syncMotion);
      window.addEventListener('droplet-motion-change', syncMotion);
    })
    .catch(() => {
      // Decorative only; the page stands on its own
    });
}

export function initLottie (container, animationURL) {
  if (!container) {
    return;
  }

  // A display: none container (narrow layouts hide the hero one) never intersects,
  // so its payload waits until the window widens into the wide layout
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      render(container, animationURL);
    }
  }, { rootMargin: '200px' });

  observer.observe(container);
}
