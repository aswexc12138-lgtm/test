// 胥宇安装器的界面宿主（规格 §12B · I-20 – I-29）
//
// 角色：只负责“问”和“看”。NSIS 安装包仍然是唯一的安装引擎（文件、注册表、快捷方式、卸载旧版本全由它做）；
// 本程序是一个无边框窗口 + WebView2，显示 ../ui/ 里的水墨界面，把用户的选择交给 NSIS，再把 NSIS 写出的真实进度转给界面。
//
// 与 NSIS 的约定（会话目录里的 UTF-16 INI 文件，字段见规格 I-23）：
//   init.ini      NSIS → 宿主   启动参数
//   ready.flag    宿主 → NSIS   界面已经出来了（NSIS 等它最多 20 秒，等不到就改用经典界面）
//   decision.ini  宿主 → NSIS   install / cancel / classic（先写 .tmp 再改名，NSIS 读到的永远是完整文件）
//   status.ini    NSIS → 宿主   phase = prepare / extract / copy / finish / done，extractDone / extractTotal（字节）
//   after.ini     宿主 → NSIS   装好以后：launch（打开胥宇，由 NSIS 以普通用户身份启动）/ finish
//
// 任何异常都不许让 NSIS 干等：还没给出决定就出错 → 写 decision=classic（经典界面接手）；已经在安装 → 只影响显示，不影响安装。
//
// 编译（Windows 自带的 .NET Framework 4.8 编译器，不需要装 SDK）见 build-host.cmd。语法限制在 C# 5。

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Win32;

[assembly: System.Reflection.AssemblyTitle("胥宇安装界面")]
[assembly: System.Reflection.AssemblyProduct("胥宇")]

