function pdelay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}
const fixSrc = (s) => (s.replace(/\w\d+x\d+\//, ''));

class Fetcher {
  constructor(options) {
    this.base = 'https://www.instagram.com/';
    this.syncEach = options.syncEach;
    this.token = null;
    this.lastCursor = null;
    this.query_id = '17866917712078875';
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
        let caption = item.edge_media_to_caption.edges;
        item.caption = caption.length ? caption[0].node.text : '';
        delete item.edge_media_to_caption;
        item.likes = {
          count: item.edge_media_preview_like.count,
          viewer_has_liked: item.viewer_has_liked
        };
        delete item.edge_media_preview_like;
        item.comments = {
          count: item.edge_media_to_comment.count
        };
        delete item.edge_media_to_comment;
        item.code = item.shortcode;
        delete item.shortcode;
        item.display_src = item.display_url;
        delete item.display_url;
        let usertags = {nodes: []};
        if (item.edge_media_to_tagged_user.edges.length) {
          item.edge_media_to_tagged_user.edges.forEach(e => {
            usertags.nodes.push(e.node);
          });
        }
        item.usertags = usertags;
        delete item.edge_media_to_tagged_user;

        delete item.attribution;
        delete item.comments_disabled;
        delete item.edge_media_to_sponsor_user;
      }
      if (item.__typename === 'GraphSidecar') {
        let display_urls = [];
        item.edge_sidecar_to_children.edges.forEach(e => {
          let n = e.node;
          display_urls.push((n.is_video ? (n.video_url + '|') : '') + 
            fixSrc(n.display_url));
        });
        item.display_urls = display_urls;
        delete item.edge_sidecar_to_children;
      }
      item.display_src = fixSrc(item.display_src);
      let key = moment(item.date * 1000).startOf('day') / 100000;
      if (key) {
        if (temp[key] === undefined) {
          temp[key] = [];
        }
        temp[key].push(item);
      }
    });
    let newItems = Object.keys(temp).map(key => (DB.push(key, temp[key])));
    return Promise.all(newItems);
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
        feed = feed[0].graphql.user.edge_web_feed_timeline;
        this.storeItem(feed.edges);
        this.token = data.config.csrf_token;
        this.lastCursor = feed.page_info.end_cursor;

        let common = doc.querySelector('script[src*="Commons.js"]');
        common = this.base + common.getAttribute('src').slice(1); 
        return fetch(common, {credentials: 'include'});
      })
      .then(res => res.text())
      .then(body => {
        try {
          body = body.slice(body.indexOf(',"graphql_queries/feed/feed'))
          body = body.slice(body.indexOf('{'), body.indexOf('}') + 1)
          let query = body.match(/\w+/g);
          if (query) {
            this.query_id = query[3];
          }
        } catch(e) {}
        
        return true;
      });
  }

  feed(count, total) {
    let url = `graphql/query/?query_id=${this.query_id}&`+
      `fetch_media_item_count=${this.syncEach}&` +
      `fetch_media_item_cursor=${this.lastCursor}&` +
      'fetch_comment_count=4&fetch_like=10';
    return this.getJSON(url)
    .then(body => {
      let feed = body.data.user.edge_web_feed_timeline;
      this.lastCursor = feed.page_info.end_cursor;
      this.storeItem(feed.edges);
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
