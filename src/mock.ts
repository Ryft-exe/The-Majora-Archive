import { APP_DEFS } from '../shared/apps.js'
import { GAMES } from '../shared/catalog.js'
import { COMPONENTS, MANUAL_COMPONENTS } from '../shared/components.js'
import { COVER_SOURCES } from '../shared/covers.js'
import { enrichState } from '../shared/enrich.js'
import { MODS } from '../shared/mods.js'
import type { AppConfig, Bridge, ComponentInfo, LauncherState, ModEntry, MusicSource, UpdateEntry } from './types'

const fakeApps: Record<string, any> = {}

for (const [key, def] of Object.entries(APP_DEFS as Record<string, any>)) {
  fakeApps[key] = {
    ...def,
    key,
    found: false,
    path: null,
    cores: [],
    corePaths: {},
    setupFound: false,
    setupPath: null,
  }
}

fakeApps.triforce = {
  ...fakeApps.triforce,
  found: true,
  path: 'C:\\Users\\Player\\Games\\Triforce\\Triforce.exe',
  setupFound: true,
  setupPath: 'C:\\Users\\Player\\AppData\\Local\\Programs\\Triforce\\TriforceSetup.exe',
}

fakeApps.retroarch = {
  ...fakeApps.retroarch,
  found: true,
  path: 'C:\\RetroArch-Win64\\retroarch.exe',
  cores: ['mesen_libretro.dll', 'snes9x_libretro.dll', 'gambatte_libretro.dll', 'mgba_libretro.dll'],
}

fakeApps.dolphin = {
  ...fakeApps.dolphin,
  found: true,
  path: 'C:\\Users\\Player\\AppData\\Local\\Programs\\Dolphin\\Dolphin.exe',
}

const state = (enrichState as (input: any) => unknown)({
  config: {
    romFolders: ['C:\\Users\\Player\\ROMs'],
    romPaths: {},
    lastPlayed: { gameId: 'ocarina-of-time', at: new Date().toISOString() },
  },
  apps: fakeApps,
  roms: {
    'the-legend-of-zelda': [
      { path: 'C:\\Users\\Player\\ROMs\\Legend of Zelda, The (USA).nes', ext: '.nes', score: 30 },
    ],
    'a-link-to-the-past': [
      { path: 'C:\\Users\\Player\\ROMs\\Legend of Zelda - A Link to the Past (USA).sfc', ext: '.sfc', score: 30 },
    ],
  },
  romFolders: ['C:\\Users\\Player\\ROMs'],
  platform: 'win32',
  version: '0.2.0',
  coverUrl: (id: string) => {
    const source = (COVER_SOURCES as Record<string, { ext?: string }>)[id]
    return source ? `/covers/${id}${source.ext || '.png'}` : null
  },
  logoUrl: (id: string) => (id === 'ocarina-of-time-switch-2' ? '/covers/triforce-logo.png' : null),
}) as LauncherState

const mockModEntries = (MODS as ModEntry[]).map((mod) => ({
  ...mod,
  build: null,
  folder: null,
  gameReady: false,
  installed: mod.id === 'mm-graphics-overhaul',
  paused: false,
  canInstall: false,
}))

state.mods = { entries: mockModEntries }
state.appUpdate = { status: 'current', version: null, percent: 0, message: '' }

const now = new Date().toISOString()

