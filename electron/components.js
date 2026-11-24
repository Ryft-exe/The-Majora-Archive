import { execFile } from 'node:child_process'
import crypto from 'node:crypto'
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import sevenBin from '7zip-bin'
import { COMPONENTS, MANUAL_COMPONENTS, buildTarget } from '../shared/components.js'
import { compareVersions } from './updates.js'

const run = promisify(execFile)
const MEMORY_TTL = 10 * 60 * 1000
const HEADERS = { 'User-Agent': 'MajoraArchive/0.3 (component setup)', Accept: 'application/vnd.github+json' }

const releaseCache = new Map()
// Packaged builds unpack 7-Zip beside app.asar; the archive itself cannot be executed.
const sevenZipPath = sevenBin?.path7za
  ? app.isPackaged
    ? sevenBin.path7za.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`)
    : sevenBin.path7za
  : null
const sevenZip = sevenZipPath && fs.existsSync(sevenZipPath) ? sevenZipPath : null

function cleanVersion(value) {
  return String(value || '')
    .replace(/^version\s*/i, '')
    .replace(/^v/i, '')
    .trim()
}

function exists(target) {
  try {
    return fs.statSync(target).isFile()
  } catch {
    return false
  }
}

function isInside(target, root) {
  if (!target || !root) return false
  const child = path.resolve(target).toLowerCase()
  const parent = path.resolve(root).toLowerCase()
  return child === parent || child.startsWith(`${parent}${path.sep}`)
}

async function fetchJson(url, timeout = 20000) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeout) })
  if (!response.ok) throw new Error(`HTTP ${response.status} from the release feed`)
  return response.json()
}

function pickAsset(target, assets = []) {
  const { prefer, avoid } = target.asset || {}
  return assets
    .filter((asset) => /\.(zip|7z)$/i.test(asset.name || ''))
    .filter((asset) => !(avoid && avoid.test(asset.name)))
    .map((asset) => {
      let score = 0
      if (prefer && prefer.test(asset.name)) score += 40
      if (/win/i.test(asset.name)) score += 10
      if (/x64|win64|64/.test(asset.name)) score += 6
      if (/arm64|aarch64/.test(asset.name)) score -= 40
      if (/win32|32bit/.test(asset.name)) score -= 12
      if (/installer|setup/i.test(asset.name)) score -= 40
      if (/\.zip$/i.test(asset.name)) score += 4
      return { asset, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.asset || null
}

// Every build of a component has its own feed, so the cache is keyed by
// "component:build" rather than by component alone.
export async function fetchLatestRelease(target, { force = false } = {}) {
  if (!target.release?.repo) throw new Error(`${target.name} has no release feed. Use its download page.`)

  const cached = releaseCache.get(target.cacheKey)
  if (!force && cached && Date.now() - cached.at < MEMORY_TTL) return cached.release

  const list = await fetchJson(`https://api.github.com/repos/${target.release.repo}/releases?per_page=10`)
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`${target.name} has not published a GitHub release yet.`)
  }

  let fallback = null
  for (const item of list) {
    if (item.draft) continue
    const asset = pickAsset(target, item.assets || [])
    if (!asset) continue
    const release = {
      tag: item.tag_name,
      name: item.name || item.tag_name,
      url: item.html_url,
      notes: String(item.body || '').slice(0, 900),
      publishedAt: item.published_at || null,
      asset: {
        name: asset.name,
        size: asset.size || 0,
        digest: asset.digest || null,
        url: asset.browser_download_url,
      },
    }
    if (!item.prerelease) {
      releaseCache.set(target.cacheKey, { at: Date.now(), release })
      return release
    }
    if (!fallback) fallback = release
  }

  if (fallback) {
    releaseCache.set(target.cacheKey, { at: Date.now(), release: fallback })
    return fallback
  }
  throw new Error(`The latest ${target.name} releases have no Windows archive.`)
}

