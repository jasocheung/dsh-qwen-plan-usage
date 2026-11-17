# dsh-qwen-plan-usage — read a browser cookie DB that the running browser holds open.
#
# Chromium opens its Cookies SQLite file with an exclusive lock (FILE_SHARE_NONE),
# so a plain copy fails while the browser is running. This reads the file through a
# duplicated handle owned by the browser process, using offset reads (OVERLAPPED)
# that never move the shared file pointer — non-invasive, no admin required, same
# user only. Used by extract-cookie.mjs on Windows when a direct copy is refused.
#
# Usage: pwsh -File dump-locked.ps1 -Target <cookies-db> -Out <dest> -ProcName <msedge|chrome>
param(
  [Parameter(Mandatory = $true)][string]$Target,
  [Parameter(Mandatory = $true)][string]$Out,
  [Parameter(Mandatory = $true)][string]$ProcName
)
$ErrorActionPreference = 'Stop'
$src = @"
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
public static class LockedFileDump {
  [StructLayout(LayoutKind.Sequential)]
  struct ENTRY { public IntPtr Object; public IntPtr Pid; public IntPtr Handle; public uint Access; public ushort Bt; public ushort Type; public uint Attr; public uint Reserved; }
  [StructLayout(LayoutKind.Sequential)]
  struct OV { public IntPtr Internal; public IntPtr InternalHigh; public long Offset; public IntPtr hEvent; }
  [DllImport("ntdll.dll")] static extern int NtQuerySystemInformation(int cls, IntPtr info, int len, out int ret);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint a, bool i, int pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool DuplicateHandle(IntPtr sp, IntPtr sh, IntPtr tp, out IntPtr th, uint a, bool i, uint opt);
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)] static extern uint GetFinalPathNameByHandleW(IntPtr h, StringBuilder b, uint c, uint f);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadFile(IntPtr h, byte[] b, uint n, out uint got, ref OV ov);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetFileSizeEx(IntPtr h, out long sz);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint GetFileType(IntPtr h);
  public static string Dump(string target, string outPath, string procName) {
    var pids = new HashSet<int>();
    foreach (var p in Process.GetProcessesByName(procName)) pids.Add(p.Id);
    string want = Path.GetFullPath(target);
    int len = 1024*1024; IntPtr buf; int status; int needed;
    while (true) {
      buf = Marshal.AllocHGlobal(len);
      status = NtQuerySystemInformation(64, buf, len, out needed);
      if (status == 0) break;
      Marshal.FreeHGlobal(buf);
      if (status == unchecked((int)0xC0000004) || status == unchecked((int)0xC0000023)) { len = needed > len ? needed : len*2; continue; }
      return "NtQuery failed 0x" + status.ToString("X");
    }
    long count = Marshal.ReadIntPtr(buf).ToInt64();
    int esz = Marshal.SizeOf<ENTRY>();
    IntPtr cur = buf + 2*IntPtr.Size;
    var procs = new Dictionary<int,IntPtr>();
    int tried = 0;
    for (long i = 0; i < count; i++) {
      var e = Marshal.PtrToStructure<ENTRY>(cur); cur += esz;
      int pid = e.Pid.ToInt32();
      if (!pids.Contains(pid)) continue;
      IntPtr proc;
      if (!procs.TryGetValue(pid, out proc)) { proc = OpenProcess(0x0040, false, pid); procs[pid] = proc; }
      if (proc == IntPtr.Zero) continue;
      IntPtr dup;
      if (!DuplicateHandle(proc, e.Handle, (IntPtr)(-1), out dup, 0, false, 2)) continue;
      tried++;
      // Only disk handles: GetFinalPathNameByHandleW can block on named-pipe handles.
      if (GetFileType(dup) != 1) { CloseHandle(dup); continue; }
      var sb = new StringBuilder(1024);
      uint n = GetFinalPathNameByHandleW(dup, sb, 1024, 0);
      bool hit = false;
      if (n > 0 && n < 1024) {
        string path = sb.ToString();
        string norm = path.StartsWith(@"\\?\") ? path.Substring(4) : path;
        hit = string.Equals(norm, want, StringComparison.OrdinalIgnoreCase);
      }
      if (hit) {
        long size;
        if (GetFileSizeEx(dup, out size)) {
          using (var fs = new FileStream(outPath, FileMode.Create, FileAccess.Write)) {
            byte[] chunk = new byte[65536]; long off = 0; var ov = new OV();
            while (off < size) {
              ov.Offset = off;
              uint toRead = (uint)Math.Min(chunk.Length, size - off);
              uint got;
              if (!ReadFile(dup, chunk, toRead, out got, ref ov) || got == 0) break;
              fs.Write(chunk, 0, (int)got); off += got;
            }
          }
          CloseHandle(dup); Marshal.FreeHGlobal(buf);
          foreach (var kv in procs) if (kv.Value != IntPtr.Zero) CloseHandle(kv.Value);
          return "OK tried=" + tried + " size=" + new FileInfo(outPath).Length;
        }
      }
      CloseHandle(dup);
    }
    Marshal.FreeHGlobal(buf);
    foreach (var kv in procs) if (kv.Value != IntPtr.Zero) CloseHandle(kv.Value);
    return "NO MATCH tried=" + tried;
  }
}
"@
Add-Type -TypeDefinition $src -Language CSharp
[LockedFileDump]::Dump($Target, $Out, $ProcName)