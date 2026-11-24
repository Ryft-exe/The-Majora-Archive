const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('majora', {
  getState: () => ipcRenderer.invoke('app:state'),
  launch: (gameId, variantId) => ipcRenderer.invoke('app:launch', { gameId, variantId }),
  launchApp: (key) => ipcRenderer.invoke('app:launchApp', { key }),
  openTriforce: () => ipcRenderer.invoke('app:openTriforce'),
  pickApp: (key) => ipcRenderer.invoke('app:pickApp', { key }),
  pickRom: (gameId) => ipcRenderer.invoke('app:pickRom', { gameId }),
  addRomFolder: () => ipcRenderer.invoke('app:addRomFolder'),
  removeRomFolder: (folder) => ipcRenderer.invoke('app:removeRomFolder', { folder }),
  rescan: () => ipcRenderer.invoke('app:state'),
  openPath: (target) => ipcRenderer.invoke('app:openPath', { target }),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', { url }),
  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
  window: (action) => ipcRenderer.invoke('app:window', { action }),

  refreshCovers: () => ipcRenderer.invoke('covers:refresh'),
  openCoverFolder: () => ipcRenderer.invoke('covers:openFolder'),

  updateMusic: (patch) => ipcRenderer.invoke('music:update', patch),
  addMusic: () => ipcRenderer.invoke('music:add'),
  removeMusic: (file) => ipcRenderer.invoke('music:remove', { file }),
  openMusicFolder: () => ipcRenderer.invoke('music:openFolder'),
  rescanMusic: () => ipcRenderer.invoke('music:rescan'),

  readAppConfig: (key) => ipcRenderer.invoke('config:read', { key }),
  writeConfigValue: (key, patch) => ipcRenderer.invoke('config:write', { key, ...patch }),
  writeConfigText: (key, patch) => ipcRenderer.invoke('config:writeText', { key, ...patch }),
  restoreConfigBackup: (key, fileId) => ipcRenderer.invoke('config:restore', { key, fileId }),
  openConfigFile: (key, fileId) => ipcRenderer.invoke('config:openFile', { key, fileId }),

  installComponent: (key, build) => ipcRenderer.invoke('components:install', { key, build }),
  removeComponent: (key) => ipcRenderer.invoke('components:remove', { key }),
  checkComponents: () => ipcRenderer.invoke('components:check'),
  openToolsFolder: () => ipcRenderer.invoke('components:openFolder'),

  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: (key) => ipcRenderer.invoke('updates:download', { key }),
  setUpdateAuto: (auto) => ipcRenderer.invoke('updates:setAuto', { auto }),
  openUpdateFolder: () => ipcRenderer.invoke('updates:openFolder'),

  onCoversUpdated: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('covers:updated', listener)
    return () => ipcRenderer.removeListener('covers:updated', listener)
  },
  onUpdatesUpdated: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('updates:updated', listener)
    return () => ipcRenderer.removeListener('updates:updated', listener)
  },
  onComponentProgress: (callback) => {
    const listener = (_event, progress) => callback(progress)
    ipcRenderer.on('components:progress', listener)
    return () => ipcRenderer.removeListener('components:progress', listener)
  },
})
