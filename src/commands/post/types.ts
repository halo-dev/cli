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
