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
    this.currentPage = null;
    this.totalPages = null;
    this.searchQuery = null;
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
    $('.brand-logo').click(() => window.scrollTo(0, 0));

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
        this.feedPerPage = options.feedPerPage;
      });

    $('.pagination').click((e) => {
      let $e = e.target.tagName === 'LI' ? $(e.target) :
        $(e.target).parents('li');
      if ($e.not('.active')) {
        if ($e.is('.pagination-left') && this.currentPage > 1) {
          this.currentPage--;
        } else if ($e.is('.pagination-right') && 
          this.currentPage < this.totalPages) {
          this.currentPage++;
        } else if ($e.is('.pages')) {
          this.currentPage = $e.text();
        } else {
          return;
        }
        window.scrollTo(0, 0);
        this.setItemContent();
      }
    });
  }

  autoReload() {
    DB.g(this.currentKey)
      .then(items => {
        let newItems = items.length - this.currentItems.length;
        if (newItems > 0) {
          chrome.notifications.create('sync', {
            type: 'basic',
            iconUrl: 'images/icon-128.png',
            title: 'Oh My IG',
            message: `Synced ${newItems} new feed${newItems > 1 ? 's' : ''}.`
          });
          this.loadFeed(this.currentKey);
        }
      })
  }

  loadFeed(date) {
    this.currentKey = date;
    this.currentPage = 1;
    $('.titleDate').text(moment(+date * 100000).format('DD/MM/YYYY'));
    DB.g(date).then(items => {
      items = items.sort((a, b) => b.date - a.date);
      this.currentItems = items;
      this.totalPages = Math.ceil(items.length / this.feedPerPage);
      console.log(`Loaded ${items.length} items from ${date}.`);
      this.setItemContent();
    });
  }

  setItemContent(filter) {
    let items;
    if (filter) {
      items = this.currentItems;
    } else {
      let start = this.feedPerPage * (this.currentPage - 1);
      items = this.currentItems.slice(start, start + this.feedPerPage);
    }
    let html = '';
    let $container = $('#feedItems');
    $container.empty().isotope('destroy');
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
      let itemCard = (item.is_video ? 
        `<div class="card-image card-video">
          <i class="material-icons">play_arrow</i>
          <a class="mfp mfp-iframe" href="${item.video_url}">` : 
        `<div class="card-image">
          <a class="mfp mfp-image" href="${item.display_src}">`) + 
        `<img src="${item.display_src}"></a></div>`;

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
              <a class="owner" href="${profile}" target="_blank">${item.owner.username}</a>
              <br>
              <a href="${this.base}explore/locations/${locationId}/" target="_blank">${location}</a>
            </div>
          </div>
          ${itemCard}
          <div class="card-content">
            <p class="caption">${caption}</p>
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

    $container.magnificPopup({
      delegate: '.mfp',
      gallery: {
        enabled: true,
        navigateByImgClick: true,
        preload: [0, 1]
      },
      image: {
        titleSrc: item => {
          let $card = item.el.parents('.card');
          let caption = $card.find('.caption').text();
          let owner = $card.find('.owner').text();
          let time = $card.find('time').text();
          return `<div class="card-owner"><span>${caption}</span>
            <small>by ${owner} ${time} ago</small></div>`;
        }
      }
    });

    let total = $container.find('img').length;
    let count = 0;
    $container.imagesLoaded()
      .progress(() => {
        count++;
        if (count % Math.round(total / 10) === 0) {
          $container.isotope('layout');
        }
      });

    this.setPagination();
    this.setItemEvents();
  }

  setItemEvents() {
    $('.likeIcon').click((e) => {
      let $e = $(e.currentTarget);
      let id = $e.data('id');
      let liked = $e.find('i').text() === 'favorite';
      let state = liked ? 'unlike' : 'like';
      let url = `web/likes/${id}/${state}/`;
      chrome.runtime.getBackgroundPage(w => {
        w.fetcher.post(url)
          .then(body => {
            if (body.status === 'ok') {
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

  setPagination() {
    $('.pagination .pages').remove();
    let pages = this.totalPages;
    let html = new Array(pages).fill('').map((page, i) => {
      let klass = (i + 1) === this.currentPage ? 'active' : '';
      return `<li class="${klass} btn-link pages"><a>${i + 1}</a></li>`;
    }).join('');
    $('.pagination-left').after(html);
  }

  sortFeed(e) {
    let $e = $(e.target);
    let sortBy = $e.data('sort');
    if ($e.attr('id') === 'sortOrder') {
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
    if (search) {
      if (this.searchQuery === search) {
        return;
      } else if (!this.searchQuery) {
        this.setItemContent(true);
      }
      this.searchQuery = search;
      let regexp = new RegExp(search, 'i');
      $('#feedItems').isotope({
        filter: (items, item) => $(item).text().match(regexp)
      });
    } else if (this.searchQuery) {
      this.searchQuery = null;
      this.setItemContent();
    }
  }
}

let main = new Main();
$(() => {
  main.init();
  $('.button-collapse').sideNav();
});
