export type Bindings = {
  CWD_DB: D1Database
  CWD_AUTH_KV: KVNamespace;
  WALLPAPER_BUCKET: R2Bucket;
  MYBLOG_BUCKET: R2Bucket;
  ALLOW_ORIGIN: string
  MAIL_GATEWAY_URL?: string
  MAIL_GATEWAY_TOKEN?: string
  ADMIN_NAME: string
  ADMIN_PASSWORD: string
  LANZOU_COOKIE?: string
  LANZOU_UID?: string
  DEFAULT_FOLDER_ID?: string
  GITHUB_TOKEN?: string
  BLOG_REPO?: string
  WECHAT_APP_ID?: string
  WECHAT_APP_SECRET?: string
}
