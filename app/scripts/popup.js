'use strict';

$('#sync').click(() => {
  chrome.runtime.sendMessage({action: 'sync'});
});

let options = ['autoReload', 'feedPerPage',
  'syncCount', 'syncEach', 'syncInt', 'syncOneInt'];
$('#saveOptions').click(() => {
  let data = {};
  options.forEach(o => {
    data[o] = +$('#' + o).val();
  });
  chrome.runtime.sendMessage({action: 'saveOptions', data: data});
  Materialize.toast('Saved!', 3000);
});

$(() => {
  chrome.storage.local.get('options', function (res) {
    options.forEach(o => {
      $('#' + o).val(res.options[o]);
    });
  });
});
