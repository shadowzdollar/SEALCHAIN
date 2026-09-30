/**
 * Channels for the hero TV.
 *  - ReelChannel: a cut of real transport footage (road, rail, port, sea, air)
 *    with a music bed; clip labels and credits follow the playhead.
 *  - GalleryChannel: a cover-flow of high-resolution trade photographs.
 */
import { useEffect, useRef, useState } from 'react';
import { Anchor, Plane, Ship, TrainFront, Truck, Volume2, VolumeX, type LucideIcon } from 'lucide-react';
import { cx } from '../components/ui';
import { msg, useTr } from '../locale';
import { PHOTOS, type Photo } from './photos';

// ------------------------------------------------------------------ reel
const REEL = { src: '/video/hero-reel.mp4', poster: '/video/hero-reel.jpg', step: 3.6 };
type Mode = 'road' | 'rail' | 'port' | 'sea' | 'air';
const MODE: Record<Mode, { label: string; icon: LucideIcon }> = {
  road: { label: msg('Road'), icon: Truck },
  rail: { label: msg('Rail'), icon: TrainFront },
  port: { label: msg('Port'), icon: Anchor },
  sea: { label: msg('Sea'), icon: Ship },
  air: { label: msg('Air'), icon: Plane },
};
const CLIPS: Array<{ mode: Mode; place: string; credit: string }> = [
  { mode: 'road', place: msg('Tanzania'), credit: 'RahimMngwaya · CC BY-SA 4.0' },
  { mode: 'rail', place: msg('South Africa'), credit: 'Wobvpu43y · CC BY-SA 4.0' },
  { mode: 'port', place: msg('Port of Rauma, Finland'), credit: 'Work With Sounds · CC BY 3.0' },
  { mode: 'port', place: msg('Port of Dar es Salaam, Tanzania'), credit: 'RahimMngwaya · CC BY-SA 4.0' },
  { mode: 'port', place: msg('Container terminal'), credit: 'USDA · Public domain' },
  { mode: 'port', place: msg('Port of Cork, Ireland'), credit: 'Filming Cork · CC BY 3.0' },
  { mode: 'sea', place: msg('Container ship under way'), credit: 'Jan Ainali · CC BY-SA 4.0' },
  { mode: 'sea', place: msg('Gulf of Bothnia'), credit: 'Estormiz · CC0' },
  { mode: 'air', place: msg('Loading air cargo'), credit: '4300streetcar · CC BY 4.0' },
  { mode: 'air', place: msg('Freighter take-off'), credit: 'NewsInStar · CC BY 3.0' },
];
export const REEL_MUSIC_CREDIT = 'Music: “Living Voyage” — Kevin MacLeod (incompetech.com) · CC BY 3.0';

export function ReelChannel({ on, onEnd }: { on: boolean; onEnd: () => void }) {
  const { tr } = useTr();
  const video = useRef<HTMLVideoElement>(null);
  const [clip, setClip] = useState(0);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (on) {
      v.currentTime = 0;
      void v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  }, [on]);
  useEffect(() => { if (video.current) video.current.muted = muted; }, [muted]);

  // Never play sound for a TV nobody can see.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => {
      if (!on) return;
      if (e?.isIntersecting) void v.play().catch(() => undefined);
      else v.pause();
    }, { threshold: 0.2 });
    io.observe(v);
    return () => io.disconnect();
  }, [on]);

  const c = CLIPS[Math.min(clip, CLIPS.length - 1)]!;
  const M = MODE[c.mode];
  return (
    <div className={cx('absolute inset-0 z-20 overflow-hidden bg-[#05070c] transition-opacity duration-300', on ? 'opacity-100' : 'pointer-events-none opacity-0')}>
      <video
        ref={video}
        className="absolute inset-0 size-full object-cover"
        src={REEL.src}
        poster={REEL.poster}
        muted
        playsInline
        preload="metadata"
        onTimeUpdate={(e) => setClip(Math.floor(e.currentTarget.currentTime / REEL.step))}
        onEnded={onEnd}
      />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,7,12,0.55),transparent_24%,transparent_60%,rgba(5,7,12,0.75))]" />
      <div aria-hidden className="tv-scanlines absolute inset-0" />

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 rounded-[4px] bg-[#d92d20] px-2 py-0.5 font-plexmono text-[10.5px] font-semibold uppercase tracking-[0.14em]"><span className="size-1.5 animate-pulse rounded-full bg-white" />{tr('On air')}</span>
          <span className="font-plexmono text-[10.5px] uppercase tracking-[0.16em] text-white/85">CH 1 · {tr('Trade in motion')}</span>
        </div>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className={cx('pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1 text-[11.5px] font-medium backdrop-blur transition-colors', muted ? 'sound-nudge border-white/40 bg-white/15 text-white hover:bg-white/25' : 'border-white/20 bg-black/30 text-white/85 hover:bg-black/50')}
          aria-label={muted ? tr('Turn sound on') : tr('Mute')}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          {muted ? tr('Sound on') : <SoundBars />}
        </button>
      </div>

      {/* clip label */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
        <div key={clip} className="clip-label flex items-center gap-3 rounded-[6px] bg-white/95 py-2 pl-2 pr-4 shadow-lg">
          <span className="flex size-9 items-center justify-center rounded-[4px] bg-[#0b1f3a] text-white"><M.icon className="size-[18px]" strokeWidth={1.8} /></span>
          <span>
            <span className="block font-plexmono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#b42318]">{tr(M.label)}</span>
            <span className="block font-serif text-[15px] font-semibold leading-tight text-[#0b1f3a]">{tr(c.place)}</span>
          </span>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="font-plexmono text-[10px] tabular-nums tracking-[0.14em] text-white/70">{String(clip + 1).padStart(2, '0')} / {CLIPS.length}</span>
          <span className="hidden font-plexmono text-[8.5px] text-white/55 sm:block">{c.credit}</span>
        </div>
      </div>
    </div>
  );
}

