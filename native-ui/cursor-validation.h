#ifndef VEYRION_CURSOR_VALIDATION_H_
#define VEYRION_CURSOR_VALIDATION_H_
#include <string_view>
#include <cstdint>

// Check dimensions before decoding to bound allocations from uploaded images.
inline bool VeyrionValidCursorPng(std::string_view data) {
  if (data.size() < 33 || data.size() > 100000 ||
      data.substr(0, 8) != std::string_view("\x89PNG\r\n\x1a\n", 8) ||
      data.substr(12, 4) != "IHDR") return false;
  auto dimension = [&](size_t offset) {
    uint32_t value = 0;
    for (size_t i = offset; i < offset + 4; ++i)
      value = (value << 8) | static_cast<unsigned char>(data[i]);
    return value;
  };
  const auto width = dimension(16), height = dimension(20);
  return width > 0 && width <= 128 && height > 0 && height <= 128;
}
#endif
