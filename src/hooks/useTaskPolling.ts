'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

const POLL_INTERVAL = 5000; // 5 seconds

interface TaskStatusResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  audioUrl?: string;
  duration?: number;
  error?: string;
  taskId?: string;
}

type TaskType = 'video_seedance' | 'video_veo' | 'music_suno' | 'audio_tts';

function getStatusEndpoint(taskType: TaskType): string {
  switch (taskType) {
    case 'video_seedance':
      return '/api/video/byteplus/status';
    case 'music_suno':
      return '/api/music/generate/status';
    default:
      throw new Error(`Unknown task type: ${taskType}`);
  }
}

export function useTaskPolling(projectId: Id<'projects'> | undefined) {
  const pendingTasks = useQuery(
    api.tasks.getPendingTasks,
    projectId ? { projectId } : 'skip'
  );

  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);
  const createVideo = useMutation(api.videos.create);
  const createAudioTrack = useMutation(api.audioTracks.create);

  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isPollingRef = useRef<Set<string>>(new Set());

  const pollTask = useCallback(async (
    taskId: Id<'generationTasks'>,
    externalTaskId: string,
    taskType: TaskType,
    sceneId?: Id<'scenes'>
  ) => {
    // Prevent duplicate polling for the same task
    if (isPollingRef.current.has(externalTaskId)) {
      return;
    }
    isPollingRef.current.add(externalTaskId);

    try {
      const endpoint = getStatusEndpoint(taskType);
      const response = await fetch(`${endpoint}?taskId=${externalTaskId}`);

      if (!response.ok) {
        console.error(`[TaskPolling] Status check failed for ${externalTaskId}:`, response.status);
        return;
      }

      const result: TaskStatusResponse = await response.json();

      if (result.status === 'completed') {
        // Update task status in Convex
        await updateTaskStatus({
          taskId,
          status: 'completed',
          resultUrl: result.videoUrl || result.audioUrl,
        });

        // Create the appropriate record
        if (taskType === 'video_seedance' || taskType === 'video_veo') {
          if (result.videoUrl && projectId && sceneId) {
            await createVideo({
              projectId,
              sceneId,
              videoUrl: result.videoUrl,
              duration: 4, // Default 4 seconds for Seedance
              status: 'completed',
            });
          }
        } else if (taskType === 'music_suno') {
          if (result.audioUrl && projectId) {
            await createAudioTrack({
              projectId,
              type: 'music',
              audioUrl: result.audioUrl,
              duration: result.duration,
            });
          }
        }

        // Clear the polling interval
        const intervalId = pollingRef.current.get(externalTaskId);
        if (intervalId) {
          clearInterval(intervalId);
          pollingRef.current.delete(externalTaskId);
        }
      } else if (result.status === 'failed') {
        // Update task status with error
        await updateTaskStatus({
          taskId,
          status: 'failed',
          errorMessage: result.error || 'Task failed',
        });

        // Clear the polling interval
        const intervalId = pollingRef.current.get(externalTaskId);
        if (intervalId) {
          clearInterval(intervalId);
          pollingRef.current.delete(externalTaskId);
        }
      } else if (result.status === 'processing') {
        // Task is still processing - update to processing if pending
        await updateTaskStatus({
          taskId,
          status: 'processing',
        });
      }
      // If still pending/processing, continue polling
    } catch (error) {
      console.error(`[TaskPolling] Error polling task ${externalTaskId}:`, error);
    } finally {
      isPollingRef.current.delete(externalTaskId);
    }
  }, [projectId, updateTaskStatus, createVideo, createAudioTrack]);

  useEffect(() => {
    if (!pendingTasks || pendingTasks.length === 0 || !projectId) {
      return;
    }

    // Start polling for each pending task that isn't already being polled
    for (const task of pendingTasks) {
      if (!pollingRef.current.has(task.externalTaskId)) {
        // Poll immediately
        pollTask(
          task._id,
          task.externalTaskId,
          task.taskType as TaskType,
          task.sceneId
        );

        // Set up interval for continued polling
        const intervalId = setInterval(() => {
          pollTask(
            task._id,
            task.externalTaskId,
            task.taskType as TaskType,
            task.sceneId
          );
        }, POLL_INTERVAL);

        pollingRef.current.set(task.externalTaskId, intervalId);
      }
    }

    // Cleanup function
    return () => {
      for (const [, intervalId] of pollingRef.current) {
        clearInterval(intervalId);
      }
      pollingRef.current.clear();
    };
  }, [pendingTasks, projectId, pollTask]);

  return {
    pendingTasks: pendingTasks ?? [],
    isPolling: (pollingRef.current.size > 0),
  };
}

// Hook to start a new video generation task
export function useStartVideoTask(projectId: Id<'projects'> | undefined) {
  const createTask = useMutation(api.tasks.createTask);

  const startSeedanceVideo = useCallback(async (
    sceneId: Id<'scenes'>,
    prompt: string,
    imageUrl: string,
    aspectRatio: '16:9' | '9:16',
    resolution: '480p' | '720p' = '720p',
    generateAudio: boolean = false,
    duration: 4 | 8 | 12 = 4
  ) => {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    // Start the video generation via BytePlus API
    const response = await fetch('/api/video/byteplus/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        imageUrl,
        aspectRatio,
        resolution,
        generateAudio,
        duration,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start video generation');
    }

    const { taskId } = await response.json();

    // Create task record in Convex
    await createTask({
      projectId,
      taskType: 'video_seedance',
      externalTaskId: taskId,
      sceneId,
    });

    return taskId;
  }, [projectId, createTask]);

  return { startSeedanceVideo };
}

// Hook to start a new music generation task
export function useStartMusicTask(projectId: Id<'projects'> | undefined) {
  const createTask = useMutation(api.tasks.createTask);

  const startMusic = useCallback(async (
    title: string,
    style: string,
    scenes?: { visualDescription: string; voiceoverText?: string }[]
  ) => {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    // Start the music generation - pass scenes for context
    const response = await fetch('/api/music/generate/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, style, scenes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start music generation');
    }

    const { taskId } = await response.json();

    // Create task record in Convex
    await createTask({
      projectId,
      taskType: 'music_suno',
      externalTaskId: taskId,
    });

    return taskId;
  }, [projectId, createTask]);

  return { startMusic };
}
