import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useScroll, useTransform, useMotionValue, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ShieldCheck, FileText, Gavel, AlertCircle,
  Phone, Shield, AlertTriangle, User, ShieldAlert, Baby,
  Stethoscope, HeartPulse, Car, Flame, Wind, Train,
  MapPin, UserCheck, Brain, Ban, Vote, Droplets, Zap,
  ShoppingBag, IndianRupee, Activity, Siren, Navigation,
  ChevronRight, CheckCircle2, ClipboardList, Scale, MessageCircle, Search,
  FolderKanban, Upload, Calendar, Clock3, BookOpen, Database,
  Sparkles, Briefcase, Lock, Settings, LogIn,
  ListChecks, Check, Users, Building2, Network,
  BadgeCheck, Gift, TrendingUp, AlertOctagon, Landmark,
  ChevronDown, MoreHorizontal, Bell, BarChart3, PieChart,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/* ─────────────────────────────────────
   TYPES
───────────────────────────────────── */
interface FeatureCardProps {
  emoji: string;
  title: string;
  description: string;
  link: string;
  bgImage?: string;
  index: number;
}

interface HelplineCardProps {
  icon: React.ElementType;
  name: string;
  number: string;
  descEn: string;
  descHi: string;
  index: number;
}

type HelplineEntry = Omit<HelplineCardProps, 'index'>;

interface SectionWrapProps {
  children: React.ReactNode;
  className?: string;
}

/* ─────────────────────────────────────
   ANIMATION VARIANTS
───────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 48 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.8, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i: number = 0) => ({
    opacity: 1,
    transition: { duration: 0.7, delay: i * 0.1 },
  }),
};

const slideRight = {
  hidden: { opacity: 0, x: -72 },
  visible: { opacity: 1, x: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] as const } },
};

const slideLeft = {
  hidden: { opacity: 0, x: 72 },
  visible: { opacity: 1, x: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] as const } },
};

const slideUpBig = {
  hidden: { opacity: 0, y: 64 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i: number = 0) => ({
    opacity: 1, scale: 1,
    transition: { duration: 0.7, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

/* "Assembly" — Apple-style: starts stacked/scattered near center, flies to place */
const assemble = {
  hidden: (i: number = 0) => ({
    opacity: 0,
    scale: 0.4,
    x: (i % 2 === 0 ? -1 : 1) * (40 + (i % 3) * 14),
    y: -30 + (i % 3) * 18,
    rotate: (i % 2 === 0 ? -1 : 1) * 8,
  }),
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
    rotate: 0,
    transition: { duration: 0.9, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

/* Word-by-word reveal */
const wordReveal = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};
const wordChild = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

/* ─────────────────────────────────────
   SCROLL SECTION WRAPPER
───────────────────────────────────── */
const Reveal = ({ children, className = '' }: SectionWrapProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' as any });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} className={className}>
      {children}
    </motion.div>
  );
};

/* ─────────────────────────────────────
   WORD-BY-WORD HEADLINE
───────────────────────────────────── */
const WordReveal = ({ text, className = '', highlightWords = [] }: { text: string; className?: string; highlightWords?: string[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' as any });
  const words = text.split(' ');
  return (
    <motion.div ref={ref} variants={wordReveal} initial="hidden" animate={inView ? 'visible' : 'hidden'} className={`flex flex-wrap gap-x-[0.28em] gap-y-1 ${className}`}>
      {words.map((word, i) => (
        <motion.span key={i} variants={wordChild} className={highlightWords.includes(word) ? 'bg-gradient-to-r from-saffron to-orange-400 bg-clip-text text-transparent' : ''}>
          {word}
        </motion.span>
      ))}
    </motion.div>
  );
};

/* ─────────────────────────────────────
   MULTI-LINE HEADLINE — line 1 left, line 2 right, line 3 fade-up, line 4 scale-in
───────────────────────────────────── */
const MultiLineHeadline = ({ lines, className = '' }: { lines: React.ReactNode[]; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' as any });
  const variantsByIndex = [slideRight, slideLeft, slideUpBig, scaleIn];
  return (
    <div ref={ref} className={className}>
      {lines.map((line, i) => {
        const v = variantsByIndex[i % variantsByIndex.length];
        return (
          <motion.div
            key={i}
            custom={i}
            variants={v as any}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            transition={{ delay: i * 0.13 }}
          >
            {line}
          </motion.div>
        );
      })}
    </div>
  );
};

/* ─────────────────────────────────────
   ANIMATED COUNTER
───────────────────────────────────── */
const AnimatedNumber = ({ target, suffix = '' }: { target: number; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let c = 0;
    const step = Math.ceil(target / 90);
    const t = setInterval(() => {
      c += step;
      if (c >= target) { setCount(target); clearInterval(t); }
      else setCount(c);
    }, 18);
    return () => clearInterval(t);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

/* ─────────────────────────────────────
   AMBIENT DECORATION PRIMITIVES
───────────────────────────────────── */
const NoiseOverlay = ({ opacity = 0.05 }: { opacity?: number }) => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 mix-blend-overlay"
    style={{
      opacity,
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
    }}
  />
);

const GridOverlay = ({ className = '', size = 46 }: { className?: string; size?: number }) => (
  <div
    aria-hidden
    className={`pointer-events-none absolute inset-0 ${className}`}
    style={{
      backgroundImage:
        'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
      backgroundSize: `${size}px ${size}px`,
      maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)',
      WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)',
    }}
  />
);

/* Soft radial glow blob — reusable ambient background piece */
const GlowOrb = ({
  className = '', color = 'rgba(255,138,0,0.18)', size = 500, duration = 9, delay = 0,
}: { className?: string; color?: string; size?: number; duration?: number; delay?: number }) => (
  <motion.div
    aria-hidden
    animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0.9, 0.55] }}
    transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
    className={`absolute rounded-full pointer-events-none ${className}`}
    style={{
      width: size, height: size,
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
    }}
  />
);

/* Floating particle field */
const ParticleField = ({ count = 16, color = 'bg-saffron/30' }: { count?: number; color?: string }) => {
  const particles = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.random() * 92 + 4,
        y: Math.random() * 92 + 4,
        delay: i * 0.27,
        size: Math.random() * 3.5 + 2,
        dur: 4 + Math.random() * 3,
      })),
    [count]
  );
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${color}`}
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{ y: [-10, 10, -10], opacity: [0.15, 0.75, 0.15] }}
          transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
        />
      ))}
    </div>
  );
};

const Marquee = ({
  children, reverse = false, duration = 32, gap = 'gap-5',
}: { children: React.ReactNode; reverse?: boolean; duration?: number; gap?: string }) => (
  <div className="overflow-hidden w-full [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
    <div className={`flex w-max ${gap} ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'}`}
      style={{ animationDuration: `${duration}s` }}>
      {children}
    </div>
  </div>
);

const Magnetic = ({ children, strength = 16 }: { children: React.ReactNode; strength?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ x: (e.clientX - rect.left - rect.width / 2) / strength, y: (e.clientY - rect.top - rect.height / 2) / strength });
  };
  return (
    <motion.div ref={ref} onMouseMove={handleMove} onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: pos.x, y: pos.y }} transition={{ type: 'spring', stiffness: 150, damping: 12, mass: 0.3 }}
      className="inline-block">
      {children}
    </motion.div>
  );
};

