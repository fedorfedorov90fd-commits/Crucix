// ═══════════════════════════════════════════════════════════════
//  CRUCIX DEEP LINK ENCODER v1.0.0
//  Кодирование/декодирование состояния 4 карт в URL hash.
//  Без зависимостей.
// ═══════════════════════════════════════════════════════════════

export class DeepLinkEncoder {
  encode(state) {
    const p = {};
    for (let i = 0; i < 4; i++) {
      const m = state.maps?.[i];
      if (!m) continue;
      const pf = `m${i}`;
      if (m.preset) p[`${pf}p`] = m.preset;
      if (m.center) p[`${pf}c`] = `${Number(m.center[0]).toFixed(2)},${Number(m.center[1]).toFixed(2)}`;
      if (m.zoom !== undefined) p[`${pf}z`] = Number(m.zoom).toFixed(1);
      if (m.pitch !== undefined) p[`${pf}t`] = Number(m.pitch).toFixed(0);
      if (m.bearing !== undefined) p[`${pf}b`] = Number(m.bearing).toFixed(0);
      if (m.activeLayers?.length) p[`${pf}l`] = m.activeLayers.join(',');
      if (m.selectedEntity) p[`${pf}e`] = m.selectedEntity;
    }
    if (state.layout) p.layout = state.layout;
    if (state.syncMode) p.sync = state.syncMode;
    if (state.activeMap !== undefined) p.active = state.activeMap;
    if (state.theme) p.theme = state.theme;
    if (state.selectedEntity) p.sel = state.selectedEntity;
    const qs = new URLSearchParams(p).toString();
    return `#${qs}`;
  }

  decode(hash) {
    const raw = String(hash || '').replace(/^#/, '');
    if (!raw) return null;
    const p = new URLSearchParams(raw);
    const state = {
      maps: [],
      layout: p.get('layout') || 'grid-2x2',
      syncMode: p.get('sync') || 'highlight',
      activeMap: parseInt(p.get('active') || '0', 10),
      theme: p.get('theme') || null,
      selectedEntity: p.get('sel') || null,
    };
    for (let i = 0; i < 4; i++) {
      const pf = `m${i}`;
      const preset = p.get(`${pf}p`);
      if (!preset) { state.maps[i] = null; continue; }
      const c = p.get(`${pf}c`);
      state.maps[i] = {
        preset,
        center: c ? c.split(',').map(Number) : [0, 20],
        zoom: parseFloat(p.get(`${pf}z`) || '1.5'),
        pitch: parseFloat(p.get(`${pf}t`) || '0'),
        bearing: parseFloat(p.get(`${pf}b`) || '0'),
        activeLayers: (p.get(`${pf}l`) || '').split(',').filter(Boolean),
        selectedEntity: p.get(`${pf}e`) || null,
      };
    }
    return state;
  }

  encodeSingle(map) {
    const p = new URLSearchParams({
      p: map.preset,
      c: `${Number(map.center[0]).toFixed(2)},${Number(map.center[1]).toFixed(2)}`,
      z: Number(map.zoom).toFixed(1),
    });
    if (map.activeLayers?.length) p.set('l', map.activeLayers.join(','));
    if (map.selectedEntity) p.set('e', map.selectedEntity);
    return `#${p.toString()}`;
  }

  decodeSingle(hash) {
    const raw = String(hash || '').replace(/^#/, '');
    if (!raw) return null;
    const p = new URLSearchParams(raw);
    const c = p.get('c');
    return {
      preset: p.get('p'),
      center: c ? c.split(',').map(Number) : [0, 20],
      zoom: parseFloat(p.get('z') || '1.5'),
      activeLayers: (p.get('l') || '').split(',').filter(Boolean),
      selectedEntity: p.get('e') || null,
    };
  }

  validate(state) {
    if (!state || !state.maps) return { valid: false, errors: ['no maps'] };
    const errors = [];
    for (let i = 0; i < state.maps.length; i++) {
      const m = state.maps[i];
      if (!m) continue;
      if (!m.preset) errors.push(`map ${i}: no preset`);
      if (m.center && (Math.abs(m.center[0]) > 90 || Math.abs(m.center[1]) > 180)) errors.push(`map ${i}: invalid center`);
      if (m.zoom < 0 || m.zoom > 22) errors.push(`map ${i}: invalid zoom`);
    }
    return { valid: errors.length === 0, errors };
  }
}

let _instance = null;
export function getDeepLinkEncoder() {
  if (!_instance) _instance = new DeepLinkEncoder();
  return _instance;
}
export function resetDeepLinkEncoder() { _instance = null; }