const updates: UpdateEntry[] = [
  {
    key: 'triforce',
    name: 'Triforce',
    game: 'Ocarina of Time · Switch 2',
    site: 'https://triforceproject.com/',
    setupPath: fakeApps.triforce.setupPath,
    appPath: fakeApps.triforce.path,
    updateKind: 'setup',
    installed: 'v0.7.0',
    latest: 'v0.7.0',
    available: false,
    status: 'current',
    message: '',
    releaseUrl: 'https://git.triforceproject.com/triforce/downloads/releases',
    releaseName: 'Triforce v0.7.0: Sage Of Courage',
  },
  {
    key: 'sot',
    name: 'Ship of Harkinian',
    game: 'Ocarina of Time · N64 decomp',
    site: 'https://www.shipofharkinian.com/',
    setupPath: null,
    appPath: null,
    updateKind: 'download',
    installed: '9.2.0',
    latest: '9.3.1',
    available: true,
    status: 'available',
    message: '',
    releaseUrl: 'https://github.com/HarbourMasters/Shipwright/releases',
    assetName: 'SoH-Dewey-Bravo-Win64.zip',
    assetUrl: 'https://github.com/HarbourMasters/Shipwright/releases',
  },
  {
    key: 'twoShip',
    name: '2 Ship 2 Harkinian',
    game: 'Majora’s Mask · N64 decomp',
    site: 'https://github.com/HarbourMasters/2ship2harkinian',
    setupPath: null,
    appPath: null,
    updateKind: 'download',
    installed: '4.0.0',
    latest: '5.0.1',
    available: true,
    status: 'available',
    message: '',
    releaseUrl: 'https://github.com/HarbourMasters/2ship2harkinian/releases',
    assetName: '2Ship-Battler-Bravo-Win64.zip',
    assetUrl: 'https://github.com/HarbourMasters/2ship2harkinian/releases',
  },
  {
    key: 'zelda64recomp',
    name: 'Zelda 64: Recompiled',
    game: 'Majora’s Mask · N64 recomp',
    site: 'https://github.com/Zelda64Recomp/Zelda64Recomp',
    setupPath: null,
    appPath: null,
    updateKind: 'download',
    installed: 'v1.2.2',
    latest: 'v1.2.2',
    available: false,
    status: 'current',
    message: '',
    releaseUrl: 'https://github.com/Zelda64Recomp/Zelda64Recomp/releases',
  },
  {
    key: 'triaevumOot',
    name: 'TriAevum: Echoes of Time',
    game: 'Ocarina of Time 3D · recomp',
    site: 'https://github.com/coccofresco/TriAevum',
    setupPath: null,
    appPath: null,
    updateKind: 'download',
    installed: null,
    latest: null,
    available: false,
    status: 'manual',
    message: 'No public release feed yet — check the project page.',
    releaseUrl: 'https://github.com/coccofresco/TriAevum',
  },
]

state.music = {
  enabled: true,
  muted: false,
  volume: 0.32,
  source: 'builtin',
  tracks: [],
  folder: 'C:\\Users\\Player\\AppData\\Roaming\\Majora Archive\\music',
}
state.covers = {
  found: Math.min(Object.keys(COVER_SOURCES).length, 38),
  total: GAMES.length,
  availableSystems: 13,
}
state.updates = updates
state.updatesChecking = false
state.updatesAuto = true
state.updatesCheckedAt = now

const componentEntries: ComponentInfo[] = [
  ...(COMPONENTS as any[]).map((component) => {
    const installed = component.key === 'azahar' || component.key === 'mgba'
    const version = component.key === 'mgba' ? '0.10.5' : '2126.2'
    const builds = (component.builds as any[]).map((build, index) => ({
      key: build.key,
      name: build.name,
      by: build.by,
      role: build.role,
      repo: build.repo || null,
      site: build.site || null,
      link: build.link || null,
      license: build.license,
      note: build.note || null,
      installable: Boolean(build.repo),
      installed: installed && index === 0,
      managed: installed && index === 0,
      version: installed && index === 0 ? version : null,
      latest: null,
      updateAvailable: false,
      path: installed && index === 0 ? `C:\\Users\\Player\\AppData\\Roaming\\Majora Archive\\tools\\${component.key}` : null,
      dir: null,
      sha256: null,
      verified: installed && index === 0 ? true : null,
      installedAt: installed && index === 0 ? now : null,
      assetName: null,
    }))
    return {
      key: component.key,
      name: component.name,
      kind: component.kind,
      systems: component.systems,
      site: component.site,
      license: component.license,
      note: component.note,
      needs: component.needs || [],
      automatic: true,
      reason: null,
      build: builds[0].key,
      builds,
      installed,
      managed: installed,
      version: installed ? version : null,
      latest: component.key === 'mgba' ? '0.10.5' : null,
      updateAvailable: false,
      path: installed ? `C:\\Users\\Player\\AppData\\Roaming\\Majora Archive\\tools\\${component.key}` : null,
      sha256: null,
      verified: installed ? true : null,
      installedAt: installed ? now : null,
      assetName: null,
    }
  }),
  ...(MANUAL_COMPONENTS as any[]).map((component) => {
    const found = Boolean(fakeApps[component.key]?.found)
    const builds = (component.builds as any[]).map((build) => ({
      key: build.key,
      name: build.name,
      by: build.by,
      role: build.role || 'official',
      repo: null,
      site: build.site || component.site,
      link: build.link || build.site || component.site,
      license: build.license || component.license,
      note: build.note || null,
      installable: false,
      installed: found,
      managed: false,
      version: null,
      latest: null,
      updateAvailable: false,
      path: fakeApps[component.key]?.path || null,
      dir: null,
      sha256: null,
      verified: null,
      installedAt: null,
      assetName: null,
    }))
    return {
      key: component.key,
      name: component.name,
      kind: component.kind,
      systems: component.systems,
      site: component.site,
      license: component.license,
      note: null,
      needs: component.needs || [],
      automatic: false,
      reason: component.reason,
      build: builds[0]?.key || 'official',
      builds,
      installed: found,
      managed: false,
      version: null,
      latest: null,
      updateAvailable: false,
      path: fakeApps[component.key]?.path || null,
      sha256: null,
      verified: null,
      installedAt: null,
      assetName: null,
    }
  }),
]

