/**
 * Project Service Facade
 * Decomposed into specialized modules under ./project/
 * - projectCrud.ts: Project indexing, path resolution, read/write & deletion
 * - projectExportZip.ts: Full project zip bundling & staged workflows injection
 * - projectTakesService.ts: Takes indexing, summary calculation & takes zip export
 * - projectImportZip.ts: Project zip decompression, migration & scene extraction
 */

export * from "./project";
