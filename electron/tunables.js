import fs from 'node:fs'
import path from 'node:path'
import { tunableFor } from '../shared/tunables.js'

// Settings live in the programs' own files. This module reads those files,
// exposes their real keys, and writes back only the value that changed, leaving
// comments, ordering and unknown keys untouched.

const MAX_TEXT = 400 * 1024
const MAX_ENTRIES = 900

function expandPath(input) {
  if (!input) return ''
  const documents = path.join(process.env.USERPROFILE || '', 'Documents')
  const expanded = String(input)
    .replace(/\{exeDir\}/g, process.env.MAJORA_EXE_DIR || '')
    .replace(/%DOCUMENTS%/gi, documents)
    .replace(/%([A-Za-z_]+)%/g, (_, name) => process.env[name] ?? '')
  return path.normalize(expanded.split('/').join(path.sep))
}

function isFile(target) {
  try {
    return Boolean(target) && fs.statSync(target).isFile()
  } catch {
    return false
  }
}

function readText(target) {
  try {
    return fs.readFileSync(target, 'utf8')
  } catch {
    return null
  }
}

function looksBinary(text) {
  return text.includes('\u0000')
}

function inferType(value) {
  const raw = String(value ?? '').trim()
  if (/^(true|false)$/i.test(raw)) return 'bool'
  if (/^-?\d+$/.test(raw)) return 'int'
  if (/^-?\d*\.\d+$/.test(raw)) return 'float'
  return 'text'
}

function unquote(raw) {
  const text = String(raw ?? '').trim()
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1)
  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1)
  return text
}

function parseIni(text, file) {
  const entries = []
  let section = null
  const spaced = file && file.separator === 'space'
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const head = line.trim()
    if (!head || head.startsWith(';') || head.startsWith('#')) continue
    const header = head.match(/^\[(.+)\]$/)
    if (header) {
      section = header[1].trim()
      continue
    }
    const equals = line.match(/^(\s*[^=;#][^=]*?)(\s*=\s*)(.*)$/)
    const spaces = !equals && spaced ? line.match(/^(\s*)([^\s=#;][^\s=]*)(\s+)(.*)$/) : null
    if (!equals && !spaces) continue
    const value = equals ? equals[3] : spaces[4]
    entries.push({
      section,
      key: equals ? equals[1].trim() : spaces[2],
      value: unquote(value),
      raw: value,
      quoted: /^\s*["']/.test(value),
      type: inferType(unquote(value)),
      line: index,
    })
  }
  return entries
}

function parseXmlEntries(text) {
  const entries = []
  const stack = []
  const tagPattern = /<([^>]*)>/g
  let match
  while ((match = tagPattern.exec(text))) {
    const raw = match[1]
    if (!raw || raw.startsWith('?') || raw.startsWith('!')) continue
    const closing = raw.startsWith('/')
    const selfClosing = raw.endsWith('/')
    const name = raw.replace(/^\//, '').split(/[\s/]/)[0]
    if (closing) {
      const open = stack.pop()
      if (!open || open.name !== name) continue
      const inner = text.slice(open.innerStart, match.index)
      if (inner.includes('<')) continue
      const value = inner.trim()
      entries.push({
        section: open.parent,
        path: open.path,
        key: open.name,
        value,
        type: inferType(value),
      })
    } else if (!selfClosing) {
      const parent = stack[stack.length - 1]
      stack.push({
        name,
        path: parent ? `${parent.path}.${name}` : name,
        parent: parent ? parent.path : null,
        innerStart: tagPattern.lastIndex,
      })
    }
  }
  return entries
}

// Only the text inside an existing element is replaced, so Cemu's XML layout,
// attributes and sibling elements stay exactly as Cemu wrote them.
function setXmlValue(text, dotted, value, type) {
  const stack = []
  const tagPattern = /<([^>]*)>/g
  let match
  while ((match = tagPattern.exec(text))) {
    const raw = match[1]
    if (!raw || raw.startsWith('?') || raw.startsWith('!')) continue
    const closing = raw.startsWith('/')
    const selfClosing = raw.endsWith('/')
    const name = raw.replace(/^\//, '').split(/[\s/]/)[0]
    if (closing) {
      const open = stack.pop()
      if (!open || open.name !== name) continue
      if (open.path === dotted) {
        const rendered = formatFor({ boolStyle: 'lower' }, null, value, type)
        return `${text.slice(0, open.innerStart)}${rendered}${text.slice(match.index)}`
      }
    } else if (!selfClosing) {
      const parent = stack[stack.length - 1]
      stack.push({
        name,
        path: parent ? `${parent.path}.${name}` : name,
        innerStart: tagPattern.lastIndex,
      })
    }
  }
  throw new Error('That setting is not in this file yet — open the program once so it writes it, then try again.')
}

function flattenJson(value, prefix = '', out = []) {
  if (out.length > MAX_ENTRIES) return out
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenJson(item, prefix ? `${prefix}.${index}` : String(index), out))
    return out
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flattenJson(child, prefix ? `${prefix}.${key}` : key, out)
    }
    return out
  }
  out.push({
    path: prefix,
    key: prefix.split('.').pop() || prefix,
    value: value === null ? '' : String(value),
    type: typeof value === 'number' ? (Number.isInteger(value) ? 'int' : 'float') : typeof value === 'boolean' ? 'bool' : 'text',
  })
  return out
}

function readJsonValue(object, dotted) {
  return String(dotted)
    .split('.')
    .reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), object)
}

function setJsonValue(text, dotted, value, type) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON any more, so it was left alone.')
  }
  const parts = String(dotted).split('.')
  let node = data
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]
    if (!node[part] || typeof node[part] !== 'object') node[part] = {}
    node = node[part]
  }
  const leaf = parts[parts.length - 1]
  const previous = node[leaf]
  let next = value
  if (type === 'bool' || typeof previous === 'boolean') next = value === 'true' || value === true
  else if (type === 'int' || typeof previous === 'number') next = Number(value)
  node[leaf] = next
  return `${JSON.stringify(data, null, 2)}\n`
}

