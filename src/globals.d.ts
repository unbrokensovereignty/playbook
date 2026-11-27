/** Filled in by the build (tools/build.mjs). */
declare const __APP_VERSION__: string;
declare const __DEV__: boolean;
/** The engine's worker script (src/worker/engine.ts), as text. */
declare const __ENGINE_WORKER__: string;
/** Where the data is kept: the real app and preview builds use separate storage. */
declare const __DB_NAME__: string;

declare module '*.css';

/** The images or sounds in assets/<folder>/ as data URLs, by file name (see tools/build.mjs). */
declare module 'assets:*' {
  const files: Record<string, string>;
  export default files;
}
