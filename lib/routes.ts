// Path normalization for nav-state comparisons.
//
// expo-router's usePathname() returns the RUNTIME url, which strips route
// groups: app/(app)/match/searching.tsx → "/match/searching". Comparisons
// against "/(app)/..." therefore never match — the root cause of tabs never
// highlighting. Every pathname comparison in the app goes through this helper
// so group segments can never leak into a comparison again (it also tolerates
// a pathname that DOES contain groups, for safety across router versions).
//
// Note: router.push()/replace() with "/(app)/..." hrefs is fine — groups are
// valid in navigation targets. The bug was only ever in comparing them
// against usePathname().

export function normalizePathname(pathname: string): string {
  const stripped = pathname.replace(/\/\([^)]*\)/g, '')
  return stripped === '' ? '/' : stripped
}
