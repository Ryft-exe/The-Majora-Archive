import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const MEMORY_TTL = 10 * 60 * 1000
const HEADERS = { 'User-Agent': 'MajoraArchive/0.3 (update check)', Accept: 'application/vnd.github+json' }

let cache = null
let cacheAt = 0
const installedCache = new Map()

function cleanVersion(value) {
  return String(value || '')
    .replace(/^version\s*/i, '')
    .replace(/^v/i, '')
    .trim()
}

function versionParts(value) {
  return cleanVersion(value)
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part))
}

export function compareVersions(left, right) {
  const a = versionParts(left)
  const b = versionParts(right)
  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    const one = a[index] || 0
    const two = b[index] || 0
    if (one > two) return 1
    if (one < two) return -1
  }
  return 0
}

async function fetchJson(url, timeout = 9000) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeout) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function fetchRelease(release) {
  if (release.provider === 'gitea') {
    const list = await fetchJson(`https://git.triforceproject.com/api/v1/repos/${release.repo}/releases?limit=1`)
    const item = Array.isArray(list) ? list[0] : null
    if (!item) throw new Error('No release published yet')
    return {
      tag: item.tag_name,
      name: item.name || item.tag_name,
      url: item.html_url || release.page,
      notes: item.body || '',
      publishedAt: item.published_at || item.created_at || null,
      assets: item.assets || [],
    }
  }

  try {
    const item = await fetchJson(`https://api.github.com/repos/${release.repo}/releases/latest`)
    return {
      tag: item.tag_name,
      name: item.name || item.tag_name,
      url: item.html_url,
      notes: item.body || '',
      publishedAt: item.published_at || null,
      assets: item.assets || [],
    }
  } catch (error) {
    if (release.tags) {
      const list = await fetchJson(`https://api.github.com/repos/${release.repo}/tags?per_page=1`)
      const item = Array.isArray(list) ? list[0] : null
      if (item) {
        return {
          tag: item.name,
          name: item.name,
          url: release.page || `https://github.com/${release.repo}/tags`,
          notes: '',
          publishedAt: null,
          assets: [],
        }
      }
    }
    throw error
  }
}

async function exeVersion(file) {
  if (process.platform !== 'win32' || !file || !fs.existsSync(file)) return null
  try {
    const escaped = file.replace(/'/g, "''")
    const { stdout } = await run(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', `(Get-Item -LiteralPath '${escaped}').VersionInfo.ProductVersion`],
      { timeout: 6000, windowsHide: true },
    )
    const value = String(stdout || '').trim()
    return /\d+\.\d+/.test(value) ? value : null
  } catch {
    return null
  }
}

async function installedVersion(app, config) {
  if (config.appVersions?.[app.key]) return config.appVersions[app.key]

  if (app.key === 'triforce' && app.setupPath) {
    try {
      const value = fs.readFileSync(path.join(path.dirname(app.setupPath), 'tools', 'version.txt'), 'utf8').trim()
      if (value) return value
    } catch {
      // fall through to the executable
    }
  }

  if (app.path) {
    if (installedCache.has(app.key)) return installedCache.get(app.key)
    const value = await exeVersion(app.path)
    installedCache.set(app.key, value)
    return value
  }

  return null
}

function pickWindowsAsset(assets = []) {
  const candidates = assets.filter((asset) => /\.(zip|7z)$/i.test(asset.name || ''))
  const scored = candidates
    .map((asset) => {
      const name = asset.name.toLowerCase()
      let score = 0
      if (/win64|windows|win-?x64/.test(name)) score += 20
      if (/arm|linux|mac|osx|android/.test(name)) score -= 40
      if (/\.zip$/.test(name)) score += 5
      return { asset, score }
    })
    .sort((a, b) => b.score - a.score)
  return scored[0]?.score > 0 ? scored[0].asset : null
}

export async function checkUpdates(apps, config, { force = false } = {}) {
  if (!force && cache && Date.now() - cacheAt < MEMORY_TTL) return cache

  const entries = []
  for (const app of Object.values(apps)) {
    if (app.kind !== 'recomp') continue
    const base = {
      key: app.key,
      name: app.name,
      game: app.game,
      site: app.site,
      setupPath: app.setupPath || null,
      appPath: app.path || null,
      updateKind: app.key === 'triforce' ? 'setup' : 'download',
      installed: null,
      latest: null,
      available: false,
      status: 'manual',
      message: '',
      releaseUrl: app.release?.page || app.site,
    }

    if (!app.release) {
      entries.push({ ...base, message: 'No public release feed yet — check the project page.' })
      continue
    }

    try {
      const release = await fetchRelease(app.release)
      const installed = await installedVersion(app, config)
      const asset = pickWindowsAsset(release.assets)
      let status = 'unknown'
      let available = false
      if (installed && release.tag) {
        const comparison = compareVersions(release.tag, installed)
        available = comparison > 0
        status = available ? 'available' : 'current'
      }
      entries.push({
        ...base,
        installed,
        latest: release.tag,
        available,
        status,
        message: installed ? '' : app.found ? 'Installed version could not be read; open the release page to compare.' : 'Not installed yet — download the latest build or link it in Recomps.',
        releaseUrl: release.url,
        releaseName: release.name,
        notes: String(release.notes || '').slice(0, 700),
        publishedAt: release.publishedAt,
        assetName: asset?.name || null,
        assetUrl: asset?.browser_download_url || null,
      })
    } catch (error) {
      entries.push({
        ...base,
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  cache = entries
  cacheAt = Date.now()
  return entries
}

export function cachedUpdates() {
  return cache
}

export async function downloadUpdate(entry, targetDir) {
  if (!entry?.assetUrl) throw new Error('This project has no Windows download in its latest release.')
  fs.mkdirSync(targetDir, { recursive: true })
  const safeName = path.basename(entry.assetName || `${entry.key}.zip`).replace(/[<>:"/\\|?*]/g, '_')
  const target = path.join(targetDir, safeName)
  const response = await fetch(entry.assetUrl, {
    headers: { 'User-Agent': 'MajoraArchive/0.3 (update download)' },
    signal: AbortSignal.timeout(180000),
  })
  if (!response.ok) throw new Error(`Download returned ${response.status}`)
  fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()))
  return target
}
