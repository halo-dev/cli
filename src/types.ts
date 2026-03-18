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