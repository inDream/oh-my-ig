window.ga = (...args) => { (window.ga.q = window.ga.q || []).push(args); };
window.ga.l = +new Date();
const a = document.createElement('script');
a.src = 'https://www.google-analytics.com/analytics.js';
document.body.appendChild(a);

window.ga('create', 'UA-79013702-3', 'auto');
window.ga('set', 'checkProtocolTask', () => {});
window.ga('require', 'displayfeatures');

if (typeof Fetcher === 'undefined') {
  window.ga('send', 'pageview', window.location.pathname);
} else {
  chrome.runtime.onInstalled.addListener((o) => {
    if (o.reason !== 'chrome_update') {
      window.A.e(
        'extension', o.reason, chrome.runtime.getManifest().version, null,
        { nonInteraction: 1 },
      );
    }
  });
}

class A {
  static e(cat, action, label, value, options) {
    window.ga(
      'send', 'event', cat, action, label || null, value || null,
      options || null,
    );
  }
}

window.A = A;
