// happy-dom reports every <img> as already loaded-and-broken (complete, width 0). A browser
// reports an image that has not loaded yet as not complete, which is what components expect.
Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => false })
