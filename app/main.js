// KitsuAI, application Windows.
// - Demarre le serveur local (moteur/serveur.mjs) avec le Node integre a Electron.
// - Affiche le panneau dans une fenetre, garde une icone pres de l'horloge (le conseil en combat continue fenetre fermee).
// - Donnees (moteur du jeu, sauvegarde, cache, resultats) : %APPDATA%\KitsuAI, jamais effacees par une mise a jour.
// - Mises a jour automatiques depuis les releases GitHub (electron-updater).
const { app, BrowserWindow, Tray, Menu, shell, dialog, nativeImage, Notification } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { autoUpdater } = require('electron-updater');

const PORT = 47123;
const ROOT = app.isPackaged ? path.join(process.resourcesPath, 'moteur') : path.join(__dirname, '..', 'moteur');
const DATA = app.getPath('userData');
const ICON = path.join(__dirname, 'build', 'icon.png');
let win = null, tray = null, srv = null, quitting = false, srvLog = [];

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => show());

const node = (script, args = []) => spawn(process.execPath, [path.join(ROOT, script), ...args], {
  cwd: ROOT, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', KITSU_DATA: DATA, KITSU_APP_VERSION: app.getVersion() }, windowsHide: true,
});
const ping = () => new Promise(res => { const r = http.get({ host: '127.0.0.1', port: PORT, path: '/ping', timeout: 800 }, x => { let b = ''; x.on('data', d => b += d); x.on('end', () => { try { res(JSON.parse(b)); } catch { res(null); } }); }); r.on('error', () => res(null)); r.on('timeout', () => { r.destroy(); res(null); }); });
const loading = html => win && win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0b10;color:#f4ede3;font-family:Segoe UI,system-ui,sans-serif"><div style="text-align:center"><div style="font:italic 900 46px Impact,'Arial Narrow Bold',sans-serif;letter-spacing:1px"><span style="color:#ff4b3e">/</span> KITSU<span style="color:#ff4b3e">AI</span></div><div style="margin-top:14px;color:#9aa0ad">${html}</div></div></body></html>`));

async function startServer() {
  if (await ping()) return true; // deja lance (ancienne fenetre ou KitsuAI.bat)
  fs.mkdirSync(DATA, { recursive: true });
  const hasEngine = fs.existsSync(path.join(DATA, 'engine', 'current.txt'));
  loading(hasEngine ? 'Verification du moteur du jeu...' : 'Premier lancement : telechargement du moteur du jeu (environ 20 Mo)...');
  await new Promise(res => { const p = node('telecharger.mjs'); p.stdout.on('data', d => srvLog.push(String(d))); p.stderr.on('data', d => srvLog.push(String(d))); p.on('close', res); });
  if (!fs.existsSync(path.join(DATA, 'engine', 'current.txt'))) { loading('Impossible de telecharger le moteur du jeu. Verifie ta connexion puis relance KitsuAI.'); return false; }
  loading('Demarrage du serveur local...');
  srv = node('serveur.mjs');
  srv.stdout.on('data', d => { srvLog.push(String(d)); if (srvLog.length > 200) srvLog.shift(); });
  srv.stderr.on('data', d => { srvLog.push(String(d)); if (srvLog.length > 200) srvLog.shift(); });
  srv.on('close', code => { srv = null; if (!quitting) { loading(`Le serveur s'est arrete (code ${code}).<br><br><pre style="text-align:left;max-width:80vw;white-space:pre-wrap;font-size:11px;color:#9aa0ad">${srvLog.slice(-15).join('').replace(/</g, '&lt;')}</pre>`); } });
  for (let i = 0; i < 80; i++) { if (await ping()) return true; await new Promise(r => setTimeout(r, 250)); }
  loading('Le serveur ne repond pas. Le port 47123 est peut-etre utilise par un autre programme.');
  return false;
}

function show() { if (!win) createWindow(); win.show(); win.focus(); }
function createWindow() {
  win = new BrowserWindow({ width: 1360, height: 900, minWidth: 900, minHeight: 600, backgroundColor: '#0a0b10', title: 'KitsuAI', icon: ICON, autoHideMenuBar: true, webPreferences: { contextIsolation: true, sandbox: true } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); if (Notification.isSupported() && !app.__trayHint) { app.__trayHint = 1; new Notification({ title: 'KitsuAI continue en arriere-plan', body: "Le conseil en combat reste actif. Clic droit sur l'icone pres de l'horloge pour quitter.", icon: ICON }).show(); } } });
}
function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('KitsuAI : serveur local actif');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir le panneau', click: show },
    { label: 'Ouvrir kitsu.games', click: () => shell.openExternal('https://kitsu.games/') },
    { type: 'separator' },
    { label: 'Installer le script Tampermonkey', click: () => shell.openExternal('https://github.com/Drien95/kitsu-ai/releases/latest/download/kitsu_ai.user.js') },
    { label: 'Dossier des donnees', click: () => shell.openPath(DATA) },
    { label: 'Wiki et aide', click: () => shell.openExternal('https://github.com/Drien95/kitsu-ai/wiki') },
    { label: 'Rechercher une mise a jour', click: () => checkUpdates(true) },
    { label: `Version ${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: 'Quitter KitsuAI', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('double-click', show);
}

// ---------- mises a jour ----------
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
let manualCheck = false;
autoUpdater.on('update-available', i => { if (manualCheck || win?.isVisible()) new Notification({ title: 'Mise a jour KitsuAI', body: `Version ${i.version} en cours de telechargement.`, icon: ICON }).show(); });
autoUpdater.on('update-not-available', () => { if (manualCheck) dialog.showMessageBox({ type: 'info', title: 'KitsuAI', message: `Tu as deja la derniere version (${app.getVersion()}).` }); manualCheck = false; });
autoUpdater.on('error', e => {
  const m = String(e?.message || e), enCours = /latest\.yml/.test(m) && /404/.test(m), v = (m.match(/download\/v([\d.]+)\//) || [])[1];
  if (manualCheck) dialog.showMessageBox(enCours
    ? { type: 'info', title: 'KitsuAI', message: `La version ${v || 'suivante'} est en cours de preparation sur GitHub.`, detail: "L'installateur n'est pas encore disponible. Reessaie dans quelques minutes (KitsuAI reverifie aussi tout seul toutes les 6 h)." }
    : { type: 'warning', title: 'KitsuAI', message: 'Recherche de mise a jour impossible.', detail: m.split('\n')[0].slice(0, 400) });
  manualCheck = false;
});
autoUpdater.on('update-downloaded', async i => {
  manualCheck = false;
  const r = await dialog.showMessageBox({ type: 'info', buttons: ['Redemarrer maintenant', 'Plus tard'], defaultId: 0, title: 'Mise a jour prete', message: `KitsuAI ${i.version} est pret.`, detail: "Redemarrer pour l'installer ? (sinon elle s'installera a la fermeture)" });
  if (r.response === 0) { quitting = true; autoUpdater.quitAndInstall(); }
});
function checkUpdates(manual = false) { if (!app.isPackaged) return; manualCheck = manual; autoUpdater.checkForUpdates().catch(() => {}); }

app.whenReady().then(async () => {
  app.setAppUserModelId('io.github.drien95.kitsuai');
  createWindow(); createTray();
  if (await startServer()) win.loadURL(`http://127.0.0.1:${PORT}/`);
  checkUpdates(); setInterval(checkUpdates, 6 * 3600 * 1000);
});
app.on('window-all-closed', e => e.preventDefault());
app.on('before-quit', () => { quitting = true; if (srv) srv.kill(); });
