export function isPlatformAdmin(email: string | null | undefined, appMetadata?: Record<string, unknown>) {
  void email;
  return appMetadata?.pomebrain_role === "admin";
}
