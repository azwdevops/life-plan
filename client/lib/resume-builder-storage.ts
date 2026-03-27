export const RESUME_BUILDER_V1_KEY = "lifeplan_resume_builder_v1";
export const RESUME_BUILDER_STORAGE_KEY = "lifeplan_resume_builder_v2";

/** Session flag so /resumes/new creates one document under React Strict Mode. Cleared on resumes list. */
export const NEW_RESUME_SESSION_KEY = "lifeplan_resume_new_redirect";

export type EducationEntry = {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  detailsHtml: string;
};

export type WorkExperienceEntry = {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  descriptionHtml: string;
};

export type ResumeData = {
  fullName: string;
  headline: string;
  contactHtml: string;
  summaryHtml: string;
  education: EducationEntry[];
  workExperience: WorkExperienceEntry[];
  skillsHtml: string;
  certificationsHtml: string;
  projectsHtml: string;
  additionalHtml: string;
};

export type CoverLetterData = {
  dateLine: string;
  recipientHtml: string;
  subject: string;
  bodyHtml: string;
  closingHtml: string;
};

/** One resume + cover letter pair with a display name */
export type NamedResumeDocument = {
  id: string;
  name: string;
  resume: ResumeData;
  coverLetter: CoverLetterData;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
};

export type ResumeBuilderState = {
  documents: NamedResumeDocument[];
  activeDocumentId: string;
  activeDoc: "resume" | "coverLetter";
};

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const defaultEducationEntry = (): EducationEntry => ({
  id: newId(),
  institution: "",
  degree: "",
  field: "",
  startDate: "",
  endDate: "",
  detailsHtml: "",
});

export const defaultWorkEntry = (): WorkExperienceEntry => ({
  id: newId(),
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  descriptionHtml: "",
});

export const defaultResumeData = (): ResumeData => ({
  fullName: "",
  headline: "",
  contactHtml: "",
  summaryHtml: "",
  education: [defaultEducationEntry()],
  workExperience: [defaultWorkEntry()],
  skillsHtml: "",
  certificationsHtml: "",
  projectsHtml: "",
  additionalHtml: "",
});

export const defaultCoverLetterData = (): CoverLetterData => ({
  dateLine: "",
  recipientHtml: "",
  subject: "",
  bodyHtml: "",
  closingHtml: "<p>Best regards,</p><p><br></p>",
});

export function defaultNamedDocument(name = "Untitled resume"): NamedResumeDocument {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name,
    resume: defaultResumeData(),
    coverLetter: defaultCoverLetterData(),
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultResumeBuilderState(): ResumeBuilderState {
  const doc = defaultNamedDocument();
  return {
    documents: [doc],
    activeDocumentId: doc.id,
    activeDoc: "resume",
  };
}

function normalizeResumeData(raw: Partial<ResumeData> | undefined): ResumeData {
  const base = defaultResumeData();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    education:
      Array.isArray(raw.education) && raw.education.length > 0
        ? raw.education.map((e) => ({
            ...defaultEducationEntry(),
            ...e,
            id: e.id || newId(),
          }))
        : base.education,
    workExperience:
      Array.isArray(raw.workExperience) && raw.workExperience.length > 0
        ? raw.workExperience.map((w) => ({
            ...defaultWorkEntry(),
            ...w,
            id: w.id || newId(),
          }))
        : base.workExperience,
  };
}

function normalizeCoverLetter(
  raw: Partial<CoverLetterData> | undefined
): CoverLetterData {
  return {
    ...defaultCoverLetterData(),
    ...raw,
  };
}

/** Deep copy with fresh IDs on list items (for duplicate). */
export function duplicateNamedDocument(doc: NamedResumeDocument): NamedResumeDocument {
  const now = new Date().toISOString();
  const resume = JSON.parse(JSON.stringify(doc.resume)) as ResumeData;
  resume.education = resume.education.map((e) => ({ ...e, id: newId() }));
  resume.workExperience = resume.workExperience.map((w) => ({ ...w, id: newId() }));
  const baseName = doc.name.trim();
  return {
    id: newId(),
    name: baseName ? `Copy of ${baseName}` : "Copy of Untitled resume",
    resume,
    coverLetter: { ...doc.coverLetter },
    createdAt: now,
    updatedAt: now,
  };
}

type LegacyV1State = {
  resume?: Partial<ResumeData>;
  coverLetter?: Partial<CoverLetterData>;
  activeDoc?: string;
};

function migrateFromV1(parsed: LegacyV1State): ResumeBuilderState {
  const doc = defaultNamedDocument("My resume");
  return {
    documents: [
      {
        ...doc,
        resume: normalizeResumeData(parsed.resume),
        coverLetter: normalizeCoverLetter(parsed.coverLetter),
      },
    ],
    activeDocumentId: doc.id,
    activeDoc: parsed.activeDoc === "coverLetter" ? "coverLetter" : "resume",
  };
}

function parseV2(raw: string): ResumeBuilderState {
  const parsed = JSON.parse(raw) as Partial<ResumeBuilderState>;
  const fallback = defaultResumeBuilderState();
  if (!Array.isArray(parsed.documents) || parsed.documents.length === 0) {
    return fallback;
  }
  const migrationStamp = new Date().toISOString();
  let needsTimestampPersist = false;
  const documents: NamedResumeDocument[] = parsed.documents.map((d, i) => {
    const id = typeof d.id === "string" ? d.id : newId();
    const name =
      typeof d.name === "string" && d.name.trim() ? d.name : `Resume ${i + 1}`;
    const rawDoc = d as Partial<NamedResumeDocument>;
    const hasCreated = typeof rawDoc.createdAt === "string";
    const hasUpdated = typeof rawDoc.updatedAt === "string";
    if (!hasCreated || !hasUpdated) {
      needsTimestampPersist = true;
    }
    const createdAt = hasCreated
      ? rawDoc.createdAt!
      : hasUpdated
        ? rawDoc.updatedAt!
        : migrationStamp;
    const updatedAt = hasUpdated ? rawDoc.updatedAt! : createdAt;
    return {
      id,
      name,
      resume: normalizeResumeData(d.resume),
      coverLetter: normalizeCoverLetter(d.coverLetter),
      createdAt,
      updatedAt,
    };
  });
  let activeDocumentId =
    typeof parsed.activeDocumentId === "string"
      ? parsed.activeDocumentId
      : documents[0].id;
  if (!documents.some((d) => d.id === activeDocumentId)) {
    activeDocumentId = documents[0].id;
  }
  const state: ResumeBuilderState = {
    documents,
    activeDocumentId,
    activeDoc: parsed.activeDoc === "coverLetter" ? "coverLetter" : "resume",
  };
  if (needsTimestampPersist && typeof window !== "undefined") {
    saveResumeBuilderState(state);
  }
  return state;
}

export function loadResumeBuilderState(): ResumeBuilderState {
  if (typeof window === "undefined") return defaultResumeBuilderState();
  try {
    const v2 = window.localStorage.getItem(RESUME_BUILDER_STORAGE_KEY);
    if (v2) return parseV2(v2);

    const v1 = window.localStorage.getItem(RESUME_BUILDER_V1_KEY);
    if (v1) return migrateFromV1(JSON.parse(v1) as LegacyV1State);
  } catch {
    /* ignore */
  }
  return defaultResumeBuilderState();
}

export function saveResumeBuilderState(state: ResumeBuilderState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RESUME_BUILDER_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch {
    /* quota or private mode */
  }
}
