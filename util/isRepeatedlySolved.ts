export function isRepeatedlySolved(
  errors: any[],
  currentError: any,
  affectedCpConnectorId: string | number | null,
  threshold = 3
): boolean {
  const normalize = (v?: string | number | null) => String(v ?? '').trim().toUpperCase();

  const solvedErrors = errors.filter(e => {
    if (String(e.Id) === String(currentError.Id)) return false;   // skip current issue
    if (!e.SolvedAtDate) return false;                             // must be solved

    // Same OCPP ErrorCode
    if (normalize(e.ErrorCode) !== normalize(currentError.ErrorCode)) return false;

    // Same VendorCode (only if the current issue has one)
    if (
      currentError.VendorCode &&
      normalize(e.VendorCode) !== normalize(currentError.VendorCode)
    ) {
      return false;
    }

    // Same scope
    if (!affectedCpConnectorId) return !e.CpConnectorId;           // station-level
    return String(e.CpConnectorId) === String(affectedCpConnectorId);
  });

  console.log(`✓ Same error solved ${solvedErrors.length} time(s) on connector ${affectedCpConnectorId ?? '(station)'}`);
  return solvedErrors.length > threshold;
}