import { useEffect, useMemo, useRef, useState } from 'react'
import type { FocusEvent as ReactFocusEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { MOD_KINDS } from '../shared/mods.js'
import type { AppUpdateState, ModActionResult, ModEntry } from './types'
import { MusicEngine, playButtonSfx, playLaunchSfx } from './audio'
import { getBridge, isDesktop } from './bridge'
import type {
  ActionResult,
  AppConfig,
  AppInfo,
  ComponentInfo,
  ComponentProgress,
  ConfigControl,
  ConfigEntry,
  ConfigFile,
  ConfigPatch,
  ConfigQuickSetting,
  Game,
  LauncherState,
  MusicState,
  UpdateEntry,
  Variant,
  View,
} from './types'

import artHero from './assets/art/hero.jpg'
import artForest from './assets/art/forest.jpg'
import artVolcano from './assets/art/volcano.jpg'
import artOcean from './assets/art/ocean.jpg'
import artDesert from './assets/art/desert.jpg'
import artTwilight from './assets/art/twilight.jpg'
import artFairy from './assets/art/fairy.jpg'
import brandSkullKid from './assets/brand/skullkid.png'
import brandMask from './assets/brand/majora-mask.png'

const ART: Record<string, string> = {
  hero: artHero,
  forest: artForest,
  volcano: artVolcano,
  ocean: artOcean,
  desert: artDesert,
  twilight: artTwilight,
  fairy: artFairy,
}

const artFor = (key: string) => ART[key] || ART.fairy

const PLATFORM_LABEL: Record<string, string> = {
  nes: 'NES',
  snes: 'SNES',
  n64: 'N64',
  gb: 'Game Boy',
  gbc: 'GBC',
  gba: 'GBA',
  gc: 'GameCube',
  wii: 'Wii',
  wiiu: 'Wii U',
  ds: 'DS',
  '3ds': '3DS',
  switch: 'Switch',
  switch2: 'Switch 2',
  cdi: 'CD-i',
  bs: 'Satellaview',
}

type Filter = 'all' | 'ready' | 'recomp' | 'emulated'
type MusicPatch = Partial<Pick<MusicState, 'enabled' | 'muted' | 'volume' | 'source'>>
type IconName =
  | 'library'
  | 'chip'
  | 'spark'
  | 'gear'
  | 'search'
  | 'play'
  | 'folder'
  | 'external'
  | 'close'
  | 'min'
  | 'max'
  | 'check'
  | 'alert'
  | 'plus'
  | 'trash'
  | 'refresh'
  | 'chevron'
  | 'disc'
  | 'music'
  | 'mute'
  | 'volume'
  | 'download'
  | 'moon'

const ICON: Record<IconName, ReactNode> = {
  library: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <rect x="14" y="14" width="7" height="7" rx="1.2" />
    </>
  ),
  chip: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>
  ),
  spark: (
    <>
      <path d="M12 2l2.2 6.1L20 10l-5.8 1.9L12 18l-2.2-6.1L4 10l5.8-1.9L12 2z" />
      <path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16z" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6v.2h-2.6v-.2a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 007.4 15a1.7 1.7 0 00-1.6-1H5.6v-2.6h.2a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 001.9.3 1.7 1.7 0 001-1.6v-.2H14v.2a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.6 1h.2V14h-.2a1.7 1.7 0 00-1.6 1z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </>
  ),
  play: <path d="M8 5l11 7-11 7V5z" fill="currentColor" stroke="none" />,
  folder: <path d="M3 6.5A1.5 1.5 0 014.5 5h5l2 2.5h8A1.5 1.5 0 0121 9v9.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5v-12z" />,
  external: (
    <>
      <path d="M14 3h7v7M21 3l-9 9" />
      <path d="M19 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  min: <path d="M5 12h14" />,
  max: <rect x="5" y="5" width="14" height="14" rx="1.5" />,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  alert: (
    <>
      <path d="M12 3l9.5 17h-19L12 3z" />
      <path d="M12 9v5M12 17.2v.1" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 10-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  disc: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.4" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l10-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9h3l4-4v14l-4-4H4V9z" />
      <path d="M16 9l5 6M21 9l-5 6" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9h3l4-4v14l-4-4H4V9z" />
      <path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />,
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON[name]}
    </svg>
  )
}

function Crest({ size = 34 }: { size?: number }) {
  return <img className="crest" src={brandMask} width={size} height={size} alt="" aria-hidden="true" />
}

function GameArt({ game, className = '', showLogo = false }: { game: Game; className?: string; showLogo?: boolean }) {
  const [coverFailed, setCoverFailed] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    setCoverFailed(false)
    setLogoFailed(false)
  }, [game.id])

  const cover = game.coverUrl && !coverFailed ? game.coverUrl : null

  return (
    <div className={`game-art ${className} ${cover ? 'has-cover' : 'no-cover'}`}>
      <img src={cover || artFor(game.art)} alt="" loading="lazy" onError={() => setCoverFailed(true)} />
      {showLogo && game.logoUrl && !logoFailed && (
        <img className="cover-logo" src={game.logoUrl} alt="" onError={() => setLogoFailed(true)} />
      )}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  children,
  className = '',
  disabled = false,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <button type="button" className={`btn icon ${className}`} title={label} aria-label={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

function SectionIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <header className="section-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </header>
  )
}

function entryId(fileId: string, entry: ConfigEntry) {
  return `${fileId}:${entry.path ?? `${entry.section ?? ''}/${entry.key}`}`
}

// Both melonDS and mGBA store Qt key codes, optionally ORed with Qt's modifier
// flags. These are the values their own capture dialogs write.
const QT_KEYS: Record<string, number> = {
  Escape: 16777216,
  Tab: 16777217,
  Backspace: 16777219,
  Enter: 16777220,
  Insert: 16777222,
  Delete: 16777223,
  Home: 16777232,
  End: 16777233,
  ArrowLeft: 16777234,
  ArrowUp: 16777235,
  ArrowRight: 16777236,
  ArrowDown: 16777237,
  PageUp: 16777238,
  PageDown: 16777239,
  Shift: 16777248,
  Control: 16777249,
  Alt: 16777251,
}

const QT_NAMES = Object.fromEntries(
  Object.entries(QT_KEYS).map(([name, code]) => [code, name]),
) as unknown as Record<number, string>

function qtKeyCode(event: KeyboardEvent): number | null {
  let base = QT_KEYS[event.key]
  if (base === undefined && event.key.length === 1) {
    const code = event.key.toUpperCase().charCodeAt(0)
    if (code >= 32 && code <= 126) base = code
  }
  if (base === undefined && /^F([1-9]|1[0-2])$/.test(event.key)) base = 16777263 + Number(event.key.slice(1))
  if (base === undefined) return null
  let value = base
  if (event.ctrlKey && base !== 16777249) value |= 0x04000000
  if (event.altKey && base !== 16777251) value |= 0x08000000
  if (event.shiftKey && base !== 16777248) value |= 0x02000000
  return value
}

function qtKeyName(raw: string | null): string {
  if (!raw) return 'Unbound'
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  if (value <= 0) return 'Unbound'
  const base = value & 0x01ffffff
  const names: string[] = []
  if (value & 0x04000000) names.push('Ctrl')
  if (value & 0x08000000) names.push('Alt')
  if (value & 0x02000000) names.push('Shift')
  if (base >= 32 && base <= 126) names.push(String.fromCharCode(base))
  else names.push(QT_NAMES[base] || `#${base}`)
  return names.join(' + ')
}