function safeName(name, fallback) {
  return path.basename(name || fallback).replace(/[<>:"/\\|?*]/g, '_')
}

async function download(asset, target, onProgress) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const response = await fetch(asset.url, {
    headers: { 'User-Agent': 'MajoraArchive/0.3 (component download)' },
    signal: AbortSignal.timeout(900000),
  })
  if (!response.ok) throw new Error(`Download returned ${response.status}`)
  const total = Number(response.headers.get('content-length')) || asset.size || 0
  let received = 0
  let lastReport = 0

  if (!response.body) {
    fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()))
    onProgress?.({ phase: 'download', percent: 80, message: 'Downloaded the archive.' })
    return target
  }

  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length
      const now = Date.now()
      if (now - lastReport > 140) {
        lastReport = now
        const percent = total ? Math.min(80, Math.round((received / total) * 80)) : 40
        const mb = (received / 1024 / 1024).toFixed(1)
        const of = total ? ` of ${(total / 1024 / 1024).toFixed(1)} MB` : ''
        onProgress?.({ phase: 'download', percent, message: `Downloading ${mb} MB${of}…` })
      }
      callback(null, chunk)
    },
  })

  await pipeline(Readable.fromWeb(response.body), counter, fs.createWriteStream(target))
  onProgress?.({ phase: 'download', percent: 82, message: 'Download complete.' })
  return target
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    fs.createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject)
  })
}

