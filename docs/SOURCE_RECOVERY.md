# Source recovery

The app source, tests, documentation and public media were copied byte for byte from the YenLap `rebyte` project on 12 October 2026. Runtime environment files, private storage, application state, dependency folders and build output are excluded.

The original root package manifest, lockfile, TypeScript configuration, gitignore, example environment, Compose file and launcher were unavailable to read. Those setup files were restored from workspace manifests, README settings and the installed npm dependency lock and package versions. The original project folder was not modified.

The optional standalone `preview.html` was unavailable and is omitted; the Next.js homepage source is included.

## Validation on 12 October 2026

All 29 existing tests and the backend/domain TypeScript check passed using the existing local dependencies and Node.js 22.23.3. The web production build, including its TypeScript check, passed with `npm run build -w apps/web -- --webpack`. The default Turbopack build could not use the temporary external dependency symlink. A fresh `npm ci` was attempted but could not finish because local disk space ran out; fresh dependency installation remains unverified. Only dependency/cache files created by this task were removed.