function ConfigDrawer({
  appKey,
  onClose,
  onToast,
}: {
  appKey: string
  onClose: () => void
  onToast: (text: string, tone?: 'info' | 'error') => void
}) {
  const bridge = useMemo(() => getBridge(), [])
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [raw, setRaw] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<'settings' | 'controls'>('settings')
  const [capturing, setCapturing] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    bridge
      .readAppConfig(appKey)
      .then((result) => {
        if (!alive) return
        if (result.ok && result.config) setConfig(result.config)
        else setFailure(result.message || 'That program’s settings could not be read.')
      })
      .catch((error) => {
        if (alive) setFailure(error instanceof Error ? error.message : String(error))
      })
    return () => {
      alive = false
    }
  }, [bridge, appKey])

  const save = (patch: ConfigPatch) => {
    setSaving(patch.fileId + ':' + (patch.path || patch.key || ''))
    void bridge.writeConfigValue(appKey, patch).then((result) => {
      setSaving(null)
      if (result.ok && result.config) {
        setConfig(result.config)
        onToast(result.message || 'Saved.')
      } else {
        onToast(result.message || 'That setting could not be saved.', 'error')
      }
    })
  }

  const restore = (file: ConfigFile) => {
    setSaving(file.id + ':restore')
    void bridge.restoreConfigBackup(appKey, file.id).then((result) => {
      setSaving(null)
      if (result.ok && result.config) {
        setConfig(result.config)
        setRaw({})
      }
      onToast(result.message || 'Restored.', result.ok ? 'info' : 'error')
    })
  }

  useEffect(() => {
    if (!capturing || !config) return
    const target = config.files.flatMap((file) => file.controls).find((item) => item.id === capturing)
    if (!target) {
      setCapturing(null)
      return
    }
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setCapturing(null)
        return
      }
      const code = qtKeyCode(event)
      if (code === null) return
      setCapturing(null)
      save({
        fileId: target.fileId,
        section: target.section,
        key: target.key,
        path: target.path,
        type: 'text',
        value: String(code),
      })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturing, config])

  const quickRow = (file: ConfigFile, item: ConfigQuickSetting) => {
    const key = item.fileId + ':' + (item.path || item.key || '') + ':' + item.label
    const busy = saving === key
    const value = item.value ?? ''

    if (item.type === 'bool') {
      const checked = /^(true|1)$/i.test(value)
      return (
        <div className="tune-row" key={item.id}>
          <div className="tune-copy">
            <b>{item.label}</b>
            {item.note && <span>{item.note}</span>}
          </div>
          <button
            type="button"
            className={`tune-toggle ${checked ? 'on' : ''}`}
            aria-pressed={checked}
            disabled={busy}
            onClick={() =>
              save({
                fileId: item.fileId,
                section: item.section,
                key: item.key,
                path: item.path,
                type: 'bool',
                value: checked ? 'false' : 'true',
              })
            }
          >
            {checked ? 'On' : 'Off'}
          </button>
        </div>
      )
    }

    if (item.type === 'enum') {
      return (
        <div className="tune-row" key={item.id}>
          <div className="tune-copy">
            <b>{item.label}</b>
            {item.note && <span>{item.note}</span>}
          </div>
          <select
            className="tune-input"
            value={value}
            disabled={busy}
            onChange={(event) => {
              const next = event.target.value
              const label = item.options?.find(([option]) => option === next)?.[1] || next
              save({
                fileId: item.fileId,
                section: item.section,
                key: item.key,
                path: item.path,
                type: 'enum',
                value: next,
                also: item.also?.map((extra) => ({ path: extra.path, value: label })),
              })
            }}
          >
            <option value="">— not set —</option>
            {(item.options || []).map(([option, label]) => (
              <option key={option} value={option}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )
    }

    return (
      <div className="tune-row" key={item.id}>
        <div className="tune-copy">
          <b>{item.label}</b>
          {item.note && <span>{item.note}</span>}
        </div>
        <input
          className="tune-input"
          type={item.type === 'number' ? 'number' : 'text'}
          defaultValue={value}
          disabled={busy}
          onBlur={(event) => {
            const next = event.target.value
            if (next === value) return
            save({
              fileId: item.fileId,
              section: item.section,
              key: item.key,
              path: item.path,
              type: item.type === 'number' ? 'number' : 'text',
              value: next,
            })
          }}
        />
      </div>
    )
  }

  const controlRow = (file: ConfigFile, item: ConfigControl) => {
    const busy = saving === item.fileId + ':' + (item.path || item.key || '')
    const binding = capturing === item.id
    const write = (value: string) =>
      save({
        fileId: item.fileId,
        section: item.section,
        key: item.key,
        path: item.path,
        type: 'text',
        value,
      })

    return (
      <div className="tune-row control" key={item.id}>
        <div className="tune-copy">
          <b>{item.label}</b>
          <span>
            {item.kind === 'key'
              ? `${qtKeyName(item.value)}${item.value && !qtKeyName(item.value).startsWith('Unbound') ? ` · code ${item.value}` : ''}`
              : item.value || 'Unbound'}
          </span>
        </div>
        <div className="tune-controls">
          {item.kind === 'key' ? (
            <button
              type="button"
              className={`tune-toggle ${binding ? 'on' : ''}`}
              disabled={busy}
              onClick={() => setCapturing(binding ? null : item.id)}
            >
              {binding ? 'Press a key…' : 'Bind key'}
            </button>
          ) : (
            <input
              key={`${item.id}:${item.value ?? ''}`}
              className="tune-input"
              defaultValue={item.value ?? ''}
              disabled={busy}
              placeholder="Unbound"
              onBlur={(event) => {
                if (event.target.value === (item.value ?? '')) return
                write(event.target.value)
              }}
            />
          )}
          {item.clear !== null && (
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => write(item.clear ?? '')}>
              Clear
            </button>
          )}
        </div>
      </div>
    )
  }

  const entryRow = (file: ConfigFile, entry: ConfigEntry) => {
    const id = entryId(file.id, entry)
    const busy = saving === file.id + ':' + (entry.path || entry.key || '')
    const label = entry.path ? entry.path : entry.section ? `${entry.section} › ${entry.key}` : entry.key
    const isBool = entry.type === 'bool'
    const checked = /^(true|1)$/i.test(entry.value)

    return (
      <div className="tune-row compact" key={id}>
        <div className="tune-copy">
          <b>{label}</b>
        </div>
        {isBool ? (
          <button
            type="button"
            className={`tune-toggle ${checked ? 'on' : ''}`}
            disabled={busy}
            onClick={() =>
              save({
                fileId: file.id,
                section: entry.section,
                key: entry.key,
                path: entry.path,
                type: 'bool',
                value: checked ? 'false' : 'true',
              })
            }
          >
            {checked ? 'true' : 'false'}
          </button>
        ) : (
          <input
            className="tune-input"
            defaultValue={entry.value}
            disabled={busy}
            onBlur={(event) => {
              if (event.target.value === entry.value) return
              save({
                fileId: file.id,
                section: entry.section,
                key: entry.key,
                path: entry.path,
                type: entry.type === 'int' || entry.type === 'float' ? 'number' : 'text',
                value: event.target.value,
              })
            }}
          />
        )}
      </div>
    )
  }

  const needle = filter.trim().toLowerCase()

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer config-drawer" aria-label="Program settings">
        <header className="config-head">
          <div>
            <span className="eyebrow">Program settings</span>
            <h2>{config?.name || 'Settings'}</h2>
          </div>
          <button type="button" className="drawer-close" aria-label="Close settings" onClick={onClose}>
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="tune-tabs" role="tablist" aria-label="Settings sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'settings'}
            className={`tune-tab ${tab === 'settings' ? 'on' : ''}`}
            onClick={() => setTab('settings')}
          >
            Settings
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'controls'}
            className={`tune-tab ${tab === 'controls' ? 'on' : ''}`}
            onClick={() => setTab('controls')}
          >
            Controls
          </button>
        </div>

        <div className="drawer-scroll">
          {failure && <p className="component-error">{failure}</p>}
          {!config && !failure && <p className="component-note">Reading the program’s own settings…</p>}

          {config?.note && <p className="component-note">{config.note}</p>}

          {tab === 'settings' ? (
            <>
          {config?.files.length === 0 && (
            <div className="tune-empty">
              <b>No editable settings file here.</b>
              <span>This program keeps its settings to itself. Open its own menu once it starts.</span>
            </div>
          )}

          {config?.files.map((file) => {
            const visible = needle
              ? file.entries.filter((entry) =>
                  `${entry.section || ''} ${entry.key} ${entry.path || ''} ${entry.value}`.toLowerCase().includes(needle),
                )
              : file.entries
            return (
              <section className="config-file" key={file.id}>
                <header>
                  <div>
                    <h3>{file.label}</h3>
                    <code>{file.path}</code>
                  </div>
                  <div className="config-file-actions">
                    {file.backupExists && (
                      <button
                        type="button"
                        className="btn ghost sm"
                        disabled={saving === file.id + ':restore'}
                        onClick={() => restore(file)}
                      >
                        Restore backup
                      </button>
                    )}
                    <button type="button" className="btn ghost sm" onClick={() => void bridge.openConfigFile(appKey, file.id)}>
                      Reveal file
                    </button>
                  </div>
                </header>

                {!file.exists && (
                  <p className="component-note">
                    Not created yet — start {config.name} once so it writes its settings, then come back. Path it will use:{' '}
                    <code>{file.path}</code>
                  </p>
                )}

                {file.exists && file.error && <p className="component-error">{file.error}</p>}

                {file.quick.length > 0 && <div className="tune-list">{file.quick.map((item) => quickRow(file, item))}</div>}

                {file.entries.length > 0 && (
                  <details className="tune-all" open={file.quick.length === 0}>
                    <summary>
                      All settings in this file <em>{file.entries.length}</em>
                    </summary>
                    <input
                      className="tune-filter"
                      placeholder="Filter keys…"
                      value={filter}
                      onChange={(event) => setFilter(event.target.value)}
                    />
                    <div className="tune-list">
                      {visible.slice(0, 200).map((entry) => entryRow(file, entry))}
                    </div>
                    {visible.length > 200 && <p className="component-note">Showing the first 200 of {visible.length}. Filter to narrow it down.</p>}
                  </details>
                )}

                {file.isText && file.text !== null && (
                  <details className="tune-all">
                    <summary>Edit the raw file</summary>
                    <p className="component-note">
                      The file is saved exactly as written here. A copy is kept as <code>{file.label}.majora-backup</code> beside it.
                    </p>
                    <textarea
                      className="tune-raw"
                      spellCheck={false}
                      rows={14}
                      value={raw[file.id] ?? file.text}
                      onChange={(event) => setRaw((current) => ({ ...current, [file.id]: event.target.value }))}
                    />
                    <button
                      type="button"
                      className="btn gold sm"
                      onClick={() => {
                        const text = raw[file.id] ?? file.text ?? ''
                        void bridge.writeConfigText(appKey, { fileId: file.id, text }).then((result) => {
                          if (result.ok && result.config) {
                            setConfig(result.config)
                            setRaw((current) => {
                              const next = { ...current }
                              delete next[file.id]
                              return next
                            })
                          }
                          onToast(result.message || 'Saved.', result.ok ? 'info' : 'error')
                        })
                      }}
                    >
                      Save file
                    </button>
                  </details>
                )}
              </section>
            )
          })}

          <p className="component-note">
            Changes are written to the program’s own config file. Restart the program if it was open; a running program may
            overwrite its file when it exits. The version from before your last change is kept beside it, and Restore backup
            puts it back.
          </p>
            </>
          ) : (
            <>
              {config && config.files.some((file) => file.controls.length > 0) ? (
                config.files
                  .filter((file) => file.controls.length > 0)
                  .map((file) => (
                    <section className="config-file" key={file.id}>
                      <header>
                        <div>
                          <h3>{file.label}</h3>
                          <code>{file.path}</code>
                        </div>
                        {file.backupExists && (
                          <button
                            type="button"
                            className="btn ghost sm"
                            disabled={saving === file.id + ':restore'}
                            onClick={() => restore(file)}
                          >
                            Restore backup
                          </button>
                        )}
                      </header>
                      <div className="tune-list">{file.controls.map((item) => controlRow(file, item))}</div>
                    </section>
                  ))
              ) : (
                <div className="tune-empty">
                  <b>No bindings editable here.</b>
                  <span>{config?.controlsNote || 'This program keeps input bindings in its own menu or a separate file.'}</span>
                </div>
              )}
              <p className="component-note">
                Bindings are written to the program’s own file. Close the program first, or it may overwrite the file when it
                exits. Escape cancels a key capture.
              </p>
            </>
          )}
        </div>
      </aside>
    </>
  )
}

