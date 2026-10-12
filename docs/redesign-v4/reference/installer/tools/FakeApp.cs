// 测试用的“胥宇”：协议测试安装包里的 XUYU.exe。被启动时在 %TEMP%\xuyu-launched.txt 记一行，然后退出。不随安装包发布。
using System;
using System.IO;

internal static class FakeApp
{
    private static int Main()
    {
        File.AppendAllText(Path.Combine(Path.GetTempPath(), "xuyu-launched.txt"), "launched " + Environment.CommandLine + Environment.NewLine);
        return 0;
    }
}
