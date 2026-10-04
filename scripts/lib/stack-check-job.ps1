param([Parameter(Mandatory=$true)][string]$Payload)
$ErrorActionPreference = 'Stop'
$request = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload)) | ConvertFrom-Json
$result = @{ exitCode = 1; timedOut = $false; cleanupFailed = $false; errorCode = 'EJOB'; error = 'Job supervisor startup failed' }
try {
    # No shell command interpolation: CreateProcess receives argv quoted by the
    # Windows argv rules. Create-time JOB_LIST membership also closes the race
    # where a supervisor dies between CreateProcess and AssignProcessToJobObject.
    # Windows 10+ is required; there is no unsafe create-then-assign fallback. The job
    # handle is not inheritable, so closing/crashing this supervisor kills all
    # members, including detached grandchildren and children of an exited parent.
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
public static class MusicStackCheckJob {
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
        public long ProcessTime, JobTime; public uint Flags;
        public UIntPtr MinWorking, MaxWorking; public uint ActiveLimit;
        public UIntPtr Affinity; public uint Priority, Scheduling;
    }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong A, B, C, D, E, F; }
    [StructLayout(LayoutKind.Sequential)] struct Limits {
        public BasicLimits Basic; public IoCounters Io;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }
    [StructLayout(LayoutKind.Sequential)] struct Accounting {
        public long A, B, C, D; public uint PageFaults, Total, Active, Terminated;
    }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Startup {
        public uint Size; public string Reserved, Desktop, Title;
        public uint X, Y, XSize, YSize, XChars, YChars, Fill, Flags;
        public ushort Show, ReservedSize; public IntPtr ReservedBytes, Input, Output, Error;
    }
    [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {
        public IntPtr Process, Thread; public uint Pid, Tid;
    }
    [StructLayout(LayoutKind.Sequential)] struct StartupEx {
        public Startup Basic; public IntPtr Attributes;
    }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, ref Limits info, uint length);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int kind, out Accounting info, uint length, IntPtr returned);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, uint flags, ref IntPtr size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previous, IntPtr returned);
    [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app, StringBuilder command, IntPtr processAttributes, IntPtr threadAttributes, bool inherit, uint flags, IntPtr env, string cwd, ref StartupEx startup, out ProcessInfo process);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint code);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int kind);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    public class Result {
        public int exitCode = 1; public bool timedOut, cleanupFailed;
        public string errorCode, error;
    }
    static void Require(bool ok) { if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
    static string Quote(string value) {
        var text = new StringBuilder("\""); int slashes = 0;
        foreach (char c in value) {
            if (c == '\\') { slashes++; continue; }
            text.Append('\\', c == '"' ? slashes * 2 + 1 : slashes); slashes = 0; text.Append(c);
        }
        text.Append('\\', slashes * 2); return text.Append('"').ToString();
    }
    static uint Active(IntPtr job) {
        Accounting info; Require(QueryInformationJobObject(job, 1, out info, (uint)Marshal.SizeOf(typeof(Accounting)), IntPtr.Zero));
        return info.Active;
    }
    static bool StopJob(IntPtr job) {
        if (Active(job) != 0) Require(TerminateJobObject(job, 1));
        var cleanup = Stopwatch.StartNew();
        while (Active(job) != 0 && cleanup.ElapsedMilliseconds < 5000) Thread.Sleep(10);
        return Active(job) == 0;
    }
    public static Result Run(string executable, string[] args, string cwd, uint timeout, uint parentPid) {
        var result = new Result(); IntPtr job = IntPtr.Zero, parent = IntPtr.Zero, attributes = IntPtr.Zero, jobValue = IntPtr.Zero;
        bool attributesReady = false;
        var child = new ProcessInfo(); bool attached = false;
        try {
            parent = OpenProcess(0x100000, false, parentPid);
            Require(parent != IntPtr.Zero && WaitForSingleObject(parent, 0) == 258);
            job = CreateJobObject(IntPtr.Zero, null); Require(job != IntPtr.Zero);
            var limits = new Limits(); limits.Basic.Flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            Require(SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(typeof(Limits))));
            IntPtr size = IntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref size);
            Require(size != IntPtr.Zero);
            attributes = Marshal.AllocHGlobal(size);
            Require(InitializeProcThreadAttributeList(attributes, 1, 0, ref size)); attributesReady = true;
            jobValue = Marshal.AllocHGlobal(IntPtr.Size); Marshal.WriteIntPtr(jobValue, job);
            // PROC_THREAD_ATTRIBUTE_JOB_LIST: atomically attach during creation.
            Require(UpdateProcThreadAttribute(attributes, 0, new IntPtr(0x2000D), jobValue, new IntPtr(IntPtr.Size), IntPtr.Zero, IntPtr.Zero));
            var startup = new StartupEx(); startup.Basic.Size = (uint)Marshal.SizeOf(typeof(StartupEx)); startup.Basic.Flags = 0x100;
            startup.Basic.Input = GetStdHandle(-10); startup.Basic.Output = GetStdHandle(-11); startup.Basic.Error = GetStdHandle(-12);
            startup.Attributes = attributes;
            var command = new StringBuilder(Quote(executable));
            foreach (string arg in args) command.Append(" ").Append(Quote(arg));
            if (!CreateProcess(executable, command, IntPtr.Zero, IntPtr.Zero, true, 0x08080004, IntPtr.Zero, cwd, ref startup, out child)) {
                int code = Marshal.GetLastWin32Error();
                result.errorCode = code == 2 || code == 3 ? "ENOENT" : "ESPAWN";
                result.error = new Win32Exception(code).Message; return result;
            }
            attached = true;
            Require(ResumeThread(child.Thread) != 0xFFFFFFFF);
            var running = Stopwatch.StartNew(); uint waited;
            do {
                uint remaining = (uint)Math.Max(0, (long)timeout - running.ElapsedMilliseconds);
                waited = WaitForSingleObject(child.Process, Math.Min(100U, remaining));
                if (WaitForSingleObject(parent, 0) == 0) {
                    result.errorCode = "EJOB"; result.error = "stack runner exited; stopping its check job";
                    waited = 258; break;
                }
            } while (waited == 258 && running.ElapsedMilliseconds < timeout);
            if (waited == 258) { result.timedOut = true; result.exitCode = 1; }
            else {
                Require(waited == 0); uint code; Require(GetExitCodeProcess(child.Process, out code)); result.exitCode = unchecked((int)code);
            }
            // A successful parent can still leave workers or inherited pipes.
            result.cleanupFailed = !StopJob(job);
        } catch (Exception error) {
            result.errorCode = "EJOB"; result.error = error.Message;
            if (attached) {
                try { result.cleanupFailed = !StopJob(job); }
                catch { result.cleanupFailed = true; }
            }
        }
        finally {
            if (!attached && child.Process != IntPtr.Zero) {
                if (!TerminateProcess(child.Process, 1) || WaitForSingleObject(child.Process, 5000) != 0) result.cleanupFailed = true;
            }
            if (job != IntPtr.Zero) CloseHandle(job);
            if (child.Thread != IntPtr.Zero) CloseHandle(child.Thread);
            if (child.Process != IntPtr.Zero) CloseHandle(child.Process);
            if (parent != IntPtr.Zero) CloseHandle(parent);
            if (attributesReady) DeleteProcThreadAttributeList(attributes);
            if (attributes != IntPtr.Zero) Marshal.FreeHGlobal(attributes);
            if (jobValue != IntPtr.Zero) Marshal.FreeHGlobal(jobValue);
        }
        return result;
    }
}
'@
    $result = [MusicStackCheckJob]::Run([string]$request.cmd, [string[]]$request.args, [string]$request.cwd, [uint32]$request.timeoutMs, [uint32]$request.parentPid)
} catch {
    $result.error = $_.Exception.Message
} finally {
    $result | ConvertTo-Json -Compress | Set-Content -LiteralPath $request.resultPath -Encoding UTF8
}
exit 0
