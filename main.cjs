const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true, 
      contextIsolation: false
      // Preload removed as it was not present
    }
  });

  // Software ke andar Inspect Element kholne ke liye niche wali line ko uncomment karein agar masla aaye
  // win.webContents.openDevTools();

  if (app.isPackaged) {
    // Production: dist folder se file uthayega
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    win.loadFile(indexPath).catch((e) => console.error("Error loading index.html:", e));
  } else {
    // Development: Vite server
    win.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
}); 