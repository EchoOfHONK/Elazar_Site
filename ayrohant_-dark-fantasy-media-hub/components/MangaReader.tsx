import React, { useState, useEffect } from 'react';
import type { Manga } from '../types';

interface MangaReaderProps {
    manga: Manga;
}

const MangaReader: React.FC<MangaReaderProps> = ({ manga }) => {
  const [selectedChapterId, setSelectedChapterId] = useState(manga.chapters[0]?.id || '');
  const [currentPage, setCurrentPage] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Reset component state if manga prop changes
  useEffect(() => {
    setSelectedChapterId(manga.chapters[0]?.id || '');
    setCurrentPage(0);
    setZoomLevel(1);
  }, [manga]);

  const chapter = manga.chapters.find(c => c.id === selectedChapterId);

  if (!chapter) {
    return (
      <div className="container mx-auto px-4 py-8 flex flex-col items-center">
        <h2 className="text-4xl font-cinzel font-bold text-[#e5c368] mb-8">
          {manga.title}
        </h2>
        <p className="text-gray-400">В этой саге пока нет глав.</p>
      </div>
    );
  }

  const totalPages = chapter.pages.length;

  const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedChapterId(e.target.value);
    setCurrentPage(0);
    setZoomLevel(1);
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
  };

  const goToPrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  };
  
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.2, 0.5));

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col items-center">
      <h2 className="text-4xl font-cinzel font-bold text-[#e5c368] mb-4 text-center">
        {manga.title}
      </h2>
      <h3 className="text-2xl font-cinzel text-gray-300 mb-8 text-center">{chapter.title}</h3>

      {/* Controls */}
      <div className="w-full max-w-4xl flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <select
          value={selectedChapterId}
          onChange={handleChapterChange}
          className="bg-[#1a171c] border border-white/20 text-white p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e5c368]"
        >
          {manga.chapters.map((chap) => (
            <option key={chap.id} value={chap.id}>
              {chap.title}
            </option>
          ))}
        </select>
        
        <div className="flex items-center gap-4">
          <button
            onClick={goToPrevPage}
            disabled={currentPage === 0}
            className="px-4 py-2 font-bold text-black uppercase tracking-widest text-sm bg-gradient-to-r from-[#d13a69] to-[#e5c368] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Назад
          </button>
          <span className="text-gray-300 tabular-nums">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={currentPage === totalPages - 1}
            className="px-4 py-2 font-bold text-black uppercase tracking-widest text-sm bg-gradient-to-r from-[#d13a69] to-[#e5c368] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Вперёд
          </button>
        </div>
      </div>
      
      {/* Zoom Controls */}
      <div className="w-full max-w-4xl flex justify-center items-center mb-6 gap-4">
        <button onClick={handleZoomOut} disabled={zoomLevel <= 0.5} className="px-3 py-1 bg-gray-700 rounded-full disabled:opacity-50">-</button>
        <span className="text-gray-300">Zoom: {Math.round(zoomLevel * 100)}%</span>
        <button onClick={handleZoomIn} disabled={zoomLevel >= 3} className="px-3 py-1 bg-gray-700 rounded-full disabled:opacity-50">+</button>
      </div>


      {/* Manga Page Display */}
      <div className="w-full max-w-4xl bg-[#1a171c] border border-white/10 p-2 overflow-auto">
        <div className="flex justify-center items-start">
            <img
            src={chapter.pages[currentPage]}
            alt={`Page ${currentPage + 1} of ${chapter.title}`}
            className="max-w-none transition-transform duration-300"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
            />
        </div>
      </div>
    </div>
  );
};

export default MangaReader;
