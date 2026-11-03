#ifndef VEYRION_IMPORT_SOURCE_H_
#define VEYRION_IMPORT_SOURCE_H_
#include <optional>
#include "base/files/file_util.h"
#include "brave/common/importer/chrome_importer_utils.h"
#include "components/user_data_importer/common/importer_data_types.h"

// Runs on a MayBlock worker. Only validates the explicitly selected directory;
// it never searches other users, modifies a source profile or copies credentials.
inline std::optional<user_data_importer::SourceProfile> VeyrionPrepareImportSource(
    user_data_importer::SourceProfile source, const base::FilePath& directory) {
  source.source_path = directory;
  if (source.importer_type == user_data_importer::TYPE_FIREFOX) {
    if (!base::PathExists(directory.AppendASCII("places.sqlite"))) return std::nullopt;
    source.services_supported = user_data_importer::FAVORITES | user_data_importer::HISTORY;
  } else {
    if (!base::PathExists(directory.AppendASCII("Bookmarks")) &&
        !base::PathExists(directory.AppendASCII("History")) &&
        base::DirectoryExists(directory.AppendASCII("Default")))
      source.source_path = directory.AppendASCII("Default");
    uint16_t supported = user_data_importer::NONE;
    if (!ChromeImporterCanImport(source.source_path, source.importer_type, &supported))
      return std::nullopt;
    // Direct folder import intentionally excludes encrypted passwords and payments.
    source.services_supported = supported & (user_data_importer::FAVORITES |
        user_data_importer::HISTORY | user_data_importer::AUTOFILL_FORM_DATA);
  }
  if (!source.services_supported) return std::nullopt;
  return source;
}
#endif
