class Media {
  constructor(options) {
    this.id = options.item.id;
    this.code = options.item.code;
    this.fetcher = options.fetcher;
  }

  static template(item, i) {
    let base = 'https://www.instagram.com/';
    let location = item.location ? item.location.name : '';
    let locationId = item.location ? item.location.id : '';
    let date = moment(item.date * 1000);
    let timeago = date.fromNow(true);
    let fulldate = date.format('LLLL');
    let caption = item.caption || '';
    let profile = `${base}${item.owner.username}/`;
    let link = `${base}p/${item.code}/`;
    let likeIcon = `favorite${item.likes.viewer_has_liked ? '' : '_border'}`;
    let itemCard = (item.is_video ? 
      `<div class="card-image card-video">
        <i class="material-icons">play_arrow</i>
        <a class="mfp mfp-iframe" href="${item.video_url}">` : 
      `<div class="card-image">
        <a class="mfp mfp-image" href="${item.display_src}">`) + 
      `<img src="${item.display_src}"></a></div>`;

    return `<div class="col s12 m6 l4">
      <div class="card" data-id="${i}">
        <div class="card-content card-header">
          <a class="left card-profile">
            <img src="${item.owner.profile_pic_url}">
          </a>
          <a href="${link}" class="right" target="_blank">
            <time data-date="${+date}" title="${fulldate}">${timeago}</time>
          </a>
          <div class="card-owner">
            <a class="owner" href="${profile}" target="_blank">${item.owner.username}</a>
            <span class="location">
              <br>
              <a href="${base}explore/locations/${locationId}/" target="_blank">${location}</a>
            </span>
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
          <a class="btn-link reloadBtn" title="Reload">
            <i class="material-icons">refresh</i>
          </a>
        </div>
      </div>
    </div>`;
  }

  like(liked) {
    let state = liked ? 'unlike' : 'like';
    let url = `web/likes/${this.id}/${state}/`;
    return this.fetcher.post(url)
      .then(body => {
        if (body.status === 'ok') {
          return this.updateCache();
        }
      });
  }

  updateCache() {
    return this.fetcher.getJSON(`p/${this.code}/?__a=1`)
      .then(body => {
        if (body.media) {
          let key = moment(body.media.date * 1000).startOf('day') / 100000;
          return this.fetcher.storeItem([body.media])
            .then(() => (DB.g(key + '')))
            .then(items => {
              let found = items.filter(item => (item.id === body.media.id));
              return found.length ? found[0] : null;
            });
        } else {
          return Promise.resolve(null);
        }
      });
  }

  static updateTimeElements() {
    $('time').each((i, e) => {
      let date = moment(+e.dataset.date);
      e.textContent = date.fromNow(true);
    });
  }
}
