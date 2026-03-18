export type AuthType = "basic" | "bearer";

export interface BasicCredentials {
  type: "basic";
  username: string;
  password: string;
}

export interface BearerCredentials {
  type: "bearer";
  token: string;
}

export type HaloCredentials = BasicCredentials | BearerCredentials;

export interface HaloProfile {
  name: string;
  baseUrl: string;
  auth: HaloCredentials;
  createdAt: string;
  updatedAt: string;
}

export interface HaloConfig {
  activeProfile?: string;
  profiles: Record<string, HaloProfile>;
}

export interface CommandOptions {
  json?: boolean;
  profile?: string;
}

export interface PostMutationInput {
  name?: string;
  title?: string;
  slug?: string;
  content?: string;
  contentFile?: string;
  rawType?: string;
  excerpt?: string;
  categories?: string[];
  tags?: string[];
  cover?: string;
  template?: string;
  visible?: string;
  publish?: boolean;
  pinned?: boolean;
  allowComment?: boolean;
  priority?: number;
}

export type MomentVisible = "PUBLIC" | "PRIVATE";

export interface MomentMetadata {
  name: string;
  generateName?: string;
  creationTimestamp?: string;
  deletionTimestamp?: string;
  annotations?: Record<string, string>;
  [key: string]: unknown;
}

export interface MomentContent {
  raw: string;
  html: string;
  medium?: unknown[];
}

export interface MomentSpec {
  content: MomentContent;
  releaseTime?: string;
  owner?: string;
  visible?: MomentVisible;
  tags?: string[];
  approved?: boolean;
  approvedTime?: string;
  [key: string]: unknown;
}

export interface Moment {
  apiVersion: string;
  kind: string;
  metadata: MomentMetadata;
  spec: MomentSpec;
  status?: Record<string, unknown>;
}

export interface ListedMoment {
  moment: Moment;
  owner?: Record<string, unknown>;
  stats?: Record<string, unknown>;
}

export interface ListedMomentList {
  items: ListedMoment[];
  total: number;
  page?: number;
  size?: number;
  last?: boolean;
  totalPages?: number;
  [key: string]: unknown;
}
