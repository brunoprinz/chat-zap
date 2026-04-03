import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, logOut } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { Search, MoreVertical, Plus, User, LogOut, Settings, Globe } from 'lucide-react';
import { formatTime } from '../lib/utils';

export default function Sidebar({ activeChatId, setActiveChatId, onOpenSettings }: { activeChatId: string | null, setActiveChatId: (id: string) => void, onOpenSettings: () => void }) {
  const { profile } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showExploreGroupsModal, setShowExploreGroupsModal] = useState(false);
  const [publicGroups, setPublicGroups] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [groupPassword, setGroupPassword] = useState('');
  const [isGroupPublic, setIsGroupPublic] = useState(true);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    if (!profile) return;
    
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', profile.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChats(chatData);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleCreateChat = async () => {
    setModalError('');
    if (!inputValue.trim() || !profile) return;

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', inputValue.trim()));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const targetUser = snapshot.docs[0].data();
        
        const existingChat = chats.find(c => 
          c.type === 'direct' && c.participants.includes(targetUser.uid)
        );

        if (existingChat) {
          setActiveChatId(existingChat.id);
        } else {
          const newChatRef = await addDoc(collection(db, 'chats'), {
            type: 'direct',
            participants: [profile.uid, targetUser.uid],
            updatedAt: serverTimestamp(),
            isPublic: false,
            name: targetUser.displayName,
            photoURL: targetUser.photoURL
          });
          setActiveChatId(newChatRef.id);
        }
        setShowNewChatModal(false);
        setInputValue('');
      } else {
        setModalError("Usuário não encontrado.");
      }
    } catch (err) {
      setModalError("Erro ao buscar usuário.");
    }
  };

  const handleCreateGroup = async () => {
    setModalError('');
    if (!inputValue.trim() || !profile) return;

    try {
      const newChatRef = await addDoc(collection(db, 'chats'), {
        type: 'group',
        name: inputValue.trim(),
        participants: [profile.uid],
        updatedAt: serverTimestamp(),
        isPublic: isGroupPublic,
        adminPassword: groupPassword,
        createdBy: profile.uid
      });
      setActiveChatId(newChatRef.id);
      setShowNewGroupModal(false);
      setInputValue('');
      setGroupPassword('');
      setIsGroupPublic(true);
    } catch (err) {
      setModalError("Erro ao criar grupo.");
    }
  };

  const openNewChatModal = () => {
    setInputValue('');
    setModalError('');
    setShowNewChatModal(true);
    setShowMenu(false);
  };

  const openNewGroupModal = () => {
    setInputValue('');
    setGroupPassword('');
    setIsGroupPublic(true);
    setModalError('');
    setShowNewGroupModal(true);
    setShowMenu(false);
  };

  const openExploreGroupsModal = async () => {
    setShowMenu(false);
    setShowExploreGroupsModal(true);
    try {
      const q = query(
        collection(db, 'chats'),
        where('type', '==', 'group'),
        where('isPublic', '==', true)
      );
      const snapshot = await getDocs(q);
      const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPublicGroups(groups);
    } catch (error) {
      console.error("Error fetching public groups:", error);
    }
  };

  const joinGroup = async (groupId: string) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'chats', groupId), {
        // Atualizamos as duas listas para garantir que o grupo apareça na lateral
        participants: arrayUnion(profile.uid),
        members: arrayUnion(profile.uid) 
      });
      setShowExploreGroupsModal(false);
      setActiveChatId(groupId);
      alert("Entrou no bando! Skål!"); // Um aviso pra você saber que funcionou
    } catch (error) {
      console.error("Error joining group:", error);
      alert("Erro ao entrar no grupo.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-3 bg-gray-50 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-3">
          <img 
            src={profile?.photoURL || 'https://picsum.photos/seed/user/40/40'} 
            alt="Profile" 
            className="w-10 h-10 rounded-full object-cover cursor-pointer"
            onClick={onOpenSettings}
          />
          <span className="font-semibold text-gray-800 truncate">{profile?.displayName}</span>
        </div>
        
        <div className="flex items-center gap-2 relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full">
            <MoreVertical size={20} />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-12 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-100">
              <button onClick={openNewChatModal} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                <User size={16} /> Nova Conversa
              </button>
              <button onClick={openNewGroupModal} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                <Plus size={16} /> Novo Grupo
              </button>
              <button onClick={openExploreGroupsModal} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                <Globe size={16} /> Explorar Grupos
              </button>
              <button onClick={onOpenSettings} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                <Settings size={16} /> Configurações
              </button>
              <button onClick={logOut} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2">
                <LogOut size={16} /> Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-gray-200">
        <div className="relative bg-gray-100 rounded-lg flex items-center px-3 py-1.5">
          <Search size={18} className="text-gray-500" />
          <input 
            type="text" 
            placeholder="Pesquisar ou começar nova conversa" 
            className="bg-transparent border-none outline-none w-full ml-3 text-sm text-gray-700 placeholder-gray-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Modals */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Nova Conversa</h3>
            <input 
              type="email" 
              value={inputValue} 
              onChange={e => setInputValue(e.target.value)} 
              placeholder="Email do usuário" 
              className="w-full border border-gray-300 p-2 rounded-lg mb-4 text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none" 
            />
            {modalError && <p className="text-red-500 text-sm mb-4">{modalError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewChatModal(false)} className="px-4 py-2 text-gray-900 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium">Cancelar</button>
              <button onClick={handleCreateChat} className="px-4 py-2 text-gray-900 bg-emerald-400 hover:bg-emerald-500 rounded-lg font-medium">Iniciar</button>
            </div>
          </div>
        </div>
      )}

      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Novo Grupo</h3>
            <input 
              type="text" 
              value={inputValue} 
              onChange={e => setInputValue(e.target.value)} 
              placeholder="Nome do grupo" 
              className="w-full border border-gray-300 p-2 rounded-lg mb-3 text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none" 
            />
            <input 
              type="password" 
              value={groupPassword} 
              onChange={e => setGroupPassword(e.target.value)} 
              placeholder="Senha de Admin (opcional)" 
              className="w-full border border-gray-300 p-2 rounded-lg mb-3 text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none" 
            />
            <div className="flex items-center gap-2 mb-4">
              <input 
                type="checkbox" 
                id="isPublic" 
                checked={isGroupPublic} 
                onChange={e => setIsGroupPublic(e.target.checked)} 
                className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
              />
              <label htmlFor="isPublic" className="text-sm text-gray-700">Grupo Público (qualquer um pode ver)</label>
            </div>
            {modalError && <p className="text-red-500 text-sm mb-4">{modalError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewGroupModal(false)} className="px-4 py-2 text-gray-900 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium">Cancelar</button>
              <button onClick={handleCreateGroup} className="px-4 py-2 text-gray-900 bg-emerald-400 hover:bg-emerald-500 rounded-lg font-medium">Criar</button>
            </div>
          </div>
        </div>
      )}

{showExploreGroupsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Explorar Grupos Públicos</h3>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {publicGroups.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nenhum grupo público encontrado.</p>
              ) : (
                publicGroups.map(group => {
                  // AQUI ESTÁ O SEGREDO: Se não existir a lista, criamos uma vazia na hora
                  const pList = group.participants || [];
                  const mList = group.members || [];
                  const isMember = pList.includes(profile?.uid) || mList.includes(profile?.uid);

                  return (
                    <div key={group.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div>
                        <h4 className="font-medium text-gray-900">{group.name}</h4>
                        <p className="text-xs text-gray-500">{(pList.length || mList.length || 0)} participantes</p>
                      </div>
                      {isMember ? (
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">Membro</span>
                      ) : (
                        <button 
                          onClick={() => joinGroup(group.id)}
                          className="px-3 py-1.5 text-sm text-white bg-emerald-400 hover:bg-emerald-500 rounded-lg font-bold shadow-sm transition-all active:scale-95"
                        >
                          ENTRAR
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowExploreGroupsModal(false)} className="px-4 py-2 text-sm font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {chats.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || c.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())).map(chat => (
          <div 
            key={chat.id}
            onClick={() => setActiveChatId(chat.id)}
            className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition-colors ${activeChatId === chat.id ? 'bg-gray-100' : ''}`}
          >
            <img 
              src={chat.photoURL || `https://picsum.photos/seed/${chat.id}/50/50`} 
              alt="Chat Avatar" 
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
            <div className="ml-3 flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <h3 className="text-sm font-semibold text-gray-900 truncate">
                  {chat.type === 'group' ? chat.name : (chat.name || 'Chat Privado')}
                </h3>
                {chat.updatedAt && (
                  <span className="text-xs text-gray-500">
                    {formatTime(chat.updatedAt.toDate())}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate mt-0.5">
                {chat.lastMessage || 'Nova conversa'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
