/** Errors carry stable, value-redacted diagnostics; never include host callback messages. */
const phases=new Set(['parse','compile','prepare','playback','policy','integration','validation']);
const aliases={runtime:'playback',agent:'policy',checkpoint:'integration',react:'integration',surface:'integration'};
export class DirectorError extends Error {
  constructor(code, message, phase = 'playback', path = '') {
    super(message);
    this.name = 'DirectorError';
    const canonical=phases.has(phase)?phase:Object.hasOwn(aliases,phase)?aliases[phase]:'integration';
    this.diagnostic = Object.freeze({code, message, phase:canonical, path, severity:'error', recoveries:Object.freeze(['stop'])});
  }
}
export function requireValue(condition, code, message, phase, path) {
  if (!condition) throw new DirectorError(code, message, phase, path);
}
export function diagnostic(error, phase = 'playback') {
  return error instanceof DirectorError ? error.diagnostic :
    new DirectorError('HOST_FAILURE', 'A host operation failed; no host data was recorded.', phase).diagnostic;
}
