import { mockBridge } from './mock'
import type { Bridge } from './types'

export const isDesktop = typeof window !== 'undefined' && Boolean((window as any).majora)

export function getBridge(): Bridge {
  return isDesktop ? ((window as any).majora as Bridge) : mockBridge
}
