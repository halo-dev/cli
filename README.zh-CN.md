# Halo CLI

[English README](./README.md)

一个用于管理 [Halo](https://www.halo.run) 实例的命令行工具。

## 安装

```sh
npm install -g @halo-dev/cli
```

安装后可执行命令为：

```sh
halo
```

查看版本：

```sh
halo --version
```

## 运行要求

- Node.js `>= 20`

## 快速开始

### 使用 Bearer Token 登录

```sh
halo auth login \
  --profile local \
  --url http://127.0.0.1:8090 \
  --auth-type bearer \
  --token <your-token>
```

### 使用 Basic Auth 登录

在使用 Basic Auth 之前，请先确保你的 Halo 实例已启用 Basic Auth。

启动 Halo 时增加以下参数：

```sh
--halo.security.basic-auth.disabled=false
```

然后执行登录：

```sh
halo auth login \
  --profile local \
  --url http://127.0.0.1:8090 \
  --auth-type basic \
  --username admin \
  --password <your-password>
```

### 验证当前 profile

```sh
halo auth current
halo auth profile list
```

## 常见用法

查看帮助：

```sh
halo --help
halo auth --help
halo post --help
halo single-page --help
```

根命令帮助输出示例：

```text
halo/1.0.0

Usage:
  $ halo <command> [options]

Commands:
  auth          Authentication commands
  post          Post management commands
  single-page   Single page management commands
  search        Search public site content
  plugin        Plugin management commands
  theme         Theme management commands
  attachment    Attachment management commands
  backup        Backup management commands
  moment        Moment management commands
  comment       Comment management commands
  notification  Notification management commands

For more info, run any command with the `--help` flag:
  $ halo auth --help
  $ halo post --help
  $ halo single-page --help
  $ halo search --help
  $ halo plugin --help
  $ halo theme --help
  $ halo attachment --help
  $ halo backup --help
  $ halo moment --help
  $ halo comment --help
  $ halo notification --help

Options:
  -h, --help     Display this message
  -v, --version  Display version number
```

指定已保存的 profile：

```sh
halo post list --profile production
```

使用 JSON 输出以便脚本处理：

```sh
halo post list --json
halo single-page get about --json
```

## 主要命令分组

当前 Halo CLI 包含以下命令分组：

- `auth`
- `post`
- `single-page`
- `search`
- `plugin`
- `theme`
- `attachment`
- `backup`
- `moment`
- `comment`
- `notification`

更多细节请使用 `--help` 查看。

## Agent Skills

此包还附带了可复用的 skills，位于根目录下的 `skills/`。

包含的 skills：

- `halo-shared`
- `halo-auth`
- `halo-content`
- `halo-operations`
- `halo-moderation-notifications`

全局安装后，你通常可以先通过下面的命令定位安装目录：

```sh
npm root -g
```

然后进入：

```sh
<npm-global-root>/@halo-dev/cli/skills
```

如果你使用的是其他包管理器，请打开对应全局安装目录中的 `@halo-dev/cli/skills`。

推荐先从这里开始：

```sh
skills/halo-shared/SKILL.md
```

## 配置

profile 元数据存储在：

- 如果设置了 `HALO_CLI_CONFIG_DIR`，则为 `$HALO_CLI_CONFIG_DIR/config.json`
- 否则为 `$XDG_CONFIG_HOME/halo/config.json`
- 再否则为 `~/.config/halo/config.json`

凭据会存储在系统 keyring 中。

## 开发

常用命令：

```sh
pnpm typecheck
vp lint
vp test
vp pack
```

## 发布

发布前建议先检查打包内容：

```sh
npm pack --dry-run
```

发布包中应包含：

- `dist/`
- `skills/`
- `README.md`
- `README.zh-CN.md`
- `LICENSE`

## 许可证

MIT
