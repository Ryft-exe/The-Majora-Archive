import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { APP_DEFS } from '../shared/apps.js'
import { GAME_BY_ID, GAMES } from '../shared/catalog.js'
import { COMPONENTS } from '../shared/components.js'
import { enrichState } from '../shared/enrich.js'
import { checkComponents, componentState, installComponent, removeComponent } from './components.js'
import { configFilePath, readAppConfig, restoreAppBackup, writeAppText, writeAppValue } from './tunables.js'
import { coverFile, coverStats as countCovers, fetchAllCovers, importTriforceLogo } from './covers.js'
import { defaultRomFolders, detectApps, effectiveRomFolders, scanRoms } from './detect.js'
import { loadConfig, saveConfig } from './store.js'
import { cachedUpdates, checkUpdates, downloadUpdate } from './updates.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_NAME = 'Majora Archive'
const OLD_APP_NAMES = ['Taelight', 'Hyrule Archive']
const SONG_NAME = "Majora's Mask Song of Healing.mp3"

// Packaged builds keep these assets outside app.asar: Chromium's file loader and
// child processes cannot read inside the archive, even though Node's fs can.
function unpacked(file) {
  if (!app.isPackaged) return file
  return file.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`)
}

const ASSET_DIR = unpacked(path.join(__dirname, 'assets'))
const BUNDLED_THEME = path.join(ASSET_DIR, 'audio', 'majora-archive.mp3')
const LAUNCH_SFX = path.join(ASSET_DIR, 'audio', 'launch.mp3')
const BUTTON_SFX = path.join(ASSET_DIR, 'audio', 'button.mp3')

app.setName(APP_NAME)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'majora',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.oga', '.wav', '.flac', '.m4a', '.opus', '.aac', '.wma'])

let config
let configFile
let coverDir
let musicDir
let toolsDir
let mainWindow = null
let updatesChecking = false
let coverJob = null
const componentJobs = new Set()

function setConfig(next) {
  config = next
  saveConfig(configFile, config)
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

function migrateSettings() {
  if (fs.existsSync(configFile)) return
  for (const name of OLD_APP_NAMES) {
    const oldFile = path.join(app.getPath('appData'), name, 'settings.json')
    try {
      if (fs.existsSync(oldFile)) {
        fs.copyFileSync(oldFile, configFile)
        return
      }
    } catch {
      // migration is best effort; a fresh config still works
    }
  }
}

function migrateFolders() {
  for (const name of OLD_APP_NAMES) {
    for (const folder of ['covers', 'music']) {
      const from = path.join(app.getPath('appData'), name, folder)
      const to = path.join(app.getPath('userData'), folder)
      if (from === to) continue
      try {
        if (fs.existsSync(from)) {
          fs.cpSync(from, to, { recursive: true, force: false, errorOnExist: false })
        }
      } catch (error) {
        console.error(`could not migrate ${name}/${folder}:`, error)
      }
    }
  }
}

function migrateMusicPaths() {
  if (!Array.isArray(config?.music?.tracks)) return
  config.music.tracks = config.music.tracks.map((file) => {
    const candidate = path.join(musicDir, path.basename(file))
    try {
      return fs.statSync(candidate).isFile() ? candidate : file
    } catch {
      return file
    }
  })
}

function findSongOfHealing() {
  const candidates = [
    path.join(musicDir, SONG_NAME),
    path.join(app.getPath('downloads'), SONG_NAME),
    path.join(app.getPath('music'), SONG_NAME),
    path.join(app.getPath('desktop'), SONG_NAME),
    ...OLD_APP_NAMES.map((name) => path.join(app.getPath('appData'), name, 'music', SONG_NAME)),
  ]
  return (
    candidates.find((file) => {
      try {
        return fs.statSync(file).isFile()
      } catch {
        return false
      }
    }) || null
  )
}

function importSongOfHealing() {
  if (!config.music || typeof config.music !== 'object') config.music = {}
  if (config.music.seeded) return
  config.music.seeded = true

  const tracks = Array.isArray(config.music.tracks) ? config.music.tracks : []
  const already = tracks.find((file) => /song of healing/i.test(path.basename(file)))
  if (already) {
    config.music.source = 'files'
    config.music.enabled = true
    config.music.muted = false
    return
  }
  if (tracks.length) return

  const source = findSongOfHealing()
  if (!source) return
  const target = path.join(musicDir, SONG_NAME)
  try {
    if (path.resolve(source) !== path.resolve(target)) fs.copyFileSync(source, target)
    config.music.tracks = [target]
    config.music.source = 'files'
    config.music.enabled = true
    config.music.muted = false
  } catch (error) {
    console.error('could not import the Song of Healing:', error)
  }
}

function bundledTrack() {
  if (!fs.existsSync(BUNDLED_THEME)) return null
  return {
    name: 'Majora Archive Theme',
    url: 'majora://music/theme',
    path: BUNDLED_THEME,
    removable: false,
  }
}

function seedBundledMusic() {
  if (!fs.existsSync(BUNDLED_THEME)) return
  if (!config.music || typeof config.music !== 'object') config.music = {}
  if (config.music.bundled === 1) return
  config.music.bundled = 1
  config.music.source = 'files'
  config.music.enabled = true
  config.music.muted = false
}

function coverUrlFor(gameId) {
  const file = coverFile(coverDir, gameId)
  return file ? `majora://cover/${path.basename(file)}` : null
}

