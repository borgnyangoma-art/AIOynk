// Resource prioritization utilities for frontend

export type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'BACKGROUND';

export interface ResourceRequest {
  id: string;
  type: 'CPU' | 'MEMORY' | 'IO' | 'NETWORK' | 'RENDER' | 'DATA';
  priority: Priority;
  estimatedTime: number; // in milliseconds
  dependencies?: string[]; // IDs of other requests
  callback: () => Promise<any>;
  createdAt: number;
}

export interface ResourceConstraint {
  CPU: number; // 0-100
  MEMORY: number; // 0-100
  IO: number; // 0-100
  NETWORK: number; // 0-100
  RENDER: number; // 0-100
}

class ResourcePrioritizer {
  private requests: Map<string, ResourceRequest> = new Map();
  private constraints: ResourceConstraint = {
    CPU: 80,
    MEMORY: 80,
    IO: 60,
    NETWORK: 50,
    RENDER: 70,
  };
  private activeRequests: Set<string> = new Set();
  private maxConcurrent: number = 5;
  private queue: string[] = [];
  private running: boolean = false;

  // Set resource constraints
  setConstraints(constraints: Partial<ResourceConstraint>): void {
    this.constraints = { ...this.constraints, ...constraints };
  }

  // Get current resource constraints
  getConstraints(): ResourceConstraint {
    return { ...this.constraints };
  }

  // Add resource request
  addRequest(request: ResourceRequest): void {
    this.requests.set(request.id, request);
    this.queue.push(request.id);
    this.queue.sort((a, b) => {
      const requestA = this.requests.get(a)!;
      const requestB = this.requests.get(b)!;
      return this.getPriorityWeight(requestA.priority) - this.getPriorityWeight(requestB.priority);
    });

    this.processQueue();
  }

  // Cancel request
  cancelRequest(id: string): boolean {
    if (this.activeRequests.has(id)) {
      this.activeRequests.delete(id);
      return this.requests.delete(id);
    } else {
      return this.requests.delete(id);
    }
  }

  // Get request status
  getRequestStatus(id: string): 'pending' | 'running' | 'completed' | 'cancelled' {
    if (!this.requests.has(id)) {
      return 'cancelled';
    }
    if (this.activeRequests.has(id)) {
      return 'running';
    }
    const request = this.requests.get(id)!;
    if (request.completed) {
      return 'completed';
    }
    return 'pending';
  }

  // Process queue
  private async processQueue(): Promise<void> {
    if (this.running) return;

    this.running = true;

    try {
      while (this.queue.length > 0 && this.activeRequests.size < this.maxConcurrent) {
        const nextId = this.getNextRequest();
        if (!nextId) break;

        const request = this.requests.get(nextId);
        if (!request) {
          this.queue = this.queue.filter((id) => id !== nextId);
          continue;
        }

        // Check dependencies
        if (!this.areDependenciesMet(request)) {
          continue;
        }

        // Check resource availability
        if (!this.canAllocateResources(request)) {
          continue;
        }

        this.queue = this.queue.filter((id) => id !== nextId);
        this.activeRequests.add(nextId);

        this.executeRequest(request);
      }
    } finally {
      this.running = false;
    }
  }

  // Get next request from queue
  private getNextRequest(): string | null {
    for (const id of this.queue) {
      const request = this.requests.get(id);
      if (request && this.canAllocateResources(request)) {
        return id;
      }
    }
    return null;
  }

  // Check if dependencies are met
  private areDependenciesMet(request: ResourceRequest): boolean {
    if (!request.dependencies || request.dependencies.length === 0) {
      return true;
    }

    return request.dependencies.every((depId) => {
      const dep = this.requests.get(depId);
      return dep ? dep.completed : true;
    });
  }

  // Check if resources can be allocated
  private canAllocateResources(request: ResourceRequest): boolean {
    // Simple check - in real implementation, track actual resource usage
    const priorityWeight = this.getPriorityWeight(request.priority);

    // Critical requests can always run
    if (priorityWeight === 0) {
      return true;
    }

    // Check if we have capacity
    return this.activeRequests.size < this.maxConcurrent;
  }