namespace Xuyu.Setup
{
    internal static class Program
    {
        [STAThread]
        private static int Main(string[] args)
        {
            string session = ArgValue(args, "--session");
            if (string.IsNullOrEmpty(session) || !Directory.Exists(session)) return 2;
            Log log = new Log(Path.Combine(Path.GetTempPath(), "XuyuSetup-" + DateTime.Now.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture) + ".log"));
            try
            {
                Dictionary<string, string> init = Ini.Read(Path.Combine(session, "init.ini"), "init");
                log.Write("session " + session + " protocol " + Ini.Get(init, "protocol") + " mode " + Ini.Get(init, "mode"));
                if (Ini.Get(init, "protocol") != "1")
                {
                    Handshake.WriteDecision(session, "classic", null, false, "protocol-mismatch");
                    return 0;
                }
                if (SystemInformation.HighContrast)
                {
                    // 高对比度模式下用系统控件的经典界面，读屏和配色都由 Windows 负责
                    Handshake.WriteDecision(session, "classic", null, false, "high-contrast");
                    return 0;
                }
                string runtime = null;
                try { runtime = CoreWebView2Environment.GetAvailableBrowserVersionString(); }
                catch (Exception ex) { log.Write("webview2 runtime check: " + ex.Message); }
                if (string.IsNullOrEmpty(runtime))
                {
                    Handshake.WriteDecision(session, "classic", null, false, "webview2-missing");
                    return 0;
                }
                log.Write("webview2 runtime " + runtime);
                Native.EnablePerMonitorDpi();
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new SetupForm(session, init, log));
                return 0;
            }
            catch (Exception ex)
            {
                log.Write("fatal: " + ex);
                Handshake.WriteDecisionIfAbsent(session, "classic", "host-crash");
                return 3;
            }
            finally
            {
                log.Write("exit");
                Handshake.ScheduleCleanup(session);
            }
        }

        internal static string ArgValue(string[] args, string name)
        {
            for (int i = 0; i + 1 < args.Length; i++)
                if (string.Equals(args[i], name, StringComparison.OrdinalIgnoreCase)) return args[i + 1];
            return null;
        }
    }

    // ------------------------------------------------------------------ 主窗口

    internal sealed class SetupForm : Form
    {
        private const string HostName = "setup.xuyu.example";
        private const int LogicalWidth = 760, LogicalHeight = 480;

        private readonly string session;
        private readonly Dictionary<string, string> init;
        private readonly Log log;
        private readonly WebView2 web;
        private readonly JavaScriptSerializer json = new JavaScriptSerializer();
        private readonly Timer timer = new Timer();
        private readonly bool dark;
        private readonly long needBytes;
        private readonly string setupExe;
        private Process nsis;
        private TaskbarProgress taskbar;

        private string state = "welcome";          // welcome / installing / done / failed
        private string dir;
        private bool decisionWritten, afterWritten, appRunning;
        private string lastProgressKey = "";
        private int ticks;
        private Dictionary<string, object> lastProgress;

        public SetupForm(string session, Dictionary<string, string> init, Log log)
        {
            this.session = session;
            this.init = init;
            this.log = log;
            dark = Native.AppsUseDarkTheme();
            needBytes = Ini.GetLong(init, "needKB") * 1024;
            setupExe = Ini.Get(init, "setupExe");
            dir = Ini.Get(init, "dir");

            Text = Ini.Get(init, "mode") == "upgrade" ? "升级胥宇" : "安装胥宇";
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            AutoScaleMode = AutoScaleMode.None;
            BackColor = dark ? Color.FromArgb(0x17, 0x16, 0x12) : Color.FromArgb(0xF2, 0xED, 0xE2);   // 与 ui/app.css 的 --paper 一致，避免白闪
            ClientSize = new Size(LogicalWidth, LogicalHeight);
            KeyPreview = true;
            try { Icon = Icon.ExtractAssociatedIcon(setupExe); } catch (Exception) { }

            web = new WebView2();
            web.Dock = DockStyle.Fill;
            web.DefaultBackgroundColor = BackColor;
            Controls.Add(web);

            int pid;
            if (int.TryParse(Ini.Get(init, "nsisPid"), out pid))
            {
                try { nsis = Process.GetProcessById(pid); IntPtr h = nsis.Handle; }   // 立刻拿住句柄，退出码才拿得到，也不怕 PID 被复用
                catch (Exception ex) { log.Write("nsis process: " + ex.Message); nsis = null; }
            }

            timer.Interval = 100;
            timer.Tick += OnTick;
            Load += OnLoad;
            FormClosing += OnFormClosing;
            DpiChanged += delegate (object s, DpiChangedEventArgs e) { Bounds = e.SuggestedRectangle; };
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ClassStyle |= 0x20000;            // CS_DROPSHADOW：无边框窗口也有一圈阴影
                cp.Style |= 0x20000;                 // WS_MINIMIZEBOX：任务栏点击可以最小化 / 还原
                return cp;
            }
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            int dpi = DeviceDpi;
            ClientSize = new Size(LogicalWidth * dpi / 96, LogicalHeight * dpi / 96);
            Native.RoundCorners(Handle);
            taskbar = TaskbarProgress.TryCreate();
        }

        private async void OnLoad(object sender, EventArgs e)
        {
            CenterToScreen();
            try
            {
                CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(session, "wv2data"), null);
                await web.EnsureCoreWebView2Async(env);
                CoreWebView2 core = web.CoreWebView2;
                CoreWebView2Settings s = core.Settings;
                s.AreDevToolsEnabled = false;
                s.AreDefaultContextMenusEnabled = false;
                s.AreBrowserAcceleratorKeysEnabled = false;
                s.IsStatusBarEnabled = false;
                s.IsZoomControlEnabled = false;
                s.IsPinchZoomEnabled = false;
                s.IsSwipeNavigationEnabled = false;
                s.IsBuiltInErrorPageEnabled = false;
                s.IsGeneralAutofillEnabled = false;
                s.IsPasswordAutosaveEnabled = false;
                s.AreHostObjectsAllowed = false;
                core.SetVirtualHostNameToFolderMapping(HostName, Path.Combine(session, "ui"), CoreWebView2HostResourceAccessKind.Deny);
                core.NavigationStarting += delegate (object o, CoreWebView2NavigationStartingEventArgs a)
                {
                    if (!a.Uri.StartsWith("https://" + HostName + "/", StringComparison.OrdinalIgnoreCase)) a.Cancel = true;
                };
                core.NewWindowRequested += delegate (object o, CoreWebView2NewWindowRequestedEventArgs a) { a.Handled = true; };
                core.WebMessageReceived += OnWebMessage;
                core.ProcessFailed += OnProcessFailed;
                core.Navigate("https://" + HostName + "/index.html");
                timer.Start();
            }
            catch (Exception ex)
            {
                log.Write("webview2 init: " + ex);
                FallBackToClassic("webview2-init");
            }
        }

        // 页面进程崩了：还没决定 → 经典界面接手；已经在装 → 重新载入页面，ready 之后补发当前状态
        private void OnProcessFailed(object sender, CoreWebView2ProcessFailedEventArgs e)
        {
            log.Write("webview2 process failed: " + e.ProcessFailedKind);
            if (!decisionWritten) { FallBackToClassic("webview2-crash"); return; }
            try { web.CoreWebView2.Reload(); } catch (Exception ex) { log.Write("reload: " + ex.Message); }
        }

        private void FallBackToClassic(string reason)
        {
            if (!decisionWritten)
            {
                Handshake.WriteDecision(session, "classic", null, false, reason);
                decisionWritten = true;
            }
            Close();
        }

        // ---------------------------------------------------------- 界面 → 宿主

        private void OnWebMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            Dictionary<string, object> m;
            try { m = json.Deserialize<Dictionary<string, object>>(e.WebMessageAsJson); }
            catch (Exception) { return; }
            string type = Str(m, "type");
            switch (type)
            {
                case "ready": OnReady(); break;
                case "pickFolder": PickFolder(); break;
                case "install": BeginInstall(Str(m, "dir")); break;
                case "cancel":
                    if (state == "welcome" && !decisionWritten) { Handshake.WriteDecision(session, "cancel", null, false, "user"); decisionWritten = true; }
                    Close();
                    break;
                case "classic":
                    if (state == "welcome" && !decisionWritten)
                    {
                        Handshake.WriteDecision(session, "classic", null, Bool(m, "allUsers"), "user");
                        decisionWritten = true;
                        Close();
                    }
                    else if (state == "failed") { Relaunch("/classic"); }
                    break;
                case "retry": if (state == "failed") Relaunch(null); break;
                case "launch": Finish(Ini.Get(init, "canLaunch") != "0" ? "launch" : "finish"); break;
                case "finish": Finish("finish"); break;
                case "minimize": WindowState = FormWindowState.Minimized; break;
                case "drag": Native.BeginDrag(Handle); break;
                case "openLog": try { Process.Start("notepad.exe", "\"" + log.FilePath + "\""); } catch (Exception ex) { log.Write("open log: " + ex.Message); } break;
            }
        }

        private void OnReady()
        {
            Handshake.MarkReady(session);
            PathCheck.Result p = PathCheck.Check(dir, needBytes);
            appRunning = AppProcess.IsRunningUnder(dir);
            Dictionary<string, object> m = Msg("init");
            m["mode"] = Ini.Get(init, "mode");
            m["version"] = Ini.Get(init, "version");
            m["installedVersion"] = Ini.Get(init, "installedVersion");
            m["dir"] = p.Ok ? p.Dir : dir;
            m["dirSource"] = Ini.Get(init, "dirSource");
            m["freeBytes"] = p.FreeBytes;
            m["needBytes"] = needBytes;
            m["pathOk"] = p.Ok;
            m["pathReason"] = p.Reason;
            m["appRunning"] = appRunning;
            m["allUsersAvailable"] = Ini.Get(init, "allUsersAvailable") == "1";
            m["canLaunch"] = Ini.Get(init, "canLaunch") != "0";
            m["theme"] = dark ? "dark" : "light";
            m["reducedMotion"] = !Native.ClientAreaAnimation();
            if (p.Ok) dir = p.Dir;
            Post(m);
            // 页面重新载入（崩溃恢复）时，把安装进度补上
            if (state == "installing" && lastProgress != null) { Post(Msg("installingResume")); Post(lastProgress); }
            if (state == "done") Post(Msg("done"));
            web.Focus();
        }

        private void PickFolder()
        {
            string chosen = FolderPicker.Pick(Handle, "选择安装位置（会在里面建一个 XUYU 文件夹）", ExistingAncestor(dir));
            if (chosen == null) return;
            string target = PathCheck.WithXuyuFolder(chosen);   // 规格 I-22：选的是父目录，自动建 XUYU；已经叫 XUYU 就不再套一层
            PathCheck.Result p = PathCheck.Check(target, needBytes);
            Dictionary<string, object> m = Msg("pathInfo");
            m["ok"] = p.Ok;
            m["dir"] = p.Ok ? p.Dir : target;
            m["freeBytes"] = p.FreeBytes;
            m["reason"] = p.Reason;
            if (p.Ok) dir = p.Dir;
            Post(m);
        }

        private void BeginInstall(string requested)
        {
            if (state != "welcome" || decisionWritten) return;
            PathCheck.Result p = PathCheck.Check(string.IsNullOrEmpty(requested) ? dir : requested, needBytes);
            if (!p.Ok)
            {
                Dictionary<string, object> m = Msg("pathInfo");
                m["ok"] = false; m["dir"] = requested; m["reason"] = p.Reason;
                Post(m);
                return;
            }
            dir = p.Dir;
            Handshake.WriteDecision(session, "install", dir, false, "user");
            decisionWritten = true;
            state = "installing";
            Native.KeepAwake(true);
            if (taskbar != null) taskbar.Set(Handle, TaskbarProgress.Indeterminate, 0);
            log.Write("install to " + dir);
        }

        private void Finish(string action)
        {
            if (state != "done") return;
            if (!afterWritten) { Handshake.WriteAfter(session, action); afterWritten = true; }
            Close();
        }

        private void Relaunch(string args)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo(setupExe);
                psi.UseShellExecute = true;
                if (args != null) psi.Arguments = args;
                Process.Start(psi);
            }
            catch (Exception ex) { log.Write("relaunch: " + ex.Message); }
            Close();
        }

        // ---------------------------------------------------------- NSIS → 宿主 → 界面

        private void OnTick(object sender, EventArgs e)
        {
            ticks++;
            if (state == "welcome")
            {
                if (ticks % 15 == 0)
                {
                    bool running = AppProcess.IsRunningUnder(dir);
                    if (running != appRunning) { appRunning = running; Dictionary<string, object> m = Msg("appRunning"); m["running"] = running; Post(m); }
                }
                if (nsis != null && nsis.HasExited)
                {
                    log.Write("nsis exited before a decision, code " + SafeExitCode());
                    Close();
                }
                return;
            }
            if (state != "installing") return;

            Dictionary<string, string> st = Ini.TryRead(Path.Combine(session, "status.ini"), "status");
            string phase = st == null ? "prepare" : Ini.Get(st, "phase");
            if (phase == "done") { OnDone(); return; }
            if (st != null) ForwardProgress(st, phase);

            if (nsis != null && nsis.HasExited)
            {
                // 退出前最后再读一次，避免漏掉刚写下的 done
                st = Ini.TryRead(Path.Combine(session, "status.ini"), "status");
                if (st != null && Ini.Get(st, "phase") == "done") { OnDone(); return; }
                OnFailed(st == null ? "prepare" : Ini.Get(st, "phase"), SafeExitCode());
            }
        }

        private void ForwardProgress(Dictionary<string, string> st, string phase)
        {
            long done = Ini.GetLong(st, "extractDone"), total = Ini.GetLong(st, "extractTotal");
            string key = phase + "|" + done + "|" + total;
            if (key == lastProgressKey) return;
            lastProgressKey = key;
            Dictionary<string, object> m = Msg("progress");
            m["phase"] = phase;
            if (phase == "extract" && total > 0)
            {
                double f = Math.Max(0, Math.Min(1, (double)done / total));
                m["fraction"] = f;
                m["bytesDone"] = done;
                m["bytesTotal"] = total;
                if (taskbar != null) taskbar.Set(Handle, TaskbarProgress.Normal, f);
            }
            else if (taskbar != null)
            {
                taskbar.Set(Handle, phase == "prepare" ? TaskbarProgress.Indeterminate : TaskbarProgress.Normal, 1);
            }
            lastProgress = m;
            Post(m);
            log.Write("progress " + key);
        }

        private void OnDone()
        {
            if (state == "done") return;
            state = "done";
            Native.KeepAwake(false);
            if (taskbar != null) taskbar.Set(Handle, TaskbarProgress.None, 0);
            Post(Msg("done"));
            if (WindowState == FormWindowState.Minimized) Native.Flash(Handle);
            log.Write("done");
        }

        private void OnFailed(string phase, int exitCode)
        {
            if (state == "failed") return;
            state = "failed";
            Native.KeepAwake(false);
            if (taskbar != null) taskbar.Set(Handle, TaskbarProgress.Error, 1);
            Dictionary<string, object> m = Msg("failed");
            m["reason"] = FailureText.Describe(phase, exitCode, dir, needBytes);
            m["logPath"] = log.FilePath;
            Post(m);
            if (WindowState == FormWindowState.Minimized) Native.Flash(Handle);
            log.Write("failed in " + phase + ", exit code " + exitCode);
        }

        private int SafeExitCode()
        {
            try { return nsis.ExitCode; } catch (Exception) { return -1; }
        }

        private void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            // 安装进行中不能关（NSIS 中途停下来没法安全回滚），只能最小化；关机、任务管理器除外
            if (state == "installing" && e.CloseReason == CloseReason.UserClosing && (nsis == null || !nsis.HasExited))
            {
                e.Cancel = true;
                WindowState = FormWindowState.Minimized;
                return;
            }
            if (state == "welcome" && !decisionWritten) { Handshake.WriteDecision(session, "cancel", null, false, "window-closed"); decisionWritten = true; }
            if (state == "done" && !afterWritten) { Handshake.WriteAfter(session, "finish"); afterWritten = true; }
            timer.Stop();
            Native.KeepAwake(false);
            try { web.Dispose(); } catch (Exception) { }
        }

        // ---------------------------------------------------------- 小工具

        private void Post(Dictionary<string, object> m)
        {
            try { if (web.CoreWebView2 != null) web.CoreWebView2.PostWebMessageAsJson(json.Serialize(m)); }
            catch (Exception ex) { log.Write("post: " + ex.Message); }
        }

        private static Dictionary<string, object> Msg(string type)
        {
            Dictionary<string, object> m = new Dictionary<string, object>();
            m["type"] = type;
            return m;
        }

        private static string Str(Dictionary<string, object> m, string k)
        {
            object v;
            return m.TryGetValue(k, out v) && v != null ? Convert.ToString(v, CultureInfo.InvariantCulture) : "";
        }

        private static bool Bool(Dictionary<string, object> m, string k)
        {
            object v;
            return m.TryGetValue(k, out v) && v is bool && (bool)v;
        }

        private static string ExistingAncestor(string path)
        {
            try
            {
                string p = path;
                while (!string.IsNullOrEmpty(p) && !Directory.Exists(p)) p = Path.GetDirectoryName(p);
                return p;
            }
            catch (Exception) { return null; }
        }
    }

    // ------------------------------------------------------------------ 路径检查（规格 I-22）

    internal static class PathCheck
    {
        internal struct Result
        {
            public bool Ok;
            public string Dir;
            public long FreeBytes;
            public string Reason;
        }

        private const long Margin = 64L * 1024 * 1024;   // 留 64 MB 余量：解压时临时目录也要占地方

        internal static string WithXuyuFolder(string parent)
        {
            string p = parent.TrimEnd('\\', '/');
            if (p.Length == 2 && p[1] == ':') p += "\\";
            string leaf = Path.GetFileName(p.TrimEnd('\\'));
            if (string.Equals(leaf, "XUYU", StringComparison.OrdinalIgnoreCase)) return p;
            return Path.Combine(p, "XUYU");
        }

        internal static Result Check(string dir, long needBytes)
        {
            Result r = new Result();
            r.Dir = dir;
            if (string.IsNullOrEmpty(dir) || !Path.IsPathRooted(dir) || dir.StartsWith("\\\\?\\", StringComparison.Ordinal))
                return Fail(r, "这个位置用不了。请点“更改”选一个文件夹。");
            string full;
            try { full = Path.GetFullPath(dir).TrimEnd('\\'); }
            catch (Exception) { return Fail(r, "这个路径里有不能用的字符。请点“更改”重新选。"); }
            string root = Path.GetPathRoot(full);
            if (string.IsNullOrEmpty(root) || !Directory.Exists(root))
                return Fail(r, "找不到 " + DriveLabel(full) + "。请点“更改”重新选。");
            if (string.Equals(full.TrimEnd('\\') + "\\", root, StringComparison.OrdinalIgnoreCase))
                return Fail(r, "不能直接装在盘的根目录。请点“更改”重新选。");
            string windows = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
            if (!string.IsNullOrEmpty(windows) && (full + "\\").StartsWith(windows.TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase))
                return Fail(r, "不能装在 Windows 系统文件夹里。请点“更改”重新选。");
            r.Dir = full;
            r.FreeBytes = Native.FreeBytes(root);
            if (needBytes > 0 && r.FreeBytes >= 0 && r.FreeBytes < needBytes + Margin)
                return Fail(r, DriveLabel(full) + "剩余空间不够：需要 " + Mb(needBytes + Margin) + "，剩余 " + Mb(r.FreeBytes) + "。");
            if (!CanWriteNear(full))
                return Fail(r, "没有权限写入这个位置。请换一个文件夹，或点“给这台电脑的所有用户安装…”。");
            r.Ok = true;
            return r;
        }

        private static Result Fail(Result r, string reason) { r.Ok = false; r.Reason = reason; return r; }

        internal static string DriveLabel(string full)
        {
            string root = Path.GetPathRoot(full) ?? "";
            if (root.Length >= 2 && root[1] == ':') return root.Substring(0, 2).ToUpperInvariant() + " 盘";
            return "共享位置 " + root.TrimEnd('\\');
        }

        internal static string Mb(long bytes) { return Math.Ceiling(bytes / 1048576.0).ToString("0", CultureInfo.InvariantCulture) + " MB"; }

        // 在最近的已存在的上级目录里试着建一个临时文件再删掉（不在用户选的位置留下任何东西）
        private static bool CanWriteNear(string full)
        {
            string p = full;
            try { while (!Directory.Exists(p)) p = Path.GetDirectoryName(p); }
            catch (Exception) { return false; }
            if (p == null) return false;
            string probe = Path.Combine(p, ".xuyu-write-test-" + Guid.NewGuid().ToString("N"));
            try
            {
                using (FileStream fs = new FileStream(probe, FileMode.CreateNew, FileAccess.Write, FileShare.None, 1, FileOptions.DeleteOnClose)) { fs.WriteByte(0); }
                return true;
            }
            catch (Exception) { return false; }
        }
    }

    internal static class FailureText
    {
        internal static string Describe(string phase, int exitCode, string dir, long needBytes)
        {
            string step;
            switch (phase)
            {
                case "extract": step = "解压文件"; break;
                case "copy": step = "写入文件"; break;
                case "finish": step = "创建快捷方式"; break;
                default: step = "准备"; break;
            }
            string text = "安装在“" + step + "”这一步停下了（安装程序退出代码 " + exitCode + "）。";
            long free = Native.FreeBytes(Path.GetPathRoot(dir ?? "") ?? "");
            if (needBytes > 0 && free >= 0 && free < needBytes)
                text += PathCheck.DriveLabel(dir) + "现在只剩 " + PathCheck.Mb(free) + "，需要 " + PathCheck.Mb(needBytes) + "。";
            return text;
        }
    }

    internal static class AppProcess
    {
        // 只认装在这个目录里的 XUYU.exe（别人的同名程序、Portable 版不算）
        internal static bool IsRunningUnder(string dir)
        {
            if (string.IsNullOrEmpty(dir)) return false;
            string prefix = dir.TrimEnd('\\') + "\\";
            foreach (Process p in Process.GetProcessesByName("XUYU"))
            {
                try
                {
                    string path = p.MainModule.FileName;
                    if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return true;
                }
                catch (Exception) { }
                finally { p.Dispose(); }
            }
            return false;
        }
    }

    // ------------------------------------------------------------------ 与 NSIS 的文件约定

    internal static class Handshake
    {
        internal static void WriteDecision(string session, string action, string dir, bool allUsers, string reason)
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("[decision]\r\n");
            sb.Append("action=").Append(action).Append("\r\n");
            if (dir != null) sb.Append("dir=").Append(dir).Append("\r\n");
            sb.Append("allUsers=").Append(allUsers ? "1" : "0").Append("\r\n");
            sb.Append("reason=").Append(reason).Append("\r\n");
            WriteAtomic(Path.Combine(session, "decision.ini"), sb.ToString());
        }

        internal static void WriteDecisionIfAbsent(string session, string action, string reason)
        {
            try { if (!File.Exists(Path.Combine(session, "decision.ini"))) WriteDecision(session, action, null, false, reason); }
            catch (Exception) { }
        }

        internal static void WriteAfter(string session, string action)
        {
            WriteAtomic(Path.Combine(session, "after.ini"), "[after]\r\naction=" + action + "\r\n");
        }

        internal static void MarkReady(string session)
        {
            try { File.WriteAllText(Path.Combine(session, "ready.flag"), "1"); } catch (Exception) { }
        }

        // UTF-16LE 带 BOM：NSIS 的 ReadINIStr（GetPrivateProfileStringW）能正确读中文路径
        private static void WriteAtomic(string path, string content)
        {
            string tmp = path + ".tmp";
            File.WriteAllText(tmp, content, new UnicodeEncoding(false, true));
            if (File.Exists(path)) File.Delete(path);
            File.Move(tmp, path);
        }

        // 宿主退出后几秒删掉会话目录（WebView2 的子进程要先退干净）；删不掉的由下一次安装清理
        internal static void ScheduleCleanup(string session)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "cmd.exe"),
                    "/d /c ping -n 6 127.0.0.1 >nul & rd /s /q \"" + session + "\"");
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                Process.Start(psi);
            }
            catch (Exception) { }
        }
    }

    internal static class Ini
    {
        internal static Dictionary<string, string> Read(string path, string section)
        {
            Dictionary<string, string> d = TryRead(path, section);
            if (d == null) throw new IOException("cannot read " + path);
            return d;
        }

        // NSIS 可能正在写：共享打开，读不到就返回 null，下一拍再读
        internal static Dictionary<string, string> TryRead(string path, string section)
        {
            try
            {
                if (!File.Exists(path)) return null;
                string text;
                using (FileStream fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                using (StreamReader sr = new StreamReader(fs, DetectEncoding(fs), true)) { text = sr.ReadToEnd(); }
                return Parse(text, section);
            }
            catch (IOException) { return null; }
            catch (UnauthorizedAccessException) { return null; }
        }

        internal static Dictionary<string, string> Parse(string text, string section)
        {
            Dictionary<string, string> d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            bool inSection = false;
            foreach (string raw in text.Split('\n'))
            {
                string line = raw.Trim().TrimStart('﻿');
                if (line.Length == 0 || line[0] == ';') continue;
                if (line[0] == '[') { inSection = string.Equals(line.Trim('[', ']'), section, StringComparison.OrdinalIgnoreCase); continue; }
                int eq = line.IndexOf('=');
                if (inSection && eq > 0) d[line.Substring(0, eq).Trim()] = line.Substring(eq + 1).Trim();
            }
            return d;
        }

        private static Encoding DetectEncoding(FileStream fs)
        {
            byte[] bom = new byte[2];
            int n = fs.Read(bom, 0, 2);
            fs.Position = 0;
            return n == 2 && bom[0] == 0xFF && bom[1] == 0xFE ? (Encoding)new UnicodeEncoding(false, true) : new UTF8Encoding(false);
        }

        internal static string Get(Dictionary<string, string> d, string k)
        {
            string v;
            return d != null && d.TryGetValue(k, out v) ? v : "";
        }

        internal static long GetLong(Dictionary<string, string> d, string k)
        {
            long v;
            return long.TryParse(Get(d, k), NumberStyles.Integer, CultureInfo.InvariantCulture, out v) ? v : 0;
        }
    }

    internal sealed class Log
    {
        internal readonly string FilePath;
        private readonly object gate = new object();

        internal Log(string path) { FilePath = path; Write("胥宇安装界面 " + typeof(Log).Assembly.GetName().Version); }

        internal void Write(string line)
        {
            lock (gate)
            {
                try { File.AppendAllText(FilePath, DateTime.Now.ToString("HH:mm:ss.fff", CultureInfo.InvariantCulture) + "  " + line + "\r\n", Encoding.UTF8); }
                catch (Exception) { }
            }
        }
    }

    // ------------------------------------------------------------------ Win32

    internal static class Native
    {
        [DllImport("user32.dll")] private static extern bool ReleaseCapture();
        [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);
        [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr value);
        [DllImport("user32.dll")] private static extern bool SystemParametersInfo(int action, int param, ref bool value, int winIni);
        [DllImport("user32.dll")] private static extern bool FlashWindowEx(ref FLASHWINFO info);
        [DllImport("dwmapi.dll")] private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool GetDiskFreeSpaceEx(string dir, out ulong freeToCaller, out ulong total, out ulong totalFree);
        [DllImport("kernel32.dll")] private static extern uint SetThreadExecutionState(uint flags);

        [StructLayout(LayoutKind.Sequential)]
        private struct FLASHWINFO { public uint cbSize; public IntPtr hwnd; public uint dwFlags; public uint uCount; public uint dwTimeout; }

        internal static void EnablePerMonitorDpi()
        {
            try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch (Exception) { }   // PER_MONITOR_AWARE_V2；旧系统由清单兜底
        }

        internal static void BeginDrag(IntPtr hwnd)
        {
            // 消息是异步到的：鼠标已经松开就不要进入拖动循环（否则窗口会粘在鼠标上）
            if ((Control.MouseButtons & MouseButtons.Left) == 0) return;
            ReleaseCapture();
            SendMessage(hwnd, 0xA1 /* WM_NCLBUTTONDOWN */, new IntPtr(2) /* HTCAPTION */, IntPtr.Zero);
        }

        internal static void RoundCorners(IntPtr hwnd)
        {
            int round = 2;   // DWMWCP_ROUND，Windows 11 才有效，Windows 10 忽略
            try { DwmSetWindowAttribute(hwnd, 33 /* DWMWA_WINDOW_CORNER_PREFERENCE */, ref round, 4); } catch (Exception) { }
        }

        internal static bool AppsUseDarkTheme()
        {
            try
            {
                using (RegistryKey k = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"))
                {
                    object v = k == null ? null : k.GetValue("AppsUseLightTheme");
                    return v is int && (int)v == 0;
                }
            }
            catch (Exception) { return false; }
        }

        internal static bool ClientAreaAnimation()
        {
            bool on = true;
            try { SystemParametersInfo(0x1042 /* SPI_GETCLIENTAREAANIMATION */, 0, ref on, 0); } catch (Exception) { }
            return on;
        }

        internal static long FreeBytes(string root)
        {
            ulong free, total, totalFree;
            try { return GetDiskFreeSpaceEx(root, out free, out total, out totalFree) ? (long)free : -1; }
            catch (Exception) { return -1; }
        }

        internal static void KeepAwake(bool on)
        {
            try { SetThreadExecutionState(on ? 0x80000001u /* ES_CONTINUOUS | ES_SYSTEM_REQUIRED */ : 0x80000000u); } catch (Exception) { }
        }

        internal static void Flash(IntPtr hwnd)
        {
            FLASHWINFO f = new FLASHWINFO();
            f.cbSize = (uint)Marshal.SizeOf(typeof(FLASHWINFO));
            f.hwnd = hwnd;
            f.dwFlags = 0x2 | 0xC;   // FLASHW_TRAY | FLASHW_TIMERNOFG：任务栏按钮闪到用户切回来
            try { FlashWindowEx(ref f); } catch (Exception) { }
        }
    }

    // 任务栏按钮上的进度：最小化以后也能看到装到哪了
    internal sealed class TaskbarProgress
    {
        internal const int None = 0, Indeterminate = 1, Normal = 2, Error = 4;

        [ComImport, Guid("56FDF344-FD6D-11d0-958A-006097C9A090")] private class CTaskbarList { }

        [ComImport, Guid("ea1afb91-9e28-4b86-90e9-9e9f8a5eefaf"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface ITaskbarList3
        {
            void HrInit();
            void AddTab(IntPtr hwnd);
            void DeleteTab(IntPtr hwnd);
            void ActivateTab(IntPtr hwnd);
            void SetActiveAlt(IntPtr hwnd);
            void MarkFullscreenWindow(IntPtr hwnd, [MarshalAs(UnmanagedType.Bool)] bool fullscreen);
            void SetProgressValue(IntPtr hwnd, ulong completed, ulong total);
            void SetProgressState(IntPtr hwnd, int flags);
        }

        private readonly ITaskbarList3 list;
        private TaskbarProgress(ITaskbarList3 list) { this.list = list; }

        internal static TaskbarProgress TryCreate()
        {
            try { ITaskbarList3 l = (ITaskbarList3)new CTaskbarList(); l.HrInit(); return new TaskbarProgress(l); }
            catch (Exception) { return null; }
        }

        internal void Set(IntPtr hwnd, int state, double fraction)
        {
            try
            {
                list.SetProgressState(hwnd, state);
                if (state == Normal || state == Error) list.SetProgressValue(hwnd, (ulong)(Math.Max(0, Math.Min(1, fraction)) * 1000), 1000);
            }
            catch (Exception) { }
        }
    }

    // 系统的“选择文件夹”对话框（Vista 起的新样式，不用老的树形对话框）
    internal static class FolderPicker
    {
        [ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")] private class FileOpenDialogRCW { }

        [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IFileOpenDialog
        {
            [PreserveSig] int Show(IntPtr parent);
            void SetFileTypes(uint count, IntPtr specs);
            void SetFileTypeIndex(uint index);
            void GetFileTypeIndex(out uint index);
            void Advise(IntPtr sink, out uint cookie);
            void Unadvise(uint cookie);
            void SetOptions(uint fos);
            void GetOptions(out uint fos);
            void SetDefaultFolder(IShellItem item);
            void SetFolder(IShellItem item);
            void GetFolder(out IShellItem item);
            void GetCurrentSelection(out IShellItem item);
            void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
            void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
            void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
            void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string text);
            void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
            void GetResult(out IShellItem item);
            void AddPlace(IShellItem item, int place);
            void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string ext);
            void Close(int hr);
            void SetClientGuid(ref Guid guid);
            void ClearClientData();
            void SetFilter(IntPtr filter);
            void GetResults(out IntPtr items);
            void GetSelectedItems(out IntPtr items);
        }

        [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IShellItem
        {
            void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
            void GetParent(out IShellItem item);
            void GetDisplayName(uint sigdn, [MarshalAs(UnmanagedType.LPWStr)] out string name);
            void GetAttributes(uint mask, out uint attrs);
            void Compare(IShellItem item, uint hint, out int order);
        }

        [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
        private static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, ref Guid riid, out IShellItem item);

        private const uint FOS_PICKFOLDERS = 0x20, FOS_FORCEFILESYSTEM = 0x40, FOS_PATHMUSTEXIST = 0x800;
        private const uint SIGDN_FILESYSPATH = 0x80058000;

        // 返回选中的文件夹；取消返回 null
        internal static string Pick(IntPtr owner, string title, string start)
        {
            IFileOpenDialog dlg = (IFileOpenDialog)new FileOpenDialogRCW();
            try
            {
                dlg.SetOptions(FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
                dlg.SetTitle(title);
                dlg.SetOkButtonLabel("选这里");
                if (!string.IsNullOrEmpty(start))
                {
                    try
                    {
                        Guid iid = typeof(IShellItem).GUID;
                        IShellItem folder;
                        SHCreateItemFromParsingName(start, IntPtr.Zero, ref iid, out folder);
                        dlg.SetFolder(folder);
                    }
                    catch (Exception) { }
                }
                if (dlg.Show(owner) != 0) return null;
                IShellItem result;
                dlg.GetResult(out result);
                string path;
                result.GetDisplayName(SIGDN_FILESYSPATH, out path);
                return path;
            }
            finally { Marshal.ReleaseComObject(dlg); }
        }
    }
}
