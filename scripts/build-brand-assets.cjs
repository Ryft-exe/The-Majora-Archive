const { app, BrowserWindow } = require('electron')
const path = require('node:path')

app.disableHardwareAcceleration()

const root = path.resolve(__dirname, '..')
const sources = {
  mask: path.join(root, 'assets', 'brand', 'mask-source.webp'),
  skull: path.join(root, 'assets', 'brand', 'skullkid-source.webp'),
}
const outputs = {
  rail: path.join(root, 'src', 'assets', 'brand', 'skullkid.png'),
  mark: path.join(root, 'src', 'assets', 'brand', 'majora-mask.png'),
  favicon: path.join(root, 'public', 'majora-mask.png'),
  ico: path.join(root, 'public', 'majora-mask.ico'),
  buildIco: path.join(root, 'build', 'icon.ico'),
}

app
  .whenReady()
  .then(async () => {
    const win = new BrowserWindow({
      show: false,
      width: 900,
      height: 700,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
      },
    })
    await win.loadURL('data:text/html,<!doctype html><html><body></body></html>')

    const result = await win.webContents.executeJavaScript(
      `(async () => {
        const fs = require('node:fs')
        const path = require('node:path')
        const sources = ${JSON.stringify(sources)}
        const outputs = ${JSON.stringify(outputs)}

        function load(file) {
          return new Promise((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve(image)
            image.onerror = () => reject(new Error('Could not load ' + file))
            image.src = 'data:image/webp;base64,' + fs.readFileSync(file).toString('base64')
          })
        }

        function canvas(width, height) {
          const node = document.createElement('canvas')
          node.width = width
          node.height = height
          return node
        }

        function trim(image) {
          const node = canvas(image.naturalWidth, image.naturalHeight)
          const context = node.getContext('2d', { willReadFrequently: true })
          context.drawImage(image, 0, 0)
          const pixels = context.getImageData(0, 0, node.width, node.height)
          const data = pixels.data
          const at = (x, y) => {
            const index = (y * node.width + x) * 4
            return [data[index], data[index + 1], data[index + 2], data[index + 3]]
          }
          const corners = [at(0, 0), at(node.width - 1, 0), at(0, node.height - 1), at(node.width - 1, node.height - 1)]
          const opaqueWhite = corners.every(([r, g, b, a]) => a > 245 && r > 240 && g > 240 && b > 240)

          if (opaqueWhite) {
            const seen = new Uint8Array(node.width * node.height)
            const stack = []
            const white = (x, y) => {
              const index = (y * node.width + x) * 4
              return data[index + 3] > 0 && data[index] > 235 && data[index + 1] > 235 && data[index + 2] > 235
            }
            const push = (x, y) => {
              const index = y * node.width + x
              if (seen[index] || !white(x, y)) return
              seen[index] = 1
              stack.push(index)
            }
            for (let x = 0; x < node.width; x += 1) {
              push(x, 0)
              push(x, node.height - 1)
            }
            for (let y = 0; y < node.height; y += 1) {
              push(0, y)
              push(node.width - 1, y)
            }
            while (stack.length) {
              const index = stack.pop()
              const x = index % node.width
              const y = Math.floor(index / node.width)
              data[index * 4 + 3] = 0
              if (x > 0) push(x - 1, y)
              if (x + 1 < node.width) push(x + 1, y)
              if (y > 0) push(x, y - 1)
              if (y + 1 < node.height) push(x, y + 1)
            }
            context.putImageData(pixels, 0, 0)
          }

          let minX = node.width
          let minY = node.height
          let maxX = -1
          let maxY = -1
          for (let y = 0; y < node.height; y += 1) {
            for (let x = 0; x < node.width; x += 1) {
              if (data[(y * node.width + x) * 4 + 3] <= 8) continue
              if (x < minX) minX = x
              if (x > maxX) maxX = x
              if (y < minY) minY = y
              if (y > maxY) maxY = y
            }
          }
          if (maxX < minX || maxY < minY) throw new Error('Image had no visible pixels')
          return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
            removedWhite: opaqueWhite,
          }
        }

        function render(image, bounds, width, height, padding = 0.04) {
          const node = canvas(width, height)
          const context = node.getContext('2d')
          context.imageSmoothingEnabled = true
          context.imageSmoothingQuality = 'high'
          const scale = Math.min((width * (1 - padding * 2)) / bounds.width, (height * (1 - padding * 2)) / bounds.height)
          const drawWidth = bounds.width * scale
          const drawHeight = bounds.height * scale
          const drawX = (width - drawWidth) / 2
          const drawY = (height - drawHeight) / 2
          context.drawImage(
            image,
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            drawX,
            drawY,
            drawWidth,
            drawHeight,
          )
          return node.toDataURL('image/png')
        }

        function writePng(file, dataUrl) {
          fs.mkdirSync(path.dirname(file), { recursive: true })
          fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'))
        }

        function ico(entries) {
          const header = Buffer.alloc(6)
          header.writeUInt16LE(0, 0)
          header.writeUInt16LE(1, 2)
          header.writeUInt16LE(entries.length, 4)
          const directories = []
          const images = []
          let offset = 6 + entries.length * 16
          for (const entry of entries) {
            const directory = Buffer.alloc(16)
            directory[0] = entry.size >= 256 ? 0 : entry.size
            directory[1] = entry.size >= 256 ? 0 : entry.size
            directory[2] = 0
            directory[3] = 0
            directory.writeUInt16LE(1, 4)
            directory.writeUInt16LE(32, 6)
            directory.writeUInt32LE(entry.buffer.length, 8)
            directory.writeUInt32LE(offset, 12)
            directories.push(directory)
            images.push(entry.buffer)
            offset += entry.buffer.length
          }
          return Buffer.concat([header, ...directories, ...images])
        }

        const mask = await load(sources.mask)
        const skull = await load(sources.skull)
        const maskBounds = trim(mask)
        const skullBounds = trim(skull)

        const mask512 = render(mask, maskBounds, 512, 512, 0.05)
        writePng(outputs.mark, mask512)
        writePng(outputs.favicon, mask512)

        const railHeight = 512
        const railWidth = Math.max(1, Math.round((skullBounds.width / skullBounds.height) * railHeight))
        writePng(outputs.rail, render(skull, skullBounds, railWidth, railHeight, 0.01))

        const iconSizes = [16, 24, 32, 48, 64, 128, 256]
        const iconEntries = iconSizes.map((size) => ({
          size,
          buffer: Buffer.from(render(mask, maskBounds, size, size, 0.035).split(',')[1], 'base64'),
        }))
        const icon = ico(iconEntries)
        fs.mkdirSync(path.dirname(outputs.ico), { recursive: true })
        fs.writeFileSync(outputs.ico, icon)
        fs.mkdirSync(path.dirname(outputs.buildIco), { recursive: true })
        fs.writeFileSync(outputs.buildIco, icon)

        return {
          mask: { source: { width: mask.naturalWidth, height: mask.naturalHeight }, bounds: maskBounds, iconBytes: icon.length },
          skull: { source: { width: skull.naturalWidth, height: skull.naturalHeight }, bounds: skullBounds, rail: { width: railWidth, height: railHeight } },
        }
      })()`,
      true,
    )
    console.log(JSON.stringify(result, null, 2))
    win.destroy()
    app.quit()
  })
  .catch((error) => {
    console.error(error)
    app.quit()
    process.exitCode = 1
  })
