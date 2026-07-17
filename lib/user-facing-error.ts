/**
 * Gjør feil fra API/Convex lesbare for sluttbrukere — uten stack traces,
 * filstier eller [CONVEX …]-prefiks.
 */
export function formatUserFacingError(
  err: unknown,
  fallback = "Noe gikk galt. Prøv igjen.",
): string {
  // ConvexError ofte: message + data (streng eller struktur)
  let raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  if (
    err &&
    typeof err === "object" &&
    "data" in err &&
    typeof (err as { data: unknown }).data === "string"
  ) {
    const data = (err as { data: string }).data.trim();
    if (data) raw = data;
  }

  if (!raw.trim()) {
    return fallback;
  }

  const cleaned = raw
    .replace(/\[CONVEX[^\]]*]\s*/g, "")
    .replace(/\[Request ID:\s*[^\]]+]\s*/g, "")
    .replace(/\s*Called by client\.?/gi, "")
    .replace(/^Uncaught Error:\s*/i, "")
    .replace(/^Server Error\s*/i, "")
    .trim();

  const lines = cleaned
    .split("\n")
    .map((l) =>
      l
        .trim()
        .replace(/^Uncaught Error:\s*/i, "")
        .replace(/^Server Error\s*$/i, "")
        .trim(),
    )
    .filter(Boolean);

  const humanLines = lines.filter(
    (l) =>
      !/^at\s+/i.test(l) &&
      !l.includes("/convex/") &&
      !l.includes(".ts:") &&
      !l.includes("async handler") &&
      !l.includes("requireUserId") &&
      !/^server error$/i.test(l),
  );

  const substantive = humanLines.find(
    (l) => l.length >= 8 && !/^server error$/i.test(l),
  );
  const candidate = substantive ?? humanLines[0] ?? lines[0] ?? "";

  if (!candidate) {
    return fallback;
  }

  if (
    candidate.length > 240 ||
    candidate.includes("../") ||
    /Uncaught Error/i.test(candidate)
  ) {
    return fallback;
  }

  const map: Record<string, string> = {
    "Du må være innlogget.": "Du må være innlogget. Prøv å logge inn på nytt.",
    "Invalid password": "Feil e-post eller passord.",
    "InvalidPassword": "Feil e-post eller passord.",
    "Invalid credentials": "Feil e-post eller passord.",
    "InvalidCredentials": "Feil e-post eller passord.",
    "InvalidAccountId": "Fant ingen konto med denne e-posten. Sjekk adressen, eller opprett en ny konto.",
    "InvalidSecret": "Feil e-post eller passord.",
    "Invalid code": "Ugyldig eller utløpt kode. Be om ny kode og prøv igjen.",
    "Could not verify code": "Ugyldig eller utløpt kode. Be om ny kode og prøv igjen.",
    "AccountAlreadyExists": "Det finnes allerede en konto med denne e-posten. Prøv å logge inn i stedet.",
    "TooManyRequests": "For mange forsøk. Vent litt og prøv igjen.",
    "PasswordTooShort": "Passordet må være minst 8 tegn.",
    "Password reset is not enabled for password":
      "Tilbakestilling av passord er ikke aktivert.",
  };

  const normalized = candidate.replace(/\s+/g, " ").trim();
  if (map[normalized]) {
    return map[normalized];
  }

  // CamelCase / kode uten mellomrom (f.eks. InvalidAccountId)
  const codeKey = normalized.replace(/[^A-Za-z]/g, "");
  if (map[codeKey]) {
    return map[codeKey];
  }

  for (const [k, v] of Object.entries(map)) {
    if (normalized.toLowerCase().includes(k.toLowerCase())) {
      return v;
    }
  }

  const lower = normalized.toLowerCase();
  if (
    lower.includes("invalidaccountid") ||
    lower.includes("could not find") ||
    lower.includes("user not found") ||
    lower.includes("no account")
  ) {
    return "Fant ingen konto med denne e-posten. Sjekk adressen, eller opprett en ny konto.";
  }
  if (
    lower.includes("invalidsecret") ||
    lower.includes("invalid password") ||
    lower.includes("wrong password") ||
    lower.includes("incorrect password")
  ) {
    return "Feil e-post eller passord.";
  }
  if (
    lower.includes("already exists") ||
    lower.includes("already registered") ||
    lower.includes("accountalreadyexists")
  ) {
    return "Det finnes allerede en konto med denne e-posten. Prøv å logge inn i stedet.";
  }
  if (
    lower.includes("invalid code") ||
    lower.includes("could not verify code") ||
    lower.includes("ugyldig eller utløpt")
  ) {
    return "Ugyldig eller utløpt kode. Be om ny kode og prøv igjen.";
  }
  if (
    lower.includes("resend_api_key") ||
    lower.includes("auth_resend_key") ||
    lower.includes("e-post for passordreset er ikke konfigurert")
  ) {
    return "E-post for passordreset er ikke konfigurert. Sett RESEND_API_KEY i Convex-miljøet.";
  }
  if (
    lower.includes("kunne ikke sende e-post") ||
    lower.includes("could not send")
  ) {
    return "Kunne ikke sende e-post. Prøv igjen senere.";
  }
  if (
    lower.includes("connection lost") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror when fetching") ||
    lower.includes("load failed")
  ) {
    return "Mistet forbindelsen til serveren. Sjekk nettet og prøv igjen.";
  }

  // Tekniske kode-lignende strenger → fallback
  if (/^[A-Z][A-Za-z0-9]+$/.test(normalized) && normalized.length < 48) {
    return fallback;
  }

  return normalized;
}
