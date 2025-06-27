import { ref } from 'vue'

export interface BottleTemplate {
  id: string;
  name: string;
  bottleVolume: number;      // 瓶子容积(ml)
  bottleMass: number;        // 瓶子质量(g)
  bottleDiameter: number;    // 瓶身直径(m)
  nozzleDiameter: number;    // 喷嘴直径(m)
  description?: string;      // 瓶子描述
  isCustom: boolean;         // 是否为自定义瓶子
}

export class BottleManager {
  private static instance: BottleManager
  private templates = ref<BottleTemplate[]>([
    {
      id: 'cola-2l',
      name: '2L可乐瓶',
      bottleVolume: 2000,
      bottleMass: 100,
      bottleDiameter: 0.1,
      nozzleDiameter: 0.02,
      description: '标准2L可乐瓶，适合制作单级火箭',
      isCustom: false
    },
    {
      id: 'sprite-1.5l',
      name: '1.5L雪碧瓶',
      bottleVolume: 1500,
      bottleMass: 80,
      bottleDiameter: 0.09,
      nozzleDiameter: 0.02,
      description: '1.5L雪碧瓶，较轻，适合作为上级火箭',
      isCustom: false
    },
    {
      id: 'water-550ml',
      name: '550ml矿泉水瓶',
      bottleVolume: 550,
      bottleMass: 30,
      bottleDiameter: 0.065,
      nozzleDiameter: 0.015,
      description: '小型矿泉水瓶，适合作为末级火箭',
      isCustom: false
    }
  ])

  private constructor() {}

  public static getInstance(): BottleManager {
    if (!BottleManager.instance) {
      BottleManager.instance = new BottleManager()
    }
    return BottleManager.instance
  }

  // 获取所有瓶子模板
  public getTemplates(): BottleTemplate[] {
    return this.templates.value
  }

  // 根据ID获取瓶子模板
  public getTemplateById(id: string): BottleTemplate | undefined {
    return this.templates.value.find(template => template.id === id)
  }

  // 添加自定义瓶子模板
  public addTemplate(template: Omit<BottleTemplate, 'id' | 'isCustom'>): string {
    const id = `custom-${Date.now()}`
    this.templates.value.push({
      ...template,
      id,
      isCustom: true
    })
    return id
  }

  // 更新自定义瓶子模板
  public updateTemplate(id: string, template: Partial<BottleTemplate>): boolean {
    const index = this.templates.value.findIndex(t => t.id === id)
    if (index === -1 || !this.templates.value[index].isCustom) return false

    this.templates.value[index] = {
      ...this.templates.value[index],
      ...template
    }
    return true
  }

  // 删除自定义瓶子模板
  public deleteTemplate(id: string): boolean {
    const index = this.templates.value.findIndex(t => t.id === id)
    if (index === -1 || !this.templates.value[index].isCustom) return false

    this.templates.value.splice(index, 1)
    return true
  }
}