class Media {
  constructor(media) {
    this.id = media.id;
    this.code = media.code;
    this.fetcher = media.fetcher;
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
          let found = false;
          let key = moment(body.media.date * 1000).startOf('day') / 100000;
          DB.g(key + '').then(items => {
            let newItems = items.map(item => {
              if (item.id === body.media.id) {
                found = true;
                return body.media;
              }
              return item;
            });
            if (found) {
              return DB.s({[key]: newItems});
            }
          });
          return body.media;
        }
      });
  }
}
