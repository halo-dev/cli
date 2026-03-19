export interface SinglePageMutationInput {
  name?: string;
  title?: string;
  slug?: string;
  content?: string;
  contentFile?: string;
  rawType?: string;
  excerpt?: string;
  cover?: string;
  template?: string;
  visible?: string;
  publish?: boolean;
  allowComment?: boolean;
  priority?: number;
}
