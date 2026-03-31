import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import SettingsModal from '../components/SettingsModal';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function ChatApp() {
  const { user, profile } = useAuth();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(true);

  // Sound effect for new messages
  useEffect(() => {
    if (!user) return;
    
    // Listen to all chats the user is part of
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const chat = change.doc.data();
          // If the last message is not from the current user, play a sound
          // We would need a more robust way to check if it's a *new* message, 
          // but for simplicity we can check the timestamp or just play it.
          // In a real app, we'd listen to the messages subcollection of each chat.
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  if (!profile) return null;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden" style={{
      backgroundColor: profile.themeColor || '#f3f4f6'
    }}>
      {/* Sidebar */}
      <div className={`
        ${isMobileSidebarOpen ? 'block' : 'hidden'} 
        md:block w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-gray-200 bg-white
      `}>
        <Sidebar 
          activeChatId={activeChatId} 
          setActiveChatId={(id) => {
            setActiveChatId(id);
            setIsMobileSidebarOpen(false);
          }}
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>

      {/* Main Chat Area */}
      <div className={`
        ${!isMobileSidebarOpen ? 'block' : 'hidden'} 
        md:block flex-1 flex flex-col bg-gray-50 relative
      `}>
        {activeChatId ? (
          <ChatWindow 
            chatId={activeChatId} 
            onBack={() => setIsMobileSidebarOpen(true)} 
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50" style={{
            backgroundImage: profile.backgroundUrl ? `url(${profile.backgroundUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}>
            <div className="text-center bg-white/80 p-6 rounded-2xl shadow-sm backdrop-blur-sm">
              <h2 className="text-2xl font-semibold text-gray-800">ZapChat Web</h2>
              <p className="text-gray-500 mt-2">Selecione um chat para começar a conversar</p>
            </div>
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
