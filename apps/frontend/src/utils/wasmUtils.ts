// WebAssembly utilities for heavy computations

export interface WASMModule {
  initialized: boolean;
  memory?: WebAssembly.Memory;
  exports?: Record<string, WebAssembly.ExportValue>;
}

export interface WASMConfig {
  url: string;
  imports?: WebAssembly.Imports;
  type?: 'arrayBuffer' | 'base64' | 'url';
}

class WASMManager {
  private modules: Map<string, WASMModule> = new Map();

  // Load WebAssembly module
  async loadModule(id: string, config: WASMConfig): Promise<WASMModule> {
    if (this.modules.has(id)) {
      return this.modules.get(id)!;
    }

    try {
      let binary: ArrayBuffer;

      if (config.type === 'base64') {
        binary = this.base64ToArrayBuffer(config.url);
      } else if (config.type === 'arrayBuffer') {
        binary = config.url as unknown as ArrayBuffer;
      } else {
        // Fetch from URL
        const response = await fetch(config.url);
        if (!response.ok) {
          throw new Error(`Failed to load WASM: ${response.statusText}`);
        }
        binary = await response.arrayBuffer();
      }

      const { instance } = await WebAssembly.instantiate(binary, config.imports);

      const module: WASMModule = {
        initialized: true,
        memory: instance.exports.memory as WebAssembly.Memory,
        exports: instance.exports as Record<string, WebAssembly.ExportValue>,
      };

      this.modules.set(id, module);
      return module;
    } catch (error) {
      console.error(`Failed to load WASM module ${id}:`, error);
      throw error;
    }
  }

  // Get loaded module
  getModule(id: string): WASMModule | undefined {
    return this.modules.get(id);
  }

  // Unload module
  unloadModule(id: string): void {
    this.modules.delete(id);
  }

  // Check WebAssembly support
  static isSupported(): boolean {
    return typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
  }

  // Convert base64 to ArrayBuffer
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Get memory usage
  getMemoryUsage(): { total: number; used: number; modules: number } {
    let total = 0;
    let used = 0;

    this.modules.forEach((module) => {
      if (module.memory) {
        total += module.memory.buffer.byteLength;
        used += module.memory.buffer.byteLength;
      }
    });

    return { total, used, modules: this.modules.size };
  }

  // Clear all modules
  clear(): void {
    this.modules.clear();
  }
}

const wasmManager = new WASMManager();

// Predefined WASM modules for common computations
export class ImageProcessor {
  private module: WASMModule | null = null;

  async initialize(url: string): Promise<void> {
    this.module = await wasmManager.loadModule('image-processor', { url });
  }

  // Resize image using WASM
  async resizeImage(
    imageData: Uint8Array,
    width: number,
    height: number,
    newWidth: number,
    newHeight: number
  ): Promise<Uint8Array> {
    if (!this.module?.exports?.resize_image) {
      throw new Error('Image processing module not initialized');
    }

    const resizeFunc = this.module.exports.resize_image as CallableFunction;
    const inputPtr = this.allocateMemory(imageData.length);
    const outputPtr = this.allocateMemory(newWidth * newHeight * 4);

    // Copy input to WASM memory
    const memory = new Uint8Array(this.module.memory!.buffer);
    memory.set(imageData, inputPtr);

    // Call WASM function
    const result = resizeFunc(
      inputPtr,
      outputPtr,
      width,
      height,
      newWidth,
      newHeight
    );

    // Copy output from WASM memory
    const output = memory.slice(outputPtr, outputPtr + newWidth * newHeight * 4);

    // Free memory
    this.freeMemory(inputPtr);
    this.freeMemory(outputPtr);

    return output;
  }

  // Apply filter to image
  async applyFilter(
    imageData: Uint8Array,
    width: number,
    height: number,
    filterType: number
  ): Promise<Uint8Array> {
    if (!this.module?.exports?.apply_filter) {
      throw new Error('Image processing module not initialized');
    }

    const filterFunc = this.module.exports.apply_filter as CallableFunction;
    const inputPtr = this.allocateMemory(imageData.length);
    const outputPtr = this.allocateMemory(imageData.length);

    // Copy input to WASM memory
    const memory = new Uint8Array(this.module.memory!.buffer);
    memory.set(imageData, inputPtr);

    // Call WASM function
    filterFunc(inputPtr, outputPtr, width, height, filterType);

    // Copy output from WASM memory
    const output = memory.slice(outputPtr, outputPtr + imageData.length);

    // Free memory
    this.freeMemory(inputPtr);
    this.freeMemory(outputPtr);

    return output;
  }

  private allocateMemory(size: number): number {
    if (!this.module?.memory) {
      throw new Error('WASM memory not available');
    }

    const allocator = this.module.exports.malloc as CallableFunction;
    return allocator(size) as number;
  }

  private freeMemory(ptr: number): void {
    if (!this.module?.exports?.free) {
      return;
    }

    const freeFunc = this.module.exports.free as CallableFunction;
    freeFunc(ptr);
  }
}

export class MathProcessor {
  private module: WASMModule | null = null;

  async initialize(url: string): Promise<void> {
    this.module = await wasmManager.loadModule('math-processor', { url });
  }

