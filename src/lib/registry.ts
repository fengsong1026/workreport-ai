/**
 * 插件注册表：发现、实例化、查询所有数据源插件
 *
 * TypeScript 中改为显式注册（而非动态导入），保证类型安全
 */

import { DataSourcePlugin } from "./plugin";
import { GitPlugin } from "@/plugins/git";
import { TaskPlugin } from "@/plugins/task";
import { CalendarPlugin } from "@/plugins/calendar";
import { DocPlugin } from "@/plugins/doc";

/**
 * 已知插件工厂列表
 */
const PLUGIN_FACTORIES = [
  (projectDir: string, config: Record<string, unknown>) => new GitPlugin(projectDir, config),
  (projectDir: string, config: Record<string, unknown>) => new TaskPlugin(projectDir, config),
  (projectDir: string, config: Record<string, unknown>) => new CalendarPlugin(projectDir, config),
  (projectDir: string, config: Record<string, unknown>) => new DocPlugin(projectDir, config),
];

export class PluginRegistry {
  private plugins = new Map<string, DataSourcePlugin>();

  constructor(
    private projectDir: string,
    pluginsConfig: Record<string, Record<string, unknown>> = {},
  ) {
    for (const factory of PLUGIN_FACTORIES) {
      try {
        const instance = factory(projectDir, {});
        const name = instance.meta.name;
        // 注入对应配置
        const cfg = pluginsConfig[name] || {};
        // 重新用配置实例化（简化：直接覆盖 config 属性）
        const configured = factory(projectDir, cfg);
        this.plugins.set(name, configured);
      } catch (e) {
        console.error(`[!] 实例化插件失败:`, e);
      }
    }
  }

  get(name: string): DataSourcePlugin | undefined {
    return this.plugins.get(name);
  }

  all(): DataSourcePlugin[] {
    return Array.from(this.plugins.values());
  }

  available(): DataSourcePlugin[] {
    return this.all().filter((p) => p.meta.isAvailable);
  }

  names(): string[] {
    return Array.from(this.plugins.keys());
  }
}

/**
 * 全局注册表单例
 */
let _registry: PluginRegistry | null = null;

export function getRegistry(): PluginRegistry {
  if (!_registry) {
    _registry = new PluginRegistry(process.cwd(), {});
  }
  return _registry;
}
