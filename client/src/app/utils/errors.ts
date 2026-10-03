export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isAuthenticationError(message: string): boolean {
  return /authentication required/i.test(message);
}
