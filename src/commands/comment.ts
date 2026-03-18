import {
  CommentV1alpha1Api,
  CommentV1alpha1ConsoleApi,
  ReplyV1alpha1Api,
  ReplyV1alpha1ConsoleApi,
  type JsonPatchInner,
  type ReplyRequest,
} from "@halo-dev/api-client";
import { confirm, input } from "@inquirer/prompts";
import cac, { type CAC } from "cac";

import { CliError } from "../utils/errors.js";
import {
  printComment,
  printCommentList,
  printJson,
  printReply,
  printReplyList,
} from "../utils/format.js";
import { isInteractive, parseNumberOption } from "../utils/post-input.js";
import { RuntimeContext } from "../utils/runtime.js";

interface CommentCommandOptions {
  profile?: string;
  json?: boolean;
}

interface CommentListOptions extends CommentCommandOptions {
  page?: string;
  size?: string;
  keyword?: string;
  ownerName?: string;
  ownerKind?: string;
  approved?: string;
  sort?: string;
}

interface CommentDeleteOptions extends CommentCommandOptions {
  force?: boolean;
}

interface CommentReplyCreateOptions extends CommentCommandOptions {
  content?: string;
  contentFile?: string;
  quoteReply?: string;
  hidden?: boolean;
  allowNotification?: boolean;
}

interface ReplyListOptions extends CommentCommandOptions {
  page?: string;
  size?: string;
}

function buildApprovePatch(): JsonPatchInner[] {
  return [
    {
      op: "add",
      path: "/spec/approved",
      value: true,
    },
    {
      op: "add",
      path: "/spec/approvedTime",
      value: new Date().toISOString(),
    },
  ];
}

async function resolveReplyContent(
  content: string | undefined,
  contentFile: string | undefined,
): Promise<string | undefined> {
  if (content?.trim()) {
    return content;
  }

  if (contentFile?.trim()) {
    const { readFile } = await import("node:fs/promises");
    return readFile(contentFile.trim(), "utf8");
  }

  if (!isInteractive()) {
    return undefined;
  }

  return input({
    message: "Reply content",
    validate: (value) => (value.trim().length > 0 ? true : "Reply content is required."),
  });
}

function createReplyCli(runtime: RuntimeContext): CAC {
  const replyCli = cac("halo comment reply");

  replyCli
    .command("list <commentName>", "List replies for a comment")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number")
    .option("--size <number>", "Page size")
    .action(async (commentName: string, options: ReplyListOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const replyConsoleApi = new ReplyV1alpha1ConsoleApi(
        undefined,
        profile.baseUrl,
        clients.axios,
      );
      const response = await replyConsoleApi.listReplies({
        commentName,
        page: parseNumberOption(options.page),
        size: parseNumberOption(options.size),
      });
      printReplyList(response.data, options.json);
    });

  replyCli
    .command("get <name>", "Show reply details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: CommentCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const replyApi = new ReplyV1alpha1Api(undefined, profile.baseUrl, clients.axios);
      const response = await replyApi.getReply({ name });
      printReply(response.data, options.json);
    });

  replyCli
    .command("approve <name>", "Approve a reply")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: CommentCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const replyApi = new ReplyV1alpha1Api(undefined, profile.baseUrl, clients.axios);
      const response = await replyApi.patchReply({
        name,
        jsonPatchInner: buildApprovePatch(),
      });
      printReply(response.data, options.json);
    });

  replyCli
    .command("delete <name>", "Delete a reply")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (name: string, options: CommentDeleteOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const replyApi = new ReplyV1alpha1Api(undefined, profile.baseUrl, clients.axios);

      if (!options.force) {
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
          throw new CliError(
            "`halo comment reply delete` requires confirmation in interactive mode or use --force.",
          );
        }

        const confirmed = await confirm({
          message: `Delete reply ${name}?`,
          default: false,
        });

        if (!confirmed) {
          if (options.json) {
            printJson({ deleted: false, name, cancelled: true });
            return;
          }

          process.stdout.write(`Cancelled deleting reply ${name}.\n`);
          return;
        }
      }

      await replyApi.deleteReply({ name });

      if (options.json) {
        printJson({ deleted: true, name });
        return;
      }

      process.stdout.write(`Deleted reply ${name}.\n`);
    });

  replyCli.usage("<command> [flags]");
  replyCli.example((bin) => `${bin} list comment-abc123`);
  replyCli.example((bin) => `${bin} get reply-abc123`);
  replyCli.example((bin) => `${bin} approve reply-abc123`);
  replyCli.example((bin) => `${bin} delete reply-abc123 --force`);
  replyCli.help();

  return replyCli;
}

