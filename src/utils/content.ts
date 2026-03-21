import MarkdownIt from "markdown-it";

export const DEFAULT_CONTENT_RAW_TYPE = "markdown";

const markdownIt = new MarkdownIt({
  html: true,
  xhtmlOut: true,
  breaks: true,
  linkify: true,
  typographer: true,
});

export function normalizeContentRawType(rawType?: string): string {
  const normalized = rawType?.trim();
  return normalized && normalized.length > 0 ? normalized : DEFAULT_CONTENT_RAW_TYPE;
}

export function renderContentByRawType(raw: string, rawType?: string): string {
  const normalizedRawType = normalizeContentRawType(rawType);

  if (normalizedRawType.toLowerCase() === DEFAULT_CONTENT_RAW_TYPE) {
    return markdownIt.render(raw);
  }

  return raw;
}
