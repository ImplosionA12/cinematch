# Opens a real console running mongosh, types each query, and captures the window page by page.
# Usage: powershell -ExecutionPolicy Bypass -File report\capture_shots.ps1 [-Only 1,2,3]
param([int[]]$Only)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public class W {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int hgt, bool repaint);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT rect, int size);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct SCROLLINFO { public uint cbSize, fMask; public int nMin, nMax; public uint nPage; public int nPos, nTrackPos; }
  [DllImport("user32.dll")] public static extern bool GetScrollInfo(IntPtr h, int bar, ref SCROLLINFO si);
  public static int ScrollPos(IntPtr h) { SCROLLINFO si = new SCROLLINFO(); si.cbSize = 28; si.fMask = 4; GetScrollInfo(h, 1, ref si); return si.nPos; }
}
"@
[W]::SetProcessDPIAware() | Out-Null

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$cmds = Get-Content (Join-Path $here 'shell_cmds.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$out = Join-Path $here 'shots'
New-Item -ItemType Directory -Force $out | Out-Null
if (-not $Only) { Get-ChildItem $out -Filter 'q*.png' | Remove-Item -Force }

# per-title console profile (HKCU\Console\<title>): readable font, 100x42 window, 3000-line buffer
$key = 'HKCU:\Console\mongosh-shots'
New-Item -Path $key -Force | Out-Null
Set-ItemProperty $key FaceName 'Consolas'
Set-ItemProperty $key FontFamily 0x36 -Type DWord
Set-ItemProperty $key FontSize 0x00100000 -Type DWord
Set-ItemProperty $key FontWeight 400 -Type DWord
Set-ItemProperty $key QuickEdit 0 -Type DWord
Set-ItemProperty $key WindowSize ((42 -shl 16) -bor 100) -Type DWord
Set-ItemProperty $key ScreenBufferSize ((3000 -shl 16) -bor 100) -Type DWord
Start-Process cmd.exe -ArgumentList '/c start "mongosh-shots" conhost.exe cmd.exe /k "mongosh cinematch"' -WindowStyle Hidden

$deadline = (Get-Date).AddSeconds(20)
$h = 0
do {
  Start-Sleep -Milliseconds 400
  $win = Get-Process | Where-Object { $_.MainWindowTitle -like 'mongosh*cinematch*' } | Select-Object -First 1
  if ($win) { $h = $win.MainWindowHandle; $p = $win }
} while ($h -eq 0 -and (Get-Date) -lt $deadline)
if ($h -eq 0) { throw "console window not found" }
[W]::MoveWindow($h, 0, 0, 1400, 1000, $true) | Out-Null
Start-Sleep -Seconds 4
[W]::SetForegroundWindow($h) | Out-Null

function Esc($t) {
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $t.ToCharArray()) {
    if ('+^%~(){}[]'.Contains($ch)) { [void]$sb.Append('{' + $ch + '}') } else { [void]$sb.Append($ch) }
  }
  $sb.ToString()
}

function Send-Text($text) {
  [W]::SetForegroundWindow($h) | Out-Null
  Start-Sleep -Milliseconds 150
  foreach ($line in ($text -replace "`r", "") -split "`n") {
    if ($line.Length -gt 0) { [System.Windows.Forms.SendKeys]::SendWait((Esc $line)) }
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 60
    if ($line.TrimEnd().EndsWith(";")) { Start-Sleep -Seconds 15 }   # statement executed: let mongosh finish first
  }
}

function Grab() {
  $r = New-Object W+RECT
  [W]::DwmGetWindowAttribute($h, 9, [ref]$r, 16) | Out-Null
  $wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  if ($r.B -gt $wa.Bottom) { $r.B = $wa.Bottom }
  if ($r.R -gt $wa.Right) { $r.R = $wa.Right }
  $bmp = New-Object System.Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
  $g.Dispose()
  return $bmp
}

function Hash($bmp) {
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $sha = [System.Security.Cryptography.SHA1]::Create()
  [BitConverter]::ToString($sha.ComputeHash($ms.ToArray()))
}

$WM_VSCROLL = 0x115; $SB_TOP = 6; $SB_PAGEDOWN = 3; $SB_BOTTOM = 7
$slow = @(9, 30, 32, 33, 53)

foreach ($c in $cmds) {
  if ($Only -and ($Only -notcontains $c.id)) { continue }
  Send-Text "cls"
  Start-Sleep -Milliseconds 800
  $base = [W]::ScrollPos($h)
  Send-Text $c.shell
  $wait = 3
  if ($slow -contains $c.id) { $wait = 12 }
  Start-Sleep -Seconds $wait

  # the console auto-scrolls so the prompt is at the bottom: that scroll position tells how many
  # lines of content exist. Capture from the top in 40-line steps, the last page ending at the prompt.
  $end = [W]::ScrollPos($h)
  $step = 40
  $positions = @()
  for ($pos = $base; $pos -lt $end; $pos += $step) { $positions += $pos }
  $positions += $end
  $page = 1
  foreach ($pos in $positions) {
    $wp = [IntPtr](($pos -shl 16) -bor 4)   # SB_THUMBPOSITION
    [W]::SendMessage($h, $WM_VSCROLL, $wp, [IntPtr]::Zero) | Out-Null
    Start-Sleep -Milliseconds 400
    $bmp = Grab
    $bmp.Save((Join-Path $out ("q{0:d2}_{1}.png" -f $c.id, $page)), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $page++
  }
  Write-Host ("captured q{0:d2}  {1} page(s)  {2}" -f $c.id, ($page - 1), $c.title)
}
Send-Text "exit"
Start-Sleep -Seconds 1
Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue

