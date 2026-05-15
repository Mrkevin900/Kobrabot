function getRuntimeStore(client) {
  if (!client.cache) {
    const CacheManager = require("./CacheManager");
    client.cache = new CacheManager();
  }
  return client.cache;
}

module.exports = {
  getRuntimeStore,
};
