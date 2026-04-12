/**
 * Clinical Document Slash Command Controller
 *
 * Detects slash commands typed in the rich text editor and resolves
 * them to text insertions. Pure logic — no React or DOM dependencies.
 *
 * Currently supported commands:
 * - `/lab` — Inserts the most recent lab results summary
 *
 * Detection requires the command followed by at least one whitespace
 * character at the end of the text content (e.g., "/lab " or "/lab\n").
 */

/** Pattern: "/lab" followed by one or more whitespace chars at end of text. */
const SLASH_LAB_DETECT = /\/lab\s+$/;

/** Pattern: "/lab" followed by optional trailing whitespace (for HTML removal). */
const SLASH_LAB_REMOVE = /\/lab\s*/;

/**
 * Checks if the editor's text content ends with a recognized slash command.
 *
 * @param textContent - Plain text content of the editor (not HTML)
 * @returns The command name or null if no match
 */
export const detectSlashCommand = (textContent: string): 'lab' | null => {
  if (SLASH_LAB_DETECT.test(textContent)) {
    return 'lab';
  }
  return null;
};

/**
 * Removes the slash command text from the editor's innerHTML.
 *
 * @param innerHTML - Raw HTML content of the editor
 * @returns HTML with the slash command removed
 */
export const removeSlashCommandFromHtml = (innerHTML: string): string =>
  innerHTML.replace(SLASH_LAB_REMOVE, '');
