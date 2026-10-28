// Bindings of the Pages project (wrangler.toml + dashboard secrets; .dev.vars locally).
export type Env = {
  YOUTUBE_API_KEY: string;
  SIMULATE_QUOTA?: string;
  CACHE?: KVNamespace;
};
