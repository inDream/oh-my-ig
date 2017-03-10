window.ga = function() {(ga.q = ga.q || []).push(arguments)};
ga.l = +new Date;
let a = document.createElement('script');
a.src = 'https://www.google-analytics.com/analytics.js';
document.body.appendChild(a);

ga('create', 'UA-79013702-3', 'auto');
ga('set', 'checkProtocolTask', () => {});
ga('require', 'displayfeatures');

if (typeof Fetcher === 'undefined') {
  ga('send', 'pageview', location.pathname);
} else {
  chrome.runtime.onInstalled.addListener(o => {
    if (o.reason !== 'chrome_update') {
      A.e('extension', o.reason, chrome.runtime.getManifest().version, null,
        {nonInteraction: 1});
    }
  });
}

class A {
  static e(cat, action, label, value, options) {
    ga('send', 'event', cat, action, label || null, value || null,
      options || null);
  }
}
