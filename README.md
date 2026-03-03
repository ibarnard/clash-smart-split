# Clash Verge/Party 智能分流脚本

为 Clash Verge 和 Clash Party 设计的配置覆写脚本。

## 功能特性

| 功能 | 说明 |
|------|------|
| 节点清洗 | 移除包含"到期"、"剩余流量"、"官网"等关键词的垃圾节点 |
| 智能分组 | 自动筛选优质节点建立"🚀 专用/媒体自动"组 |
| 流媒体加速 | ChatGPT、Netflix、YouTube 等强制走专用组 |
| 省流模式 | 自动选择测速间隔改为60分钟，减少后台流量 |
| 直连白名单 | 国内网站(淘宝/京东/百度等)强制直连 |
| **SSH直连** | **解决TUN模式下SSH服务器IP直连失效问题** |

---

## 快速开始

### 导入脚本

1. 打开 Clash Verge/Party 客户端
2. 进入 **Script** 或 **Profiles** -> **Merge/Script**
3. 点击 **New**，类型选择 `Script`
4. 名称填写：`智能分流优化`
5. URL 填入：
   ```
   https://raw.githubusercontent.com/ibarnard/clash-smart-split/main/smart-split.js
   ```
6. 保存

### 应用脚本

1. 右键正在使用的订阅 -> **Edit Script**
2. 勾选 `智能分流优化`
3. 保存
4. 刷新代理列表

---

## 配置说明

在脚本顶部 `UserConfig` 区域修改：

```javascript
const UserConfig = {
  // 黑名单关键词 - 包含这些词的节点会被删除
  blockKeywords: ["专线X5倍率", "到期", "剩余流量", "官网"],

  // 专用组地区 - 筛选哪些地区的节点进入专用组
  specialRegionKeywords: ["新加坡", "日本", "美国", "US", "JP", "SG"],

  // 直连端口 - 强制直连的端口(解决TUN模式端口失效)
  directPorts: [22],

  // 直连IP/网段 - 强制直连的SSH服务器IP
  directSSHIPs: [
    // "192.168.1.100",   // 单个IP
    // "10.0.0.0/8",      // CIDR网段
  ],

  // 直连域名 - 国内网站强制直连
  directDomains: ["baidu.com", "qq.com", "cn"],

  // 专用域名 - 强制走专用组(AI/流媒体)
  specialDomains: ["openai.com", "netflix.com", "youtube.com"],
};
```

---

## TUN模式SSH直连说明

**问题**：TUN模式下SSH流量被代理，导致直连失效

**解决**：

1. 在 `directSSHIPs` 添加SSH服务器IP：
   ```javascript
   directSSHIPs: ["192.168.1.100", "10.0.0.0/8"],
   ```

2. 或在 `directPorts` 添加SSH端口：
   ```javascript
   directPorts: [22, 2222],
   ```

**规则优先级**：端口直连 > IP直连 > 域名直连 > 专用规则

---

## 文件说明

| 文件 | 说明 |
|------|------|
| smart-split.js | 覆写脚本主文件 |
| README.md | 说明文档 |

---

## 适用客户端

- Clash Verge (Rev)
- Clash Party
- 其他支持 JavaScript 覆写的 Clash 客户端