function formatFor(file, entry, value, type) {
  if (type === 'bool') {
    const wanted = value === true || value === 'true' || value === 'True'
    if (entry && /^(true|false)$/i.test(String(entry.value))) {
      return String(entry.value).toLowerCase() === String(entry.value) ? (wanted ? 'true' : 'false') : wanted ? 'True' : 'False'
    }
    return file.boolStyle === 'lower' ? (wanted ? 'true' : 'false') : wanted ? 'True' : 'False'
  }
  return String(value)
}

function setIniValue(text, file, entry, value, type) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  const section = entry.section || null
  const key = entry.key
  const spaced = file.separator === 'space'
  const pattern = spaced ? /^(\s*[^\s=#;][^\s=]*)(\s+)(.*)$/ : /^(\s*[^=;#][^=]*?)(\s*=\s*)(.*)$/
  const separator = spaced ? ' ' : ' = '
  let current = null
  let sectionStart = -1
  let sectionEnd = -1
  let found = -1

  for (let index = 0; index < lines.length; index += 1) {
    const head = lines[index].trim()
    const header = head.match(/^\[(.+)\]$/)
    if (header) {
      current = header[1].trim()
      if (section && current.toLowerCase() === section.toLowerCase()) {
        sectionStart = index
        sectionEnd = index
      }
      continue
    }
    if (section && current && current.toLowerCase() === section.toLowerCase()) {
      if (head && !head.startsWith(';') && !head.startsWith('#')) sectionEnd = index
    }
    const match = lines[index].match(pattern)
    if (!match) continue
    if (section && (current || '').toLowerCase() !== section.toLowerCase()) continue
    if (match[1].trim().toLowerCase() !== key.toLowerCase()) continue
    found = index
    break
  }

  const foundValue = found >= 0 ? lines[found].match(pattern)?.[3] ?? '' : ''
  const write = formatFor(file, found >= 0 ? { value: unquote(foundValue) } : null, value, type)
  const quoted = found >= 0 ? /^\s*["']/.test(foundValue) : false
  const rendered = quoted ? `"${write}"` : write

  if (found >= 0) {
    const match = lines[found].match(pattern)
    lines[found] = `${match[1]}${match[2]}${rendered}`
  } else if (section) {
    if (sectionStart >= 0) lines.splice(sectionEnd + 1, 0, `${key}${separator}${rendered}`)
    else lines.push('', `[${section}]`, `${key}${separator}${rendered}`)
  } else {
    lines.push(`${key}${separator}${rendered}`)
  }

  return lines.join(eol)
}

function resolveFile(file, exePath) {
  const candidates = file.paths.map((candidate) => expandPath(candidate.replace(/\{exeDir\}/g, exePath ? path.dirname(exePath) : '')))
  const found = candidates.find((candidate) => isFile(candidate)) || null
  return {
    id: file.id,
    label: file.label,
    format: file.format,
    boolStyle: file.boolStyle || 'lower',
    separator: file.separator || 'equals',
    path: found || candidates[0] || '',
    candidates,
    exists: Boolean(found),
    foundPath: found,
  }
}

function quickId(fileId, item) {
  return item.path ? `${fileId}:${item.path}` : `${fileId}:${item.section || ''}:${item.key}`
}

function quickValue(entries, item) {
  if (item.path) {
    const match = entries.find((entry) => entry.path.toLowerCase() === item.path.toLowerCase())
    return match ? match.value : null
  }
  const match = entries.find(
    (entry) =>
      (entry.section || '').toLowerCase() === (item.section || '').toLowerCase() &&
      entry.key.toLowerCase() === item.key.toLowerCase(),
  )
  return match ? match.value : null
}

function readFileState(tunable, file, exePath) {
  const resolved = resolveFile(file, exePath)
  const state = {
    ...resolved,
    editable: false,
    isText: false,
    size: 0,
    entries: [],
    quick: [],
    controls: [],
    backupExists: false,
    text: null,
    error: null,
  }

  if (!resolved.exists) return state
  state.backupExists = isFile(`${resolved.path}.majora-backup`)

  try {
    state.size = fs.statSync(resolved.path).size
  } catch {
    return state
  }

  const text = readText(resolved.path)
  if (text === null) {
    state.error = 'That file could not be read.'
    return state
  }

  if (file.format === 'binary' || looksBinary(text)) {
    state.error = 'Binary file — open it with the program itself.'
    return state
  }

  state.isText = true
  state.editable = fs.existsSync(resolved.path) && statWritable(resolved.path)
  if (text.length <= MAX_TEXT) state.text = text

  if (file.format === 'json') {
    try {
      state.entries = flattenJson(JSON.parse(text)).slice(0, MAX_ENTRIES)
    } catch {
      state.error = 'That file is not valid JSON right now; it can still be edited as text.'
    }
  } else if (file.format === 'xml') {
    state.entries = parseXmlEntries(text).slice(0, MAX_ENTRIES)
  } else if (file.format !== 'text') {
    // melonDS now writes TOML; its `[Table]` and `key = value` shape parses the
    // same way as the INI files, so one reader covers both.
    state.entries = parseIni(text, file).slice(0, MAX_ENTRIES)
  }

  // A friendly setting is only offered when this version of the program actually
  // stores that key. Newer builds rename things; offering a key they never read
  // would silently write junk into their config.
  const known = (item) => state.entries.length === 0 || quickValue(state.entries, item) !== null

  state.quick = (tunable.quick || [])
    .filter((item) => item.file === file.id && known(item))
    .map((item) => ({
      id: quickId(file.id, item),
      fileId: file.id,
      label: item.label,
      type: item.type,
      options: item.options || null,
      note: item.note || null,
      section: item.section || null,
      key: item.key || null,
      path: item.path || null,
      value: quickValue(state.entries, item),
      also: item.also || null,
    }))

  state.controls = (tunable.controls || [])
    .filter((item) => item.file === file.id && known(item))
    .map((item) => ({
      id: quickId(file.id, item),
      fileId: file.id,
      label: item.label,
      kind: item.kind || 'text',
      code: item.code || null,
      clear: item.clear ?? null,
      section: item.section || null,
      key: item.key || null,
      path: item.path || null,
      value: quickValue(state.entries, item),
    }))

  return state
}

function statWritable(target) {
  try {
    fs.accessSync(target, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

export function readAppConfig(appKey, { exePath } = {}) {
  const tunable = tunableFor(appKey)
  if (!tunable) return null
  return {
    app: appKey,
    name: tunable.name,
    note: tunable.note || null,
    controlsNote: tunable.controlsNote || null,
    exePath: exePath || null,
    files: tunable.files.map((file) => readFileState(tunable, file, exePath)),
  }
}

// Keeps the version that was on disk immediately before this edit, so Restore
// undoes the last change rather than wiping everything ever set.
function backup(target) {
  try {
    fs.copyFileSync(target, `${target}.majora-backup`)
  } catch {
    // A missing backup must not stop the edit; the write itself is atomic.
  }
}

function writeFile(target, contents) {
  const temp = `${target}.majora-tmp`
  fs.writeFileSync(temp, contents, 'utf8')
  fs.renameSync(temp, target)
}

function requireFile(appKey, fileId, exePath) {
  const tunable = tunableFor(appKey)
  if (!tunable) throw new Error('That program has no settings here.')
  const file = tunable.files.find((entry) => entry.id === fileId)
  if (!file) throw new Error('That settings file is not part of this program.')
  const resolved = resolveFile(file, exePath)
  if (!resolved.exists) throw new Error(`${file.label} does not exist yet — start ${tunable.name} once.`)
  return { tunable, file: resolved }
}

export function writeAppValue(appKey, { exePath, fileId, section, key, path: dotted, value, type, also } = {}) {
  const { tunable, file } = requireFile(appKey, fileId, exePath)
  const text = readText(file.path)
  if (text === null) throw new Error('That file could not be read.')

  backup(file.path)
  let next

  if (file.format === 'xml') {
    if (!dotted) throw new Error('No setting was chosen.')
    next = setXmlValue(text, dotted, value, type)
  } else if (file.format === 'json') {
    if (!dotted) throw new Error('No setting was chosen.')
    next = setJsonValue(text, dotted, value, type)
    for (const extra of also || []) {
      next = setJsonValue(next, extra.path, extra.value, typeof extra.value === 'number' ? 'int' : 'text')
    }
  } else {
    if (!key) throw new Error('No setting was chosen.')
    next = setIniValue(text, file, { section: section || null, key }, value, type)
  }

  writeFile(file.path, next)
  return { ok: true, message: `${key || dotted} saved.`, state: readAppConfig(appKey, { exePath }) }
}

export function writeAppText(appKey, { exePath, fileId, text } = {}) {
  const { tunable, file } = requireFile(appKey, fileId, exePath)
  if (typeof text !== 'string') throw new Error('Nothing to save.')
  if (text.length > MAX_TEXT * 4) throw new Error('That file is too large to edit here.')
  backup(file.path)
  writeFile(file.path, text)
  return { ok: true, message: `${file.label} saved.`, state: readAppConfig(appKey, { exePath }) }
}

export function restoreAppBackup(appKey, { exePath, fileId } = {}) {
  const { tunable, file } = requireFile(appKey, fileId, exePath)
  const copy = `${file.path}.majora-backup`
  if (!isFile(copy)) {
    throw new Error(`No backup of ${file.label} yet — the previous version is kept the first time you change a setting.`)
  }
  const contents = fs.readFileSync(copy)
  const temp = `${file.path}.majora-tmp`
  fs.writeFileSync(temp, contents)
  fs.renameSync(temp, file.path)
  return {
    ok: true,
    message: `${tunable.name}: ${file.label} restored from the backup.`,
    state: readAppConfig(appKey, { exePath }),
  }
}

export function configFilePath(appKey, fileId, { exePath } = {}) {
  const tunable = tunableFor(appKey)
  if (!tunable) return null
  const file = tunable.files.find((entry) => entry.id === fileId) || tunable.files[0]
  if (!file) return null
  const resolved = resolveFile(file, exePath)
  return resolved.exists ? resolved.path : resolved.candidates[0] || null
}
