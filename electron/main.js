const { app, BrowserWindow } = require('electron');
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
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadURL(`http://127.0.0.1:${result.port}/`);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});
