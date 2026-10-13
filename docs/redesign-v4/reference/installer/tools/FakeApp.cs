// 测试用的“胥宇”：协议测试安装包里的 XUYU.exe。被启动时在自己所在的目录（安装目录）里的 xuyu-launched.txt 记一行，然后退出。
// 不写 %TEMP%：经 Explorer 以普通用户身份启动时，TEMP 可能和跑测试的进程不是同一个目录。不随安装包发布。
using System;
using System.IO;

internal static class FakeApp
{
    private static int Main()
    {
        File.AppendAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "xuyu-launched.txt"), "launched " + Environment.CommandLine + Environment.NewLine);
        return 0;
    }
}
