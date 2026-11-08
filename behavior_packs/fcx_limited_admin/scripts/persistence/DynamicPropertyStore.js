export class DynamicPropertyStore {
  constructor(worldRef) {
    this.world = worldRef;
  }

  get(key) {
    return globalThis.__sqlite_get_prop_v2__("fcx_limited_admin", "world", key);
  }

  set(key, value) {
    globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", "world", key, value);
  }

  delete(key) {
    globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", "world", key, undefined);
  }

  keys() {
    return [];
  }
}
