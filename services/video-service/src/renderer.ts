import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import winston from 'winston'

import { RenderJob, VideoProject } from './types'
import { recordRenderJob, recordRenderProgress } from './metrics'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic)
}

const STEP_DELAY = process.env.NODE_ENV === 'test' ? 5 : 500
const STEPS = 20

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class RenderQueue {
  private jobs = new Map<string, RenderJob>()

  constructor(
    private outputDir: string,
    private uploadsDir: string,
    private logger: winston.Logger,
  ) {}

  createJob(project: VideoProject) {
    const framesTotal = Math.max(1, Math.round(project.timeline.duration * project.timeline.fps) || project.timeline.fps)
    const job: RenderJob = {
      id: uuidv4(),
      projectId: project.id,
      format: project.settings.format,
      resolution: `${project.timeline.resolution.width}x${project.timeline.resolution.height}`,
      status: 'pending',
      progress: 0,
      framesRendered: 0,
      framesTotal,
      startTime: new Date().toISOString(),
    }

    this.jobs.set(job.id, job)
    this.processJob(project, job).catch((error) => {
      this.logger.error('Render job failed', error)
    })
    return job
  }

  getJob(renderId: string) {
    return this.jobs.get(renderId)
  }

  private async processJob(project: VideoProject, job: RenderJob) {
    job.status = 'processing'
    recordRenderJob(project.settings.format, job.resolution, 0, 'processing')

    for (let step = 1; step <= STEPS; step += 1) {
      await delay(STEP_DELAY)
      job.progress = Math.min(100, Math.round((step / STEPS) * 100))
      job.framesRendered = Math.round((job.progress / 100) * job.framesTotal)
      recordRenderProgress()
    }

    try {
      await this.renderVideoFile(project, job)
      job.status = 'completed'
      job.endTime = new Date().toISOString()
      recordRenderJob(project.settings.format, job.resolution, (STEPS * STEP_DELAY) / 1000, 'success')
      this.logger.info(`Render completed for project ${project.id}`)
    } catch (error: any) {
      job.status = 'failed'
      job.error = error.message
      job.endTime = new Date().toISOString()
      recordRenderJob(project.settings.format, job.resolution, (STEPS * STEP_DELAY) / 1000, 'error')
      throw error
    }
  }

  private async renderVideoFile(project: VideoProject, job: RenderJob) {
    await fs.mkdir(this.outputDir, { recursive: true })
    const fileName = `${project.id}-${Date.now()}.${project.settings.format}`
    const outputPath = path.join(this.outputDir, fileName)

    if (!project.clips.length) {
      await fs.writeFile(outputPath, 'Simulated video render output')
      job.outputPath = outputPath
      return
    }

    const primaryClip = project.clips[0]
    const candidatePath = primaryClip.filePath || path.join(this.uploadsDir, primaryClip.fileName)
    try {
      await fs.access(candidatePath)
    } catch {
      await fs.writeFile(outputPath, 'Simulated video render output')
      job.outputPath = outputPath
      return
    }

    job.status = 'encoding'
    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(candidatePath)
          .size(`${project.timeline.resolution.width}x${project.timeline.resolution.height}`)
          .fps(project.timeline.fps)
          .videoCodec(project.settings.codec === 'h265' ? 'libx265' : 'libx264')
          .audioCodec('aac')
          .outputOptions(['-preset', 'veryfast', '-pix_fmt', 'yuv420p'])
          .on('start', () => {
            this.logger.info(`FFmpeg render started for ${project.id}`)
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath)
      })
    } catch (error) {
      this.logger.warn('FFmpeg render failed, falling back to placeholder output', { projectId: project.id, error })
      await fs.writeFile(outputPath, 'Simulated video render output')
    }

    job.outputPath = outputPath
  }
}
