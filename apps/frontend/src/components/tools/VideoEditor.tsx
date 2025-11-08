import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Download, Scissors, Copy, Volume2 } from 'lucide-react';

interface Clip {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  color: string;
}

const VideoEditor: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(60);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([
    { id: '1', name: 'Clip 1', startTime: 0, duration: 10, color: '#3b82f6' },
    { id: '2', name: 'Clip 2', startTime: 10, duration: 15, color: '#10b981' },
    { id: '3', name: 'Clip 3', startTime: 25, duration: 12, color: '#f59e0b' },
    { id: '4', name: 'Clip 4', startTime: 37, duration: 8, color: '#ef4444' },
  ]);

  const timelineWidth = 800;
  const pixelsPerSecond = timelineWidth / duration;

  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    const updateTime = () => {
      setCurrentTime(video.currentTime);
    };

    const updateDuration = () => {
      setDuration(video.duration || 60);
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const stop = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const skipBackward = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, currentTime - 10);
  };

  const skipForward = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.min(duration, currentTime + 10);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / timelineWidth) * duration;

    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleClipDrag = (clipId: string, newStartTime: number) => {
    setClips(clips.map(clip =>
      clip.id === clipId ? { ...clip, startTime: Math.max(0, newStartTime) } : clip
    ));
  };

  const trimClip = (clipId: string, newDuration: number) => {
    setClips(clips.map(clip =>
      clip.id === clipId ? { ...clip, duration: Math.max(1, newDuration) } : clip
    ));
  };

  const deleteClip = (clipId: string) => {
    setClips(clips.filter(clip => clip.id !== clipId));
    if (selectedClip === clipId) {
      setSelectedClip(null);
    }
  };

  const duplicateClip = (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    const newClip: Clip = {
      ...clip,
      id: `${Date.now()}`,
      name: `${clip.name} Copy`,
      startTime: clip.startTime + clip.duration,
    };
    setClips([...clips, newClip]);
  };

  const exportVideo = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1920;
    canvas.height = 1080;

    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'video-frame.png';
    link.href = dataURL;
    link.click();
  };

  const getClipAtTime = (time: number) => {
    return clips.find(clip => time >= clip.startTime && time < clip.startTime + clip.duration);
  };

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <button
            onClick={skipBackward}
            className="rounded bg-gray-200 p-2 hover:bg-gray-300"
            title="Skip Backward 10s"
          >
            <SkipBack size={20} />
          </button>
          <button
            onClick={togglePlay}
            className="rounded bg-blue-600 p-2 text-white hover:bg-blue-700"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={stop}
            className="rounded bg-gray-200 p-2 hover:bg-gray-300"
            title="Stop"
          >
            <Square size={20} />
          </button>
          <button
            onClick={skipForward}
            className="rounded bg-gray-200 p-2 hover:bg-gray-300"
            title="Skip Forward 10s"
          >
            <SkipForward size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Volume2 size={20} className="text-gray-600" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Speed:</label>
          <select
            value={playbackRate}
            onChange={(e) => {
              const rate = parseFloat(e.target.value);
              setPlaybackRate(rate);
              if (videoRef.current) {
                videoRef.current.playbackRate = rate;
              }
            }}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={exportVideo}
            className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            className="max-w-full max-h-full"
            poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080'%3E%3Crect width='1920' height='1080' fill='%23000'/%3E%3Ctext x='50%25' y='50%25' font-size='48' fill='white' text-anchor='middle' dy='.3em'%3EVideo Preview%3C/text%3E%3C/svg%3E"
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="border-t border-gray-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} / {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
            </div>
            <div className="text-sm text-gray-600">
              {clips.length} clips
            </div>
          </div>

          <div
            ref={timelineRef}
            onClick={handleTimelineClick}
            className="relative h-20 bg-gray-100 rounded cursor-pointer select-none"
            style={{ width: `${timelineWidth}px` }}
          >
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-0.5 bg-gray-400" />
            </div>

            {Array.from({ length: Math.floor(duration) + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full border-l border-gray-300"
                style={{ left: `${i * pixelsPerSecond}px` }}
              >
                <span className="absolute -top-6 left-0 text-xs text-gray-500">
                  {i}s
                </span>
              </div>
            ))}

            {clips.map((clip) => (
              <div
                key={clip.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedClip(clip.id);
                }}
                className={`absolute top-4 h-12 rounded cursor-move flex items-center justify-center text-white text-sm font-medium shadow-lg transition-all ${
                  selectedClip === clip.id ? 'ring-2 ring-blue-500' : ''
                }`}
                style={{
                  left: `${clip.startTime * pixelsPerSecond}px`,
                  width: `${clip.duration * pixelsPerSecond}px`,
                  backgroundColor: clip.color,
                }}
              >
                {clip.name}

                <div className="absolute -bottom-1 left-0 right-0 h-1 bg-white bg-opacity-50 rounded-b cursor-ns-resize" />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteClip(clip.id);
                  }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}

            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
              style={{ left: `${currentTime * pixelsPerSecond}px` }}
            >
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rotate-45" />
            </div>
          </div>

          {selectedClip && (
            <div className="mt-4 flex items-center gap-4 p-3 bg-gray-50 rounded">
              {(() => {
                const clip = clips.find(c => c.id === selectedClip);
                if (!clip) return null;

                return (
                  <>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: clip.color }}
                      />
                      <span className="font-medium">{clip.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Start:</label>
                      <span className="text-sm font-mono">{clip.startTime.toFixed(1)}s</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Duration:</label>
                      <span className="text-sm font-mono">{clip.duration.toFixed(1)}s</span>
                    </div>

                    <button
                      onClick={() => duplicateClip(clip.id)}
                      className="flex items-center gap-1 rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300"
                    >
                      <Copy size={16} />
                      Duplicate
                    </button>

                    <button
                      className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                    >
                      <Scissors size={16} />
                      Trim
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoEditor;
