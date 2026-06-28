import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useInView, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowRight, Code, Users, BookOpen, Sparkles, Github, Linkedin, Twitter, ExternalLink, ChevronRight, Star, Zap, Shield, Eye, Target, Heart } from "lucide-react";

/* ── Font Injection ── */
const FontImport: React.FC = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&display=swap');
    
    :root {
      --ink: #0A0A0A;
      --ink-2: #1A1A1A;
      --ink-muted: #6B6B6B;
      --ink-faint: #A0A0A0;
      --surface: #FFFFFF;
      --surface-2: #F7F7F7;
      --surface-3: #F0F0F0;
      --accent: #FF6B00;
      --accent-warm: #FF9933;
      --accent-glow: rgba(255,107,0,0.15);
      --border: rgba(0,0,0,0.08);
      --border-strong: rgba(0,0,0,0.15);
    }
    html { scroll-behavior: smooth; }
    body { font-family: 'Inter', sans-serif; background: #FFFFFF; color: #0A0A0A; overflow-x: hidden; }
    ::selection { background: rgba(255,107,0,0.2); }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
  `}</style>
);

/* ── Typewriter ── */
const Typewriter: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay * 1000);
    return () => clearTimeout(t);
  }, [delay]);
  useEffect(() => {
    if (!started) return;
    let i = 0;
    const iv = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(iv);
    }, 38);
    return () => clearInterval(iv);
  }, [started, text]);
  return (
    <span>
      {displayed}
      {displayed.length < text.length && started && (
        <span className="inline-block w-[3px] h-[0.85em] bg-[#FF6B00] ml-1 align-middle animate-pulse" />
      )}
    </span>
  );
};

/* ── Animated Counter ── */
const Counter: React.FC<{ target: number; suffix?: string; prefix?: string }> = ({ target, suffix = "", prefix = "" }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 2000;
    const step = target / (duration / 16);
    const iv = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(iv); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(iv);
  }, [inView, target]);
  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
};

/* ── Reveal ── */
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string; direction?: "up" | "left" | "right" | "none" }> = ({ children, delay = 0, className = "", direction = "up" }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const initial = direction === "up" ? { opacity: 0, y: 48 } : direction === "left" ? { opacity: 0, x: -48 } : direction === "right" ? { opacity: 0, x: 48 } : { opacity: 0 };
  return (
    <motion.div ref={ref} className={className} initial={initial} animate={inView ? { opacity: 1, y: 0, x: 0 } : initial} transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
};

/* ── Float ── */
const Float: React.FC<{ children: React.ReactNode; amplitude?: number; duration?: number }> = ({ children, amplitude = 12, duration = 4 }) => (
  <motion.div animate={{ y: [0, -amplitude, 0] }} transition={{ duration, repeat: Infinity, ease: "easeInOut" }}>
    {children}
  </motion.div>
);

/* ── Section Label ── */
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="inline-flex items-center gap-2 mb-8">
    <div className="w-6 h-px bg-[#FF6B00]" />
    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", color: "#FF6B00", textTransform: "uppercase" }}>
      {children}
    </span>
  </div>
);

/* ══════════════════════════════════════════════
   1. CINEMATIC HERO
══════════════════════════════════════════════ */
const CinematicHero: React.FC = () => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, 200]);
  const opacity = useTransform(scrollY, [0, 400], [1, 0]);

  return (
    <section
  className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
  style={{ background: "#000000" }}
>
      {/* Subtle grid */}
  


      <motion.div style={{ opacity }} className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        {/* Eyebrow */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 mb-10 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
          <Sparkles className="w-3 h-3 text-[#FF6B00]" />
          <span style={{ fontFamily: "'Inter'", fontSize: "11px", fontWeight: 600, letterSpacing: "0.14em", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>
            About Us
          </span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.3 }}
          style={{ fontFamily: "'Inter', sans-serif",
    fontSize: "clamp(2.5rem, 8vw, 6rem)",
 lineHeight: 1.0, color: "#FFFFFF", fontWeight: 400, letterSpacing: "-0.02em" }}
        >
          <Typewriter text="We are the people" delay={0.5} />
          <br />
          <span style={{ fontStyle: "italic", color: "#FF6B00" }}>
            <Typewriter text="behind the mission." delay={1.8} />
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 3.5 }}
          style={{ fontFamily: "'Inter'", fontSize: "clamp(1rem, 2vw, 1.25rem)", color: "rgba(255,255,255,0.45)", fontWeight: 300, maxWidth: "560px", margin: "2rem auto 0", lineHeight: 1.7 }}
        >
          A team of builders, researchers, and creators working at the intersection of law, technology, and human potential.
        </motion.p>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 4 }}
          className="flex flex-col items-center gap-2 mt-16"
        >
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>Scroll</span>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <ArrowDown className="w-4 h-4 text-[#FF6B00]" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Bottom fade */}
    
    </section>
  );
};

/* ══════════════════════════════════════════════
   2. OUR STORY
══════════════════════════════════════════════ */
const OurStory: React.FC = () => (
  <section className="py-32 px-6 bg-white overflow-hidden">
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
        {/* Left column */}
        <div className="lg:col-span-5">
          <Reveal>
            <SectionLabel>Our Story</SectionLabel>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(2.5rem, 5vw, 4.5rem)", lineHeight: 1.05, color: "#0A0A0A", fontWeight: 400, letterSpacing: "-0.02em" }}>
              Started with a<br /><span style={{ fontStyle: "italic", color: "#FF6B00" }}>single question.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-8 w-12 h-px bg-[#FF6B00]" />
          </Reveal>
        </div>

        {/* Right column - story text */}
        <div className="lg:col-span-7 space-y-8">
          {[
            { year: "2023", text: "We started asking a simple question: why is legal intelligence still locked behind expensive walls? We believed technology could democratize access to legal knowledge and make compliance less daunting." },
            { year: "2024", text: "We assembled a team unlike any other — technologists working alongside legal researchers, designers thinking alongside policy experts. Cross-disciplinary by design, collaborative by nature." },
            { year: "Today", text: "We're building tools that matter. Products that help people navigate complexity, understand their rights, and operate with confidence. The mission is the same. The scale keeps growing." },
          ].map((item, i) => (
            <Reveal key={i} delay={i * 0.15} direction="right">
              <div className="flex gap-8 group">
                <div className="flex-shrink-0 w-16">
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#FF6B00", letterSpacing: "0.08em" }}>{item.year}</span>
                </div>
                <div className="border-t border-[rgba(0,0,0,0.08)] pt-6 flex-1">
                  <p style={{ fontSize: "1.0625rem", lineHeight: 1.8, color: "#4A4A4A", fontWeight: 400 }}>{item.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Large pull quote */}
      <Reveal delay={0.4} className="mt-28">
        <div className="border-l-2 border-[#FF6B00] pl-8 py-4 max-w-3xl">
          <blockquote style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(1.5rem, 3vw, 2.25rem)", lineHeight: 1.4, color: "#0A0A0A", fontWeight: 400, fontStyle: "italic" }}>
            "The intersection of law and technology isn't a niche — it's where the future of every business and every person lives."
          </blockquote>
          <p className="mt-4" style={{ fontSize: "0.875rem", color: "#6B6B6B", fontWeight: 500 }}>— Founding Team</p>
        </div>
      </Reveal>
    </div>
  </section>
);

/* ══════════════════════════════════════════════
   3. TEAM TIMELINE
══════════════════════════════════════════════ */
interface TeamMember {
  name: string;
  role: string;
  description: string;
  image: string;
  team: string;
  bio?: string;
  social?: { github?: string; linkedin?: string; twitter?: string };
}

const techTeam: TeamMember[] = [
  {
    name: "Aditya",
    role: "Full Stack Developer",
    description: "Building core AI systems",
    bio: "Architects the intelligence layer that powers everything users see and feel. Obsessed with performance, reliability, and elegant solutions to hard problems.",
    image: "https://i.pravatar.cc/500?img=11",
    team: "Tech",
    social: { github: "#", linkedin: "#" },
  },
  {
    name: "Harsh",
    role: "Backend Engineer",
    description: "Handles APIs & logic",
    bio: "The foundation everything else is built on. Designs systems that are fast, secure, and built to scale without breaking a sweat.",
    image: "https://i.pravatar.cc/500?img=12",
    team: "Tech",
    social: { github: "#", linkedin: "#" },
  },
];

const socialTeam: TeamMember[] = [
  {
    name: "Aditya Pandey",
    role: "Marketing Lead",
    description: "Growth & ads strategy",
    bio: "Turns complex legal-tech concepts into compelling narratives. Believes the right story, told right, can change everything.",
    image: "/team/adityapandey.png",
    team: "Marketing",
    social: { linkedin: "#", twitter: "#" },
  },
  {
    name: "Sneha Sharma",
    role: "Content Strategist",
    description: "Creates content that connects",
    bio: "Words are her architecture. She builds content systems that inform, educate, and resonate with people who need real answers.",
    image: "/team/sneha.png",
    team: "Marketing",
    social: { linkedin: "#", twitter: "#" },
  },
  {
    name: "Anupurna Srivastava",
    role: "Brand Designer",
    description: "Brand visuals & identity",
    bio: "Every pixel is intentional. She gives the brand its visual voice — one that speaks quietly but is impossible to ignore.",
    image: "/team/anupurna.png",
    team: "Marketing",
    social: { linkedin: "#" },
  },
  {
    name: "Pranav Sagar",
    role: "UI/UX Designer",
    description: "Crafting experiences",
    bio: "Bridges the gap between how things work and how things feel. The best design, he believes, is the kind people never have to think about.",
    image: "/team/pranav.png",
    team: "Marketing",
    social: { linkedin: "#" },
  },
  {
    name: "Divyanshu Pandey",
    role: "Content Creator",
    description: "Video & digital content",
    bio: "Translates dense expertise into content people actually want to watch and read. Makes the complicated feel approachable.",
    image: "/team/divyanshu.png",
    team: "Marketing",
    social: { linkedin: "#", twitter: "#" },
  },
];

const researchTeam: TeamMember[] = [
  {
    name: "Ramendra Mani Tripathi",
    role: "Strategy & Advisory",
    description: "Workflow & case study",
    bio: "The strategic compass of the research team. Brings decades of pattern recognition to every decision, keeping the team focused on what matters.",
    image: "/team/ramendra.png",
    team: "Research",
    social: { linkedin: "#" },
  },
  {
    name: "Nazia Tahseen",
    role: "Legal Research Analyst",
    description: "Legal insights & analysis",
    bio: "Digs into the law so others don't have to. Her research is the bedrock of every accurate, defensible recommendation the team makes.",
    image: "/team/naziya.png",
    team: "Research",
    social: { linkedin: "#" },
  },
  {
    name: "Mayank Dwivedi",
    role: "Technical Writer",
    description: "Documentation & writing",
    bio: "Takes highly technical material and makes it legible for everyone. Good writing, he says, is good thinking made visible.",
    image: "/team/mayank.png",
    team: "Research",
    social: { linkedin: "#" },
  },
  {
    name: "Snigdha Singh",
    role: "Policy Researcher",
    description: "Law & policy research",
    bio: "Maps the regulatory landscape so the team always knows where they stand. Turns policy complexity into actionable clarity.",
    image: "/team/snigdha.png",
    team: "Research",
    social: { linkedin: "#" },
  },
  {
    name: "Abhibhav Singh",
    role: "Legal Drafter",
    description: "Legal drafting & review",
    bio: "Every word in a legal document carries weight. He chooses each one carefully, ensuring nothing is left to misinterpretation.",
    image: "/team/abhibhav.png",
    team: "Research",
    social: { linkedin: "#" },
  },
  {
    name: "Raj Roshan Bharti",
    role: "Documentation Lead",
    description: "Documentation & records",
    bio: "The institutional memory of the team. Builds the knowledge systems that let the whole organization move faster and with confidence.",
    image: "/team/raj.png",
    team: "Research",
    social: { linkedin: "#" },
  },
];

const MemberCard: React.FC<{ member: TeamMember; index: number; flipped: boolean }> = ({ member, index, flipped }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const initImg = flipped ? { opacity: 0, x: 80 } : { opacity: 0, x: -80 };
  const initText = flipped ? { opacity: 0, x: -80 } : { opacity: 0, x: 80 };
  const anim = { opacity: 1, x: 0 };
  const trans = { duration: 0.8, ease: [0.22, 1, 0.36, 1] };

  return (
    <div ref={ref} className={`flex flex-col ${flipped ? "lg:flex-row-reverse" : "lg:flex-row"} gap-12 lg:gap-20 items-center py-20 border-b border-[rgba(0,0,0,0.06)]`}>
      {/* Image */}
      <motion.div
        initial={initImg} animate={inView ? anim : initImg} transition={{
  duration: 0.8,
  delay: 0.1,
  ease: "easeOut"
}}
        className="w-full lg:w-5/12 flex-shrink-0"
      >
        
        <Float amplitude={10} duration={5 + (index % 3)}>
  <div className="relative w-fit mx-auto">

    <div className="relative overflow-visible bg-transparent">

      <img
        src={member.image}
        alt={member.name}
        className="w-full h-auto object-contain"
      />

      <div
        className="absolute bottom-4 left-4 px-3 py-1 rounded-full"
        style={{ background: "rgba(255,107,0,0.85)" }}
      >
        <span>{member.team}</span>
      </div>

    </div>

  </div>
</Float>
      </motion.div>

      {/* Content */}
      <motion.div
        initial={initText} animate={inView ? anim : initText} transition={{
  duration: 0.8,
  delay: 0.25,
  ease: "easeOut"
}}
        className="w-full lg:w-7/12"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-px bg-[#FF6B00]" />
          <span style={{ fontSize: "11px", fontWeight: 600, color: "#FF6B00", letterSpacing: "0.12em", textTransform: "uppercase" }}>{member.role}</span>
        </div>

        <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1.05, color: "#0A0A0A", fontWeight: 400, letterSpacing: "-0.02em" }}>
          {member.name}
        </h3>

        <p className="mt-4" style={{ fontSize: "1.0625rem", lineHeight: 1.85, color: "#5A5A5A", fontWeight: 400, maxWidth: "460px" }}>
          {member.bio || member.description}
        </p>

        {/* Social */}
        {member.social && (
          <div className="flex gap-4 mt-8">
            {member.social.github && (
              <a href={member.social.github} className="flex items-center justify-center w-10 h-10 rounded-full border border-[rgba(0,0,0,0.1)] hover:border-[#FF6B00] hover:text-[#FF6B00] transition-all duration-200 text-[#6B6B6B]">
                <Github className="w-4 h-4" />
              </a>
            )}
            {member.social.linkedin && (
              <a href={member.social.linkedin} className="flex items-center justify-center w-10 h-10 rounded-full border border-[rgba(0,0,0,0.1)] hover:border-[#FF6B00] hover:text-[#FF6B00] transition-all duration-200 text-[#6B6B6B]">
                <Linkedin className="w-4 h-4" />
              </a>
            )}
            {member.social.twitter && (
              <a href={member.social.twitter} className="flex items-center justify-center w-10 h-10 rounded-full border border-[rgba(0,0,0,0.1)] hover:border-[#FF6B00] hover:text-[#FF6B00] transition-all duration-200 text-[#6B6B6B]">
                <Twitter className="w-4 h-4" />
              </a>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

const TeamTimeline: React.FC = () => {
  const allTeams = [
    { label: "Tech Team", icon: Code, members: techTeam },
    { label: "Research Team", icon: BookOpen, members: researchTeam },
    { label: "Marketing Team", icon: Users, members: socialTeam },
  ];

  let globalIndex = 0;

  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <Reveal className="mb-6">
          <SectionLabel>The Team</SectionLabel>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(2.5rem, 5vw, 4.5rem)", lineHeight: 1.05, color: "#0A0A0A", fontWeight: 400, letterSpacing: "-0.02em" }}>
            Every person,<br /><span style={{ fontStyle: "italic", color: "#FF6B00" }}>a chapter.</span>
          </h2>
        </Reveal>

        {allTeams.map(({ label, icon: Icon, members }) => (
          <div key={label} className="mt-24">
            <Reveal>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[rgba(255,107,0,0.08)]">
                  <Icon className="w-5 h-5 text-[#FF6B00]" />
                </div>
                <h3 style={{ fontFamily: "'Inter'", fontSize: "1rem", fontWeight: 600, color: "#0A0A0A", letterSpacing: "0.02em" }}>{label}</h3>
              </div>
            </Reveal>
            {members.map((member) => {
              const flipped = globalIndex % 2 !== 0;
              const card = <MemberCard key={member.name + label} member={member} index={globalIndex} flipped={flipped} />;
              globalIndex++;
              return card;
            })}
          </div>
        ))}
      </div>
    </section>
  );
};

/* ══════════════════════════════════════════════
   4. VALUES
══════════════════════════════════════════════ */
const values = [
  { icon: Zap, title: "Innovation", desc: "We don't iterate on the obvious. We question assumptions, rebuild from first principles, and ship things that weren't supposed to exist yet." },
  { icon: Shield, title: "Trust", desc: "In a space built on legal sensitivity, trust isn't a feature — it's the product. Every decision is made with that weight in mind." },
  { icon: Eye, title: "Transparency", desc: "No black boxes. We show our reasoning, explain our methods, and believe that understanding creates confidence." },
  { icon: Star, title: "Excellence", desc: "Good enough is a ceiling we never accept. The standard is set by the work, not by what's easy or expected." },
  { icon: Target, title: "Simplicity", desc: "Complexity is easy. Clarity is hard. We do the hard work so our users never have to." },
];

const ValuesSection: React.FC = () => (
  <section className="py-32 px-6 bg-[#0A0A0A] overflow-hidden">
    <div className="max-w-6xl mx-auto">
      <Reveal>
        <SectionLabel>What We Stand For</SectionLabel>
      </Reveal>
      <Reveal delay={0.1}>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(2.5rem, 5vw, 4.5rem)", lineHeight: 1.05, color: "#FFFFFF", fontWeight: 400, letterSpacing: "-0.02em", marginBottom: "64px" }}>
          Five things we<br /><span style={{ fontStyle: "italic", color: "#FF6B00" }}>never compromise.</span>
        </h2>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[rgba(255,255,255,0.06)]">
        {values.map((v, i) => (
          <Reveal key={v.title} delay={i * 0.08}>
            <motion.div
              className="group relative p-8 bg-[#0A0A0A] cursor-default overflow-hidden"
              whileHover={{ backgroundColor: "#111111" }}
              transition={{ duration: 0.2 }}
            >
              {/* Hover glow */}
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,107,0,0.08) 0%, transparent 70%)" }}
              />

              <div className="relative z-10">
                <div className="mb-6 flex items-center justify-center w-12 h-12 rounded-xl" style={{ background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.15)" }}>
                  <v.icon className="w-5 h-5 text-[#FF6B00]" />
                </div>
                <h3 style={{ fontFamily: "'Inter'", fontSize: "1.125rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "12px", letterSpacing: "-0.01em" }}>{v.title}</h3>
                <p style={{ fontSize: "0.9375rem", lineHeight: 1.75, color: "rgba(255,255,255,0.45)", fontWeight: 400 }}>{v.desc}</p>
              </div>

              <div className="absolute bottom-0 left-0 w-full h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "linear-gradient(90deg, transparent, rgba(255,107,0,0.4), transparent)" }} />
            </motion.div>
          </Reveal>
        ))}

        {/* Spacer cell for 5 items in 3-col grid */}
        <div className="hidden lg:block bg-[#0A0A0A]" />
      </div>
    </div>
  </section>
);

/* ══════════════════════════════════════════════
   5. STATS
══════════════════════════════════════════════ */
const stats = [
  { value: 50, suffix: "+", label: "Projects Delivered" },
  { value: 30, suffix: "+", label: "Clients Served" },
  { value: 10, suffix: "K+", label: "Users Reached" },
  { value: 300, suffix: "%", label: "Year-on-Year Growth" },
  { value: 2, suffix: "+", label: "Years of Focus" },
];

const StatsSection: React.FC = () => (
  <section className="py-28 px-6 bg-white border-y border-[rgba(0,0,0,0.06)]">
    <div className="max-w-6xl mx-auto">
      <Reveal className="text-center mb-20">
        <SectionLabel>By The Numbers</SectionLabel>
        <h2 style={{ fontFamily: "'Inter', sans-serif",
    fontSize: "clamp(2.5rem, 8vw, 6rem)",
 lineHeight: 1.1, color: "#0A0A0A", fontWeight: 400, letterSpacing: "-0.02em" }}>
          Progress that<br /><span style={{ fontStyle: "italic", color: "#FF6B00" }}>speaks for itself.</span>
        </h2>
      </Reveal>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-[rgba(0,0,0,0.06)]">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08}>
            <div className="bg-white p-8 text-center">
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(2.5rem, 4vw, 3.75rem)", color: "#0A0A0A", fontWeight: 400, lineHeight: 1, letterSpacing: "-0.03em" }}>
                <Counter target={s.value} suffix={s.suffix} />
              </div>
              <p className="mt-3" style={{ fontSize: "0.8125rem", color: "#6B6B6B", fontWeight: 500, letterSpacing: "0.04em" }}>{s.label}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

/* ══════════════════════════════════════════════
   6. JOURNEY TIMELINE
══════════════════════════════════════════════ */
const milestones = [
  { year: "Q1 2023", title: "The Idea", desc: "Two people, one whiteboard, a question that wouldn't go away: what if legal intelligence was accessible to everyone?" },
  { year: "Q3 2023", title: "First Build", desc: "The first prototype. Ugly, slow, but proof that the idea could work. Shared with 10 people. Eight of them asked when they could use it for real." },
  { year: "Q1 2024", title: "Team Assembles", desc: "Brought together researchers, engineers, and designers who believed in the same thing. The org chart grew fast; the culture stayed tight." },
  { year: "Q3 2024", title: "First Clients", desc: "Real users. Real feedback. Real stakes. The product grew sharper with every conversation, every edge case, every honest critique." },
  { year: "Q1 2025", title: "Scale Mode", desc: "Moved from proving the concept to scaling the system. Infrastructure, processes, and team depth — all built for what's coming next." },
  { year: "Now", title: "Still Building", desc: "The mission hasn't changed. The tools keep getting better. The team keeps getting stronger. We're still just getting started." },
];

const JourneyTimeline: React.FC = () => (
  <section className="py-32 px-6 bg-[#F7F7F7]">
    <div className="max-w-4xl mx-auto">
      <Reveal>
        <SectionLabel>Our Journey</SectionLabel>
      </Reveal>
      <Reveal delay={0.1}>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(2.5rem, 5vw, 4.5rem)", lineHeight: 1.05, color: "#0A0A0A", fontWeight: 400, letterSpacing: "-0.02em", marginBottom: "64px" }}>
          How we got<br /><span style={{ fontStyle: "italic", color: "#FF6B00" }}>to here.</span>
        </h2>
      </Reveal>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-[rgba(0,0,0,0.08)]" />

        <div className="space-y-0">
          {milestones.map((m, i) => {
            const ref = useRef(null);
            const inView = useInView(ref, { once: true, margin: "-60px" });
            return (
              <motion.div
                key={m.year}
                ref={ref}
                initial={{ opacity: 0, x: -30 }}
                animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
                transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="relative pl-12 pb-16"
              >
                {/* Node */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={inView ? { scale: 1 } : { scale: 0 }}
                  transition={{ duration: 0.4, delay: 0.3, type: "spring" }}
                  className="absolute left-0 top-1 w-8 h-8 flex items-center justify-center"
                >
                  <div className="w-3 h-3 rounded-full bg-[#FF6B00]" style={{ boxShadow: "0 0 0 4px rgba(255,107,0,0.15), 0 0 0 8px rgba(255,107,0,0.06)" }} />
                </motion.div>

                <span style={{ fontSize: "11px", fontWeight: 600, color: "#FF6B00", letterSpacing: "0.1em", textTransform: "uppercase" }}>{m.year}</span>
                <h3 className="mt-2 mb-3" style={{ fontFamily: "'Inter'", fontSize: "1.25rem", fontWeight: 700, color: "#0A0A0A", letterSpacing: "-0.01em" }}>{m.title}</h3>
                <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "#5A5A5A", maxWidth: "480px" }}>{m.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  </section>
);

/* ══════════════════════════════════════════════
   7. CULTURE
══════════════════════════════════════════════ */
const CultureShowcase: React.FC = () => {
  const items = [
    { label: "Remote-first", text: "No mandatory offices. No performative presence. Outcomes over optics." },
    { label: "Async by default", text: "Deep work is sacred. We protect it with process, not policy." },
    { label: "Radical candor", text: "Hard truths, delivered with care. We make each other better." },
    { label: "Curiosity mandate", text: "Every person on the team is expected to keep learning. Always." },
  ];

  return (
    <section className="py-32 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div>
            <Reveal>
              <SectionLabel>How We Work</SectionLabel>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(2.5rem, 5vw, 4rem)", lineHeight: 1.05, color: "#0A0A0A", fontWeight: 400, letterSpacing: "-0.02em" }}>
                Culture isn't<br /><span style={{ fontStyle: "italic", color: "#FF6B00" }}>a slide deck.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6" style={{ fontSize: "1.0625rem", lineHeight: 1.8, color: "#5A5A5A", maxWidth: "420px" }}>
                It's the ten thousand small choices we make every day about how we treat each other and what we prioritize.
              </p>
            </Reveal>
          </div>

          <div className="space-y-0">
            {items.map((item, i) => (
              <Reveal key={item.label} delay={i * 0.1} direction="right">
                <motion.div
                  className="group flex gap-6 py-7 border-b border-[rgba(0,0,0,0.06)] cursor-default"
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex-shrink-0 mt-1">
                    <ChevronRight className="w-4 h-4 text-[#FF6B00] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </div>
                  <div>
                    <h4 style={{ fontFamily: "'Inter'", fontSize: "1rem", fontWeight: 700, color: "#0A0A0A", marginBottom: "6px" }}>{item.label}</h4>
                    <p style={{ fontSize: "0.9375rem", lineHeight: 1.7, color: "#6B6B6B" }}>{item.text}</p>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ══════════════════════════════════════════════
   8. FOUNDER MESSAGE
══════════════════════════════════════════════ */
const FounderMessage: React.FC = () => (
  <section className="py-32 px-6 bg-[#F7F7F7]">
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
        <Reveal direction="left" className="lg:col-span-4">
          <div className="relative">
            <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-[#E8E8E8] max-w-xs">
              <img src="https://i.pravatar.cc/500?img=33" alt="Founder" className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.3), transparent 50%)" }} />
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-2xl bg-[#FF6B00] flex items-center justify-center">
              <Heart className="w-8 h-8 text-white" />
            </div>
          </div>
        </Reveal>

        <div className="lg:col-span-8">
          <Reveal>
            <SectionLabel>A Word From Our Founder</SectionLabel>
          </Reveal>
          <Reveal delay={0.15}>
            <blockquote style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(1.5rem, 3vw, 2.25rem)", lineHeight: 1.45, color: "#0A0A0A", fontWeight: 400, fontStyle: "italic" }}>
              "I started this because I kept seeing brilliant people stopped in their tracks by systems that weren't built for them. Legal complexity. Compliance confusion. Barriers that shouldn't exist. We're here to tear those down — carefully, thoughtfully, permanently."
            </blockquote>
          </Reveal>
          <Reveal delay={0.25}>
            <div className="flex items-center gap-4 mt-10">
              <div className="w-10 h-px bg-[#FF6B00]" />
              <div>
                <p style={{ fontFamily: "'Inter'", fontSize: "0.9375rem", fontWeight: 700, color: "#0A0A0A" }}>The Founding Team</p>
                <p style={{ fontSize: "0.8125rem", color: "#6B6B6B", marginTop: "2px" }}>Builders, not bystanders</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  </section>
);

/* ══════════════════════════════════════════════
   9. WHY WE EXIST
══════════════════════════════════════════════ */
const WhyWeExist: React.FC = () => (
  <section className="py-40 px-6 bg-[#0A0A0A] overflow-hidden relative">
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full" style={{ background: "radial-gradient(circle, rgba(255,107,0,0.06) 0%, transparent 70%)" }} />
    </div>

    <div className="relative z-10 max-w-4xl mx-auto text-center">
      <Reveal>
        <SectionLabel>Why We Exist</SectionLabel>
      </Reveal>
      <Reveal delay={0.15}>
        <h2 style={{ fontFamily: "'Inter', sans-serif",
    fontSize: "clamp(2.5rem, 8vw, 6rem)",
 lineHeight: 1.0, color: "#FFFFFF", fontWeight: 400, letterSpacing: "-0.03em" }}>
          Because the system<br />
          <span style={{ fontStyle: "italic", color: "#FF6B00" }}>wasn't built</span><br />
          for everyone.
        </h2>
      </Reveal>
      <Reveal delay={0.3}>
        <p className="mt-10" style={{ fontSize: "1.125rem", lineHeight: 1.8, color: "rgba(255,255,255,0.45)", maxWidth: "480px", margin: "40px auto 0", fontWeight: 300 }}>
          We exist to change that. To take the complexity out of compliance, the confusion out of legal navigation, and give everyone the clarity they deserve.
        </p>
      </Reveal>
    </div>
  </section>
);

/* ══════════════════════════════════════════════
   10. FINAL CTA
══════════════════════════════════════════════ */
const FinalCTA: React.FC = () => (
  <section className="min-h-screen flex items-center justify-center px-6 py-32 bg-white relative overflow-hidden">
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full" style={{ background: "radial-gradient(circle, rgba(255,107,0,0.06) 0%, transparent 70%)" }} />
    </div>

    <div className="relative z-10 max-w-4xl mx-auto text-center">
      <Reveal>
        <SectionLabel>What's Next</SectionLabel>
      </Reveal>
      <Reveal delay={0.15}>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(3rem, 7vw, 6rem)", lineHeight: 1.0, color: "#0A0A0A", fontWeight: 400, letterSpacing: "-0.03em" }}>
          Ready to work<br />
          <span style={{ fontStyle: "italic", color: "#FF6B00" }}>with us?</span>
        </h2>
      </Reveal>
      <Reveal delay={0.3}>
        <p className="mt-8" style={{ fontSize: "1.125rem", lineHeight: 1.75, color: "#6B6B6B", maxWidth: "440px", margin: "32px auto 0" }}>
          Whether you're a client, a collaborator, or someone who wants to join the team — we'd love to hear from you.
        </p>
      </Reveal>
      <Reveal delay={0.4}>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-14">
          <motion.a
            href="/contact"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-full text-white font-semibold"
            style={{ background: "linear-gradient(135deg, #FF6B00, #FF9933)", fontSize: "0.9375rem", letterSpacing: "0.01em", boxShadow: "0 8px 32px rgba(255,107,0,0.25)" }}
          >
            Get In Touch
            <ArrowRight className="w-4 h-4" />
          </motion.a>
          <motion.a
            href="/work"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-full font-semibold border"
            style={{ fontSize: "0.9375rem", color: "#0A0A0A", borderColor: "rgba(0,0,0,0.15)", letterSpacing: "0.01em" }}
          >
            See Our Work
            <ExternalLink className="w-4 h-4" />
          </motion.a>
        </div>
      </Reveal>
    </div>
  </section>
);

/* ══════════════════════════════════════════════
   ROOT EXPORT
══════════════════════════════════════════════ */
export const AboutPage: React.FC = () => (
  <>
    <FontImport />
    <main>
      <CinematicHero />
      <OurStory />
      <TeamTimeline />
      <ValuesSection />
      <StatsSection />
      <JourneyTimeline />
      <CultureShowcase />
      <FounderMessage />
      <WhyWeExist />
      <FinalCTA />
    </main>
  </>
);

export default AboutPage;