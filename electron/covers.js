import fs from 'node:fs'
import path from 'node:path'
import { COVER_SOURCES, COVER_SYSTEMS } from '../shared/covers.js'

const API = 'https://api.github.com/repos/libretro-thumbnails'
const RAW = 'https://raw.githubusercontent.com/libretro-thumbnails'
const WEEK = 7 * 24 * 60 * 60 * 1000
const COVER_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp']
const HEADERS = { 'User-Agent': 'MajoraArchive/0.3 (cover cache)', Accept: 'application/vnd.github+json' }

export function coverFile(cacheDir, gameId) {
  for (const extension of COVER_EXTENSIONS) {
    const file = path.join(cacheDir, `${gameId}${extension}`)
    try {
      if (fs.statSync(file).isFile()) return file
    } catch {
      // try the next extension
    }
  }
  return null
}

function removeCoverFiles(cacheDir, gameId) {
  for (const extension of COVER_EXTENSIONS) {
    try {
      fs.rmSync(path.join(cacheDir, `${gameId}${extension}`), { force: true })
    } catch {
      // best effort
    }
  }
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function regionRank(name) {
  if (/\(usa/i.test(name)) return 0
  if (/\(europe/i.test(name)) return 1
  if (/\(world/i.test(name)) return 2
  if (/\(canada/i.test(name)) return 3
  if (/\(australia/i.test(name)) return 4
  if (/\(japan/i.test(name)) return 8
  return 5
}

function scoreName(name, source) {
  const normalized = normalize(name)
  if (!normalized) return -1
  const exclude = (source.exclude || []).map(normalize).filter(Boolean)
  if (exclude.some((token) => normalized.includes(token))) return -1

  let best = -1
  for (const phrase of source.match) {
    const tokens = normalize(phrase).split(' ').filter(Boolean)
    if (!tokens.length || !tokens.every((token) => normalized.includes(token))) continue
    let score = 100 + tokens.length * 12 - regionRank(name) - Math.min(12, name.length * 0.01)
    if (/virtual console|wii u virtual console/i.test(name)) score -= 18
    if (/\(demo|\(kiosk|\(beta|\(proto|\(unl|\(dpad/i.test(name)) score -= 30
    if (/action replay|preview|promo|symboliclink/i.test(name)) score -= 30
    if (/collector|classic series|player s choice/i.test(name)) score -= 4
    if (/master quest/i.test(name) && !tokens.includes('master')) score -= 40
    best = Math.max(best, score)
  }
  return best
}

export function chooseCover(names, source) {
  let winner = null
  for (const name of names) {
    const score = scoreName(name, source)
    if (score < 0) continue
    if (!winner || score > winner.score) winner = { name, score }
  }
  return winner?.name || null
}

function rawUrl(repo, branch, name) {
  return `${RAW}/${repo}/${branch}/Named_Boxarts/${encodeURIComponent(name)}`
}

async function treeNames(repo, branch) {
  const topResponse = await fetch(`${API}/${repo}/git/trees/${branch}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20000),
  })
  if (!topResponse.ok) throw new Error(`GitHub returned ${topResponse.status}`)
  const top = await topResponse.json()
  const boxarts = (top.tree || []).find((entry) => entry.path === 'Named_Boxarts')
  if (!boxarts?.sha) throw new Error('No Named_Boxarts folder')

  const response = await fetch(`${API}/${repo}/git/trees/${boxarts.sha}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
  const data = await response.json()
  return (data.tree || [])
    .map((entry) => entry.path)
    .filter((entry) => typeof entry === 'string' && entry.toLowerCase().endsWith('.png'))
}

async function readIndex(systemKey, cacheDir, force) {
  const system = COVER_SYSTEMS[systemKey]
  if (!system) throw new Error(`Unknown cover system ${systemKey}`)
  const branch = system.branch || 'master'
  const dir = path.join(cacheDir, '.index')
  const file = path.join(dir, `${systemKey}.json`)
  let cached = null
  try {
    cached = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    cached = null
  }
  if (!force && cached?.fetchedAt && Date.now() - cached.fetchedAt < WEEK && Array.isArray(cached.names)) {
    return cached.names
  }

  try {
    let names = []
    try {
      names = await treeNames(system.repo, branch)
    } catch {
      const response = await fetch(`${API}/${system.repo}/git/trees/${branch}?recursive=1`, {
        headers: HEADERS,
        signal: AbortSignal.timeout(20000),
      })
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
      const data = await response.json()
      const prefix = 'Named_Boxarts/'
      names = (data.tree || [])
        .map((entry) => entry.path)
        .filter((entry) => typeof entry === 'string' && entry.startsWith(prefix) && entry.toLowerCase().endsWith('.png'))
        .map((entry) => entry.slice(prefix.length))
    }
    if (!names.length) throw new Error('No box art in the index')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), names }))
    return names
  } catch (error) {
    if (cached?.names?.length) return cached.names
    throw error
  }
}

async function downloadCover(repo, branch, name, target) {
  const response = await fetch(rawUrl(repo, branch, name), {
    headers: { 'User-Agent': 'MajoraArchive/0.3 (cover cache)' },
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`Cover download returned ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length < 8 || buffer[0] !== 0x89 || buffer.subarray(1, 4).toString() !== 'PNG') {
    throw new Error('Cover was not a PNG')
  }
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, buffer)
}

async function downloadDirectCover(source, cacheDir, gameId) {
  const response = await fetch(source.url, {
    headers: { 'User-Agent': 'MajoraArchive/0.3 (cover cache)' },
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`Cover download returned ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  if (buffer.length < 8 || !contentType.startsWith('image/')) throw new Error('Cover was not an image')

  const extension = source.ext || (contentType.includes('webp') ? '.webp' : contentType.includes('png') ? '.png' : '.jpg')
  const target = path.join(cacheDir, `${gameId}${extension}`)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, buffer)
  return target
}

export function importTriforceLogo(cacheDir) {
  const dirs = [
    path.join(process.env.LOCALAPPDATA || '', 'Triforce', 'launcher', 'media'),
    path.join(process.env.APPDATA || '', 'Triforce', 'launcher', 'media'),
  ]
  for (const dir of dirs) {
    try {
      const logo = fs
        .readdirSync(dir)
        .filter((name) => /^Logo_USEU_00.*\.png$/i.test(name))
        .sort((a, b) => fs.statSync(path.join(dir, b)).size - fs.statSync(path.join(dir, a)).size)[0]
      if (logo) {
        fs.mkdirSync(cacheDir, { recursive: true })
        fs.copyFileSync(path.join(dir, logo), path.join(cacheDir, 'triforce-logo.png'))
        return true
      }
    } catch {
      // keep looking
    }
  }
  return false
}

export async function fetchAllCovers({ cacheDir, force = false, onCover = () => {}, log = () => {} } = {}) {
  fs.mkdirSync(path.join(cacheDir, '.index'), { recursive: true })
  importTriforceLogo(cacheDir)

  const entries = Object.entries(COVER_SOURCES)
  const results = { total: entries.length, downloaded: 0, existing: 0, missing: [], failed: [] }
  const indexes = new Map()

  const getIndex = (systemKey) => {
    if (!indexes.has(systemKey)) indexes.set(systemKey, readIndex(systemKey, cacheDir, force))
    return indexes.get(systemKey)
  }

  const queue = [...entries]
  const worker = async () => {
    for (;;) {
      const entry = queue.shift()
      if (!entry) return
      const [gameId, source] = entry
      if (!force && coverFile(cacheDir, gameId)) {
        results.existing += 1
        continue
      }
      if (force) removeCoverFiles(cacheDir, gameId)
      try {
        if (source.url) {
          await downloadDirectCover(source, cacheDir, gameId)
          results.downloaded += 1
          log(`${gameId} <- direct box art`)
          onCover(gameId)
          continue
        }
        const names = await getIndex(source.system)
        const name = chooseCover(names, source)
        if (!name) {
          results.missing.push(gameId)
          continue
        }
        const system = COVER_SYSTEMS[source.system]
        await downloadCover(system.repo, system.branch || 'master', name, path.join(cacheDir, `${gameId}.png`))
        results.downloaded += 1
        log(`${gameId} <- ${name}`)
        onCover(gameId)
      } catch (error) {
        results.failed.push({ gameId, message: error instanceof Error ? error.message : String(error) })
        log(`${gameId}: ${error instanceof Error ? error.message : error}`)
      }
    }
  }

  await Promise.all(Array.from({ length: 4 }, () => worker()))
  return results
}

export function coverStats(cacheDir, gameIds = []) {
  const found = gameIds.filter((id) => Boolean(coverFile(cacheDir, id))).length
  return { found, total: gameIds.length, availableSystems: Object.keys(COVER_SYSTEMS).length }
}