function createCommentCli(runtime: RuntimeContext): CAC {
  const commentCli = cac("halo comment");

  commentCli
    .command("list", "List comments")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number")
    .option("--size <number>", "Page size")
    .option("--keyword <keyword>", "Filter by keyword")
    .option("--owner-name <name>", "Filter by owner name")
    .option("--owner-kind <kind>", "Filter by owner kind")
    .option("--approved <boolean>", "Filter by approval field selector")
    .option("--sort <sort>", "Sort expression, e.g. metadata.creationTimestamp,desc")
    .action(async (options: CommentListOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const commentConsoleApi = new CommentV1alpha1ConsoleApi(
        undefined,
        profile.baseUrl,
        clients.axios,
      );
      const fieldSelector =
        options.approved == null ? undefined : [`spec.approved=${options.approved}`];
      const sort = options.sort?.trim() ? [options.sort.trim()] : undefined;
      const response = await commentConsoleApi.listComments({
        page: parseNumberOption(options.page),
        size: parseNumberOption(options.size),
        keyword: options.keyword,
        ownerKind: options.ownerKind,
        ownerName: options.ownerName,
        fieldSelector,
        sort,
      });
      printCommentList(response.data, options.json);
    });

  commentCli
    .command("get <name>", "Show comment details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: CommentCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const commentApi = new CommentV1alpha1Api(undefined, profile.baseUrl, clients.axios);
      const response = await commentApi.getComment({ name });
      printComment(response.data, options.json);
    });

  commentCli
    .command("approve <name>", "Approve a comment")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: CommentCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const commentApi = new CommentV1alpha1Api(undefined, profile.baseUrl, clients.axios);
      const response = await commentApi.patchComment({
        name,
        jsonPatchInner: buildApprovePatch(),
      });
      printComment(response.data, options.json);
    });

  commentCli
    .command("delete <name>", "Delete a comment")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (name: string, options: CommentDeleteOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const commentApi = new CommentV1alpha1Api(undefined, profile.baseUrl, clients.axios);

      if (!options.force) {
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
          throw new CliError(
            "`halo comment delete` requires confirmation in interactive mode or use --force.",
          );
        }

        const confirmed = await confirm({
          message: `Delete comment ${name}?`,
          default: false,
        });

        if (!confirmed) {
          if (options.json) {
            printJson({ deleted: false, name, cancelled: true });
            return;
          }

          process.stdout.write(`Cancelled deleting comment ${name}.\n`);
          return;
        }
      }

      await commentApi.deleteComment({ name });

      if (options.json) {
        printJson({ deleted: true, name });
        return;
      }

      process.stdout.write(`Deleted comment ${name}.\n`);
    });

  commentCli
    .command("create-reply <commentName>", "Create a reply for a comment")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--content <text>", "Reply content")
    .option("--content-file <path>", "Read reply content from file")
    .option("--quote-reply <name>", "Reply to a specific reply")
    .option("--hidden", "Create reply as hidden")
    .option("--allow-notification", "Send notification, default true")
    .action(async (commentName: string, options: CommentReplyCreateOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const commentConsoleApi = new CommentV1alpha1ConsoleApi(
        undefined,
        profile.baseUrl,
        clients.axios,
      );
      const content = (await resolveReplyContent(options.content, options.contentFile))?.trim();

      if (!content) {
        throw new CliError(
          "`halo comment create-reply` requires content. Use --content, --content-file, or run interactively.",
        );
      }

      const replyRequest: ReplyRequest = {
        raw: content,
        content,
        allowNotification: options.allowNotification ?? true,
        hidden: options.hidden ?? false,
        quoteReply: options.quoteReply,
      };

      const response = await commentConsoleApi.createReply({
        name: commentName,
        replyRequest,
      });

      printReply(response.data, options.json);
    });

  commentCli.command("reply", "Reply management commands");

  commentCli.usage("<command> [flags]");
  commentCli.example((bin) => `${bin} list --approved=false`);
  commentCli.example((bin) => `${bin} get comment-abc123`);
  commentCli.example((bin) => `${bin} approve comment-abc123`);
  commentCli.example((bin) => `${bin} delete comment-abc123 --force`);
  commentCli.example(
    (bin) => `${bin} create-reply comment-abc123 --content "Thanks for your feedback"`,
  );
  commentCli.example((bin) => `${bin} reply list comment-abc123`);
  commentCli.help();

  return commentCli;
}

export async function tryRunCommentCommand(
  args: string[],
  runtime: RuntimeContext,
): Promise<boolean> {
  if (args[0] !== "comment") {
    return false;
  }

  if (args[1] === "reply") {
    const replyCli = createReplyCli(runtime);

    if (args.length === 2) {
      replyCli.outputHelp();
      return true;
    }

    const isReplySubcommand = ["list", "get", "delete", "approve"].includes(args[2] ?? "");

    if (isReplySubcommand) {
      replyCli.parse(["node", "halo comment reply", ...args.slice(2)], { run: false });
      await replyCli.runMatchedCommand();
      return true;
    }

    if (args[2] === "--help" || args[2] === "-h") {
      replyCli.outputHelp();
      return true;
    }
  }

  const commentCli = createCommentCli(runtime);

  if (args.length === 1) {
    commentCli.outputHelp();
    return true;
  }

  commentCli.parse(["node", "halo comment", ...args.slice(1)], { run: false });
  await commentCli.runMatchedCommand();
  return true;
}

export function registerCommentCommands(cli: CAC): void {
  cli.command("comment", "Comment management commands");
}
