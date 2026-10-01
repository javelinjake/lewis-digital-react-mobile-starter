import { Device } from '@capacitor/device'

export interface DeviceSummary {
  platform: 'ios' | 'android' | 'web'
  model: string
  osVersion: string
  isTablet: boolean
  installId: string
}

export async function getDeviceSummary(): Promise<DeviceSummary> {
  const [info, id] = await Promise.all([Device.getInfo(), Device.getId()])

  return {
    platform: info.platform,
    model: info.model,
    osVersion: info.osVersion,
    isTablet: /ipad|tablet/i.test(info.model) || (info.platform === 'web' && window.innerWidth >= 768),
    installId: id.identifier,
  }
}
