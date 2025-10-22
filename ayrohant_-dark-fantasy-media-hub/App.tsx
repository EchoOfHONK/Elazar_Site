import React, { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import ContentGrid from './components/ContentGrid';
import Footer from './components/Footer';
import SagasPage from './components/SagasPage';
import MangaReader from './components/MangaReader';
import BalladsPage from './components/BalladsPage';
import ScrollsPage from './components/ScrollsPage';
import FAQPage from './components/FAQPage';
import NecronomiconPage from './components/NecronomiconPage';
import MediaPlayerModal from './components/MediaPlayerModal';

import { cardContent, mangaData, videoData } from './data';
import type { CardAction, Video } from './types';


export type Page = 'home' | 'sagas' | 'mangaReader' | 'ballads' | 'scrolls' | 'faq' | 'necronomicon';

type ModalContent = {
    type: 'audio' | 'video';
    source: string;
    title: string;
} | null;

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedMangaId, setSelectedMangaId] = useState<string | null>(null);
  const [modalContent, setModalContent] = useState<ModalContent>(null);

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    window.scrollTo(0, 0); // Scroll to top on page change
  };
  
  const handleSelectManga = (mangaId: string) => {
    setSelectedMangaId(mangaId);
    handleNavigate('mangaReader');
  }

  const handleCardClick = (action: CardAction) => {
    if (action.type === 'navigate' && action.payload.target === 'manga') {
      const manga = mangaData.find(m => m.chapters.some(c => c.id === action.payload.source));
      if (manga) {
        handleSelectManga(manga.id);
      }
    } else if (action.type === 'modal' && (action.payload.target === 'audio' || action.payload.target === 'video')) {
      setModalContent({
        type: action.payload.target,
        source: action.payload.source,
        title: action.payload.title || 'Media Player',
      });
    }
  };
  
  const handleVideoSelect = (video: Video) => {
    setModalContent({
        type: 'video',
        source: video.source,
        title: video.title
    });
  }

  const renderPage = () => {
    switch (currentPage) {
        case 'home':
            return (
                <>
                    <Hero />
                    <ContentGrid cards={cardContent} onCardClick={handleCardClick} />
                </>
            );
        case 'sagas':
            return <SagasPage onMangaSelect={handleSelectManga} />;
        case 'mangaReader':
            if (selectedMangaId) {
                const manga = mangaData.find(m => m.id === selectedMangaId);
                if (manga) return <MangaReader manga={manga} />;
            }
            // Fallback if no manga is selected
            return <SagasPage onMangaSelect={handleSelectManga} />;
        case 'ballads':
            return <BalladsPage />;
        case 'scrolls':
            return <ScrollsPage videos={videoData} onVideoSelect={handleVideoSelect} />;
        case 'faq':
            return <FAQPage />;
        case 'necronomicon':
            return <NecronomiconPage />;
        default:
            return <Hero />;
    }
  }


  return (
    <div className="min-h-screen flex flex-col">
      <Header onNavigate={handleNavigate} />
      <div className="flex-grow">
        {renderPage()}
      </div>
      <Footer />
      {modalContent && <MediaPlayerModal content={modalContent} onClose={() => setModalContent(null)} />}
    </div>
  );
}

export default App;
