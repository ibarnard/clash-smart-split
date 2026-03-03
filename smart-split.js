/**
 * Clash Verge / Clash Party 智能分流覆写脚本
 * 
 * 脚本功能：
 * 1. 节点清洗 - 移除不可用、倍率异常、广告推广等垃圾节点
 * 2. 智能分组 - 为 AI、流媒体建立专用自动组
 * 3. 省流模式 - 强制机场默认自动选择调整为 60分钟测速
 * 4. 规则注入 - 直连规则(端口/IP) > 专用规则 > 默认规则
 * 
 * TUN模式SSH直连解决方案：
 * - 新增 directSSHIPs 配置SSH服务器IP/网段
 * - 新增 directPorts 配置直连端口(默认22)
 * - 规则优先级：端口直连 > IP直连 > 域名直连 > 专用规则
 */

function main(config) {
  // =======================================================
  // 👉 用户配置区域 (小白只改这里，其他地方不动)
  // =======================================================
  const UserConfig = {
    // 1. 【黑名单关键词】
    // 作用：包含这些关键词的节点会被脚本彻底删除，不会出现在列表中。
    // 理由：清理那些不能用、倍率高、或者是官网链接的垃圾节点，让列表更清爽。
    blockKeywords: ["专线X5倍率", "到期", "剩余流量", "重置", "官网", "如果是", "套餐"],

    // 2. 【专用节点地区】
    // 作用：下方的“专用/媒体组”只从所有节点中，筛选出包含这些关键词的节点。
    // 理由：Netflix、ChatGPT 等服务通常在 美国(US)、日本(JP)、新加坡(SG) 最稳定。
    specialRegionKeywords: ["新加坡", "日本", "美国", "US", "JP", "SG", "Taiwan", "TW", "HK"],
    
    // 3. 【策略组名称】
    // 作用：定义在 Clash 界面上显示的组名字。
    specialGroupName: "🚀 专用/媒体自动", // 你新建的那个专用组名字
    generalGroupName: "自动选择",         // 机场原本的默认自动组 (脚本会自动识别并改造它)

    // 4. 【直连端口】
    // 作用：列表内的端口，强制不走代理，直接连接。
    // 理由：解决TUN模式下特定端口流量被代理的问题(如SSH 22端口)。
    directPorts: [22],

    // 5. 【直连IP/网段】
    // 作用：列表内的IP或CIDR网段，强制不走代理，直接连接。
    // 理由：解决TUN模式下SSH服务器IP直连失效问题。
    directSSHIPs: [
      // "192.168.1.100",   // 单个IP地址
      // "10.0.0.0/8",      // CIDR网段格式
    ],

    // 6. 【直连网址 (白名单)】
    // 作用：列表内的域名，强制不走代理，直接连接。
    // 理由：国内网站走代理反而变慢，或解决某些应用在代理下无法使用的问题。
    directDomains: [
      "baidu.com", 
      "qq.com", 
      "163.com", 
      "taobao.com", 
      "jd.com", 
      "cn",              // 所有 .cn 结尾的域名
      "microsoft.com",   // 微软服务直连通常更稳
      "apple.com"        // 苹果服务
    ],

    // 7. 【专用网址 (强制定向)】
    // 作用：列表内的域名，强制走上面的 "🚀 专用/媒体自动" 组。
    // 理由：确保 AI 和流媒体服务始终走最优质的特定国家节点，防止被分配到乱七八糟的慢节点。
    specialDomains: [
      // === Google / YouTube ===
      "google.com", "gstatic.com", "googleapis.com", "youtu.be", "youtube.com",
      
      // === AI / ChatGPT (OpenAI 相关域名) ===
      "openai.com", "chatgpt.com", "auth0.com", "oaistatic.com", "microsoftedge.com", "anthropic.com", "claude.ai",

      // === 流媒体 / Netflix / Disney ===
      "netflix.com", "nflxvideo.net", "disney.com", "spotify.com",
      
      // === 特定地区服务 (日本 DMM / 新加坡虾皮) ===
      "dmm.co.jp", "nicovideo.jp", "shopee.sg", "lazada.sg"
    ]
  };

  // =======================================================
  // ⛔️ 核心逻辑区域 (非专业人士请勿修改)
  // =======================================================

  // 0. 安全性检查 (防止空配置报错)
  if (!config.proxies) config.proxies = [];
  if (!config["proxy-groups"]) config["proxy-groups"] = [];
  if (!config.rules) config.rules = [];

  // --- 1. 节点清洗 (Purify) ---
  // 从 proxies 中剔除黑名单节点
  config.proxies = config.proxies.filter(p => 
    !UserConfig.blockKeywords.some(k => p.name.includes(k))
  );

  // 从现有的 proxy-groups 中剔除黑名单节点
  config["proxy-groups"].forEach(group => {
    if (group.proxies && group.proxies.length > 0) {
      group.proxies = group.proxies.filter(name => 
        !UserConfig.blockKeywords.some(k => name.includes(k))
      );
    }
  });

  // 获取清洗后剩余的所有合法节点名称
  const allProxyNames = config.proxies.map(p => p.name);
  
  // 如果没节点了，直接返回，避免报错
  if (allProxyNames.length === 0) {
    return config; 
  }

  // --- 2. 改造/创建“自动选择”组 (General Auto) ---
  // 尝试寻找现有的自动组（模糊匹配 Auto, 自动, UrlTest）
  let generalGroup = config["proxy-groups"].find(g => 
    g.name === UserConfig.generalGroupName || 
    /自动|Auto|UrlTest/i.test(g.name)
  );

  if (generalGroup) {
    // 找到了：修改参数 (强制改为 3600秒测速，url改为 google)
    generalGroup.interval = 3600;
    generalGroup.url = "http://www.gstatic.com/generate_204";
  } else {
    // 没找到：新建一个通用自动组
    config["proxy-groups"].unshift({
      name: UserConfig.generalGroupName,
      type: "url-test",
      url: "http://www.gstatic.com/generate_204",
      interval: 3600,
      tolerance: 50,
      proxies: allProxyNames
    });
  }

  // --- 3. 新建“专用/媒体”组 (Special Auto) ---
  // 筛选符合专用地区的节点
  const specialNodes = allProxyNames.filter(name => 
    UserConfig.specialRegionKeywords.some(k => name.includes(k))
  );

  // 如果有符合条件的节点，才创建这个组
  if (specialNodes.length > 0) {
    // 先删除可能存在的同名旧组，防止重复
    config["proxy-groups"] = config["proxy-groups"].filter(g => g.name !== UserConfig.specialGroupName);

    const specialGroup = {
      name: UserConfig.specialGroupName,
      type: "url-test",
      url: "http://www.gstatic.com/generate_204",
      interval: 300, // 专用组保留 5分钟测速，保持敏感度
      tolerance: 50,
      proxies: specialNodes
    };
    
    // 将专用组插入到策略组列表的最前面
    config["proxy-groups"].unshift(specialGroup);
  }

  // --- 4. 规则注入 (Rules Injection) ---
  // 优先级顺序：端口直连 > IP直连 > 域名直连 > 专用规则 > 原始规则
  // 使用 unshift 将新规则添加到数组最前端，确保最高优先级
  
  const newRules = [];

  // 4.1 端口直连规则 (最高优先级 - TUN模式下优先匹配端口)
  UserConfig.directPorts.forEach(port => {
    newRules.push(`DST-PORT,${port},DIRECT`);
  });

  // 4.2 IP/网段直连规则 (次优先级)
  // 自动检测IP格式：纯IP自动补/32，CIDR网段直接使用
  UserConfig.directSSHIPs.forEach(ipOrCidr => {
    const trimmed = ipOrCidr.trim();
    if (!trimmed) return;
    
    // 判断是否为CIDR格式(包含/)
    if (trimmed.includes('/')) {
      newRules.push(`IP-CIDR,${trimmed},DIRECT`);
    } else {
      // 纯IP地址，自动补全/32
      newRules.push(`IP-CIDR,${trimmed}/32,DIRECT`);
    }
  });

  // 4.3 域名直连规则 (第三优先级)
  UserConfig.directDomains.forEach(domain => {
    newRules.push(`DOMAIN-SUFFIX,${domain},DIRECT`);
  });

  // 4.4 专用规则 (第四优先级)
  if (specialNodes.length > 0) {
    UserConfig.specialDomains.forEach(domain => {
      newRules.push(`DOMAIN-SUFFIX,${domain},${UserConfig.specialGroupName}`);
    });
  }

  // 4.5 将新规则合并到原始规则的最前面
  if (newRules.length > 0) {
    config.rules.unshift(...newRules);
  }

  return config;
}

/**
 * =======================================================
 * 修改点说明 (TUN模式SSH直连修复)
 * =======================================================
 * 
 * 【新增配置项】
 * 1. directPorts - 直连端口数组，默认[22]，可添加其他端口
 * 2. directSSHIPs - SSH服务器IP/网段数组，支持IP或CIDR格式
 * 
 * 【规则注入优先级】
 * 第1优先级：DST-PORT规则 (端口直连)
 * 第2优先级：IP-CIDR规则 (IP/网段直连)  
 * 第3优先级：DOMAIN-SUFFIX规则 (域名直连)
 * 第4优先级：专用规则 (强制走专用组)
 * 
 * 【关键代码变更】
 * 1. 规则顺序调整为：端口 > IP > 域名 > 专用
 * 2. IP格式自动处理：纯IP自动补/32后缀
 * 3. 所有新规则通过unshift添加到rules数组最前端
 * 
 * 【使用示例】
 * directSSHIPs: [
 *   "192.168.1.100",      // 单个IP
 *   "10.0.0.0/8",         // CIDR网段
 *   "172.16.0.0/12"       // 另一个网段
 * ]
 * directPorts: [22, 2222] // SSH端口
 */