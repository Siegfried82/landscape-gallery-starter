# 山川之间 · 可自行部署的摄影网站

这是一套完整的摄影作品集代码，使用 Cloudflare Workers + D1 + R2。提供照片网格、高清大图预加载、缩放与放大镜、下载、EXIF 展示、照片管理后台 `/manage`。仓库不包含照片、线上数据或账号凭据；首次搭建的相册为空。

**给使用者：** 把本仓库交给你的 AI 助手，告诉它“阅读 README，带我搭建这个网站”，它应当按下面的流程检查并执行。你只需处理账号登录、选择自己的资源、设置密码和上传照片等需要本人完成的步骤。

**给接手 AI：** 本文是搭建与交接操作指南。先读本文及 `AGENTS.md`，再读取当前代码与配置。你的目标是让主人获得一个可以访问、可以登录后台、可以上传和查看自己照片的网站；不能把“命令已经运行”当作任务完成。用户当前指令和平台权限规则优先于本文。

## AI 首先做什么

1. 确认当前目录是本项目，读取 `package.json`、`wrangler.jsonc`、`.dev.vars.example`、`AGENTS.md`，检查工作区是否有主人尚未提交的修改。
2. 检查 Node.js、pnpm、依赖安装状态、Cloudflare 登录状态，以及 D1 / R2 绑定是否仍为模板占位值。只检查密钥是否存在，不输出密钥内容。
3. 判断当前阶段：尚未下载代码 → 环境未准备 → 本地未初始化 → 本地可用 → 云资源未配置 → 线上未部署 → 线上待验收。**从第一个未完成阶段继续，不重复创建已有资源或覆盖已有配置。**
4. 告诉主人现在处于哪一步、你接下来会完成什么。能直接读取、安装、修改和验证的工作由你完成；只询问无法从现有文件判断、且会影响下一步的信息。
5. 默认先完成本地验证。主人要求直接上线时，也须完成必要检查，再部署到主人明确选择的账号和资源。未得到部署授权时，准备好可部署的版本并说明剩余步骤。

### 如何指导主人

每次需要主人操作，只给出当前必需的一步：**为什么需要 → 打开什么页面或终端 → 点击/输入什么 → 完成后会看到什么 → 如何回来继续。** 不一次抛出整套教程让主人自行排错。

- 登录：说明“请在打开的 Cloudflare 页面登录并授权 Wrangler；完成后告诉我，我会检查登录结果”。不要索取账号密码或验证码。
- 账号/资源选择：展示实际查到的名称，说明将使用哪一组。遇到多个账号，先让主人选；不要猜测或借用模板作者的资源。
- 密钥：指导主人在本地文件或 Wrangler 提示中输入。不要让主人把密码或密钥发到聊天里，不将其写入 README 或 Git 提交。
- 阻塞：报告真实错误和具体解决动作；不能只说“环境有问题”。保留已完成的配置，修复后从当前阶段继续。

## 阶段 1：获取代码与准备环境

需要 Node.js >= 22.13（推荐 24）、pnpm 11.25.0，以及自己的 Cloudflare 账号。Cloudflare 上线还需要启用 Workers、D1 和 R2。

尚未下载时执行：

```sh
git clone https://github.com/lixiuqi82-art/landscape-gallery-starter.git
cd landscape-gallery-starter
```

想保存自己的修改，应先在 GitHub Fork 本仓库，再克隆自己的 Fork；已经下载则直接使用已有目录。

```sh
node --version
pnpm --version
pnpm install --frozen-lockfile
```

**验收：** 环境满足版本要求，依赖安装成功。遇到锁文件错误，先查明原因，不能通过删除锁文件或随意升级依赖绕过。

## 阶段 2：本地运行

如果 `.dev.vars` 不存在，复制 `.dev.vars.example` 创建它；存在则保留主人的配置。设置：

| 配置项 | 用途 | 要求 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 管理后台密码 | 主人设置强密码，不能保留示例值 |
| `SESSION_SECRET` | 签名管理会话 | 至少 32 字符的随机密钥，不能保留示例值 |

可在本地生成随机密钥：

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

AI 自动生成时，应直接写入被 Git 忽略的本地文件，不把生成结果输出到聊天或日志。

```sh
pnpm run db:migrate:local
pnpm run dev
```

打开终端给出的地址，默认 `http://localhost:5174`；后台为 `/manage`。本地数据库和图片保存在 `.wrangler/state`，不会自动复制到线上。

**验收：** 首页可打开，`/api/photos` 返回正常 JSON（初始 `photos` 是空数组），后台能用配置的密码登录。请主人上传一张自己的测试照片，检查网格、大图和缩放。空相册不是报错。

## 阶段 3：配置主人自己的 Cloudflare 资源

先检查现有登录和资源：

```sh
pnpm exec wrangler whoami
pnpm exec wrangler d1 list
pnpm exec wrangler r2 bucket list
```

尚未登录时：

```sh
pnpm exec wrangler login
```

没有适合的资源、且主人授权创建时：

```sh
pnpm exec wrangler d1 create gallery-db
pnpm exec wrangler r2 bucket create gallery-photos
```

名称冲突时使用主人认可的新名称，并同步修改配置。已有数据库或存储桶可能包含数据，不能删除重建。

编辑 `wrangler.jsonc`：

| 字段 | AI 要做的事 |
| --- | --- |
| `name` | 设置主人自己的网站 Worker 名称 |
| `database_name` | 与选定的 D1 数据库名称一致 |
| `database_id` | 填入实际 D1 ID；全零值仅用于本地占位，不能上线 |
| `bucket_name` | 与选定的 R2 存储桶名称一致 |
| 绑定 `DB` / `BUCKET` / `ASSETS` | 保留名称，代码依赖这些绑定 |

