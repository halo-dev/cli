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
