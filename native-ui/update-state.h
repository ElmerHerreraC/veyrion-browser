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
      (*state == "available" || *state == "downloading" || *state == "ready-on-close")) {
    const auto* next = result.FindString("detail");
    const auto* installed = result.FindString("installed");
    const base::Version next_version(next ? *next : "");
    const base::Version installed_version(installed ? *installed : "");
    if (!next_version.IsValid() || (installed_version.IsValid() && next_version <= installed_version))
      result.Set("state", "current");
  }
  if (action == "check" || action == "apply") {
    base::CommandLine command(directory.AppendASCII("updater").AppendASCII("VeyrionUpdate.exe"));
    command.AppendArg(action);
    base::LaunchOptions options;
    options.start_hidden = true;
    auto process = base::LaunchProcess(command, options);
    result.Set("state", process.IsValid() ? (action == "check" ? "checking" : "starting") : "error");
  }
  return result;
}
#endif
