import fs from 'node:fs'
import path from 'node:path'

export const defaultConfig = () => ({
  version: 1,
  apps: {},
  romFolders: [],
  romPaths: {},
  lastPlayed: null,
  appVersions: {},
  music: {
    enabled: true,
    muted: false,
    volume: 0.32,
    source: 'builtin',
    tracks: [],
  },
  covers: { auto: true },
  updates: { auto: true, lastCheck: null },
  tools: {},
  components: { lastCheck: null, latest: {} },
})

export function loadConfig(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    const defaults = defaultConfig()
    return {
      ...defaults,
      ...raw,
      apps: raw.apps && typeof raw.apps === 'object' ? raw.apps : {},
      romFolders: Array.isArray(raw.romFolders) ? raw.romFolders.filter(Boolean) : [],
      romPaths: raw.romPaths && typeof raw.romPaths === 'object' ? raw.romPaths : {},
      appVersions: raw.appVersions && typeof raw.appVersions === 'object' ? raw.appVersions : {},
      music: {
        ...defaults.music,
        ...(raw.music && typeof raw.music === 'object' ? raw.music : {}),
        tracks: Array.isArray(raw.music?.tracks) ? raw.music.tracks.filter(Boolean) : [],
      },
      covers: { ...defaults.covers, ...(raw.covers && typeof raw.covers === 'object' ? raw.covers : {}) },
      updates: { ...defaults.updates, ...(raw.updates && typeof raw.updates === 'object' ? raw.updates : {}) },
      tools: raw.tools && typeof raw.tools === 'object' ? raw.tools : {},
      components: {
        ...defaults.components,
        ...(raw.components && typeof raw.components === 'object' ? raw.components : {}),
        latest: raw.components?.latest && typeof raw.components.latest === 'object' ? raw.components.latest : {},
      },
    }
  } catch {
    return defaultConfig()
  }
}

export function saveConfig(file, config) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2))
  fs.renameSync(tmp, file)
}
