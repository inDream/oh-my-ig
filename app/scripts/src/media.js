class Media {
  constructor(options) {
    this.id = options.item.id;
    this.code = options.item.code;
    this.fetcher = options.fetcher;
    this.username = options.item.owner.username;
  }

  static template(item, i) {
    const base = 'https://www.instagram.com/';
    const location = item.location ? item.location.name : '';
    const locationId = item.location ? item.location.id : '';
    const date = moment(item.date * 1000);
    const timeago = date.fromNow(true);
    const fulldate = date.format('LLLL');
    const caption = item.caption || '';
    const profile = `${base}${item.owner.username}/`;
    const link = `${base}p/${item.code}/`;
    const likeIcon = `favorite${item.viewer_has_liked ? '' : '_border'}`;
    const src = item.display_src;
    const style = `style="background-image: url(${src});"`;
    const height = $(window).height() - 80;
    const id = `mfp-${src.match(/([\w\d_-]*)\.?[^\\/]*$/i)[1]}`;
    const itemCard = item.video_url ?
      `<div class="card-image card-video">
        <i class="material-icons">play_arrow</i>
        <a class="mfp" href="${item.video_url}" data-mfp-src="#${id}" ${style}>
        <div id="${id}" class="mfp-figure mfp-hide mfp-video">
          <video controls preload="none" style="max-height: ${height}px">
            <source src="${item.video_url}" type="video/mp4">
          </video>
          <div class="mfp-bottom-bar"><div class="mfp-title"><div class="card-owner">
            <span>${caption}</span>
            <small>by ${item.owner.username} ${timeago} ago</small>
          </div></div></div>
        </div>` :
      `<div class="card-image">
        <a class="mfp mfp-image" href="${src}" ${style}>
        <img src="${src}" />`;

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
        ${itemCard}</a></div>
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
          <a class="btn-link deleteBtn" title="Delete">
            <i class="material-icons">delete</i>
          </a>
        </div>
      </div>
    </div>`;
  }

  like(liked) {
    const state = liked ? 'unlike' : 'like';
    const url = `web/likes/${this.id}/${state}/`;
    return this.fetcher.post(url)
      .then((body) => {
        if (body.status === 'ok') {
          return this.updateCache();
        }
        return false;
      });
  }

  updateCache() {
    return this.fetcher.getJSON(`p/${this.code}/?__a=1`)
      .then((body) => {
        const media = body.graphql.shortcode_media;
        if (media) {
          return this.fetcher.storeItem([{ node: media }])
            .then((items) => {
              const found = items[0].filter(item => (item.id === media.id));
              return found.length ? found[0] : null;
            });
        }
        return Promise.resolve(null);
      });
  }

  static updateTimeElements() {
    $('time').each((i, e) => {
      const date = moment(+e.dataset.date);
      e.textContent = date.fromNow(true);
    });
  }
}

window.Media = Media;
