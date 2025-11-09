type DurationSample = {
  durationMs: number
  route: string
  method: string
  timestamp: number
}

class SlaMonitorService {
  private samples: DurationSample[] = []
  private readonly maxSamples = 500
  private readonly thresholdMs = 5000
  private readonly complianceTarget = 0.95

  record(durationMs: number, route: string, method: string) {
    this.samples.push({
      durationMs,
      route,
      method,
      timestamp: Date.now(),
    })
    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }
  }

  private percentile(values: number[], percentile: number) {
    if (values.length === 0) {
      return 0
    }
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.min(sorted.length - 1, Math.floor(percentile * sorted.length))
    return sorted[index]
  }

  isCompliant() {
    const durations = this.samples.map((sample) => sample.durationMs)
    const p95 = this.percentile(durations, 0.95)
    return { compliant: p95 <= this.thresholdMs, p95 }
  }

  getSnapshot() {
    const total = this.samples.length
    const overThreshold = this.samples.filter((sample) => sample.durationMs > this.thresholdMs).length
    const compliance = total === 0 ? 1 : 1 - overThreshold / total
    return {
      totalSamples: total,
      compliance,
      thresholdMs: this.thresholdMs,
      compliant: compliance >= this.complianceTarget,
      p95: this.isCompliant().p95,
    }
  }
}

export default new SlaMonitorService()
