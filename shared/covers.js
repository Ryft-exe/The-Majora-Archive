// Where a real box scan can be found. Libretro's thumbnail repositories host
// named box art for most of the systems here. Libretro has no Switch set, so
// those six Switch titles use direct box-art scans from Zelda Wiki and
// Nintendo Everything. Covers are fetched at runtime into the player's own
// cache and are never shipped with Majora Archive.

export const COVER_SYSTEMS = {
  nes: { repo: 'Nintendo_-_Nintendo_Entertainment_System' },
  snes: { repo: 'Nintendo_-_Super_Nintendo_Entertainment_System' },
  n64: { repo: 'Nintendo_-_Nintendo_64' },
  gb: { repo: 'Nintendo_-_Game_Boy' },
  gbc: { repo: 'Nintendo_-_Game_Boy_Color' },
  gba: { repo: 'Nintendo_-_Game_Boy_Advance' },
  gc: { repo: 'Nintendo_-_GameCube' },
  wii: { repo: 'Nintendo_-_Wii' },
  wiiu: { repo: 'Nintendo_-_Wii_U' },
  ds: { repo: 'Nintendo_-_Nintendo_DS' },
  '3ds': { repo: 'Nintendo_-_Nintendo_3DS' },
  bs: { repo: 'Nintendo_-_Satellaview' },
  cdi: { repo: 'Philips_-_CD-i', branch: 'main' },
}

export const COVER_SOURCES = {
  'the-legend-of-zelda': {
    system: 'nes',
    match: ['legend of zelda'],
    exclude: ['adventure of link', 'four swords', 'link to the past', 'bs zelda'],
  },
  'zelda-2': { system: 'nes', match: ['adventure of link'] },
  'a-link-to-the-past': { system: 'snes', match: ['link to the past'], exclude: ['four swords'] },
  'links-awakening': { system: 'gb', match: ['link s awakening'], exclude: ['dx'] },
  'links-awakening-dx': { system: 'gbc', match: ['awakening dx'] },
  'oracle-of-seasons': { system: 'gbc', match: ['oracle of seasons'] },
  'oracle-of-ages': { system: 'gbc', match: ['oracle of ages'] },
  'four-swords': { system: 'gba', match: ['four swords'], exclude: ['adventures', 'anniversary'] },
  'the-wind-waker': { system: 'gc', match: ['wind waker'], exclude: ['hd'] },
  'four-swords-adventures': { system: 'gc', match: ['four swords adventures'] },
  'the-minish-cap': { system: 'gba', match: ['minish cap'] },
  'twilight-princess': {
    system: 'gc',
    match: ['twilight princess'],
    exclude: ['hd', 'action replay', 'preview', 'promo', '(unl)'],
  },
  'phantom-hourglass': { system: 'ds', match: ['phantom hourglass'], exclude: ['dpad', 'demo', 'kiosk'] },
  'spirit-tracks': { system: 'ds', match: ['spirit tracks'], exclude: ['dpad', 'demo', 'kiosk'] },
  'skyward-sword': { system: 'wii', match: ['skyward sword'], exclude: ['hd'] },
  'a-link-between-worlds': { system: '3ds', match: ['link between worlds'] },
  'tri-force-heroes': { system: '3ds', match: ['tri force heroes'] },
  'breath-of-the-wild': { system: 'wiiu', match: ['breath of the wild'] },
  'the-wind-waker-hd': { system: 'wiiu', match: ['wind waker hd'] },
  'twilight-princess-hd': { system: 'wiiu', match: ['twilight princess hd'] },
  // DSiWare and Satellaview pressings are not in Libretro's box-art sets, so
  // these three come from LaunchBox's games database instead.
  'four-swords-anniversary': {
    url: 'https://images.launchbox-app.com/r2_281d093e-880c-4dcd-87d9-46323638908c.png',
    ext: '.png',
  },
  'links-crossbow-training': { system: 'wii', match: ['crossbow training'] },
  'bs-zelda': {
    url: 'https://images.launchbox-app.com/9badeb1c-4ede-44a5-a894-c1f07b871d94.jpg',
    ext: '.jpg',
  },
  'bs-ancient-stone-tablets': { system: 'bs', match: ['inishie no sekiban', 'ancient stone tablets'] },
  'tingles-rosy-rupeeland': { system: 'ds', match: ['rosy rupeeland'] },
  'tingles-balloon-fight': { system: 'ds', match: ['balloon fight'] },
  'too-much-tingle-pack': {
    url: 'https://images.launchbox-app.com/c950c8ba-a321-4087-a277-c314b0e7f15a.png',
    ext: '.png',
  },
  'hyrule-warriors': { system: 'wiiu', match: ['hyrule warriors'], exclude: ['legends', 'age of calamity'] },
  'link-faces-of-evil': { system: 'cdi', match: ['faces of evil'] },
  'zelda-wand-of-gamelon': { system: 'cdi', match: ['wand of gamelon'] },
  'zeldas-adventure': { system: 'cdi', match: ['zelda s adventure'] },
  'ocarina-of-time': {
    system: 'n64',
    match: ['ocarina of time'],
    exclude: ['master quest', '3d', 'gamecube', 'redux'],
  },
  'ocarina-of-time-3d': { system: '3ds', match: ['ocarina of time 3d'] },
  'majoras-mask': { system: 'n64', match: ['majora s mask'], exclude: ['3d', 'gamecube', 'redux'] },
  'majoras-mask-3d': { system: '3ds', match: ['majora s mask 3d'] },

  // Switch box art is not in Libretro's thumbnail archive. These direct scans
  // are portrait box art and are cached with the same game-id filenames.
  'tears-of-the-kingdom': {
    url: 'https://static.wikia.nocookie.net/zelda_gamepedia_en/images/2/26/TotK_English_Box_Art.png/revision/latest/scale-to-width-down/700?cb=20230727095127',
    ext: '.webp',
  },
  'links-awakening-switch': {
    url: 'https://static.wikia.nocookie.net/zelda_gamepedia_en/images/3/3c/LANS_EU_Box_Art.png/revision/latest/scale-to-width-down/700?cb=20190614223132',
    ext: '.webp',
  },
  'echoes-of-wisdom': {
    url: 'https://nintendoeverything.com/wp-content/uploads/Zelda-Echoes-of-Wisdom-boxart.jpg',
    ext: '.jpg',
  },
  'skyward-sword-hd': {
    url: 'https://static.wikia.nocookie.net/zelda_gamepedia_en/images/e/ed/SSHD_CA_Box_Art.png/revision/latest/scale-to-width-down/700?cb=20210816162810',
    ext: '.webp',
  },
  'hyrule-warriors-age-of-calamity': {
    url: 'https://static.wikia.nocookie.net/zelda_gamepedia_en/images/6/68/HWAoC_EU_Box_Art.png/revision/latest/scale-to-width-down/700?cb=20201121194905',
    ext: '.webp',
  },
  'cadence-of-hyrule': {
    url: 'https://static.wikia.nocookie.net/zelda_gamepedia_en/images/5/5b/CoH_EU_Box_Art.png/revision/latest/scale-to-width-down/700?cb=20201008113509',
    ext: '.webp',
  },
  'ocarina-of-time-switch-2': {
    url: 'https://cdn.wikimg.net/en/zeldawiki/images/thumb/b/b5/OoTNS2_NA_Box_Art.png/700px-OoTNS2_NA_Box_Art.png',
    ext: '.png',
  },
}

export const COVER_COUNT = Object.keys(COVER_SOURCES).length
