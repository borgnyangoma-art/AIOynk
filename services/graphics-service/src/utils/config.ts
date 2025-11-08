export default {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  STORAGE_DIR: process.env.STORAGE_DIR || '../../storage/graphics',
  MAX_CANVAS_SIZE: parseInt(process.env.MAX_CANVAS_SIZE || '10000', 10),
  MAX_ELEMENTS: parseInt(process.env.MAX_ELEMENTS || '1000', 10),
  ALLOWED_FORMATS: ['png', 'jpg', 'jpeg', 'webp', 'svg'],
  QUALITY_MIN: 0.1,
  QUALITY_MAX: 1.0,
};
