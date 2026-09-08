import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════════════
   ANIMATIONS FROM BANK — Anti-Grid Bento, Marquee, CharSpin, 3D Tilt
   ═══════════════════════════════════════════════════════════════ */

/* ─── Concave corner (clipPath triangle + oversized circle technique) ─── */
function AntiGridCurve({ rotate = '0deg' }: { rotate?: string }) {
  return (
    <div
      className="absolute"
      style={{
        width: 64,
        height: 64,
        clipPath: 'polygon(0 100%, 100% 0, 0 0)',
        rotate,
        top: -32,
        right: 0,
        transform: 'translateX(100%)',
      }}
    >
      {/* Background fill */}
      <div className="relative z-0" style={{ width: 66, height: 66, backgroundColor: '#0d0d0f' }} />
      {/* Circle creates the concave illusion — darker than section bg */}
      <div
        className="absolute inset-0 z-10 rounded-full"
        style={{
          width: 134.5,
          height: 134.5,
          backgroundColor: '#06060b',
          border: '1.6px solid #252540',
        }}
      />
    </div>
  );
}

/* ─── Marquee (infinite scroll) ─── */
function Marquee({ items, speed = 30 }: { items: string[]; speed?: number }) {
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden w-full">
      <div
        className="flex gap-8 whitespace-nowrap animate-marquee"
        style={{ width: `${doubled.length * 200}px`, animationDuration: `${speed}s` }}
      >
        {doubled.map((item, i) => (
          <span
            key={i}
            className="text-[#d4af37]/20 text-6xl md:text-8xl font-black uppercase tracking-wider select-none"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Char Spin (per-character 3D rotation reveal) ─── */
function CharSpin({ text, className = '', delay = 0 }: { text: string; className?: string; delay?: number }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <span ref={ref} style={{ perspective: '500px' }} className={className}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          className="inline-block"
          style={{
            animation: visible ? 'charSpin 400ms ease-out forwards' : 'none',
            animationDelay: `${delay + i * 25}ms`,
            opacity: visible ? undefined : 0,
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
}

/* ─── 3D Tilt Card (hover effect) ─── */
function TiltCard({
  children,
  className = '',
  style: externalStyle,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rotateY = ((e.clientX - rect.left - rect.width / 2) / (rect.width / 2)) * 8;
    const rotateX = ((rect.height / 2 - (e.clientY - rect.top)) / (rect.height / 2)) * 8;
    el.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.02)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (ref.current) {
      ref.current.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
    }
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{ ...externalStyle, transition: 'transform 0.15s ease-out', transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  );
}

/* ─── Fade-in on scroll ─── */
function FadeInSection({ children, className = '', delay = 0, style }: { children: React.ReactNode; className?: string; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.7s ease-out ${delay}ms, transform 0.7s ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
   ═══════════════════════════════════════════════════════════════ */
const PokerChipIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
    <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="19" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M19 15a4 4 0 013 4v2" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
    <path d="M8 21h8m-4-4v4m-4-8a4 4 0 008 0V5H8v8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 5H4a1 1 0 00-1 1v1a4 4 0 004 4m9-6h4a1 1 0 011 1v1a4 4 0 01-4 4" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const MobileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
    <rect x="5" y="2" width="14" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="18" r="1" fill="currentColor" />
  </svg>
);

const HeadsetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
    <path d="M3 18v-6a9 9 0 0118 0v6" stroke="currentColor" strokeWidth="1.5" />
    <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   BENTO FEATURE CARDS DATA
   ═══════════════════════════════════════════════════════════════ */
const features = [
  { icon: <PokerChipIcon />, title: 'Tables en Direct', desc: 'Jouez en temps réel avec des joueurs de tout Madagascar. Texas Hold\'em, Omaha et plus.' },
  { icon: <ShieldIcon />, title: 'Sécurisé', desc: 'Transactions cryptées et vérifiées. Votre argent est en sécurité.' },
  { icon: <UsersIcon />, title: 'Communauté', desc: 'Rejoignez des milliers de joueurs malgaches passionnés.' },
  { icon: <TrophyIcon />, title: 'Tournois', desc: 'Tournois réguliers avec des prize pools attractifs.' },
  { icon: <MobileIcon />, title: 'Mobile First', desc: 'Jouez où vous voulez, sur n\'importe quel appareil.' },
  { icon: <HeadsetIcon />, title: 'Support 24/7', desc: 'Une équipe dédiée pour vous accompagner à tout moment.' },
];

const testimonials = [
  { name: 'Tiana R.', location: 'Antananarivo', text: 'La meilleure plateforme de poker à Madagascar. L\'interface est fluide et les tables sont toujours actives !', avatar: 'T' },
  { name: 'Jean-Luc M.', location: 'Toamasina', text: 'J\'ai gagné mon premier tournoi ici. Les retraits sont rapides et le support est excellent.', avatar: 'J' },
  { name: 'Sandra H.', location: 'Antsirabe', text: 'Enfin une app de poker pensée pour nous. Simple, belle et sécurisée. Je recommande !', avatar: 'S' },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN LANDING PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* ─── NAVBAR ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d4af37] to-[#f0c675] flex items-center justify-center">
              <span className="text-black font-black text-sm">PM</span>
            </div>
            <span className="text-lg font-bold tracking-tight">
              Poker <span className="text-[#d4af37]">Mada</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how" className="hover:text-white transition-colors">Comment ça marche</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Témoignages</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Connexion
            </button>
            <button
              onClick={() => navigate('/register')}
              className="text-sm px-5 py-2 rounded-full bg-gradient-to-r from-[#d4af37] to-[#f0c675] text-black font-semibold hover:shadow-lg hover:shadow-[#d4af37]/20 transition-all active:scale-95"
            >
              S'inscrire
            </button>
          </div>
        </div>
      </nav>

      {/* ─── HERO SECTION ─── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-16">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#d4af37]/5 blur-[120px]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d4af37]/20 to-transparent" />
        </div>

        {/* Floating cards decoration */}
        <div className="absolute top-1/3 left-[10%] w-16 h-22 rounded-lg bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rotate-[-15deg] hidden lg:block" style={{ animation: 'float 6s ease-in-out infinite' }}>
          <div className="p-2 text-red-500 font-serif text-lg">A<span className="text-xs">♥</span></div>
        </div>
        <div className="absolute top-1/4 right-[12%] w-16 h-22 rounded-lg bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rotate-[12deg] hidden lg:block" style={{ animation: 'float 6s ease-in-out infinite 1s' }}>
          <div className="p-2 text-white font-serif text-lg">K<span className="text-xs">♠</span></div>
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* Badge */}
          <FadeInSection>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#d4af37]/30 bg-[#d4af37]/5 mb-8">
              <div className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse" />
              <span className="text-xs font-medium text-[#d4af37]">Tables ouvertes 24h/24</span>
            </div>
          </FadeInSection>

          {/* Main headline with CharSpin */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black leading-[0.95] tracking-tight mb-6">
            <CharSpin text="Le Poker en Ligne" className="block text-white" />
            <CharSpin text="Made in" className="block text-white/40 mt-2" delay={400} />
            <span className="block mt-2">
              <CharSpin text="Madagascar" className="text-[#d4af37]" delay={700} />
            </span>
          </h1>

          <FadeInSection delay={400}>
            <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
              La première plateforme de poker en ligne 100% malgache.
              Jouez, bluffez et gagnez depuis chez vous.
            </p>
          </FadeInSection>

          <FadeInSection delay={600}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/register')}
                className="group px-8 py-4 rounded-full bg-gradient-to-r from-[#d4af37] to-[#f0c675] text-black font-bold text-lg hover:shadow-2xl hover:shadow-[#d4af37]/30 transition-all active:scale-95"
              >
                Jouer Maintenant
                <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </button>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 rounded-full border border-white/20 text-white/80 font-medium hover:bg-white/5 hover:border-white/30 transition-all active:scale-95"
              >
                En Savoir Plus
              </button>
            </div>
          </FadeInSection>

          {/* Stats */}
          <FadeInSection delay={800}>
            <div className="flex justify-center gap-12 mt-16">
              {[
                { value: '10K+', label: 'Joueurs' },
                { value: '24/7', label: 'Tables Actives' },
                { value: '100%', label: 'Sécurisé' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl md:text-3xl font-black text-[#d4af37]">{stat.value}</div>
                  <div className="text-xs text-white/40 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ─── MARQUEE DIVIDER ─── */}
      <div className="py-8 border-y border-white/5">
        <Marquee items={['POKER', 'MADA', 'BLUFF', 'ALL-IN', 'ROYAL FLUSH', 'TEXAS HOLD\'EM']} speed={40} />
      </div>

      {/* ─── FEATURES — ANTI-GRID BENTO ─── */}
      <section id="features" className="py-24 px-6 bg-[#06060b]">
        <div className="max-w-6xl mx-auto">
          <FadeInSection>
            <div className="text-center mb-16">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]/60">Pourquoi nous choisir</span>
              <h2 className="text-3xl md:text-5xl font-black mt-4">
                Tout ce qu'il vous faut<br />
                <span className="text-white/30">pour jouer comme un pro</span>
              </h2>
            </div>
          </FadeInSection>

          {/* Anti-Grid Bento Layout — Desktop: 4-col anti-grid, Mobile: stacked */}
          <FadeInSection>
            <div
              className="hidden md:grid gap-[28px]"
              style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: '220px 200px 200px' }}
            >

              {/* Row 1: Hero card — bottom-left radius 0 to fuse with card below */}
              <div className="relative" style={{ gridColumn: '1 / -1' }}>
                <div
                  className="relative h-full bg-[#0d0d0f] border-2 border-[#252540] flex flex-col justify-between p-8"
                  style={{ borderRadius: '42px 42px 42px 0px' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 px-4 flex items-center rounded-full text-xs font-semibold bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37]">
                      Plateforme complète
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 mt-auto">
                    <h3 className="text-2xl md:text-3xl font-bold text-white">
                      L'expérience poker <span className="text-[#d4af37]">ultime</span>
                    </h3>
                    <p className="text-sm text-white/40 max-w-xl">
                      Des tables cash game aux tournois, en passant par les sit & go. Poker Mada offre une expérience complète, sécurisée et adaptée aux joueurs malgaches.
                    </p>
                  </div>
                  {/* Decorative poker chips */}
                  <div className="absolute top-6 right-8 flex gap-2 opacity-20">
                    {['#d4af37', '#c41e3a', '#1a472a', '#1e40af'].map((color, i) => (
                      <div key={i} className="w-10 h-10 rounded-full border-[3px] border-dashed" style={{ borderColor: color, backgroundColor: color, opacity: 0.5 + i * 0.1 }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2-3, Col 1-3: Tables en Direct — top radius 0 to fuse with hero above */}
              <div className="relative" style={{ gridColumn: '1 / span 3', gridRow: '2 / span 2' }}>
                <div
                  className="relative h-full bg-[#0d0d0f] border-2 border-[#252540] flex flex-col"
                  style={{ borderRadius: '0px 0px 42px 42px' }}
                >
                  {/* Poker table visual */}
                  <div className="flex-1 flex items-center justify-center p-8">
                    <div className="relative w-full max-w-md aspect-[2/1]">
                      <div className="absolute inset-0 rounded-[100px] bg-gradient-to-b from-[#1a472a] to-[#0f2b1a] border-4 border-[#5a3825]/50 shadow-inner" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-2">
                        {['A♠', 'K♥', 'Q♦', '10♣', 'J♠'].map((card, i) => (
                          <div
                            key={i}
                            className="w-8 h-11 md:w-10 md:h-14 rounded bg-white/90 flex items-center justify-center text-[10px] md:text-xs font-bold shadow-lg"
                            style={{
                              color: card.includes('♥') || card.includes('♦') ? '#c41e3a' : '#1a1a2e',
                              animation: `fadeIn 0.4s ease-out ${i * 100}ms both`,
                            }}
                          >
                            {card}
                          </div>
                        ))}
                      </div>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="w-4 h-4 rounded-full bg-[#d4af37] border border-[#f0c675]/50 shadow" style={{ opacity: 0.5 + i * 0.1 }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="p-6 pt-0">
                    <h3 className="text-lg font-semibold text-white">Tables en Direct</h3>
                    <p className="text-sm text-white/40 mt-1">Texas Hold'em, Omaha — des tables pour tous les niveaux de blindes</p>
                  </div>
                </div>

              </div>

              {/* ═══ Anti-grid overlay: Bridge + Concave curve ═══ */}
              <div
                className="pointer-events-none relative z-10"
                style={{ gridColumn: '1 / span 3', gridRow: '2 / span 2' }}
              >
                {/* Bridge fills the 28px gap — covers hero bottom border + big card top border */}
                <div
                  className="absolute bg-[#0d0d0f]"
                  style={{ top: -32, left: -2, width: 'calc(100% + 2px)', height: 34, borderLeft: '2px solid #252540' }}
                />
                {/* Concave curve at the junction */}
                <AntiGridCurve />
              </div>

              {/* Row 2, Col 4: Sécurisé */}
              <div style={{ gridColumn: '4', gridRow: '2' }}>
                <TiltCard className="h-full rounded-[42px] border-2 border-[#252540] bg-[#0d0d0f] p-6 flex flex-col justify-between hover:border-[#d4af37]/20 transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
                    {features[1].icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white mt-3">{features[1].title}</h4>
                    <p className="text-xs text-white/40 mt-1 leading-relaxed">{features[1].desc}</p>
                  </div>
                </TiltCard>
              </div>

              {/* Row 3, Col 4: Communauté */}
              <div style={{ gridColumn: '4', gridRow: '3' }}>
                <TiltCard className="h-full rounded-[42px] border-2 border-[#252540] bg-[#0d0d0f] p-6 flex flex-col justify-between hover:border-[#d4af37]/20 transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
                    {features[2].icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white mt-3">{features[2].title}</h4>
                    <p className="text-xs text-white/40 mt-1 leading-relaxed">{features[2].desc}</p>
                  </div>
                </TiltCard>
              </div>
            </div>
          </FadeInSection>

          {/* Mobile Bento — stacked cards */}
          <div className="md:hidden grid grid-cols-1 gap-4">
            {features.map((feat, i) => (
              <FadeInSection key={feat.title} delay={i * 80}>
                <div className="rounded-[24px] border-2 border-[#252540] bg-[#0d0d0f] p-6 flex items-start gap-4 hover:border-[#d4af37]/20 transition-colors">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
                    {feat.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{feat.title}</h4>
                    <p className="text-xs text-white/40 mt-1 leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>

          {/* Second Bento Row — 3 equal cards (desktop only) */}
          <div className="hidden md:grid grid-cols-3 gap-[28px] mt-[28px]">
            {[features[3], features[4], features[5]].map((feat, i) => (
              <FadeInSection key={feat.title} delay={400 + i * 100}>
                <TiltCard className="h-[180px] rounded-[42px] border-2 border-[#252540] bg-[#0d0d0f] p-6 flex flex-col justify-between hover:border-[#d4af37]/20 transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
                    {feat.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{feat.title}</h4>
                    <p className="text-xs text-white/40 mt-1 leading-relaxed">{feat.desc}</p>
                  </div>
                </TiltCard>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how" className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#d4af37]/[0.02] to-transparent" />
        <div className="max-w-4xl mx-auto relative z-10">
          <FadeInSection>
            <div className="text-center mb-16">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]/60">Simple et rapide</span>
              <h2 className="text-3xl md:text-5xl font-black mt-4">
                Commencez en <span className="text-[#d4af37]">3 étapes</span>
              </h2>
            </div>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Créer un compte', desc: 'Inscription rapide avec email ou Google. Recevez 10 000 Ar de jetons gratuits.', icon: '🎯' },
              { step: '02', title: 'Déposer', desc: 'Ajoutez des fonds facilement via Mobile Money ou virement bancaire.', icon: '💰' },
              { step: '03', title: 'Jouer', desc: 'Choisissez votre table et montrez vos talents. Bonne chance !', icon: '🃏' },
            ].map((item, i) => (
              <FadeInSection key={item.step} delay={i * 150}>
                <div className="relative group">
                  {/* Connector line */}
                  {i < 2 && (
                    <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-[#d4af37]/30 to-transparent z-0" />
                  )}
                  <div className="relative z-10 text-center">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-[#0d0d0f] border border-[#1a1a2e] flex items-center justify-center text-2xl mb-4 group-hover:border-[#d4af37]/30 group-hover:shadow-lg group-hover:shadow-[#d4af37]/10 transition-all">
                      {item.icon}
                    </div>
                    <span className="text-xs font-mono text-[#d4af37]/40">{item.step}</span>
                    <h3 className="text-lg font-bold mt-2">{item.title}</h3>
                    <p className="text-sm text-white/40 mt-2">{item.desc}</p>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section id="testimonials" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeInSection>
            <div className="text-center mb-16">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]/60">Témoignages</span>
              <h2 className="text-3xl md:text-5xl font-black mt-4">
                Ils nous font <span className="text-[#d4af37]">confiance</span>
              </h2>
            </div>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <FadeInSection key={t.name} delay={i * 150}>
                <TiltCard className="h-full p-6 rounded-[32px] border border-[#1a1a2e] bg-[#0d0d0f] hover:border-[#d4af37]/20 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d4af37] to-[#f0c675] flex items-center justify-center text-black font-bold text-sm">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-white/30">{t.location}</div>
                    </div>
                  </div>
                  <p className="text-sm text-white/50 leading-relaxed">"{t.text}"</p>
                  <div className="flex gap-1 mt-4">
                    {[...Array(5)].map((_, j) => (
                      <span key={j} className="text-[#d4af37] text-sm">★</span>
                    ))}
                  </div>
                </TiltCard>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA SECTION ─── */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#d4af37]/5 blur-[100px]" />
        </div>

        <FadeInSection>
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <h2 className="text-3xl md:text-6xl font-black">
              Rejoignez la <span className="text-[#d4af37]">Table</span>
            </h2>
            <p className="text-lg text-white/40 mt-4 mb-8">
              Des milliers de joueurs vous attendent. Inscrivez-vous gratuitement et recevez 10 000 Ar de jetons.
            </p>
            <button
              onClick={() => navigate('/register')}
              className="group px-10 py-5 rounded-full bg-gradient-to-r from-[#d4af37] to-[#f0c675] text-black font-bold text-lg hover:shadow-2xl hover:shadow-[#d4af37]/30 transition-all active:scale-95"
            >
              Créer mon compte gratuitement
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </FadeInSection>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d4af37] to-[#f0c675] flex items-center justify-center">
                  <span className="text-black font-black text-sm">PM</span>
                </div>
                <span className="text-lg font-bold">
                  Poker <span className="text-[#d4af37]">Mada</span>
                </span>
              </div>
              <p className="text-sm text-white/30 max-w-xs">
                La première plateforme de poker en ligne 100% malgache. Jouez responsablement.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <span className="text-xl">🇲🇬</span>
                <span className="text-xs text-white/20">Fait avec fierté à Madagascar</span>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">Plateforme</h4>
              <div className="flex flex-col gap-2">
                {['Tables', 'Tournois', 'Classement', 'Règles'].map((link) => (
                  <span key={link} className="text-sm text-white/30 hover:text-white/60 cursor-pointer transition-colors">{link}</span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">Support</h4>
              <div className="flex flex-col gap-2">
                {['Centre d\'aide', 'Contact', 'Conditions', 'Confidentialité'].map((link) => (
                  <span key={link} className="text-sm text-white/30 hover:text-white/60 cursor-pointer transition-colors">{link}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <span className="text-xs text-white/20">© 2026 Poker Mada. Tous droits réservés.</span>
            <span className="text-xs text-white/20">Jouez responsablement. 18+</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