state.components = {
  toolsDir: 'C:\\Users\\Player\\AppData\\Roaming\\Majora Archive\\tools',
  lastCheck: null,
  entries: componentEntries,
}

const clone = (): LauncherState => JSON.parse(JSON.stringify(state))
const musicSource = (value: string): MusicSource => (value === 'files' ? 'files' : 'builtin')

const mockConfig = (key: string): AppConfig => ({
  app: key,
  name: key === 'dolphin' ? 'Dolphin' : key === 'sot' ? 'Ship of Harkinian' : key,
  note: 'Preview data — the desktop app reads the real file.',
  controlsNote: null,
  exePath: `C:\\Users\\Player\\Games\\${key}\\${key}.exe`,
  files: [
    {
      id: 'main',
      label: key === 'dolphin' ? 'Dolphin.ini' : 'config.ini',
      format: 'ini',
      path: `C:\\Users\\Player\\AppData\\Roaming\\${key}\\config.ini`,
      candidates: [],
      exists: true,
      foundPath: `C:\\Users\\Player\\AppData\\Roaming\\${key}\\config.ini`,
      editable: true,
      isText: true,
      size: 2048,
      entries: [
        { section: 'Core', key: 'GFXBackend', value: 'Vulkan', type: 'text' },
        { section: 'Core', key: 'CPUThread', value: 'True', type: 'bool' },
        { section: 'Settings', key: 'InternalResolution', value: '3', type: 'int' },
      ],
      controls: [],
      backupExists: false,
      quick: [
        {
          id: 'main:Core:GFXBackend',
          fileId: 'main',
          label: 'Graphics backend',
          type: 'enum',
          options: [
            ['Vulkan', 'Vulkan'],
            ['OGL', 'OpenGL'],
          ],
          note: 'Preview only.',
          section: 'Core',
          key: 'GFXBackend',
          path: null,
          value: 'Vulkan',
          also: null,
        },
        {
          id: 'main:Core:CPUThread',
          fileId: 'main',
          label: 'Dual core',
          type: 'bool',
          options: null,
          note: null,
          section: 'Core',
          key: 'CPUThread',
          path: null,
          value: 'True',
          also: null,
        },
      ],
      text: '[Core]\nGFXBackend = Vulkan\nCPUThread = True\n',
      error: null,
    },
  ],
})

