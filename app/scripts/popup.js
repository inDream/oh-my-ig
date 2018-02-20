$('#sync').click(() => {
  chrome.runtime.sendMessage({ action: 'sync' });
});

const options = ['autoReload', 'feedPerPage',
  'syncCount', 'syncEach', 'syncInt', 'syncOneInt'];
$('#saveOptions').click(() => {
  const data = {};
  options.forEach((o) => {
    data[o] = +$(`#${o}`).val();
  });
  chrome.runtime.sendMessage({ action: 'saveOptions', data });
  M.toast('Saved!', 3000);
});

$(() => {
  chrome.storage.local.get('options', (res) => {
    options.forEach((o) => {
      $(`#${o}`).val(res.options[o]);
    });
  });
});
