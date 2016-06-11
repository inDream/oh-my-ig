'use strict';

let options = null;
let fetcher = null;

function setupAlarms() {
  chrome.alarms.create('sync', {
    periodInMinutes: options.syncInt
  });
  chrome.alarms.create('syncOne', {
    periodInMinutes: options.syncOneInt
  });
}

// Set up init options
chrome.storage.local.get('options', res => {
  let defaultOptions = {
    autoReload: 5,
    feedPerPage: 50,
    syncCount: 10,
    syncEach: 12,
    syncInt: 60,
    syncOneInt: 15
  };
  options = Object.assign(defaultOptions, res.options);
  chrome.storage.local.set({options: options});

  fetcher = new Fetcher(options);
  // Export for main page
  window.fetcher = fetcher;
  fetcher.auto(1)
    .then(success => {
      if (success) {
        setupAlarms();
      }
    });
});

chrome.alarms.onAlarm.addListener(alerm => {
  switch (alerm.name) {
    case 'syncOne':
      fetcher.auto(1);
      break;
    case 'sync':
      fetcher.auto();
      break;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch(request.action) {
    case 'sync':
      fetcher.auto();
      break;
    case 'saveOptions':
      options = request.data;
      fetcher.syncEach = options.syncEach;
      setupAlarms();
      DB.s({options: options});
      break;
  }
});

chrome.webRequest.onBeforeSendHeaders.addListener(details => {
  if (details.tabId === -1) {
    details.requestHeaders.forEach(header => {
      if (header.name === 'Origin') {
        header.value = 'https://www.instagram.com/';
      }
    });
  }
  details.requestHeaders.push({
    name: 'Referer',
    value: 'https://www.instagram.com/'
  });
  return {requestHeaders: details.requestHeaders};
}, {urls: ['https://www.instagram.com/*']}, ['blocking', 'requestHeaders']);
