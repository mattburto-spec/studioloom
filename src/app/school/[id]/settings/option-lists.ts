/**
 * Option lists for the school settings dropdowns — Phase 4.4 hotfix U1.
 *
 * Conservative subsets for v1: covers the 6 markets seeded in §4.1
 * (UK / AU / US / Asia non-China / Europe non-UK / MEA + China + NZ +
 * Canada) without exhaustively listing every ISO code. Add more as
 * pilot expansion lands schools outside these markets.
 *
 * IANA timezones: covering major regions. NOT exhaustive — there are
 * ~600 IANA zones; v1 ships ~30 most-relevant. Teachers in unlisted
 * zones can request via FU-AV2-SETTINGS-TIMEZONE-EXPAND.
 *
 * Locales: ISO 639-1 codes. v1 ships English-first; Mandarin (zh-CN)
 * is the obvious 2nd-locale add when next-intl bootstraps (deferred
 * via FU-AV2-PHASE-4-4D-NEXT-INTL).
 */

/** ISO 3166 alpha-2 country codes — Matt's pilot prospect markets first. */
export const COUNTRY_OPTIONS: Array<{ code: string; name: string }> = [
  // Asia (Matt's region, highest density)
  { code: "CN", name: "China" },
  { code: "HK", name: "Hong Kong" },
  { code: "SG", name: "Singapore" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "TH", name: "Thailand" },
  { code: "ID", name: "Indonesia" },
  { code: "MY", name: "Malaysia" },
  { code: "PH", name: "Philippines" },
  { code: "VN", name: "Vietnam" },
  { code: "KH", name: "Cambodia" },
  { code: "IN", name: "India" },
  // ANZ
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  // UK + Europe
  { code: "GB", name: "United Kingdom" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "AT", name: "Austria" },
  { code: "SE", name: "Sweden" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "PT", name: "Portugal" },
  { code: "IE", name: "Ireland" },
  // North America
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  // Middle East / Africa
  { code: "AE", name: "United Arab Emirates" },
  { code: "QA", name: "Qatar" },
  { code: "LB", name: "Lebanon" },
  { code: "EG", name: "Egypt" },
  { code: "ZA", name: "South Africa" },
  { code: "KE", name: "Kenya" },
  { code: "ET", name: "Ethiopia" },
  { code: "NG", name: "Nigeria" },
  // Americas south
  { code: "BR", name: "Brazil" },
];

/** IANA timezones grouped by region. Subset for v1. */
export const TIMEZONE_OPTIONS: Array<{ value: string; label: string }> = [
  // Asia
  { value: "Asia/Shanghai", label: "Asia/Shanghai (China)" },
  { value: "Asia/Hong_Kong", label: "Asia/Hong Kong" },
  { value: "Asia/Singapore", label: "Asia/Singapore" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (Japan)" },
  { value: "Asia/Seoul", label: "Asia/Seoul (Korea)" },
  { value: "Asia/Bangkok", label: "Asia/Bangkok (Thailand)" },
  { value: "Asia/Jakarta", label: "Asia/Jakarta (Indonesia)" },
  { value: "Asia/Kuala_Lumpur", label: "Asia/Kuala Lumpur (Malaysia)" },
  { value: "Asia/Manila", label: "Asia/Manila (Philippines)" },
  { value: "Asia/Ho_Chi_Minh", label: "Asia/Ho Chi Minh (Vietnam)" },
  { value: "Asia/Phnom_Penh", label: "Asia/Phnom Penh (Cambodia)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (India)" },
  // ANZ
  { value: "Australia/Sydney", label: "Australia/Sydney" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne" },
  { value: "Australia/Brisbane", label: "Australia/Brisbane" },
  { value: "Australia/Perth", label: "Australia/Perth" },
  { value: "Australia/Adelaide", label: "Australia/Adelaide" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (NZ)" },
  // Europe
  { value: "Europe/London", label: "Europe/London (UK)" },
  { value: "Europe/Dublin", label: "Europe/Dublin" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "Europe/Amsterdam", label: "Europe/Amsterdam" },
  { value: "Europe/Brussels", label: "Europe/Brussels" },
  { value: "Europe/Zurich", label: "Europe/Zurich" },
  { value: "Europe/Vienna", label: "Europe/Vienna" },
  { value: "Europe/Stockholm", label: "Europe/Stockholm" },
  { value: "Europe/Copenhagen", label: "Europe/Copenhagen" },
  { value: "Europe/Helsinki", label: "Europe/Helsinki" },
  { value: "Europe/Madrid", label: "Europe/Madrid" },
  { value: "Europe/Rome", label: "Europe/Rome" },
  // North America
  { value: "America/New_York", label: "America/New York (Eastern US)" },
  { value: "America/Chicago", label: "America/Chicago (Central US)" },
  { value: "America/Denver", label: "America/Denver (Mountain US)" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (Pacific US)" },
  { value: "America/Toronto", label: "America/Toronto" },
  { value: "America/Vancouver", label: "America/Vancouver" },
  // Middle East / Africa
  { value: "Asia/Dubai", label: "Asia/Dubai (UAE)" },
  { value: "Asia/Qatar", label: "Asia/Qatar" },
  { value: "Asia/Beirut", label: "Asia/Beirut (Lebanon)" },
  { value: "Africa/Cairo", label: "Africa/Cairo" },
  { value: "Africa/Johannesburg", label: "Africa/Johannesburg" },
  { value: "Africa/Lagos", label: "Africa/Lagos" },
  { value: "Africa/Nairobi", label: "Africa/Nairobi" },
  { value: "Africa/Addis_Ababa", label: "Africa/Addis Ababa" },
  // Americas south
  { value: "America/Sao_Paulo", label: "America/São Paulo (Brazil)" },
  // UTC fallback
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
];

/** ISO 639-1 locale codes. v1 ships English-first. */
export const LOCALE_OPTIONS: Array<{ code: string; name: string }> = [
  { code: "en", name: "English" },
  { code: "zh-CN", name: "中文 (Mandarin, Simplified)" },
  { code: "zh-TW", name: "中文 (Mandarin, Traditional)" },
  { code: "ja", name: "日本語 (Japanese)" },
  { code: "ko", name: "한국어 (Korean)" },
  { code: "es", name: "Español (Spanish)" },
  { code: "fr", name: "Français (French)" },
  { code: "de", name: "Deutsch (German)" },
  { code: "pt", name: "Português (Portuguese)" },
  { code: "it", name: "Italiano (Italian)" },
  { code: "ar", name: "العربية (Arabic)" },
];