function SoundBars() {
  return (
    <span aria-hidden className="flex h-3 items-end gap-[2px]">
      {[0, 1, 2, 3].map((i) => <span key={i} className="sound-bar w-[2px] rounded-full bg-white" style={{ animationDelay: `${i * 0.13}s` }} />)}
    </span>
  );
}

// ------------------------------------------------------------------ gallery
const GALLERY: Array<{ photo: Photo; caption: string }> = [
  { photo: PHOTOS.shipKoper, caption: msg('Unloading at the quay') },
  { photo: PHOTOS.lorryTanzania, caption: msg('On the road in Tanzania') },
  { photo: PHOTOS.anaCargo, caption: msg('Air freight, climbing out') },
  { photo: PHOTOS.darHarbour, caption: msg('Harbour of Dar es Salaam') },
  { photo: PHOTOS.bremerhaven, caption: msg('Cranes at work') },
  { photo: PHOTOS.everGenius, caption: msg('Twenty thousand boxes at sea') },
  { photo: PHOTOS.portTruck, caption: msg('Port of Mombasa') },
  { photo: PHOTOS.harbourNight, caption: msg('A port that never sleeps') },
  { photo: PHOTOS.cargo747, caption: msg('Freighter on the apron') },
  { photo: PHOTOS.shipMombasa, caption: msg('Leaving Mombasa') },
];
const SLIDE_MS = 3200;

export function GalleryChannel({ on, onEnd }: { on: boolean; onEnd: () => void }) {
  const { tr } = useTr();
  const [i, setI] = useState(0);
  const shown = useRef(0);
  useEffect(() => {
    if (!on) return;
    setI((n) => n); // keep position when re-entering
    shown.current = 0;
    const t = window.setInterval(() => {
      shown.current += 1;
      if (shown.current >= GALLERY.length) { onEnd(); return; }
      setI((n) => (n + 1) % GALLERY.length);
    }, SLIDE_MS);
    return () => window.clearInterval(t);
  }, [on, onEnd]);

  const cur = GALLERY[i]!;
  const n = GALLERY.length;
  return (
    <div className={cx('absolute inset-0 z-20 overflow-hidden bg-[#070a12] transition-opacity duration-300 [perspective:1200px]', on ? 'opacity-100' : 'pointer-events-none opacity-0')}>
      {/* ambient backdrop from the current photo */}
      <img key={`bg-${i}`} src={cur.photo.sm} alt="" aria-hidden className="gallery-bg absolute inset-0 size-full scale-125 object-cover opacity-50 blur-2xl" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(5,7,12,0.75))]" />

      {/* cover-flow */}
      <div className="absolute inset-x-0 top-[9%] bottom-[22%] [transform-style:preserve-3d]">
        {GALLERY.map((g, k) => {
          let o = k - i;
          if (o > n / 2) o -= n;
          if (o < -n / 2) o += n;
          const a = Math.abs(o);
          return (
            <figure
              key={g.photo.src}
              className="absolute left-1/2 top-0 h-full w-[56%] overflow-hidden rounded-[8px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] transition-all duration-[900ms] ease-[cubic-bezier(0.2,0.75,0.2,1)]"
              style={{
                transform: `translateX(calc(-50% + ${o * 58}%)) translateZ(${-a * 140}px) rotateY(${-o * 28}deg)`,
                opacity: a > 2 ? 0 : a === 2 ? 0.35 : 1,
                zIndex: 10 - a,
                filter: a ? `brightness(${1 - a * 0.28}) saturate(${1 - a * 0.2})` : 'none',
              }}
            >
              <img src={a <= 1 ? g.photo.src : g.photo.sm} alt={a === 0 ? g.photo.alt : ''} loading={a <= 2 ? 'eager' : 'lazy'} decoding="async" className={cx('size-full object-cover', a === 0 && on && 'gallery-zoom')} />
              {a === 0 && <span aria-hidden className="absolute inset-0 rounded-[8px] ring-1 ring-inset ring-white/25" />}
            </figure>
          );
        })}
      </div>

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 text-white">
        <span className="font-plexmono text-[10.5px] uppercase tracking-[0.16em] text-white/85">CH 2 · {tr('Gallery')}</span>
        <span className="font-plexmono text-[10.5px] tabular-nums tracking-[0.14em] text-white/70">{String(i + 1).padStart(2, '0')} / {n}</span>
      </div>

      {/* caption + dots */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-4 text-center text-white">
        <p key={`c-${i}`} className="clip-label font-serif text-[18px] font-semibold leading-tight">{tr(cur.caption)}</p>
        <p className="mt-1 truncate font-plexmono text-[9.5px] tracking-[0.06em] text-white/60">{cur.photo.place ? `${cur.photo.place} · ` : ''}{cur.photo.author} · {cur.photo.license}</p>
        <div className="mt-3 flex justify-center gap-1.5">
          {GALLERY.map((g, k) => (
            <button key={g.photo.src} type="button" tabIndex={-1} onClick={() => setI(k)} aria-label={`${k + 1}`} className={cx('h-1 rounded-full transition-all duration-500', k === i ? 'w-6 bg-white' : 'w-1.5 bg-white/35 hover:bg-white/60')} />
          ))}
        </div>
      </div>
    </div>
  );
}
