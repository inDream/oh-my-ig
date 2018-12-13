const pdelay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixSrc = (src) => {
  const s = src;
  if (s.match(/\/fr\/|_a\.jpg|1080x/)) {
    return s;
  }
  return s.replace(/c\d+\.\d+\.\d+\.\d+\//, '')
    .replace(/\w\d{3,4}x\d{3,4}\//g, s.match(/\/e\d{2}\//) ? '' : 'e15/');
};
const storeTypes = ['GraphImage', 'GraphSidecar', 'GraphVideo'];

class Fetcher {
  constructor(options) {
    this.base = 'https://www.instagram.com/';
    this.syncEach = options.syncEach;
    this.token = null;
    this.lastCursor = null;
    this.query_id = '17866917712078875';
    this.query_hash = 'bcbc6b4219dbbdf7af876bf561d7a283';
    this.rhxGis = '';
  }

  getJSON(url) {
    let variables = '';
    if (url.indexOf('variables') > 0) {
      variables = url.slice(url.indexOf('variables') + 10);
    } else {
      variables = `/${url.slice(0, url.indexOf('?'))}`;
    }
    const options = {
      method: 'GET',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-Instagram-GIS': md5(`${this.rhxGis}:${variables}`),
      },
      credentials: 'include',
    };
    return fetch(this.base + url, options)
      .then(res => res.json());
  }

  post(url, data) {
    const options = {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRFToken': this.token,
        'X-Instagram-Ajax': 1,
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'include',
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
      doc = (new DOMParser()).parseFromString(html, 'text/html');
    } else {
      doc = document.createElement('div');
      doc.innerHTML = html;
    }
    return doc;
  }

  storeItem(items) {
    const temp = {};
    for (let i = 0; i < items.length; i += 1) {
      let item = items[i];
      if (item.node) {
        item = item.node;
        if (storeTypes.indexOf(item.__typename) === -1) {
          continue;
        }
        item.date = item.taken_at_timestamp;
        const caption = item.edge_media_to_caption.edges;
        item.caption = caption.length ? caption[0].node.text : '';
        item.likes = {
          count: item.edge_media_preview_like.count,
        };
        item.comments = {
          count: item.edge_media_to_comment.count,
        };
        item.code = item.shortcode;
        item.display_src = fixSrc(item.display_url);
        const usertags = { nodes: [] };
        if (item.edge_media_to_tagged_user.edges.length) {
          item.edge_media_to_tagged_user.edges.forEach((e) => {
            usertags.nodes.push(e.node);
          });
        }
        item.usertags = usertags;

        item.owner = {
          full_name: item.owner.full_name,
          id: item.owner.id,
          profile_pic_url: item.owner.profile_pic_url,
          username: item.owner.username,
        };
      }
      if (item.__typename === 'GraphSidecar') {
        const display_urls = []; // eslint-disable-line camelcase
        item.edge_sidecar_to_children.edges.forEach((e) => {
          const n = e.node;
          display_urls.push((n.is_video ? (`${n.video_url}|`) : '') +
            fixSrc(n.display_url));
        });
        item.display_urls = display_urls; // eslint-disable-line camelcase
      }
      const fields = ['caption', 'code', 'comments', 'date', 'display_src',
        'display_urls', 'video_url', 'id', 'likes', 'location', 'owner',
        'usertags', 'viewer_has_liked'];
      Object.keys(item).forEach((key) => {
        if (fields.indexOf(key) === -1) {
          delete item[key];
        }
      });
      const key = moment(item.date * 1000).startOf('day') / 100000;
      if (key) {
        if (temp[key] === undefined) {
          temp[key] = [];
        }
        temp[key].push(item);
      }
    }
    const newItems = Object.keys(temp).map(key => (DB.push(key, temp[key])));
    return Promise.all(newItems);
  }

  home() {
    return fetch(this.base, { credentials: 'include' })
      .then(res => res.text())
      .then((body) => {
        if (!body) {
          return Promise.reject();
        }
        const doc = this.getDOM(body);
        let s = doc.querySelectorAll('script');
        for (let i = 0; i < s.length; i += 1) {
          if (!s[i].src && s[i].textContent.indexOf('_sharedData') > 0) {
            s = s[i].textContent;
            break;
          }
        }
        const data = JSON.parse(s.match(/({".*})/)[1]);
        let feed = data.entry_data.FeedPage;
        this.rhxGis = data.rhx_gis;
        if (!feed) {
          return Promise.reject();
        }
        try {
          feed = feed[0].graphql.user.edge_web_feed_timeline;
          this.storeItem(feed.edges);
          this.lastCursor = feed.page_info.end_cursor;
        } catch (e) {
          this.lastCursor = null;
        }
        this.token = data.config.csrf_token;

        let common = doc.querySelector('script[src*="Commons.js"]');
        common = this.base + common.getAttribute('src').slice(1);
        return fetch(common, { credentials: 'include' });
      })
      .then(res => res.text())
      .then((rawBody) => {
        let body = rawBody;
        try {
          let hash = body.slice(0, body.indexOf('edge_web_feed_timeline'))
            .match(/\w="\w{32}",\w="\w{32}",\w="\w{32}"/g);
          this.query_hash = hash[hash.length - 1].slice(3, 35);
        } catch (e) {
          this.query_hash = null;
        }
        return true;
      });
  }

  feed(oldCount, total) {
    let url = null;
    if (this.query_hash) {
      const data = JSON.stringify({
        fetch_media_item_count: this.syncEach,
        fetch_media_item_cursor: this.lastCursor,
        fetch_comment_count: 4,
        fetch_like: 10,
        has_stories: false,
      });
      url = `hash=${this.query_hash}&variables=${encodeURIComponent(data)}`;
    } else {
      url = `id=${this.query_id}&` +
        `fetch_media_item_count=${this.syncEach}&` +
        `fetch_media_item_cursor=${this.lastCursor}&` +
        'fetch_comment_count=4&fetch_like=10';
    }
    return this.getJSON(`graphql/query/?query_${url}`).then((body) => {
      const feed = body.data.user.edge_web_feed_timeline;
      this.lastCursor = feed.page_info.end_cursor;
      this.storeItem(feed.edges);
      const count = oldCount - 1;
      console.log(`Synced ${total - count}/${total} feed.`);
      chrome.browserAction.setBadgeText({ text: `${total - count}/${total}` });
      if (count > 0 && feed.page_info.has_next_page) {
        return pdelay(2000).then(() => {
          this.feed(count, total);
        });
      }
      return chrome.browserAction.setBadgeText({ text: '' });
    });
  }

  auto(count = 10) {
    return this.home().then((res) => {
      if (res) {
        return this.feed(count, count);
      }
      return res;
    });
  }
}

window.Fetcher = Fetcher;
