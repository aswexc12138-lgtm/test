// 测试用的假宿主：代替 XuyuSetupUI.exe，按环境变量 XUYU_STUB 扮演各种情况，验证 NSIS 一侧的约定（规格 I-23、I-29）。
// 不随安装包发布。由 protocol-test.mjs 编译（Windows：自带 csc；Linux：mcs）。C# 5 语法。
//   XUYU_STUB       = install | cancel | classic | classic-all | crash | hang     （默认 install）
//   XUYU_STUB_DIR   = 安装位置（默认用 init.ini 里的 dir）
//   XUYU_STUB_AFTER = launch | finish（默认 finish）
// 日志：%TEMP%\xuyu-stub.log（UTF-8）：init.ini 的内容、观察到的每一次进度变化（带毫秒时间）。
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

internal static class StubHost
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern uint GetPrivateProfileString(string section, string key, string def, StringBuilder ret, uint size, string file);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern bool WritePrivateProfileString(string section, string key, string value, string file);

    private static StreamWriter log;
    private static readonly Stopwatch clock = Stopwatch.StartNew();

    private static void Log(string line)
    {
        log.WriteLine(clock.ElapsedMilliseconds.ToString().PadLeft(7) + "  " + line);
        log.Flush();
    }

    private static string Ini(string session, string file, string section, string key)
    {
        StringBuilder sb = new StringBuilder(2048);
        GetPrivateProfileString(section, key, "", sb, 2048, Path.Combine(session, file));
        return sb.ToString();
    }

    private static void WriteIniAtomic(string session, string name, string section, params string[] kv)
    {
        string tmp = Path.Combine(session, name + ".tmp"), fin = Path.Combine(session, name);
        File.WriteAllBytes(tmp, new byte[] { 0xFF, 0xFE });            // UTF-16LE BOM：WritePrivateProfileString 才按 Unicode 写
        for (int i = 0; i + 1 < kv.Length; i += 2) WritePrivateProfileString(section, kv[i], kv[i + 1], tmp);
        if (File.Exists(fin)) File.Delete(fin);
        File.Move(tmp, fin);
    }

    private static string Env(string name, string def)
    {
        string v = Environment.GetEnvironmentVariable(name);
        return string.IsNullOrEmpty(v) ? def : v;
    }

    [STAThread]
    private static int Main(string[] args)
    {
        string session = null;
        for (int i = 0; i + 1 < args.Length; i++) if (args[i] == "--session") session = args[i + 1];
        log = new StreamWriter(Path.Combine(Path.GetTempPath(), "xuyu-stub.log"), true, new UTF8Encoding(false));
        if (session == null) return 2;
        string mode = Env("XUYU_STUB", "install"), after = Env("XUYU_STUB_AFTER", "finish");
        Log("== stub start: mode=" + mode + " session=" + session);
        foreach (string k in new[] { "protocol", "nsisPid", "setupExe", "version", "mode", "installedVersion", "dir", "dirSource", "needKB", "allUsersAvailable", "canLaunch" })
            Log("init." + k + "=" + Ini(session, "init.ini", "init", k));

        if (mode == "hang") { Thread.Sleep(120000); return 0; }
        if (mode == "crash") { Log("crash without decision"); return 3; }

        File.WriteAllText(Path.Combine(session, "ready.flag"), "1");
        Thread.Sleep(400);

        if (mode == "cancel")
        {
            WriteIniAtomic(session, "decision.ini", "decision", "action", "cancel", "allUsers", "0", "reason", "user");
            Log("decision cancel");
            return 0;
        }
        if (mode == "classic" || mode == "classic-all")
        {
            WriteIniAtomic(session, "decision.ini", "decision", "action", "classic", "allUsers", mode == "classic-all" ? "1" : "0", "reason", "user");
            Log("decision " + mode);
            return 0;
        }

        string dir = Env("XUYU_STUB_DIR", Ini(session, "init.ini", "init", "dir"));
        Process nsis = null;
        try { nsis = Process.GetProcessById(int.Parse(Ini(session, "init.ini", "init", "nsisPid"))); IntPtr h = nsis.Handle; }
        catch (Exception ex) { Log("nsis process: " + ex.Message); }
        WriteIniAtomic(session, "decision.ini", "decision", "action", "install", "dir", dir, "allUsers", "0", "reason", "user");
        Log("decision install dir=" + dir);

        string last = "";
        while (true)
        {
            string phase = Ini(session, "status.ini", "status", "phase");
            string cur = "phase=" + phase + " extractDone=" + Ini(session, "status.ini", "status", "extractDone") + " extractTotal=" + Ini(session, "status.ini", "status", "extractTotal");
            if (cur != last) { Log(cur); last = cur; }
            if (phase == "done")
            {
                Thread.Sleep(300);
                WriteIniAtomic(session, "after.ini", "after", "action", after);
                Log("after " + after + "; exit");
                return 0;
            }
            if (nsis != null && nsis.HasExited)
            {
                Log("FAILED: nsis exited with code " + nsis.ExitCode + " before done");
                return 1;
            }
            Thread.Sleep(40);
        }
    }
}