function AppCard({
  app,
  busy,
  onLocate,
  onOpen,
  onLink,
  onLaunch,
  onSettings,
}: {
  app: AppInfo
  busy: string | null
  onLocate: () => void
  onOpen: () => void
  onLink: () => void
  onLaunch?: () => void
  onSettings: () => void
}) {
  return (
    <article className={`appcard ${app.found ? 'found' : ''}`}>
      <header>
        <div className={`appglyph ${app.kind}`}>{app.name.slice(0, 2)}</div>
        <div>
          <h3>{app.name}</h3>
          <p>{app.systems || app.game || (app.kind === 'recomp' ? 'Native port' : 'Emulator')}</p>
        </div>
        <span className={`dot ${app.found ? 'on' : ''}`} title={app.found ? 'Detected' : 'Not detected'} />
      </header>
      {app.note && <p className="appnote">{app.note}</p>}
      <div className="apppath">
        <code>{app.path || 'Not detected — locate the program below.'}</code>
      </div>
      <div className="app-actions">
        <button type="button" onClick={onLocate} disabled={busy === `app:${app.key}`}>
          {app.found ? 'Change path…' : 'Locate…'}
        </button>
        {app.found && app.kind === 'emulator' && (
          <button type="button" data-sfx="none" onClick={onOpen}>
            Open
          </button>
        )}
        {app.found && onLaunch && (
          <button type="button" data-sfx="none" onClick={onLaunch}>
            Launch
          </button>
        )}
        <button type="button" data-sfx="none" onClick={onSettings}>
          Settings
        </button>
        {app.site && (
          <button type="button" onClick={onLink}>
            Official page
          </button>
        )}
      </div>
    </article>
  )
}

