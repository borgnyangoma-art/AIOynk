import { v4 as uuidv4 } from 'uuid'

import { Alert, AlertSeverity, AlertType } from './types'

const subscribers = new Set<(alert: Alert) => void>()
const history: Alert[] = []
const MAX_HISTORY = 100

export const emitAlert = (type: AlertType, severity: AlertSeverity, message: string, details?: Record<string, any>, projectId?: string) => {
  const alert: Alert = {
    id: uuidv4(),
    projectId,
    type,
    severity,
    message,
    details,
    timestamp: new Date().toISOString(),
  }

  history.push(alert)
  if (history.length > MAX_HISTORY) {
    history.shift()
  }

  subscribers.forEach((listener) => {
    try {
      listener(alert)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Alert subscriber failed', error)
    }
  })

  return alert
}

export const subscribeToAlerts = (listener: (alert: Alert) => void) => {
  subscribers.add(listener)
  return () => subscribers.delete(listener)
}

export const getRecentAlerts = () => [...history]
