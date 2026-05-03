class CacheManager {
  constructor(defaultTTL = 3600000) { // Default 1 heure
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    
    // Nettoyage automatique toutes les 10 minutes pour eviter les memory leaks
    setInterval(() => this.cleanup(), 600000).unref?.();
  }

  set(key, value, ttl = this.defaultTTL) {
    this.cache.set(key, {
      value,
      expires: ttl === 0 ? Infinity : Date.now() + ttl
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return item.value;
  }

  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = CacheManager;
