const TOKEN_ESTIMATOR_WASM = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x06, 0x01, 0x60, 0x01, 0x7f, 0x01, 0x7f,
  0x03, 0x02, 0x01, 0x00, 0x07, 0x0c, 0x01, 0x08, 0x65, 0x73, 0x74, 0x69, 0x6d, 0x61, 0x74, 0x65,
  0x00, 0x00, 0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x41, 0x04, 0x6d, 0x0b,
])

type Estimator = (chars: number) => number

let wasmReady: Promise<void> | null = null
let estimator: Estimator | null = null

const init = () => {
  if (!('WebAssembly' in window)) {
    estimator = (chars: number) => Math.max(1, Math.floor(chars / 4))
    return Promise.resolve()
  }

  if (!wasmReady) {
    wasmReady = WebAssembly.instantiate(TOKEN_ESTIMATOR_WASM)
      .then((instance) => {
        const fn = instance.instance.exports.estimate as (chars: number) => number
        estimator = (chars: number) => Math.max(1, fn(chars))
      })
      .catch(() => {
        estimator = (chars: number) => Math.max(1, Math.floor(chars / 4))
      })
  }

  return wasmReady
}

export const estimateTokens = (chars: number): number => {
  if (!estimator) {
    void init()
    return Math.max(1, Math.floor(chars / 4))
  }
  return estimator(chars)
}
