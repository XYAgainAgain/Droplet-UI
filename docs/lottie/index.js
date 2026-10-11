/*
 * Lazy Lottie illustrations for the docs pages.
 *
 * Kept deliberately at arm's length from the library: Droplet UI itself ships
 * zero dependencies, so the Lottie player (the lottie-web dev dependency's
 * light SVG build) and each animation JSON are loaded lazily - on idle, once
 * the container nears the viewport - and only for these decorative panels.
 * Nothing here is part of the components you install.
 *
 * Under reduced-motion the animation is rendered but parked on its first
 * frame, so the illustration still shows without moving. If the player or the
 * JSON fails to load (offline, blocked), the page simply carries on without it.
 *
 *   initLottie(document.getElementById('heroLottie'), './docs/lottie/hero-lottie.json');
 */

import { prefersReducedMotion } from '../../package.js';

// The player lives next to this module at runtime: the dev server streams it
// from node_modules/lottie-web, and the site build copies the same file into
// _site/docs/lottie/ - so this URL holds in both.
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
      // No animation is fine - the page stands on its own
    });
}

export function initLottie (container, animationURL) {
  if (!container) {
    return;
  }

  // Only fetch the player + JSON once the container is actually rendered and
  // near the viewport. A display:none container (narrow-screen layouts hide
  // the hero one) never intersects, so its payload is never downloaded there;
  // widening the window into the wide layout triggers the load.
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      render(container, animationURL);
    }
  }, { rootMargin: '200px' });

  observer.observe(container);
}
