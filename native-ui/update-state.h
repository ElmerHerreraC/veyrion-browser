#ifndef BRAVE_BROWSER_UI_WEBUI_SETTINGS_VEYRION_UPDATE_STATE_H_
#define BRAVE_BROWSER_UI_WEBUI_SETTINGS_VEYRION_UPDATE_STATE_H_

#include "base/base_paths.h"
#include "base/base_paths_win.h"
#include "base/command_line.h"
#include "base/files/file_util.h"
#include "base/json/json_reader.h"
#include "base/path_service.h"
#include "base/process/launch.h"
#include "base/values.h"
#include "base/version.h"
#include "base/json/json_writer.h"
#include "base/process/process_handle.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/utf_string_conversions.h"
#include "base/time/time.h"

inline bool VeyrionSaveRestartArguments(const std::string& version) {
  if (!base::Version(version).IsValid()) return false;
  base::FilePath cache;
  if (!base::PathService::Get(base::DIR_LOCAL_APP_DATA, &cache)) return false;
  cache = cache.AppendASCII("Veyrion").AppendASCII("Updates");
  if (!base::CreateDirectory(cache)) return false;
  base::ListValue args;
  const auto* command = base::CommandLine::ForCurrentProcess();
  for (const auto* name : {"user-data-dir", "profile-directory"}) {
    if (command->HasSwitch(name))
      args.Append("--" + std::string(name) + "=" + base::WideToUTF8(command->GetSwitchValueNative(name)));
  }
  std::string json;
  if (!base::JSONWriter::Write(args, &json) ||
      !base::WriteFile(cache.AppendASCII("restart-" + version + "-" +
          base::NumberToString(base::GetCurrentProcId()) + ".json"), json)) return false;
  return true;
}

// Called only on a MayBlock worker. No arbitrary command, path or URL is accepted.
inline base::DictValue VeyrionUpdateState(const std::string& action) {
  base::DictValue result;
  result.Set("state", "unchecked");
  base::FilePath directory, cache;
  if (!base::PathService::Get(base::DIR_EXE, &directory) ||
      !base::PathService::Get(base::DIR_LOCAL_APP_DATA, &cache)) return result;
  std::string content;
  auto config_path = directory.AppendASCII("updater").AppendASCII("config.json");
  if (base::ReadFileToStringWithMaxSize(config_path, &content, 20000)) {
    auto config = base::JSONReader::ReadDict(content, base::JSON_PARSE_RFC);
    if (config && config->FindString("version")) result.Set("installed", *config->FindString("version"));
  }
  auto status = cache.AppendASCII("Veyrion").AppendASCII("Updates").AppendASCII("status.json");
  content.clear();
  if (base::ReadFileToStringWithMaxSize(status, &content, 20000)) {
    // Windows PowerShell emits a UTF-8 BOM.
    if (content.starts_with("\xEF\xBB\xBF")) content.erase(0, 3);
    auto value = base::JSONReader::ReadDict(content, base::JSON_PARSE_RFC);
    if (value) result.Merge(std::move(*value));
  }
  if (const auto* state = result.FindString("state"); state &&
      (*state == "available" || *state == "downloading" || *state == "verifying" || *state == "installing" || *state == "ready-on-close")) {
    const auto* next = result.FindString("detail");
    const auto* installed = result.FindString("installed");
    const base::Version next_version(next ? *next : "");
    const base::Version installed_version(installed ? *installed : "");
    if (!next_version.IsValid() || (installed_version.IsValid() && next_version <= installed_version))
      result.Set("state", "current");
  }
  if (action == "check" || action == "apply" || action == "apply-restart") {
    if (action == "apply-restart") {
      const auto* version = result.FindString("detail");
      const auto* installed = result.FindString("installed");
      if (!version || !installed || !base::Version(*version).IsValid() ||
          !base::Version(*installed).IsValid() ||
          base::Version(*version) <= base::Version(*installed)) {
        result.Set("state", "error");
        result.Set("detail", "No hay una versión válida pendiente de instalar.");
        return result;
      }
      base::DictValue request;
      request.Set("version", *version);
      request.Set("pid", static_cast<int>(base::GetCurrentProcId()));
      std::string json;
      auto request_path = status.DirName().AppendASCII("restart-request.json");
      if (!base::CreateDirectory(status.DirName()) ||
          !base::JSONWriter::Write(request, &json) || !base::WriteFile(request_path, json)) {
        result.Set("state", "error");
        result.Set("detail", "No se pudo guardar la solicitud de reinicio.");
        return result;
      }
      if (const auto* state = result.FindString("state"); state &&
          (*state == "downloading" || *state == "verifying" || *state == "ready-on-close")) {
        result.Set("restartRequested", true);
        return result;
      }
    }
    base::CommandLine command(directory.AppendASCII("updater").AppendASCII("VeyrionUpdate.exe"));
    command.AppendArg(action);
    base::LaunchOptions options;
    options.start_hidden = true;
    auto process = base::LaunchProcess(command, options);
    bool started = process.IsValid();
    if (started && action != "check") {
      int exit_code = -1;
      started = process.WaitForExitWithTimeout(base::Seconds(12), &exit_code) && exit_code == 0;
    }
    result.Set("state", started ? (action == "check" ? "checking" : "starting") : "error");
    if (!started) {
      result.Set("detail", "El actualizador no pudo iniciar. Consulta el diagnóstico o instala la nueva versión manualmente.");
      base::DictValue failure;
      failure.Set("state", "error");
      failure.Set("detail", *result.FindString("detail"));
      failure.Set("restartRequested", false);
      std::string json;
      if (base::CreateDirectory(status.DirName()) && base::JSONWriter::Write(failure, &json))
        base::WriteFile(status, json);
    }
  }
  if (const auto* state = result.FindString("state"); state && *state == "ready-on-close") {
    content.clear();
    if (base::ReadFileToStringWithMaxSize(status.DirName().AppendASCII("restart-request.json"), &content, 2000)) {
      auto request = base::JSONReader::ReadDict(content, base::JSON_PARSE_RFC);
      const auto* version = result.FindString("detail");
      if (request && version && request->FindString("version") &&
          *request->FindString("version") == *version &&
          request->FindInt("pid").value_or(0) == static_cast<int>(base::GetCurrentProcId()))
        result.Set("restartRequested", true);
    }
  }
  return result;
}
#endif
