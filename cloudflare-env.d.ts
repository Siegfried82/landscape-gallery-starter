declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ASSETS?: Fetcher;
    ADMIN_PASSWORD?: string;
    SESSION_SECRET?: string;
  }
}
