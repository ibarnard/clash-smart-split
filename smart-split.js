/**
 * Clash Verge / Clash Party 智能分流覆写脚本
 * 
 * =======================================================
 * 📝 脚本功能介绍：
 * 1. 【节点清洗】彻底移除不可用、倍率异常、广告推广等垃圾节点。
 * 2. 【智能分组】为 AI、流媒体建立“专用/媒体自动”组，确保走最稳的节点。
 * 3. 【省流模式】强制将机场默认的“自动选择”调整为 60分钟测速 (默认通常是 5-10分钟，浪费流量)。
 * 4. 【规则注入】
 *    - 直连网址 -> DIRECT (优先级最高)
 *    - 专用网址 -> 专用自动组 (优先级第二)
 *    - 其他 -> 默认规则
 * =======================================================
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

    // 4. 【直连网址 (白名单)】
    // 作用：列表内的域名，强制不走代理，直接连接。
    // 理由：国内网站走代理反而变慢，或者为了解决某些应用在代理下无法使用的问题。
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

    // 5. 【专用网址 (强制定向)】
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
  // 逻辑顺序：直连规则 > 专用规则 > 原始规则
  
  const newRules = [];

  // 4.1 注入直连规则 (最高优先级)
  UserConfig.directDomains.forEach(domain => {
    newRules.push(`DOMAIN-SUFFIX,${domain},DIRECT`);
  });

  // 4.2 注入专用规则 (次高优先级)
  if (specialNodes.length > 0) {
    UserConfig.specialDomains.forEach(domain => {
      newRules.push(`DOMAIN-SUFFIX,${domain},${UserConfig.specialGroupName}`);
    });
  }

  // 4.3 将新规则合并到原始规则的最前面
  if (newRules.length > 0) {
    config.rules.unshift(...newRules);
  }

  return config;
}