import {
  CommentV1alpha1Api,
  CommentV1alpha1ConsoleApi,
  type ReplyRequest,
} from "@halo-dev/api-client";
import { input } from "@inquirer/prompts";
import cac, { type CAC } from "cac";

import { tryRunCommandCliRoute, tryRunNestedCliRoute } from "../../utils/command-router.js";
import { confirmDangerousAction } from "../../utils/confirmation.js";
import { CliError } from "../../utils/errors.js";
import { isInteractive, parseNumberOption } from "../../utils/options.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { printComment, printCommentList, printReply } from "./format.js";
import { buildReplyCli, buildApprovePatch } from "./reply.js";

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
  quoteReply?: string;
  hidden?: boolean;
  allowNotification?: boolean;
}

export function buildCommentListRequest(options: CommentListOptions): {
  page?: number;
  size?: number;
  keyword?: string;
  ownerKind?: string;
  ownerName?: string;
  fieldSelector?: string[];
  sort?: string[];
} {
  return {
    page: parseNumberOption(options.page),
    size: parseNumberOption(options.size),
    keyword: options.keyword,
    ownerKind: options.ownerKind,
    ownerName: options.ownerName,
    fieldSelector: options.approved == null ? undefined : [`spec.approved=${options.approved}`],
    sort: options.sort?.trim() ? [options.sort.trim()] : undefined,
  };
}

export function buildReplyRequestPayload(
  content: string,
  options: CommentReplyCreateOptions,
): ReplyRequest {
  return {
    raw: content,
    content,
    allowNotification: options.allowNotification ?? true,
    hidden: options.hidden ?? false,
    quoteReply: options.quoteReply,
  };
}

async function resolveReplyContent(content: string | undefined): Promise<string | undefined> {
  if (content?.trim()) {
    return content;
  }

  if (!isInteractive()) {
    return undefined;
  }

  return input({
    message: "Reply content",
    validate: (value) => (value.trim().length > 0 ? true : "Reply content is required."),
  });
}

function buildCommentCli(runtime: RuntimeContext): CAC {
  const commentCli = cac("halo comment");

  commentCli
    .command("list", "List comments")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number", { default: 1 })
    .option("--size <number>", "Page size", { default: 20 })
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
      const response = await commentConsoleApi.listComments(buildCommentListRequest(options));
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

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo comment delete",
            actionLabel: "Delete",
            resourceLabel: "comment",
            resourceName: name,
            cancellationVerb: "deleting",
          },
          options,
        ))
      ) {
        return;
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
      const content = (await resolveReplyContent(options.content))?.trim();

      if (!content) {
        throw new CliError(
          "`halo comment create-reply` requires content. Use --content or run interactively.",
        );
      }

      const response = await commentConsoleApi.createReply({
        name: commentName,
        replyRequest: buildReplyRequestPayload(content, options),
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
  commentCli.example(
    (bin) =>
      `${bin} create-reply comment-abc123 --content "Thanks for your feedback" --quote-reply reply-abc123`,
  );
  commentCli.example((bin) => `${bin} reply list`);
  commentCli.example((bin) => `${bin} reply list --comment comment-abc123`);
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

  if (
    await tryRunNestedCliRoute({
      branch: "reply",
      cliName: "halo comment reply",
      args,
      buildCli: () => buildReplyCli(runtime),
    })
  ) {
    return true;
  }

  return tryRunCommandCliRoute({
    command: "comment",
    cliName: "halo comment",
    args,
    buildCli: () => buildCommentCli(runtime),
  });
}

export function registerCommentCommands(cli: CAC): void {
  cli.command("comment", "Comment management commands");
}
