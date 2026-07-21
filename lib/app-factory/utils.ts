export function normalizeRoleKey(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}
