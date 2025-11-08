// Image optimization utilities

export interface ImageOptimizationOptions {
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  width?: number;
  height?: number;
  dpr?: number;
  lazy?: boolean;
  placeholder?: 'blur' | 'empty';
}

export interface ResponsiveImageSizes {
  mobile: number;
  tablet: number;
  desktop: number;
}

const DEFAULT_SIZES: ResponsiveImageSizes = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
};

const WEBP_SUPPORT = checkWebPSupport();
const AVIF_SUPPORT = checkAVIFSupport();

// Check WebP support
function checkWebPSupport(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

// Check AVIF support
function checkAVIFSupport(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
}

// Get optimal image format
export function getOptimalFormat(): 'avif' | 'webp' | 'jpeg' {
  if (AVIF_SUPPORT) return 'avif';
  if (WEBP_SUPPORT) return 'webp';
  return 'jpeg';
}

// Generate responsive image srcset
export function generateSrcSet(
  src: string,
  sizes: Partial<ResponsiveImageSizes> = {},
  options: ImageOptimizationOptions = {}
): string {
  const { quality = 80 } = options;
  const actualSizes = { ...DEFAULT_SIZES, ...sizes };
  const format = getOptimalFormat();
  const dpr = options.dpr || window.devicePixelRatio || 1;

  const srcsetParts: string[] = [];

  for (const [sizeName, width] of Object.entries(actualSizes)) {
    const optimizedSrc = optimizeImageSrc(src, {
      width,
      format,
      quality,
      dpr,
    });
    srcsetParts.push(`${optimizedSrc} ${width}w`);
  }

  return srcsetParts.join(', ');
}

// Optimize image source URL
export function optimizeImageSrc(
  src: string,
  options: ImageOptimizationOptions = {}
): string {
  const { width, height, format, quality = 80 } = options;

  // Add optimization parameters to URL
  const url = new URL(src, window.location.origin);

  if (width) url.searchParams.set('w', String(width));
  if (height) url.searchParams.set('h', String(height));
  if (format) url.searchParams.set('f', format);
  url.searchParams.set('q', String(quality));

  return url.toString();
}

// Generate picture element markup
export function generatePictureMarkup(
  src: string,
  alt: string,
  options: ImageOptimizationOptions = {}
): string {
  const { placeholder = 'empty', lazy = true } = options;
  const loading = lazy ? 'lazy' : 'eager';
  const decoding = 'async';

  const avifSrc = optimizeImageSrc(src, { ...options, format: 'avif' });
  const webpSrc = optimizeImageSrc(src, { ...options, format: 'webp' });
  const jpegSrc = optimizeImageSrc(src, { ...options, format: 'jpeg' });
  const srcsetAvif = generateSrcSet(src, {}, { ...options, format: 'avif' });
  const srcsetWebp = generateSrcSet(src, {}, { ...options, format: 'webp' });
  const srcsetJpeg = generateSrcSet(src, {}, { ...options, format: 'jpeg' });

  return `
    <picture>
      <source type="image/avif" srcset="${srcsetAvif}" />
      <source type="image/webp" srcset="${srcsetWebp}" />
      <img
        src="${jpegSrc}"
        srcset="${srcsetJpeg}"
        alt="${alt}"
        loading="${loading}"
        decoding="${decoding}"
        class="${options.placeholder === 'blur' ? 'blur-sm' : ''}"
      />
    </picture>
  `;
}

// Image component with optimization
export function createOptimizedImage(
  src: string,
  alt: string,
  options: ImageOptimizationOptions = {}
): HTMLImageElement {
  const img = document.createElement('img');
  const { width, height, lazy = true } = options;
  const loading = lazy ? 'lazy' : 'eager';

  img.src = optimizeImageSrc(src, options);
  img.alt = alt;
  img.loading = loading as any;
  img.decoding = 'async';

  if (width) img.width = width;
  if (height) img.height = height;

  // Add srcset for responsive images
  if (!options.width) {
    img.srcset = generateSrcSet(src, {}, options);
    img.sizes = '(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw';
  }

  // Add blur placeholder
  if (options.placeholder === 'blur') {
    img.style.filter = 'blur(5px)';
    img.style.transition = 'filter 0.3s';

    img.onload = () => {
      img.style.filter = 'blur(0)';
    };
  }

  return img;
}

// Preload critical images
export function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Preload multiple images
export async function preloadImages(urls: string[]): Promise<HTMLImageElement[]> {
  const promises = urls.map((url) => preloadImage(url));
  return Promise.all(promises);
}

// Intersection Observer for lazy loading
export function setupLazyImageLoading(
  img: HTMLImageElement,
  options: ImageOptimizationOptions = {}
): void {
  if (!('IntersectionObserver' in window)) {
    // Fallback: load immediately
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target as HTMLImageElement;
          target.src = optimizeImageSrc(target.dataset.src || '', options);
          if (target.dataset.srcset) {
            target.srcset = target.dataset.srcset;
          }
          observer.unobserve(target);
        }
      });
    },
    {
      rootMargin: '50px',
    }
  );

  img.dataset.src = img.src;
  if (img.srcset) {
    img.dataset.srcset = img.srcset;
  }
  img.src = ''; // Clear src initially
  observer.observe(img);
}

// Generate image placeholder
export async function generateImagePlaceholder(
  src: string,
  size: number = 20
): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#9ca3af';
      ctx.font = `${size / 2}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AIO', size / 2, size / 2);
    }

    resolve(canvas.toDataURL());
  });
}

// Compress image on client side
export async function compressImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<File> {
  const { quality = 0.8, format } = options;

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: `image/${format || 'jpeg'}`,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        `image/${format || 'jpeg'}`,
        quality
      );
    };

    img.src = URL.createObjectURL(file);
  });
}

// Check if image is cached
export function isImageCached(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

// Get image dimensions
export function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = src;
  });
}
