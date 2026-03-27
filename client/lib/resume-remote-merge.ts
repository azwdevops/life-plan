import type { NamedResumeDocument, ResumeBuilderState } from "@/lib/resume-builder-storage";

/** Server list wins for matching ids; local-only documents are appended. */
export function mergeRemoteAndLocal(
  remote: NamedResumeDocument[],
  local: ResumeBuilderState
): ResumeBuilderState {
  if (remote.length === 0) return local;
  const remoteIds = new Set(remote.map((d) => d.id));
  const localOnly = local.documents.filter((d) => !remoteIds.has(d.id));
  const documents = [...remote, ...localOnly];
  let activeDocumentId = local.activeDocumentId;
  if (!documents.some((d) => d.id === activeDocumentId)) {
    activeDocumentId = documents[0].id;
  }
  return {
    ...local,
    documents,
    activeDocumentId,
  };
}
