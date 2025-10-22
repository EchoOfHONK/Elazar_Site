import React, { useEffect, useRef } from 'react';

interface MediaPlayerModalProps {
  content: {
    type: 'audio' | 'video';
    source: string;
    title: string;
  };
  onClose: () => void;
}

const MediaPlayerModal: React.FC<MediaPlayerModalProps> = ({ content, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
    }
  };


  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-title"
    >
      <div ref={modalRef} className="bg-[#1a171c] border border-white/20 rounded-lg shadow-2xl w-full max-w-3xl flex flex-col relative">
        <header className="flex justify-between items-center p-4 border-b border-white/10">
            <h2 id="media-title" className="text-xl font-cinzel text-[#e5c368]">{content.title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close media player">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </header>

        <div className="p-4">
             {content.type === 'video' && (
                <video src={content.source} controls autoPlay className="w-full max-h-[70vh] rounded">
                    Your browser does not support the video tag.
                </video>
            )}
            {content.type === 'audio' && (
                <div className="flex flex-col items-center justify-center p-8">
                     <audio src={content.source} controls autoPlay className="w-full">
                        Your browser does not support the audio tag.
                    </audio>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default MediaPlayerModal;
