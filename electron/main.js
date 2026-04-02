const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Ensure cwd is app root (important for packaged app)
const appPath = path.join(__dirname, '..');
process.chdir(appPath);

const { dbPath, port } = require('../server/config');
const { startServer } = require('../server/start');

let server = null;

async function createWindow() {
  // Run DB init if DB file does not exist
  if (!fs.existsSync(dbPath)) {
    require('../server/db/init');
  }

  // Start Express server
  const result = await startServer({ port });
  server = result.server;

  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadURL(`http://127.0.0.1:${result.port}/`);
}

// Handle print request from renderer
ipcMain.on('print-page', (event) => {
  console.log('[main] IPC print-page received');
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    console.error('[main] Could not find BrowserWindow for sender');
    return;
  }
  console.log('[main] Calling webContents.print()');
  win.webContents.print({ silent: false, printBackground: true, landscape: false, pageSize: 'A4', deviceName: '' }, (success, errorType) => {
    if (success) {
      console.log('[main] print() succeeded');
    } else {
      console.error('[main] print() failed, errorType =', errorType);
    }
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});
