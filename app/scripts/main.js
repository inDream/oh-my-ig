moment.updateLocale('en', {
  relativeTime: {
    future: 'in %s',
    past: '%s ago',
    s: '%ds',
    m: '1m',
    mm: '%dm',
    h: '1h',
    hh: '%dh',
    d: '1d',
    dd: '%dd',
    M: '1M',
    MM: '%dM',
    y: '1y',
    yy: '%dy',
  },
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
    this.lastCount = null;
    this.lastKey = null;

    this.fetcher = null;
    chrome.runtime.getBackgroundPage((w) => { this.fetcher = w.fetcher; });
  }

  addDates() {
    if (localStorage.dates) {
      const dates = JSON.parse(localStorage.dates);
      this.addDatesHtml(dates);
      return Promise.resolve(dates);
    }
    return DB.g(null).then((items) => {
      delete items.options;
      delete items.stories;
      let dates = Object.keys(items).reverse();
      dates = dates.map(date => ({ key: date, count: items[date].length }));
      if (!localStorage.dates) {
        localStorage.dates = JSON.stringify(dates);
      }
      this.addDatesHtml(dates);
      return dates;
    });
  }

  getDateLabel(key) {
    let d = moment(key * 100000);
    d = d.format('DD/MM/YYYY');
    return d;
  }

  addDatesHtml(items) {
    let html = '';
    items.forEach((item) => {
      const d = this.getDateLabel(item.key);
      html += `<a data-date="${item.key}" class="collection-item">
      ${d}<span class="new badge">${item.count}</span></a>`;
    });
    $('#feedDates').html(html);
    $('.dropdown-trigger').dropdown({ coverTrigger: false });
  }

  init() {
    DB.g('options')
      .then((options) => {
        switch (window.location.pathname) {
          case '/feed.html':
            this.addDates().then((dates) => {
              this.lastCount = dates[0].count;
              this.lastKey = dates[0].key;
              this.loadFeed(dates[0].key);
            });
            // Setup auto reload
            if (options.autoReload) {
              setInterval(this.autoReload.bind(this), options.autoReload * 60000);
            }
            break;
          default:
        }
        this.feedPerPage = options.feedPerPage;
      });

    // Event handler
    $('#feedDates').on('click', 'a', (e) => {
      this.lastAct = +new Date();
      const date = `${$(e.currentTarget).data('date')}`;
      this.loadFeed(date);
      A.e('feed', 'click-date', this.getDateLabel(date));
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
    $('.dropdown-button').click((e) => {
      $(e.currentTarget).dropdown({ coverTrigger: false });
    });

    $('#feedItems').isotope();

    chrome.notifications.onClicked.addListener(() => {
      chrome.tabs.getCurrent((tab) => {
        chrome.tabs.update(tab.id, { active: true });
      });
    });

    $('.pagination').click((e) => {
      this.lastAct = +new Date();
      const $e = e.target.tagName === 'LI' ? $(e.target) :
        $(e.target).parents('li');
      if ($e.not('.active')) {
        if ($e.is('.pagination-left') && this.currentPage > 1) {
          this.currentPage -= 1;
        } else if ($e.is('.pagination-right') &&
          this.currentPage < this.totalPages) {
          this.currentPage += 1;
        } else if ($e.is('.pages')) {
          this.currentPage = +$e.text();
        } else {
          return;
        }
        switch (window.location.pathname) {
          case '/feed.html':
            this.setItemContent();
            break;
          default:
        }
        window.scrollTo(0, $('.section').offset().top - $('nav').height());
      }
    });

    setInterval(Media.updateTimeElements, 60 * 1000);
  }

  autoReload() {
    const needReload = (!this.searchQuery && !this.filterQuery) ||
      new Date() - this.lastAct > 15 * 60 * 1000;
    this.addDates().then((dates) => {
      const { count, key } = dates[0];
      const newItems = this.lastKey === key ? count - this.lastCount : count;
      if ((newItems > 0 || this.lastKey !== key) && needReload) {
        this.lastCount = count;
        this.lastKey = key;
        this.loadFeed(key);
        chrome.notifications.create('sync', {
          type: 'basic',
          iconUrl: 'images/icon-128.png',
          title: 'Oh My IG',
          message: `Synced ${newItems} new feed${newItems > 1 ? 's' : ''}.`,
        });
        A.e('feed', 'auto-reload', this.getDateLabel(key));
      }
    });
  }

  loadFeed(date) {
    this.currentKey = date;
    $('.titleDate').text(moment(+date * 100000).format('DD/MM/YYYY'));
    DB.g(date).then((items) => {
      this.sortItems(items);
      console.log(`Loaded ${items.length} items from ${date}.`);
      this.setItemContent();
    });
  }

  sortItems(items) {
    const s = this.sortBy;
    this.currentItems = items.sort((a, b) => {
      const x = this.sortOrder ? a : b;
      const y = this.sortOrder ? b : a;
      return s === 'date' ? x[s] - y[s] : x[s].count - y[s].count;
    });
    this.currentPage = 1;
    this.totalPages = this.countItems(this.currentItems);
  }

  countItems(items) {
    let total = 0;
    let page = 1;
    for (let i = 0; i < items.length; i += 1) {
      const e = items[i];
      const len = e.display_urls ? e.display_urls.length : 1;
      if (total + len > this.feedPerPage) {
        total = 0;
        page += 1;
      } else {
        total += len;
      }
    }
    return page;
  }

  getItems(items) {
    let res = [];
    let start = 0;
    let total = 0;
    let page = 1;
    for (let i = 0; i < items.length; i += 1) {
      const e = items[i];
      const len = e.display_urls ? e.display_urls.length : 1;
      res.push(e);
      if (total + len > this.feedPerPage) {
        if (this.currentPage !== page) {
          total = 0;
          start = i;
          res = [];
          page += 1;
        } else {
          break;
        }
      } else {
        total += len;
      }
    }
    return [start, res];
  }

  setItemContent() {
    this.lastAct = +new Date();
    const [start, items] = this.getItems(this.currentItems);
    let html = '';
    const $container = $('#feedItems');
    $container.empty().isotope('destroy');
    items.forEach((item, i) => {
      if (item.display_urls) {
        item.display_urls.forEach((e) => {
          const temp = Object.assign({}, item);
          if (e.indexOf('|') > 0) {
            const urls = e.split('|');
            temp.is_video = true;
            [temp.video_url, temp.display_src] = urls;
          } else {
            temp.is_video = false;
            temp.video_url = null;
            temp.display_src = e;
          }
          html += Media.template(temp, start + i);
        });
      } else {
        html += Media.template(item, start + i);
      }
    });
    $container.html(html);

    this.setLayout($container);
    this.setItemEvents();
  }

  setLayout($container) {
    $container.isotope().isotope('layout');

    $container.magnificPopup({
      delegate: '.mfp',
      gallery: {
        enabled: true,
        navigateByImgClick: true,
        preload: [0, 1],
      },
      image: {
        titleSrc: (item) => {
          const $card = item.el.parents('.card');
          const caption = $card.find('.caption').text();
          const owner = $card.find('.owner').text();
          const time = $card.find('time').text();
          return `<div class="card-owner"><span>${caption}</span>
            <small>by ${owner} ${time} ago</small></div>`;
        },
      },
    });

    const total = $container.find('img').length;
    let count = 0;
    $container.imagesLoaded()
      .progress(() => {
        count += 1;
        if (count % Math.round(total / 10) === 0) {
          $container.isotope('layout');
        }
      });

    this.setPagination();
  }

  updateItem(id, res) {
    if (res) {
      this.currentItems[id] = res;
      const $c = $(`.card[data-id="${id}"]`);
      const liked = res.viewer_has_liked;
      $c.find('.likeIcon i').text(`favorite${liked ? '' : '_border'}`);
      $c.find('.likes').text(res.likes.count);
      $c.find('.comments').text(res.comments.count);
    }
  }

  setItemEvents() {
    $('.caption').click((e) => {
      const $e = $(e.currentTarget);
      if ($e.height() > 80) {
        const caption = $e.text().replace(/\n/g, '<br>');
        $.magnificPopup.open({
          items: {
            src: `<div class="mfp-caption">${caption}</div>`,
            type: 'inline',
          },
        });
      }
    });

    $('.likeIcon').click((e) => {
      const $e = $(e.currentTarget);
      const id = $e.parents('.card').data('id');
      const item = this.currentItems[id];
      const liked = item.viewer_has_liked;
      new Media({ item, fetcher: this.fetcher })
        .like(liked)
        .then(res => this.updateItem(id, res));
      A.e('feed', 'click-like', this.getDateLabel(item.date / 100));
    });

    $('.reloadBtn').click((e) => {
      const $e = $(e.currentTarget);
      const id = $e.parents('.card').data('id');
      const item = this.currentItems[id];
      new Media({ item, fetcher: this.fetcher })
        .updateCache()
        .then(res => this.updateItem(id, res));
      A.e('feed', 'click-reload', this.getDateLabel(item.date / 100));
    });

    $('.deleteBtn').click(async (e) => {
      const $e = $(e.currentTarget);
      const id = $e.parents('.card').data('id');
      const item = this.currentItems[id];
      const key = moment(item.date * 1000).startOf('day') / 100000;
      DB.deleteItem(`${key}`, item.id);
      this.currentItems.splice(id, 1);
      this.sortItems(this.currentItems);
      this.setItemContent();
    });
  }

  setPagination() {
    $('.pagination .pages').remove();
    const pages = this.totalPages;
    const html = new Array(pages).fill('').map((page, i) => {
      const klass = (i + 1) === this.currentPage ? 'active' : '';
      return `<li class="${klass} btn-link pages"><a>${i + 1}</a></li>`;
    }).join('');
    $('.pagination-left').after(html);
  }

  sortFeed(e) {
    const $e = $(e.target);
    const sortBy = $e.data('sort');
    if ($e.attr('id') === 'sortOrder') {
      this.sortOrder = !this.sortOrder;
    } else if (sortBy) {
      this.sortBy = sortBy;
      const active = 'teal lighten-3';
      $('#sortFeed .btn').removeClass(active);
      $e.addClass(active);
    } else {
      return;
    }
    this.sortItems(this.currentItems);
    this.setItemContent();
    A.e('feed', 'sort', `${this.sortBy}-${this.sortOrder ? 'asc' : 'desc'}`);
  }

  filterFeed(e) {
    clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => this.filterFeedSub(e), 1000);
  }

  searchFeed() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.searchFeedSub(), 1000);
  }

  trim(s) {
    let str = s;
    str = str.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ');
    if (str.indexOf(' ') > -1) {
      str = str.split(' ').join('|');
    }
    return str;
  }

  filterFeedSub(e) {
    const filter = this.trim($(e.target).val());
    if (filter) {
      if (this.filterQuery === filter) {
        return;
      }
      this.filterQuery = filter;
      const matcher = this.getMatcher(filter);
      this.oldItems = this.currentItems.slice();
      this.sortItems(matcher.filter(this.currentItems));
      this.setItemContent();
      A.e('feed', 'filter', filter.split('|').length);
    } else if (this.filterQuery) {
      this.filterQuery = null;
      this.sortItems(this.oldItems.slice());
      this.oldItems = null;
      this.setItemContent();
    }
  }

  getMatcher(q) {
    const tagged = $('#searchTagged').prop('checked');
    const liked = $('#searchLiked').prop('checked');
    return new Matcher(q, tagged, liked);
  }

  searchFeedSub() {
    const search = this.trim($('#searchFeed').val());
    const liked = $('#searchLiked').prop('checked');
    if (search || liked) {
      if (this.searchQuery === search) {
        return;
      }
      const matcher = this.getMatcher(search);
      chrome.runtime.sendMessage({ action: 'search', matcher }, (items) => {
        if (liked) {
          A.e('feed', 'search', 'liked');
        }
        if (search) {
          this.searchQuery = search;
          A.e('feed', 'search', search.split('|').length);
        }
        this.sortItems(items);
        this.setItemContent();
      });
    } else if (this.searchQuery) {
      this.resetSearch();
    }
  }

  resetSearch() {
    let label = '';
    if (this.filterQuery) {
      label += `filter${this.searchQuery ? ' & ' : ''}`;
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
    const columns = $('#noOfColumns').val();
    const width = 100 / columns;
    const height = ((document.body.clientWidth * 0.9) / columns) - 10;
    const hide = Array.from($('.displayOpts:checked')).map(e => e.dataset.hide);
    const hideCSS = hide.length ? `${hide.join(', ')}{display: none;}` : '';
    $('#feedStyle').text(`
      #feedItems .col {width: ${width}%;}
      .mfp {height: ${height}px;}
      ${hideCSS}`);
    $('#feedItems').isotope('layout');
    A.e('feed', 'displayOpts', `${$('#noOfColumns').val()}-${hide.join('|')}`);
  }
}

const main = new Main();
$(() => {
  main.init();
  $('.sidenav').sidenav();
  $('.modal').modal();
});
