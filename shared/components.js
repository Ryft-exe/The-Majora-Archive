// Things Majora Archive can fetch for you. Every entry points at the project's
// own release feed: the launcher downloads the same Windows archive a visitor
// would get from the project page, checks the SHA-256 the feed publishes for it
// (when there is one), and unpacks it into <userData>/tools.
//
// Each component lists every open-source build its community actually maintains:
// the upstream release first, then known forks and alternative projects. Nothing
// here is closed source, and nothing here is a game. ROMs, disc images, keys,
// firmware and BIOS are never downloaded or bundled — the player supplies those.

const releases = (repo) => `https://github.com/${repo}/releases`

function component(entry) {
  const builds = entry.builds.map((build) => ({
    role: 'official',
    ...build,
    link: build.link || (build.repo ? releases(build.repo) : build.site || null),
  }))
  const primary = builds[0]
  return {
    ...entry,
    builds,
    site: entry.site || primary.site,
    license: primary.license,
    release: { provider: 'github', repo: primary.repo },
    asset: primary.asset,
    exe: primary.exe,
  }
}

export const COMPONENTS = [
  component({
    key: 'azahar',
    name: 'Azahar',
    kind: 'emulator',
    systems: 'Nintendo 3DS',
    site: 'https://azahar-emu.org/',
    needs: ['3DS system files from your own console', 'a game image you made yourself'],
    note: 'The community continuation of Citra. Runs the 3DS remakes of Ocarina of Time and Majora’s Mask.',
    builds: [
      {
        key: 'azahar',
        name: 'Azahar',
        by: 'azahar-emu',
        repo: 'azahar-emu/azahar',
        site: 'https://azahar-emu.org/',
        license: {
          name: 'GPL-3.0',
          url: 'https://github.com/azahar-emu/azahar/blob/master/LICENSE.txt',
        },
        asset: { prefer: /windows[-_]?msvc/i, avoid: /installer|arm64|aarch64|libretro/i },
        exe: ['azahar.exe'],
        note: 'The upstream release the 3DS community builds around.',
      },
      {
        key: 'azahar-plus',
        name: 'Azahar Plus',
        role: 'fork',
        by: 'AzaharPlus',
        repo: 'AzaharPlus/AzaharPlus',
        site: 'https://github.com/AzaharPlus/AzaharPlus',
        license: {
          name: 'GPL-3.0',
          url: 'https://github.com/AzaharPlus/AzaharPlus/blob/AzaharPlus/LICENSE.txt',
        },
        asset: { prefer: /windows/i, avoid: /libretro|android|arm64|aarch64|macos|linux|installer/i },
        exe: ['azahar.exe', 'azaharplus.exe'],
        note: 'Tracks Azahar release for release, but accepts game files from every Citra-era fork.',
      },
      {
        key: 'borked3ds',
        name: 'Borked3DS',
        role: 'fork',
        by: 'Borked3DS',
        repo: 'Borked3DS/Borked3DS',
        site: 'https://github.com/Borked3DS/Borked3DS',
        license: {
          name: 'GPL-2.0',
          url: 'https://github.com/Borked3DS/Borked3DS/blob/master/license.txt',
        },
        asset: { prefer: /windows/i, avoid: /installer|arm64|aarch64|linux|macos/i },
        exe: ['borked3ds.exe', 'citra.exe', 'citra-qt.exe'],
        note: 'An experimental Citra lineage with its own patches. Expect bugs; keep separate saves.',
      },
    ],
  }),
  component({
    key: 'melonds',
    name: 'melonDS',
    kind: 'emulator',
    systems: 'Nintendo DS · DSi',
    site: 'https://melonds.kuribo64.net/',
    needs: ['DS or DSi BIOS and firmware from your own console'],
    note: 'DS and DSi emulation for Phantom Hourglass, Spirit Tracks and the Tingle games.',
    builds: [
      {
        key: 'melonds',
        name: 'melonDS',
        by: 'melonDS team',
        repo: 'melonDS-emu/melonDS',
        site: 'https://melonds.kuribo64.net/',
        license: {
          name: 'GPL-3.0',
          url: 'https://github.com/melonDS-emu/melonDS/blob/master/LICENSE',
        },
        asset: {
          prefer: /windows[-_]x86_64/i,
          avoid: /aarch64|arm64|ubuntu|macos|freebsd|netbsd|openbsd|appimage/i,
        },
        exe: ['melonDS.exe'],
        note: 'The reference DS emulator, with DSi mode and Wi-Fi support.',
      },
      {
        key: 'desmume',
        name: 'DeSmuME',
        role: 'alternative',
        by: 'DeSmuME team',
        repo: 'TASEmulators/desmume',
        site: 'https://desmume.org/',
        license: {
          name: 'GPL-2.0',
          url: 'https://github.com/TASEmulators/desmume/blob/master/license.txt',
        },
        asset: { prefer: /win64/i, avoid: /win32|debug|mac|linux|appimage/i },
        exe: ['desmume.exe', 'DeSmuME.exe'],
        note: 'A separate, long-running DS emulator. Slower to update, but some games behave better.',
      },
    ],
  }),
  component({
    key: 'mgba',
    name: 'mGBA',
    kind: 'emulator',
    systems: 'Game Boy Advance',
    site: 'https://mgba.io/',
    needs: [],
    note: 'Accurate GBA emulation with link cable support for Four Swords. No firmware needed.',
    builds: [
      {
        key: 'mgba',
        name: 'mGBA',
        by: 'mGBA team',
        repo: 'mgba-emu/mgba',
        site: 'https://mgba.io/',
        license: {
          name: 'MPL-2.0',
          url: 'https://github.com/mgba-emu/mgba/blob/master/LICENSE',
        },
        asset: { prefer: /win64/i, avoid: /installer|win32|3ds|switch|vita|wii|ubuntu|macos|appimage/i },
        exe: ['mGBA.exe'],
        note: 'The default choice for GBA, and the one Four Swords link play is tested against.',
      },
      {
        key: 'vbam',
        name: 'VisualBoyAdvance-M',
        role: 'alternative',
        by: 'VBA-M team',
        repo: 'visualboyadvance-m/visualboyadvance-m',
        site: 'https://visualboyadvance-m.org/',
        license: {
          name: 'GPL-2.0',
          url: 'https://github.com/visualboyadvance-m/visualboyadvance-m/blob/master/LICENSE',
        },
        asset: { prefer: /Win-.*x86_64|Win64/i, avoid: /debug|arm64|mac|linux|appimage/i },
        exe: ['visualboyadvance-m.exe', 'vbam.exe'],
        note: 'The older GBA front end. Picks up where the original VisualBoyAdvance left off.',
      },
    ],
  }),
  component({
    key: 'cemu',
    name: 'Cemu',
    kind: 'emulator',
    systems: 'Wii U',
    site: 'https://cemu.info/',
    needs: ['Wii U keys from your own console', 'your own game dumps'],
    note: 'Wii U emulation. Breath of the Wild, Wind Waker HD and Twilight Princess HD are the usual reasons to install it.',
    builds: [
      {
        key: 'cemu',
        name: 'Cemu',
        by: 'Cemu project',
        repo: 'cemu-project/Cemu',
        site: 'https://cemu.info/',
        license: {
          name: 'MPL-2.0',
          url: 'https://github.com/cemu-project/Cemu/blob/main/LICENSE.txt',
        },
        asset: { prefer: /windows[-_]x64/i, avoid: /ubuntu|macos|appimage|arm64/i },
        exe: ['Cemu.exe'],
        note: 'The only actively maintained open-source Wii U emulator; there is no fork worth tracking.',
      },
    ],
  }),
  component({
    key: 'sot',
    name: 'Ship of Harkinian',
    kind: 'recomp',
    systems: 'Ocarina of Time · PC port',
    site: 'https://www.shipofharkinian.com/',
    needs: ['your own Ocarina of Time ROM'],
    note: 'The decompilation port. The first run asks for your own Ocarina of Time ROM; nothing is shipped with it.',
    builds: [
      {
        key: 'soh',
        name: 'Ship of Harkinian',
        by: 'Harbour Masters',
        repo: 'HarbourMasters/Shipwright',
        site: 'https://www.shipofharkinian.com/',
        license: {
          name: 'Assets CC BY-NC 4.0',
          url: 'https://github.com/HarbourMasters/Shipwright/blob/develop/ASSETS-LICENSE.md',
          note: 'The project’s own assets are non-commercial; the code licence is in the repository.',
        },
        asset: { prefer: /win64/i, avoid: /mac|linux|appimage|arm64/i },
        exe: ['soh.exe'],
        note: 'The upstream build, with the widest mod support.',
      },
    ],
  }),
  component({
    key: 'twoShip',
    name: '2 Ship 2 Harkinian',
    kind: 'recomp',
    systems: 'Majora’s Mask · PC port',
    site: 'https://github.com/2ship2harkinian/2ship2harkinian',
    needs: ['your own Majora’s Mask ROM'],
    note: 'The Majora’s Mask decompilation port, with widescreen, high frame rates and mod support.',
    builds: [
      {
        key: '2ship',
        name: '2 Ship 2 Harkinian',
        by: 'Harbour Masters',
        repo: '2ship2harkinian/2ship2harkinian',
        site: 'https://github.com/2ship2harkinian/2ship2harkinian',
        license: {
          name: 'CC0-1.0',
          url: 'https://github.com/2ship2harkinian/2ship2harkinian/blob/develop/LICENSE',
        },
        asset: { prefer: /win64/i, avoid: /mac|linux|appimage|arm64/i },
        exe: ['2ship.exe'],
        note: 'The upstream build the Majora’s Mask decomp community ships.',
      },
      {
        key: '2ship-pal',
        name: '2 Ship 2 Harkinian PAL',
        role: 'fork',
        by: 'alexbcz',
        repo: 'alexbcz/2ship2harkinian-PAL',
        site: 'https://github.com/alexbcz/2ship2harkinian-PAL',
        license: {
          name: 'CC0-1.0',
          url: 'https://github.com/alexbcz/2ship2harkinian-PAL/blob/main/LICENSE',
        },
        asset: { prefer: /windows/i, avoid: /linux|mac|appimage|arm64|android/i },
        exe: ['2ship.exe'],
        note: 'Unofficial fork that adds the European PAL 1.1 ROM, with English, French, German and Spanish.',
      },
    ],
  }),
  component({
    key: 'zelda64recomp',
    name: 'Zelda 64: Recompiled',
    kind: 'recomp',
    systems: 'Majora’s Mask · N64 recomp',
    site: 'https://github.com/Zelda64Recomp/Zelda64Recomp',
    needs: ['your own Majora’s Mask ROM'],
    note: 'The static recompilation that started the scene. Your own ROM supplies the assets on first run.',
    builds: [
      {
        key: 'zelda64recomp',
        name: 'Zelda 64: Recompiled',
        by: 'Zelda64Recomp',
        repo: 'Zelda64Recomp/Zelda64Recomp',
        site: 'https://github.com/Zelda64Recomp/Zelda64Recomp',
        license: {
          name: 'GPL-3.0',
          url: 'https://github.com/Zelda64Recomp/Zelda64Recomp/blob/dev/COPYING',
        },
        asset: { prefer: /windows/i, avoid: /linux|macos|flatpak|arm64/i },
        exe: ['Zelda64Recompiled.exe'],
        note: 'The upstream recompilation; its mods are the reason most people pick it.',
      },
    ],
  }),
]