function shellEscape(value) {
  return String(value).replace(/'/g, "''")
}

async function extract(archive, destination) {
  fs.mkdirSync(destination, { recursive: true })
  const lower = archive.toLowerCase()
  const isZip = lower.endsWith('.zip')

  // 7-Zip handles both zip and 7z, which some projects (mGBA, for one) ship.
  if (sevenZip) {
    try {
      await run(sevenZip, ['x', archive, `-o${destination}`, '-y'], { timeout: 300000, windowsHide: true })
      return
    } catch (error) {
      if (!isZip) throw new Error(`Could not unpack the archive: ${firstLine(error)}`)
    }
  }

  if (process.platform === 'win32') {
    const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
    if (fs.existsSync(tar)) {
      try {
        await run(tar, ['-xf', archive, '-C', destination], { timeout: 300000, windowsHide: true })
        return
      } catch (error) {
        if (!isZip) throw new Error(`Could not unpack the archive: ${firstLine(error)}`)
      }
    }
    await run(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath '${shellEscape(archive)}' -DestinationPath '${shellEscape(destination)}' -Force`,
      ],
      { timeout: 300000, windowsHide: true },
    )
    return
  }

  await run('tar', ['-xf', archive, '-C', destination], { timeout: 300000 })
}

function firstLine(error) {
  return String(error?.message || error)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('Command failed:'))
    .slice(0, 2)
    .join(' ')
}

function findExe(root, names, depth = 3) {
  const wanted = names.map((name) => name.toLowerCase())
  let found = null

  function walk(dir, level) {
    if (found) return
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isFile() && wanted.includes(entry.name.toLowerCase()) && exists(full)) {
        if (!found || full.length < found.length) found = full
        return
      }
    }
    if (level === 0) return
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      walk(path.join(dir, entry.name), level - 1)
      if (found) return
    }
  }

  walk(root, depth)
  return found
}

// Forks rename their executable more often than upstream does. When the listed
// names are nowhere to be found, take the one obvious program in the folder
// instead of failing the install over a filename.
function findExeFallback(root, depth = 3) {
  const skip = /^(unins|vc_?redist|setup|installer|updater|crash|7za|elevate|ffmpeg)/i
  const candidates = []

  function walk(dir, level) {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isFile() && /\.exe$/i.test(entry.name) && !skip.test(entry.name) && exists(full)) {
        candidates.push(full)
      }
    }
    if (level === 0) return
    for (const entry of entries) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), level - 1)
    }
  }

  walk(root, depth)
  candidates.sort((left, right) => left.length - right.length)
  return candidates[0] || null
}

// Installs made before build selection stored a flat record; fold those into the
// per-build shape so nothing has to be reinstalled.
function recordsFor(config, component) {
  const stored = config.tools?.[component.key]
  const primary = component.builds[0].key
  if (!stored || typeof stored !== 'object') return { active: null, builds: {} }
  if (stored.builds && typeof stored.builds === 'object') {
    return { active: typeof stored.active === 'string' ? stored.active : null, builds: stored.builds }
  }
  if (!stored.version) return { active: null, builds: {} }
  const key = typeof stored.build === 'string' ? stored.build : primary
  return { active: key, builds: { [key]: stored } }
}

function latestFor(config, cacheKey) {
  const entry = config.components?.latest?.[cacheKey]
  return entry?.tag ? cleanVersion(entry.tag) : null
}

function buildInfo({ component, build, config, toolsDir }) {
  const target = buildTarget(component, build.key)
  const record = recordsFor(config, component).builds[build.key] || null
  const dir = path.join(toolsDir, target.dirName)
  const recorded = record?.path && exists(record.path) ? record.path : null
  const exe = recorded || findExe(dir, target.exe) || findExeFallback(dir)
  const version = record?.version || null
  const latest = latestFor(config, target.cacheKey)

  return {
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
    installed: Boolean(exe),
    managed: Boolean(exe && (isInside(exe, toolsDir) || record)),
    version,
    latest,
    updateAvailable: Boolean(version && latest && compareVersions(latest, version) > 0),
    path: exe || null,
    dir,
    sha256: record?.sha256 || null,
    verified: record?.verified ?? null,
    installedAt: record?.installedAt || null,
    assetName: record?.assetName || null,
  }
}

export function componentState({ config, toolsDir, apps = {} }) {
  const entries = []

  for (const component of COMPONENTS) {
    const records = recordsFor(config, component)
    const builds = component.builds.map((build) => buildInfo({ component, build, config, toolsDir }))
    const active =
      builds.find((build) => build.key === records.active && build.installed) ||
      builds.find((build) => build.installed) ||
      builds[0]

    entries.push({
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
      build: active.key,
      builds,
      installed: Boolean(active.installed),
      managed: Boolean(active.managed),
      version: active.version,
      latest: active.latest,
      updateAvailable: Boolean(active.updateAvailable),
      path: active.path,
      sha256: active.sha256,
      verified: active.verified,
      installedAt: active.installedAt,
      assetName: active.assetName,
    })
  }

  for (const component of MANUAL_COMPONENTS) {
    const app = apps[component.key]
    const builds = (component.builds || []).map((build) => ({
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
      installed: Boolean(app?.found),
      managed: false,
      version: null,
      latest: null,
      updateAvailable: false,
      path: app?.path || null,
      dir: null,
      sha256: null,
      verified: null,
      installedAt: null,
      assetName: null,
    }))

    entries.push({
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
      installed: Boolean(app?.found),
      managed: false,
      version: null,
      latest: null,
      updateAvailable: false,
      path: app?.path || null,
      sha256: null,
      verified: null,
      installedAt: null,
      assetName: null,
    })
  }

  return {
    toolsDir,
    lastCheck: config.components?.lastCheck || null,
    entries,
  }
}

export async function checkComponents({ config, toolsDir, apps = {} }) {
  const latest = { ...(config.components?.latest || {}) }
  const failures = []

  for (const component of COMPONENTS) {
    for (const build of component.builds) {
      if (!build.repo) continue
      const target = buildTarget(component, build.key)
      try {
        const release = await fetchLatestRelease(target, { force: true })
        latest[target.cacheKey] = {
          tag: release.tag,
          assetName: release.asset.name,
          url: release.url,
          at: new Date().toISOString(),
        }
      } catch (error) {
        const name = build.key === component.builds[0].key ? component.name : `${component.name} (${build.name})`
        failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
        delete latest[target.cacheKey]
      }
    }
  }

  config.components = { ...(config.components || {}), latest, lastCheck: new Date().toISOString() }
  return {
    state: componentState({ config, toolsDir, apps }),
    failures,
  }
}

export async function installComponent(component, { buildKey, config, toolsDir, onProgress }) {
  if (!component) throw new Error('Unknown component.')
  if (process.platform !== 'win32') throw new Error('Component Setup downloads Windows builds only.')

  const target = buildTarget(component, buildKey)
  if (!target.build.repo) {
    throw new Error(`${target.name} has no release feed the launcher can follow. Use its download page.`)
  }

  onProgress?.({ phase: 'release', percent: 3, message: `Reading ${target.name}’s release feed…` })
  const release = await fetchLatestRelease(target, { force: true })
  const asset = release.asset

  const cacheDir = path.join(toolsDir, '.cache')
  const archive = path.join(cacheDir, safeName(asset.name, `${target.dirName}.zip`))
  const staging = path.join(toolsDir, `.staging-${target.dirName}`)
  const installDir = path.join(toolsDir, target.dirName)

  fs.rmSync(staging, { recursive: true, force: true })

  try {
    await download(asset, archive, onProgress)

    onProgress?.({ phase: 'verify', percent: 84, message: 'Checking the archive…' })
    const digest = await sha256(archive)
    const published = typeof asset.digest === 'string' && asset.digest.startsWith('sha256:')
      ? asset.digest.slice('sha256:'.length).toLowerCase()
      : null
    if (published && published !== digest) {
      throw new Error('The archive did not match the SHA-256 published in the release. It was deleted.')
    }

    onProgress?.({ phase: 'extract', percent: 90, message: 'Unpacking into the tools folder…' })
    await extract(archive, staging)

    fs.mkdirSync(installDir, { recursive: true })
    fs.cpSync(staging, installDir, { recursive: true, force: true, errorOnExist: false })

    const exe = findExe(installDir, target.exe) || findExeFallback(installDir)
    if (!exe) {
      throw new Error(`Unpacked, but no ${target.exe.join(' or ')} was found. Open the tools folder to look.`)
    }

    const version = cleanVersion(release.tag)
    const record = {
      version,
      installedAt: new Date().toISOString(),
      assetName: asset.name,
      sha256: digest,
      verified: published ? true : null,
    }

    const records = recordsFor(config, component)
    config.tools = {
      ...(config.tools || {}),
      [component.key]: {
        active: target.buildKey,
        builds: { ...records.builds, [target.buildKey]: record },
      },
    }
    config.apps = { ...(config.apps || {}), [component.key]: exe }
    config.components = {
      ...(config.components || {}),
      latest: {
        ...(config.components?.latest || {}),
        [target.cacheKey]: { tag: release.tag, assetName: asset.name, url: release.url, at: new Date().toISOString() },
      },
    }

    onProgress?.({ phase: 'done', percent: 100, message: `${target.name} is ready.` })
    return { version, path: exe, verified: record.verified, assetName: asset.name, build: target.buildKey }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true })
    fs.rmSync(archive, { force: true })
  }
}

export async function removeComponent(component, { config, toolsDir }) {
  if (!component) throw new Error('Unknown component.')

  for (const build of component.builds) {
    const target = buildTarget(component, build.key)
    fs.rmSync(path.join(toolsDir, target.dirName), { recursive: true, force: true })
  }

  if (config.tools?.[component.key]) {
    const tools = { ...config.tools }
    delete tools[component.key]
    config.tools = tools
  }

  const override = config.apps?.[component.key]
  if (override && isInside(override, toolsDir)) {
    const apps = { ...config.apps }
    delete apps[component.key]
    config.apps = apps
  }

  return { removed: true }
}