function logoUrlFor(gameId) {
  if (gameId !== 'ocarina-of-time-switch-2') return null
  // The Triforce mark only stands in while that shelf has no box art of its own.
  if (coverFile(coverDir, gameId)) return null
  const file = path.join(coverDir, 'triforce-logo.png')
  return fs.existsSync(file) ? `majora://cover/${path.basename(file)}` : null
}

function musicPaths() {
  const configured = Array.isArray(config?.music?.tracks) ? config.music.tracks : []
  let folderFiles = []
  try {
    folderFiles = fs
      .readdirSync(musicDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => path.join(musicDir, entry.name))
      .sort((a, b) => a.localeCompare(b))
  } catch {
    folderFiles = []
  }

  return [...new Set([...configured, ...folderFiles])]
    .filter((file) => {
      try {
        return fs.statSync(file).isFile()
      } catch {
        return false
      }
    })
    .slice(0, 200)
}

function musicState() {
  const configured = new Set(Array.isArray(config?.music?.tracks) ? config.music.tracks : [])
  const theme = bundledTrack()
  const tracks = [
    ...(theme ? [theme] : []),
    ...musicPaths().map((file, index) => ({
      name: path.basename(file, path.extname(file)),
      url: `majora://music/${index}`,
      path: file,
      removable: configured.has(file),
    })),
  ]
  return {
    enabled: config?.music?.enabled !== false,
    muted: Boolean(config?.music?.muted),
    volume: typeof config?.music?.volume === 'number' ? config.music.volume : 0.32,
    source: config?.music?.source === 'builtin' || tracks.length === 0 ? 'builtin' : 'files',
    tracks,
    folder: musicDir,
  }
}

function buildState() {
  const apps = detectApps(config)
  const roms = scanRoms(config)
  const state = enrichState({
    config,
    apps,
    roms,
    romFolders: effectiveRomFolders(config),
    platform: process.platform,
    version: app.getVersion(),
    coverUrl: coverUrlFor,
    logoUrl: logoUrlFor,
  })

  return {
    ...state,
    music: musicState(),
    covers: countCovers(coverDir, GAMES.map((game) => game.id)),
    components: componentState({ config, toolsDir, apps }),
    updates: cachedUpdates() || [],
    updatesChecking,
    updatesAuto: config.updates?.auto !== false,
    updatesCheckedAt: config.updates?.lastCheck || null,
  }
}

