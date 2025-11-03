import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import MenuSection from './components/MenuSection';
import AboutSection from './components/AboutSection';
import Footer from './components/Footer';
import ChatAssistantModal from './components/ChatAssistantModal';
import AdminDashboard from './components/AdminDashboard';
import FloatingChatButton from './components/FloatingChatButton';
import TableOrderView from './components/TableOrderView';
import { getSliceBotStatus, type SliceBotStatus } from './services/sliceBotService';
import { isBusinessOpen } from './services/scheduleService';

type View = 'site' | 'admin';

const App: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [view, setView] = useState<View>('site');
  const [tableId, setTableId] = useState<string | null>(null);
  const [isSliceBotActive, setIsSliceBotActive] = useState(() => getSliceBotStatus() === 'active');
  const [isStoreOpen, setIsStoreOpen] = useState(() => isBusinessOpen());

  const handleSliceBotStatusChange = (newStatus: SliceBotStatus) => {
    setIsSliceBotActive(newStatus === 'active');
  };

  const openChat = () => {
    if (isSliceBotActive) {
      setIsChatOpen(true);
    }
  };
  const closeChat = () => setIsChatOpen(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tableIdFromUrl = urlParams.get('tableId');
    if (tableIdFromUrl) {
      setTableId(tableIdFromUrl);
    }
    
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'pizzeria-slice-bot-status') {
        setIsSliceBotActive(getSliceBotStatus() === 'active');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const storeStatusInterval = setInterval(() => {
        setIsStoreOpen(isBusinessOpen());
    }, 60000); // Check every minute

    return () => {
        window.removeEventListener('storage', handleStorageChange);
        clearInterval(storeStatusInterval);
    };
  }, []);

  if (tableId) {
    return <TableOrderView tableId={tableId} />;
  }
  
  if (view === 'admin') {
    return <AdminDashboard onGoToSite={() => setView('site')} onSliceBotStatusChange={handleSliceBotStatusChange} />;
  }

  return (
    <div className="bg-light dark:bg-dark text-dark dark:text-light font-sans antialiased">
      <Header onOrderClick={openChat} onAdminClick={() => setView('admin')} isBotActive={isSliceBotActive} isStoreOpen={isStoreOpen} />
      <main>
        <HeroSection onOrderClick={openChat} isBotActive={isSliceBotActive} isStoreOpen={isStoreOpen} />
        <MenuSection />
        <AboutSection />
      </main>
      <Footer onAdminClick={() => setView('admin')} />
      {isSliceBotActive && <ChatAssistantModal isOpen={isChatOpen} onClose={closeChat} />}
      <FloatingChatButton onClick={openChat} isBotActive={isSliceBotActive} />
    </div>
  );
};

export default App;