import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { APP_DEFS, DISCOVERABLE_EXES, RECOMPS, TRIFORCE_SETUP_CANDIDATES } from '../shared/apps.js'
import { GAMES } from '../shared/catalog.js'

const isWin = process.platform === 'win32'

export function expandPath(input) {
  if (!input) return ''
  const expanded = String(input).replace(/%([A-Za-z_]+)%/g, (_, name) => process.env[name] ?? '')
  return path.normalize(expanded.split('/').join(path.sep))
}

function fileExists(target) {
  try {
    return Boolean(target) && fs.statSync(target).isFile()
  } catch {
    return false
  }
}

function dirExists(target) {
  try {
    return Boolean(target) && fs.statSync(target).isDirectory()
  } catch {
    return false
  }
}

function firstExisting(candidates = []) {
  for (const candidate of candidates) {
    const full = expandPath(candidate)
    if (fileExists(full)) return full
  }
  return null
}

// A shallow look through the player's own game folders catches portable
// installs that are not in any of the default locations.
function discoverKnownExes() {
  const found = {}
  const roots = [path.join(os.homedir(), 'Games'), path.join(os.homedir(), 'Emulators')]
  const wanted = new Map()
  for (const [key, names] of Object.entries(DISCOVERABLE_EXES)) {
    for (const name of names) wanted.set(name.toLowerCase(), key)
  }

  for (const root of roots) {
    if (!dirExists(root)) continue
    walk(root, 2)
  }

  function walk(dir, depth) {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isFile()) {
        const key = wanted.get(entry.name.toLowerCase())
        if (key && !found[key]) found[key] = full
      } else if (entry.isDirectory() && depth > 0) {
        walk(full, depth - 1)
      }
    }
  }

  return found
}

function readRetroArchCores(exePath) {
  const coreDir = path.join(path.dirname(exePath), 'cores')
  try {
    const files = fs.readdirSync(coreDir).filter((name) => name.toLowerCase().endsWith('_libretro.dll'))
    return {
      cores: files.map((name) => name.toLowerCase()),
      corePaths: Object.fromEntries(files.map((name) => [name.toLowerCase(), path.join(coreDir, name)])),
    }
  } catch {
    return { cores: [], corePaths: {} }
  }
}

export function detectApps(config) {
  const discovered = discoverKnownExes()
  const apps = {}

  for (const def of Object.values(APP_DEFS)) {
    const override = config.apps?.[def.key]
    const candidate = override && fileExists(expandPath(override)) ? expandPath(override) : null
    const foundPath = candidate || firstExisting(def.candidates) || discovered[def.key] || null

    apps[def.key] = {
      key: def.key,
      kind: def.kind,
      name: def.name,
      systems: def.systems,
      site: def.site,
      note: def.note,
      game: def.game,
      args: def.args,
      release: def.release || null,
      found: Boolean(foundPath),
      path: foundPath,
      cores: [],
      corePaths: {},
    }

    if (def.key === 'retroarch' && foundPath) {
      Object.assign(apps.retroarch, readRetroArchCores(foundPath))
    }
  }

  const setupOverride = config.apps?.triforceSetup
  const setup =
    (setupOverride && fileExists(expandPath(setupOverride)) && expandPath(setupOverride)) ||
    firstExisting(TRIFORCE_SETUP_CANDIDATES)

  apps.triforce.setupPath = setup
  apps.triforce.setupFound = Boolean(setup)

  return apps
}

export function defaultRomFolders() {
  return [
    path.join(os.homedir(), 'ROMs'),
    path.join(os.homedir(), 'Games', 'ROMs'),
    path.join(os.homedir(), 'Emulation', 'roms'),
  ].filter(dirExists)
}

function isRomFile(name) {
  const ext = path.extname(name).toLowerCase()
  return GAMES.some((game) => (game.ext || []).includes(ext) || game.variants.some((variant) => (variant.ext || []).includes(ext)))
}

function normalizeName(input) {
  return String(input)
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const STOP_WORDS = new Set(['the', 'of', 'a', 'and', 's', 'no', 'in'])

function scoreName(fileName, game) {
  const name = normalizeName(fileName)
  let best = 0
  for (const alias of game.aliases || []) {
    const tokens = normalizeName(alias)
      .split(' ')
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    if (!tokens.length) continue
    if (tokens.every((token) => name.includes(token))) {
      const score = tokens.length * 10 + alias.length
      if (score > best) best = score
    }
  }
  return best
}

export function scanRoms(config) {
  const folders = [...new Set([...(config.romFolders || []), ...defaultRomFolders()])]
  const files = []
  const seen = new Set()

  for (const folder of folders) {
    if (!dirExists(folder)) continue
    walk(folder, 3)
  }

  function walk(dir, depth) {
    if (files.length > 6000) return
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (depth > 0) walk(full, depth - 1)
      } else if (isRomFile(entry.name) && !seen.has(full)) {
        seen.add(full)
        files.push(full)
      }
    }
  }

  const bestByGameExt = new Map()

  for (const file of files) {
    const ext = path.extname(file).toLowerCase()
    const base = path.basename(file)
    for (const game of GAMES) {
      const exts = new Set([
        ...(game.ext || []),
        ...game.variants.flatMap((variant) => variant.ext || []),
      ])
      if (!exts.has(ext)) continue
      const score = scoreName(base, game)
      if (score < 10) continue
      const key = `${game.id}|${ext}`
      const current = bestByGameExt.get(key)
      if (!current || score > current.score) {
        bestByGameExt.set(key, { path: file, ext, score })
      }
    }
  }

  const result = {}
  for (const [key, match] of bestByGameExt) {
    const gameId = key.split('|')[0]
    if (!result[gameId]) result[gameId] = []
    result[gameId].push(match)
  }
  for (const gameId of Object.keys(result)) {
    result[gameId].sort((a, b) => b.score - a.score)
  }
  return result
}

export function effectiveRomFolders(config) {
  return [...new Set([...(config.romFolders || []), ...defaultRomFolders()])]
}