async function refreshCovers(force = false) {
  if (coverJob) return coverJob
  coverJob = (async () => {
    try {
      const result = await fetchAllCovers({ cacheDir: coverDir, force })
      send('covers:updated')
      return result
    } finally {
      coverJob = null
    }
  })()
  return coverJob
}

async function refreshUpdates(force = false) {
  if (updatesChecking) return cachedUpdates() || []
  updatesChecking = true
  send('updates:updated')
  try {
    const entries = await checkUpdates(detectApps(config), config, { force })
    config.updates = { ...config.updates, lastCheck: new Date().toISOString() }
    saveConfig(configFile, config)
    return entries
  } catch (error) {
    console.error('update check failed:', error)
    return cachedUpdates() || []
  } finally {
    updatesChecking = false
    send('updates:updated')
  }
}

function expand(input) {
  return String(input || '').replace(/%([A-Za-z_]+)%/g, (_, name) => process.env[name] ?? '')
}

function start(exe, args = [], cwd) {
  const child = spawn(exe, args, {
    cwd: cwd || path.dirname(exe),
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  })
  child.on('error', (error) => console.error('launch failed:', error))
  child.unref()
}

function variantTarget(game, variant) {
  const apps = detectApps(config)
  const roms = scanRoms(config)
  const info = apps[variant.app]

  if (variant.kind === 'recomp') {
    if (!info?.found) {
      if (variant.app === 'triforce' && apps.triforce.setupFound) {
        return {
          exe: apps.triforce.setupPath,
          args: [],
          cwd: path.dirname(apps.triforce.setupPath),
          message: 'Opening Triforce Setup so you can build the game.',
        }
      }
      return { error: `${info?.name || variant.app} is not installed yet.` }
    }
    return {
      exe: info.path,
      args: [],
      cwd: path.dirname(info.path),
      message: `Launching ${game.title}.`,
    }
  }

  if (!info?.found) return { error: `${info?.name || variant.app} is not installed yet.` }

  const exts = variant.ext || game.ext || []
  const matches = roms[game.id] || []
  const rom = config.romPaths?.[game.id] || matches.find((match) => exts.includes(match.ext))?.path
  if (!rom) return { error: game.disc ? 'Choose your game disc first.' : 'Choose your ROM first.' }

  let core = ''
  if (variant.core) {
    core = info.corePaths?.[variant.core.toLowerCase()] || ''
    if (!core) return { error: `The ${variant.core} core is not installed in RetroArch.` }
  }

  const template = APP_DEFS[variant.app]?.args || ['{rom}']
  const args = template.map((part) => part.replaceAll('{rom}', rom).replaceAll('{core}', core))
  return {
    exe: info.path,
    args,
    cwd: path.dirname(info.path),
    message: `Launching ${game.title}.`,
  }
}

