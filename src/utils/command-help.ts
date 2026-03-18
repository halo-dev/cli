interface CommandHelpSection {
  title: string;
  commands: Array<{ name: string; description: string }>;
}

interface CommandHelpOptions {
  summary: string;
  usage: string;
  sections: CommandHelpSection[];
  flags?: Array<{ name: string; description: string }>;
  examples?: string[];
  learnMore?: string[];
}

function writeSectionTitle(title: string): void {
  process.stdout.write(`${title}\n`);
}

function writeLine(line = ""): void {
  process.stdout.write(`${line}\n`);
}

function padCommandName(name: string, width: number): string {
  return name.padEnd(width, " ");
}

export function printCommandHelp(options: CommandHelpOptions): void {
  writeLine(options.summary);
  writeLine();

  writeSectionTitle("USAGE");
  writeLine(`  ${options.usage}`);
  writeLine();

  for (const section of options.sections) {
    writeSectionTitle(section.title);
    const width = Math.max(...section.commands.map((command) => command.name.length), 0) + 2;

    for (const command of section.commands) {
      writeLine(`  ${padCommandName(`${command.name}:`, width + 1)}${command.description}`);
    }

    writeLine();
  }

  if (options.flags?.length) {
    writeSectionTitle("FLAGS");
    const width = Math.max(...options.flags.map((flag) => flag.name.length), 0) + 2;

    for (const flag of options.flags) {
      writeLine(`  ${padCommandName(flag.name, width)}${flag.description}`);
    }

    writeLine();
  }

  writeSectionTitle("INHERITED FLAGS");
  writeLine("  --help   Show help for command");
  writeLine();

  if (options.examples?.length) {
    writeSectionTitle("EXAMPLES");
    for (const example of options.examples) {
      writeLine(`  $ ${example}`);
    }
    writeLine();
  }

  if (options.learnMore?.length) {
    writeSectionTitle("LEARN MORE");
    for (const item of options.learnMore) {
      writeLine(`  ${item}`);
    }
  }
}