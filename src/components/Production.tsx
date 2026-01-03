'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Script, Scene, AspectRatio, VideoModel, VoiceMode } from '@/types';
import { composeAndExportVideo } from '@/utils/videoCompositor';

interface ProductionProps {
  script: Script;
  frames: string[];
  generatedVideos: Record<number, string>;
  generatingVideoIds: number[];
  masterAudioUrl: string | null;
  backgroundMusicUrl: string | null;
  isGeneratingAudio: boolean;
  isGeneratingMusic: boolean;
  isGeneratingFullMovie: boolean;
  onGenerateVideo: (sceneId: number) => void;
  onGenerateFullMovie: () => void;
  onBackToStoryboard?: () => void;
  aspectRatio: AspectRatio;
  videoModel: VideoModel;
  voiceMode: VoiceMode;
}

// Video duration per clip based on model
const CLIP_DURATION_BY_MODEL: Record<VideoModel, number> = {
  'veo-3.1': 8,
  'seedance-1.5': 4,
};

const parseDuration = (timeRange: string): number => {
  try {
    const parts = timeRange.split('-').map(t => t.trim());
    if (parts.length < 2) return 5;

    const parseTime = (t: string) => {
      const segments = t.split(':').map(Number);
      if (segments.length === 2) return segments[0] * 60 + segments[1];
      if (segments.length === 3) return segments[0] * 3600 + segments[1] * 60 + segments[2];
      return 0;
    };

    const start = parseTime(parts[0]);
    const end = parseTime(parts[1]);
    const duration = end - start;
    return duration > 0 ? duration : 5;
  } catch {
    return 5;
  }
};

