moment.updateLocale('en', {
  relativeTime : {
    future: 'in %s',
    past: '%s ago',
    s:  '%ds',
    m:  '1m',
    mm: '%dm',
    h:  '1h',
    hh: '%dh',
    d:  '1d',
    dd: '%dd',
    M:  '1M',
    MM: '%dM',
    y:  '1y',
    yy: '%dy'
  }
});

class Main {
  constructor() {
    this.base = 'https://www.instagram.com/';
    this.currentKey = null;
    this.currentItems = null;
    this.sortBy = 'date';
    this.sortOrder = false;
  }

  _addDates(items) {
    items.forEach(item => {
      let d = moment(item.key * 100000);
      d = d.format('DD/MM/YYYY');
      let tempate = `<a data-date="${item.key}" class="collection-item">
      ${d}<span class="new badge">${item.count}</span></a>`;
      $('#feedDates').append(tempate);
    });
    $('.dropdown-button').dropdown();
  }

  init() {
    DB.g(null).then(items => {
      delete items.options;
      let dates = Object.keys(items).reverse();
      dates = dates.map(date => {
        return {key: date, count: items[date].length};
      });
      this._addDates(dates);
      this.loadFeed(dates[0].key);
    });

    // Event handler
    $('#feedDates').on('click', 'a', (e) => {
      let date = $(e.currentTarget).data('date') + '';
      this.loadFeed(date);
    });

    $('#sortOrder').click();
    $('#sortFeed').click(this.sortFeed.bind(this));
    $('#filterFeed').keyup(this.filterFeed.bind(this));

    // Fix for multiple dropdown activate
    $('.dropdown-button').click(e => {
      $(e.currentTarget).dropdown();
    });

    $('#feedItems').isotope();

    DB.g('options')
      .then(options => {
        // Setup auto reload
        if (options.autoReload) {
          setInterval(this.autoReload.bind(this), options.autoReload * 60000);
        }
      });
  }

  autoReload() {
    DB.g(this.currentKey)
      .then(items => {
        if (this.currentItems.length !== items.length) {
          this.loadFeed(this.currentKey);
        }
      })
  }

  loadFeed(date) {
    this.currentKey = date;
    $('.titleDate').text(moment(+date * 100000).format('DD/MM/YYYY'));
    let $container = $('#feedItems');
    $container.empty().isotope('destroy');
    let html = '';
    DB.g(date).then(items => {
      items = items.sort((a, b) => b.date - a.date);
      this.currentItems = items;
      console.log(`Loaded ${items.length} items from ${date}.`);
      items.forEach(item => {
        let location = item.location ? item.location.name : '';
        let locationId = item.location ? item.location.id : '';
        let date = moment(item.date * 1000);
        let timeago = date.fromNow(true);
        let fulldate = date.format('LLLL');
        let caption = item.caption || '';
        let profile = `${this.base}${item.owner.username}/`;
        let link = `${this.base}p/${item.code}/`;
        let likeIcon = `favorite${item.likes.viewer_has_liked ? '' : '_border'}`;

        let template = `<div class="col s12 m6 l4">
          <div class="card">
            <div class="card-content card-header">
              <a class="left card-profile">
                <img src="${item.owner.profile_pic_url}">
              </a>
              <a href="${link}" class="right" target="_blank">
                <time ts="${item.date}" title="${fulldate}">${timeago}</time>
              </a>
              <div class="card-owner">
                <a href="${profile}" target="_blank">${item.owner.username}</a>
                <a href="${this.base}explore/locations/${locationId}/" target="_blank">${location}</a>
              </div>
            </div>
            <div class="card-image">
              <img class="materialboxed" src="${item.display_src}">
            </div>
            <div class="card-content">
              <p>${caption}</p>
            </div>
            <div class="card-action">
              <a class="btn-link likeIcon" data-id="${item.id}" data-code="${item.code}">
                <i class="material-icons">${likeIcon}</i>
                <span class="likes">${item.likes.count}</span>
              </a>
              <a class="btn-link commentIcon">
                <i class="material-icons">chat_bubble_outline</i>
                <span class="comments">${item.comments.count}</span>
              </a>
            </div>
          </div>
        </div>`;
        html += template;
      });
      $container.html(html);
      $('.materialboxed').materialbox();

      $container.isotope({
        sortBy: this.sortBy,
        sortAscending: this.sortOrder,
        getSortData: {
          date: e => {
            return +$(e).find('time').attr('ts');
          },
          likes: e => {
            return +$(e).find('.likes').text();
          },
          comments: e => {
            return +$(e).find('.comments').text();
          }
        }
      });

      let total = $container.find('img').length;
      let count = 0;
      $container.imagesLoaded()
        .progress(() => {
          count++;
          if (count % Math.round(total / 10) == 0) {
            $container.isotope('layout');
          }
        });

      this.setItemEvents();
    });
  }

  setItemEvents() {
    $('.likeIcon').click((e) => {
      let $e = $(e.currentTarget);
      let id = $e.data('id');
      let liked = $e.find('i').text() == 'favorite';
      let state = liked ? 'unlike' : 'like';
      let url = `web/likes/${id}/${state}/`;
      chrome.runtime.getBackgroundPage(w => {
        w.fetcher.post(url)
          .then(body => {
            if (body.status == 'ok') {
              $e.find('i').text(`favorite${liked ? '_border' : ''}`);
              let likes = $e.find('.likes').text();
              $e.find('.likes').text(+likes + (liked ? -1 : 1));
            }
          })
          .then(() => {
            let code = $e.data('code');
            w.fetcher.getJSON(`p/${code}/?__a=1`)
              .then(body => {
                if (body.media) {
                  let found = false;
                  let newItems = this.currentItems.map(item => {
                    if (item.id === body.media.id) {
                      found = true;
                      return body.media;
                    }
                    return item;
                  });
                  if (found) {
                    return DB.s({[this.currentKey]: newItems});
                  }
                }
              })
          });
      });
    });
  }

  sortFeed(e) {
    let $e = $(e.target);
    let sortBy = $e.data('sort');
    if ($e.attr('id') == 'sortOrder') {
      this.sortOrder = !this.sortOrder;
    } else if (sortBy) {
      this.sortBy = sortBy;
      let active = 'teal lighten-3';
      $('#sortFeed .btn').removeClass(active);
      $e.addClass(active);
    } else {
      return;
    }
    $('#feedItems').isotope({
      sortBy: this.sortBy,
      sortAscending: this.sortOrder
    });
  }

  filterFeed(e) {
    clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => this._filterFeed(e), 200);
  }

  _filterFeed(e) {
    let search = $(e.target).val();
    $('#feedItems').isotope({
      filter: (items, item) => {
        return search ? $(item).text().match(search) : true;
      }
    });
  }
}

let main = new Main();
$(() => {
  main.init();
  $('.button-collapse').sideNav();
});
