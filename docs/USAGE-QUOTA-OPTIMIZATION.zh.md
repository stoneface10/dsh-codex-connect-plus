# Codex Token 与订阅额度优化报告

## 结论

Codex 订阅额度不是简单按 DSH 显示的 Token 一比一扣减。OpenAI 的 Codex 额度会受到模型、任务复杂度、请求位置和执行方式影响；DSH 的 provider usage 适合定位“哪次请求变大、是否命中缓存、是否发生重试”，但不能替代 ChatGPT/Codex 服务端的额度窗口。

本轮确认的主要放大器是：

1. 瞬时错误后的整请求自动重试；
2. 长会话中的未缓存输入与压缩摘要请求；
3. 子代理递归分派导致的请求树扩张；
4. 高推理强度、长输出预算和不必要的工具循环；
5. 只看总输入而不区分缓存读取与未缓存输入，导致无法定位真实增量。

## Plus 插件优化

### 模型重试默认改为 0

Alpha.2 继承 DSH 普通 retry policy：首次请求失败后，符合条件的瞬时错误最多再请求两次。因此一次用户操作最坏会产生三次完整模型请求。

Alpha.3 默认：

```yaml
modelMaxRetries: 0
```

用户可在插件配置中显式选择 0、1 或 2。默认从最多三次尝试降为一次，在完整失败链上最多减少 66.7% 的模型请求。该百分比是请求次数上限变化，不是承诺节省同等比例的服务端额度。

图片生成和编辑继续保持零自动重试。超时或连接中断不代表上游未处理；自动重试可能生成重复图片并再次消耗额度。

### Prompt Cache 路径

Plus 通过稳定的 DSH session id 给 Codex 请求提供 `prompt_cache_key`。DSH 保持系统提示与工具目录前缀顺序稳定；动态时间信息作为尾部消息进入，不会改变长系统前缀。

OpenAI 的 Prompt Caching 文档指出，缓存依赖相同前缀，工具定义也属于可缓存前缀。优化重点因此是保持前缀稳定并观察 `cacheReadTokens`，而不是随意删除必要系统指令。

## DSH 优化

### 会话统计可见性

DSH 的会话统计新增：

- 自动重试次数；
- 总输入中的未缓存输入；
- Cache hit 百分比；
- 压缩摘要请求的 provider usage。

压缩前，`compaction/summary` 已保存 usage，但没有进入会话 `tokenUsage` 总计；长会话因此会低估实际调用量。现在摘要请求会作为独立 provider 请求累计，同时不会错误覆盖主模型的上下文占用读数。

### 子代理递归上限

内置 `standard`、`code`、`cordis` preset 及 base bundle 将进程内子代理最大深度从默认 3 收紧为 2：

```text
root → child → grandchild
```

仍允许有价值的二级分工，但阻止第三层继续扩张完整上下文请求树。

如果每个代理平均继续分派 `b` 个代理，理论最大后代数从：

```text
b + b² + b³
```

降到：

```text
b + b²
```

示例：

- `b=2`：14 → 6，后代请求上限减少 57.1%；
- `b=3`：39 → 12，后代请求上限减少 69.2%。

这是递归上界，不代表普通会话一定达到该数量。显式 Workflow/Ralph 仍由各自的并发和轮数策略管理。

### 压缩策略

DSH 当前自动压缩默认在上下文窗口约 80% 触发，压缩后保留约 16% 的逐字尾部。没有证据表明盲目提前压缩一定省额度：压缩本身也是一次模型请求，过于频繁会增加摘要调用并可能降低缓存复用。

因此本轮不修改默认压缩阈值，先完整计入摘要 usage，再根据真实长会话数据决定是否需要按 provider/model 覆盖阈值。

## 订阅额度与 Token 的正确读法

同时观察两类数据：

1. ChatGPT/Codex usage 窗口：回答账户还剩多少额度；
2. DSH 会话统计：回答消耗来自未缓存输入、缓存读取、输出、压缩还是重试。

不要用 DSH Token 数直接推算订阅余额。服务端额度可能按任务复杂度和模型折算；相同 Token 数的两次任务不保证扣减一致。

## 推荐配置

```yaml
modelMaxRetries: 0
enableSearch: false
enableImageTool: false
enableImageGeneration: true
```

使用建议：

- 普通任务保持零重试；确认是瞬时网络不稳定时再手动重试；
- 长任务优先继续同一会话以保留缓存前缀，但上下文接近上限时使用一次有效压缩或新会话；
- 不让子代理再递归发起大规模审计；需要大量独立任务时使用有明确数量和结构化返回的 Workflow；
- 不向每个子代理复制无关日志、完整历史或大文件；
- 先看“未缓存输入”和“自动重试”，再判断是否需要缩短上下文；
- 图片超时后先检查输出与额度，不自动重复生成。

## 验证证据

- Plus 全量检查：19 个测试文件、78 个测试通过；构建、类型检查、Client frozen-module-table 检查和 pack 检查通过。
- DSH Token/会话统计：Token Meter、Session Stats、Connection Fixture、Conversation UI 回归通过。
- Windows ACL 沙箱：14 个测试文件、162 个测试通过，包括真实受限进程写入/拒绝、子进程和 PowerShell 模式。
- PM2 后台窗口探针：持续监测 12 秒，Windows Terminal 可见窗口数始终为 2，受限 PowerShell 命令退出码为 0，未新增窗口。

## 参考资料

- [OpenAI Codex rate card](https://help.openai.com/en/articles/20001106-codex-rate-card)
- [OpenAI Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)
- [OpenAI Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)
- [Windows process creation flags](https://learn.microsoft.com/windows/win32/procthread/process-creation-flags)
- [Windows Terminal default-host popup issue #11627](https://github.com/microsoft/terminal/issues/11627)
- [Windows Terminal Show/Hide propagation #12570](https://github.com/microsoft/terminal/issues/12570)
