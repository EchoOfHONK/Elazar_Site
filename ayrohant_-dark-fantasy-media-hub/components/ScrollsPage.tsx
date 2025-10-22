import React from 'react';
import type { Video } from '../types';

interface ScrollsPageProps {
  videos: Video[];
  onVideoSelect: (video: Video) => void;
}

const ScrollsPage: React.FC<ScrollsPageProps> = ({ videos, onVideoSelect }) => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-5xl font-cinzel font-bold text-[#e5c368] text-center mb-12">
        Свитки с картинками
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {videos.map((video) => (
          <div
            key={video.id}
            className="group cursor-pointer bg-[#1a171c] border border-white/10"
            onClick={() => onVideoSelect(video)}
          >
            <div className="aspect-video overflow-hidden relative">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.118v3.764a1 1 0 001.555.832l3.197-1.882a1 1 0 000-1.664l-3.197-1.882z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <h3 className="p-4 font-cinzel text-lg text-gray-300 group-hover:text-[#e5c368] transition-colors">
              {video.title}
            </h3>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScrollsPage;
