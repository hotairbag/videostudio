'use client';

import { use } from 'react';
import { useQuery } from 'convex/react';
import { useConvexAuth } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import VideoStudioWithConvex from '@/components/VideoStudioWithConvex';
import { AuthScreen } from '@/components/AuthScreen';

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isAuthenticated, isLoading } = useConvexAuth();

  const project = useQuery(
    api.projects.get,
    isAuthenticated ? { projectId: id as Id<'projects'> } : 'skip'
  );

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

  if (project === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
          <a href="/" className="text-red-500 hover:underline">
            Back to Projects
          </a>
        </div>
      </div>
    );
  }

  return <VideoStudioWithConvex projectId={id as Id<'projects'>} project={project} />;
}
