import ora, { type Ora } from "ora";

import { printJson } from "./output.js";

export interface BatchUpgradeResult {
  cancelled?: boolean;
  upgraded: Array<{ name: string; fromVersion?: string; toVersion: string }>;
  skipped: Array<{
    name: string;
    fromVersion?: string;
    toVersion: string;
    reason: string;
  }>;
  failed: Array<{ name: string; error: string }>;
}

export interface BatchUpgradeProgressEvent {
  type:
    | "checking"
    | "discovering"
    | "resolving"
    | "selecting"
    | "queued"
    | "upgrading"
    | "upgraded"
    | "skipped"
    | "failed";
  name?: string;
  fromVersion?: string;
  toVersion?: string;
  reason?: string;
  error?: string;
  count?: number;
}

export class SpinnerReporter {
  private spinner: Ora | undefined;
  private readonly enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  start(text: string): void {
    if (!this.enabled) {
      process.stdout.write(`${text}\n`);
      return;
    }

    this.spinner = ora(text).start();
  }

  update(text: string): void {
    if (!this.enabled) {
      process.stdout.write(`${text}\n`);
      return;
    }

    if (!this.spinner) {
      this.spinner = ora(text).start();
      return;
    }

    this.spinner.text = text;
  }

  succeed(text: string): void {
    if (!this.enabled) {
      process.stdout.write(`${text}\n`);
      return;
    }

    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = undefined;
      return;
    }

    ora().succeed(text);
  }

  fail(text: string): void {
    if (!this.enabled) {
      process.stdout.write(`${text}\n`);
      return;
    }

    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = undefined;
      return;
    }

    ora().fail(text);
  }

  info(text: string): void {
    if (!this.enabled) {
      process.stdout.write(`${text}\n`);
      return;
    }

    if (this.spinner) {
      this.spinner.info(text);
      this.spinner = undefined;
      return;
    }

    ora().info(text);
  }

  stop(): void {
    this.spinner?.stop();
    this.spinner = undefined;
  }
}

export function createSpinnerReporter(json = false): SpinnerReporter {
  return new SpinnerReporter(process.stdout.isTTY && !json);
}

export function reportBatchUpgradeProgress(
  spinner: SpinnerReporter,
  event: BatchUpgradeProgressEvent,
  resourceLabel: string,
): void {
  if (event.type === "checking") {
    spinner.start(`Loading installed ${resourceLabel}s...`);
    return;
  }

  if (event.type === "discovering") {
    spinner.update(
      `Checking App Store metadata for ${event.count ?? 0} installed ${resourceLabel}(s)...`,
    );
    return;
  }

  if (event.type === "resolving") {
    spinner.update(`Resolved ${event.count ?? 0} ${resourceLabel} update candidate(s).`);
    return;
  }

  if (event.type === "selecting") {
    spinner.stop();
    process.stdout.write(`Select ${resourceLabel}s to upgrade (${event.count ?? 0} available):\n`);
    return;
  }

  if (event.type === "queued") {
    spinner.info(`Selected ${event.count ?? 0} ${resourceLabel}(s) for upgrade.`);
    return;
  }

  if (event.type === "upgrading") {
    spinner.start(
      `Upgrading ${resourceLabel} ${event.name}: ${event.fromVersion ?? "unknown"} -> ${event.toVersion ?? "unknown"}...`,
    );
    return;
  }

  if (event.type === "upgraded") {
    spinner.succeed(
      `Upgraded ${resourceLabel} ${event.name}: ${event.fromVersion ?? "unknown"} -> ${event.toVersion ?? "unknown"}.`,
    );
    return;
  }

  if (event.type === "skipped") {
    spinner.info(
      `Skipped ${resourceLabel} ${event.name}: ${event.fromVersion ?? "unknown"} -> ${event.toVersion ?? "unknown"} (${event.reason}).`,
    );
    return;
  }

  if (event.type === "failed") {
    spinner.fail(
      `Failed ${resourceLabel} ${event.name}: ${event.error ?? "Unknown upgrade error."}`,
    );
  }
}

export function printBatchUpgradeResult(
  result: BatchUpgradeResult,
  json = false,
  resourceLabel = "plugin",
): void {
  if (result.cancelled) {
    if (!json) {
      process.stdout.write(`Cancelled upgrading App Store ${resourceLabel}s.\n`);
    }
    return;
  }

  if (json) {
    printJson(result);
    return;
  }

  if (result.upgraded.length === 0 && result.skipped.length === 0 && result.failed.length === 0) {
    process.stdout.write(`No App Store ${resourceLabel} updates available.\n`);
    return;
  }

  process.stdout.write(
    `\nSummary: ${result.upgraded.length} upgraded, ${result.skipped.length} skipped, ${result.failed.length} failed.\n`,
  );
}
