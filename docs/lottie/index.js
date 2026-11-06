// Lazy Lottie for the docs, outside the zero-dependency library; a failed load is skipped

import { prefersReducedMotion } from '../../package.js';

// server.mjs and build-site.mjs both serve the player here
const PLAYER_URL = new URL('./lottie_light.min.js', import.meta.url).href;

// The UMD player attaches window.lottie
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
      // Decorative only
    });
}

export function initLottie (container, animationURL) {
  if (!container) {
    return;
  }

  // A display: none container never intersects, so its payload waits for the wide layout
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      render(container, animationURL);
    }
  }, { rootMargin: '200px' });

  observer.observe(container);
}