function formatWhen(value?: string | null) {
  if (!value) return 'Not checked yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not checked yet'
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function updateLabel(entry: UpdateEntry) {
  if (entry.status === 'available') return 'Update available'
  if (entry.status === 'current') return 'Up to date'
  if (entry.status === 'manual') return 'Manual check'
  if (entry.status === 'error') return 'Check failed'
  return 'Latest release'
}

function UpdateCard({
  entry,
  busy,
  onDownload,
  onSetup,
  onLink,
}: {
  entry: UpdateEntry
  busy: string | null
  onDownload: () => void
  onSetup: () => void
  onLink: () => void
}) {
  const downloading = busy === `download:${entry.key}`
  const canDownload = entry.updateKind === 'download' && Boolean(entry.assetUrl) && entry.status !== 'current'

  return (
    <article className={`updatecard status-${entry.status}`}>
      <div className="update-icon">
        <Icon name={entry.key === 'triforce' ? 'moon' : 'spark'} size={21} />
      </div>
      <div className="update-copy">
        <div className="update-head">
          <h3>{entry.name}</h3>
          <span className={`update-status ${entry.status}`}>{updateLabel(entry)}</span>
        </div>
        <span className="update-game">{entry.game}</span>
        <div className="version-row">
          <span>
            Installed <b>{entry.installed || '—'}</b>
          </span>
          <i />
          <span>
            Latest <b>{entry.latest || '—'}</b>
          </span>
          {entry.publishedAt && (
            <>
              <i />
              <span>{formatWhen(entry.publishedAt)}</span>
            </>
          )}
        </div>
        {entry.message && <p className="update-message">{entry.message}</p>}
        {entry.notes && <p className="update-notes">{entry.notes}</p>}
      </div>
      <div className="update-actions">
        {entry.updateKind === 'setup' ? (
          <button type="button" className="btn gold sm" onClick={onSetup}>
            {entry.available ? 'Update with Triforce Setup' : 'Open Triforce Setup'}
          </button>
        ) : (
          canDownload && (
            <button type="button" className="btn gold sm" onClick={onDownload} disabled={downloading}>
              <Icon name="download" size={13} /> {downloading ? 'Downloading…' : entry.installed ? 'Download update' : 'Download latest'}
            </button>
          )
        )}
        <button type="button" className="btn ghost sm" onClick={onLink}>
          Release page
        </button>
      </div>
    </article>
  )
}

function ComponentCard({
  component,
  progress,
  busy,
  selectedBuild,
  onSelectBuild,
  onInstall,
  onRemove,
  onLink,
  onOpen,
}: {
  component: ComponentInfo
  progress?: ComponentProgress
  busy: string | null
  selectedBuild?: string
  onSelectBuild: (build: string) => void
  onInstall: (build: string) => void
  onRemove: () => void
  onLink: (url?: string | null) => void
  onOpen: (target: string) => void
}) {
  const builds = component.builds || []
  const active = builds.find((build) => build.key === (selectedBuild || component.build)) || builds[0] || null
  const anyInstalled = builds.some((build) => build.installed)
  const installing = busy === `component:${component.key}`
  const status = installing
    ? 'Working…'
    : active?.installed
      ? active.version
        ? `v${active.version}`
        : 'Installed'
      : 'Not installed'

  return (
    <article className={`componentcard ${component.installed ? 'installed' : ''}`}>
      <header>
        <div className={`componentglyph ${component.kind}`}>{component.name.slice(0, 2)}</div>
        <div className="component-id">
          <h3>{component.name}</h3>
          <p>{component.systems}</p>
        </div>
        <span className={`component-state ${active?.installed ? 'on' : ''}`}>{status}</span>
      </header>

      {builds.length > 1 && (
        <div className="component-builds" role="group" aria-label={`Choose a ${component.name} build`}>
          <span className="build-label">Build</span>
          {builds.map((build) => (
            <button
              key={build.key}
              type="button"
              className={`build-chip ${build.key === active?.key ? 'active' : ''} ${build.installed ? 'on' : ''}`}
              onClick={() => onSelectBuild(build.key)}
              title={`${build.name} · ${build.by} · ${build.license.name}`}
            >
              {build.name}
              {build.role !== 'official' && <em>{build.role === 'fork' ? 'fork' : 'alt'}</em>}
              {build.installed && <i className="build-dot" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="build-detail">
          <span>
            {active.role === 'official' ? 'Upstream build' : active.role === 'fork' ? 'Community fork' : 'Alternative emulator'} by{' '}
            <b>{active.by}</b>
          </span>
          {active.link && (
            <button type="button" className="build-link" onClick={() => onLink(active.link)}>
              Downloads ↗
            </button>
          )}
        </div>
      )}

      <div className="component-meta">
        {(active?.license || component.license) && (
          <button
            type="button"
            className="license-pill"
            onClick={() => onLink(active?.license.url || component.license.url)}
            title={
              active?.license.note || `Open the ${(active?.license || component.license).name} licence`
            }
          >
            <Icon name="disc" size={11} /> {(active?.license || component.license).name}
          </button>
        )}
        {active?.updateAvailable && active.latest && (
          <span className="component-update">v{active.latest} available</span>
        )}
        {active?.verified && (
          <span className="component-verified">
            <Icon name="check" size={11} /> Checksum verified
          </span>
        )}
      </div>

      {(active?.note || component.note) && <p className="component-note">{active?.note || component.note}</p>}

      {component.needs.length > 0 && (
        <div className="component-needs">
          <b>Still yours to supply</b>
          <ul>
            {component.needs.map((need) => (
              <li key={need}>{need}</li>
            ))}
          </ul>
        </div>
      )}

      {installing && progress && (
        <div className="component-progress">
          <div className="bar">
            <i style={{ width: `${Math.max(4, Math.min(100, progress.percent))}%` }} />
          </div>
          <span>{progress.message}</span>
        </div>
      )}
      {!installing && progress?.phase === 'error' && <p className="component-error">{progress.message}</p>}

      {active?.path && (
        <div className="apppath">
          <code>{active.path}</code>
        </div>
      )}

      <div className="app-actions">
        <button
          type="button"
          className="btn gold sm"
          onClick={() => (active && active.installable ? onInstall(active.key) : onLink(active?.link))}
          disabled={installing}
        >
          <Icon name={active?.installable ? 'download' : 'external'} size={13} />{' '}
          {installing
            ? 'Please wait…'
            : !active
              ? 'Download & install'
              : !active.installable
                ? 'Open download page'
                : active.updateAvailable && active.latest
                  ? `Update to v${active.latest}`
                  : active.installed
                    ? 'Reinstall this build'
                    : `Install ${active.name}`}
        </button>
        {(active?.site || component.site) && (
          <button type="button" className="btn ghost sm" onClick={() => onLink(active?.site || component.site)}>
            Project page
          </button>
        )}
        {(active?.license.url || component.license.url) && (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => onLink(active?.license.url || component.license.url)}
          >
            License
          </button>
        )}
        {active?.path && (
          <IconButton label={`Open ${component.name} folder`} onClick={() => onOpen(active.path!)}>
            <Icon name="folder" size={14} />
          </IconButton>
        )}
        {anyInstalled && (
          <IconButton label={`Remove every ${component.name} build`} onClick={onRemove} disabled={installing}>
            <Icon name="trash" size={14} />
          </IconButton>
        )}
      </div>
    </article>
  )
}

export default function App() {
  const bridge = useMemo(() => getBridge(), [])
  const engine = useMemo(() => new MusicEngine(), [])
  const [state, setState] = useState<LauncherState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>('library')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [platform, setPlatform] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; tone: 'info' | 'error' } | null>(null)
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null)
  const [modList, setModList] = useState<ModEntry[] | null>(null)
  const [modFilter, setModFilter] = useState<string>('all')
  const [modQuery, setModQuery] = useState('')
  const [appUpdateLive, setAppUpdateLive] = useState<AppUpdateState | null>(null)
  const [trackName, setTrackName] = useState('Termina Lullaby')
  const [audioReady, setAudioReady] = useState(isDesktop)
  const [componentProgress, setComponentProgress] = useState<Record<string, ComponentProgress>>({})
  const [buildChoice, setBuildChoice] = useState<Record<string, string>>({})
  const [configApp, setConfigApp] = useState<string | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bridge
      .getState()
      .then(setState)
      .catch((error) => setLoadError(error instanceof Error ? error.message : String(error)))
  }, [bridge])

  useEffect(() => {
    engine.onTrack = setTrackName
    return () => engine.dispose()
  }, [engine])

  useEffect(() => {
    if (!state) return
    const first = state.music.tracks[0]
    if (state.music.source === 'files' && first) setTrackName(first.name)
    else if (state.music.source === 'builtin') setTrackName('Termina Lullaby')
  }, [state?.music.source, state?.music.tracks])

  useEffect(() => {
    if (!state) return
    engine.setSettings({
      enabled: state.music.enabled,
      muted: state.music.muted,
      volume: state.music.volume,
      source: state.music.source,
      tracks: state.music.tracks.map(({ name, url }) => ({ name, url })),
    })
  }, [engine, state?.music])

  useEffect(() => {
    const unlock = () => {
      engine.unlock()
      setAudioReady(true)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [engine])

  useEffect(() => {
    const refresh = () => {
      void bridge.getState().then(setState).catch(() => {})
    }
    const offCovers = bridge.onCoversUpdated(refresh)
    const offUpdates = bridge.onUpdatesUpdated(refresh)
    return () => {
      offCovers()
      offUpdates()
    }
  }, [bridge])

  useEffect(() => {
    return bridge.onComponentProgress((update) => {
      setComponentProgress((current) => ({ ...current, [update.key]: update }))
    })
  }, [bridge])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')
      if (event.key === '/' && !typing) {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape') {
        setSelectedId(null)
        if (typing) (document.activeElement as HTMLElement).blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onPress = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const control = target?.closest('button, [role="button"]')
      if (!control || control.closest('[data-sfx="none"]')) return
      if (control.matches(':disabled, [aria-disabled="true"]')) return
      playButtonSfx()
    }
    document.addEventListener('click', onPress, true)
    return () => document.removeEventListener('click', onPress, true)
  }, [])

  useEffect(() => {
    return bridge.onAppUpdate((status) => setAppUpdateLive(status))
  }, [])

  useEffect(() => {
    if (state?.appUpdate && !appUpdateLive) setAppUpdateLive(state.appUpdate)
  }, [state?.appUpdate, appUpdateLive])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  function notify(text: string, tone: 'info' | 'error' = 'info') {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({ text, tone })
    toastTimer.current = window.setTimeout(() => setToast(null), 5200)
  }

  async function act(action: () => Promise<ActionResult>, label?: string) {
    if (label) setBusy(label)
    try {
      const result = await action()
      if (result?.state) setState(result.state)
      if (result?.message) notify(result.message, result.ok === false ? 'error' : 'info')
      return result
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error')
      return undefined
    } finally {
      if (label) setBusy(null)
    }
  }

  async function modAction(action: () => Promise<ModActionResult>, label?: string) {
    const result = (await act(action, label)) as ModActionResult | undefined
    if (result?.mods) setModList(result.mods.entries)
    return result
  }

  async function launch(action: () => Promise<ActionResult>, label?: string) {
    const result = await act(action, label)
    if (result?.ok) {
      const cue = playLaunchSfx()
      // Silence the theme as soon as the launch cue is over, so the two never talk
      // over each other. The timer covers blocked or missing audio, where the cue
      // never reaches its end.
      let silenced = false
      const silence = () => {
        if (silenced) return
        silenced = true
        void act(() => bridge.updateMusic({ muted: true }), 'music')
      }
      cue?.addEventListener('ended', silence, { once: true })
      window.setTimeout(silence, 3200)
    }
    return result
  }

  const games = state?.games || []
  const appFor = (key: string) => state?.apps.find((app) => app.key === key)

  function play(game: Game, variant: Variant) {
    if (!variant.ready) {
      setSelectedId(game.id)
      void setup(game, variant)
      return
    }
    void launch(() => bridge.launch(game.id, variant.id), `${game.id}:${variant.id}`)
  }

  function setup(game: Game, variant: Variant) {
    if (variant.kind === 'emulator') {
      if (!variant.appPath) return act(() => bridge.pickApp(variant.app), `app:${variant.app}`)
      if (!variant.romPath) return act(() => bridge.pickRom(game.id), `rom:${game.id}`)
      const app = appFor(variant.app)
      if (variant.core && app && !app.cores.includes(variant.core.toLowerCase())) {
        return act(() => bridge.openExternal(app.site || 'https://www.retroarch.com/'))
      }
      return undefined
    }
    if (!variant.appPath) {
      if (variant.app === 'triforce') return act(() => bridge.openTriforce(), 'triforce')
      return act(() => bridge.pickApp(variant.app), `app:${variant.app}`)
    }
    return act(() => bridge.pickRom(game.id), `rom:${game.id}`)
  }

  const installComponent = (key: string, build?: string) => {
    setComponentProgress((current) => ({ ...current, [key]: { key, phase: 'release', percent: 2, message: 'Starting…' } }))
    void act(() => bridge.installComponent(key, build), `component:${key}`)
  }

  const pickApp = (key: string) => act(() => bridge.pickApp(key), `app:${key}`)
  const pickRom = (gameId: string) => act(() => bridge.pickRom(gameId), `rom:${gameId}`)
  const openPath = (target: string) => act(() => bridge.openPath(target))
  const openLink = (url?: string | null) => {
    if (url) void act(() => bridge.openExternal(url))
  }
  const openTriforce = () => act(() => bridge.openTriforce(), 'triforce')

  // Hover labels for the drawer actions: shown once, above the button, on a fixed layer so
  // the drawer's scroll container cannot clip them. "below" keeps them on screen near the top.
  const tipHandlers = (text: string) => {
    const place = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect()
      const below = rect.top < 96
      const half = 132
      setTip({
        text,
        x: Math.min(Math.max(rect.left + rect.width / 2, half), window.innerWidth - half),
        y: below ? rect.bottom + 8 : rect.top - 8,
        below,
      })
    }
    return {
      onMouseEnter: (event: ReactMouseEvent<HTMLElement>) => place(event.currentTarget),
      onFocus: (event: ReactFocusEvent<HTMLElement>) => place(event.currentTarget),
      onMouseLeave: () => setTip(null),
      onBlur: () => setTip(null),
      onMouseDown: () => setTip(null),
    }
  }

  function musicPatch(patch: MusicPatch) {
    engine.unlock()
    setAudioReady(true)
    void act(() => bridge.updateMusic(patch), 'music')
  }

  function previewVolume(volume: number) {
    if (!state) return
    setState({ ...state, music: { ...state.music, volume } })
  }

  function commitVolume(volume: number) {
    void act(() => bridge.updateMusic({ volume }), 'music')
  }

  const platforms = useMemo(() => {
    const map = new Map<string, number>()
    for (const game of games) map.set(game.platformKey, (map.get(game.platformKey) || 0) + 1)
    return [...map.entries()].map(([key, count]) => ({ key, label: PLATFORM_LABEL[key] || key, count }))
  }, [games])

  const filtered = useMemo(() => {
    let list = games
    const needle = query.trim().toLowerCase()
    if (needle) {
      list = list.filter((game) =>
        `${game.title} ${game.platform} ${game.year} ${game.variants.map((variant) => variant.label).join(' ')}`
          .toLowerCase()
          .includes(needle),
      )
    }
    if (filter === 'ready') list = list.filter((game) => game.status === 'ready')
    if (filter === 'recomp') list = list.filter((game) => game.variants.some((variant) => variant.kind === 'recomp'))
    if (filter === 'emulated') list = list.filter((game) => game.variants.some((variant) => variant.kind === 'emulator'))
    if (platform !== 'all') list = list.filter((game) => game.platformKey === platform)
    return list
  }, [games, query, filter, platform])

  const selected = games.find((game) => game.id === selectedId) || null
  const emulators = state?.apps.filter((app) => app.kind === 'emulator') || []
  const recomps = state?.apps.filter((app) => app.kind === 'recomp') || []
  const triforce = appFor('triforce')
  const triforceFound = Boolean(triforce?.found)
  const emulatorsFound = emulators.filter((app) => app.found).length
  const recompsFound = recomps.filter((app) => app.found).length
  const updates = state?.updates || []
  const availableUpdates = updates.filter((entry) => entry.available).length
  const switch2Games = games.filter((game) => game.platformKey === 'switch2').length
  const components = state?.components?.entries || []
  const downloadComponents = components.filter((component) => component.automatic)
  const manualComponents = components.filter((component) => !component.automatic)
  const downloadedCount = downloadComponents.filter((component) => component.installed).length
  const manualFound = manualComponents.filter((component) => component.installed).length
  const mods = modList || state?.mods?.entries || []
  const installedMods = mods.filter((mod) => mod.installed).length
  const appUpdate: AppUpdateState = appUpdateLive || state?.appUpdate || {
    status: 'idle',
    version: null,
    percent: 0,
    message: '',
  }
  const gameById = new Map(games.map((game) => [game.id, game]))
  const modGames = games.filter((game) => mods.some((mod) => mod.game === game.id))
  const modNeedle = modQuery.trim().toLowerCase()
  const visibleMods = mods
    .filter((mod) => {
      if (modFilter === 'all') return true
      if (modFilter === 'hacks') return mod.kind === 'romhack'
      return mod.game === modFilter
    })
    .filter((mod) => {
      if (!modNeedle) return true
      const gameName = mod.game ? gameById.get(mod.game)?.title || '' : 'rom hack'
      return [mod.title, mod.by, mod.summary, gameName, MOD_KINDS[mod.kind], ...(mod.tags || [])]
        .join(' ')
        .toLowerCase()
        .includes(modNeedle)
    })
    .sort(
      (left, right) =>
        Number(Boolean(right.featured)) - Number(Boolean(left.featured)) ||
        (right.likes || 0) - (left.likes || 0),
    )

  const featured = games.find((game) => game.id === 'ocarina-of-time-switch-2') || games.find((game) => game.id === 'ocarina-of-time') || games[0]
  const featuredVariant = featured
    ? featured.variants.find((variant) => variant.id === featured.bestVariantId) || featured.variants[0]
    : null

  function go(next: View) {
    setView(next)
    setSelectedId(null)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loadError) {
    return (
      <div className="boot">
        <div>
          <Crest size={62} />
          <h1>Majora Archive could not open.</h1>
          <p>{loadError}</p>
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="boot">
        <div>
          <Crest size={62} />
          <p>Following the fairy…</p>
        </div>
      </div>
    )
  }

  const music = state.music
  const musicPlaying = audioReady && music.enabled && !music.muted && (music.source === 'builtin' || music.tracks.length > 0)
  const musicLabel = music.source === 'files' ? trackName || 'Song of Healing' : 'Termina Lullaby'
  const musicDetail = music.muted
    ? 'Muted'
    : !audioReady
      ? 'Click anywhere to begin'
      : music.source === 'files'
        ? music.tracks.length === 1
          ? 'Local file · from your music folder'
          : `${music.tracks.length} tracks from your folder`
        : 'Original generative fallback'

  const nav: Array<{ id: View; label: string; icon: IconName; badge?: number }> = [
    { id: 'library', label: 'Library', icon: 'library', badge: state.counts.games },
    { id: 'emulators', label: 'Emulators', icon: 'chip', badge: emulatorsFound },
    { id: 'recomps', label: 'Recomps', icon: 'spark', badge: recompsFound },
    { id: 'components', label: 'Components', icon: 'download', badge: downloadedCount || undefined },
    { id: 'mods', label: 'Mods', icon: 'spark', badge: installedMods || undefined },
    { id: 'updates', label: 'Updates', icon: 'refresh', badge: availableUpdates || undefined },
    { id: 'settings', label: 'Settings', icon: 'gear' },
  ]

  return (
    <div className="shell">
      <aside className="rail">
        <button type="button" className="brand" onClick={() => go('library')} aria-label="Majora Archive home">
          <img className="brand-logo" src={brandSkullKid} alt="" aria-hidden="true" />
          <div>
            <strong>MAJORA</strong>
            <span>ARCHIVE</span>
          </div>
        </button>

        <nav className="nav">
          {nav.map((item) => (
            <button key={item.id} type="button" className={view === item.id ? 'on' : ''} onClick={() => go(item.id)}>
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.badge !== undefined && <em className="badge">{item.badge}</em>}
            </button>
          ))}
        </nav>

        <div className="rail-stats">
          <span className="rail-label">Ready to play</span>
          <strong>
            {state.counts.ready}
            <small>/{state.counts.games}</small>
          </strong>
          <div className="meter">
            <i style={{ width: `${Math.round((state.counts.ready / Math.max(1, state.counts.games)) * 100)}%` }} />
          </div>
          <span className="rail-foot">{triforceFound ? 'Triforce linked' : 'Triforce not found'}</span>
        </div>

        <div className={`music-dock ${musicPlaying ? 'playing' : ''}`}>
          <div className="music-eq" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="music-copy">
            <b>{musicLabel}</b>
            <span>{musicDetail}</span>
          </div>
          <button
            type="button"
            className="music-toggle"
            aria-label={music.muted ? 'Unmute music' : 'Mute music'}
            title={music.muted ? 'Unmute music' : 'Mute music'}
            onClick={() => musicPatch({ muted: !music.muted })}
          >
            <Icon name={music.muted ? 'mute' : 'volume'} size={14} />
          </button>
          <input
            className="music-volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={music.volume}
            aria-label="Music volume"
            onChange={(event) => previewVolume(Number(event.target.value))}
            onPointerUp={(event) => commitVolume(Number((event.target as HTMLInputElement).value))}
            onKeyUp={(event) => commitVolume(Number((event.target as HTMLInputElement).value))}
          />
        </div>

        <div className="rail-legal">
          Unofficial fan launcher
          <br />v{state.version} · Majora theme
          <br />Developed by <b>RYFT</b>
        </div>
      </aside>

      <div className="maincol">
        <header className="topbar">
          <label className="search">
            <Icon name="search" size={16} />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                if (view !== 'library') setView('library')
              }}
              placeholder="Search titles, platforms, ports…"
              aria-label="Search the archive"
            />
            <kbd>/</kbd>
          </label>

          <div className="top-right">
            <button
              type="button"
              className={`update-chip ${availableUpdates ? 'on' : ''}`}
              onClick={() => go('updates')}
              title="Open the update centre"
            >
              <Icon name="refresh" size={13} />
              {state.updatesChecking ? 'Checking…' : availableUpdates ? `${availableUpdates} update${availableUpdates === 1 ? '' : 's'}` : 'Up to date'}
            </button>
            <span className={`health ${triforceFound ? 'on' : ''}`}>
              <i />
              {triforceFound ? 'Triforce linked' : 'Triforce not found'}
            </span>
            <span className="top-count">
              <b>{state.counts.ready}</b> ready · <b>{state.counts.variants}</b> ways to play
            </span>
            {isDesktop && (
              <div className="win-controls">
                <button type="button" aria-label="Minimise" onClick={() => bridge.window('min')}>
                  <Icon name="min" size={14} />
                </button>
                <button type="button" aria-label="Maximise" onClick={() => bridge.window('max')}>
                  <Icon name="max" size={12} />
                </button>
                <button type="button" aria-label="Close" className="danger" onClick={() => bridge.window('close')}>
                  <Icon name="close" size={14} />
                </button>
              </div>
            )}
          </div>
        </header>

        {appUpdate.status !== 'idle' && appUpdate.status !== 'current' && (
          <div className={`appbar ${appUpdate.status}`}>
            <Icon name="download" size={15} />
            <span>
              <b>Launcher update</b> {appUpdate.message}
            </span>
            <div className="appbar-actions">
              {appUpdate.status === 'available' && (
                <button type="button" className="btn gold sm" data-sfx="none" onClick={() => void act(() => bridge.downloadAppUpdate())}>
                  Download
                </button>
              )}
              {appUpdate.status === 'ready' && (
                <button type="button" className="btn gold sm" data-sfx="none" onClick={() => void act(() => bridge.installAppUpdate())}>
                  Restart &amp; install
                </button>
              )}
              {appUpdate.status === 'error' && (
                <button
                  type="button"
                  className="btn ghost sm"
                  data-sfx="none"
                  onClick={() => setAppUpdateLive({ ...appUpdate, status: 'current', message: '' })}
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}

        <div className="scroll" ref={scrollRef}>
          {view === 'library' && (
            <div className="view">
              {featured && featuredVariant && (
                <section className="hero">
                  <div className="hero-art">
                    <img src={ART.hero} alt="" />
                  </div>
                  {featured.logoUrl && <img className="hero-logo" src={featured.logoUrl} alt="" />}
                  <div className="hero-inner">
                    <span className="eyebrow">{state.lastPlayed ? 'Continue the loop' : 'The Termina Archive'}</span>
                    <h1>
                      Every legend,
                      <br />
                      <em>under one moon.</em>
                    </h1>
                    <p>
                      Tael lights the way through native recompilations and the emulators that keep the rest alive.
                      Your games, your files, your hardware — and a Switch 2 shelf of its own.
                    </p>
                    <div className="hero-actions">
                      <button
                        type="button"
                        className="btn gold big"
                        data-sfx="none"
                        onClick={() =>
                          featuredVariant.ready
                            ? play(featured, featuredVariant)
                            : (setSelectedId(featured.id), void setup(featured, featuredVariant))
                        }
                        disabled={busy === `${featured.id}:${featuredVariant.id}`}
                      >
                        <Icon name="play" size={16} />
                        {featuredVariant.ready ? 'Play the Switch 2 remake' : 'Set up the Switch 2 remake'}
                      </button>
                      <button
                        type="button"
                        className="btn ghost big"
                        onClick={() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      >
                        Browse the library
                      </button>
                    </div>
                    <div className="hero-meta">
                      <span>
                        <b>{state.counts.games}</b> titles
                      </span>
                      <span>
                        <b>{state.counts.recomp}</b> with native ports
                      </span>
                      <span>
                        <b>{state.counts.variants}</b> ways to play
                      </span>
                      <span className="ok">
                        <b>{switch2Games}</b> Switch 2
                      </span>
                      <span className={triforceFound ? 'ok' : ''}>
                        <b>{triforceFound ? 'Triforce' : 'Setup'}</b> {triforceFound ? 'linked' : 'needed'}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              <div className="section-head" ref={gridRef}>
                <div>
                  <span className="eyebrow">The collection</span>
                  <h2>Every legend, archived.</h2>
                </div>
                <div className="head-count">
                  {filtered.length} of {games.length} titles
                </div>
              </div>

              <div className="filters">
                {(
                  [
                    ['all', 'All titles'],
                    ['ready', 'Ready to play'],
                    ['recomp', 'Native recomp'],
                    ['emulated', 'Emulated'],
                  ] as Array<[Filter, string]>
                ).map(([id, label]) => (
                  <button key={id} type="button" className={`filter ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="platform-row">
                <button type="button" className={`platform ${platform === 'all' ? 'on' : ''}`} onClick={() => setPlatform('all')}>
                  All platforms
                </button>
                {platforms.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    className={`platform ${platform === entry.key ? 'on' : ''}`}
                    onClick={() => setPlatform(entry.key)}
                  >
                    {entry.label} <em>{entry.count}</em>
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div className="empty">
                  <Icon name="search" size={26} />
                  <h3>No legend matches that search.</h3>
                  <p>Try a title, a platform, or clear the filters.</p>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setQuery('')
                      setFilter('all')
                      setPlatform('all')
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="grid">
                  {filtered.map((game) => {
                    const best = game.variants.find((variant) => variant.id === game.bestVariantId) || game.variants[0]
                    return (
                      <article
                        key={game.id}
                        className="card"
                        onClick={() => setSelectedId(game.id)}
                        onKeyDown={(event) => event.key === 'Enter' && setSelectedId(game.id)}
                        tabIndex={0}
                        role="button"
                      >
                        <div className="card-art">
                          <GameArt game={game} showLogo />
                          <span className={`plat p-${game.platformKey}`}>{PLATFORM_LABEL[game.platformKey] || game.platform}</span>
                          <span
                            className={`state-dot ${game.status === 'ready' ? 'ready' : ''}`}
                            title={game.status === 'ready' ? 'Ready to play' : 'Needs setup'}
                          />
                          {best?.ready && (
                            <button
                              type="button"
                              className="card-play"
                              data-sfx="none"
                              title={`Play ${game.title}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                play(game, best)
                              }}
                            >
                              <Icon name="play" size={15} />
                            </button>
                          )}
                        </div>
                        <div className="card-body">
                          <h3>{game.title}</h3>
                          <p className="card-sub">
                            {game.year} · {best?.label}
                          </p>
                          <div className="card-foot">
                            <span className={`kind ${best?.kind === 'emulator' ? 'emu' : ''}`}>
                              {best?.kind === 'recomp' ? 'Recomp' : 'Emulated'}
                            </span>
                            <span className={game.status === 'ready' ? 'foot-ready' : ''}>
                              {game.status === 'ready' ? 'Ready' : 'Setup'}
                            </span>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {view === 'emulators' && (
            <div className="view">
              <SectionIntro
                eyebrow="The armory"
                title="Emulators"
                text="Every program here is open source and installed by you. Majora Archive only points it at the right game file and passes the arguments it expects."
              />
              <div className="quick-stats">
                <span>
                  <b>{emulatorsFound}</b> of {emulators.length} detected
                </span>
                <span>
                  <b>{state.counts.emulated}</b> titles have an emulated route
                </span>
                <span>
                  <b>{state.counts.ready}</b> games ready right now
                </span>
              </div>
              <div className="app-grid">
                {emulators.map((app) => (
                  <AppCard
                    key={app.key}
                    app={app}
                    busy={busy}
                    onLocate={() => pickApp(app.key)}
                    onOpen={() => act(() => bridge.launchApp(app.key), `launch:${app.key}`)}
                    onLink={() => openLink(app.site)}
                    onSettings={() => setConfigApp(app.key)}
                  />
                ))}
              </div>
              <div className="note-panel">
                <Icon name="alert" size={18} />
                <div>
                  <b>About RetroArch cores.</b> RetroArch needs the matching core for each system. Install them from
                  RetroArch’s <em>Online Updater → Core Downloader</em>; the launcher looks for them in the{' '}
                  <code>cores</code> folder beside <code>retroarch.exe</code>.
                </div>
              </div>
            </div>
          )}

          {view === 'recomps' && (
            <div className="view">
              <SectionIntro
                eyebrow="Native, not emulated"
                title="Recomps"
                text="Recompilations and decompilations turn the original game code into a PC program. Majora Archive starts the copies you already built or installed, and keeps an eye on their releases."
              />

              {triforce && (
                <article className="triforce-banner">
                  <div className="tb-mark">
                    <Crest size={40} />
                  </div>
                  <div className="tb-copy">
                    <span className="eyebrow">The one you already have</span>
                    <h3>Triforce, untouched</h3>
                    <p>
                      Triforce Setup still owns building, updating, saves, mods and settings. Majora Archive only adds a door
                      to it — nothing inside your Triforce install is modified.
                    </p>
                    <code>{triforce.setupPath || 'Triforce Setup not detected'}</code>
                  </div>
                  <div className="tb-actions">
                    <button type="button" className="btn gold" onClick={openTriforce} disabled={busy === 'triforce'}>
                      Open Triforce Setup
                    </button>
                    {triforce.path && (
                      <button type="button" className="btn ghost" onClick={() => openPath(triforce.path!)}>
                        Game folder
                      </button>
                    )}
                  </div>
                </article>
              )}

              <div className="app-grid rec-grid">
                {recomps.map((app) => (
                  <AppCard
                    key={app.key}
                    app={app}
                    busy={busy}
                    onLocate={() => pickApp(app.key)}
                    onOpen={() => launch(() => bridge.launchApp(app.key), `launch:${app.key}`)}
                    onLink={() => openLink(app.site)}
                    onLaunch={app.key !== 'triforce' ? () => launch(() => bridge.launchApp(app.key), `launch:${app.key}`) : undefined}
                    onSettings={() => setConfigApp(app.key)}
                  />
                ))}
              </div>

              <div className="note-panel">
                <Icon name="alert" size={18} />
                <div>
                  <b>Bring your own game.</b> These projects ship no assets. Ship of Harkinian, 2 Ship 2 Harkinian and
                  Zelda 64: Recompiled ask for your own ROM when they first run; Triforce builds from your own copy.
                </div>
              </div>
            </div>
          )}

          {view === 'components' && (
            <div className="view">
              <SectionIntro
                eyebrow="The toolkit"
                title="Component Setup"
                text="Download the open-source emulators and recomps this archive drives, straight from each project’s own release feed. Where a project has forks, pick the build you prefer — every one listed is open source and installs side by side. Games, keys, firmware and BIOS are never part of it."
              />

              <div className="quick-stats">
                <span>
                  <b>{downloadedCount}</b> of {downloadComponents.length} downloadable components installed
                </span>
                <span>
                  <b>{manualFound}</b> of {manualComponents.length} manual programs detected
                </span>
                <span>
                  Tools folder <code>{state.components.toolsDir}</code>
                </span>
              </div>

              <div className="component-toolbar">
                <button
                  type="button"
                  className="btn gold sm"
                  onClick={() => act(() => bridge.checkComponents(), 'components:check')}
                  disabled={busy === 'components:check'}
                >
                  <Icon name="refresh" size={13} /> {busy === 'components:check' ? 'Reading feeds…' : 'Check for newer builds'}
                </button>
                <button type="button" className="btn ghost sm" onClick={() => act(() => bridge.openToolsFolder())}>
                  <Icon name="folder" size={13} /> Open tools folder
                </button>
                <span className="component-checked">Last check: {formatWhen(state.components.lastCheck)}</span>
              </div>

              <div className="component-grid">
                {downloadComponents.map((component) => (
                  <ComponentCard
                    key={component.key}
                    component={component}
                    progress={componentProgress[component.key]}
                    busy={busy}
                    selectedBuild={buildChoice[component.key]}
                    onSelectBuild={(build) => {
                      setBuildChoice((current) => ({ ...current, [component.key]: build }))
                      setComponentProgress((current) => {
                        if (!current[component.key]) return current
                        const next = { ...current }
                        delete next[component.key]
                        return next
                      })
                    }}
                    onInstall={(build) => installComponent(component.key, build)}
                    onRemove={() => act(() => bridge.removeComponent(component.key), `component-remove:${component.key}`)}
                    onLink={openLink}
                    onOpen={openPath}
                  />
                ))}
              </div>

              <div className="section-head component-head">
                <div>
                  <span className="eyebrow">Installed by you</span>
                  <h2>Manual programs</h2>
                </div>
                <div className="head-count">{manualFound} detected</div>
              </div>

              <div className="manual-rows">
                {manualComponents.map((component) => (
                  <article className={`manualrow ${component.installed ? 'found' : ''}`} key={component.key}>
                    <span className={`dot ${component.installed ? 'on' : ''}`} />
                    <div className="manual-copy">
                      <h4>
                        {component.name} <em>{component.systems}</em>
                      </h4>
                      <p>{component.reason}</p>
                      {component.needs.length > 0 && <span className="manual-needs">Needs: {component.needs.join(' · ')}</span>}
                      {component.path && <code>{component.path}</code>}
                    </div>
                    <div className="manual-actions">
                      <span className="license-tag">{component.license.name}</span>
                      <button type="button" onClick={() => openLink(component.site)}>
                        Project page
                      </button>
                      {component.license.url && (
                        <button type="button" onClick={() => openLink(component.license.url)}>
                          License
                        </button>
                      )}
                      {component.path && (
                        <button type="button" onClick={() => openPath(component.path!)}>
                          Open folder
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              <div className="note-panel">
                <Icon name="check" size={18} />
                <div>
                  <b>How a download works.</b> The launcher reads the project’s latest GitHub release, picks the Windows
                  archive, downloads it to a temporary cache, compares its SHA-256 with the digest the release publishes
                  (when it publishes one), and unpacks it into <code>tools</code>. Nothing is silently patched, and each
                  license stays with its project.
                </div>
              </div>

              <div className="note-panel">
                <Icon name="alert" size={18} />
                <div>
                  <b>What this never installs.</b> No ROMs, disc images, encryption keys, firmware or BIOS. Azahar,
                  melonDS and Cemu still need files from your own console, and every recomp asks for your own game on
                  first run. Switch emulators and Triforce stay manual on purpose — the launcher will not fetch keys or
                  build a game it does not own.
                </div>
              </div>
            </div>
          )}

          {view === 'updates' && (
            <div className="view">
              <SectionIntro
                eyebrow="The watchtower"
                title="Updates"
                text="Majora Archive reads each project’s own release feed, compares it with the build on this PC, and keeps the download one click away. Triforce stays in Triforce Setup."
              />

              <div className="update-summary">
                <div className="summary-stat">
                  <b>{availableUpdates}</b>
                  <span>Updates ready</span>
                </div>
                <div className="summary-stat">
                  <b>{updates.filter((entry) => entry.status === 'current').length}</b>
                  <span>Up to date</span>
                </div>
                <div className="summary-stat wide">
                  <b>{formatWhen(state.updatesCheckedAt)}</b>
                  <span>Last check</span>
                </div>
                <div className="summary-actions">
                  <label className="auto-toggle">
                    <input
                      type="checkbox"
                      checked={state.updatesAuto}
                      onChange={(event) => act(() => bridge.setUpdateAuto(event.target.checked), 'updates-auto')}
                    />
                    <span className="switch" />
                    Check on launch
                  </label>
                  <button type="button" className="btn gold" onClick={() => act(() => bridge.checkUpdates(), 'updates')} disabled={busy === 'updates'}>
                    <Icon name="refresh" size={14} /> {busy === 'updates' ? 'Checking…' : 'Check now'}
                  </button>
                </div>
              </div>

              {updates.length === 0 ? (
                <div className="empty">
                  <Icon name="refresh" size={26} />
                  <h3>The watchtower is quiet.</h3>
                  <p>Check now to read the release feeds.</p>
                  <button type="button" className="btn gold" onClick={() => act(() => bridge.checkUpdates(), 'updates')}>
                    Check for updates
                  </button>
                </div>
              ) : (
                <div className="update-list">
                  {updates.map((entry) => (
                    <UpdateCard
                      key={entry.key}
                      entry={entry}
                      busy={busy}
                      onDownload={() => act(() => bridge.downloadUpdate(entry.key), `download:${entry.key}`)}
                      onSetup={openTriforce}
                      onLink={() => openLink(entry.releaseUrl)}
                    />
                  ))}
                </div>
              )}

              <div className="note-panel">
                <Icon name="moon" size={18} />
                <div>
                  <b>How updates behave.</b> Triforce updates through its own Setup, exactly as designed. GitHub
                  recomps are downloaded as their latest Windows archive into{' '}
                  <code>Downloads\Majora Archive Updates</code>; unpack it over your existing install, or follow the
                  project’s own instructions. Saves live with each game, not with Majora Archive.
                </div>
              </div>
            </div>
          )}

          {view === 'mods' && (
            <div className="view">
              <SectionIntro
                eyebrow="Mod library"
                title="Mods, for every game in the archive"
                text="A curated shelf of Majora’s Mask and Ocarina of Time mods. Install a pack into the port’s own mods folder, pause it without deleting the file, or import something you downloaded yourself. Nothing here ships game data."
              />

              <label className="mod-search">
                <Icon name="search" size={15} />
                <input
                  value={modQuery}
                  onChange={(event) => setModQuery(event.target.value)}
                  placeholder="Search mods, authors, games…"
                  aria-label="Search the mod library"
                />
                {modQuery && (
                  <button type="button" className="mod-search-clear" onClick={() => setModQuery('')} aria-label="Clear the mod search">
                    <Icon name="close" size={11} />
                  </button>
                )}
              </label>

              <div className="mod-filters">
                <button
                  type="button"
                  className={`mod-filter ${modFilter === 'all' ? 'on' : ''}`}
                  onClick={() => setModFilter('all')}
                >
                  Every game
                </button>
                {modGames.map((game) => (
                  <button
                    key={game.id}
                    type="button"
                    className={`mod-filter ${modFilter === game.id ? 'on' : ''}`}
                    onClick={() => setModFilter(game.id)}
                  >
                    {game.title}
                    <em>{mods.filter((mod) => mod.game === game.id).length}</em>
                  </button>
                ))}
                <button
                  type="button"
                  className={`mod-filter ${modFilter === 'hacks' ? 'on' : ''}`}
                  onClick={() => setModFilter('hacks')}
                >
                  ROM hacks
                </button>
                <span className="mod-count">
                  {visibleMods.length} {visibleMods.length === 1 ? 'mod' : 'mods'}
                </span>
              </div>

              {visibleMods.length === 0 && (
                <p className="mod-empty">Nothing in the archive matches “{modQuery}”.</p>
              )}

              <div className="mod-grid">
                {visibleMods.map((mod) => {
                  const meta = mod.game ? gameById.get(mod.game) : null
                  return (
                  <article key={mod.id} className={`mod-card ${mod.featured ? 'featured' : ''}`}>
                    <header>
                      <span className="chip">{MOD_KINDS[mod.kind]}</span>
                      {typeof mod.likes === 'number' && mod.likes > 0 && <span className="mod-likes">★ {mod.likes}</span>}
                      {mod.installed && <span className="mod-flag on">Installed</span>}
                      {mod.paused && <span className="mod-flag">Paused</span>}
                      {!mod.installed && !mod.paused && mod.gameReady && (
                        <span className="mod-flag">Ready for {mod.build}</span>
                      )}
                    </header>
                    <p className="mod-game">
                      {meta ? meta.title : 'Original hardware & emulators'}
                      <span>
                        {meta ? ` · ${meta.platform}` : ''}
                        {mod.build ? ` · ${mod.build}` : ''}
                      </span>
                    </p>
                    <h3>{mod.title}</h3>
                    <p className="mod-by">by {mod.by}</p>
                    <p className="mod-summary">{mod.summary}</p>
                    {mod.tags.length > 0 && (
                      <div className="mod-tags">
                        {mod.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}
                    {mod.note && <p className="hint">{mod.note}</p>}
                    <div className="mod-actions">
                      {mod.canInstall && !mod.installed && (
                        <button
                          type="button"
                          className="btn gold sm"
                          disabled={busy === `mod:${mod.id}`}
                          onClick={() => void modAction(() => bridge.installMod(mod.id), `mod:${mod.id}`)}
                        >
                          {busy === `mod:${mod.id}` ? 'Installing…' : 'Install'}
                        </button>
                      )}
                      {mod.target && (
                        <button type="button" className="btn ghost sm" onClick={() => void modAction(() => bridge.importMod(mod.id))}>
                          Import file…
                        </button>
                      )}
                      {(mod.installed || mod.paused) && (
                        <button type="button" className="btn ghost sm" onClick={() => void modAction(() => bridge.toggleMod(mod.id))}>
                          {mod.paused ? 'Enable' : 'Disable'}
                        </button>
                      )}
                      {(mod.installed || mod.paused) && (
                        <button type="button" className="btn ghost sm" onClick={() => void modAction(() => bridge.removeMod(mod.id))}>
                          Remove
                        </button>
                      )}
                      <button type="button" className="btn ghost sm" onClick={() => openLink(mod.url)}>
                        Open page
                      </button>
                      {mod.folder && (
                        <IconButton label="Open this game’s mods folder" onClick={() => void act(() => bridge.openModFolder(mod.id))}>
                          <Icon name="folder" size={14} />
                        </IconButton>
                      )}
                    </div>
                  </article>
                  )
                })}
              </div>

              <p className="legal">
                Mods belong to their authors and keep their own licences. Majora Archive only moves pack files into the folder
                the port already reads; it never bundles mod content or game data.
              </p>
            </div>
          )}

          {view === 'settings' && (
            <div className="view">
              <SectionIntro
                eyebrow="The workshop"
                title="Settings"
                text="Point Majora Archive at the programs, folders and music you already use. Everything stays on this PC."
              />

              <div className="settings">
                <section className="panel">
                  <h3>Your Triforce install</h3>
                  <p>The upstream launcher is used unmodified. Change these paths only if you moved it.</p>

                  <div className="pathrow">
                    <span className="label">Launcher</span>
                    <code>{triforce?.setupPath || 'Not detected'}</code>
                    <IconButton label="Locate Triforce Setup" onClick={() => pickApp('triforceSetup')}>
                      <Icon name="folder" size={14} />
                    </IconButton>
                  </div>
                  <div className="pathrow">
                    <span className="label">Built game</span>
                    <code>{triforce?.path || 'Not detected'}</code>
                    <IconButton label="Locate the built game" onClick={() => pickApp('triforce')}>
                      <Icon name="folder" size={14} />
                    </IconButton>
                  </div>

                  <div className="panel-actions">
                    <button type="button" className="btn gold sm" onClick={openTriforce} disabled={!triforce?.setupPath}>
                      Open Triforce Setup
                    </button>
                    {triforce?.path && (
                      <button type="button" className="btn ghost sm" onClick={() => openPath(triforce.path!)}>
                        Open game folder
                      </button>
                    )}
                  </div>
                </section>

                <section className="panel">
                  <h3>Game folders</h3>
                  <p>Scanned up to three folders deep for matching game files. Adding a folder never moves anything.</p>

                  {state.romFolders.length === 0 && <div className="empty-inline">No folders yet.</div>}
                  {state.romFolders.map((folder) => (
                    <div className="folder" key={folder}>
                      <Icon name="folder" size={15} />
                      <code>{folder}</code>
                      <IconButton label="Stop scanning this folder" onClick={() => act(() => bridge.removeRomFolder(folder))}>
                        <Icon name="trash" size={14} />
                      </IconButton>
                    </div>
                  ))}

                  <div className="panel-actions">
                    <button type="button" className="btn gold sm" onClick={() => act(() => bridge.addRomFolder())}>
                      <Icon name="plus" size={14} /> Add folder
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => act(() => bridge.rescan().then((next) => ({ ok: true, state: next, message: 'Library rescanned.' })))}
                    >
                      <Icon name="refresh" size={14} /> Rescan
                    </button>
                  </div>
                </section>

                <section className="panel wide">
                  <h3>Music & the Song of Healing</h3>
                  <p>
                    Your Song of Healing MP3 is kept locally and plays as the launcher theme. If the file is missing,
                    the original generative Termina Lullaby takes over. Add more files you own for a personal
                    soundtrack.
                  </p>

                  <div className="segmented">
                    <button
                      type="button"
                      className={music.source === 'builtin' ? 'on' : ''}
                      onClick={() => musicPatch({ source: 'builtin' })}
                    >
                      <Icon name="moon" size={14} /> Termina Lullaby
                    </button>
                    <button
                      type="button"
                      className={music.source === 'files' ? 'on' : ''}
                      onClick={() => musicPatch({ source: 'files' })}
                    >
                      <Icon name="music" size={14} /> My soundtrack
                    </button>
                  </div>

                  <div className="music-settings-row">
                    <Icon name={music.muted ? 'mute' : 'volume'} size={16} />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={music.volume}
                      aria-label="Music volume"
                      onChange={(event) => previewVolume(Number(event.target.value))}
                      onPointerUp={(event) => commitVolume(Number((event.target as HTMLInputElement).value))}
                      onKeyUp={(event) => commitVolume(Number((event.target as HTMLInputElement).value))}
                    />
                    <button type="button" className="btn ghost sm" onClick={() => musicPatch({ muted: !music.muted })}>
                      {music.muted ? 'Unmute' : 'Mute'}
                    </button>
                  </div>

                  <div className="panel-actions">
                    <button type="button" className="btn gold sm" onClick={() => act(() => bridge.addMusic(), 'music-add')}>
                      <Icon name="plus" size={14} /> Add music…
                    </button>
                    <button type="button" className="btn ghost sm" onClick={() => act(() => bridge.openMusicFolder())}>
                      <Icon name="folder" size={14} /> Open music folder
                    </button>
                    <button type="button" className="btn ghost sm" onClick={() => act(() => bridge.rescanMusic())}>
                      <Icon name="refresh" size={14} /> Rescan
                    </button>
                  </div>

                  <div className="pathrow">
                    <span className="label">Music folder</span>
                    <code>{music.folder}</code>
                  </div>

                  {music.tracks.length === 0 ? (
                    <div className="empty-inline">
                      No tracks yet. Add audio files, or drop them into the folder above. MP3, OGG, WAV, FLAC, M4A and
                      OPUS are read.
                    </div>
                  ) : (
                    <div className="tracklist">
                      {music.tracks.map((track) => (
                        <div className="track" key={track.path || track.url}>
                          <Icon name="music" size={14} />
                          <span>{track.name}</span>
                          {track.removable && (
                            <IconButton
                              label={`Remove ${track.name}`}
                              onClick={() => act(() => bridge.removeMusic(track.path || track.url))}
                            >
                              <Icon name="trash" size={13} />
                            </IconButton>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="fineprint">
                    Majora Archive never downloads the Majora’s Mask soundtrack. The Song of Healing you supplied stays
                    local in <code>Majora Archive\music</code>.
                  </p>
                </section>

                <section className="panel">
                  <h3>Cover art</h3>
                  <div className="cover-stat">
                    <b>{state.covers.found}</b>
                    <span>of {state.covers.total} titles cached</span>
                  </div>
                  <p>
                    Real box art is fetched at runtime from{' '}
                    <a href="https://github.com/libretro-thumbnails" target="_blank" rel="noreferrer">
                      Libretro’s community thumbnail archive
                    </a>{' '}
                    plus Zelda Wiki and Nintendo Everything into <code>Majora Archive\covers</code>. Switch 2 and a
                    few regional exclusives keep original Termina artwork.
                  </p>
                  <div className="panel-actions">
                    <button type="button" className="btn gold sm" onClick={() => act(() => bridge.refreshCovers(), 'covers')} disabled={busy === 'covers'}>
                      <Icon name="refresh" size={14} /> {busy === 'covers' ? 'Fetching covers…' : 'Refresh covers'}
                    </button>
                    <button type="button" className="btn ghost sm" onClick={() => act(() => bridge.openCoverFolder())}>
                      <Icon name="folder" size={14} /> Open cover folder
                    </button>
                  </div>
                </section>

                <section className="panel">
                  <h3>The library</h3>
                  <p>
                    {state.counts.games} titles · {state.counts.variants} ways to play · {state.counts.ready} ready now.
                  </p>
                  <div className="statgrid">
                    <div>
                      <b>{state.counts.recomp}</b>
                      <span>with native ports</span>
                    </div>
                    <div>
                      <b>{state.counts.emulated}</b>
                      <span>emulated systems</span>
                    </div>
                    <div>
                      <b>{emulatorsFound + recompsFound}</b>
                      <span>programs found</span>
                    </div>
                  </div>
                  <div className="panel-actions">
                    <button type="button" className="btn ghost sm" onClick={() => act(() => bridge.openDataFolder())}>
                      Open settings folder
                    </button>
                  </div>
                </section>

                <section className="panel">
                  <h3>Appearance & shortcuts</h3>
                  <p>
                    Press <kbd>/</kbd> to search, <kbd>Esc</kbd> to close a panel. The rail keeps the whole archive one
                    click away.
                  </p>
                  <div className="pathrow">
                    <span className="label">Theme</span>
                    <code>Tael violet · moonlit indigo</code>
                  </div>
                  <div className="pathrow">
                    <span className="label">Accent</span>
                    <code>Fairy light, Termina amber, clockwork teal</code>
                  </div>
                  <div className="pathrow">
                    <span className="label">Fonts</span>
                    <code>Cormorant Garamond · Commissioner (SIL OFL)</code>
                  </div>
                </section>

                <section className="panel wide">
                  <h3>Credits & the fine print</h3>
                  <p>
                    Majora Archive is an unofficial fan launcher. It is not affiliated with Nintendo. Tael, Majora’s
                    Mask and The Legend of Zelda belong to Nintendo; this launcher ships no game data of any kind.
                  </p>
                  <ul className="credits">
                    <li>
                      Developed by <b>RYFT</b>.
                    </li>
                    <li>
                      Built around the approach and design language of the <b>Triforce</b> launcher (GPL-3.0). Triforce
                      Setup itself is used exactly as installed.
                    </li>
                    <li>
                      Emulators and recomps belong to their communities: RetroArch, Dolphin, Cemu, Azahar, melonDS,
                      mGBA, SameBoy, ares, Ryujinx, Eden, MAME, Ship of Harkinian, 2 Ship 2 Harkinian, Zelda 64:
                      Recompiled and TriAevum.
                    </li>
                    <li>
                      Box art is fetched from Libretro’s community thumbnail repositories, Zelda Wiki and Nintendo
                      Everything at runtime and cached locally. Original Termina artwork is used for titles without a
                      public scan.
                    </li>
                    <li>
                      The <b>Song of Healing</b> is played from the MP3 you supplied and stays local; the built-in
                      <b>Termina Lullaby</b> is an original generative fallback. No Nintendo audio is bundled, and
                      personal music files are never uploaded.
                    </li>
                    <li>
                      No ROMs, disc images, encryption keys, firmware, BIOS files or game assets are included,
                      downloaded or shared. Use copies you legally own.
                    </li>
                  </ul>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>

      {configApp && (
        <ConfigDrawer
          appKey={configApp}
          onClose={() => setConfigApp(null)}
          onToast={(text, tone = 'info') => setToast({ text, tone })}
        />
      )}

      {selected && (
        <>
          <div className="drawer-scrim" onClick={() => setSelectedId(null)} />
          <aside className="drawer" aria-label={`${selected.title} details`}>
            <div className="drawer-art">
              <GameArt game={selected} className="drawer-bg" />
              <button type="button" className="drawer-close" aria-label="Close" onClick={() => setSelectedId(null)}>
                <Icon name="close" size={16} />
              </button>
              <div className="drawer-head">
                <span className={`plat p-${selected.platformKey}`}>
                  {PLATFORM_LABEL[selected.platformKey] || selected.platform}
                </span>
                <h2>{selected.title}</h2>
              </div>
            </div>

            <div className="drawer-scroll">
              <div className="meta-row">
                <span>{selected.year}</span>
                <i />
                <span>{selected.platform}</span>
                <i />
                <span className={`status-pill ${selected.status}`}>
                  {selected.status === 'ready' ? 'Ready to play' : 'Setup needed'}
                </span>
              </div>

              <div className="drawer-summary">
                <GameArt game={selected} className="drawer-cover" showLogo />
                <p className="blurb">{selected.blurb}</p>
              </div>

              <h4>Ways to play</h4>
              {selected.variants.map((variant) => {
                const app = appFor(variant.app)
                const working = busy === `${selected.id}:${variant.id}`
                return (
                  <div key={variant.id} className={`variant ${variant.ready ? 'on' : ''}`}>
                    <div className="variant-head">
                      <span className={`chip ${variant.kind}`}>{variant.kind === 'recomp' ? 'Recomp' : 'Emulated'}</span>
                      <b>{variant.label}</b>
                      <span className="variant-state">
                        <i className={`mini-dot ${variant.ready ? 'on' : ''}`} />
                        {variant.ready ? 'Ready' : variant.reason}
                      </span>
                    </div>
                    {variant.note && <p>{variant.note}</p>}
                    <div className="variant-actions">
                      {variant.ready ? (
                        <button type="button" className="btn gold sm" data-sfx="none" onClick={() => play(selected, variant)} disabled={working}>
                          <Icon name="play" size={13} /> {working ? 'Starting…' : 'Play'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn gold sm"
                          onClick={() => void setup(selected, variant)}
                          disabled={busy !== null}
                          {...tipHandlers('Installs the build and links the game copy you own.')}
                        >
                          Set up
                        </button>
                      )}
                      {variant.kind === 'emulator' && (
                        <button type="button" className="btn ghost sm" onClick={() => pickRom(selected.id)} {...tipHandlers('Choose the ROM or disc image you already own. It is read locally, never uploaded.')}>
                          Game file…
                        </button>
                      )}
                      {variant.kind === 'recomp' && (
                        <button type="button" className="btn ghost sm" onClick={() => pickApp(variant.app)} {...tipHandlers('Already have this installed? Point the launcher at the app .exe.')}>
                          Locate app…
                        </button>
                      )}
                      {variant.kind === 'recomp' && variant.app === 'triforce' && (
                        <button type="button" className="btn ghost sm" onClick={openTriforce} {...tipHandlers('Opens Triforce Setup, which builds the game from your own copy.')}>
                          Triforce Setup
                        </button>
                      )}
                      {app?.site && (
                        <button type="button" className="btn ghost sm" onClick={() => openLink(app.site)} {...tipHandlers('Opens this project\u2019s official download page in your browser.')}>
                          {variant.ready ? 'Project page' : 'Get it'}
                        </button>
                      )}
                      {variant.appPath && (
                        <IconButton label="Open app folder" onClick={() => openPath(variant.appPath!)}>
                          <Icon name="folder" size={14} />
                        </IconButton>
                      )}
                    </div>
                    {variant.kind === 'emulator' && !variant.ready && variant.reason.includes('core') && (
                      <p className="hint">
                        In RetroArch, open <em>Online Updater → Core Downloader</em> and install the core named above.
                      </p>
                    )}
                  </div>
                )
              })}

              {selected.ext.length > 0 ? (
                <div className="filebox">
                  <div>
                    <span>{selected.disc ? 'Disc image' : 'Game file'}</span>
                    <code>{selected.detectedRom || 'Not found — choose the file you own.'}</code>
                  </div>
                  <button type="button" className="btn ghost sm" onClick={() => pickRom(selected.id)} {...tipHandlers('Pick the game copy you own. It stays on this device.')}>
                    Choose…
                  </button>
                </div>
              ) : (
                <div className="filebox">
                  <div>
                    <span>Build source</span>
                    <code>Built and updated by Triforce Setup from your own copy.</code>
                  </div>
                </div>
              )}

              <p className="legal">
                Majora Archive ships no game data. {selected.disc ? 'Disc images may also need BIOS or firmware. ' : ''}
                Use only copies you legally own; nothing here is uploaded or shared.
              </p>
            </div>
          </aside>
        </>
      )}

      {tip && (
        <div
          className={`tip ${tip.below ? 'below' : ''}`}
          style={{ left: tip.x, top: tip.y }}
          role="tooltip"
        >
          {tip.text}
        </div>
      )}

      {toast && <div className={`toast ${toast.tone}`}>{toast.text}</div>}
    </div>
  )
}
