import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { X, Save, Image as ImageIcon, Palette } from 'lucide-react';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [themeColor, setThemeColor] = useState(profile?.themeColor || '#10b981');
  const [backgroundUrl, setBackgroundUrl] = useState(profile?.backgroundUrl || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!profile) return;
    
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        themeColor,
        backgroundUrl,
        photoURL,
        displayName
      });
      onClose();
    } catch (error) {
      console.error("Error saving settings", error);
      alert("Erro ao salvar configurações.");
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (base64String.length > 1048487) {
        setError("Imagem muito grande! O limite é ~1MB.");
        return;
      }
      setError('');
      setPhotoURL(base64String);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">Configurações</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          {/* Avatar */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <img 
                src={photoURL || 'https://picsum.photos/seed/user/100/100'} 
                alt="Avatar" 
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
              />
              <label className="absolute bottom-0 right-0 p-2 bg-emerald-400 text-gray-900 rounded-full cursor-pointer hover:bg-emerald-500 shadow-sm">
                <ImageIcon size={16} />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
            </div>
            <p className="text-xs text-gray-500">Ou digite um emoji/URL abaixo</p>
            <input 
              type="text" 
              value={photoURL} 
              onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="URL da imagem ou Emoji"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome de Exibição</label>
            <input 
              type="text" 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Theme Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Palette size={16} /> Cor do Tema
            </label>
            <div className="flex gap-3 mt-2">
              {['#10b981', '#3b82f6', '#8b5cf6', '#f43f5e', '#f59e0b', '#1f2937'].map(color => (
                <button
                  key={color}
                  onClick={() => setThemeColor(color)}
                  className={`w-8 h-8 rounded-full border-2 ${themeColor === color ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Background */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <ImageIcon size={16} /> Fundo do Chat (URL)
            </label>
            <input 
              type="text" 
              value={backgroundUrl} 
              onChange={(e) => setBackgroundUrl(e.target.value)}
              placeholder="https://exemplo.com/fundo.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-900 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-gray-900 bg-emerald-400 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm">
            <Save size={16} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
