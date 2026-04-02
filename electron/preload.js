const { contextBridge, ipcRenderer } = require('electron');

console.log('[preload] preload.js loaded');

contextBridge.exposeInMainWorld('electronAPI', {
  printPage: () => {
    console.log('[preload] printPage() called → sending IPC print-page');
    ipcRenderer.send('print-page');
  },
});

console.log('[preload] electronAPI exposed on window');