export const mockBridge: Bridge = {
  getState: async () => clone(),
  readAppConfig: async (key) => ({ ok: true, config: mockConfig(key) }),
  writeConfigValue: async () => ({ ok: false, message: 'Preview only — open the desktop app to save settings.' }),
  writeConfigText: async () => ({ ok: false, message: 'Preview only — open the desktop app to save settings.' }),
  restoreConfigBackup: async () => ({ ok: false, message: 'Preview only — open the desktop app to restore backups.' }),
  openConfigFile: async () => ({ ok: false, message: 'Preview only — open the desktop app to reveal files.' }),
  launch: async (gameId, variantId) => {
    const game = state.games.find((entry) => entry.id === gameId)
    const variant = game?.variants.find((entry) => entry.id === variantId)
    if (!variant?.ready) return { ok: false, message: 'This one needs a little setup first.' }
    return { ok: true, message: `Preview: ${game?.title} would start now.`, state: clone() }
  },
  launchApp: async () => ({ ok: false, message: 'Preview only — open the desktop app to start programs.' }),
  openTriforce: async () => ({ ok: false, message: 'Preview only — open the desktop app to start Triforce Setup.' }),
  pickApp: async () => ({ ok: false, message: 'Preview only — path pickers work in the desktop app.' }),
  pickRom: async () => ({ ok: false, message: 'Preview only — path pickers work in the desktop app.' }),
  addRomFolder: async () => ({ ok: false, message: 'Preview only — folder pickers work in the desktop app.' }),
  removeRomFolder: async () => ({ ok: true, message: 'Preview only.', state: clone() }),
  rescan: async () => clone(),
  openPath: async () => ({ ok: false, message: 'Preview only.' }),
  openExternal: async (url) => {
    window.open(url, '_blank', 'noopener,noreferrer')
    return { ok: true }
  },
  openDataFolder: async () => ({ ok: false, message: 'Preview only.' }),
  window: async () => ({ ok: false }),

  refreshCovers: async () => ({
    ok: true,
    message: 'Preview: covers are served from the local Majora Archive cache.',
    state: clone(),
  }),
  openCoverFolder: async () => ({ ok: false, message: 'Preview only.' }),

  updateMusic: async (patch) => {
    state.music = { ...state.music, ...patch, source: musicSource(patch.source || state.music.source) }
    return { ok: true, state: clone() }
  },
  addMusic: async () => ({
    ok: false,
    message: 'Preview only — add music files in the desktop app.',
  }),
  removeMusic: async (file) => {
    state.music.tracks = state.music.tracks.filter((track) => track.path !== file && track.url !== file)
    return { ok: true, message: 'Track removed.', state: clone() }
  },
  openMusicFolder: async () => ({ ok: false, message: 'Preview only.' }),
  rescanMusic: async () => ({ ok: true, state: clone() }),

  installComponent: async () => ({
    ok: false,
    message: 'Preview only — component downloads run in the desktop app.',
  }),
  removeComponent: async () => ({ ok: false, message: 'Preview only.' }),
  checkComponents: async () => ({
    ok: true,
    message: 'Preview: release feeds already loaded.',
    state: clone(),
  }),
  openToolsFolder: async () => ({ ok: false, message: 'Preview only.' }),

  checkUpdates: async () => {
    state.updatesCheckedAt = new Date().toISOString()
    return { ok: true, message: 'Preview: update feeds already loaded.', state: clone() }
  },
  downloadUpdate: async () => ({
    ok: false,
    message: 'Preview only — downloads run in the desktop app.',
  }),
  setUpdateAuto: async (auto) => {
    state.updatesAuto = auto
    return { ok: true, state: clone() }
  },
  openUpdateFolder: async () => ({ ok: false, message: 'Preview only.' }),

  modsState: async () => ({ entries: mockModEntries }),
  installMod: async () => ({ ok: false, message: 'Preview only — install mods in the desktop app.' }),
  importMod: async () => ({ ok: false, message: 'Preview only — import mods in the desktop app.' }),
  toggleMod: async () => ({ ok: false, message: 'Preview only — mod toggles work in the desktop app.' }),
  removeMod: async () => ({ ok: false, message: 'Preview only.' }),
  openModFolder: async () => ({ ok: false, message: 'Preview only.' }),

  checkAppUpdate: async () => ({ ok: true, message: 'Preview: launcher updates check in the installed build.' }),
  downloadAppUpdate: async () => ({ ok: false, message: 'Preview only.' }),
  installAppUpdate: async () => ({ ok: false, message: 'Preview only.' }),
  onAppUpdate: () => () => {},

  onCoversUpdated: () => () => {},
  onUpdatesUpdated: () => () => {},
  onComponentProgress: () => () => {},
}