// Programs whose official builds have no stable, machine-readable release feed,
// or whose legal footing means the launcher should never fetch them itself.
export const MANUAL_COMPONENTS = [
  {
    key: 'retroarch',
    name: 'RetroArch',
    kind: 'emulator',
    systems: 'NES · SNES · N64 · GB · GBC · GBA · DS',
    site: 'https://www.retroarch.com/',
    license: { name: 'GPL-3.0', url: 'https://github.com/libretro/RetroArch/blob/master/COPYING' },
    reason:
      'Official Windows builds live on the libretro buildbot rather than a release feed, so there is no stable link to follow. Install it, then add the cores you need from Online Updater → Core Downloader.',
    needs: ['RetroArch cores for each system you play'],
    builds: [
      {
        key: 'retroarch',
        name: 'RetroArch',
        role: 'official',
        by: 'libretro',
        site: 'https://www.retroarch.com/',
        link: 'https://buildbot.libretro.com/stable/',
        license: { name: 'GPL-3.0', url: 'https://github.com/libretro/RetroArch/blob/master/COPYING' },
        note: 'Stable builds plus nightlies on the libretro buildbot.',
      },
    ],
  },
  {
    key: 'dolphin',
    name: 'Dolphin',
    kind: 'emulator',
    systems: 'GameCube · Wii',
    site: 'https://dolphin-emu.org/',
    license: { name: 'GPL-2.0-or-later', url: 'https://github.com/dolphin-emu/dolphin/blob/master/COPYING' },
    reason:
      'Dolphin publishes rolling development builds on its own site with no public release API. Download the Windows x64 build from the project page.',
    needs: [],
    builds: [
      {
        key: 'dolphin',
        name: 'Dolphin',
        role: 'official',
        by: 'Dolphin team',
        site: 'https://dolphin-emu.org/',
        link: 'https://dolphin-emu.org/download/',
        license: { name: 'GPL-2.0-or-later', url: 'https://github.com/dolphin-emu/dolphin/blob/master/COPYING' },
        note: 'The stable release and the rolling beta/nightly channel.',
      },
    ],
  },
  {
    key: 'ares',
    name: 'ares',
    kind: 'emulator',
    systems: 'NES · SNES · N64 · GB · GBC · GBA',
    site: 'https://ares-emu.net/',
    license: { name: 'ISC', url: 'https://ares-emu.net/' },
    reason: 'ares ships through its own site and nightly channel rather than GitHub releases.',
    needs: [],
    builds: [
      {
        key: 'ares',
        name: 'ares',
        role: 'official',
        by: 'ares team',
        site: 'https://ares-emu.net/',
        link: 'https://ares-emu.net/download',
        license: { name: 'ISC', url: 'https://ares-emu.net/' },
        note: 'Official downloads and nightly builds.',
      },
    ],
  },
  {
    key: 'sameboy',
    name: 'SameBoy',
    kind: 'emulator',
    systems: 'Game Boy · Game Boy Color',
    site: 'https://sameboy.github.io/',
    license: { name: 'MIT', url: 'https://sameboy.github.io/' },
    reason: 'SameBoy has no GitHub release feed the launcher can follow. Grab the Windows SDL build from the project page.',
    needs: [],
    builds: [
      {
        key: 'sameboy',
        name: 'SameBoy',
        role: 'official',
        by: 'LIJI',
        site: 'https://sameboy.github.io/',
        link: 'https://sameboy.github.io/download/',
        license: { name: 'MIT', url: 'https://sameboy.github.io/' },
        note: 'Windows SDL build from the project page.',
      },
    ],
  },
  {
    key: 'mame',
    name: 'MAME',
    kind: 'emulator',
    systems: 'Philips CD-i',
    site: 'https://www.mamedev.org/',
    license: { name: 'GPL-2.0-or-later', url: 'https://www.mamedev.org/' },
    reason:
      'MAME is a manual install, and the CD-i trilogy additionally needs the CD-i BIOS and a disc image. Neither is supplied here.',
    needs: ['the CD-i BIOS', 'your own disc image'],
    builds: [
      {
        key: 'mame',
        name: 'MAME',
        role: 'official',
        by: 'MAME team',
        site: 'https://www.mamedev.org/',
        link: 'https://www.mamedev.org/release.html',
        license: { name: 'GPL-2.0-or-later', url: 'https://www.mamedev.org/' },
        note: 'Official Windows binaries.',
      },
    ],
  },
  {
    key: 'ryujinx',
    name: 'Ryujinx',
    kind: 'emulator',
    systems: 'Nintendo Switch',
    site: 'https://ryujinx.app/',
    license: { name: 'MIT', url: 'https://ryujinx.app/' },
    reason:
      'Switch emulation needs your console’s keys and firmware. The launcher never fetches those, so this one stays a manual install.',
    needs: ['Switch keys and firmware from your own console', 'your own game dumps'],
    builds: [
      {
        key: 'ryujinx',
        name: 'Ryujinx',
        role: 'official',
        by: 'Ryujinx community',
        site: 'https://ryujinx.app/',
        link: 'https://ryujinx.app/download',
        license: { name: 'MIT', url: 'https://ryujinx.app/' },
        note: 'Community-maintained builds of the open-source Switch emulator.',
      },
    ],
  },
  {
    key: 'eden',
    name: 'Eden',
    kind: 'emulator',
    systems: 'Nintendo Switch',
    site: 'https://eden-emu.dev/',
    license: { name: 'GPL-3.0', url: 'https://eden-emu.dev/' },
    reason: 'Eden is a manual install for the same reason as Ryujinx: keys and firmware must come from your own console.',
    needs: ['Switch keys and firmware from your own console', 'your own game dumps'],
    builds: [
      {
        key: 'eden',
        name: 'Eden',
        role: 'official',
        by: 'Eden team',
        site: 'https://eden-emu.dev/',
        link: 'https://eden-emu.dev/',
        license: { name: 'GPL-3.0', url: 'https://eden-emu.dev/' },
        note: 'A newer Switch emulator fork used by the Triforce community for save migration.',
      },
    ],
  },
  {
    key: 'triforce',
    name: 'Triforce',
    kind: 'recomp',
    systems: 'Ocarina of Time · Switch 2 remake',
    site: 'https://triforceproject.com/',
    license: { name: 'GPL-3.0', url: 'https://triforceproject.com/' },
    reason:
      'Triforce builds the game from your own copy through Triforce Setup. Majora Archive only opens the Setup you already have.',
    needs: ['Triforce Setup', 'your own game copy to build from'],
    builds: [
      {
        key: 'triforce',
        name: 'Triforce',
        role: 'official',
        by: 'Triforce project',
        site: 'https://triforceproject.com/',
        link: 'https://triforceproject.com/',
        license: { name: 'GPL-3.0', url: 'https://triforceproject.com/' },
        note: 'Triforce Setup owns building and updating; nothing is fetched here.',
      },
    ],
  },
  {
    key: 'triaevumOot',
    name: 'TriAevum: Echoes of Time',
    kind: 'recomp',
    systems: 'Ocarina of Time 3D · recomp',
    site: 'https://github.com/coccofresco/TriAevum',
    license: { name: 'GPL-3.0', url: 'https://github.com/coccofresco/TriAevum/blob/main/LICENSE' },
    reason: 'No public release feed yet. Build or download it from the project page.',
    needs: ['a 3DS copy of Ocarina of Time 3D'],
    builds: [
      {
        key: 'triaevum',
        name: 'TriAevum',
        role: 'official',
        by: 'coccofresco',
        site: 'https://github.com/coccofresco/TriAevum',
        link: 'https://github.com/coccofresco/TriAevum/releases',
        license: { name: 'GPL-3.0', url: 'https://github.com/coccofresco/TriAevum/blob/main/LICENSE' },
        note: 'Both 3DS recompilations ship from the same project.',
      },
    ],
  },
  {
    key: 'triaevumMm',
    name: 'TriAevum: Moonfall Curse',
    kind: 'recomp',
    systems: 'Majora’s Mask 3D · recomp',
    site: 'https://github.com/coccofresco/TriAevum',
    license: { name: 'GPL-3.0', url: 'https://github.com/coccofresco/TriAevum/blob/main/LICENSE' },
    reason: 'No public release feed yet, and currently an alpha. Build or download it from the project page.',
    needs: ['a 3DS copy of Majora’s Mask 3D'],
    builds: [
      {
        key: 'triaevum',
        name: 'TriAevum',
        role: 'official',
        by: 'coccofresco',
        site: 'https://github.com/coccofresco/TriAevum',
        link: 'https://github.com/coccofresco/TriAevum/releases',
        license: { name: 'GPL-3.0', url: 'https://github.com/coccofresco/TriAevum/blob/main/LICENSE' },
        note: 'Both 3DS recompilations ship from the same project.',
      },
    ],
  },
]

