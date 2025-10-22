import type { CardData, Manga, Playlist, Video, FAQItem, WikiSection } from './types';

export const cardContent: CardData[] = [
  {
    title: 'Новая глава саги',
    description: 'Опубликована ГЛАВА 5: КЛИНОК СИЯЮЩЕЙ ЗАРИ',
    buttonText: 'Читать сейчас',
    action: {
      type: 'navigate',
      payload: {
        target: 'manga',
        source: 'chapter-5',
      },
    },
  },
  {
    title: 'Премьера альбома "Азурная Высь"',
    description: 'Новый альбом теперь доступен в разделе "Баллады"',
    buttonText: 'Слушать',
    action: {
        type: 'modal',
        payload: {
            target: 'audio',
            source: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            title: 'Азурная Высь'
        }
    }
  },
  {
    title: 'За кулисами',
    description: 'Эксклюзивное видео о создании мира "Ayrohant"',
    buttonText: 'Смотреть',
    action: {
        type: 'modal',
        payload: {
            target: 'video',
            source: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            title: 'За кулисами "Ayrohant"'
        }
    }
  },
  {
    title: 'Обновление Некрономикона',
    description: 'Добавлены новые страницы о персонажах и локациях вселенной',
    buttonText: 'Исследовать',
     action: {
      type: 'navigate',
      payload: {
        target: 'manga',
        source: 'necronomicon-pages',
      },
    },
  },
];

export const mangaData: Manga[] = [
    {
        id: 'shadow-awakening',
        title: 'Пробуждение Тени',
        cover: 'https://placehold.co/500x700/121013/e5c368/png?text=Пробуждение+Тени',
        chapters: [
            {
                id: 'chapter-1',
                title: 'ГЛАВА 1: Начало',
                pages: [
                    'https://placehold.co/800x1200/121013/e0e0e0/png?text=Shadow+Page+1',
                    'https://placehold.co/800x1200/121013/e0e0e0/png?text=Shadow+Page+2',
                ]
            }
        ]
    },
    {
        id: 'glowing-dawn-blade',
        title: 'Клинок Сияющей Зари',
        cover: 'https://placehold.co/500x700/d13a69/e0e0e0/png?text=Клинок+Сияющей+Зари',
        chapters: [
            {
                id: 'chapter-5',
                title: 'ГЛАВА 5: Откровение',
                pages: [
                     'https://placehold.co/800x1200/121013/e0e0e0/png?text=Dawn+Page+1',
                     'https://placehold.co/800x1200/121013/e0e0e0/png?text=Dawn+Page+2',
                     'https://placehold.co/800x1200/121013/e0e0e0/png?text=Dawn+Page+3',
                ]
            }
        ]
    },
    {
        id: 'necronomicon-tales',
        title: 'Истории Некрономикона',
        cover: 'https://placehold.co/500x700/333/ccc/png?text=Истории+Некрономикона',
        chapters: [
            {
                id: 'necronomicon-pages',
                title: 'Утерянные страницы',
                pages: [
                     'https://placehold.co/800x1200/121013/e0e0e0/png?text=Necro+Page+1',
                ]
            }
        ]
    }
];

export const musicData: Playlist[] = [
    {
        id: 'azure-expanse',
        title: 'Азурная Высь',
        tracks: [
            { title: 'Song 1', artist: 'SoundHelix', source: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
            { title: 'Song 2', artist: 'SoundHelix', source: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
            { title: 'Song 3', artist: 'SoundHelix', source: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
        ]
    },
    {
        id: 'battle-hymns',
        title: 'Боевые Гимны',
        tracks: [
            { title: 'Song 8', artist: 'SoundHelix', source: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
            { title: 'Song 9', artist: 'SoundHelix', source: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
        ]
    }
];

export const videoData: Video[] = [
    {
        id: 'vid1',
        title: 'За кулисами "Ayrohant"',
        thumbnail: 'https://placehold.co/600x400/121013/e5c368/png?text=Behind+the+Scenes',
        source: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    },
    {
        id: 'vid2',
        title: 'Создание монстров',
        thumbnail: 'https://placehold.co/600x400/d13a69/e0e0e0/png?text=Monster+Design',
        source: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
    },
    {
        id: 'vid3',
        title: 'Анимационный трейлер',
        thumbnail: 'https://placehold.co/600x400/333/ccc/png?text=Trailer',
        source: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
    }
];

export const faqData: FAQItem[] = [
    {
        question: 'Что такое "Скетчбук Элазара"?',
        answer: 'Это центральный хаб для всего, что связано с миром Ayrohant, созданным художником MR.LAZARUS. Здесь вы найдете комиксы, музыку, видео и информацию о вселенной.'
    },
    {
        question: 'Как часто выходят новые главы?',
        answer: 'Мы стараемся выпускать новые главы саги ежемесячно. Следите за обновлениями на главной странице.'
    },
    {
        question: 'Могу ли я использовать вашу музыку или арт?',
        answer: 'Весь контент защищен авторским правом. Для коммерческого использования или любого другого распространения, пожалуйста, свяжитесь с нами через форму обратной связи.'
    }
];

export const wikiData: WikiSection[] = [
    {
        title: 'Персонажи',
        topics: [
            { id: 'elazar', title: 'Элазар', content: 'Таинственный хранитель знаний, чьими глазами мы видим мир. Его скетчбук - это ключ к пониманию вселенной Ayrohant.' },
            { id: 'kain', title: 'Каин', content: 'Безжалостный воин, преследующий свои темные цели. Его клинок, выкованный из звездного металла, несет гибель его врагам.' },
        ]
    },
    {
        title: 'Локации',
        topics: [
            { id: 'ash-plains', title: 'Пепельные Равнины', content: 'Бескрайняя пустыня, покрытая пеплом древней, забытой битвы. Говорят, что здесь до сих пор бродят духи павших.' },
            { id: 'sunken-city', title: 'Затонувший Город', content: 'Руины некогда великой цивилизации, ныне покоящиеся на дне океана. Только самые отчаянные смельчаки рискуют искать его сокровища.' },
        ]
    }
];
