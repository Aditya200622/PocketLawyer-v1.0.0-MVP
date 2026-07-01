import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scale, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { login, signup } from '../auth';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

type AuthTab = 'login' | 'signup';

const ACCENT = '#FF7A1A';
const LEGAL_BG_IMAGE =
  'https://images.unsplash.com/photo-1505664194779-8beaceb93744?w=1600&q=80&auto=format&fit=crop';
const FEATURE_BULLETS = ['AI Legal Research', 'Case Management', 'Drafting Automation'];
const TRUSTED_FIRMS = ['Verma & Co.', 'Sharma Legal', 'Mehta Chambers', 'Rao Associates'];

// ─── Inner Auth Form Component ────────────────────────────────────────────────
const AuthScreen = ({
  authTab, setAuthTab, loginForm, setLoginForm,
  signupForm, setSignupForm, doLogin, doSignup,
}: {
  authTab: AuthTab; setAuthTab: (t: AuthTab) => void;
  loginForm: { email: string; password: string }; setLoginForm: React.Dispatch<React.SetStateAction<{ email: string; password: string }>>;
  signupForm: { name: string; email: string; bar: string; password: string }; setSignupForm: React.Dispatch<React.SetStateAction<{ name: string; email: string; bar: string; password: string }>>;
  doLogin: () => void; doSignup: () => void;
}) => {
  const fieldStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#FFFFFF',
  };
  const focusGlow = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = ACCENT;
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,122,26,0.16)';
  };
  const blurGlow = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div className="min-h-screen w-full flex" style={{ background: '#050505' }}>
      {/* ───────── LEFT — 60% brand / story panel ───────── */}
      <div className="relative hidden lg:flex lg:w-[60%] h-screen overflow-hidden">
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${LEGAL_BG_IMAGE})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          initial={{ scale: 1 }}
          animate={{ scale: 1.08 }}
          transition={{ duration: 22, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        />
        {/* dark overlay + orange ambient glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(5,5,5,0.92) 0%, rgba(5,5,5,0.55) 45%, rgba(5,5,5,0.88) 100%)',
          }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,122,26,0.25) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 flex flex-col justify-between w-full h-full px-14 py-12">
          {/* Headline block */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl"
          >
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-4" style={{ color: ACCENT }}>
              AI Legal Operating System
            </p>
            <h1 className="text-white font-bold leading-[1.1] text-4xl xl:text-5xl mb-4">
              Your AI-Powered Legal Operating System
            </h1>
            <p className="text-base mb-8" style={{ color: '#9CA3AF' }}>
              Research. Draft. Analyze. Win More Cases.
            </p>

            <div className="space-y-3 mb-10">
              {FEATURE_BULLETS.map((feat, i) => (
                <motion.div
                  key={feat}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: ACCENT }} />
                  <span className="text-sm font-medium text-white">{feat}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Trusted by */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="pt-6"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-3" style={{ color: '#6B7280' }}>
              Trusted by modern law firms
            </p>
            <div className="flex flex-wrap gap-3">
              {TRUSTED_FIRMS.map(firm => (
                <span
                  key={firm}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{
                    color: '#9CA3AF',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  {firm}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ───────── RIGHT — 40% auth card ───────── */}
      <div className="relative flex-1 lg:w-[40%] flex items-center justify-center px-6 py-10 min-h-screen">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,122,26,0.06) 0%, transparent 70%)' }}
        />

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-[380px]"
        >
          <button
            onClick={() => (window.location.href = '/')}
            className="flex items-center gap-2 text-sm font-medium mb-6 transition-colors"
            style={{ color: '#6B7280' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#FFFFFF')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#6B7280')}
          >
            ← Back
          </button>

          <div
            className="p-8"
            style={{
              background: 'rgba(15,15,15,0.75)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '24px',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 24px 70px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            {/* Logo + badge */}
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: ACCENT }}>
                <Scale className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-white text-sm font-semibold">PocketLawyer</span>
            </div>
            <span
              className="inline-block text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full mb-6"
              style={{ background: 'rgba(255,122,26,0.12)', color: ACCENT, border: '1px solid rgba(255,122,26,0.25)' }}
            >
              AI Legal OS
            </span>

            <AnimatePresence mode="wait">
              {authTab === 'login' ? (
                <motion.div key="lh" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                  <h1 className="text-2xl font-bold text-white mb-1">Welcome Back</h1>
                  <p className="text-sm mb-7" style={{ color: '#9CA3AF' }}>Sign in to access your legal workspace.</p>
                </motion.div>
              ) : (
                <motion.div key="sh" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                  <h1 className="text-2xl font-bold text-white mb-1">Create Account</h1>
                  <p className="text-sm mb-7" style={{ color: '#9CA3AF' }}>Start your PocketLawyer OS journey.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {authTab === 'login' ? (
                <motion.div key="login" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.22 }} className="space-y-4">
                  {[
                    { label: 'Email', key: 'email' as const, type: 'email', placeholder: 'advocate@email.com' },
                    { label: 'Password', key: 'password' as const, type: 'password', placeholder: '••••••••' },
                  ].map(f => (
                    <div key={f.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold" style={{ color: '#D1D5DB' }}>{f.label}</label>
                        {f.key === 'password' && (
                          <button className="text-[11px] font-medium" style={{ color: ACCENT }}>Forgot?</button>
                        )}
                      </div>
                      <input
                        type={f.type}
                        className="w-full px-4 py-3 rounded-xl text-sm placeholder-gray-500 outline-none transition-all"
                        style={fieldStyle}
                        placeholder={f.placeholder}
                        value={loginForm[f.key]}
                        onChange={e => setLoginForm(p => ({ ...p, [f.key]: e.target.value }))}
                        onFocus={focusGlow}
                        onBlur={blurGlow}
                      />
                    </div>
                  ))}
                  <motion.button
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    onClick={doLogin}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white mt-2"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, #FF9A3C)`, boxShadow: '0 8px 24px rgba(255,122,26,0.28)' }}
                  >
                    Sign in
                  </motion.button>
                  <p className="text-center text-sm" style={{ color: '#9CA3AF' }}>
                    No account?{' '}
                    <button onClick={() => setAuthTab('signup')} className="font-semibold" style={{ color: ACCENT }}>Sign up</button>
                  </p>
                </motion.div>
              ) : (
                <motion.div key="signup" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }} className="space-y-4">
                  {[
                    { label: 'Full Name', key: 'name' as const, type: 'text', placeholder: 'Adv. Your Name' },
                    { label: 'Email', key: 'email' as const, type: 'email', placeholder: 'advocate@email.com' },
                    { label: 'Bar Council ID', key: 'bar' as const, type: 'text', placeholder: 'UP/1234/2020' },
                    { label: 'Password', key: 'password' as const, type: 'password', placeholder: '••••••••' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#D1D5DB' }}>{f.label}</label>
                      <input
                        type={f.type}
                        className="w-full px-4 py-3 rounded-xl text-sm placeholder-gray-500 outline-none transition-all"
                        style={fieldStyle}
                        placeholder={f.placeholder}
                        value={signupForm[f.key]}
                        onChange={e => setSignupForm(p => ({ ...p, [f.key]: e.target.value }))}
                        onFocus={focusGlow}
                        onBlur={blurGlow}
                      />
                    </div>
                  ))}
                  <motion.button
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    onClick={doSignup}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white mt-2"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, #FF9A3C)`, boxShadow: '0 8px 24px rgba(255,122,26,0.28)' }}
                  >
                    Create account
                  </motion.button>
                  <p className="text-center text-sm" style={{ color: '#9CA3AF' }}>
                    Have an account?{' '}
                    <button onClick={() => setAuthTab('login')} className="font-semibold" style={{ color: ACCENT }}>Sign in</button>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// ─── Exported Page Component ──────────────────────────────────────────────────
export const AuthPage = () => {
  const [authTab, setAuthTab] = useState<AuthTab>('login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ name: '', email: '', bar: '', password: '' });
  const navigate = useNavigate();

  const doSignup = async () => {
  alert("🚫 New registrations are currently closed. Please contact the administrator.");
  return;
};

  const doLogin = async () => {
    try {
      if (!loginForm.email || !loginForm.password) { alert('Please fill all fields'); return; }
      await login(loginForm.email, loginForm.password);
      navigate('/dashboard');
    } catch (err: any) { alert(err.message); }
  };

  return (
    <AuthScreen
      authTab={authTab} setAuthTab={setAuthTab}
      loginForm={loginForm} setLoginForm={setLoginForm}
      signupForm={signupForm} setSignupForm={setSignupForm}
      doLogin={doLogin} doSignup={doSignup}
    />
  );
};