/* Floating particle dot (legacy single-particle helper retained for compatibility) */
const Particle = ({ x, y, delay, size = 3 }: { x: number; y: number; delay: number; size?: number }) => (
  <motion.div
    className="absolute rounded-full bg-saffron/30 pointer-events-none"
    style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
    animate={{ y: [-8, 8, -8], opacity: [0.2, 0.7, 0.2] }}
    transition={{ duration: 4 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
  />
);

/* ─────────────────────────────────────
   FEATURE CARD — cinematic glass card
───────────────────────────────────── */
const FeatureCard = ({ emoji, title, description, link, bgImage, index }: FeatureCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-48px' as any });
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const handleTilt = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 10);
    rotateX.set(py * -10);
  };
  const resetTilt = () => { rotateX.set(0); rotateY.set(0); };

  return (
    <motion.div
      ref={ref}
      custom={index}
      variants={scaleIn}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      onMouseMove={handleTilt}
      onMouseLeave={resetTilt}
      whileHover={{ y: -14, scale: 1.03 }}
      style={{ rotateX, rotateY, transformPerspective: 1000, minHeight: 360 } as any}
      className="relative overflow-hidden rounded-[28px] group cursor-pointer bg-navy border border-white/8 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] transition-shadow duration-700 hover:shadow-[0_44px_90px_-20px_rgba(255,138,0,0.35)]"
    >
      {bgImage && (
        <img src={bgImage} className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-[1.1]" alt={title} />
      )}
      {/* Deep cinematic gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/80 to-navy/20" />
      {/* Saffron hover gradient */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{ background: 'linear-gradient(to top, rgba(255,138,0,0.35) 0%, rgba(7,18,43,0.3) 45%, transparent 100%)' }} />
      {/* Glow ring */}
      <div className="absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/0 group-hover:ring-saffron/60 transition-all duration-700 pointer-events-none" />
      {/* Inner light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      <div className="relative p-8 z-10 text-white h-full flex flex-col justify-end">
        <motion.div whileHover={{ scale: 1.1, rotate: 5 }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg transition-all duration-300 group-hover:bg-saffron group-hover:border-saffron/80 group-hover:shadow-saffron/30 group-hover:shadow-xl">
          <span className="text-2xl">{emoji}</span>
        </motion.div>
        <h3 className="text-xl font-bold mb-2.5 leading-snug tracking-tight">{title}</h3>
        <p className="text-white/55 mb-7 text-sm leading-relaxed">{description}</p>
        <Link to={link}
          className="inline-flex items-center text-sm font-bold text-saffron hover:text-orange-300 transition-colors group/lnk w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded-md gap-1.5">
          Get Started
          <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <ArrowRight className="h-3.5 w-3.5" />
          </motion.div>
        </Link>
      </div>
    </motion.div>
  );
};

/* ─────────────────────────────────────
   HELPLINE CARD
───────────────────────────────────── */
const HelplineCard = ({ icon: Icon, name, number, descEn, descHi, index }: HelplineCardProps) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-32px' as any });
  return (
    <motion.div
      ref={ref}
      custom={index % 6}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      whileHover={{ y: -6, scale: 1.02, boxShadow: '0 24px 56px rgba(7,18,43,0.14)' }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="bg-white border border-gray-100/80 rounded-2xl p-5 hover:border-green-200/80 transition-colors duration-400 group flex flex-col backdrop-blur-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="bg-green-50 p-2.5 rounded-xl group-hover:bg-green-100 transition-colors duration-300 shadow-sm">
          <Icon className="h-4 w-4 text-green-600" />
        </div>
        <span className="text-2xl font-black text-navy tracking-tight leading-none">{number}</span>
      </div>
      <h3 className="text-[13px] font-bold text-navy mb-1.5">{name}</h3>
      <p className="text-[11px] text-gray-500 leading-snug mb-1 flex-grow">{descEn}</p>
      <p className="text-[11px] text-gray-400 italic leading-snug mb-4">{descHi}</p>
      <a href={`tel:${number}`}
        className="mt-auto w-full bg-navy text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-saffron transition-all duration-300 group/btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2 shadow-sm hover:shadow-saffron/25 hover:shadow-lg">
        <Phone className="h-3 w-3" />
        {t('landing.emergency.callNow')}
      </a>
    </motion.div>
  );
};

/* ─────────────────────────────────────
   LAWYER PRO BLOCK
   Four sections for the "Lawyer Dashboard (Pro)" audience.
   Reuses existing tokens (navy / saffron), existing card language
   (rounded-2xl/3xl, section-label, fadeUp/scaleIn), existing dark
   gradient pattern already used by Testimonials/CTA.
───────────────────────────────────── */

/* Suite data for the Feature Galaxy */
interface SuiteNode {
  id: string;
  label: string;
  icon: React.ElementType;
  items: { label: string; icon: React.ElementType }[];
}

const SUITE_NODES: SuiteNode[] = [
  { id: 'case', label: 'Case Management', icon: FolderKanban, items: [
    { label: 'Case Registration', icon: FileText },
    { label: 'Status Tracking', icon: ListChecks },
    { label: 'Client Management', icon: Users },
    { label: 'Court Tracking', icon: Building2 },
  ] },
  { id: 'evidence', label: 'Evidence Suite', icon: Upload, items: [
    { label: 'Upload Evidence', icon: Upload },
    { label: 'PDF / Image Preview', icon: FileText },
    { label: 'Categorization', icon: FolderKanban },
  ] },
  { id: 'ai', label: 'AI Suite', icon: Sparkles, items: [
    { label: 'Case Analysis', icon: Search },
    { label: 'Draft Assistance', icon: FileText },
    { label: 'Legal Questions', icon: MessageCircle },
  ] },
  { id: 'research', label: 'Research Suite', icon: BookOpen, items: [
    { label: 'Legal Research', icon: Search },
    { label: 'Research Vault', icon: Database },
  ] },
  { id: 'hearing', label: 'Hearing Suite', icon: Calendar, items: [
    { label: 'Hearing Manager', icon: Gavel },
    { label: 'Hearing Calendar', icon: Calendar },
  ] },
  { id: 'workflow', label: 'Workflow Suite', icon: Clock3, items: [
    { label: 'Timeline', icon: Clock3 },
    { label: 'Drafting Center', icon: FileText },
    { label: 'Case Workspace', icon: Briefcase },
  ] },
  { id: 'system', label: 'System', icon: Lock, items: [
    { label: 'Login & Signup', icon: LogIn },
    { label: 'Profile & Settings', icon: Settings },
  ] },
];

/* A — FEATURE GALAXY: suite grid that expands on hover (no orbit physics,
   same interaction cost as the existing FeatureCard tilt, just simpler) */
const FeatureGalaxy = () => {
  const [activeId, setActiveId] = useState<string>('case');
  const active = SUITE_NODES.find(n => n.id === activeId) ?? SUITE_NODES[0];

  return (
    <section className="relative py-32 lg:py-44 bg-[#F3F4FB] overflow-hidden">
      <GlowOrb className="top-[-10%] right-[-10%]" color="rgba(15,16,40,0.06)" size={520} duration={12} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <Reveal className="mb-16 max-w-2xl">
          <span className="section-label text-saffron block">For Lawyers</span>
          <MultiLineHeadline
            className="text-4xl md:text-5xl lg:text-6xl font-black text-navy leading-[1.05] tracking-[-0.04em] mb-5"
            lines={[
              <span key="l1">One practice.</span>,
              <span key="l2">Seven connected</span>,
              <span key="l3" className="bg-gradient-to-r from-saffron to-orange-400 bg-clip-text text-transparent">suites.</span>,
            ]}
          />
          <motion.p variants={fadeUp} className="text-gray-500 text-lg leading-relaxed max-w-lg">
            Everything a practice runs on — case files, evidence, drafting, research and hearings — in one workspace.
          </motion.p>
        </Reveal>

        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            {/* Suite list */}
            <div className="flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {SUITE_NODES.map((node, i) => {
                const Icon = node.icon;
                const isActive = node.id === activeId;
                return (
                  <motion.button
                    key={node.id}
                    custom={i}
                    variants={scaleIn}
                    whileHover={{ x: 4 }}
                    onMouseEnter={() => setActiveId(node.id)}
                    onClick={() => setActiveId(node.id)}
                    className={`group flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left shrink-0 transition-all duration-300 border ${
                      isActive
                        ? 'bg-navy text-white border-navy shadow-lg shadow-navy/20'
                        : 'bg-white text-navy border-gray-100 hover:border-saffron/30 hover:shadow-md'
                    }`}
                  >
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
                      isActive ? 'bg-saffron text-navy' : 'bg-saffron/10 text-saffron'
                    }`}>
                      <Icon className="w-4 h-4" strokeWidth={1.8} />
                    </span>
                    <span className="text-[13.5px] font-bold whitespace-nowrap">{node.label}</span>
                    {isActive && (
                      <motion.span layoutId="suite-dot" className="ml-auto w-1.5 h-1.5 rounded-full bg-saffron" />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Active suite detail panel */}
            <div className="relative bg-white rounded-[32px] border border-gray-100/80 p-8 min-h-[280px] shadow-[0_36px_90px_-20px_rgba(15,16,40,0.12)]">
              <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full bg-saffron/10 blur-2xl pointer-events-none" />
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="flex items-center gap-3 mb-7">
                    <span className="w-12 h-12 rounded-2xl bg-saffron/10 text-saffron flex items-center justify-center">
                      <active.icon className="w-5 h-5" strokeWidth={1.7} />
                    </span>
                    <h3 className="font-bold text-navy text-xl tracking-tight">{active.label}</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {active.items.map((item, i) => (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ x: 3, borderColor: 'rgba(255,138,0,0.4)' }}
                        transition={{ delay: i * 0.05, duration: 0.3 }}
                        className="flex items-center gap-2.5 text-[13.5px] font-semibold text-gray-600 bg-[#FAFAF9] rounded-xl px-3.5 py-3 border border-gray-100"
                      >
                        <item.icon className="w-3.5 h-3.5 text-saffron shrink-0" strokeWidth={1.8} />
                        {item.label}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

/* B — AI COMMAND CENTER: glassmorphism panels, no grid lines, soft glow */
const COMMAND_RECOMMENDATIONS = [
  'Cite Sharma v. State (2024) — similar facts, bail granted',
  'Attach character certificate as Annexure C',
  'BNSS §480(3) favors first-time offenders',
];

const CommandCenter = () => {
  const [typed, setTyped] = useState('');
  const [visibleRecs, setVisibleRecs] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-150px' as any });
  const fullText = 'Draft a bail application under BNSS Section 480...';

  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [inView]);

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => {
      setVisibleRecs(v => (v < COMMAND_RECOMMENDATIONS.length ? v + 1 : v));
    }, 550);
    return () => clearInterval(id);
  }, [inView]);

  return (
    <section ref={ref} className="relative py-32 lg:py-44 bg-gradient-to-b from-navy via-[#0d1230] to-navy overflow-hidden">
      <GlowOrb className="top-[-15%] right-[-8%]" color="rgba(255,138,0,0.22)" size={560} duration={9} />
      <GlowOrb className="bottom-[-15%] left-[-10%]" color="rgba(34,197,94,0.1)" size={480} duration={12} delay={2} />
      <ParticleField count={20} />
      <NoiseOverlay opacity={0.025} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="mb-14 max-w-xl">
          <span className="section-label text-saffron/70 block">AI Suite</span>
          <MultiLineHeadline
            className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-[-0.03em] mb-5"
            lines={[
              <span key="l1">Your AI co-counsel,</span>,
              <span key="l2" className="bg-gradient-to-r from-saffron to-orange-400 bg-clip-text text-transparent">always on shift.</span>,
            ]}
          />
          <motion.p variants={fadeUp} className="text-gray-400 text-lg leading-relaxed">
            Drafting, research and case analysis — running in the background of every case.
          </motion.p>
        </Reveal>

        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Drafting panel */}
            <motion.div
              whileHover={{ y: -4 }}
              className="lg:col-span-7 bg-white/[0.05] border border-white/10 rounded-[32px] backdrop-blur-2xl overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/8">
                <span className="w-2 h-2 rounded-full bg-white/15" />
                <span className="w-2 h-2 rounded-full bg-white/15" />
                <span className="w-2 h-2 rounded-full bg-white/15" />
                <span className="ml-2 text-[11px] font-bold tracking-wide uppercase text-white/35">Draft Assistant</span>
              </div>
              <div className="p-6 min-h-[220px] flex flex-col">
                <div className="flex items-start gap-2.5 mb-5">
                  <motion.span
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-6 h-6 rounded-full bg-saffron/20 flex items-center justify-center shrink-0 mt-0.5"
                  >
                    <Sparkles className="w-3 h-3 text-saffron" />
                  </motion.span>
                  <p className="text-white/80 text-[14px] leading-relaxed">
                    {typed}
                    <span className="inline-block w-[2px] h-[14px] bg-saffron ml-0.5 align-middle animate-pulse" />
                  </p>
                </div>
                <div className="mt-auto pt-4 border-t border-white/8">
                  <p className="text-[10px] font-bold tracking-wide uppercase text-white/35 mb-3">AI Recommendations</p>
                  <div className="space-y-2.5">
                    {COMMAND_RECOMMENDATIONS.map((r, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={i < visibleRecs ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                        transition={{ duration: 0.4 }}
                        className="flex items-start gap-2.5 text-[13px] text-white/60"
                      >
                        <Check className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" strokeWidth={2} />
                        {r}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right column */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <motion.div whileHover={{ y: -4 }} className="bg-white/[0.05] border border-white/10 rounded-[28px] backdrop-blur-2xl p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]">
                <p className="text-[11px] font-bold tracking-wide uppercase text-white/35 mb-4">Legal Research</p>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 mb-4">
                  <Search className="w-3.5 h-3.5 text-white/40" />
                  <span className="text-[13px] text-white/45">BNS § 103 precedents...</span>
                </div>
                <div className="space-y-2">
                  {['State v. Mehra (2023)', 'Rajesh Kumar v. UOI (2022)'].map(c => (
                    <div key={c} className="flex items-center gap-2 text-[12.5px] text-white/55 py-1">
                      <BookOpen className="w-3 h-3 text-saffron/70 shrink-0" /> {c}
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div whileHover={{ y: -4 }} className="bg-white/[0.05] border border-white/10 rounded-[28px] backdrop-blur-2xl p-6 flex-1 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]">
                <p className="text-[11px] font-bold tracking-wide uppercase text-white/35 mb-4">Case Strength</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] text-white/55">Confidence</span>
                  <span className="font-black text-saffron text-lg">82%</span>
                </div>
                <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: '82%' }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full bg-gradient-to-r from-saffron to-orange-400 shadow-[0_0_12px_rgba(255,138,0,0.6)]"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

/* C — PRODUCT SHOWCASE: premium SaaS dashboard mockup with real-feeling modules */
interface ShowcaseScreen {
  id: string; label: string; title: string; body: string; icon: React.ElementType;
}
const SHOWCASE_SCREENS: ShowcaseScreen[] = [
  { id: 'dashboard', label: 'Case Dashboard', title: 'Every case, one view', body: 'Track status, deadlines and priority across your full caseload.', icon: FolderKanban },
  { id: 'evidence', label: 'Evidence Center', title: 'Evidence that stays organized', body: 'Upload, preview and categorize the moment files arrive.', icon: Upload },
  { id: 'drafting', label: 'AI Drafting', title: 'Court-ready drafts in seconds', body: 'Generate filings grounded in BNS and BNSS citations.', icon: FileText },
  { id: 'research', label: 'Research Vault', title: 'Precedents at your fingertips', body: 'Search case law and save what matters to your case.', icon: Database },
  { id: 'hearing', label: 'Hearing Calendar', title: 'Never miss a court date', body: 'Hearings sync automatically across every court you appear in.', icon: Calendar },
];

const DASHBOARD_STATUS_COLORS: Record<string, string> = {
  Active: 'bg-blue-50 text-blue-600 border-blue-100',
  Pending: 'bg-amber-50 text-amber-600 border-amber-100',
  Won: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  Risk: 'bg-red-50 text-red-600 border-red-100',
};

const ProductShowcase = () => {
  const [active, setActive] = useState(0);
  const screen = SHOWCASE_SCREENS[active];
  const Icon = screen.icon;

  return (
    <section className="relative py-32 lg:py-44 bg-[#FAFAF9] overflow-hidden">
      <GlowOrb className="bottom-[-10%] right-[-8%]" color="rgba(255,138,0,0.08)" size={460} duration={11} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <Reveal className="mb-16 max-w-xl">
          <span className="section-label text-saffron block">Product Tour</span>
          <MultiLineHeadline
            className="text-4xl md:text-5xl lg:text-6xl font-black text-navy leading-[1.05] tracking-[-0.04em]"
            lines={[
              <span key="l1">See the workspace</span>,
              <span key="l2" className="bg-gradient-to-r from-saffron to-orange-400 bg-clip-text text-transparent">in action.</span>,
            ]}
          />
        </Reveal>

        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              {/* tab list */}
              <div className="flex flex-wrap gap-2 mb-8">
                {SHOWCASE_SCREENS.map((s, i) => (
                  <motion.button
                    key={s.id}
                    onClick={() => setActive(i)}
                    whileHover={{ y: -2 }}
                    className={`px-4 py-2 rounded-full text-[12.5px] font-bold transition-all duration-300 border ${
                      i === active
                        ? 'bg-navy text-white border-navy shadow-md shadow-navy/20'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-saffron/40'
                    }`}
                  >
                    {s.label}
                  </motion.button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={screen.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h3 className="text-3xl font-black text-navy mb-4 tracking-tight">{screen.title}</h3>
                  <p className="text-gray-500 text-lg leading-relaxed max-w-md">{screen.body}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Premium SaaS dashboard mockup */}
            <div className="relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={screen.id}
                  initial={{ opacity: 0, scale: 0.97, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-[28px] overflow-hidden border border-gray-100 bg-white shadow-[0_40px_90px_-20px_rgba(7,18,43,0.28)]"
                >
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-[#FAFAF9]">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                    <span className="ml-3 text-[11px] text-gray-400 font-mono">pocketlawyer.app/{screen.id}</span>
                    <Bell className="w-3.5 h-3.5 text-gray-300 ml-auto" />
                  </div>

                  <div className="p-6">
                    {/* Header row */}
                    <div className="flex items-center gap-3 mb-6">
                      <span className="w-10 h-10 rounded-xl bg-saffron/10 text-saffron flex items-center justify-center">
                        <Icon className="w-4.5 h-4.5" strokeWidth={1.8} />
                      </span>
                      <span className="font-bold text-navy text-base">{screen.label}</span>
                      <MoreHorizontal className="w-4 h-4 text-gray-300 ml-auto" />
                    </div>

                    {/* Stat tiles */}
                    <div className="grid grid-cols-3 gap-2.5 mb-5">
                      {[
                        { label: 'Active Cases', val: '24', icon: FolderKanban, color: 'text-blue-500 bg-blue-50' },
                        { label: 'Hearings This Week', val: '6', icon: Calendar, color: 'text-purple-500 bg-purple-50' },
                        { label: 'AI Tasks Done', val: '38', icon: Sparkles, color: 'text-emerald-500 bg-emerald-50' },
                      ].map((tile, i) => (
                        <div key={i} className="bg-[#FAFAF9] border border-gray-100 rounded-xl p-3">
                          <span className={`inline-flex w-6 h-6 rounded-lg items-center justify-center mb-2 ${tile.color}`}>
                            <tile.icon className="w-3 h-3" strokeWidth={2} />
                          </span>
                          <p className="text-lg font-black text-navy leading-none">{tile.val}</p>
                          <p className="text-[9.5px] text-gray-400 font-semibold mt-1 leading-tight">{tile.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Mini bar chart + case rows */}
                    <div className="grid grid-cols-5 gap-1.5 items-end h-14 mb-5 px-1">
                      {[40, 65, 50, 85, 60, 95, 70].map((h, i) => (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          whileInView={{ height: `${h}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6, delay: i * 0.05 }}
                          className="bg-gradient-to-t from-saffron/70 to-saffron/30 rounded-md"
                        />
                      ))}
                    </div>

                    <div className="space-y-2">
                      {[
                        { name: 'Sharma vs State', status: 'Active' },
                        { name: 'Verma Property Dispute', status: 'Pending' },
                        { name: 'Gupta Bail Application', status: 'Won' },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center justify-between bg-[#FAFAF9] border border-gray-100 rounded-xl px-3.5 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center text-[9px] font-bold text-navy">
                              {row.name.charAt(0)}
                            </div>
                            <span className="text-[12px] font-semibold text-navy">{row.name}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${DASHBOARD_STATUS_COLORS[row.status]}`}>
                            {row.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Floating mini-card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                style={{ animation: 'floatA 5.5s ease-in-out infinite' } as any}
                className="hidden lg:flex absolute -bottom-6 -left-8 bg-white rounded-2xl shadow-2xl shadow-navy/15 p-3.5 items-center gap-2.5 border border-gray-100 z-20"
              >
                <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Win Rate</p>
                  <p className="text-sm font-black text-navy">86%</p>
                </div>
              </motion.div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

/* D — AI LEGAL OS — ecosystem map, enlarged 40%, with bigger center node & hover glow */
const ECOSYSTEM_NODES = [
  { label: 'Lawyers', icon: Gavel, angle: -90 },
  { label: 'Clients', icon: Users, angle: -34 },
  { label: 'Courts', icon: Landmark, angle: 22 },
  { label: 'Research', icon: BookOpen, angle: 78 },
  { label: 'Evidence', icon: FolderKanban, angle: 134 },
  { label: 'Drafting', icon: FileText, angle: -146 },
];

const EcosystemMap = () => {
  const radius = 245; // ~40% larger than original 175
  return (
    <section className="relative py-32 lg:py-44 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <Reveal className="mb-16 text-center max-w-xl mx-auto">
          <span className="section-label text-saffron block">Legal Ecosystem</span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-navy leading-[1.05] tracking-[-0.04em]">
            Everyone works from<br />the same source.
          </h2>
        </Reveal>

        <Reveal>
          <div className="relative mx-auto" style={{ width: '100%', maxWidth: 760, height: 580 }}>
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="-380 -290 760 580">
              {ECOSYSTEM_NODES.map((n, i) => {
                const rad = (n.angle * Math.PI) / 180;
                const x = Math.cos(rad) * radius;
                const y = Math.sin(rad) * radius;
                return (
                  <motion.line key={n.label} x1={0} y1={0} x2={x} y2={y}
                    stroke="rgba(255,138,0,0.3)" strokeWidth={1.4}
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: 0.1 + i * 0.07 }} />
                );
              })}
            </svg>

            {/* Center node — 40% larger, circular framed placeholder image area */}
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.1 }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
            >
              <div className="relative w-36 h-36 rounded-full bg-navy flex flex-col items-center justify-center text-center shadow-2xl shadow-navy/30 ring-4 ring-saffron/15 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-saffron/10 via-transparent to-transparent" />
                <Network className="w-7 h-7 text-saffron mb-1.5 relative z-10" strokeWidth={1.6} />
                <span className="text-white font-black text-[13px] tracking-tight relative z-10">AI Legal OS</span>
                <span className="text-white/40 text-[9px] font-semibold tracking-wide relative z-10 mt-0.5">Core Engine</span>
              </div>
            </motion.div>

            {ECOSYSTEM_NODES.map((n, i) => {
              const rad = (n.angle * Math.PI) / 180;
              const x = Math.cos(rad) * radius;
              const y = Math.sin(rad) * radius;
              return (
                <motion.div key={n.label}
                  className="absolute left-1/2 top-1/2 z-10"
                  initial={{ opacity: 0, scale: 0.6 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: 0.25 + i * 0.08 }}
                  style={{ x, y, translateX: '-50%', translateY: '-50%' }}>
                  <motion.div
                    animate={{ y: [-5, 5, -5] }}
                    transition={{ duration: 3.5 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
                    whileHover={{ scale: 1.18 }}
                    className="flex flex-col items-center gap-2.5 cursor-pointer"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 flex items-center justify-center shadow-[0_10px_28px_-8px_rgba(7,18,43,0.18)] hover:shadow-[0_16px_36px_-8px_rgba(255,138,0,0.35)] hover:border-saffron/40 transition-all duration-300">
                      <n.icon className="w-6 h-6 text-navy/70" strokeWidth={1.6} />
                    </div>
                    <span className="text-[12px] font-bold text-gray-500 whitespace-nowrap">{n.label}</span>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════
   MAIN LANDING PAGE
═══════════════════════════════════════════════ */
export const LandingPage = () => {
  const { t } = useTranslation();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.6], [1, 0.95]);

  const fir = 345;
  const legal = 580;
  const research = 420;
  const total = fir + legal + research;

  useEffect(() => {
    const h = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, []);

  const problemStats: string[] = [
    t('landing.problem.stat1'),
    t('landing.problem.stat2'),
    t('landing.problem.stat3'),
    t('landing.problem.stat4'),
  ];

  const features: FeatureCardProps[] = [
    { emoji: '📝', bgImage: '/card1.jpg', title: t('landing.features.feat1.title'), description: t('landing.features.feat1.description'), link: '/generate', index: 0 },
    { emoji: '⚖️', bgImage: '/card2.jpg', title: t('landing.features.feat2.title'), description: t('landing.features.feat2.description'), link: '/guidance', index: 1 },
    { emoji: '🔍', bgImage: '/card3.jpg', title: t('landing.features.feat3.title'), description: t('landing.features.feat3.description'), link: '/research', index: 2 },
    { emoji: '🛡️', bgImage: '/card4.jpg', title: t('landing.features.feat4.title'), description: t('landing.features.feat4.description'), link: '/generate', index: 3 },
    { emoji: '💬', bgImage: '/card5.jpg', title: t('landing.features.feat5.title'), description: t('landing.features.feat5.description'), link: '/guidance', index: 4 },
  ];

  const steps = [
    {
      num: '01',
      icon: ClipboardList,
      color: 'from-blue-500 to-cyan-500',
      title: 'Describe Your Case',
      desc: 'Tell us what happened in simple words. No legal jargon needed. Our AI understands plain language.'
    },
    {
      num: '02',
      icon: Scale,
      color: 'from-orange-500 to-amber-500',
      title: 'AI generates your complaint application',
      desc: 'Within Seconds, a legally structured draft is created — ready to file with Indian authorities.'
    },
    {
      num: '03',
      icon: Search,
      color: 'from-purple-500 to-pink-500',
      title: 'Get Legal Guidance',
      desc: 'Receive relevant BNS sections, rights information, and actionable next steps for your case.'
    },
    {
      num: '04',
      icon: MessageCircle,
      color: 'from-green-500 to-emerald-500',
      title: 'Know Your Rights',
      desc: 'Chat with our AI legal assistant to understand your rights, duties, and the legal process ahead.'
    },
  ];

  const helplines: HelplineEntry[] = [
    { icon: Shield, name: 'Police Emergency', number: '112', descEn: 'Immediate police assistance for crimes and emergencies.', descHi: 'अपराध या आपात स्थिति में पुलिस सहायता के लिए।' },
    { icon: AlertTriangle, name: 'National Emergency', number: '112', descEn: "India's integrated emergency helpline for police, fire and ambulance.", descHi: 'भारत का एकीकृत आपातकालीन नंबर जो पुलिस, फायर और एम्बुलेंस से जोड़ता है।' },
    { icon: User, name: 'Women Helpline', number: '1091', descEn: 'Support for women facing harassment or violence.', descHi: 'महिलाओं के खिलाफ हिंसा या उत्पीड़न की स्थिति में सहायता।' },
    { icon: HeartPulse, name: 'Women Domestic Violence', number: '181', descEn: 'Assistance for women facing domestic violence.', descHi: 'घरेलू हिंसा का सामना कर रही महिलाओं के लिए सहायता।' },
    { icon: ShieldAlert, name: 'Cyber Crime Helpline', number: '1930', descEn: 'Report online fraud and cyber financial crimes.', descHi: 'ऑनलाइन फ्रॉड और साइबर अपराध की शिकायत के लिए।' },
    { icon: Baby, name: 'Child Helpline', number: '1098', descEn: 'Support for children in distress or danger.', descHi: 'संकट या खतरे में बच्चों के लिए सहायता।' },
    { icon: Stethoscope, name: 'Ambulance Emergency', number: '108', descEn: 'Emergency medical and ambulance services.', descHi: 'चिकित्सा आपातकाल में एम्बुलेंस सेवा।' },
    { icon: HeartPulse, name: 'Health Helpline', number: '104', descEn: 'Government health advice and assistance services.', descHi: 'सरकारी स्वास्थ्य सलाह और सहायता सेवा।' },
    { icon: Car, name: 'Road Accident Emergency', number: '1073', descEn: 'National highway accident emergency helpline.', descHi: 'राष्ट्रीय राजमार्ग दुर्घटना सहायता हेल्पलाइन।' },
    { icon: Flame, name: 'Fire Emergency', number: '101', descEn: 'Fire brigade emergency assistance.', descHi: 'आग लगने की स्थिति में फायर ब्रिगेड सहायता।' },
    { icon: Wind, name: 'Disaster Management', number: '1078', descEn: 'Assistance during natural disasters and emergencies.', descHi: 'प्राकृतिक आपदाओं के दौरान सहायता।' },
    { icon: Train, name: 'Railway Helpline', number: '139', descEn: 'Passenger assistance and railway inquiries.', descHi: 'रेलवे यात्रियों के लिए सहायता और जानकारी।' },
    { icon: Shield, name: 'Railway Security', number: '182', descEn: 'Security assistance for railway passengers.', descHi: 'रेलवे यात्रियों की सुरक्षा के लिए हेल्पलाइन।' },
    { icon: MapPin, name: 'Tourist Helpline', number: '1363', descEn: 'Assistance for tourists across India.', descHi: 'भारत में पर्यटकों के लिए सहायता सेवा।' },
    { icon: UserCheck, name: 'Senior Citizen Helpline', number: '14567', descEn: 'Support services for senior citizens.', descHi: 'वरिष्ठ नागरिकों के लिए सहायता सेवा।' },
    { icon: Brain, name: 'Mental Health (Kiran)', number: '1800-599-0019', descEn: 'Mental health counseling and support.', descHi: 'मानसिक स्वास्थ्य सहायता और परामर्श सेवा।' },
    { icon: Ban, name: 'Anti Corruption', number: '1031', descEn: 'Report corruption related issues.', descHi: 'भ्रष्टाचार से संबंधित शिकायत दर्ज करने के लिए।' },
    { icon: Vote, name: 'Election Commission', number: '1950', descEn: 'Voter information and election assistance.', descHi: 'मतदाता जानकारी और चुनाव सहायता।' },
    { icon: Droplets, name: 'Gas Leakage Emergency', number: '1906', descEn: 'LPG gas leakage emergency assistance.', descHi: 'गैस रिसाव की स्थिति में सहायता।' },
    { icon: Zap, name: 'Electricity Complaint', number: '1912', descEn: 'Electricity service complaints and support.', descHi: 'बिजली सेवा शिकायत और सहायता।' },
    { icon: ShoppingBag, name: 'Consumer Helpline', number: '1800-11-4000', descEn: 'Assistance for consumer rights and complaints.', descHi: 'उपभोक्ता अधिकार और शिकायत सहायता।' },
    { icon: IndianRupee, name: 'Income Tax Helpline', number: '1800-180-1961', descEn: 'Assistance related to income tax queries.', descHi: 'आयकर से संबंधित सहायता।' },
    { icon: Activity, name: 'National AIDS Helpline', number: '1097', descEn: 'Information and support regarding HIV/AIDS.', descHi: 'एचआईवी/एड्स से संबंधित जानकारी और सहायता।' },
    { icon: Siren, name: 'Anti Ragging Helpline', number: '1800-180-5522', descEn: 'Report ragging incidents in educational institutions.', descHi: 'शैक्षणिक संस्थानों में रैगिंग की शिकायत के लिए।' },
    { icon: Navigation, name: 'Traffic Helpline', number: '1073', descEn: 'Report traffic incidents and highway emergencies.', descHi: 'ट्रैफिक या हाईवे दुर्घटना की सूचना देने के लिए।' },
  ];

 const trustBadges = [
  { icon: "🤖", label: "AI-Powered" },
  { icon: "🆓", label: "Free to Use" },
  { icon: "🛡️", label: "Legally Accurate" },
  { icon: "📄", label: "Drafts" },
  { icon: "⚖️", label: "BNS Referenced/IPC Referenced" },
];

  const whyUs = [
    { icon: '⚡', title: 'Instant Draft Generation', body: 'No waiting. No middlemen. Get y draft in under 30 seconds using AI trained on Indian law.', color: 'text-blue-500 bg-blue-50' },
    { icon: '🔒', title: 'Private & Secure', body: 'Your case details never leave without your consent. End-to-end secure and completely confidential.', color: 'text-purple-500 bg-purple-50' },
    { icon: '🌐', title: 'Available in Hindi & English', body: 'Full platform support in both languages so no one is left behind due to a language barrier.', color: 'text-cyan-500 bg-cyan-50' },
    { icon: '📱', title: 'Works on Any Device', body: 'Mobile, tablet, or desktop — PocketLawyer works seamlessly across every screen.', color: 'text-emerald-500 bg-emerald-50' },
    { icon: '⚖️', title: 'Covers All Major Sections', body: 'BNS, BNSS, consumer rights, cyber crime, domestic violence — all mapped and covered.', color: 'text-amber-500 bg-amber-50' },
    { icon: '🆓', title: 'Always Free for Citizens', body: 'Core legal tools are free for every Indian citizen. Justice should never be behind a paywall.', color: 'text-rose-500 bg-rose-50' },
  ];

  const testimonials = [
    { name: "Rahul Sharma", role: "Citizen", review: "AI ne mera Police complaint 30 seonds me bana diya.", rating: 5, image: "https://i.pinimg.com/1200x/d0/96/30/d09630a68ff721c6fff999f138d33d33.jpg" },
    { name: "Anjali Verma", role: "Lawyer", review: "Client management aur drafting easy ho gaya.", rating: 5, image: "https://i.pinimg.com/736x/9a/50/7e/9a507e6cfbe07d8ee1fe75dc95679d01.jpg" },
    { name: "Vikas Gupta", role: "Business Owner", review: "Legal confusion khatam.", rating: 4, image: "https://i.pinimg.com/1200x/8d/e6/31/8de631be7fea1a5186bfe2d0aee04fae.jpg" },
    { name: "Sneha Kapoor", role: "Student", review: "BNS sections samajhna easy ho gaya.", rating: 5, image: "https://i.pinimg.com/736x/a7/1a/08/a71a08d21a60c3518f48cbf6f205b2e7.jpg" },
    { name: "Amit Singh", role: "Startup Founder", review: "Contracts aur legal docs instantly ban gaye.", rating: 5, image: "https://i.pinimg.com/736x/ec/78/71/ec7871366a9546655d9395a1dff158e9.jpg" },
    { name: "Riya Mehta", role: "Intern", review: "Research tool is insanely helpful.", rating: 5, image: "https://i.pinimg.com/736x/d4/a6/c8/d4a6c8d121c9ad977bcfd15037e44b98.jpg" },
    { name: "Karan Patel", role: "Advocate", review: "Dashboard ne pura workflow simplify kar diya.", rating: 5, image: "https://i.pinimg.com/1200x/a6/88/a2/a688a2b4c5f6e072101883bacdc1ef5d.jpg" },
  ];

  const bentoSpan = ['lg:col-span-3', 'lg:col-span-2', 'lg:col-span-2', 'lg:col-span-3'];

  return (
    <div className="overflow-hidden bg-white">

      {/* ── Premium mouse-follow glow ── */}
      <div className="pointer-events-none fixed inset-0 z-50"
        style={{ background: `radial-gradient(600px at ${mousePos.x}px ${mousePos.y}px, rgba(255,140,0,0.08), rgba(255,140,0,0.03) 40%, transparent 70%)` }}
      />

      {/* ════════════════════════════
          HERO  — Cinematic Full-Screen
      ════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden bg-white">

        {/* Deep layered atmosphere */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Primary glow orb */}
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.6, 0.35] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[-5%] right-[-8%] w-[720px] h-[720px] rounded-full"
            style={{
              y: bgY,
              background:
                'radial-gradient(circle, rgba(255,138,0,0.18) 0%, rgba(255,138,0,0.06) 40%, transparent 70%)',
            }}
          />
          {/* Secondary cool orb */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
            className="absolute bottom-[-10%] left-[-5%] w-[560px] h-[560px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(22,101,52,0.1) 0%, transparent 70%)' }}
          />
          {/* Accent third orb */}
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.25, 0.1] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            className="absolute top-1/3 left-1/3 w-[400px] h-[400px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(7,18,43,0.08) 0%, transparent 70%)' }}
          />

          {/* Precision grid */}
          <GridOverlay className="text-navy opacity-[0.028]" size={56} />
          <NoiseOverlay opacity={0.018} />

          {/* Floating particles */}
          <ParticleField count={18} />
        </div>

        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20 lg:py-0"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-20 items-center">

            {/* LEFT — Cinematic Text */}
            <div className="flex flex-col justify-center py-8 lg:py-28 order-2 lg:order-1 items-center lg:items-start text-center lg:text-left">

              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                custom={0}
                whileHover={{ scale: 1.04 }}
                className="inline-flex items-center gap-2.5 px-4 py-2 mb-10 w-fit mx-auto lg:mx-0 text-xs font-bold text-green-700 bg-green-50/80 border border-green-200/60 rounded-full tracking-widest uppercase backdrop-blur-sm shadow-sm"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                {t('landing.hero.badge')}
              </motion.div>

              {/* Giant display headline — word-by-word reveal */}
              <div className="mb-8 overflow-hidden">
                <motion.h1
                  variants={wordReveal}
                  initial="hidden"
                  animate="visible"
                 className="flex flex-wrap justify-center lg:justify-start gap-x-[0.3em] gap-y-1 text-[2.2rem] sm:text-[3rem] lg:text-[5.8rem] xl:text-[3.5rem] font-black text-navy leading-[1.08] tracking-[-0.03em]"
                >
                  {['AI', 'Legal', 'Platform', 'for'].map((word) => (
                    <motion.span key={word} variants={wordChild}>{word}</motion.span>
                  ))}
                  <motion.span variants={wordChild} className="relative inline-block">
                    <span className="relative z-10 bg-gradient-to-r from-saffron via-orange-400 to-saffron bg-clip-text text-transparent">Lawyers &amp; Citizens</span>
                    <motion.span
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.9, delay: 1.1, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute -bottom-1 left-0 w-full h-[3px] bg-gradient-to-r from-saffron to-orange-400 rounded-full origin-left"
                    />
                  </motion.span>
                </motion.h1>
                <motion.p
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={2}
                  className="text-lg sm:text-xl text-gray-500 font-normal mt-4 tracking-tight leading-relaxed"
                >
                  From Legal Help to Complete Practice Management
                </motion.p>
              </div>

              <motion.p
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={2}
                className="text-base md:text-lg text-gray-600 mb-5 max-w-xl leading-[1.8]"
              >
                <strong className="text-navy font-semibold">For Citizens:</strong> Draft complaints, get legal guidance, and understand your rights instantly.
                <br /><br />
                <strong className="text-navy font-semibold">For Lawyers:</strong> Run your virtual law office with AI-powered case management, evidence tracking, and smart assistance.
              </motion.p>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={3}
                className="flex flex-col sm:flex-row gap-4 mb-14"
              >
                <Magnetic>
                  <Link to="/generate"
                    className="group relative flex items-center justify-center gap-3 bg-navy text-white min-w-[280px] h-[68px] rounded-[22px] text-lg font-bold shadow-xl shadow-navy/20 hover:shadow-navy/35 hover:bg-navy/90 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-2.5">
                      Start as Citizen
                      <motion.span animate={{ x: [0, 5, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>
                        <FileText className="h-5 w-5" />
                      </motion.span>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-saffron to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <span className="absolute inset-0 z-10 flex items-center justify-center gap-2.5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-500 font-bold text-base">
                      Start as Citizen
                      <FileText className="h-5 w-5" />
                    </span>
                  </Link>
                </Magnetic>

                <Magnetic>
                  <Link to="/ai-assistant"
                    className="group flex items-center justify-center gap-3 bg-white text-navy border border-gray-200 min-w-[320px] h-[68px] rounded-[22px] text-lg font-semibold shadow-sm hover:border-navy/30 hover:bg-gray-50 hover:shadow-md transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-offset-2"
                  >
                    Lawyer Dashboard (Pro)
                    <motion.span animate={{ rotate: [0, -8, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
                      <Gavel className="h-5 w-5" />
                    </motion.span>
                  </Link>
                </Magnetic>
              </motion.div>

              {/* Trust micro-badges */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={4}
                className="flex flex-wrap gap-2.5 justify-center lg:justify-start"
              >
                {[' draft in 30 seconds', '100% Free', 'Hindi + English', 'BNS Covered'].map((b, i) => (
                  <motion.span
                    key={i}
                    custom={i}
                    variants={scaleIn}
                    initial="hidden"
                    animate="visible"
                    style={{ animation: `floatBadge ${4 + i * 0.4}s ease-in-out infinite` } as any}
                    whileHover={{ y: -3, scale: 1.05 }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-100 px-3.5 py-2 rounded-full shadow-sm hover:border-saffron/30 hover:text-saffron hover:shadow-md transition-all duration-300 cursor-default"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    {b}
                  </motion.span>
                ))}
              </motion.div>
            </div>

            {/* RIGHT — Floating Image Composition */}
            <motion.div
              variants={slideLeft}
              initial="hidden"
              animate="visible"
              className="relative flex items-center justify-center py-8 lg:py-24 order-1 lg:order-2"
            >
              <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto">

                {/* Decorative ring behind image */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-[-10%] rounded-full border border-dashed border-saffron/15 pointer-events-none"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-[-20%] rounded-full border border-dashed border-navy/8 pointer-events-none"
                />

                <motion.div
                  animate={{ y: [0, -14, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative"
                >
                  <img src="/hero-new.png" alt="Legal assistance"
                    className="w-full h-auto object-top drop-shadow-[0_56px_80px_rgba(7,18,43,0.22)] relative z-10"
                  />
                </motion.div>

                {/* Floating card — left */}
                <motion.div
                  initial={{ opacity: 0, x: -30, y: 10 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: 1.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  style={{ animation: 'floatA 5s ease-in-out infinite' } as any}
                  whileHover={{ scale: 1.06 }}
                  className="absolute -left-6 top-1/4 z-20 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-navy/15 p-4 flex items-center gap-3 border border-white/80"
                >
                  <div className="bg-saffron/12 p-2.5 rounded-xl">
                    <ShieldCheck className="h-6 w-6 text-saffron" />
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">AI Powered</p>
                    <p className="text-sm font-bold text-navy">Legal Protection</p>
                  </div>
                </motion.div>

                {/* Floating card — right */}
                <motion.div
                  initial={{ opacity: 0, x: 30, y: 10 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: 1.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  style={{ animation: 'floatB 6s ease-in-out infinite' } as any}
                  whileHover={{ scale: 1.06 }}
                  className="absolute -right-6 bottom-1/4 z-20 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-navy/15 p-4 border border-white/80"
                >
                  <p className="text-3xl font-black text-navy leading-none">{total}+</p>
                  <p className="text-[11px] text-gray-400 mt-1 font-medium uppercase tracking-wider">Cases Handled</p>
                </motion.div>

                {/* Glow behind hero image */}
                <div className="absolute inset-0 z-0"
                  style={{ background: 'radial-gradient(ellipse at center, rgba(255,138,0,0.12) 0%, transparent 65%)' }} />
              </div>
            </motion.div>

          </div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          className="hidden lg:flex absolute bottom-10 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-gray-400"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="text-[10px] tracking-[0.2em] uppercase font-medium">Scroll to explore</span>
          <div className="w-px h-8 bg-gradient-to-b from-gray-300 to-transparent" />
        </motion.div>
      </section>

      {/* Keyframe styles */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .animate-marquee { animation: marquee 25s linear infinite; }
        .animate-marquee-reverse { animation: marquee-reverse 25s linear infinite; }
        @keyframes floatA { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes floatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(10px)} }
        @keyframes floatBadge { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @media (prefers-reduced-motion: reduce) {
          .animate-marquee, .animate-marquee-reverse { animation: none; }
        }
        .section-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          display: block;
          margin-bottom: 1.5rem;
        }
      `}</style>

      {/* ════════════════════════════
          TRUST STRIP — premium Lucide icon badges, marquee, glass + glow
      ════════════════════════════ */}
      <section className="border-y border-gray-100/70 bg-gray-50/40 py-7 overflow-hidden">
        <Marquee duration={30} gap="gap-14">
         {[...trustBadges, ...trustBadges].map((item, i) => (
  <div
    key={i}
    className="flex items-center gap-3 shrink-0"
  >
    <span className="text-2xl">
      {item.icon}
    </span>

    <span className="text-[14px] font-semibold text-gray-700 whitespace-nowrap">
      {item.label}
    </span>
  </div>
))}
        </Marquee>
      </section>

      {/* ════════════════════════════
          PROBLEM SECTION — manifesto style
      ════════════════════════════ */}
      <section className="py-32 lg:py-44 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 lg:gap-28 items-center">

            {/* Image */}
            <Reveal>
              <motion.div variants={slideRight} className="relative">
                <div className="relative flex justify-center items-center">
                  {/* Giant faded number behind image */}
                  <div className="absolute -left-8 -top-8 text-[200px] font-black text-gray-50 select-none pointer-events-none leading-none tracking-tighter z-0">
                    01
                  </div>
                  <motion.img
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.5 }}
                    src="/hero2.png"
                    alt="Justice"
                    className="w-full max-w-[440px] h-auto object-contain drop-shadow-[0_40px_70px_rgba(0,0,0,0.20)] relative z-10"
                  />
                </div>
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                  className="absolute -bottom-6 -right-6 w-36 h-36 rounded-full border border-dashed border-saffron/20 pointer-events-none"
                />
              </motion.div>
            </Reveal>

            {/* Text + premium bento */}
            <Reveal>
              <motion.div variants={slideLeft}>
                <span className="section-label text-saffron">The Problem</span>
                {/* Manifesto-style large headline */}
                <h2 className="text-4xl md:text-5xl lg:text-[3.4rem] font-black text-navy mb-6 leading-[1.05] tracking-[-0.04em]">
                  {t('landing.problem.headline')}
                </h2>
                <p className="text-gray-500 text-lg leading-[1.9] mb-12 max-w-lg">
                  {t('landing.problem.subheadline')}
                </p>

                {/* Premium bento grid */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                  {problemStats.map((label, i) => (
                    <motion.div
                      key={i}
                      custom={i}
                      variants={fadeUp}
                      whileHover={{ scale: 1.03, y: -4 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                      className={`relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-red-50 to-red-50/40 border border-red-100/60 hover:border-red-200 transition-colors duration-400 ${bentoSpan[i] ?? 'lg:col-span-3'} group`}
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-red-100/30 translate-x-8 -translate-y-8 group-hover:scale-150 transition-transform duration-700" />
                      <div className="flex items-start gap-3 relative z-10">
                        <div className="bg-white p-2 rounded-xl shrink-0 shadow-sm border border-red-100/50">
                          <AlertOctagon className="h-4 w-4 text-red-400" />
                        </div>
                        <span className="text-gray-700 text-sm font-medium leading-relaxed">{label}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* ════════════════════════════
          HOW IT WORKS — premium animated timeline
      ════════════════════════════ */}
      <section className="relative py-32 lg:py-44 bg-[#FAFAF9] overflow-hidden">
        <GlowOrb className="top-[5%] left-[-10%]" color="rgba(255,138,0,0.08)" size={420} duration={10} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

          {/* Section header */}
          <Reveal className="mb-24">
            <span className="section-label text-saffron block">Simple Process</span>
            <MultiLineHeadline
              className="text-5xl md:text-6xl lg:text-7xl font-black text-navy leading-[1.0] tracking-[-0.04em] mb-6"
              lines={[
                <span key="l1">How It</span>,
                <span key="l2" className="bg-gradient-to-r from-saffron to-orange-400 bg-clip-text text-transparent">Works</span>,
              ]}
            />
            <motion.p variants={fadeUp} className="text-gray-500 text-lg leading-relaxed max-w-md">
              Get legal help in four simple steps — no lawyer visits, no paperwork hassle.
            </motion.p>
          </Reveal>

          {/* Desktop: 4-column cards with self-drawing connecting line */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Self-drawing SVG connector */}
            <div className="hidden lg:block absolute top-14 left-[12.5%] right-[12.5%] h-[3px] overflow-visible">
              <svg width="100%" height="3" className="overflow-visible">
                <motion.line
                  x1="0" y1="1.5" x2="100%" y2="1.5"
                  stroke="url(#stepGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.8, ease: 'easeOut' }}
                />
                <defs>
                  <linearGradient id="stepGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="35%" stopColor="#FF9D2E" />
                    <stop offset="70%" stopColor="#A855F7" />
                    <stop offset="100%" stopColor="#22C55E" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {steps.map((step, i) => {
              const Icon = step.icon;
              /* per-card entrance direction: left / bottom / top / right (alternating, per brief) */
              const entrance =
                i === 0 ? { x: -90, y: 0 } :
                i === 1 ? { x: 0, y: 90 } :
                i === 2 ? { x: 0, y: -90 } :
                { x: 90, y: 0 };
              return (
                <Reveal key={i}>
                  <motion.div
                    initial={{
                      opacity: 0,
                      x: entrance.x,
                      y: entrance.y,
                    }}
                    whileInView={{
                      opacity: 1,
                      x: 0,
                      y: 0,
                    }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.8,
                      delay: i * 0.15,
                      ease: [0.16, 1, 0.3, 1]
                    }}
                    whileHover={{
                      y: -18,
                      scale: 1.03,
                      boxShadow: '0 40px 80px -20px rgba(255,138,0,0.25)'
                    }}
                    className="relative bg-white rounded-3xl p-8 shadow-[0_30px_80px_rgba(0,0,0,0.08)] border border-gray-100/80 transition-shadow duration-500 group"
                  >
                    {/* Step number background watermark */}
                    <div className="absolute top-4 right-5 text-7xl font-black text-gray-50 leading-none select-none pointer-events-none"
                      style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {i + 1}
                    </div>

                    <div className="relative w-14 h-14 mb-8">
                      <div
                        className={`
                          w-full h-full rounded-2xl
                          bg-gradient-to-br ${step.color}
                          flex items-center justify-center
                          text-white
                          shadow-lg
                        `}
                      >
                        <motion.div
                          whileHover={{
                            rotate: 20,
                            scale: 1.2
                          }}
                          transition={{ type: 'spring', stiffness: 300 }}
                        >
                          <Icon className="h-6 w-6" />
                        </motion.div>
                      </div>
                      {/* Step indicator dot */}
                      <motion.span
                        whileHover={{ scale: 1.3 }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-saffron text-white text-[11px] font-black rounded-full flex items-center justify-center shadow-md shadow-saffron/30"
                      >
                        {i + 1}
                      </motion.span>
                    </div>

                    <h3 className="font-bold text-navy mb-3 text-[17px] leading-snug tracking-tight relative z-10">{step.title}</h3>
                    <p className="text-gray-500 text-sm leading-[1.8] relative z-10">{step.desc}</p>

                    {/* Animated bottom accent */}
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.2 + i * 0.15 }}
                      className="absolute bottom-0 left-8 right-8 h-0.5 bg-gradient-to-r from-saffron/0 via-saffron/40 to-saffron/0 rounded-full origin-left"
                    />
                  </motion.div>
                </Reveal>
              );
            })}
          </div>

        </div>
      </section>

      {/* ════════════════════════════
          FEATURES — asymmetric premium grid
      ════════════════════════════ */}
      <section className="py-32 lg:py-44 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Large section header */}
          <Reveal className="mb-20">
            <motion.div variants={fadeUp} className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <span className="section-label text-saffron">What We Offer</span>
                <h2 className="text-5xl md:text-6xl lg:text-7xl font-black text-navy leading-[1.0] tracking-[-0.04em]">
                  {t('landing.features.headline')}
                </h2>
              </div>
              <p className="text-gray-500 text-base leading-relaxed max-w-sm lg:text-right lg:mb-2">
                {t('landing.features.subheadline')}
              </p>
            </motion.div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.slice(0, 3).map(f => <FeatureCard key={f.index} {...f} />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 lg:max-w-[66.66%] lg:mx-auto">
            {features.slice(3).map(f => <FeatureCard key={f.index} {...f} />)}
          </div>

        </div>
      </section>

      {/* ════════════════════════════
          LAWYER PRO BLOCK
          Feature Galaxy → AI Command Center → Product Showcase → Ecosystem Map
      ════════════════════════════ */}
      <FeatureGalaxy />
      <CommandCenter />
      <ProductShowcase />
      <EcosystemMap />

      {/* ════════════════════════════
          WHY CHOOSE US — Apple-style assembly animation
      ════════════════════════════ */}
      <section className="py-32 lg:py-44 bg-[#FAFAF9] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Manifesto-style header */}
          <Reveal className="mb-20">
            <span className="section-label text-saffron block">Why Us</span>
            <div className="flex flex-col lg:flex-row lg:items-end gap-6">
              <MultiLineHeadline
                className="text-5xl md:text-6xl lg:text-7xl font-black text-navy leading-[1.0] tracking-[-0.04em]"
                lines={[
                  <span key="l1">Your Legal</span>,
                  <span key="l2" className="bg-gradient-to-r from-saffron to-orange-400 bg-clip-text text-transparent">Growth Partner</span>,
                ]}
              />
              <motion.p variants={fadeUp} className="text-gray-400 text-base max-w-xs lg:mb-3 leading-relaxed">
                AI-powered legal assistance helping thousands daily
              </motion.p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {whyUs.map((item, i) => (
              <Reveal key={i}>
                <motion.div
                  custom={i}
                  variants={assemble}
                  whileHover={{ y: -10, scale: 1.03, boxShadow: '0 32px 64px -16px rgba(255,138,0,0.2)' }}
                  className="group bg-white rounded-3xl p-9 border border-gray-100/70 shadow-[0_2px_24px_rgba(0,0,0,0.05)] hover:border-saffron/25 transition-colors duration-500 relative overflow-hidden"
                >
                  {/* Background number watermark */}
                  <div className="absolute bottom-4 right-4 text-[90px] font-black text-gray-50 leading-none select-none pointer-events-none">
                    {String(i + 1).padStart(2, '0')}
                  </div>

                  <motion.div
                    whileHover={{ rotate: 8, scale: 1.08 }}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-7 transition-colors duration-500 text-2xl border relative z-10 ${item.color} border-current/10`}
                  >
                    {item.icon}
                  </motion.div>
                  <h3 className="font-bold text-navy text-[17px] mb-3 tracking-tight leading-snug relative z-10">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-[1.8] relative z-10">{item.body}</p>

                  {/* Hover corner glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(255,138,0,0.12) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

                  {/* Animated border glow on hover */}
                  <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-saffron/0 group-hover:ring-saffron/30 transition-all duration-500 pointer-events-none" />
                </motion.div>
              </Reveal>
            ))}
          </div>

        </div>
      </section>

      {/* ════════════════════════════
          CASE MANAGEMENT PANEL — rich SaaS module preview
      ════════════════════════════ */}
      <section className="relative py-32 lg:py-44 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Reveal className="mb-16 max-w-2xl">
            <span className="section-label text-saffron block">Inside the Workspace</span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-navy leading-[1.05] tracking-[-0.04em] mb-5">
              Your entire practice,<br /><span className="bg-gradient-to-r from-saffron to-orange-400 bg-clip-text text-transparent">at a glance.</span>
            </h2>
            <p className="text-gray-500 text-lg leading-relaxed max-w-lg">
              Cases, clients, hearings, evidence, AI tasks and risk alerts — surfaced the moment you log in.
            </p>
          </Reveal>

          <Reveal>
            <motion.div
              whileHover={{ y: -4 }}
              className="bg-white rounded-[32px] border border-gray-100 shadow-[0_40px_100px_-24px_rgba(7,18,43,0.18)] overflow-hidden"
            >
              {/* Top bar */}
              <div className="flex items-center justify-between px-7 py-4 border-b border-gray-100 bg-[#FAFAF9]">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-navy text-white flex items-center justify-center font-black text-sm">PL</span>
                  <span className="font-bold text-navy text-sm">Case Workspace</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-gray-300" />
                  <span className="w-7 h-7 rounded-full bg-saffron/15 text-saffron flex items-center justify-center text-[10px] font-bold">AS</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-gray-100">
                {/* Cases */}
                <div className="bg-white p-6">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Cases</span>
                    <FolderKanban className="w-3.5 h-3.5 text-gray-300" />
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { name: 'Sharma vs State', status: 'Active', color: 'bg-blue-50 text-blue-600' },
                      { name: 'Verma Property Dispute', status: 'Pending', color: 'bg-amber-50 text-amber-600' },
                      { name: 'Gupta Bail Application', status: 'Won', color: 'bg-emerald-50 text-emerald-600' },
                    ].map((c, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-center justify-between bg-[#FAFAF9] rounded-xl px-3.5 py-2.5"
                      >
                        <span className="text-[12.5px] font-semibold text-navy">{c.name}</span>
                        <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${c.color}`}>{c.status}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Clients & Hearings */}
                <div className="bg-white p-6">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Clients & Hearings</span>
                    <Calendar className="w-3.5 h-3.5 text-gray-300" />
                  </div>
                  <div className="space-y-2.5 mb-5">
                    {['Rohit Mehta', 'Priya Nair', 'Ashok Bansal'].map((name, i) => (
                      <div key={i} className="flex items-center gap-2.5 bg-[#FAFAF9] rounded-xl px-3.5 py-2.5">
                        <span className="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center text-[9px] font-bold text-navy">{name.charAt(0)}</span>
                        <span className="text-[12.5px] font-semibold text-navy">{name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-saffron/5 border border-saffron/15 rounded-xl px-3.5 py-3 flex items-center gap-2.5">
                    <Clock3 className="w-3.5 h-3.5 text-saffron shrink-0" />
                    <span className="text-[12px] font-semibold text-navy">Next hearing in 2 days</span>
                  </div>
                </div>

                {/* AI tasks & risk alerts */}
                <div className="bg-white p-6">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">AI Tasks & Alerts</span>
                    <Sparkles className="w-3.5 h-3.5 text-gray-300" />
                  </div>
                  <div className="space-y-2.5 mb-4">
                    {['Draft reminder notice', 'Summarize evidence bundle'].map((task, i) => (
                      <div key={i} className="flex items-center gap-2.5 bg-[#FAFAF9] rounded-xl px-3.5 py-2.5">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-[12.5px] font-semibold text-navy">{task}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-3 flex items-center gap-2.5">
                    <AlertOctagon className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="text-[12px] font-semibold text-red-600">Filing deadline approaching</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════
          STATS ROW — giant typographic treatment
      ════════════════════════════ */}
      <section className="relative py-28 lg:py-36 bg-navy overflow-hidden">
        {/* Giant faded text watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <motion.span
            animate={{ opacity: [0.02, 0.04, 0.02] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="text-[18vw] font-black text-white tracking-[-0.06em] whitespace-nowrap select-none leading-none"
          >
            JUSTICE
          </motion.span>
        </div>

        <GlowOrb className="top-[-20%] right-[-10%]" color="rgba(255,138,0,0.22)" size={500} duration={9} />
        <NoiseOverlay opacity={0.025} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 lg:gap-20 text-center">
            {[
              { val: total, suf: '+', label: 'Legal Tasks Completed' },
              { val: 24, suf: '/7', label: 'AI Availability' },
              { val: 25, suf: '+', label: 'Emergency Helplines' },
              { val: 3, suf: ' Min', label: 'Avg. Police complaint Draft Time' },
            ].map((s, i) => (
              <Reveal key={i}>
                <motion.div custom={i} variants={fadeUp} whileHover={{ scale: 1.06 }} className="relative cursor-default">
                  <p className="text-5xl md:text-6xl xl:text-7xl font-black text-saffron mb-3 tracking-tight leading-none drop-shadow-[0_0_24px_rgba(255,138,0,0.35)]">
                    <AnimatedNumber target={s.val} suffix={s.suf} />
                  </p>
                  <div className="w-8 h-0.5 bg-saffron/40 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm font-medium tracking-wide">{s.label}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════
          EMERGENCY HELPLINES
      ════════════════════════════ */}
      <section className="py-32 lg:py-40 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <Reveal className="mb-16">
            <motion.div variants={fadeUp} className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <span className="section-label text-red-500">Emergency Support</span>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-navy leading-[1.0] tracking-[-0.04em]">
                  {t('landing.emergency.headline')}
                </h2>
                <h3 className="text-xl font-bold text-saffron mt-3 tracking-tight">अपने अधिकार और आपातकालीन सहायता</h3>
              </div>
              <p className="text-gray-500 max-w-xs text-sm leading-relaxed lg:text-right lg:mb-2">
                {t('landing.emergency.subheadline')}
              </p>
            </motion.div>
          </Reveal>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {helplines.map((h, i) => <HelplineCard key={i} index={i} {...h} />)}
          </div>

        </div>
      </section>

      {/* ════════════════════════════
          TESTIMONIALS — cinematic dual marquee (heading trimmed)
      ════════════════════════════ */}
      <section className="relative py-28 lg:py-36 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0A0F1E 0%, #1a1000 50%, #0a0a0a 100%)' }}>

        {/* Ambient glows */}
        <GlowOrb className="top-[-15%] left-[-10%]" color="rgba(255,138,0,0.18)" size={600} duration={10} />
        <GlowOrb className="bottom-[-15%] right-[-10%]" color="rgba(255,138,0,0.14)" size={500} duration={14} delay={4} />

        <NoiseOverlay opacity={0.04} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 mb-14 text-center">
          <Reveal>
            <motion.div variants={fadeUp}>
              <span className="section-label text-saffron/70">What Clients Say</span>
            </motion.div>
          </Reveal>
        </div>

        {/* Dual marquee rows */}
        <div className="relative z-10 space-y-5">
          <Marquee duration={44} gap="gap-5">
            {[...testimonials, ...testimonials].map((tItem, i) => (
              <motion.div
                key={`row1-${i}`}
                whileHover={{ y: -10, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                className="bg-white/95 backdrop-blur-xl rounded-2xl p-5 w-[300px] shrink-0 shadow-2xl shadow-black/30 border border-white/40 hover:shadow-[0_30px_60px_rgba(0,0,0,0.45)] transition-shadow duration-500"
              >
                <img src={tItem.image} className="w-full h-36 object-cover rounded-xl mb-4"
                  style={{ objectPosition: 'center 25%' }} alt={tItem.name} />
                <p className="font-bold text-navy text-sm">{tItem.name}</p>
                <p className="text-[11px] text-gray-400 mb-2.5 font-medium uppercase tracking-wider">{tItem.role}</p>
                <div className="mb-2.5 text-xs flex gap-0.5" aria-label={`${tItem.rating} out of 5 stars`}>
                  {Array.from({ length: tItem.rating }).map((_, s) => (
                    <motion.span
                      key={s}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: s * 0.06 }}
                    >⭐</motion.span>
                  ))}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{tItem.review}</p>
              </motion.div>
            ))}
          </Marquee>

          <Marquee duration={52} gap="gap-5" reverse>
            {[...testimonials].reverse().concat([...testimonials].reverse()).map((tItem, i) => (
              <motion.div
                key={`row2-${i}`}
                whileHover={{ y: -10, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                className="bg-white/95 backdrop-blur-xl rounded-2xl p-5 w-[300px] shrink-0 shadow-2xl shadow-black/30 border border-white/40 hover:shadow-[0_30px_60px_rgba(0,0,0,0.45)] transition-shadow duration-500"
              >
                <img src={tItem.image} className="w-full h-36 object-cover rounded-xl mb-4"
                  style={{ objectPosition: 'center 25%' }} alt={tItem.name} />
                <p className="font-bold text-navy text-sm">{tItem.name}</p>
                <p className="text-[11px] text-gray-400 mb-2.5 font-medium uppercase tracking-wider">{tItem.role}</p>
                <div className="mb-2.5 text-xs flex gap-0.5" aria-label={`${tItem.rating} out of 5 stars`}>
                  {Array.from({ length: tItem.rating }).map((_, s) => <span key={s}>⭐</span>)}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{tItem.review}</p>
              </motion.div>
            ))}
          </Marquee>
        </div>
      </section>

      {/* ════════════════════════════
          FINAL CTA — viewport-filling manifesto
      ════════════════════════════ */}
      <section className="relative min-h-[80vh] flex items-center py-32 bg-navy overflow-hidden">

        {/* Layered atmospheric glows */}
        <GlowOrb className="-top-32 -right-32" color="rgba(255,138,0,0.18)" size={700} duration={9} />
        <GlowOrb className="-bottom-32 -left-32" color="rgba(22,101,52,0.2)" size={600} duration={13} delay={2} />

        {/* Giant watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <span className="text-[20vw] font-black text-white/[0.025] tracking-[-0.06em] whitespace-nowrap select-none leading-none">
            FREE
          </span>
        </div>

        <GridOverlay className="text-white" size={48} />
        <NoiseOverlay opacity={0.025} />
        <ParticleField count={14} color="bg-white/20" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center w-full">
          <Reveal>
            <motion.div variants={fadeUp} custom={0}>
              <span className="section-label text-saffron/60 mb-8 inline-block">Get Started Today</span>
            </motion.div>

            {/* Giant manifesto headline */}
            <WordReveal
              text={t('landing.cta.headline')}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5.5rem] font-black text-white mb-8 leading-[1.0] tracking-[-0.04em] justify-center"
              highlightWords={['Free', 'Justice', 'Legal']}
            />

            <motion.p
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={1}
              className="text-gray-400 mb-14 leading-[1.8] max-w-xl mx-auto text-lg"
            >
              {t('landing.cta.subheadline')}
            </motion.p>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={2}
              className="flex flex-col sm:flex-row gap-5 justify-center items-center"
            >
              <Magnetic strength={12}>
                <Link to="/generate"
                  className="group relative inline-flex items-center justify-center gap-2.5 bg-saffron text-white px-12 py-5 rounded-2xl text-lg font-bold hover:bg-orange-600 transition-all duration-400 shadow-2xl shadow-saffron/30 hover:shadow-saffron/50 hover:shadow-[0_24px_64px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy overflow-hidden"
                >
                  {t('landing.cta.button')}
                  <motion.span animate={{ x: [0, 6, 0] }} transition={{ duration: 1.3, repeat: Infinity }}>
                    <ArrowRight className="h-5 w-5" />
                  </motion.span>
                  {/* Shimmer */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </Link>
              </Magnetic>

              <Magnetic strength={12}>
                <Link to="/guidance"
                  className="inline-flex items-center justify-center gap-2.5 bg-white/8 backdrop-blur-xl text-white border border-white/15 px-10 py-5 rounded-2xl text-lg font-semibold hover:bg-white/15 hover:border-white/30 transition-all duration-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
                >
                  Explore Legal Guidance
                </Link>
              </Magnetic>
            </motion.div>

          </Reveal>
        </div>

      </section>

    </div>
  );
};