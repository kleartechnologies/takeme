/** Remove internal workflow labels only from the published paragraph projection.
 * Reviewed source text and prepublication review copy remain unchanged.
 */
export function publicLegalParagraph(text: string, published: boolean): string {
  if (!published) return text;
  return text
    // Preserve the English inline caution as a grammatical public sentence.
    .replace(/remain LEGAL REVIEW REQUIRED\b/gi, "remain subject to applicable law")
    // BM's inline label follows the reconciliation caveat, before a semicolon.
    .replace(/\s+[—–]\s*SEMAKAN UNDANG-UNDANG DIPERLUKAN(?=[;.,])/gi, "")
    .replace(/(?:LEGAL REVIEW REQUIRED|COUNSEL REVIEW REQUIRED|SEMAKAN UNDANG-UNDANG DIPERLUKAN)\s*(?:[—–:]\s*)?/gi, "");
}
