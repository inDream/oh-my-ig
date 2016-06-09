(function() {
  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();
  a=s.createElement(o),m=s.getElementsByTagName(o)[0];a.async=1;
  a.src=g;m.parentNode.insertBefore(a,m)})(window,document,'script',
  'https://www.google-analytics.com/analytics.js','ga');
  ga('create', 'UA-79013702-3', 'auto');
  ga('set', 'checkProtocolTask', () => {});
  ga('require', 'displayfeatures');

  if (typeof Fetcher === 'undefined') {
    ga('send', 'pageview', location.pathname);
    return;
  }

  chrome.runtime.onInstalled.addListener(o => {
    if (o.reason != 'chrome_update') {
      ga('send', 'event', 'extension', o.reason, 
        chrome.runtime.getManifest().version, null, {nonInteraction: 1});
    }
  });
})();
