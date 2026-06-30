import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Navbar, Footer } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

import { LandingPage } from './pages/LandingPage';
import { ComplaintGenerator } from './pages/ComplaintGenerator';
import { LegalGuidance } from './pages/LegalGuidance';
import { Dashboard } from './pages/Dashboard';
import { AuthPage } from './pages/AuthPage';
import { AboutPage } from './pages/AboutPage';
import Research from './pages/Research';
import PublicResearch from './pages/PublicResearch';
import AiAssistant from './pages/AiAssistant';

const MetadataUpdater = () => {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = t('metadata.title');

    const metaDescription = document.querySelector(
      'meta[name="description"]'
    );

    if (metaDescription) {
      metaDescription.setAttribute(
        'content',
        t('metadata.description')
      );
    }

    document.documentElement.lang = i18n.language;
  }, [t, i18n.language]);

  return null;
};

export default function App() {
  return (
    <Router>
      <MetadataUpdater />

      <Navbar />

      <Routes>

        {/* Home */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Complaint Generator */}
        <Route path="/generate" element={<ComplaintGenerator />} />

        {/* Legal Guidance */}
        <Route path="/guidance" element={<LegalGuidance />} />

        {/* Public Legal Research */}
        <Route path="/legal-research" element={<PublicResearch />} />

        {/* Protected: Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected: AI Research */}
        <Route
          path="/research"
          element={
            <ProtectedRoute>
              <Research />
            </ProtectedRoute>
          }
        />

        {/* Protected: AI Assistant */}
        <Route
          path="/ai-assistant"
          element={
            <ProtectedRoute>
              <AiAssistant />
            </ProtectedRoute>
          }
        />

        {/* About */}
        <Route path="/about" element={<AboutPage />} />

        {/* Catch-all: redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>

      <Footer />
    </Router>
  );
}