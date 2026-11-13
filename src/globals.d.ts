/** Filled in by the build (tools/build.mjs). */
declare const __APP_VERSION__: string;
declare const __DEV__: boolean;
/** Where the data is kept: the real app and preview builds use separate storage. */
declare const __DB_NAME__: string;

declare module '*.css';

/** The images in assets/<folder>/ as data URLs, by file name (see tools/build.mjs). */
declare module 'assets:*' {
  const files: Record<string, string>;
  export default files;
}
