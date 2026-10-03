export type Language = { code: string; name: string; nativeName: string; fontFamily: string; rtl: boolean };

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English", fontFamily: "Noto Sans", rtl: false },
  { code: "es", name: "Spanish", nativeName: "Español", fontFamily: "Noto Sans", rtl: false },
  { code: "fr", name: "French", nativeName: "Français", fontFamily: "Noto Sans", rtl: false },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", fontFamily: "Noto Sans Devanagari", rtl: false },
  { code: "mr", name: "Marathi", nativeName: "मराठी", fontFamily: "Noto Sans Devanagari", rtl: false },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", fontFamily: "Noto Sans Telugu", rtl: false },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", fontFamily: "Noto Sans Tamil", rtl: false },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", fontFamily: "Noto Sans Kannada", rtl: false },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", fontFamily: "Noto Sans Malayalam", rtl: false },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", fontFamily: "Noto Sans Bengali", rtl: false },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", fontFamily: "Noto Sans Gujarati", rtl: false },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", fontFamily: "Noto Sans Gurmukhi", rtl: false },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", fontFamily: "Noto Sans Oriya", rtl: false },
  { code: "ur", name: "Urdu", nativeName: "اردو", fontFamily: "Noto Sans Arabic", rtl: true },
  { code: "ar", name: "Arabic", nativeName: "العربية", fontFamily: "Noto Sans Arabic", rtl: true },
  { code: "zh", name: "Chinese Simplified", nativeName: "简体中文", fontFamily: "Noto Sans SC", rtl: false },
  { code: "ja", name: "Japanese", nativeName: "日本語", fontFamily: "Noto Sans JP", rtl: false },
];
