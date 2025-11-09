import { VideoClip, VideoProject } from './types'

const defaultDuration = (clips: VideoClip[]) => {
  if (!clips.length) return 0
  return Math.max(...clips.map((clip) => clip.position + clip.duration))
}

export const syncTimelineDuration = (project: VideoProject) => {
  project.timeline.duration = Math.max(defaultDuration(project.clips), project.timeline.duration)
}

export const buildTimeline = (project: VideoProject) => {
  syncTimelineDuration(project)
  const frames = Math.max(1, Math.round(project.timeline.duration * project.timeline.fps))

  const tracks = project.clips.reduce<Record<number, VideoClip[]>>((acc, clip) => {
    acc[clip.track] = acc[clip.track] || []
    acc[clip.track].push(clip)
    return acc
  }, {})

  return {
    duration: project.timeline.duration,
    fps: project.timeline.fps,
    frames,
    resolution: project.timeline.resolution,
    markers: project.timeline.markers,
    tracks: Object.entries(tracks)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([track, clips]) => ({
        track: Number(track),
        clips: clips.map((clip) => ({
          id: clip.id,
          fileName: clip.fileName,
          start: clip.position,
          end: clip.position + clip.duration,
          duration: clip.duration,
          enabledEffects: clip.effects.filter((effect) => effect.enabled).length,
        })),
      })),
  }
}
