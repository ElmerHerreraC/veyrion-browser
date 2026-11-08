// Local translation is owned by the native tab client. The built-in component
// supplies the sandboxed WASM worker; replies must match this exact document.
namespace {
constexpr char kVeyrionTranslationExtension[] = "mnojpmjdmbbfmejpflffifhffcmidifd";
}

bool ChromeTranslateClient::TranslateLocally(std::string_view source,
                                           std::string_view target) {
  if (!web_contents() || !translate_manager_ ||
      !web_contents()->GetLastCommittedURL().SchemeIsHTTPOrHTTPS()) return false;
  if ((target != "en" && target != "es") ||
      (source != "en" && source != "es" && source != "und")) {
    base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(FROM_HERE,
        base::BindOnce([](base::WeakPtr<ChromeTranslateClient> self,
                          std::string from, std::string to) {
          if (self && self->translate_manager_)
            self->translate_manager_->PageTranslated(from, to,
                translate::TranslateErrors::UNSUPPORTED_LANGUAGE);
        }, weak_factory_.GetWeakPtr(), std::string(source), std::string(target)));
    return true;
  }
  const std::string from = (source == "en" || source == "es") && source != target
      ? std::string(source) : (target == "es" ? "en" : "es");
  auto* frame = web_contents()->GetPrimaryMainFrame();
  auto* router = extensions::EventRouter::Get(web_contents()->GetBrowserContext());
  if (!frame || !router) return false;
  veyrion_translation_request_ = base::UnguessableToken::Create().ToString();
  veyrion_translation_document_ =
      extensions::ExtensionApiFrameIdMap::GetDocumentId(frame).ToString();
  veyrion_translation_from_ = from;
  veyrion_translation_to_ = std::string(target);
  base::DictValue request;
  request.Set("tabId", sessions::SessionTabHelper::IdForTab(web_contents()).id());
  request.Set("requestId", veyrion_translation_request_);
  request.Set("documentId", veyrion_translation_document_);
  request.Set("from", from);
  request.Set("to", std::string(target));
  request.Set("action", "translate");
  base::ListValue args;
  args.Append(std::move(request));
  router->DispatchEventToExtension(kVeyrionTranslationExtension,
      std::make_unique<extensions::Event>(extensions::events::UNKNOWN,
          "braveTheme.onVeyrionTranslate", std::move(args)));
  veyrion_translation_timer_.Start(FROM_HERE, base::Seconds(120),
      base::BindOnce([](base::WeakPtr<ChromeTranslateClient> self,
                        std::string request, std::string document) {
        if (self) self->HandleVeyrionTranslationReply(request, document, "fail");
      }, weak_factory_.GetWeakPtr(), veyrion_translation_request_,
         veyrion_translation_document_));
  return true;
}

bool ChromeTranslateClient::HandleVeyrionTranslationReply(
    std::string_view request, std::string_view document, std::string_view action) {
  if (!web_contents() || !translate_manager_ || request.empty() ||
      request != veyrion_translation_request_ ||
      document != veyrion_translation_document_) return false;
  auto* frame = web_contents()->GetPrimaryMainFrame();
  if (!frame || extensions::ExtensionApiFrameIdMap::GetDocumentId(frame).ToString()
                    != document) return false;
  if (action == "check") return true;
  if (action != "finish" && action != "fail") return false;
  veyrion_translation_timer_.Stop();
  translate_manager_->PageTranslated(veyrion_translation_from_,
      veyrion_translation_to_, action == "finish" ? translate::TranslateErrors::NONE
                                  : translate::TranslateErrors::TRANSLATION_ERROR);
  if (action == "fail") {
    veyrion_translation_request_.clear();
    veyrion_translation_document_.clear();
  }
  return true;
}

bool ChromeTranslateClient::RevertLocalTranslation() {
  if (!HandleVeyrionTranslationReply(veyrion_translation_request_,
                                    veyrion_translation_document_, "check")) return false;
  auto* router = extensions::EventRouter::Get(web_contents()->GetBrowserContext());
  if (!router) return false;
  base::DictValue request;
  request.Set("tabId", sessions::SessionTabHelper::IdForTab(web_contents()).id());
  request.Set("requestId", veyrion_translation_request_);
  request.Set("documentId", veyrion_translation_document_);
  request.Set("from", veyrion_translation_from_);
  request.Set("to", veyrion_translation_to_);
  request.Set("action", "revert");
  base::ListValue args;
  args.Append(std::move(request));
  router->DispatchEventToExtension(kVeyrionTranslationExtension,
      std::make_unique<extensions::Event>(extensions::events::UNKNOWN,
          "braveTheme.onVeyrionTranslate", std::move(args)));
  veyrion_translation_timer_.Stop();
  veyrion_translation_request_.clear();
  veyrion_translation_document_.clear();
  return true;
}
