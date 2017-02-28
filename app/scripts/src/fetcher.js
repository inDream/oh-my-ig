function pdelay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

class Fetcher {
  constructor(options) {
    this.base = 'https://www.instagram.com/';
    this.syncEach = options.syncEach;
    this.token = null;
    this.lastCursor = null;
  }

  getJSON(url) {
    let options = {
      method: 'GET',
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'include'
    };
    return fetch(this.base + url, options)
      .then(res => res.json());
  }

  post(url, data) {
    let options = {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRFToken': this.token,
        'X-Instagram-Ajax': 1,
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'include'
    };
    if (data) {
      options.body = data;
    }
    return fetch(this.base + url, options)
      .then(res => res.json());
  }

  getDOM(html) {
    let doc;
    if (document.implementation) {
      doc = document.implementation.createHTMLDocument('');
      doc.documentElement.innerHTML = html;
    } else if (DOMParser) {
      doc = (new DOMParser).parseFromString(html, 'text/html');
    } else {
      doc = document.createElement('div');
      doc.innerHTML = html;
    }
    return doc;
  }

  storeItem(items) {
    let temp = {};
    items.forEach(item => {
      if (item.node) {
        item = item.node;
        item.date = item.taken_at_timestamp;
        delete item.taken_at_timestamp;
        item.caption = item.edge_media_to_caption.edges[0].node.text;
        delete item.edge_media_to_caption;
        item.likes = {
          count: item.edge_media_preview_like.count,
          viewer_has_liked: item.viewer_has_liked
        };
        delete item.edge_media_preview_like;
        item.comments = {
          count: item.edge_media_to_comment.count
        }
        delete item.edge_media_to_comment;
        item.code = item.shortcode;
        delete item.shortcode;
        item.display_src = item.display_url;
        delete item.display_url;
      };
      item.display_src = item.display_src.replace(/s\d+x\d+\//, '');
      let key = moment(item.date * 1000).startOf('day') / 100000;
      if (key) {
        if (temp[key] === undefined) {
          temp[key] = [];
        }
        temp[key].push(item);
      }
    });
    Object.keys(temp).forEach(key => {
      return DB.push(key, temp[key]);
    });
  }

  home() {
    return fetch(this.base, {credentials: 'include'})
      .then(res => res.text())
      .then(body => {
        let doc = this.getDOM(body);
        let s = doc.querySelectorAll('script');
        for (let i = 0; i < s.length; i++) {
          if (!s[i].src && s[i].textContent.indexOf('_sharedData') > 0) {
            s = s[i].textContent;
            break;
          }
        }
        let data = JSON.parse(s.match(/({".*})/)[1]);
        let feed = data.entry_data.FeedPage;
        if (!feed) {
          return false;
        }
        feed = feed[0].feed ? feed[0].feed.media : 
          feed[0].graphql.user.edge_web_feed_timeline;
        this.storeItem(feed.nodes ? feed.nodes : feed.edges);
        this.token = data.config.csrf_token;
        this.lastCursor = feed.page_info.end_cursor;
        s = doc = null;
        return true;
      });
  }

  feed(count, total) {
    let data = 'q=ig_me() { feed { media.after(' + this.lastCursor +
      ', ' + this.syncEach + ') {' +
      'nodes {id, caption, code, comments.last(4) { count, nodes {' + 
      'id, created_at, text, user { id, profile_pic_url, username }' +
      '}, page_info}, date, display_src, is_video, likes {' +
      'count, viewer_has_liked }, location { id, has_public_page, name },' +
      'owner { id, blocked_by_viewer, followed_by_viewer, full_name, ' +
      'has_blocked_viewer, is_private, profile_pic_url, ' +
      'requested_by_viewer, username }, ' +
      'usertags { nodes { user { username }, x, y } },' +
      'video_url, video_views}, page_info } }, ' +
      'id, profile_pic_url, username }&ref=feed%3A%3Ashow';
    return this.post('query/', data)
    .then(body => {
      let feed = body.feed.media;
      this.lastCursor = feed.page_info.end_cursor;
      this.storeItem(feed.nodes);
      count--;
      console.log(`Synced ${total - count}/${total} feed.`);
      chrome.browserAction.setBadgeText({text: `${total - count}/${total}`});
      if (count > 0 && feed.page_info.has_next_page) {
        return pdelay(2000).then(() => {
          this.feed(count, total);
        });
      } else {
        chrome.browserAction.setBadgeText({text: ''});
        return true;
      }
    });
  }

  auto(count) {
    count = count || 10;
    return this.home().then(res => {
      if (res) {
        return this.feed(count, count);
      }
      return res;
    });
  }
}
