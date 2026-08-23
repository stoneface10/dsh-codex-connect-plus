# Codex Connect Plus：Alpha 设计

## 所有权与组合

本包通过 Harness 公共 `LlmRuntime` 与 `PiAiAdapter` 注册 `openai-codex`。主模型路径不是一次性 subagent，而是标准 Harness agent loop，因此原生工具审批、权限策略、流式输出、附件解析、reasoning replay、会话持久化、压缩与恢复均保持有效。

bundle patch 只插入 `llm-openai-codex`，不会写入 `agent-default-model` 或 `web.searchProvider`。`enableSearch` 与 `enableImageTool` 默认均为 `false`，`enableImageGeneration` 默认为 `true`；关闭时不会注册对应可选服务，图片能力激活失败也不会阻止 Codex 模型适配器加载。

Host 将 `llm-openai-codex` 注册为插件自有 settings namespace，并在 LLM 可配置 provider 目录中声明显示名为 `OpenAI Codex`。浏览器通过 Harness settings-scope transport 绑定该 namespace，把账户、额度以及带保存/放弃的能力配置放在现有“插件配置”卡片中。带 revision 防护的逐字段写入不会覆盖无关设置；提交后会即时协调搜索与图片能力的注册状态，且绝不写入默认模型或全局搜索 namespace。

## OAuth 持久化

插件使用 `$DSH_HOME/.openai-codex-auth.json`，与 Codex CLI/Desktop 状态分离。文件格式严格且有版本号；POSIX 上会拒绝组/其他用户可读文件。父目录和文件按仅所有者权限创建，写入采用原子替换，刷新修改使用 Harness 跨进程文件锁，返回给调用方的是凭据副本。

为兼容迁移，设置页路由、OAuth 路径和 provider id 不改名。浏览器请求必须来自 loopback 对端，并带有 loopback Host；若带 Origin，则必须与该本地 HTTP(S) 源精确匹配。登录挑战只接受不含凭据的 HTTPS 地址；30 秒内未得到地址、provider 已结束但没有地址、退出登录或插件卸载时，所有 waiter 都会被清理。只有显式登录会输出授权 URL 或代码；状态输出会脱敏。doctor 只用 `lstat` 检查元数据，不打开文件。

## 搜索与图片

仅当 `enableSearch: true` 时注册 Codex 独立搜索提供方和不含凭据的请求事件。多 provider 环境仍需显式设置 `web.searchProvider: openai-codex`。仅当 `enableImageTool: true` 且 tools、filesystem、attachments 服务存在时注册 `view_image`。本地文件继续受 Harness 文件系统边界与大小限制；远程图片只允许不含凭据的公共 HTTP(S)，所有 DNS 结果必须是公共单播地址，每次重定向都会重新验证，并把实际连接固定到已验证地址以关闭 DNS rebinding 缺口。

用户上传和工具生成的图片都通过标准 `PiAiAdapter` 附件路径处理，不依赖 `view_image`。Codex profile 向 Harness 明确提供请求总负载、像素和编码字节预算，使附件预处理能在组装 provider 请求前完成。

当 `enableImageGeneration: true` 时注册 `codex_image_generate` 与 `codex_image_edit`。它们与模型适配器共享 provider 原生 OAuth runtime；请求仅发送到固定 HTTPS Codex 应用端点，禁止重定向，传递取消信号，限制为十分钟超时和有界字节，并且不对结果不确定的失败自动重试。输出写入会话 cwd，并在工具结果提交前保存为 Harness 附件，回放时通过所属会话的授权附件 API 读取。

## 冲突、诊断与兼容边界

注册前检查现有 provider id；发现 `openai-codex` 已被占用时，给出旧 bundle 或手动 provider 配置的定向迁移提示。boot-free CLI doctor 只报告包/运行时版本、OAuth 路径元数据、能力默认值和安全提示。

Beta 固定使用 Harness `0.1.1-rc.2` 开发依赖，并使用其当前 pi-ai 认证与图片请求 API；Node.js 支持 `^22.19.0 || >=24.0.0`。`@earendil-works/pi-ai` 固定为 `0.82.1`。资格、额度、模型和后端协议仍由上游控制。测试仅使用临时 OAuth 文档和模拟网络响应，CI 不执行真实认证。
