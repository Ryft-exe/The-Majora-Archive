import os from 'node:os'
import path from 'node:path'
import { fetchAllCovers, importTriforceLogo } from '../electron/covers.js'

const appData = process.env.APPDATA || path.join(os.homedir(), '.config')
const cacheDir = path.join(appData, 'Majora Archive', 'covers')
const force = process.argv.includes('--force')

importTriforceLogo(cacheDir)
console.log(`Cover cache: ${cacheDir}`)

const result = await fetchAllCovers({
  cacheDir,
  force,
  log: (line) => console.log(`  ${line}`),
})

console.log(
  `\nDownloaded ${result.downloaded}, already cached ${result.existing}, missing ${result.missing.length}, failed ${result.failed.length}.`,
)
if (result.missing.length) console.log('No match:', result.missing.join(', '))
if (result.failed.length) console.log('Failed:', result.failed.map((entry) => entry.gameId).join(', '))
