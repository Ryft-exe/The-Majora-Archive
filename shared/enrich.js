// Turn raw detection data into the single state object the UI renders. Kept
// pure so the desktop shell and the browser demo share exactly the same rules.

import { GAMES } from './catalog.js'

export function enrichState({
  config,
  apps,
  roms,
  romFolders = [],
  platform = 'win32',
  version = '0.1.0',
  coverUrl = () => null,
  logoUrl = () => null,
}) {
  const games = GAMES.map((game) => {
    const matches = roms[game.id] || []
    const override = config.romPaths?.[game.id] || null

    const variants = game.variants.map((variant) => {
      const app = apps[variant.app]
      const exts = variant.ext || game.ext || []
      const romPath = override || matches.find((match) => exts.includes(match.ext))?.path || null

      let ready = false
      let reason = ''

      if (variant.kind === 'recomp') {
        if (!app?.found) {
          reason = `${app?.name || variant.app} not installed`
        } else if (variant.app === 'triforce' && !/triforce\.exe$/i.test(app.path || '')) {
          reason = 'Build the game with Triforce Setup first'
        } else {
          ready = true
          reason = 'Ready'
        }
      } else {
        if (!app?.found) {
          reason = `${app?.name || variant.app} not installed`
        } else if (variant.core && !(app.cores || []).includes(variant.core.toLowerCase())) {
          reason = `RetroArch core missing: ${variant.core}`
        } else if (!romPath) {
          reason = game.disc ? 'Add your game disc' : 'Add your ROM'
        } else {
          ready = true
          reason = 'Ready'
        }
      }

      return {
        ...variant,
        romPath,
        appPath: app?.path || null,
        ready,
        reason,
      }
    })

    const preferred = variants.find((variant) => variant.ready) || variants[0]

    return {
      ...game,
      variants,
      coverUrl: coverUrl(game.id),
      logoUrl: logoUrl(game.id),
      detectedRom: override || matches[0]?.path || null,
      status: variants.some((variant) => variant.ready) ? 'ready' : 'setup',
      bestVariantId: preferred.id,
    }
  })

  const appList = Object.values(apps).map((app) => ({
    key: app.key,
    kind: app.kind,
    name: app.name,
    systems: app.systems || null,
    site: app.site || null,
    note: app.note || null,
    game: app.game || null,
    found: Boolean(app.found),
    path: app.path || null,
    cores: app.cores || [],
    setupPath: app.setupPath || null,
    setupFound: Boolean(app.setupFound),
  }))

  const readyGames = games.filter((game) => game.status === 'ready')
  const recompGames = games.filter((game) => game.variants.some((variant) => variant.kind === 'recomp'))
  const emulatedGames = games.filter((game) => game.variants.some((variant) => variant.kind === 'emulator'))
  const lastPlayedGame = config.lastPlayed
    ? games.find((game) => game.id === config.lastPlayed.gameId) || null
    : null

  return {
    platform,
    version,
    native: true,
    config: {
      romFolders,
      lastPlayed: config.lastPlayed || null,
    },
    romFolders,
    apps: appList,
    games,
    lastPlayed: lastPlayedGame
      ? { gameId: lastPlayedGame.id, title: lastPlayedGame.title, at: config.lastPlayed.at }
      : null,
    counts: {
      games: games.length,
      ready: readyGames.length,
      recomp: recompGames.length,
      emulated: emulatedGames.length,
      variants: games.reduce((total, game) => total + game.variants.length, 0),
    },
  }
}
