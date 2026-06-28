import re

def extract_and_refactor():
    with open('src/pages/Dashboard.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Match AuthScreen block
    match_auth = re.search(r"// ─── Auth Screen.*?const AuthScreen:.*?=> \{.*?return \(.*?\);\s*};\s*(?=// ════════════════════════════════)", content, re.DOTALL)
    
    if match_auth:
        auth_block = match_auth.group(0)
        
        # Remove it from Dashboard.tsx
        new_dashboard = content.replace(auth_block, "")
        
        # We also need to extract doLogin, doSignup, loginForm, signupForm from Dashboard to AuthPage?
        # That's very complex. Let's just create a full AuthPage component.
        
        with open('src/pages/AuthPage.tsx', 'w', encoding='utf-8') as f:
            f.write("""import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scale, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { login, signup } from '../auth';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

type AuthTab = 'login' | 'signup';
const ACCENT = '#FF7A1A';
const LEGAL_BG_IMAGE = 'https://images.unsplash.com/photo-1505664194779-8beaceb93744?w=1600&q=80&auto=format&fit=crop';
const FEATURE_BULLETS = ['AI Legal Research', 'Case Management', 'Drafting Automation'];
const TRUSTED_FIRMS = ['Verma & Co.', 'Sharma Legal', 'Mehta Chambers', 'Rao Associates'];

export const AuthPage = () => {
  const [authTab, setAuthTab] = useState<AuthTab>('login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ name: '', email: '', bar: '', password: '' });
  const navigate = useNavigate();

  const doSignup = async () => {
    try {
      if (!signupForm.email || !signupForm.password) { alert('Please fill all fields'); return; }
      const userCred = await signup(signupForm.email, signupForm.password);
      await setDoc(doc(db, 'users', userCred.user.uid), {
        email: userCred.user.email, name: signupForm.name || 'New User', createdAt: new Date()
      });
      alert('Account created 🚀');
      setAuthTab('login');
    } catch (err: any) { alert(err.message); }
  };

  const doLogin = async () => {
    try {
      if (!loginForm.email || !loginForm.password) { alert('Please fill all fields'); return; }
      await login(loginForm.email, loginForm.password);
      navigate('/dashboard');
    } catch (err: any) { alert(err.message); }
  };

""" + auth_block.replace("const AuthScreen: React.FC<{", "const AuthScreen = ({ authTab, setAuthTab, loginForm, setLoginForm, signupForm, setSignupForm, doLogin, doSignup }: any) => {\n  //") + """

  return <AuthScreen authTab={authTab} setAuthTab={setAuthTab} loginForm={loginForm} setLoginForm={setLoginForm} signupForm={signupForm} setSignupForm={setSignupForm} doLogin={doLogin} doSignup={doSignup} />;
};
""")
            
        with open('src/pages/Dashboard.tsx', 'w', encoding='utf-8') as f:
            f.write(new_dashboard)

extract_and_refactor()
