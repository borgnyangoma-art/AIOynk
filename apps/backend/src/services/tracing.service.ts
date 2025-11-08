import { Tracer } from 'opentracing';
import { initTracer } from 'jaeger-client';
import { Tags } from 'opentracing';

let tracer: Tracer;

/**
 * Initialize Jaeger tracer
 */
export const initializeTracer = (): Tracer => {
  const config = {
    serviceName: 'aio-creative-hub-backend',
    reporter: {
      logSpans: true,
      agentHost: process.env.JAEGER_AGENT_HOST || 'jaeger',
      agentPort: process.env.JAEGER_AGENT_PORT ? parseInt(process.env.JAEGER_AGENT_PORT) : 6832,
    },
    sampler: {
      type: 'const',
      param: 1, // Sample all traces for development
    },
  };

  const options = {
    logger: {
      info: (msg: string) => console.log('[JAEGER]', msg),
      error: (msg: string) => console.error('[JAEGER ERROR]', msg),
    },
  };

  tracer = initTracer(config, options);
  return tracer;
};

/**
 * Get the initialized tracer
 */
export const getTracer = (): Tracer => {
  if (!tracer) {
    tracer = initializeTracer();
  }
  return tracer;
};

/**
 * Create a new span
 */
export const createSpan = (operationName: string, parentSpan?: any) => {
  const tracer = getTracer();
  const span = tracer.startSpan(operationName, {
    childOf: parentSpan,
  });

  return span;
};

/**
 * Extract span context from carrier
 */
export const extractSpanContext = (carrier: any) => {
  const tracer = getTracer();
  return tracer.extract('http_headers', carrier);
};

/**
 * Inject span context into carrier
 */
export const injectSpanContext = (span: any, carrier: any) => {
  const tracer = getTracer();
  tracer.inject(span, 'http_headers', carrier);
};

/**
 * Add tags to span
 */
export const addSpanTags = (span: any, tags: Record<string, any>) => {
  Object.entries(tags).forEach(([key, value]) => {
    span.setTag(key, value);
  });
};

/**
 * Add logs to span
 */
export const addSpanLogs = (span: any, logs: Record<string, any>) => {
  span.log(logs);
};

/**
 * Finish span
 */
export const finishSpan = (span: any, error?: Error) => {
  if (error) {
    span.setTag(Tags.ERROR, true);
    span.log({
      event: 'error',
      message: error.message,
      stack: error.stack,
    });
  }
  span.finish();
};

export default {
  initializeTracer,
  getTracer,
  createSpan,
  extractSpanContext,
  injectSpanContext,
  addSpanTags,
  addSpanLogs,
  finishSpan,
  Tags,
};
