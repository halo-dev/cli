export {
  getBrowserOpenCommand,
  openUrlInBrowser,
  type BrowserOpenCommand,
} from "../../utils/browser.js";

import { resolvePermalinkUrl } from "../../utils/browser.js";

export function resolveSinglePageOpenUrl(baseUrl: string, permalink: string): string {
  return resolvePermalinkUrl(baseUrl, permalink, "Single page");
}
