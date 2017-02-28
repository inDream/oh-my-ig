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
    this.db = new DB();

    this.base = 'https://www.instagram.com/';
    this.currentKey = null;
    this.currentItems = null;
    this.currentPage = null;
    this.totalPages = null;
    this.filterQuery = null;
    this.searchQuery = null;
    this.sortBy = 'date';
    this.sortOrder = false;
    this.lastAct = null;

    this.fetcher = null;
    chrome.runtime.getBackgroundPage(w => {this.fetcher = w.fetcher});
  }

  addDates() {
    return DB.g(null).then(items => {
      delete items.options;
      let dates = Object.keys(items).reverse();
      dates = dates.map(date => {
        return {key: date, count: items[date].length};
      });
      this._addDates(dates);
      return dates;
    });
  }

  _getDateLabel(key) {
    let d = moment(key * 100000);
    d = d.format('DD/MM/YYYY');
    return d;
  }

  _addDates(items) {
    let html = '';
    items.forEach(item => {
      let d = this._getDateLabel(item.key);
      html += `<a data-date="${item.key}" class="collection-item">
      ${d}<span class="new badge">${item.count}</span></a>`;
    });
    $('#feedDates').html(html);
    $('.dropdown-button').dropdown();
  }

  init() {
    this.addDates().then(dates => {
      this.loadFeed(dates[0].key);
    });

    // Event handler
    $('#feedDates').on('click', 'a', (e) => {
      this.lastAct = +new Date();
      let date = $(e.currentTarget).data('date') + '';
      this.loadFeed(date);
      A.e('feed', 'click-date', this._getDateLabel(date));
    });

    $('#sortOrder').click();
    $('#sortFeed').click(this.sortFeed.bind(this));
    $('#filterFeed').keyup(this.filterFeed.bind(this));
    $('#searchFeed').keyup(this.searchFeed.bind(this));
    $('#searchLiked, #searchTagged').click(this.searchFeed.bind(this));
    $('#resetSearch').click(this.resetSearch.bind(this));
    $('#noOfColumns, .displayOpts').change(this.setDisplayOpts.bind(this));
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

    chrome.notifications.onClicked.addListener(() => {
      chrome.tabs.getCurrent(tab => {
        chrome.tabs.update(tab.id, {active: true});
      });
    });

    $('.pagination').click((e) => {
      this.lastAct = +new Date();
      let $e = e.target.tagName === 'LI' ? $(e.target) :
        $(e.target).parents('li');
      if ($e.not('.active')) {
        if ($e.is('.pagination-left') && this.currentPage > 1) {
          this.currentPage--;
        } else if ($e.is('.pagination-right') && 
          this.currentPage < this.totalPages) {
          this.currentPage++;
        } else if ($e.is('.pages')) {
          this.currentPage = +$e.text();
        } else {
          return;
        }
        this.setItemContent();
        window.scrollTo(0, $('.section').offset().top - $('nav').height());
      }
    });

    setInterval(Media.updateTimeElements, 60 * 1000);
  }

  autoReload() {
    this.addDates().then(dates => {
      if (dates[0].key !== this.currentKey &&
        !this.searchQuery && !this.filterQuery &&
        new Date() - this.lastAct > 5 * 60 * 1000) {
        this.loadFeed(dates[0].key);
      }
    });
    DB.g(this.currentKey)
      .then(items => {
        let newItems = items.length - this.currentItems.length;
        if (newItems > 0 && !this.searchQuery && !this.filterQuery) {
          chrome.notifications.create('sync', {
            type: 'basic',
            iconUrl: 'images/icon-128.png',
            title: 'Oh My IG',
            message: `Synced ${newItems} new feed${newItems > 1 ? 's' : ''}.`
          });
          this.loadFeed(this.currentKey);
        }
      });
    A.e('feed', 'auto-reload', this._getDateLabel(this.currentKey));
  }

  loadFeed(date) {
    this.currentKey = date;
    $('.titleDate').text(moment(+date * 100000).format('DD/MM/YYYY'));
    DB.g(date).then(items => {
      this._sortItems(items);
      console.log(`Loaded ${items.length} items from ${date}.`);
      this.setItemContent();
    });
  }

  _sortItems(items) {
    let s = this.sortBy;
    this.currentItems = items.sort((a, b) => {
      let x = this.sortOrder ? a : b;
      let y = this.sortOrder ? b : a;
      return s === 'date' ? x[s] - y[s] : x[s].count - y[s].count;
    });
    this.currentPage = 1;
  }

  setItemContent() {
    let start = this.feedPerPage * (this.currentPage - 1);
    let items = this.currentItems.slice(start, start + this.feedPerPage);
    this.totalPages = Math.ceil(this.currentItems.length / this.feedPerPage);
    let html = '';
    let $container = $('#feedItems');
    $container.empty().isotope('destroy');
    items.forEach((item, i) => {
      html += Media.template(item, start + i);
    });
    $container.html(html);

    $container.isotope().isotope('layout');

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
    $('.caption').click(e => {
      let $e = $(e.currentTarget);
      if ($e.height() > 80) {
        let caption = $e.text().replace(/\n/g, '<br>');
        $.magnificPopup.open({
          items: {
            src: `<div class="mfp-caption">${caption}</div>`,
            type: 'inline'
          }
        });
      }
    });

    $('.likeIcon').click(e => {
      let $e = $(e.currentTarget);
      let item = this.currentItems[$e.parents('.card').data('id')];
      let liked = item.likes.viewer_has_liked;
      new Media({item: item, fetcher: this.fetcher})
        .like(liked)
        .then(res => {
          if (res) {
            $e.find('i').text(`favorite${liked ? '_border' : ''}`);
            $e.find('.likes').text(res.likes.count);
            $e.find('.comments').text(res.comments.count);
          }
        });
      A.e('feed', 'click-like', this._getDateLabel(item.date / 100));
    });

    $('.reloadBtn').click(e => {
      let $e = $(e.currentTarget);
      let id = $e.parents('.card').data('id');
      let item = this.currentItems[id];
      new Media({item: item, fetcher: this.fetcher})
        .updateCache()
        .then(res => {
          this.currentItems[id] = res;
          this._sortItems(this.currentItems);
          this.setItemContent();
        });
      A.e('feed', 'click-reload', this._getDateLabel(item.date / 100));
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
    this._sortItems(this.currentItems);
    this.setItemContent();
    A.e('feed', 'sort', `${this.sortBy}-${this.sortOrder ? 'asc' : 'desc'}`);
  }

  filterFeed(e) {
    clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => this._filterFeed(e), 500);
  }

  searchFeed() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this._searchFeed(), 500);
  }

  _matchFeed(items, regexp, query) {
    let tagged = $('#searchTagged').prop('checked');
    return items.filter(item => {
      let str = item.caption + item.owner.username + item.owner.full_name +
        (item.location ? item.location.name : '') +
        (!tagged || !item.usertags.nodes.length ? '' :
        item.usertags.nodes.map(u => u.user ? u.user.username : '').join(' '));
      return regexp.test(str) || item.owner.id === query;
    });
  }

  trim(str) {
    str = str.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ');
    if (str.indexOf(' ') > -1) {
      str = str.split(' ').join('|');
    }
    return str
  }

  _filterFeed(e) {
    let filter = this.trim($(e.target).val());
    if (filter) {
      if (this.filterQuery === filter) {
        return;
      }
      this.filterQuery = filter;
      let regexp = new RegExp(filter, 'i');
      this.oldItems = this.currentItems.slice();
      this._sortItems(this._matchFeed(this.currentItems, regexp, filter));
      this.setItemContent();
      A.e('feed', 'filter', filter.split('|').length);
    } else if (this.filterQuery) {
      this.filterQuery = null;
      this.currentItems = this.oldItems.slice();
      this.oldItems = null;
      this.setItemContent();
    }
  }

  _searchFeed() {
    let search = this.trim($('#searchFeed').val());
    let liked = $('#searchLiked').prop('checked');
    if (search || liked) {
      if (this.searchQuery === search) {
        return;
      }
      let regexp = new RegExp(search, 'i');
      this.db.gCached(null).then(items => {
        delete items.options;
        let dates = Object.keys(items).reverse();
        let result = [];
        dates.forEach(date => {
          result = result.concat(this._matchFeed(items[date], regexp, search));
        });
        if (liked) {
          result = result.filter(item => item.likes.viewer_has_liked);
          A.e('feed', 'search', 'liked');
        }
        if (search) {
          this.searchQuery = search;
          A.e('feed', 'search', search.split('|').length);
        }
        this._sortItems(result);
        this.setItemContent();
      });
    } else if (this.searchQuery) {
      this.resetSearch();
    }
  }

  resetSearch() {
    let label = '';
    if (this.filterQuery) {
      label += 'filter' + (this.searchQuery ? ' & ' : '');
    }
    if (this.searchQuery) {
      label += 'search';
    }
    A.e('feed', 'click-reset', label);
    $('#filterFeed').val('');
    this.filterQuery = null;
    this.searchQuery = null;
    this.loadFeed(this.currentKey);
  }

  setDisplayOpts() {
    let width = 100 / $('#noOfColumns').val();
    let hide = Array.from($('.displayOpts:checked')).map(e => e.dataset.hide);
    let hideCSS = hide.length ? hide.join(', ') + '{display: none;}' : '';
    $('#feedStyle').text(`#feedItems .col {width: ${width}%;} ${hideCSS}`);
    $('#feedItems').isotope('layout');
    A.e('feed', 'displayOpts', $('#noOfColumns').val() + '-' + hide.join('|'));
  }
}

let main = new Main();
$(() => {
  main.init();
  $('.button-collapse').sideNav();
});
