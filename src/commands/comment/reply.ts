import {
  ReplyV1alpha1Api,
  ReplyV1alpha1ConsoleApi,
  type JsonPatchInner,
} from "@halo-dev/api-client";
import cac, { type CAC } from "cac";

import { confirmDangerousAction } from "../../utils/confirmation.js";
import { parseNumberOption } from "../../utils/options.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { printReply, printReplyList } from "./format.js";

interface CommentCommandOptions {
  profile?: string;
  json?: boolean;
}

interface CommentDeleteOptions extends CommentCommandOptions {
  force?: boolean;
}

interface ReplyListOptions extends CommentCommandOptions {
  page?: string;
  size?: string;
}

export function buildApprovePatch(): JsonPatchInner[] {
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

export function buildReplyCli(runtime: RuntimeContext): CAC {
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

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo comment reply delete",
            actionLabel: "Delete",
            resourceLabel: "reply",
            resourceName: name,
            cancellationVerb: "deleting",
          },
          options,
        ))
      ) {
        return;
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
