"use client";
import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
export default function HeroFilm() {
    const video = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);
    const [loadFilm, setLoadFilm] = useState(false);
    const source = process.env.NEXT_PUBLIC_HERO_VIDEO || '/yenlap-hero.mp4';
    useEffect(() => {
        const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const connection = (navigator as Navigator & {
            connection?: {
                saveData?: boolean;
            };
        }).connection;
        const sync = () => {
            if (motion.matches || connection?.saveData) {
                video.current?.pause();
                setPlaying(false);
            }
            else
                setLoadFilm(true);
        };
        sync();
        motion.addEventListener('change', sync);
        return () => motion.removeEventListener('change', sync);
    }, []);
    useEffect(() => { if (loadFilm)
        video.current?.play().catch(() => setPlaying(false)); }, [loadFilm]);
    async function toggle() {
        if (!video.current)
            return;
        if (playing)
            video.current.pause();
        else {
            setLoadFilm(true);
            try {
                await video.current.play();
            }
            catch {
                setPlaying(false);
            }
        }
    }
    return <div className="yenlap-film" aria-label="Old laptops enter a green restoration workshop and begin a happier second life">
    <img className="yenlap-film-poster" src="/yenlap-reference.png" alt="An old-device globe, green restoration factory, and happy restored laptops" fetchPriority="high"/>
    <video ref={video} className="yenlap-film-video" muted loop playsInline preload="none" aria-hidden="true" style={playing ? { display: 'block' } : undefined} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setPlaying(false)}>
      {loadFilm && <source src={source} type="video/mp4"/>}
    </video>
    <div className="yenlap-film-fade"/>
    <button className="yenlap-film-control" data-film-control="true" type="button" onClick={toggle} aria-label={playing ? 'Pause homepage film' : 'Play homepage film'} aria-pressed={playing}>
      {playing ? <Pause size={14}/> : <Play size={14}/>}<span>{playing ? 'Pause film' : 'Play film'}</span>
    </button>
  </div>;
}
