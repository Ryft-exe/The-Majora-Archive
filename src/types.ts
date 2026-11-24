export type View = 'library' | 'emulators' | 'recomps' | 'components' | 'mods' | 'updates' | 'settings'

export type Variant = {
  id: string
  kind: 'recomp' | 'emulator'
  app: string
  label: string
  core?: string
  ext?: string[]
  note?: string
  ready: boolean
  reason: string
  romPath: string | null
  appPath: string | null
}

export type Game = {
  id: string
  title: string
  year: number
  platform: string
  platformKey: string
  art: string
  blurb: string
  ext: string[]
  aliases: string[]
  disc?: boolean
  coverUrl: string | null
  logoUrl: string | null
  variants: Variant[]
  detectedRom: string | null
  status: 'ready' | 'setup'
  bestVariantId: string
}

export type AppInfo = {
  key: string
  kind: 'emulator' | 'recomp'
  name: string
  systems: string | null
  site: string | null
  note: string | null
  game: string | null
  found: boolean
  path: string | null
  cores: string[]
  setupPath: string | null
  setupFound: boolean
}

export type ConfigEntry = {
  section: string | null
  key: string
  path?: string
  value: string
  type: 'bool' | 'int' | 'float' | 'text'
}

export type ConfigQuickSetting = {
  id: string
  fileId: string
  label: string
  type: 'bool' | 'enum' | 'number' | 'text'
  options: [string, string][] | null
  note: string | null
  section: string | null
  key: string | null
  path: string | null
  value: string | null
  also: { path: string; from: 'label' }[] | null
}

export type ConfigControl = {
  id: string
  fileId: string
  label: string
  kind: 'key' | 'text'
  code: string | null
  clear: string | null
  section: string | null
  key: string | null
  path: string | null
  value: string | null
}

export type ConfigFile = {
  id: string
  label: string
  format: string
  path: string
  candidates: string[]
  exists: boolean
  foundPath: string | null
  editable: boolean
  isText: boolean
  size: number
  entries: ConfigEntry[]
  quick: ConfigQuickSetting[]
  controls: ConfigControl[]
  backupExists: boolean
  text: string | null
  error: string | null
}

export type AppConfig = {
  app: string
  name: string
  note: string | null
  controlsNote: string | null
  exePath: string | null
  files: ConfigFile[]
}

export type ConfigResult = {
  ok?: boolean
  message?: string
  config?: AppConfig
}

export type ConfigPatch = {
  fileId: string
  section?: string | null
  key?: string | null
  path?: string | null
  value: string
  type: 'bool' | 'enum' | 'number' | 'text'
  also?: { path: string; value: string }[]
}

export type MusicSource = 'builtin' | 'files'

export type MusicTrack = {
  name: string
  url: string
  path?: string
  removable: boolean
}

export type MusicState = {
  enabled: boolean
  muted: boolean
  volume: number
  source: MusicSource
  tracks: MusicTrack[]
  folder: string
}

export type UpdateStatus = 'current' | 'available' | 'unknown' | 'manual' | 'error'

export type UpdateEntry = {
  key: string
  name: string
  game: string
  site: string | null
  setupPath: string | null
  appPath: string | null
  updateKind: 'setup' | 'download'
  installed: string | null
  latest: string | null
  available: boolean
  status: UpdateStatus
  message: string
  releaseUrl: string
  releaseName?: string
  notes?: string
  publishedAt?: string | null
  assetName?: string | null
  assetUrl?: string | null
}

export type CoverState = {
  found: number
  total: number
  availableSystems: number
}

export type ComponentLicense = {
  name: string
  url: string | null
  note?: string
}

export type ComponentBuild = {
  key: string
  name: string
  by: string
  role: 'official' | 'fork' | 'alternative'
  repo: string | null
  site: string | null
  link: string | null
  license: ComponentLicense
  note: string | null
  installable: boolean
  installed: boolean
  managed: boolean
  version: string | null
  latest: string | null
  updateAvailable: boolean
  path: string | null
  dir: string | null
  sha256: string | null
  verified: boolean | null
  installedAt: string | null
  assetName: string | null
}

export type ComponentInfo = {
  key: string
  name: string
  kind: 'emulator' | 'recomp'
  systems: string
  site: string
  license: ComponentLicense
  note: string | null
  needs: string[]
  automatic: boolean
  reason: string | null
  build: string
  builds: ComponentBuild[]
  installed: boolean
  managed: boolean
  version: string | null
  latest: string | null
  updateAvailable: boolean
  path: string | null
  sha256: string | null
  verified: boolean | null
  installedAt: string | null
  assetName: string | null
}

export type ComponentProgress = {
  key: string
  phase: 'release' | 'download' | 'verify' | 'extract' | 'done' | 'error'
  percent: number
  message: string
}

