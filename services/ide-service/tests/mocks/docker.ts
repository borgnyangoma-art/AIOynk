import { PassThrough } from 'stream'

export const createDockerMock = () => {
  return {
    __esModule: true,
    default: {
      createContainer: jest.fn(async () => {
        const stream = new PassThrough()
        process.nextTick(() => {
          stream.write('sandbox-output')
          stream.end()
        })
        return {
          attach: jest.fn().mockResolvedValue(stream),
          start: jest.fn().mockResolvedValue(undefined),
          wait: jest.fn().mockResolvedValue({ StatusCode: 0 }),
          stop: jest.fn().mockResolvedValue(undefined),
        }
      }),
      modem: {
        demuxStream: (stream: NodeJS.ReadableStream, stdout: NodeJS.WritableStream, stderr: NodeJS.WritableStream) => {
          stream.on('data', (chunk) => stdout.write(chunk))
          stream.on('end', () => {
            stdout.end()
            stderr.end()
          })
        },
      },
    },
  }
}
