# 山川之间 · 摄影网站模板

可自行部署的摄影作品集，使用 Cloudflare Workers、D1 和 R2。包含照片网格、高清大图预加载、缩放/放大镜、下载、EXIF 展示，以及独立的管理后台 `/manage`。

本仓库仅提供网站代码和空数据库迁移，不包含作者的照片、账号凭据、线上数据库、资源绑定或原仓库历史。部署后需要上传自己的照片。

## 1. 准备环境

- Node.js 22.13 或更新版本（推荐 Node.js 24）
- pnpm 11.25.0
- Cloudflare 账号，并启用 Workers、D1 和 R2

```sh
git clone https://github.com/lixiuqi82-art/landscape-gallery-starter.git
cd landscape-gallery-starter
pnpm install --frozen-lockfile
```

## 2. 本地体验

复制 `.dev.vars.example` 为 `.dev.vars`，设置自己的 `ADMIN_PASSWORD` 和至少 32 字符的随机 `SESSION_SECRET`。例如，用以下命令生成随机密钥：

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
pnpm run db:migrate:local
pnpm run dev
```

打开终端显示的地址（默认 `http://localhost:5174`），访问 `/manage` 登录并上传照片。本地数据库和图片保存在 `.wrangler/state`，与线上资源分开。

## 3. 部署自己的网站

登录并创建你自己的资源：

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create gallery-db
pnpm exec wrangler r2 bucket create gallery-photos
```

编辑 `wrangler.jsonc`：

- `name`：你的 Worker 名称。
- `database_id`：替换为刚创建 D1 时返回的 ID；全零值只是本地开发占位符。
- 如果更改数据库或存储桶名称，同步修改 `database_name` 和 `bucket_name`。
- 保留绑定名称 `DB`、`BUCKET` 和 `ASSETS`，代码依赖这些名称。

然后执行：

```sh
pnpm run db:migrate:remote
pnpm exec wrangler secret put ADMIN_PASSWORD --config wrangler.jsonc
pnpm exec wrangler secret put SESSION_SECRET --config wrangler.jsonc
pnpm run deploy
```

两次 `secret put` 会分别提示输入后台密码和随机会话密钥。`.dev.vars` 仅用于本地，线上密钥需要单独设置。部署结束后终端会输出你的 `workers.dev` 网址。用该网址的 `/manage` 上传自己的照片。

R2 存储桶不需要开启公开访问。照片由 Worker 提供。Cloudflare 的额度、计费和可用性以你的账号及官方说明为准。

## 4. 修改外观和检查代码

- 网站标题和页面信息：`app/layout.tsx`
- 首页页头：`addons/components/GalleryHeader.tsx`
- 相册交互：`app/gallery.tsx`
- 样式：`app/globals.css`
- 数据结构：`db/schema.ts`；新增迁移请运行 `pnpm run db:generate`。

```sh
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

后台包含服务器端会话验证、登出撤销、登录尝试限制和写入来源校验。公开高清展示意味着访客可以保存所展示的图片；这不是防盗图或 DRM 方案。原图预加载和图片流处理已包含在模板中。

## 许可

代码采用 MIT 许可证，允许复制、修改和自行部署；保留许可证声明。依赖包遵循各自许可证。上传照片的版权和授权由使用者负责。

## 官方参考

- [Workers 配置](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [D1 命令](https://developers.cloudflare.com/d1/wrangler-commands/)
- [R2 命令](https://developers.cloudflare.com/r2/reference/wrangler-commands/)

## English

A self-hosted photography gallery with high-resolution preloading, image zoom, EXIF display, downloads and an authenticated admin page. Install dependencies with pnpm, create your own Cloudflare D1 database and R2 bucket, replace the placeholder bindings in `wrangler.jsonc`, apply migrations, set `ADMIN_PASSWORD` and `SESSION_SECRET`, then run `pnpm run deploy`. This repository contains no personal photos, production data or credentials. MIT licensed.