const MoviePlayer: React.FC<{
  scenes: Scene[];
  videoUrls: Record<number, string>;
  audioUrl: string | null;
  musicUrl: string | null;
  onClose: () => void;
  clipDuration: number;
}> = ({ scenes, videoUrls, audioUrl, musicUrl, onClose, clipDuration }) => {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [progress, setProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const totalDurationRef = useRef<number>(0);

  // Calculate total duration based on clip duration
  useEffect(() => {
    const scenesWithVideo = scenes.filter(s => videoUrls[s.id]);
    totalDurationRef.current = scenesWithVideo.length * clipDuration;
  }, [scenes, videoUrls, clipDuration]);

  useEffect(() => {
    let animationFrame: number;

    const update = () => {
      if (isPlaying) {
        const scenesWithVideo = scenes.filter(s => videoUrls[s.id]);
        const totalVideoDuration = scenesWithVideo.length * clipDuration;

        // Calculate progress based on video duration
        const videoProgress = currentSceneIndex * clipDuration;
        const currentVideo = videoRefs.current[scenesWithVideo[currentSceneIndex]?.id];
        if (currentVideo) {
          const effectiveTime = videoProgress + Math.min(currentVideo.currentTime, clipDuration);
          setProgress((effectiveTime / totalVideoDuration) * 100);
        }
      }
      animationFrame = requestAnimationFrame(update);
    };

    if (isPlaying) {
      animationFrame = requestAnimationFrame(update);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, currentSceneIndex, scenes, videoUrls, clipDuration]);

  useEffect(() => {
    if (!isPlaying) return;

    // Only iterate through scenes that have videos
    const scenesWithVideo = scenes.filter(s => videoUrls[s.id]);
    const currentScene = scenesWithVideo[currentSceneIndex];
    if (!currentScene) return;

    const video = videoRefs.current[currentScene.id];

    if (video) {
      video.currentTime = 0;
      video.volume = 0.4; // SFX at 40% volume
      video.play().catch(e => console.warn("Video play failed", e));

      // When video ends, advance to next scene
      video.onended = () => {
        if (currentSceneIndex < scenesWithVideo.length - 1) {
          setCurrentSceneIndex(prev => prev + 1);
        } else {
          // End of movie - all videos played
          setIsPlaying(false);
          setHasStarted(false);
          setCurrentSceneIndex(0);
          audioRef.current?.pause();
          musicRef.current?.pause();
        }
      };
    }

    // Pause all other videos
    Object.keys(videoRefs.current).forEach(key => {
      const id = Number(key);
      if (id !== currentScene.id && videoRefs.current[id]) {
        videoRefs.current[id]?.pause();
      }
    });
  }, [currentSceneIndex, isPlaying, scenes, videoUrls]);

  // Get scenes that have videos for playback
  const scenesWithVideo = scenes.filter(s => videoUrls[s.id]);

  const togglePlay = () => {
    if (!hasStarted) {
      setHasStarted(true);
      setIsPlaying(true);

      if (audioRef.current) audioRef.current.play();
      if (musicRef.current) {
        musicRef.current.volume = 0.3;
        musicRef.current.play();
      }
    } else {
      if (isPlaying) {
        audioRef.current?.pause();
        musicRef.current?.pause();
        Object.values(videoRefs.current).forEach(v => v?.pause());
      } else {
        audioRef.current?.play();
        musicRef.current?.play();
        const currentScene = scenesWithVideo[currentSceneIndex];
        if (currentScene) {
          const vid = videoRefs.current[currentScene.id];
          if (vid) vid.play();
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <div className="relative w-full h-full max-w-6xl max-h-screen flex items-center justify-center bg-black overflow-hidden">

        {scenesWithVideo.map((scene, idx) => {
          const url = videoUrls[scene.id];

          return (
            <video
              key={scene.id}
              ref={(el) => { videoRefs.current[scene.id] = el; }}
              src={url}
              className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-0 ${idx === currentSceneIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
              playsInline
              // No loop - we use onended to advance to next scene
            />
          );
        })}

        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => {
              setIsPlaying(false);
              setHasStarted(false);
              setCurrentSceneIndex(0);
              if (musicRef.current) {
                musicRef.current.pause();
                musicRef.current.currentTime = 0;
              }
            }}
          />
        )}

        {musicUrl && (
          <audio
            ref={musicRef}
            src={musicUrl}
            loop
          />
        )}

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800 z-30">
          <div
            className="h-full bg-red-600 transition-all duration-200 ease-linear"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>

        <div className={`absolute bottom-10 left-0 right-0 flex justify-center gap-4 transition-opacity duration-500 ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'} z-20`}>
          <button
            onClick={togglePlay}
            className="bg-white/20 backdrop-blur-md hover:bg-white/40 text-white rounded-full p-4 transition-all"
          >
            {isPlaying ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
            ) : (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>

          <button
            onClick={onClose}
            className="bg-red-600/80 hover:bg-red-500 text-white rounded-full p-4 transition-all"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {!hasStarted && (
          <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/60 cursor-pointer" onClick={togglePlay}>
            <div className="text-center">
              <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-900/50">
                <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-wide">Play Full Movie</h2>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Production: React.FC<ProductionProps> = ({
  script,
  frames,
  generatedVideos,
  generatingVideoIds,
  masterAudioUrl,
  backgroundMusicUrl,
  isGeneratingMusic,
  isGeneratingFullMovie,
  onGenerateVideo,
  onGenerateFullMovie,
  onBackToStoryboard,
  aspectRatio,
  videoModel,
  voiceMode
}) => {
  const clipDuration = CLIP_DURATION_BY_MODEL[videoModel];
  const isSeedance = videoModel === 'seedance-1.5';
  const [showPlayer, setShowPlayer] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [playingAudio, setPlayingAudio] = useState<'music' | 'voiceover' | null>(null);

  const musicAudioRef = useRef<HTMLAudioElement>(null);
  const voiceoverAudioRef = useRef<HTMLAudioElement>(null);

  const toggleAudio = (type: 'music' | 'voiceover') => {
    const audioRef = type === 'music' ? musicAudioRef : voiceoverAudioRef;
    const otherRef = type === 'music' ? voiceoverAudioRef : musicAudioRef;

    if (playingAudio === type) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      otherRef.current?.pause();
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      setPlayingAudio(type);
    }
  };

  const handleAudioEnded = () => setPlayingAudio(null);

  const totalScenes = script.scenes.length;
  const generatedCount = Object.keys(generatedVideos).length;
  const failedCount = totalScenes - generatedCount - generatingVideoIds.length;
  const isAllComplete = generatedCount === totalScenes;
  // In speech_in_video mode, voices are baked into videos - no separate audio needed
  const hasEnoughToWatch = generatedCount >= 1 && (voiceMode === 'speech_in_video' || !!masterAudioUrl);

  const handlePlayMovie = () => {
    if (hasEnoughToWatch) setShowPlayer(true);
  };

  const handleExport = async () => {
    if (!hasEnoughToWatch) return;
    setIsExporting(true);
    setExportProgress("Starting export...");

    try {
      const blob = await composeAndExportVideo(
        script.scenes,
        generatedVideos,
        masterAudioUrl,
        backgroundMusicUrl,
        (msg) => setExportProgress(msg),
        aspectRatio,
        videoModel
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${script.title.replace(/\s+/g, '_')}_Combined.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportProgress("Done!");
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress("");
      }, 2000);

    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed: " + (error instanceof Error ? error.message : 'Unknown error'));
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-20">

      <div className="bg-gradient-to-r from-neutral-800 to-neutral-900 p-6 rounded-xl border border-neutral-700 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="z-10 flex items-center gap-4">
          {onBackToStoryboard && (
            <button
              onClick={onBackToStoryboard}
              className="p-2 rounded-lg border border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-500 hover:bg-neutral-800 transition-all"
              title="Back to Storyboard"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{script.title || "Untitled Project"}</h2>
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <span className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700">{script.style}</span>
              <span>• {totalScenes} Scenes</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 z-10 justify-end">
          {/* Voiceover preview button */}
          {masterAudioUrl && (
            <button
              onClick={() => toggleAudio('voiceover')}
              className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all flex items-center gap-2
                ${playingAudio === 'voiceover'
                  ? 'border-blue-500 text-blue-400 bg-blue-900/30'
                  : 'border-blue-600 text-blue-400 bg-blue-900/20 hover:bg-blue-900/30'
                }`}
            >
              {playingAudio === 'voiceover' ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
              Voiceover
            </button>
          )}

          {/* Music preview button */}
          {isGeneratingMusic && (
            <div className="px-4 py-2 rounded-lg text-sm font-bold border border-neutral-600 text-neutral-400 bg-neutral-800">
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Generating Music...
              </span>
            </div>
          )}
          {backgroundMusicUrl && !isGeneratingMusic && (
            <button
              onClick={() => toggleAudio('music')}
              className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all flex items-center gap-2
                ${playingAudio === 'music'
                  ? 'border-green-500 text-green-400 bg-green-900/30'
                  : 'border-green-600 text-green-400 bg-green-900/20 hover:bg-green-900/30'
                }`}
            >
              {playingAudio === 'music' ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
              Music
            </button>
          )}

          {/* Video count indicator */}
          {generatedCount > 0 && (
            <div className={`px-3 py-2 rounded-lg text-sm font-mono border ${
              isAllComplete
                ? 'border-green-600 text-green-400 bg-green-900/20'
                : failedCount > 0
                  ? 'border-yellow-600 text-yellow-400 bg-yellow-900/20'
                  : 'border-neutral-600 text-neutral-400 bg-neutral-800'
            }`}>
              {generatedCount}/{totalScenes} videos
              {failedCount > 0 && <span className="text-yellow-500"> ({failedCount} failed)</span>}
            </div>
          )}

          {/* Watch/Download buttons - available with partial videos */}
          {hasEnoughToWatch && (
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className={`px-6 py-3 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2
                   ${isExporting
                    ? 'bg-neutral-700 text-neutral-300 cursor-wait'
                    : 'bg-white text-black hover:bg-neutral-200'}`}
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    {exportProgress || "Exporting..."}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Download
                  </>
                )}
              </button>
              <button
                onClick={handlePlayMovie}
                disabled={isExporting}
                className="px-8 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg shadow-green-900/20 transition-all transform hover:scale-105 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                Watch{!isAllComplete && ` (${generatedCount})`}
              </button>
            </div>
          )}

          {/* Generate button - always show if not all complete */}
          {!isAllComplete && (
            <button
              onClick={onGenerateFullMovie}
              disabled={isGeneratingFullMovie}
              className={`px-8 py-3 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2
               ${isGeneratingFullMovie
                  ? 'bg-neutral-700 text-neutral-400 cursor-wait'
                  : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white transform hover:scale-105 shadow-red-900/20'
                }`}
            >
              {isGeneratingFullMovie ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Producing Videos...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  {generatedCount > 0 ? 'Retry Failed' : 'Generate Full Movie'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {script.scenes.map((scene, index) => {
          const isGenerating = generatingVideoIds.includes(scene.id);
          const videoUrl = generatedVideos[scene.id];
          const startFrame = frames[index];

          return (
            <div key={scene.id} className="bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700 flex flex-col hover:border-neutral-500 transition-colors">
              <div className="aspect-video bg-black relative group overflow-hidden">
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    className="w-full h-full object-cover bg-black"
                    loop
                    style={{ backgroundColor: 'black' }}
                  />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={startFrame}
                      alt={`Scene ${index + 1}`}
                      className={`w-full h-full object-cover ${isGenerating ? 'opacity-50 blur-sm' : ''}`}
                    />

                    {isGenerating ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                        <svg className="animate-spin h-8 w-8 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-xs font-mono uppercase tracking-widest bg-black/50 px-2 py-1 rounded">{isSeedance ? 'Seedance' : 'Veo'} Rendering...</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                        <button
                          onClick={() => onGenerateVideo(scene.id)}
                          className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-full shadow-lg transform hover:scale-105 transition-all flex items-center gap-2"
                        >
                          Generate Scene
                        </button>
                      </div>
                    )}
                  </>
                )}

                <div className="absolute top-2 left-2 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded border border-neutral-600">
                  Scene {index + 1}{scene.cameraShot ? ` • ${scene.cameraShot}` : ''}{scene.timeRange ? ` • ${parseDuration(scene.timeRange)}s` : ''}
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col gap-3">
                <p className="text-xs text-neutral-400 font-mono">ID: {scene.id}</p>
                <p className="text-sm text-neutral-200 line-clamp-3">{scene.visualDescription}</p>
              </div>
            </div>
          );
        })}
      </div>

      {showPlayer && masterAudioUrl && (
        <MoviePlayer
          scenes={script.scenes}
          videoUrls={generatedVideos}
          audioUrl={masterAudioUrl}
          musicUrl={backgroundMusicUrl}
          onClose={() => setShowPlayer(false)}
          clipDuration={clipDuration}
        />
      )}

      {/* Hidden audio elements for preview playback */}
      {backgroundMusicUrl && (
        <audio
          ref={musicAudioRef}
          src={backgroundMusicUrl}
          onEnded={handleAudioEnded}
          className="hidden"
        />
      )}
      {masterAudioUrl && (
        <audio
          ref={voiceoverAudioRef}
          src={masterAudioUrl}
          onEnded={handleAudioEnded}
          className="hidden"
        />
      )}
    </div>
  );
};

export default Production;