  // Fast Fourier Transform
  async fft(real: Float32Array, imaginary: Float32Array): Promise<{ real: Float32Array; imaginary: Float32Array }> {
    if (!this.module?.exports?.fft) {
      throw new Error('Math processor module not initialized');
    }

    const fftFunc = this.module.exports.fft as CallableFunction;

    const realPtr = this.allocateFloat32Array(real);
    const imagPtr = this.allocateFloat32Array(imaginary);

    fftFunc(realPtr, imagPtr, real.length);

    const resultReal = this.getFloat32Array(realPtr, real.length);
    const resultImag = this.getFloat32Array(imagPtr, imaginary.length);

    this.freeMemory(realPtr);
    this.freeMemory(imagPtr);

    return { real: resultReal, imaginary: resultImag };
  }

  // Matrix multiplication
  async multiplyMatrices(
    a: Float32Array,
    b: Float32Array,
    rowsA: number,
    colsA: number,
    colsB: number
  ): Promise<Float32Array> {
    if (!this.module?.exports?.multiply_matrices) {
      throw new Error('Math processor module not initialized');
    }

    const multiplyFunc = this.module.exports.multiply_matrices as CallableFunction;

    const aPtr = this.allocateFloat32Array(a);
    const bPtr = this.allocateFloat32Array(b);
    const resultPtr = this.allocateFloat32Array(new Float32Array(rowsA * colsB));

    multiplyFunc(aPtr, bPtr, resultPtr, rowsA, colsA, colsB);

    const result = this.getFloat32Array(resultPtr, rowsA * colsB);

    this.freeMemory(aPtr);
    this.freeMemory(bPtr);
    this.freeMemory(resultPtr);

    return result;
  }

  private allocateFloat32Array(array: Float32Array): number {
    if (!this.module?.memory) {
      throw new Error('WASM memory not available');
    }

    const allocator = this.module.exports.malloc as CallableFunction;
    const ptr = allocator(array.length * 4) as number;

    const memory = new Float32Array(this.module.memory.buffer);
    memory.set(array, ptr / 4);

    return ptr;
  }

  private getFloat32Array(ptr: number, length: number): Float32Array {
    if (!this.module?.memory) {
      throw new Error('WASM memory not available');
    }

    const memory = new Float32Array(this.module.memory.buffer);
    return memory.slice(ptr / 4, ptr / 4 + length);
  }

  private allocateMemory(size: number): number {
    if (!this.module?.memory) {
      throw new Error('WASM memory not available');
    }

    const allocator = this.module.exports.malloc as CallableFunction;
    return allocator(size) as number;
  }

  private freeMemory(ptr: number): void {
    if (!this.module?.exports?.free) {
      return;
    }

    const freeFunc = this.module.exports.free as CallableFunction;
    freeFunc(ptr);
  }
}

export class CryptographyProcessor {
  private module: WASMModule | null = null;

  async initialize(url: string): Promise<void> {
    this.module = await wasmManager.loadModule('crypto-processor', { url });
  }

  // Hash data
  async hash(data: Uint8Array, algorithm: 'sha256' | 'md5'): Promise<Uint8Array> {
    if (!this.module?.exports?.hash) {
      throw new Error('Cryptography module not initialized');
    }

    const hashFunc = this.module.exports.hash as CallableFunction;

    const dataPtr = this.allocateMemory(data.length);
    const outputPtr = this.allocateMemory(32); // SHA-256 is 32 bytes

    // Copy data to WASM memory
    const memory = new Uint8Array(this.module.memory!.buffer);
    memory.set(data, dataPtr);

    hashFunc(dataPtr, data.length, outputPtr, algorithm === 'sha256' ? 1 : 0);

    // Copy output from WASM memory
    const hash = memory.slice(outputPtr, outputPtr + 32);

    this.freeMemory(dataPtr);
    this.freeMemory(outputPtr);

    return hash;
  }

  // Encrypt data
  async encrypt(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
    if (!this.module?.exports?.encrypt) {
      throw new Error('Cryptography module not initialized');
    }

    const encryptFunc = this.module.exports.encrypt as CallableFunction;

    const dataPtr = this.allocateMemory(data.length);
    const keyPtr = this.allocateMemory(key.length);
    const outputPtr = this.allocateMemory(data.length);

    const memory = new Uint8Array(this.module.memory!.buffer);
    memory.set(data, dataPtr);
    memory.set(key, keyPtr);

    encryptFunc(dataPtr, keyPtr, data.length, outputPtr);

    const encrypted = memory.slice(outputPtr, outputPtr + data.length);

    this.freeMemory(dataPtr);
    this.freeMemory(keyPtr);
    this.freeMemory(outputPtr);

    return encrypted;
  }

  private allocateMemory(size: number): number {
    if (!this.module?.memory) {
      throw new Error('WASM memory not available');
    }

    const allocator = this.module.exports.malloc as CallableFunction;
    return allocator(size) as number;
  }

  private freeMemory(ptr: number): void {
    if (!this.module?.exports?.free) {
      return;
    }

    const freeFunc = this.module.exports.free as CallableFunction;
    freeFunc(ptr);
  }
}

export { wasmManager };
export default WASMManager;
