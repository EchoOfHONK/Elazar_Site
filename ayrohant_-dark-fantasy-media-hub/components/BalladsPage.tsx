import React, { useState, useRef, useEffect } from 'react';
import { musicData } from '../data';
import type { Playlist, Track } from '../types';

const BalladsPage: React.FC = () => {
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist>(musicData[0]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isLooping, setIsLooping] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentTrack = selectedPlaylist.tracks[currentTrackIndex];

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.loop = isLooping;
    }
  }, [isLooping]);

  const handlePlaylistChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const playlist = musicData.find(p => p.id === e.target.value);
    if (playlist) {
        setIsPlaying(false);
        setSelectedPlaylist(playlist);
        setCurrentTrackIndex(0);
    }
  }

  const togglePlayPause = () => {
    if (audioRef.current) {
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(e => console.error("Play error:", e));
        }
    }
    setIsPlaying(!isPlaying);
  };
  
  const playNextTrack = () => {
    setCurrentTrackIndex(prev => (prev + 1) % selectedPlaylist.tracks.length);
    setIsPlaying(true);
  }

  const playPrevTrack = () => {
    setCurrentTrackIndex(prev => (prev - 1 + selectedPlaylist.tracks.length) % selectedPlaylist.tracks.length);
    setIsPlaying(true);
  }

  const handleTrackEnd = () => {
    if (!isLooping) {
        playNextTrack();
    }
  }


  return (
    <div className="container mx-auto px-4 py-8 flex flex-col items-center">
      <h2 className="text-5xl font-cinzel font-bold text-[#e5c368] text-center mb-4">
        Баллады
      </h2>
      <p className="text-gray-400 mb-10">Музыкальные сказания мира Ayrohant</p>
      
      <div className="w-full max-w-2xl bg-[#1a171c] border border-white/10 p-6">
        <div className="mb-6">
            <label htmlFor="playlist-select" className="block text-sm font-medium text-gray-400 mb-2">Выберите плейлист:</label>
            <select
              id="playlist-select"
              value={selectedPlaylist.id}
              onChange={handlePlaylistChange}
              className="w-full bg-[#121013] border border-white/20 text-white p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e5c368]"
            >
              {musicData.map(playlist => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.title}
                </option>
              ))}
            </select>
        </div>

        <div className="text-center mb-6">
            <h3 className="text-2xl font-cinzel text-[#e5c368]">{currentTrack.title}</h3>
            <p className="text-gray-400">{currentTrack.artist}</p>
        </div>
        
        <audio
          ref={audioRef}
          src={currentTrack.source}
          onEnded={handleTrackEnd}
          onLoadedData={() => {
            if (isPlaying && audioRef.current) {
              audioRef.current.play().catch(e => {
                console.error("Autoplay on new track failed:", e);
                setIsPlaying(false);
              });
            }
          }}
        />
        
        <div className="flex items-center justify-center gap-6 mb-6">
            <button onClick={playPrevTrack} className="text-gray-300 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path d="M8.445 14.832A1 1 0 0010 14.226V5.774a1 1 0 00-1.555-.826L4.222 8.774A1 1 0 004 9.598v.804a1 1 0 00.222.624l4.223 3.806zM12.445 14.832A1 1 0 0014 14.226V5.774a1 1 0 00-1.555-.826L8.222 8.774A1 1 0 008 9.598v.804a1 1 0 00.222.624l4.223 3.806z"/></svg>
            </button>
            <button onClick={togglePlayPause} className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-r from-[#d13a69] to-[#e5c368] text-black">
                {isPlaying ? 
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 00-1 1v2a1 1 0 102 0V9a1 1 0 00-1-1zm6 0a1 1 0 00-1 1v2a1 1 0 102 0V9a1 1 0 00-1-1z" clipRule="evenodd" /></svg> :
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.118v3.764a1 1 0 001.555.832l3.197-1.882a1 1 0 000-1.664l-3.197-1.882z" clipRule="evenodd" /></svg>
                }
            </button>
             <button onClick={playNextTrack} className="text-gray-300 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path d="M11.555 5.168A1 1 0 0010 5.774v8.452a1 1 0 001.555.826l4.222-3.806A1 1 0 0016 10.402v-.804a1 1 0 00-.222-.624l-4.223-3.806zM7.555 5.168A1 1 0 006 5.774v8.452a1 1 0 001.555.826l4.222-3.806A1 1 0 0012 10.402v-.804a1 1 0 00-.222-.624L7.555 5.168z"/></svg>
            </button>
        </div>

        <div className="flex items-center justify-center gap-4">
            <button onClick={() => setIsLooping(!isLooping)} className={`text-gray-400 transition-colors ${isLooping ? 'text-[#e5c368]' : 'hover:text-white'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 2l4 4-4 4M3 10h18M7 22l-4-4 4-4M21 14H3" /></svg>
            </button>
            <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01"
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="w-32"
            />
        </div>
      </div>
    </div>
  );
};

export default BalladsPage;