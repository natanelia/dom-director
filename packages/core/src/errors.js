/** Errors carry stable, value-redacted diagnostics; never include host callback messages. */
export class DirectorError extends Error {
  constructor(code, message, phase = 'runtime', path = '') {
    super(message);
    this.name = 'DirectorError';
    this.diagnostic = Object.freeze({code, message, phase, path, severity: 'error', recoveries: ['stop']});
  }
}
export function requireValue(condition, code, message, phase, path) {
  if (!condition) throw new DirectorError(code, message, phase, path);
}
export function diagnostic(error, phase = 'runtime') {
  return error instanceof DirectorError ? error.diagnostic :
    new DirectorError('HOST_FAILURE', 'A host operation failed; no host data was recorded.', phase).diagnostic;
}