export const COMPONENT_KEYS = [...COMPONENTS, ...MANUAL_COMPONENTS].map((component) => component.key)

// Which build runs for a component. `official` is always the first entry.
export const DEFAULT_BUILD = 'official'

export function findComponent(key) {
  return COMPONENTS.find((entry) => entry.key === key) || MANUAL_COMPONENTS.find((entry) => entry.key === key) || null
}

export function findBuild(component, buildKey) {
  if (!component) return null
  return component.builds.find((build) => build.key === buildKey) || component.builds[0]
}

// Everything a download needs for one build: repository, asset rules, exe names,
// and the folder it owns. The upstream build keeps the plain component folder, so
// installs made before build selection existed keep working; forks get their own
// sibling folder and can sit side by side.
export function buildTarget(component, buildKey) {
  const build = findBuild(component, buildKey)
  const first = component.builds[0].key === build.key
  return {
    component,
    build,
    buildKey: build.key,
    cacheKey: `${component.key}:${build.key}`,
    dirName: first ? component.key : `${component.key}__${build.key}`,
    name: build.name,
    by: build.by,
    release: { provider: 'github', repo: build.repo },
    asset: build.asset || component.builds[0].asset,
    exe: build.exe || component.builds[0].exe,
    license: build.license,
  }
}
