/** Accepted raw MS file extensions for import UI and validation. */
export const MZXML_EXTENSIONS = [".mzxml", ".mzml", ".xml", ".zip"] as const;

export function isMzxmlFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return MZXML_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function mzxmlAcceptAttribute(): string {
  return ".mzxml,.mzML,.mzml,.xml,.zip,application/xml,text/xml,application/zip";
}

export function csvAcceptAttribute(): string {
  return ".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain";
}

export function sampleIdFromFilename(filename: string): string {
  return filename.replace(/\.(mzxml|mzml|xml|zip)$/i, "");
}

export function buildMzxmlSamplesFromFiles(files: File[]): Array<{ filename: string; sampleId: string }> {
  return files.map((f) => ({
    filename: f.name,
    sampleId: sampleIdFromFilename(f.name),
  }));
}

export function buildMzxmlGroupMappings(samples: Array<{ filename: string; sampleId: string }>, guessGroup: (id: string) => string): Record<string, string> {
  const mappings: Record<string, string> = {};
  samples.forEach((s) => {
    mappings[s.sampleId] = guessGroup(s.sampleId);
    mappings[s.filename] = mappings[s.sampleId];
  });
  return mappings;
}