function registerIpc() {
  ipcMain.handle('app:state', () => buildState())

  ipcMain.handle('app:launch', (_event, { gameId, variantId }) => {
    try {
      const game = GAME_BY_ID[gameId]
      if (!game) return { ok: false, message: 'Unknown game.' }
      const variant = game.variants.find((entry) => entry.id === variantId)
      if (!variant) return { ok: false, message: 'Unknown way to play.' }

      const target = variantTarget(game, variant)
      if (target.error) return { ok: false, message: target.error }

      start(target.exe, target.args, target.cwd)
      config.lastPlayed = { gameId, at: new Date().toISOString() }
      saveConfig(configFile, config)
      return { ok: true, message: target.message, state: buildState() }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('app:launchApp', (_event, { key }) => {
    try {
      const apps = detectApps(config)
      const target = key === 'triforceSetup' ? apps.triforce.setupPath : apps[key]?.path
      if (!target) return { ok: false, message: 'That program is not installed yet.' }
      start(target, [], path.dirname(target))
      return { ok: true, message: `Opening ${apps[key]?.name || 'program'}.`, state: buildState() }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('app:openTriforce', () => {
    try {
      const apps = detectApps(config)
      const target = apps.triforce.setupPath || apps.triforce.path
      if (!target) return { ok: false, message: 'Triforce Setup was not found. Locate it in Settings.' }
      start(target, [], path.dirname(target))
      return { ok: true, message: 'Opening Triforce Setup.', state: buildState() }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('app:pickApp', async (event, { key }) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
    const result = await dialog.showOpenDialog(win, {
      title: 'Locate a program',
      properties: ['openFile'],
      filters:
        process.platform === 'win32'
          ? [{ name: 'Programs', extensions: ['exe'] }, { name: 'All files', extensions: ['*'] }]
          : [{ name: 'All files', extensions: ['*'] }],
    })
    if (result.canceled || !result.filePaths[0]) return { ok: false, message: 'No program chosen.' }
    setConfig({ ...config, apps: { ...config.apps, [key]: result.filePaths[0] } })
    return { ok: true, message: 'Program linked.', state: buildState() }
  })

  ipcMain.handle('app:pickRom', async (event, { gameId }) => {
    const game = GAME_BY_ID[gameId]
    if (!game) return { ok: false, message: 'Unknown game.' }
    const extensions = [...new Set([...(game.ext || []), ...game.variants.flatMap((variant) => variant.ext || [])])]
      .map((ext) => ext.replace('.', ''))
      .filter(Boolean)
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
    const result = await dialog.showOpenDialog(win, {
      title: `Choose your copy of ${game.title}`,
      properties: ['openFile'],
      filters: extensions.length
        ? [{ name: `${game.platform} game files`, extensions }, { name: 'All files', extensions: ['*'] }]
        : [{ name: 'All files', extensions: ['*'] }],
    })
    if (result.canceled || !result.filePaths[0]) return { ok: false, message: 'No game file chosen.' }
    setConfig({ ...config, romPaths: { ...config.romPaths, [gameId]: result.filePaths[0] } })
    return { ok: true, message: `${game.title} linked.`, state: buildState() }
  })

  ipcMain.handle('app:addRomFolder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
    const result = await dialog.showOpenDialog(win, {
      title: 'Add a folder to scan for games',
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) return { ok: false, message: 'No folder added.' }
    const folder = result.filePaths[0]
    if (config.romFolders.includes(folder)) return { ok: true, message: 'That folder is already scanned.', state: buildState() }
    setConfig({ ...config, romFolders: [...config.romFolders, folder] })
    return { ok: true, message: 'Folder added.', state: buildState() }
  })

  ipcMain.handle('app:removeRomFolder', (_event, { folder }) => {
    setConfig({ ...config, romFolders: config.romFolders.filter((entry) => entry !== folder) })
    return { ok: true, message: 'Folder removed.', state: buildState() }
  })

  ipcMain.handle('app:openPath', async (_event, { target }) => {
    if (!target) return { ok: false, message: 'Nothing to open.' }
    try {
      const stat = fs.statSync(target)
      if (stat.isDirectory()) await shell.openPath(target)
      else shell.showItemInFolder(target)
      return { ok: true }
    } catch {
      return { ok: false, message: 'That file or folder is no longer there.' }
    }
  })

  ipcMain.handle('app:openExternal', async (_event, { url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { ok: false, message: 'Only web links can be opened.' }
      }
      await shell.openExternal(parsed.toString())
      return { ok: true }
    } catch {
      return { ok: false, message: 'That link could not be opened.' }
    }
  })

  ipcMain.handle('app:openDataFolder', async () => {
    await shell.openPath(path.dirname(configFile))
    return { ok: true }
  })

  ipcMain.handle('app:window', (_event, { action }) => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow
    if (!win) return { ok: false }
    if (action === 'min') win.minimize()
    else if (action === 'max') win.isMaximized() ? win.unmaximize() : win.maximize()
    else if (action === 'close') win.close()
    return { ok: true }
  })

  ipcMain.handle('covers:refresh', async () => {
    try {
      const result = await refreshCovers(true)
      const missing = result.missing.length
      return {
        ok: true,
        message: `Cover art updated: ${result.downloaded} new, ${result.existing} already cached${missing ? `, ${missing} without a public scan` : ''}.`,
        state: buildState(),
      }
    } catch (error) {
      return { ok: false, message: `Cover fetch failed: ${error instanceof Error ? error.message : error}` }
    }
  })

  ipcMain.handle('covers:openFolder', async () => {
    await shell.openPath(coverDir)
    return { ok: true }
  })

  ipcMain.handle('music:update', (_event, patch = {}) => {
    const next = { ...config.music }
    if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled
    if (typeof patch.muted === 'boolean') next.muted = patch.muted
    if (typeof patch.volume === 'number') next.volume = Math.min(1, Math.max(0, patch.volume))
    if (patch.source === 'builtin' || patch.source === 'files') next.source = patch.source
    setConfig({ ...config, music: next })
    return { ok: true, state: buildState() }
  })

  ipcMain.handle('music:add', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
    const result = await dialog.showOpenDialog(win, {
      title: 'Add music to Majora Archive',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audio', extensions: ['mp3', 'ogg', 'oga', 'wav', 'flac', 'm4a', 'opus', 'aac'] },
        { name: 'All files', extensions: ['*'] },
      ],
    })
    if (result.canceled || !result.filePaths.length) return { ok: false, message: 'No music added.' }
    const tracks = [...new Set([...(config.music.tracks || []), ...result.filePaths])]
    setConfig({
      ...config,
      music: { ...config.music, tracks, source: 'files', enabled: true, muted: false },
    })
    return { ok: true, message: `Added ${result.filePaths.length} track${result.filePaths.length === 1 ? '' : 's'}.`, state: buildState() }
  })

  ipcMain.handle('music:remove', (_event, { file }) => {
    setConfig({
      ...config,
      music: { ...config.music, tracks: (config.music.tracks || []).filter((track) => track !== file) },
    })
    return { ok: true, message: 'Removed from the playlist.', state: buildState() }
  })

  ipcMain.handle('music:openFolder', async () => {
    await shell.openPath(musicDir)
    return { ok: true }
  })

  ipcMain.handle('music:rescan', () => ({ ok: true, state: buildState() }))

  ipcMain.handle('updates:check', async () => {
    const entries = await refreshUpdates(true)
    const available = entries.filter((entry) => entry.available).length
    return {
      ok: true,
      message: available ? `${available} update${available === 1 ? '' : 's'} available.` : 'Everything is up to date.',
      state: buildState(),
    }
  })

  ipcMain.handle('updates:download', async (_event, { key }) => {
    try {
      const entries = await refreshUpdates(false)
      const entry = entries.find((item) => item.key === key)
      if (!entry) return { ok: false, message: 'That project is not in the update list.' }
      if (entry.updateKind === 'setup') return { ok: false, message: 'Use Open Triforce Setup to update this one.' }
      const target = await downloadUpdate(entry, path.join(app.getPath('downloads'), 'Majora Archive Updates'))
      shell.showItemInFolder(target)
      return { ok: true, message: `Downloaded ${entry.assetName || 'the update'}.`, state: buildState() }
    } catch (error) {
      return { ok: false, message: `Download failed: ${error instanceof Error ? error.message : error}` }
    }
  })

  ipcMain.handle('updates:setAuto', (_event, { auto }) => {
    setConfig({ ...config, updates: { ...config.updates, auto: Boolean(auto) } })
    return { ok: true, state: buildState() }
  })

  ipcMain.handle('updates:openFolder', async () => {
    const folder = path.join(app.getPath('downloads'), 'Majora Archive Updates')
    fs.mkdirSync(folder, { recursive: true })
    await shell.openPath(folder)
    return { ok: true }
  })

  ipcMain.handle('components:install', async (event, { key, build }) => {
    const component = COMPONENTS.find((entry) => entry.key === key)
    if (!component) return { ok: false, message: 'That component cannot be downloaded from here.' }
    const chosen = component.builds.find((entry) => entry.key === build) || component.builds[0]
    if (componentJobs.has(key)) return { ok: false, message: `${chosen.name} is already being installed.` }

    componentJobs.add(key)
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
    const progress = (update) => send('components:progress', { key, ...update })

    try {
      const result = await installComponent(component, {
        buildKey: chosen.key,
        config,
        toolsDir,
        onProgress: progress,
      })
      saveConfig(configFile, config)
      const checksum = result.verified ? 'Checksum verified against the release.' : 'No published checksum; SHA-256 recorded locally.'
      return {
        ok: true,
        message: `${chosen.name} ${result.version ? `v${result.version} ` : ''}installed. ${checksum}`,
        state: buildState(),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      progress({ phase: 'error', percent: 100, message })
      saveConfig(configFile, config)
      return { ok: false, message: `${chosen.name}: ${message}`, state: buildState() }
    } finally {
      componentJobs.delete(key)
      if (win && !win.isDestroyed()) win.focus()
    }
  })

  ipcMain.handle('components:remove', async (event, { key }) => {
    const component = COMPONENTS.find((entry) => entry.key === key)
    if (!component) return { ok: false, message: 'That component is not managed by the launcher.' }
    if (componentJobs.has(key)) return { ok: false, message: `${component.name} is busy right now.` }

    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
    const answer = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Remove it', 'Keep it'],
      defaultId: 1,
      cancelId: 1,
      title: `Remove ${component.name}?`,
      message: `Delete the ${component.name} files Majora Archive downloaded?`,
      detail:
        'They live in the launcher’s own tools folder. Game files, saves, keys and firmware are not touched. You can download it again at any time.',
    })
    if (answer.response !== 0) return { ok: false, message: 'Nothing was removed.' }

    try {
      await removeComponent(component, { config, toolsDir })
      saveConfig(configFile, config)
      return { ok: true, message: `${component.name} removed from the tools folder.`, state: buildState() }
    } catch (error) {
      return { ok: false, message: `Could not remove ${component.name}: ${error instanceof Error ? error.message : error}` }
    }
  })

  ipcMain.handle('components:check', async () => {
    try {
      const result = await checkComponents({ config, toolsDir, apps: detectApps(config) })
      saveConfig(configFile, config)
      const available = result.state.entries.filter((entry) => entry.updateAvailable).length
      const message = available
        ? `${available} component update${available === 1 ? '' : 's'} available.`
        : result.failures.length
          ? `Checked what could be reached. ${result.failures.length} feed${result.failures.length === 1 ? '' : 's'} did not answer.`
          : 'Every downloaded component matches its latest release.'
      return { ok: result.failures.length === 0, message, state: buildState() }
    } catch (error) {
      return { ok: false, message: `Component check failed: ${error instanceof Error ? error.message : error}` }
    }
  })

  const programPath = (key) => {
    const detected = detectApps(config)?.[key]
    return detected?.path || config.apps?.[key] || null
  }

  ipcMain.handle('config:read', async (event, { key } = {}) => {
    const data = readAppConfig(key, { exePath: programPath(key) })
    if (!data) return { ok: false, message: 'That program has no settings panel here.' }
    return { ok: true, config: data }
  })

  ipcMain.handle('config:write', async (event, { key, ...patch } = {}) => {
    try {
      const result = writeAppValue(key, { ...patch, exePath: programPath(key) })
      return { ok: true, message: result.message, config: result.state }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('config:writeText', async (event, { key, ...patch } = {}) => {
    try {
      const result = writeAppText(key, { ...patch, exePath: programPath(key) })
      return { ok: true, message: result.message, config: result.state }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('config:restore', async (event, { key, ...patch } = {}) => {
    try {
      const result = restoreAppBackup(key, { ...patch, exePath: programPath(key) })
      return { ok: true, message: result.message, config: result.state }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('config:openFile', async (event, { key, fileId } = {}) => {
    const target = configFilePath(key, fileId, { exePath: programPath(key) })
    if (!target) return { ok: false, message: 'That program has no config file to open.' }
    shell.showItemInFolder(target)
    return { ok: true }
  })

  ipcMain.handle('components:openFolder', async () => {
    fs.mkdirSync(toolsDir, { recursive: true })
    await shell.openPath(toolsDir)
    return { ok: true }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 940,
    minWidth: 1040,
    minHeight: 700,
    frame: false,
    backgroundColor: '#080611',
    show: false,
    title: APP_NAME,
    icon: path.join(ASSET_DIR, 'majora-mask.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('renderer failed to load:', code, description)
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('renderer process gone:', details.reason)
  })
  mainWindow.webContents.on('console-message', (_event, level, message, line, source) => {
    if (level >= 2) console.error('[renderer]', message, `${source}:${line}`)
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) mainWindow.loadURL(devUrl)
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerProtocol() {
  protocol.handle('majora', async (request) => {
    try {
      const url = new URL(request.url)
      const name = path.basename(decodeURIComponent(url.pathname))
      if (url.hostname === 'cover') {
        const file = path.join(coverDir, name)
        if (!fs.existsSync(file)) return new Response('Not found', { status: 404 })
        return net.fetch(pathToFileURL(file).toString())
      }
      if (url.hostname === 'music') {
        if (name === 'theme') {
          if (!fs.existsSync(BUNDLED_THEME)) return new Response('Not found', { status: 404 })
          return net.fetch(pathToFileURL(BUNDLED_THEME).toString())
        }
        const index = Number.parseInt(name, 10)
        const tracks = musicPaths()
        const file = Number.isInteger(index) ? tracks[index] : null
        if (!file || !fs.existsSync(file)) return new Response('Not found', { status: 404 })
        return net.fetch(pathToFileURL(file).toString())
      }
      if (url.hostname === 'sfx') {
        const file = name === 'launch' ? LAUNCH_SFX : name === 'button' ? BUTTON_SFX : null
        if (!file || !fs.existsSync(file)) return new Response('Not found', { status: 404 })
        return net.fetch(pathToFileURL(file).toString())
      }
    } catch {
      // fall through
    }
    return new Response('Not found', { status: 404 })
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.majoraarchive.launcher')
    Menu.setApplicationMenu(null)

    configFile = path.join(app.getPath('userData'), 'settings.json')
    migrateSettings()
    config = loadConfig(configFile)
    coverDir = path.join(app.getPath('userData'), 'covers')
    musicDir = path.join(app.getPath('userData'), 'music')
    toolsDir = path.join(app.getPath('userData'), 'tools')
    fs.mkdirSync(coverDir, { recursive: true })
    fs.mkdirSync(musicDir, { recursive: true })
    fs.mkdirSync(toolsDir, { recursive: true })
    fs.rmSync(path.join(toolsDir, '.cache'), { recursive: true, force: true })
    migrateFolders()
    migrateMusicPaths()
    importSongOfHealing()
    seedBundledMusic()
    importTriforceLogo(coverDir)

    if (!config.romFolders.length) {
      const defaults = defaultRomFolders()
      if (defaults.length) config.romFolders = defaults
    }
    saveConfig(configFile, config)

    registerProtocol()
    registerIpc()
    createWindow()

    setTimeout(() => {
      if (config.covers?.auto !== false) refreshCovers(false).catch((error) => console.error('cover fetch:', error))
      if (config.updates?.auto !== false) refreshUpdates(false).catch((error) => console.error('update check:', error))
    }, 1800)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
