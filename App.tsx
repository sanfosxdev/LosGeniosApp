import React, { useState, useEffect } from 'react';
import AdminDashboard from './components/AdminDashboard';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import MenuSection from './components/MenuSection';
import AboutSection from './components/AboutSection';
import Footer from './components/Footer';
import ChatAssistantModal from './components/ChatAssistantModal';
import FloatingChatButton from './components/FloatingChatButton';
import TableOrderView from './components/TableOrderView';
import { isBusinessOpen, fetchAndCacheSchedule } from './services/scheduleService';
import { getSliceBotStatus } from './services/sliceBotService';
import type { SliceBotStatus } from './services/sliceBotService';

type View = 'site' | 'admin' | 'table';

const App: React.FC = () => {
  const [view, setView] = useState<View>('site');
  const [tableId, setTableId] = useState<string | null>(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [sliceBotStatus, setSliceBotStatus] = useState<SliceBotStatus>('inactive');

  useEffect(() => {
    const checkStatus = async () => {
      await fetchAndCacheSchedule();
      setIsStoreOpen(isBusinessOpen());
      setSliceBotStatus(getSliceBotStatus());
    };
    checkStatus();

    const params = new URLSearchParams(window.location.search);
    const adminParam = params.get('admin');
    const tableParam = params.get('tableId');

    if (adminParam === 'true') {
      setView('admin');
    } else if (tableParam) {
      setTableId(tableParam);
      setView('table');
    } else {
      setView('site');
    }
  }, []);
  
  const handleAdminClick = () => {
    // The history API can cause a SecurityError in some sandboxed environments.
    // Switching the view via state is a more robust solution.
    // The URL can be manually changed to ?admin=true to load the admin panel directly.
    setView('admin');
  };

  const handleGoToSite = () => {
    // The history API can cause a SecurityError in some sandboxed environments.
    // For maximum compatibility, we'll just switch the state.
    setView('site');
  };

  const handleSliceBotStatusChange = (newStatus: SliceBotStatus) => {
    setSliceBotStatus(newStatus);
  };

  const renderView = () => {
    switch (view) {
      case 'admin':
        return <AdminDashboard onGoToSite={handleGoToSite} onSliceBotStatusChange={handleSliceBotStatusChange} />;
      case 'table':
        return tableId ? <TableOrderView tableId={tableId} /> : <div>Mesa no especificada.</div>;
      case 'site':
      default:
        return (
          <>
            <Header onOrderClick={() => setIsChatModalOpen(true)} onAdminClick={handleAdminClick} isBotActive={sliceBotStatus === 'active'} isStoreOpen={isStoreOpen} />
            <main>
              <HeroSection onOrderClick={() => setIsChatModalOpen(true)} isBotActive={sliceBotStatus === 'active'} isStoreOpen={isStoreOpen} />
              <MenuSection />
              <AboutSection />
            </main>
            <Footer onAdminClick={handleAdminClick} />
            <FloatingChatButton onClick={() => setIsChatModalOpen(true)} isBotActive={sliceBotStatus === 'active'} />
            <ChatAssistantModal isOpen={isChatModalOpen} onClose={() => setIsChatModalOpen(false)} />
          </>
        );
    }
  };

  return <div className="bg-light dark:bg-dark">{renderView()}</div>;
};

export default App;