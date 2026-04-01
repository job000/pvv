/** Initialer for avatar når det ikke finnes profilbilde. */
export function userProfileInitials(
  firstName: string | undefined,
  lastName: string | undefined,
  displayName: string | undefined,
  email: string | undefined,
): string {
  const f = firstName?.trim();
  const l = lastName?.trim();
  if (f && l) {
    return (f[0] + l[0]).toUpperCase();
  }
  if (f) {
    return f.slice(0, 2).toUpperCase();
  }
  const n = displayName?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (
        parts[0]![0] + parts[parts.length - 1]![0]
      ).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email[0]!.toUpperCase();
  }
  return "?";
}
