// Empeche la mise en veille de Windows PENDANT un long calcul seulement (aucun reglage d'alimentation modifie) :
// un petit PowerShell appelle SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED) et attend.
// La demande disparait d'elle-meme quand ce processus s'arrete (fin du calcul, Ctrl+C ou plantage).
import { spawn } from 'node:child_process';

const PS = `Add-Type -Name K -Namespace W -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);';
[W.K]::SetThreadExecutionState([uint32]2147483649) | Out-Null; while ($true) { Start-Sleep -Seconds 3600 }`;

export function garderEveille() {
  if (process.platform !== 'win32') return { fin: () => {} };
  let p = null;
  try { p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS], { stdio: 'ignore', windowsHide: true }); } catch { return { fin: () => {}, ok: false }; }
  const fin = () => { try { p.kill(); } catch {} };
  process.once('exit', fin);
  return { fin, ok: true };
}
