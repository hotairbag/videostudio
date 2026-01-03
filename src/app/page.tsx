'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useConvexAuth } from 'convex/react';
import { useClerk } from '@clerk/nextjs';
import { api } from '../../convex/_generated/api';
import { AuthScreen } from '@/components/AuthScreen';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useClerk();
  const router = useRouter();

  const projects = useQuery(api.projects.list, isAuthenticated ? {} : 'skip');
  const createProject = useMutation(api.projects.create);

  const [isCreating, setIsCreating] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  const handleCreateProject = async () => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      const projectId = await createProject({
        title: `Untitled Project`,
        style: 'cinematic',
        originalPrompt: '',
        aspectRatio: '16:9',
        videoModel: 'seedance-1.5',
        enableCuts: true,
        seedanceAudio: false,
        seedanceResolution: '720p',
        seedanceSceneCount: 15,
      });

      router.push(`/project/${projectId}`);
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project');
      setIsCreating(false);
    }
  };

  const handleSignOut = () => {
    signOut();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'production':
        return 'bg-blue-500/20 text-blue-400';
      case 'storyboarding':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'scripting':
        return 'bg-purple-500/20 text-purple-400';
      default:
        return 'bg-neutral-500/20 text-neutral-400';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-orange-600 rounded-lg"></div>
            <h1 className="text-xl font-bold tracking-tight">
              GenDirector <span className="text-neutral-500 font-normal">AI Studio</span>
            </h1>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Your Projects</h2>
          <button
            onClick={handleCreateProject}
            disabled={isCreating}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : '+ New Project'}
          </button>
        </div>

        {projects === undefined ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
            <p className="text-neutral-400 mb-6">Create your first AI-generated video project</p>
            <button
              onClick={handleCreateProject}
              disabled={isCreating}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Your First Project'}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <a
                key={project._id}
                href={`/project/${project._id}`}
                className="block bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700 hover:border-neutral-600 transition-colors"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-neutral-900 relative">
                  {project.thumbnailUrl ? (
                    <img
                      src={project.thumbnailUrl}
                      alt={project.title || 'Project thumbnail'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <span className={`absolute top-2 right-2 text-xs px-2 py-1 rounded-full ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                </div>
                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-lg truncate mb-1">
                    {project.title || 'Untitled Project'}
                  </h3>
                  <p className="text-sm text-neutral-400 line-clamp-2 mb-3">
                    {project.originalPrompt || 'No description'}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span>{project.aspectRatio}</span>
                    <span>{project.videoModel === 'seedance-1.5' ? 'Seedance' : 'Veo'}</span>
                    <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
