using System;
using System.Diagnostics;
using System.IO;

// GUI subsystem launcher: never allocates a console or invokes a shell.
internal static class VeyrionUpdateHost {
  [STAThread] private static int Main(string[] args) {
    try {
      if (args.Length > 1 || (args.Length == 1 && args[0] != "apply" && args[0] != "check")) return 2;
      string script = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "update.ps1");
      var start = new ProcessStartInfo {
        FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"WindowsPowerShell\v1.0\powershell.exe"),
        Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + script + "\"" + (args.Length == 1 && args[0] == "apply" ? " -Apply" : ""),
        UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden,
        WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory
      };
      using (var process = Process.Start(start)) { process.WaitForExit(); return process.ExitCode; }
    } catch { return 1; }
  }
}