  // Execute request
  private async executeRequest(request: ResourceRequest): Promise<void> {
    try {
      const startTime = Date.now();
      const result = await request.callback();
      const endTime = Date.now();

      request.completed = true;
      request.result = result;
      request.duration = endTime - startTime;

    } catch (error) {
      request.error = error instanceof Error ? error : new Error('Unknown error');
    } finally {
      this.activeRequests.delete(request.id);
      this.processQueue();
    }
  }

  // Get priority weight (0 = highest)
  private getPriorityWeight(priority: Priority): number {
    const weights: Record<Priority, number> = {
      CRITICAL: 0,
      HIGH: 1,
      NORMAL: 2,
      LOW: 3,
      BACKGROUND: 4,
    };
    return weights[priority];
  }

  // Get queue status
  getQueueStatus(): {
    pending: number;
    running: number;
    completed: number;
    cancelled: number;
  } {
    let pending = 0;
    let running = 0;
    let completed = 0;
    let cancelled = 0;

    this.requests.forEach((request) => {
      if (request.completed) {
        completed++;
      } else if (this.activeRequests.has(request.id)) {
        running++;
      } else if (!this.requests.has(request.id)) {
        cancelled++;
      } else {
        pending++;
      }
    });

    return { pending, running, completed, cancelled };
  }

  // Get resource usage
  getResourceUsage(): ResourceConstraint {
    // In a real implementation, measure actual resource usage
    // For now, return constraints as proxy
    return { ...this.constraints };
  }

  // Clear completed requests
  clearCompleted(): void {
    const toDelete: string[] = [];
    this.requests.forEach((request, id) => {
      if (request.completed) {
        toDelete.push(id);
      }
    });

    toDelete.forEach((id) => this.requests.delete(id));
  }

  // Clear all requests
  clearAll(): void {
    this.requests.clear();
    this.activeRequests.clear();
    this.queue = [];
  }

  // Preempt low priority requests for critical ones
  preemptForCritical(requestId: string): boolean {
    const request = this.requests.get(requestId);
    if (!request || request.priority !== 'CRITICAL') {
      return false;
    }

    // Find lowest priority running requests
    const preemptees: string[] = [];
    this.activeRequests.forEach((id) => {
      const req = this.requests.get(id);
      if (req && this.getPriorityWeight(req.priority) >= 3) {
        preemptees.push(id);
      }
    });

    // Preempt them
    preemptees.forEach((id) => {
      this.cancelRequest(id);
    });

    return preemptees.length > 0;
  }
}

// Create singleton instance
const resourcePrioritizer = new ResourcePrioritizer();

// High-priority operations shortcuts
export const criticalOperations = {
  // User interactions
  userInput: (id: string, callback: () => Promise<any>) => {
    resourcePrioritizer.addRequest({
      id,
      type: 'RENDER',
      priority: 'CRITICAL',
      estimatedTime: 16, // 1 frame at 60fps
      callback,
      createdAt: Date.now(),
    });
  },

  // Critical UI updates
  uiUpdate: (id: string, callback: () => Promise<any>) => {
    resourcePrioritizer.addRequest({
      id,
      type: 'RENDER',
      priority: 'HIGH',
      estimatedTime: 50,
      callback,
      createdAt: Date.now(),
    });
  },

  // API calls
  apiCall: (id: string, callback: () => Promise<any>) => {
    resourcePrioritizer.addRequest({
      id,
      type: 'NETWORK',
      priority: 'NORMAL',
      estimatedTime: 1000,
      callback,
      createdAt: Date.now(),
    });
  },

  // Data processing
  dataProcessing: (id: string, callback: () => Promise<any>) => {
    resourcePrioritizer.addRequest({
      id,
      type: 'CPU',
      priority: 'NORMAL',
      estimatedTime: 2000,
      callback,
      createdAt: Date.now(),
    });
  },

  // Background tasks
  backgroundTask: (id: string, callback: () => Promise<any>) => {
    resourcePrioritizer.addRequest({
      id,
      type: 'CPU',
      priority: 'BACKGROUND',
      estimatedTime: 5000,
      callback,
      createdAt: Date.now(),
    });
  },

  // File operations
  fileOperation: (id: string, callback: () => Promise<any>) => {
    resourcePrioritizer.addRequest({
      id,
      type: 'IO',
      priority: 'LOW',
      estimatedTime: 3000,
      callback,
      createdAt: Date.now(),
    });
  },
};

export { resourcePrioritizer };
export default ResourcePrioritizer;
