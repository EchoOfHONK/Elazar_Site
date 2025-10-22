export interface CardAction {
  type: 'navigate' | 'modal';
  payload: {
    target: 'manga' | 'audio' | 'video';
    // For modal, this is the media source. For navigate, it's the route name.
    source: string;
    // Optional title for the media player
    title?: string;
  };
}

export interface CardData {
  title: string;
  description: string;
  buttonText: string;
  action: CardAction;
}

// Manga Types
export interface MangaChapter {
  id: string;
  title: string;
  pages: string[];
}

export interface Manga {
  id: string;
  title: string;
  cover: string;
  chapters: MangaChapter[];
}

// Music Types
export interface Track {
  title: string;
  artist: string;
  source: string;
}

export interface Playlist {
  id: string;
  title: string;
  tracks: Track[];
}

// Video Types
export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  source: string;
}

// FAQ Types
export interface FAQItem {
  question: string;
  answer: string;
}


// Wiki Types
export interface WikiTopic {
    id: string;
    title: string;
    content: string;
}

export interface WikiSection {
    title: string;
    topics: WikiTopic[];
}