**验收：** 登录账号正确，D1 ID 已替换，资源归属与名称核对一致。R2 不需要开启公开桶访问。Cloudflare 可用额度和计费以主人账号及官方说明为准；遇到付费或启用服务页面，由主人决定和完成。

## 阶段 4：迁移、密钥与部署

先运行项目检查：

```sh
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

失败则读取报错并修复，不应宣称可部署。成功后，在已授权的资源上执行：

```sh
pnpm run db:migrate:remote
pnpm exec wrangler secret put ADMIN_PASSWORD --config wrangler.jsonc
pnpm exec wrangler secret put SESSION_SECRET --config wrangler.jsonc
pnpm run deploy
```

两次 `secret put` 分别由主人输入后台密码和随机会话密钥。线上密钥与 `.dev.vars` 独立；本地设置不会自动成为线上设置。已有线上密钥且无需更换时，不重复覆盖。若 Wrangler 提示需要先创建 Worker，按实际提示完成首次 Worker 创建，再配置密钥、重新部署并验收。

使用 `pnpm run deploy`，它会构建并发布 `dist/server/wrangler.json` 指向的产物；不要跳过项目打包脚本，擅自改成另一套发布入口。

## 阶段 5：线上验收与交付

从**实际部署输出**取得网址，不能猜测 `workers.dev` 域名。逐项验证：

- 首页和 `/api/photos` 正常响应；没有照片时展示空相册。
- `/manage` 可打开，主人能登录；匿名访问受保护的管理接口不能获得原始文件或写入权限。
- 主人上传一张自己的照片后，首页能显示，高清大图完整加载，缩放与下载正常。
- 后台登出后，管理会话失效。

不能为了验收自动公开主人的私人照片；测试照片由主人选择。没有条件完成浏览器或照片验收时，明确列出尚未验证的项目，不能写“全部完成”。

交付时告诉主人：**网站网址、后台网址、已验证项目、未完成项目、下一步动作**。若代码也已上传 GitHub，单独说明仓库同步状态；GitHub 更新不等于网站已经部署。

## 常见问题：AI 应如何处理

| 现象 | 先检查 | 下一步 |
| --- | --- | --- |
| 首页没有照片 | `/api/photos` 是否正常、数据库是否为空 | 引导主人从 `/manage` 上传，勿复制作者照片 |
| 后台无法登录 | 密钥是否配置、是否仍为示例值、实际响应 | 修复配置；登录限流时等待窗口，不关闭保护 |
| D1 表不存在 | 当前账号、绑定、该环境迁移是否应用 | 在正确环境应用现有迁移，不删除数据库 |
| R2 上传失败 | 桶名称、绑定、服务是否启用、实际错误 | 修复资源配置后重试，不公开存储桶绕过 |
| 大图慢或不完整 | 图片响应状态、实际传输是否完整、预加载逻辑 | 保留高清预加载，定位传输/缓存/解码原因 |
| 部署失败 | 构建、占位 ID、账号权限、真实 Wrangler 日志 | 修复具体错误后重试，不随意升级全套依赖 |
| 自定义域名 | 主人域名及 Cloudflare DNS 状态 | 默认先交付 workers.dev 地址，再按请求配置域名 |

## 修改外观与代码定位

| 目标 | 文件 |
| --- | --- |
| 页面标题与描述 | `app/layout.tsx` |
| 首页页头 | `addons/components/GalleryHeader.tsx` |
| 网格与相册交互 | `app/gallery.tsx` |
| 大图查看器 | `app/photo-lightbox.tsx` |
| 页面样式 | `app/globals.css` |
| 管理界面 | `app/manage/` |
| 数据结构与迁移 | `db/schema.ts`、`drizzle/` |
| 后台鉴权与保护 | `lib/admin-session.ts`、`lib/admin-protection.ts` |
| Worker 路由与构建 | `worker/index.ts`、`scripts/copy-static-shell.mjs` |

新增数据结构迁移运行 `pnpm run db:generate`，保留已有迁移历史。修改前先读相关实现，不重写整个项目来解决局部问题。

## 必须保留的边界

- 不提交 `.dev.vars`、`.env*`、密钥、照片、数据库导出、`.wrangler`、`node_modules` 或 `dist`。
- 不删除已有数据，不覆盖主人尚未提交的修改，不关闭后台鉴权、来源校验或会话保护来解决错误。
- 高清公开展示意味着访客能够保存展示的图片；本项目不是 DRM，也不能保证阻止盗图。
- 主人提出的新需求与平台规则优先；本文不授权额外发布、付费、发送消息或访问其他人的资源。

## 许可与官方参考

代码采用 [MIT 许可证](LICENSE)，允许复制、修改及自行部署，需保留许可证声明。依赖遵循各自许可证，使用者负责上传照片的版权和授权。

- [Cloudflare Workers 配置](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [D1 命令](https://developers.cloudflare.com/d1/wrangler-commands/)
- [R2 命令](https://developers.cloudflare.com/r2/reference/wrangler-commands/)

## English handoff for AI assistants

Read this README and AGENTS.md first. Inspect the current environment, configuration and deployment state; resume at the first incomplete stage. Prepare dependencies, initialize local D1, verify the gallery, configure the owner's Cloudflare resources, apply remote migrations, configure secrets and deploy only within the owner's authorization. Guide the owner one concrete step at a time for login, account choice, password entry and photo selection. Never expose secrets, reuse the author's resources, overwrite existing data or claim unverified success. Return the actual site URL, admin URL, completed checks and any remaining actions.
