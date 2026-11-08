import fs from 'node:fs'
import path from 'node:path'
import {root} from './paths.mjs'
export function integrateOpenBrowserData(source){
  const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version
  const edit=(file,fn)=>{const p=path.join(source,file),s=fs.readFileSync(p,'utf8'),t=fn(s);if(s!==t)fs.writeFileSync(p,t)}
  const addIncludes=s=>s.replace('#include <memory>','#include <memory>\n#include "base/base_paths.h"\n#include "base/path_service.h"')
  edit('components/brave_user_agent/browser/brave_user_agent_component_installer.cc',s=>{
    if(!s.includes('inline constexpr char kBraveUserAgentExceptionsComponentId[]'))s=s.replace('inline constexpr char kBraveUserAgentExceptionsComponentName[]', 'inline constexpr char kBraveUserAgentExceptionsComponentId[] = "nlpaeekllejnmhoonlpcefpfnpbajbpe";\ninline constexpr char kBraveUserAgentExceptionsComponentName[]')
    if(s.includes('// Veyrion bundled UA exceptions'))return s
    const start=s.indexOf('  auto installer =',s.indexOf('void RegisterBraveUserAgentComponent(')),end=s.indexOf('\n}',start)
    if(start<0||end<0)throw Error('Missing UA exception registration')
    s=addIncludes(s.slice(0,start)+`  // Veyrion bundled UA exceptions, updated through signed Veyrion releases.
  base::FilePath install_dir;
  if (base::PathService::Get(base::DIR_EXE, &install_dir)) {
    if (auto* data = BraveUserAgentExceptions::GetInstance())
      data->OnComponentReady(install_dir.AppendASCII("veyrion-components"));
  }`+s.slice(end))
    return s
  })
  edit('components/query_filter/browser/query_filter_component_installer.cc',s=>{
    if(s.includes('// Veyrion bundled query rules'))return s
    const start=s.indexOf('  auto installer =',s.indexOf('void RegisterQueryFilterComponent(')),end=s.indexOf('\n}',start)
    if(start<0||end<0)throw Error('Missing query rule registration')
    s=s.slice(0,start)+`  // Veyrion bundled query rules use the unchanged native parser.
  base::FilePath install_dir;
  if (base::PathService::Get(base::DIR_EXE, &install_dir)) {
    QueryFilterComponentInstallerPolicy policy;
    policy.ComponentReady(base::Version("${version}"),
        install_dir.AppendASCII("veyrion-components"), base::DictValue());
  }`+s.slice(end)
    return s.replace('#include <stdint.h>','#include <stdint.h>\n#include "base/base_paths.h"\n#include "base/path_service.h"')
  })
  edit('components/brave_component_updater/browser/local_data_files_service.h',s=>s.includes('ScheduleVeyrionDataNotification')?s:s.replace('#include <memory>','#include <memory>\n#include "base/memory/weak_ptr.h"').replace('  bool initialized_;',`  void ScheduleVeyrionDataNotification();
  bool initialized_;
  bool veyrion_notification_pending_ = false;
  base::FilePath veyrion_data_path_;`).replace('  base::ObserverList<LocalDataFilesObserver>::Unchecked observers_;','  base::ObserverList<LocalDataFilesObserver>::Unchecked observers_;\n  base::WeakPtrFactory<LocalDataFilesService> veyrion_weak_factory_{this};'))
  edit('components/brave_component_updater/browser/local_data_files_service.cc',s=>{
    if(s.includes('// Veyrion bundled local data'))return s
    s=s.replace('#include "brave/components/brave_component_updater/browser/local_data_files_observer.h"',`#include "brave/components/brave_component_updater/browser/local_data_files_observer.h"
#include "base/base_paths.h"
#include "base/path_service.h"
#include "base/functional/bind.h"
#include "base/task/sequenced_task_runner.h"`)
    s=s.replace('  Register(kLocalDataFilesComponentName, kLocalDataFilesComponentId,\n           kLocalDataFilesComponentBase64PublicKey);',`  // Veyrion bundled local data replaces the unavailable remote component.
  if (!base::PathService::Get(base::DIR_EXE, &veyrion_data_path_)) return false;
  veyrion_data_path_ = veyrion_data_path_.AppendASCII("veyrion-components")
      .AppendASCII("local-data");`)
    s=s.replace('  initialized_ = true;','  initialized_ = true;\n  ScheduleVeyrionDataNotification();')
    s=s.replace('  observers_.AddObserver(observer);','  observers_.AddObserver(observer);\n  ScheduleVeyrionDataNotification();')
    return s.replace('///////////////////////////////////////////////////////////////////////////////',`void LocalDataFilesService::ScheduleVeyrionDataNotification() {
  if (!initialized_ || veyrion_notification_pending_) return;
  veyrion_notification_pending_ = true;
  // Observers subscribe during base construction: deliver only after it ends.
  base::SequencedTaskRunner::GetCurrentDefault()->PostTask(FROM_HERE,
      base::BindOnce([](base::WeakPtr<LocalDataFilesService> self) {
        if (!self) return;
        self->veyrion_notification_pending_ = false;
        self->OnComponentReady(kLocalDataFilesComponentId,
                               self->veyrion_data_path_, "{}");
      }, veyrion_weak_factory_.GetWeakPtr()));
}

///////////////////////////////////////////////////////////////////////////////`.replace('veyrion','veyrion'))
  })
}
