using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Text;

// GUI subsystem launcher: never allocates a console or invokes a shell.
internal static class VeyrionUpdateHost {
  private static string Cache { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Veyrion\Updates"); } }
  private static void Failure(string message) {
    try {
      Directory.CreateDirectory(Cache);
      string json = "{\"state\":\"error\",\"detail\":\"" + message.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", " ").Replace("\n", " ") + "\",\"restartRequested\":false,\"checkedAt\":\"" + DateTime.UtcNow.ToString("o") + "\"}";
      File.WriteAllText(Path.Combine(Cache,"status.json"),json,new UTF8Encoding(false));
    } catch { }
  }
  [STAThread] private static int Main(string[] args) {
    try {
      if (args.Length > 1 || (args.Length == 1 && args[0] != "apply" && args[0] != "apply-restart" && args[0] != "check")) return 2;
      string script = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "update.ps1");
      Directory.CreateDirectory(Cache);
      string signal = Path.Combine(Cache,"started-" + Guid.NewGuid().ToString("N") + ".txt");
      var start = new ProcessStartInfo {
        FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"WindowsPowerShell\v1.0\powershell.exe"),
        Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + script + "\"" + (args.Length == 1 && args[0].StartsWith("apply") ? " -Apply" : "") + (args.Length == 1 && args[0] == "apply-restart" ? " -Restart" : "") + " -StartupSignal \"" + signal + "\" -LauncherProcessId " + Process.GetCurrentProcess().Id,
        UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden,
        WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory
      };
      using (var process = Process.Start(start)) {
        if (args.Length == 1 && args[0].StartsWith("apply")) {
          var clock = Stopwatch.StartNew();
          while(clock.ElapsedMilliseconds < 10000) {
            // The worker waits for this launcher to exit before installing.
            if(File.Exists(signal)) { File.Delete(signal); return 0; }
            if(process.HasExited) {
              Failure("No se pudo iniciar el actualizador. PowerShell terminó con código " + process.ExitCode + ".");
              return 1;
            }
            Thread.Sleep(50);
          }
          Failure("El actualizador no confirmó su inicio. Revisa el diagnóstico de actualizaciones.");
          return 1;
        }
        process.WaitForExit();
        if(File.Exists(signal))File.Delete(signal);
        if(process.ExitCode != 0)Failure("Falló la comprobación de actualizaciones. Código " + process.ExitCode + ".");
        return process.ExitCode;
      }
    } catch { Failure("Windows no pudo iniciar el actualizador de Veyrion. Puedes instalar la nueva versión manualmente."); return 1; }
  }
}
