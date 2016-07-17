chrome.promise = new ChromePromise();

const sL = chrome.promise.storage.local;
class DB {
  constructor() {
    this.cached = {};
    this.cleanTimer = null;
  }

  cleanCache() {
    clearTimeout(this.cleanTimer);
    this.cleanTimer = setTimeout(() => this._cleanCache(), 60 * 1000);
  }

  _cleanCache() {
    let keys = Object.keys(this.cached);
    for (let i = 0; i < keys.length; i++) {
      delete this.cached[keys[i]];
    }
  }

  gCached(key) {
    // Get item with cached result
    let ckey = key ? key : '_all_';
    this.cleanCache();
    if (this.cached[ckey]) {
      return Promise.resolve(this.cached[ckey]);
    } else {
      return sL.get(key)
        .then(items => {
          this.cached[ckey] = items;
          return key ? items[key] : items;
        });
    }
  }

  static g(key) {
    // Get all items or item with specific key
    return sL.get(key)
      .then(items => key ? items[key] : items);
  }

  static s(kv) {
    // Set an item with {key: value} object
    let key = Object.keys(kv)[0];
    return sL.set(kv)
      .then(() => sL.get(key))
      .then(items => items[key]);
  }

  static rm(key) {
    return sL.remove(key);
  }

  static push(key, items) {
    // Push new items into old list
    return DB.g(key)
      .then(old => {
        let updated = 0;
        if (old) {
          let ids = old.map(item => item.id);
          items = items.filter(item => {
            let oid = ids.indexOf(item.id);
            if (oid === -1) {
              return true;
            } else if (JSON.stringify(item) !== JSON.stringify(old[oid])) {
              old[oid] = item;
              updated++;
              return false;
            }
          });
        }
        console.log(`Updated ${updated} & saved ${items.length} in ${key}.`);
        if (updated || items.length) {
          return DB.s({[key]: (old || []).concat(items)});
        }
      });
  }
}
