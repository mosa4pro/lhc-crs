// Shared helpers for the student notes log.
//
// The student's `notes` field may hold either legacy plain text or a JSON
// array of log entries. Each entry is:
//   { content, authorName, authorJobTitle, createdAt }
// The author fields are captured server-side from the authenticated user.

export interface StudentNoteEntry {
  content: string;
  authorName: string | null;
  authorJobTitle: string | null;
  createdAt: string | null;
}

export const parseStudentNotes = (notes: string | null | undefined): StudentNoteEntry[] => {
  if (!notes) return [];
  try {
    const parsed = JSON.parse(notes);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* legacy plain text below */ }
  return [{ content: String(notes), authorName: null, authorJobTitle: null, createdAt: null }];
};

export const notesPlain = (notes: string | null | undefined) => parseStudentNotes(notes).map(n => n.content).join('\n');
