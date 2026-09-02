export class InvalidMovementDateError extends Error {
  constructor(message = "Fecha de movimiento inválida") {
    super(message);
    this.name = "InvalidMovementDateError";
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Interpreta YYYY-MM-DD como mediodía UTC para que el día no cambie entre zonas horarias. */
export function parseMovementDate(value: unknown): Date | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    throw new InvalidMovementDateError();
  }
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new InvalidMovementDateError();
  }
  return dt;
}
