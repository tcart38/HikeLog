import pkg from "@/package.json"

/** Single source of truth: the "version" field in package.json (semantic versioning, pre-1.0 while in development). */
export const APP_VERSION: string = pkg.version
