import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { COMPONENTS, buildTarget } from '../shared/components.js'
import { MODS } from '../shared/mods.js'

const HEADERS = { 'User-Agent': 'MajoraArchive/0.3.1 (mod library)' }
const ARCHIVE_EXT = new Set(['.zip', '.7z'])
const PACK_EXT = new Set(['.o2r', '.otr'])

function componentFor(key) {
  return COMPONENTS.find((component) => component.key === key) || null
}

// A mod belongs next to the build the player actually launches: the active build
// when it is installed, otherwise whichever build of that port is present.
export function modTarget({ config, toolsDir, componentKey }) {
  const component = componentFor(componentKey)
  if (!component || !toolsDir) return null
  const stored = config?.tools?.[component.key]
  const installed = component.builds.filter(
    (build) => stored?.builds?.[build.key] || stored?.build === build.key,
  )
  const build = installed.find((entry) => entry.key === stored?.active) || installed[0] || component.builds[0]
  const dir = path.join(toolsDir, buildTarget(component, build.key).dirName)
  return {
    component,
    build,
    dir,
    folder: path.join(dir, 'mods'),
    present: fs.existsSync(dir),
  }
}

function safeId(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '')
}

function isInside(target, root) {
  const rel = path.relative(path.resolve(root), path.resolve(target))
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel)
}

function listFolder(folder) {
  try {
    return fs
      .readdirSync(folder, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.'))
      .map((entry) => ({ name: entry.name, directory: entry.isDirectory() }))
  } catch {
    return []
  }
}

function filesFor(mod, target) {
  if (!target) return []
  const base = safeId(mod.id)
  return listFolder(target.folder).filter(
    (entry) => entry.name === base || entry.name.startsWith(`${base}.`),
  )
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true })
}

function run(exe, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true })
    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) return resolve()
      const last = stderr.trim().split('\n').filter(Boolean).pop()
      reject(new Error(last || `Unpack failed with code ${code}.`))
    })
  })
}

// tar.exe ships with Windows 10 and 11; PowerShell covers the rest.
async function extract(archive, destination) {
  fs.mkdirSync(destination, { recursive: true })
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
  if (process.platform === 'win32' && fs.existsSync(tar)) {
    await run(tar, ['-xf', archive, '-C', destination])
    return
  }
  if (process.platform === 'win32') {
    await run('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`,
    ])
    return
  }
  await run('tar', ['-xf', archive, '-C', destination])
}

async function download(url, target) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(600000) })
  if (!response.ok) throw new Error(`Download returned ${response.status}.`)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()))
  return target
}

function placeFile(mod, file, target, label) {
  const ext = path.extname(file).toLowerCase()
  fs.mkdirSync(target.folder, { recursive: true })
  if (ARCHIVE_EXT.has(ext)) {
    const folder = path.join(target.folder, safeId(mod.id))
    rmrf(folder)
    return extract(file, folder).then(() => `${label} is in the mods folder for ${target.build.name}.`)
  }
  if (!PACK_EXT.has(ext)) {
    throw new Error('That file is not an .o2r, .otr or .zip mod pack.')
  }
  const destination = path.join(target.folder, `${safeId(mod.id)}${ext}`)
  rmrf(`${destination}.off`)
  fs.copyFileSync(file, destination)
  return Promise.resolve(`${label} is in the mods folder for ${target.build.name}.`)
}

function targetFor(mod, { config, toolsDir }) {
  const target = mod.target ? modTarget({ config, toolsDir, componentKey: mod.target }) : null
  if (!target) throw new Error('This mod has no mods folder to install into.')
  return target
}

export function modState({ config, toolsDir }) {
  const cache = new Map()
  const entries = MODS.map((mod) => {
    let target = null
    if (mod.target) {
      if (!cache.has(mod.target)) cache.set(mod.target, modTarget({ config, toolsDir, componentKey: mod.target }))
      target = cache.get(mod.target)
    }
    const files = filesFor(mod, target)
    const live = files.filter((entry) => !entry.name.endsWith('.off'))
    return {
      ...mod,
      build: target?.build?.name || null,
      folder: target?.folder || null,
      gameReady: Boolean(target?.present),
      installed: live.length > 0,
      paused: files.length > 0 && live.length === 0,
      canInstall: Boolean(mod.pack?.url && target),
    }
  })
  return { entries }
}

export async function installMod(mod, context) {
  const target = targetFor(mod, context)
  if (!mod.pack?.url) throw new Error('This one installs from its own page. Use Import file after downloading it.')
  const temp = path.join(os.tmpdir(), `majora-mod-${safeId(mod.id)}${path.extname(new URL(mod.pack.url).pathname) || '.o2r'}`)
  await download(mod.pack.url, temp)
  try {
    return placeFile(mod, temp, target, mod.title)
  } finally {
    rmrf(temp)
  }
}

export async function importMod(mod, file, context) {
  const target = targetFor(mod, context)
  if (!file || !fs.existsSync(file)) throw new Error('That file is not there any more.')
  return placeFile(mod, file, target, mod.title)
}

// Renaming a pack to .off keeps it on disk while the port stops loading it, which
// is the closest thing to an on/off switch the asset loaders offer.
export function toggleMod(mod, context) {
  const target = targetFor(mod, context)
  const files = filesFor(mod, target)
  if (files.length === 0) throw new Error('That mod is not installed yet.')
  for (const entry of files) {
    const full = path.join(target.folder, entry.name)
    if (entry.name.endsWith('.off')) {
      const restored = full.slice(0, -4)
      if (fs.existsSync(restored)) rmrf(restored)
      fs.renameSync(full, restored)
    } else {
      const parked = `${full}.off`
      if (fs.existsSync(parked)) rmrf(parked)
      fs.renameSync(full, parked)
    }
  }
  return 'Mod toggled.'
}

export function removeMod(mod, context) {
  const target = targetFor(mod, context)
  const files = filesFor(mod, target)
  if (files.length === 0) throw new Error('That mod is not installed yet.')
  for (const entry of files) {
    const full = path.join(target.folder, entry.name)
    if (!isInside(full, target.folder)) continue
    rmrf(full)
  }
  return 'Mod removed from the mods folder.'
}

export function modFolder(mod, context) {
  return targetFor(mod, context).folder
}