export type ComponentState = {
  toolsDir: string
  lastCheck: string | null
  entries: ComponentInfo[]
}

export type LauncherState = {
  platform: string
  version: string
  native: boolean
  config: {
    romFolders: string[]
    lastPlayed: { gameId: string; at: string } | null
  }
  romFolders: string[]
  apps: AppInfo[]
  games: Game[]
  lastPlayed: { gameId: string; title: string; at: string } | null
  music: MusicState
  covers: CoverState
  components: ComponentState
  mods: ModState
  appUpdate: AppUpdateState
  updates: UpdateEntry[]
  updatesChecking: boolean
  updatesAuto: boolean
  updatesCheckedAt: string | null
  counts: {
    games: number
    ready: number
    recomp: number
    emulated: number
    variants: number
  }
}

export type ActionResult = {
  ok?: boolean
  message?: string
  state?: LauncherState
}

export type ModKind =
  | 'build'
  | 'overhaul'
  | 'texture'
  | 'model'
  | 'text'
  | 'patch'
  | 'controls'
  | 'translation'
  | 'romhack'
  | 'library'

export type ModEntry = {
  id: string
  title: string
  by: string
  game: string | null
  target: string | null
  kind: ModKind
  featured?: boolean
  summary: string
  url: string
  note?: string
  likes?: number
  tags: string[]
  build: string | null
  folder: string | null
  gameReady: boolean
  installed: boolean
  paused: boolean
  canInstall: boolean
}

export type ModState = {
  entries: ModEntry[]
}

export type AppUpdateStatus = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'error'

export type AppUpdateState = {
  status: AppUpdateStatus
  version: string | null
  percent: number
  message: string
}

export type ModActionResult = ActionResult & { mods?: ModState }

export type Bridge = {
  getState: () => Promise<LauncherState>
  launch: (gameId: string, variantId: string) => Promise<ActionResult>
  launchApp: (key: string) => Promise<ActionResult>
  openTriforce: () => Promise<ActionResult>
  pickApp: (key: string) => Promise<ActionResult>
  pickRom: (gameId: string) => Promise<ActionResult>
  addRomFolder: () => Promise<ActionResult>
  removeRomFolder: (folder: string) => Promise<ActionResult>
  rescan: () => Promise<LauncherState>
  openPath: (target: string) => Promise<ActionResult>
  openExternal: (url: string) => Promise<ActionResult>
  openDataFolder: () => Promise<ActionResult>
  window: (action: 'min' | 'max' | 'close') => Promise<ActionResult>

  refreshCovers: () => Promise<ActionResult>
  openCoverFolder: () => Promise<ActionResult>

  updateMusic: (patch: Partial<Pick<MusicState, 'enabled' | 'muted' | 'volume' | 'source'>>) => Promise<ActionResult>
  addMusic: () => Promise<ActionResult>
  removeMusic: (file: string) => Promise<ActionResult>
  openMusicFolder: () => Promise<ActionResult>
  rescanMusic: () => Promise<ActionResult>

  readAppConfig: (key: string) => Promise<ConfigResult>
  writeConfigValue: (key: string, patch: ConfigPatch) => Promise<ConfigResult>
  writeConfigText: (key: string, patch: { fileId: string; text: string }) => Promise<ConfigResult>
  restoreConfigBackup: (key: string, fileId: string) => Promise<ConfigResult>
  openConfigFile: (key: string, fileId: string) => Promise<ActionResult>

  installComponent: (key: string, build?: string) => Promise<ActionResult>
  removeComponent: (key: string) => Promise<ActionResult>
  checkComponents: () => Promise<ActionResult>
  openToolsFolder: () => Promise<ActionResult>

  checkUpdates: () => Promise<ActionResult>
  downloadUpdate: (key: string) => Promise<ActionResult>
  setUpdateAuto: (auto: boolean) => Promise<ActionResult>
  openUpdateFolder: () => Promise<ActionResult>

  modsState: () => Promise<ModState>
  installMod: (id: string) => Promise<ModActionResult>
  importMod: (id: string) => Promise<ModActionResult>
  toggleMod: (id: string) => Promise<ModActionResult>
  removeMod: (id: string) => Promise<ModActionResult>
  openModFolder: (id: string) => Promise<ActionResult>

  checkAppUpdate: () => Promise<ActionResult>
  downloadAppUpdate: () => Promise<ActionResult>
  installAppUpdate: () => Promise<ActionResult>
  onAppUpdate: (callback: (status: AppUpdateState) => void) => () => void

  onCoversUpdated: (callback: () => void) => () => void
  onUpdatesUpdated: (callback: () => void) => () => void
  onComponentProgress: (callback: (progress: ComponentProgress) => void) => () => void
}
