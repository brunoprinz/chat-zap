import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, updateDoc, doc, getDoc, setDoc, deleteDoc, getDocs, arrayUnion } from 'firebase/firestore';
import { Send, Paperclip, Mic, Square, Image as ImageIcon, BellRing, ArrowLeft, Smile, Check, CheckCheck, Download, Trash2, Edit2, MoreVertical, X, UserPlus } from 'lucide-react';
import { formatTime } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';
import EmojiPicker from 'emoji-picker-react';
import { GoogleGenAI } from '@google/genai';

export default function ChatWindow({ chatId, onBack }: { chatId: string, onBack: () => void }) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [error, setError] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [deleteGroupPassword, setDeleteGroupPassword] = useState('');
  const [deleteGroupError, setDeleteGroupError] = useState('');
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [showDeleteMessageModal, setShowDeleteMessageModal] = useState(false);
  const [messageToDeleteId, setMessageToDeleteId] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (!chatId || !profile) return;

    // Play join sound when opening a chat
    //const joinAudio = new Audio('https://www.soundjay.com/buttons/sounds/button-10.mp3');
    //joinAudio.play().catch(e => console.log('Audio play failed', e));

    // Fetch chat info
    const chatRef = doc(db, 'chats', chatId);
    const unsubscribeChat = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        setChatInfo(doc.data());
      }
    });

    // Fetch messages
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );
  

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

      const msgs: any[] = [];
      
      snapshot.docs.forEach(docSnap => {
        const msg = { id: docSnap.id, ...docSnap.data() } as any;
        if (msg.createdAt) {
          const msgDate = msg.createdAt.toDate();
          if (msgDate < fifteenDaysAgo) {
            // Delete message older than 15 days
            deleteDoc(doc(db, 'chats', chatId, 'messages', msg.id)).catch(console.error);
          } else {
            msgs.push(msg);
          }
        } else {
          msgs.push(msg);
        }
      });
      
      setMessages(msgs);
      scrollToBottom();
      
      // Mark as read
      msgs.forEach(msg => {
        if (msg.senderId !== profile.uid && msg.status !== 'read') {
          updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
            status: 'read',
            readBy: [...(msg.readBy || []), profile.uid]
          });
        }
      });
    });

    // Listen for typing indicators
    const typingQ = query(
      collection(db, 'chats', chatId, 'typing'),
      where('isTyping', '==', true)
    );
    
    const unsubscribeTyping = onSnapshot(typingQ, (snapshot) => {
      const typers = snapshot.docs.filter(d => d.id !== profile.uid);
      setOtherTyping(typers.length > 0);
    });

    return () => {
      unsubscribeChat();
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [chatId, profile]);

 // --- PROTOCOLO VIKING: CHAMAR ATENÇÃO (NUDGE) ---
 useEffect(() => {
  if (messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    
    // Se a última mensagem for 'nudge' e NÃO foi você quem mandou
    if (lastMsg.type === 'nudge' && lastMsg.senderId !== profile?.uid) { 
      
      // 1. Toca o Hino Viking do seu GitHub
      const audio = new Audio('https://github.com/brunoprinz/chat-zap/raw/refs/heads/main/nudge.mp3');
      audio.play().catch(e => console.log("Áudio bloqueado. Clique na tela!", e));
      
      // 2. Faz a tela tremer
      setIsShaking(true);
      
      // 3. Para de tremer após 1.5 segundos
      setTimeout(() => setIsShaking(false), 1500);
    } // <--- ESTA CHAVE FECHA O IF (O SEU ESTAVA FECHANDO LÁ EM CIMA)
  } // <--- ESTA CHAVE FECHA O IF (messages.length)
}, [messages, profile?.uid]); // <--- ESTA FECHA O USEEFFECT

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      setDoc(doc(db, 'chats', chatId, 'typing', profile!.uid), {
        isTyping: true,
        updatedAt: serverTimestamp()
      });
    }

    // Debounce typing indicator
    clearTimeout((window as any).typingTimeout);
    (window as any).typingTimeout = setTimeout(() => {
      setIsTyping(false);
      setDoc(doc(db, 'chats', chatId, 'typing', profile!.uid), {
        isTyping: false,
        updatedAt: serverTimestamp()
      });
    }, 2000);
  };

  const handleSlashCommands = async (text: string) => {
    // 1. Identifica qual comando foi usado
    const isViking = text.startsWith('/viking ');
    const isAbusada = text.startsWith('/groqabusada ');
    const isGroq = text.startsWith('/groq ');
    const isPirata = text.startsWith('/pirata ');

    // Se não for nenhum comando de IA, retorna o texto normal
    if (!isViking && !isAbusada && !isGroq && !isPirata) return text;

    // 2. Limpa o comando do texto para pegar só a pergunta
    const prompt = text.replace(/^\/(viking|groq|groqabusada|pirata)\s+/i, '');
    
    // 3. Define a Personalidade (System Prompt)
    let systemPrompt = "Você é um assistente virtual prestativo e amigável.";
    
    if (isViking) {
      systemPrompt = "Você é um Jarl Viking chamado Groqsson. Fale de forma épica, use termos como Skål, Valhalla, Odin e machados. Responda como um guerreiro honrado e rústico.";
    } else if (isAbusada) {
      systemPrompt = "Você é uma IA sarcástica, impaciente e mal-educada. Reclame de ter que responder, chame o usuário de 'estagiário de código' e seja ironicamente ofensiva e muito cômica. Não use palavrões pesados, apenas deboche.";
    }
        // --- NOVOS PERSONAGENS AQUI ---
        else if (isPirata) {
          systemPrompt = "Você é o Capitão Groq Sparrow. Fale como um pirata bêbado e astuto, use termos como 'marujo', 'pé de chinelo', 'rum' e 'tesouro'. Nunca dê uma resposta direta sem uma metáfora marítima.";
        }
    

    // 4. MEMÓRIA: Pega as últimas 6 mensagens para dar contexto
    // Isso faz a IA lembrar do que vocês estavam falando
    const context = messages.slice(-8).map(m => ({
      role: m.senderId === profile.uid ? 'user' : 'assistant',
      content: m.text
    }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...context, { role: 'user', content: prompt }],
          systemPrompt: systemPrompt
        })
      });
      
      const data = await res.json();
      let response = data.response || "Erro ao consultar a IA.";

      // Se for Viking, dá um toque final no visual da resposta
      if (isViking) response = `🛡️ ${response.toUpperCase()} ⚔️`;
      
      return response;

    } catch (err) {
      return "Erro ao conectar com a IA Groq.";
    }
  };

  const onEmojiClick = (emojiObject: any) => {
    setNewMessage(prev => prev + emojiObject.emoji);
  };

  const sendMessage = async (e?: React.FormEvent, type: 'text' | 'audio' | 'image' | 'file' | 'nudge' = 'text', fileUrl?: string) => {
    e?.preventDefault();
    if (!newMessage.trim() && type === 'text') return;
    if (!profile) return;

    if (editingMessageId) {
      await updateDoc(doc(db, 'chats', chatId, 'messages', editingMessageId), {
        text: newMessage,
        isEdited: true,
        updatedAt: serverTimestamp()
      });
      setNewMessage('');
      setEditingMessageId(null);
      return;
    }

    let finalMessage = newMessage;
    let isAiCommand = false;
    
    if (type === 'text') {
      if (newMessage.startsWith('/viking')) {
        const content = newMessage.replace(/^\/viking\s*/, '');
        finalMessage = '🛡️ Pelo martelo de Thor! ' + content.toUpperCase() + ' SKÅL! 🍺⚔️';
      } else if (newMessage.startsWith('/clipe')) {
        finalMessage = '🎬 Aqui está um clipe para você: https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      } else if (newMessage.startsWith('/groq') || newMessage.startsWith('/grok')) {
        isAiCommand = true;
        finalMessage = newMessage;
      }
    }

    const msgData = {
      chatId,
      senderId: profile.uid,
      text: finalMessage,
      type,
      fileUrl: fileUrl || null,
      status: 'sent',
      createdAt: serverTimestamp(),
      readBy: []
    };

    await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);
    
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: type === 'text' ? finalMessage : `[${type}]`,
      updatedAt: serverTimestamp()
    });

    setNewMessage('');
    setShowEmojiPicker(false);
    setIsTyping(false);
    setDoc(doc(db, 'chats', chatId, 'typing', profile.uid), {
      isTyping: false,
      updatedAt: serverTimestamp()
    });

   

    if (isAiCommand) {
      setDoc(doc(db, 'chats', chatId, 'typing', 'ai_groq'), {
        isTyping: true,
        updatedAt: serverTimestamp()
      });

      const prompt = newMessage.replace(/^\/(groq|grok)\s*/, '');
      let aiText = "";
      try {
        // 1. Usamos a chave da Groq com o prefixo correto
        const apiKey = import.meta.env.VITE_GROQ_API_KEY; 
        
        // 2. Chamada para a API da Groq (que é ultra rápida)
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile", // Modelo gratuito e potente da Groq
            messages: [
              { role: "system", content: "Você é um assistente virtual prestativo e amigável." },
              { role: "user", content: prompt || "Olá" }
            ]
          })
        });

        const data = await response.json();
        aiText = data.choices[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.";
      } catch (err) {
        console.error("AI Error:", err);
        aiText = "Erro ao conectar com a IA da Groq.";
      }

      setDoc(doc(db, 'chats', chatId, 'typing', 'ai_groq'), {
        isTyping: false,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: 'ai_groq',
        text: aiText,
        type: 'text',
        fileUrl: null,
        status: 'sent',
        createdAt: serverTimestamp(),
        readBy: []
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: aiText,
        updatedAt: serverTimestamp()
      });
    }
  };

  const confirmDeleteMessage = (msgId: string) => {
    setMessageToDeleteId(msgId);
    setShowDeleteMessageModal(true);
  };

  const executeDeleteMessage = async () => {
    if (messageToDeleteId) {
      try {
        await deleteDoc(doc(db, 'chats', chatId, 'messages', messageToDeleteId));
      } catch (err) {
        console.error("Erro ao excluir mensagem:", err);
      }
      setShowDeleteMessageModal(false);
      setMessageToDeleteId(null);
    }
  };

  const handleEditMessage = (msg: any) => {
    setEditingMessageId(msg.id);
    setNewMessage(msg.text);
  };

  const handleInviteUser = async () => {
    setInviteError('');
    if (!inviteEmail.trim()) return;

    try {
      const q = query(collection(db, 'users'), where('email', '==', inviteEmail.trim()));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const targetUser = snapshot.docs[0].data();
        
        if (chatInfo?.participants?.includes(targetUser.uid)) {
          setInviteError("Usuário já está no grupo.");
          return;
        }

        await updateDoc(doc(db, 'chats', chatId), {
          participants: arrayUnion(targetUser.uid)
        });
        
        setShowInviteModal(false);
        setInviteEmail('');
      } else {
        setInviteError("Usuário não encontrado.");
      }
    } catch (err) {
      setInviteError("Erro ao convidar usuário.");
    }
  };

  const handleDeleteGroup = async () => {
    if (!chatInfo || !profile) return;
    
    if (chatInfo.adminPassword && chatInfo.adminPassword !== deleteGroupPassword) {
      setDeleteGroupError("Senha incorreta.");
      return;
    }

    try {
      await deleteDoc(doc(db, 'chats', chatId));
      onBack();
    } catch (err) {
      setDeleteGroupError("Erro ao excluir grupo.");
    }
  };

  const playNudgeSound = () => {
    const audio = new Audio('https://www.soundjay.com/buttons/sounds/button-09.mp3'); // Placeholder nudge sound
    audio.play().catch(e => console.log('Audio play failed', e));
    
    // Shake effect
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
      chatContainer.classList.add('animate-shake');
      setTimeout(() => chatContainer.classList.remove('animate-shake'), 500);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Se for menor que 1MB, mantemos o sistema atual para ser instantâneo
    // Se for pequeno, mantém o envio rápido via Firebase (Base64)
    if (file.size <= 1048576) {
      const reader = new FileReader();
      reader.onloadend = () => {
        sendMessage(undefined, type, reader.result as string);
      };
      reader.readAsDataURL(file);
    } 
    // PROTOCOLO DRIVE: Para ficheiros maiores que 1MB
    else {
      setError(`Ficheiro de ${(file.size / 1024 / 1024).toFixed(1)}MB detetado. Enviando para o Drive...`);
      
      try {
        const formData = new FormData();
        formData.append('file', file);

        // Chamada para a sua nova Function no Cloudflare
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) throw new Error('Falha no servidor');

        const data = await response.json();
        
        if (data.fileUrl) {
          // Envia o link do Google Drive para o Chat
          sendMessage(undefined, 'file', data.fileUrl);
          setError(""); 
        }
      } catch (err) {
        console.error("Erro no Drive:", err);
        setError("Erro no upload para o Drive. Tente novamente.");
      }
      
   // ... seu código do catch anterior
   setTimeout(() => setError(''), 4000);
  }
}; // <--- ESSA CHAVE FECHA A FUNÇÃO handleFileUpload

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Aguarda 300ms para garantir que o buffer de áudio foi totalmente preenchido
        await new Promise(resolve => setTimeout(resolve, 300));

        if (audioChunksRef.current.length === 0) {
          console.error("Nenhum dado de áudio capturado.");
          return;
        }

        // Adicionamos o codec opus para garantir compatibilidade total
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        
        // Se for menor que 1KB, o áudio provavelmente está corrompido ou vazio
        if (audioBlob.size < 1000) { 
          console.error("Áudio muito curto ou vazio.");
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          // Envia o áudio para o Firebase/Render
          sendMessage(undefined, 'audio', base64String);
          
          // LIMPEZA: Reseta os chunks para a próxima gravação não bugar
          audioChunksRef.current = [];
        };
        
        reader.readAsDataURL(audioBlob);
        
        // Desliga o hardware do microfone (libera a luz vermelha)
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
      setError("Não foi possível acessar o microfone.");
      setTimeout(() => setError(''), 3000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  
  const toggleRecording = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const exportChatToHTML = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Exportação de Chat - ${chatInfo?.name || 'ZapChat'}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #efeae2; margin: 0; padding: 20px; }
          .chat-container { max-width: 800px; margin: 0 auto; background: #efeae2; padding: 20px; border-radius: 12px; }
          .message { margin-bottom: 15px; display: flex; flex-direction: column; }
          .message.me { align-items: flex-end; }
          .message.other { align-items: flex-start; }
          .bubble { max-width: 75%; padding: 10px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
          .me .bubble { background-color: #d9fdd3; border-top-right-radius: 0; }
          .other .bubble { background-color: #ffffff; border-top-left-radius: 0; }
          .time { font-size: 0.7em; color: #666; margin-top: 5px; text-align: right; }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #ccc; }
          img { max-width: 100%; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="chat-container">
          <div class="header">
            <h2>Conversa com ${chatInfo?.name || 'Usuário'}</h2>
            <p>Exportado em ${new Date().toLocaleString('pt-BR')}</p>
          </div>
          ${messages.map(msg => {
            const isMe = msg.senderId === profile?.uid;
            const time = msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleString('pt-BR') : '';
            let content = '';
            if (msg.type === 'text') content = '<p>' + msg.text + '</p>';
            if (msg.type === 'image') content = '<img src="' + msg.fileUrl + '" alt="Imagem" />';
            if (msg.type === 'audio') content = '<p>[Áudio]</p>';
            if (msg.type === 'nudge') content = '<p style="color: red; font-weight: bold;">[CHAMOU ATENÇÃO]</p>';
            if (msg.type === 'file') content = '<div style="display: flex; align-items: center; gap: 8px; background: #f3f4f6; padding: 8px; border-radius: 8px; border: 1px solid #e5e7eb;"><span style="font-size: 20px;">📁</span> <p style="margin: 0; font-size: 14px; color: #374151;">Anexo enviado</p> <a href="' + msg.fileUrl + '" target="_blank" style="color: #059669; font-weight: bold; text-decoration: none;">Download</a></div>';
            
            return `
              <div class="message ${isMe ? 'me' : 'other'}">
                <div class="bubble">
                  ${content}
                  <div class="time">${time}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${chatInfo?.name || 'export'}-${new Date().getTime()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="chat-container" className={`flex flex-col h-full bg-[#efeae2] relative transition-all duration-75 ${isShaking ? 'animate-shake' : ''}`}>
      {error && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-md z-50 shadow-md">
          {error}
        </div>
      )}
      {/* Chat Header */}
      <div className="flex items-center p-3 bg-gray-100 border-b border-gray-200 shadow-sm z-10">
        <button onClick={onBack} className="mr-2 md:hidden p-2 text-gray-600 hover:bg-gray-200 rounded-full">
          <ArrowLeft size={20} />
        </button>
        <img 
          src={chatInfo?.photoURL || `https://picsum.photos/seed/${chatId}/40/40`} 
          alt="Chat" 
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="ml-3 flex-1">
          <h2 className="text-base font-semibold text-gray-800">{chatInfo?.name || 'Chat'}</h2>
          <p className="text-xs text-emerald-600">
            {otherTyping ? 'digitando...' : (chatInfo?.isOnline ? 'online' : '')}
          </p>
        </div>

        {/* Ícone do Google Drive Estratégico */}
        <div className="flex items-center gap-1">
          <a href="https://drive.google.com" 
            target="_blank" 
            rel="noreferrer"
            className="p-2 hover:bg-gray-200 rounded-full transition-colors flex items-center justify-center"
            title="Abrir Google Drive para arquivos pesados">
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" 
              className="w-5 h-5 opacity-80 hover:opacity-100" 
              alt="Drive"/></a>

        <div className="flex items-center gap-2 relative">
          <button onClick={exportChatToHTML} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full" title="Exportar Chat (HTML)">
            <Download size={20} />
          </button>
          <button onClick={() => sendMessage(undefined, 'nudge')} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full" title="Chamar Atenção">
            <BellRing size={20} />
          </button>
          {chatInfo?.type === 'group' && (
            <>
              <button onClick={() => setShowChatMenu(!showChatMenu)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full">
                <MoreVertical size={20} />
              </button>
              {showChatMenu && (
                <div className="absolute right-0 top-12 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-100">
                  <button onClick={() => { setShowInviteModal(true); setShowChatMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                    <UserPlus size={16} /> Adicionar Membro
                  </button>
                  {chatInfo?.createdBy === profile?.uid && (
                    <button onClick={() => { setShowDeleteGroupModal(true); setShowChatMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2">
                      <Trash2 size={16} /> Excluir Grupo
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Adicionar Membro</h3>
            <input 
              type="email" 
              value={inviteEmail} 
              onChange={e => setInviteEmail(e.target.value)} 
              placeholder="Email do usuário" 
              className="w-full border border-gray-300 p-2 rounded-lg mb-4 text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none" 
            />
            {inviteError && <p className="text-red-500 text-sm mb-4">{inviteError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowInviteModal(false); setInviteError(''); setInviteEmail(''); }} className="px-4 py-2 text-gray-900 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium">Cancelar</button>
              <button onClick={handleInviteUser} className="px-4 py-2 text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg font-medium">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Modal */}
      {showDeleteGroupModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Excluir Grupo</h3>
            <p className="text-sm text-gray-600 mb-4">Tem certeza que deseja excluir este grupo? Esta ação não pode ser desfeita.</p>
            {chatInfo?.adminPassword && (
              <input 
                type="password" 
                value={deleteGroupPassword} 
                onChange={e => setDeleteGroupPassword(e.target.value)} 
                placeholder="Senha de Admin" 
                className="w-full border border-gray-300 p-2 rounded-lg mb-4 text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none" 
              />
            )}
            {deleteGroupError && <p className="text-red-500 text-sm mb-4">{deleteGroupError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowDeleteGroupModal(false); setDeleteGroupError(''); setDeleteGroupPassword(''); }} className="px-4 py-2 text-gray-900 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium">Cancelar</button>
              <button onClick={handleDeleteGroup} className="px-4 py-2 text-white bg-red-500 hover:bg-red-600 rounded-lg font-medium">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Message Modal */}
      {showDeleteMessageModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Apagar Mensagem</h3>
            <p className="text-sm text-gray-600 mb-4">Tem certeza que deseja apagar esta mensagem?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowDeleteMessageModal(false); setMessageToDeleteId(null); }} className="px-4 py-2 text-gray-900 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium">Cancelar</button>
              <button onClick={executeDeleteMessage} className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-bold shadow-sm">Apagar</button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{
        backgroundImage: profile?.backgroundUrl ? `url(${profile.backgroundUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}>
        {messages.map((msg, index) => {
          const isMe = msg.senderId === profile?.uid;
          const showDate = index === 0 || new Date(msg.createdAt?.toDate()).getDate() !== new Date(messages[index - 1].createdAt?.toDate()).getDate();
          
          return (
            <div key={msg.id} className="flex flex-col">
              {showDate && msg.createdAt && (
                <div className="flex justify-center my-4">
                  <span className="bg-white/80 text-gray-500 text-xs px-3 py-1 rounded-lg shadow-sm backdrop-blur-sm">
                    {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(msg.createdAt.toDate())}
                  </span>
                </div>
              )}
              
              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                <div className={`max-w-[75%] rounded-lg p-2 shadow-sm relative ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                  {msg.type === 'nudge' && (
                    <div className="flex items-center gap-2 text-red-500 font-bold italic">
                      <BellRing size={18} /> CHAMOU ATENÇÃO!
                    </div>
                  )}
                  
                  {msg.type === 'text' && (
                    <p className="text-sm text-gray-800 break-words whitespace-pre-wrap">
                      {msg.text}
                      {msg.isEdited && <span className="text-[10px] text-gray-500 italic ml-2">(Editado)</span>}
                    </p>
                  )}
                  
                  {msg.type === 'image' && msg.fileUrl && (
                    <img src={msg.fileUrl} alt="Attachment" className="max-w-full rounded-md max-h-64 object-contain" />
                  )}
                  
                  {msg.type === 'audio' && msg.fileUrl && (
                    <audio controls src={msg.fileUrl} className="max-w-full h-10" />
                  )}

                  <div className="flex items-center justify-end gap-1 mt-1">
                    {isMe && msg.type === 'text' && (
                      <button onClick={() => handleEditMessage(msg)} className="text-gray-400 hover:text-gray-600 p-0.5">
                        <Edit2 size={12} />
                      </button>
                    )}
                    {isMe && (
                      <button onClick={() => confirmDeleteMessage(msg.id)} className="text-gray-400 hover:text-red-500 p-0.5">
                        <Trash2 size={12} />
                      </button>
                    )}
                    <span className="text-[10px] text-gray-500 ml-1">
                      {msg.createdAt ? formatTime(msg.createdAt.toDate()) : ''}
                    </span>
                    {isMe && (
                      <span className="text-gray-400 ml-1">
                        {msg.status === 'read' ? <CheckCheck size={14} className="text-blue-500" /> : <Check size={14} />}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {editingMessageId && (
        <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-100 flex justify-between items-center text-sm text-emerald-800">
          <span>Editando mensagem...</span>
          <button onClick={() => { setEditingMessageId(null); setNewMessage(''); }} className="p-1 hover:bg-emerald-100 rounded-full">
            <X size={16} />
          </button>
        </div>
      )}
      <div className="p-3 bg-gray-100 flex items-center gap-2 z-10 relative">
        {showEmojiPicker && (
          <div className="absolute bottom-16 left-2 z-50 shadow-xl rounded-lg">
            <EmojiPicker onEmojiClick={onEmojiClick} />
          </div>
        )}
        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full">
          <Smile size={24} />
        </button>
        
        <label className="p-2 text-gray-500 hover:bg-gray-200 rounded-full cursor-pointer">
          <Paperclip size={24} />
          <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'file')} />
        </label>
        
        <label className="p-2 text-gray-500 hover:bg-gray-200 rounded-full cursor-pointer">
          <ImageIcon size={24} />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
        </label>

        <form onSubmit={(e) => sendMessage(e, 'text')} className="flex-1 flex items-center bg-white rounded-lg px-3 py-1 shadow-sm">
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            placeholder="Digite uma mensagem (use /groq para IA, /viking /groqabusada/pirata)"
            className="flex-1 bg-transparent border-none outline-none py-2 text-sm text-gray-800"
          />
        </form>

        {newMessage.trim() ? (
        <button onClick={(e) => sendMessage(e, 'text')} className="p-3 bg-emerald-400 text-gray-900 rounded-full hover:bg-emerald-500 shadow-sm transition-colors">
        <Send size={20} className="ml-1" />
      </button>
    ) : (
      <button 
        onClick={toggleRecording}
        className={`p-3 rounded-full shadow-lg transition-all duration-300 ${
          recording 
            ? 'bg-red-600 text-white animate-pulse scale-110 shadow-red-200' 
            : 'bg-emerald-400 text-gray-900 hover:bg-emerald-500'
        }`}
        title={recording ? "Clique para parar e enviar" : "Clique para gravar"}
      >
        {recording ? <Square size={20} fill="white" /> : <Mic size={20} />}
      </button>
        )}
      </div>
    </div>
  );
}