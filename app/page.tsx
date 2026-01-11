'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Settings, 
  User, 
  Plus, 
  MessageSquare, 
  MoreVertical, 
  Search, 
  Sparkles, 
  Menu, 
  X, 
  Trash2, 
  Globe, 
  Loader2, 
  Info,
  Download,
  Zap,
  LayoutGrid,
  Rocket,
  Sun,
  Moon,
  Share,
  Check,
  Copy,
  Smartphone,
  Monitor
} from 'lucide-react';

// --- TYPES & INTERFACES ---
type Role = 'user' | 'model' | 'assistant';

interface Message {
  id: string;
  role: Role;
  content: string;
  avatar?: string;
}

interface Character {
  id: string;
  name: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  color: string;
  isExternal?: boolean;
}

interface ChatSession {
  id: string;
  targetId: string;
  messages: Message[];
  lastMessageAt: Date;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DAILY_LIMIT = 30;

// --- Constants ---
const GOKU_WALLPAPERS = [
  "/anime.jpg", // Ensure 'anime.jpg' is inside your 'public' folder
];

// --- Helper: Simple Markdown Formatter ---
const FormatText = ({ text }: { text: string }) => {
  if (!text) return null;
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i} className="min-h-[1.2em] mb-1 last:mb-0 break-words">
          {line.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
              return <em key={j} className="text-slate-400">{part.slice(1, -1)}</em>;
            }
            return <span key={j}>{part}</span>;
          })}
        </p>
      ))}
    </>
  );
};

export default function App() {
  // --- State ---
  // FIXED: Default to 'groq' so you can see the badge immediately
  const [provider, setProvider] = useState<'gemini' | 'huggingface' | 'groq'>('groq');
  
  const [geminiKey, setGeminiKey] = useState(''); 
  const [hfKey, setHfKey] = useState('');
  const [groqKey, setGroqKey] = useState(''); 

  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash'); 
  const [hfModel, setHfModel] = useState('mistralai/Mistral-7B-Instruct-v0.2');
  const [groqModel, setGroqModel] = useState('llama3-8b-8192'); 

  const [dailyCount, setDailyCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);

  // Debugging/Settings State
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelCheckStatus, setModelCheckStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [modelCheckError, setModelCheckError] = useState('');

  // App State
  const [userAvatar, setUserAvatar] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  // PWA & UI
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [globalResults, setGlobalResults] = useState<Character[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bgErrorCount = useRef(0);

  // --- Initialization & Storage ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // PWA Prompt Handler
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.addEventListener('beforeinstallprompt' as any, handleBeforeInstallPrompt);

      // Load Settings safely
      setGeminiKey(localStorage.getItem('anime_gemini_key') || '');
      setHfKey(localStorage.getItem('anime_hf_key') || '');
      setGroqKey(localStorage.getItem('anime_groq_key') || '');
      
      setGeminiModel(localStorage.getItem('anime_gemini_model') || 'gemini-1.5-flash');
      setHfModel(localStorage.getItem('anime_hf_model') || 'mistralai/Mistral-7B-Instruct-v0.2');
      setGroqModel(localStorage.getItem('anime_groq_model') || 'llama3-8b-8192');

      const savedProvider = localStorage.getItem('anime_provider');
      if (savedProvider === 'gemini' || savedProvider === 'huggingface' || savedProvider === 'groq') {
        setProvider(savedProvider as 'gemini' | 'huggingface' | 'groq');
      }
      setUserAvatar(localStorage.getItem('anime_chat_user_avatar') || '');

      // Load Sessions Safely
      const savedSessions = localStorage.getItem('anime_chat_sessions');
      if (savedSessions) {
        try {
          const parsed = JSON.parse(savedSessions);
          if (Array.isArray(parsed)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hydrated = parsed.map((s: any) => ({
               ...s,
               lastMessageAt: new Date(s.lastMessageAt || Date.now())
            }));
            setSessions(hydrated);
          }
        } catch (e) { 
          console.error("Failed to load sessions:", e);
        }
      }

      // Load Characters Safely
      const savedChars = localStorage.getItem('anime_chat_custom_chars');
      if (savedChars) {
        try {
          const parsedChars = JSON.parse(savedChars);
          if (Array.isArray(parsedChars)) {
            setAllCharacters(parsedChars);
          }
        } catch (e) { 
          console.error("Failed to load characters:", e); 
        }
      }

      // --- Daily Limit Logic (Groq Only) ---
      const checkDailyLimit = () => {
        try {
          const today = new Date().toDateString();
          const storedLimit = localStorage.getItem('anime_groq_limit');
          
          if (storedLimit) {
            const data = JSON.parse(storedLimit);
            if (data && typeof data === 'object' && data.date === today) {
              setDailyCount(data.count || 0);
              if ((data.count || 0) >= DAILY_LIMIT) setLimitReached(true);
            } else {
              setDailyCount(0);
              localStorage.setItem('anime_groq_limit', JSON.stringify({ date: today, count: 0 }));
              setLimitReached(false);
            }
          } else {
            localStorage.setItem('anime_groq_limit', JSON.stringify({ date: today, count: 0 }));
          }
        } catch (e) {
          console.error("Error reading limit:", e);
          const today = new Date().toDateString();
          localStorage.setItem('anime_groq_limit', JSON.stringify({ date: today, count: 0 }));
        }
      };
      checkDailyLimit();

      return () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.removeEventListener('beforeinstallprompt' as any, handleBeforeInstallPrompt);
      };
    }
  }, []);

  // --- Theme Logic ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedTheme = localStorage.getItem('anime_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme as 'light' | 'dark');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('anime_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Persistence Effects
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('anime_chat_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('anime_chat_custom_chars', JSON.stringify(allCharacters));
    }
  }, [allCharacters]);

  // Scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessions, activeSessionId, isLoading]);

  // Increment Limit Helper
  const incrementDailyLimit = () => {
    const today = new Date().toDateString();
    const newCount = dailyCount + 1;
    setDailyCount(newCount);
    localStorage.setItem('anime_groq_limit', JSON.stringify({ date: today, count: newCount }));
    if (newCount >= DAILY_LIMIT) setLimitReached(true);
  };

  const cleanModelId = (id: string) => {
    if (!id) return 'gemini-1.5-flash';
    return id.replace(/^models\//, '').trim();
  };

  // --- Helper: Render Daily Limit Badge ---
  const renderUsageBadge = () => {
    // Show limit if provider is Groq and NO custom key is present
    if (provider !== 'groq' || groqKey) return null;
    
    const percentage = (dailyCount / DAILY_LIMIT) * 100;
    
    let colorClass = "text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-900/30 border-green-200 dark:border-green-800";
    if (percentage > 66) colorClass = "text-orange-600 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800";
    if (percentage >= 100) colorClass = "text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900/30 border-red-200 dark:border-red-800";

    return (
      <div 
        className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border ${colorClass} transition-colors duration-300`} 
        title={`You have used ${dailyCount} out of ${DAILY_LIMIT} free daily messages.`}
      >
        <Zap className="w-3 h-3" />
        <span>{dailyCount}/{DAILY_LIMIT}</span>
      </div>
    );
  };

  // --- Model Checker ---
  const checkAvailableModels = async () => {
    if (!geminiKey) {
       setModelCheckStatus('error');
       setModelCheckError('Please enter your Gemini API Key to check models.');
       return;
    }

    setModelCheckStatus('loading');
    setAvailableModels([]);
    setModelCheckError('');

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || response.statusText);
      }
      
      const data = await response.json();
      if (data.models) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const generateModels = data.models.filter((m: any) => 
          m.supportedGenerationMethods?.includes('generateContent')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ).map((m: any) => m.name.replace('models/', ''));
        
        setAvailableModels(generateModels);
        setModelCheckStatus('success');
      } else {
        throw new Error('No models found.');
      }
    } catch (error) {
      setModelCheckStatus('error');
      setModelCheckError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // --- Search Logic (Jikan API) ---
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (searchQuery.length > 2) {
      setIsSearchingGlobal(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(searchQuery)}&limit=5`);
          const data = await response.json();
          
          if (data.data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mappedResults: Character[] = data.data.map((char: any) => ({
              id: `mal_${char.mal_id}`,
              name: char.name,
              avatar: char.images?.jpg?.image_url || '', 
              color: 'bg-slate-700', 
              description: char.about ? (char.about.substring(0, 50) + "...") : "Anime Character",
              systemPrompt: `You are ${char.name}. ${char.about ? char.about.substring(0, 800) : "Unknown"}. Roleplay as ${char.name}.`,
              isExternal: true
            }));
            setGlobalResults(mappedResults);
          }
        } catch (error) {
          console.error("Failed to fetch from Jikan", error);
        } finally {
          setIsSearchingGlobal(false);
        }
      }, 800);
    } else {
      setGlobalResults([]);
      setIsSearchingGlobal(false);
    }

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // --- Core Logic: Chat Interaction ---
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !activeSessionId || isLoading) return;
    
    let effectiveKey = '';
    let isOwnerKey = false;
    
    if (provider === 'gemini') {
      effectiveKey = geminiKey.trim();
      if (!effectiveKey) {
        alert("Gemini API Key missing. Please add in Settings.");
        setShowSettings(true);
        return;
      }
    } else if (provider === 'huggingface') {
      effectiveKey = hfKey.trim();
      if (!effectiveKey) {
        alert("Hugging Face API Key missing. Please add in Settings.");
        setShowSettings(true);
        return;
      }
    } else if (provider === 'groq') {
      if (groqKey.trim()) {
        effectiveKey = groqKey.trim();
      } else {
        // Assume backend proxy
        isOwnerKey = true;
      }

      // Check for limit locally first to save a network call
      if (isOwnerKey && dailyCount >= DAILY_LIMIT) {
        setLimitReached(true);
        alert(`Daily limit of ${DAILY_LIMIT} messages reached for the free tier.`);
        return;
      }
    }

    // Optimistic Update
    const currentSession = sessions.find(s => s.id === activeSessionId);
    if (!currentSession) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      avatar: userAvatar
    };

    const updatedMessages = [...(currentSession.messages || []), userMsg];
    
    setSessions(prev => prev.map(s => 
      s.id === activeSessionId 
        ? { ...s, messages: updatedMessages, lastMessageAt: new Date() }
        : s
    ));
    
    setInputMessage('');
    setIsLoading(true);

    try {
      const entity = allCharacters.find(c => c.id === currentSession.targetId);
      if (!entity) throw new Error("Entity not found");

      let aiText = "";

      // Gemini
      if (provider === 'gemini') {
        const safeModel = cleanModelId(geminiModel);
        
        const historyContext = updatedMessages.slice(-10).map(m => ({
          role: m.role === 'model' ? 'model' : 'user', 
          parts: [{ text: m.content }]
        }));

        const payload = {
          contents: historyContext,
          systemInstruction: {
            parts: [{ text: `${entity.systemPrompt}\n\nIMPORTANT: Roleplay as ${entity.name}. Short responses.` }]
          },
          generationConfig: { temperature: 0.9, maxOutputTokens: 250 }
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:generateContent?key=${effectiveKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData.error?.message || response.statusText;
          if (response.status === 404) throw new Error(`Model '${safeModel}' not found (404). Try 'Check Access' in Settings.`);
          throw new Error(`Gemini Error: ${errorMessage}`);
        }

        const data = await response.json();
        aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "(No response)";
      } 
      
      // Hugging Face
      else if (provider === 'huggingface') {
        const payload = {
          inputs: `<s>[INST] ${entity.systemPrompt} [/INST] Understood.</s>
          ${updatedMessages.slice(-5).map(m => 
            m.role === 'user' 
              ? `[INST] ${m.content} [/INST]` 
              : `${m.content}</s>`
          ).join('\n')}`,
          parameters: {
            max_new_tokens: 250,
            temperature: 0.9,
            return_full_text: false
          }
        };

        const response = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${effectiveKey}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(`HF Error: ${err.error || response.statusText}`);
        }

        const data = await response.json();
        if (Array.isArray(data)) {
          aiText = data[0]?.generated_text || "(No response)";
        } else {
          aiText = data?.generated_text || "(No response)";
        }
      }

      // Groq
      else if (provider === 'groq') {
        const payload = {
          model: groqModel,
          messages: [
            { role: "system", content: `${entity.systemPrompt}\n\nIMPORTANT: Roleplay as ${entity.name}. Stay in character.` },
            ...updatedMessages.slice(-10).map(m => ({
              role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content
            }))
          ],
          temperature: 0.9,
          max_tokens: 250
        };

        let response;

        if (isOwnerKey) {
          // --- SECURE MODE: Use our own Backend Proxy ---
          response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
        } else {
          // --- USER KEY MODE: Call Groq Directly ---
          response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${effectiveKey}`
            },
            body: JSON.stringify(payload)
          });
        }

        if (response && !response.ok) {
          const err = await response.json();
          if (response.status === 429) {
             throw new Error("Global rate limit reached. Please wait a moment.");
          }
          throw new Error(`Groq Error: ${err.error?.message || err.error || response.statusText}`);
        }

        const data = await response?.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        aiText = data?.choices?.[0]?.message?.content || "(No response)";

        if (isOwnerKey) incrementDailyLimit();
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: provider === 'gemini' ? 'model' : 'assistant',
        content: aiText,
        avatar: entity.avatar
      };

      setSessions(prev => prev.map(s => 
        s.id === activeSessionId 
          ? { ...s, messages: [...(s.messages || []), aiMsg] }
          : s
      ));

    } catch (error) {
      console.error(error);
      let errorMessage = "Unknown Error";
      let isRateLimit = false;

      if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
           isRateLimit = true;
           errorMessage = "⚠️ Global free tier is busy (Rate Limit). Please wait 30s or use your own Key in Settings.";
        }
      }
      
      setSessions(prev => prev.map(s => {
        if (s.id !== activeSessionId) return s;
        return {
          ...s,
          messages: [...(s.messages || []), { 
            id: 'err', 
            role: 'model', 
            content: isRateLimit ? `**${errorMessage}**` : `*[System Error]: ${errorMessage}*` 
          }]
        };
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const startSession = (targetId: string, charData?: Character) => {
    if (charData && !allCharacters.find(c => c.id === charData.id)) {
      setAllCharacters(prev => [...prev, charData]);
    }

    const existing = sessions.find(s => s.targetId === targetId);
    if (existing) {
      setActiveSessionId(existing.id);
    } else {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        targetId,
        messages: [],
        lastMessageAt: new Date()
      };
      setSessions([newSession, ...sessions]);
      setActiveSessionId(newSession.id);
    }
    setMobileMenuOpen(false);
    setSearchQuery('');
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) setActiveSessionId(null);
  };

  const saveSettings = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('anime_gemini_key', geminiKey.trim()); 
      localStorage.setItem('anime_hf_key', hfKey.trim());
      localStorage.setItem('anime_groq_key', groqKey.trim());
      localStorage.setItem('anime_gemini_model', cleanModelId(geminiModel));
      localStorage.setItem('anime_hf_model', hfModel.trim());
      localStorage.setItem('anime_groq_model', groqModel.trim());
      localStorage.setItem('anime_provider', provider);
      localStorage.setItem('anime_chat_user_avatar', userAvatar);
    }
    setShowSettings(false);
  };

  const getEntity = (targetId: string) => allCharacters.find(c => c.id === targetId);

  const renderAvatar = (avatar: string, color: string, sizeClass = "w-10 h-10") => {
    const isUrl = avatar?.startsWith('http');
    return (
      <div className={`${sizeClass} rounded-full ${color} flex items-center justify-center overflow-hidden shrink-0 border border-slate-300 dark:border-slate-700/50 shadow-md`}>
        {isUrl ? (
          <img 
            src={avatar} 
            alt="Avatar" 
            className="w-full h-full object-cover"
            onError={(e) => {
               e.currentTarget.style.display = 'none'; // Hide broken image
               if (e.currentTarget.parentElement) {
                   e.currentTarget.parentElement.innerHTML = '<span class="text-xs">?</span>';
               }
            }}
          />
        ) : (
          <span className={sizeClass === "w-10 h-10" ? "text-xl" : "text-2xl"}>{avatar || 'C'}</span>
        )}
      </div>
    );
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Improved Install PWA Logic:
  // If native prompt is available, use it.
  // If not, open our manual instruction modal.
  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      });
    } else {
      setShowInstallModal(true);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300">
      
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* --- SIDEBAR --- */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out flex flex-col
        md:relative md:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <h1 className="text-xl font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-500" /> Otaku Verse
          </h1>
          <div className="flex items-center gap-1">
            {renderUsageBadge()}
            <button 
              onClick={toggleTheme} 
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition text-slate-500 dark:text-slate-400"
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition text-slate-500 dark:text-slate-400">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 pb-0 shrink-0">
          <div className="relative group">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-violet-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search Anime World..." 
              className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-900 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-600 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearchingGlobal && (
               <div className="absolute right-3 top-2.5">
                  <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
               </div>
            )}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {searchQuery.length > 2 && (
             <div className="space-y-2 animate-in fade-in slide-in-from-left-4 duration-300">
               <div className="flex items-center justify-between">
                 <h2 className="text-xs font-semibold text-violet-500 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1">
                   <Globe className="w-3 h-3" /> Global Results
                 </h2>
               </div>
               {globalResults.length === 0 && !isSearchingGlobal ? (
                 <div className="text-sm text-slate-500 text-center py-4">No characters found.</div>
               ) : (
                 globalResults.map((char, index) => (
                  <div 
                    key={`${char.id}-${index}`}
                    onClick={() => startSession(char.id, char)}
                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all"
                  >
                    {renderAvatar(char.avatar, char.color)}
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-200">{char.name}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[150px]">Click to chat</div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-400 dark:text-slate-600 ml-auto" />
                  </div>
                 ))
               )}
               <div className="border-b border-slate-200 dark:border-slate-800 my-4" />
             </div>
          )}

          {!searchQuery && sessions.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent Chats</h2>
              {sessions.map(session => {
                const entity = getEntity(session.targetId);
                if (!entity) return null;
                return (
                  <div 
                    key={session.id}
                    onClick={() => { setActiveSessionId(session.id); setMobileMenuOpen(false); }}
                    className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${activeSessionId === session.id ? 'bg-slate-200 dark:bg-slate-800 shadow-md border-l-2 border-violet-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                  >
                    {renderAvatar(entity.avatar, 'bg-slate-300 dark:bg-slate-800', "w-10 h-10")}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-slate-800 dark:text-slate-200">{entity.name}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {session.messages && session.messages.length > 0 ? session.messages[session.messages.length - 1].content : 'Start chatting...'}
                      </div>
                    </div>
                    <button 
                      onClick={(e) => deleteSession(e, session.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 dark:hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saved Characters</h2>
            </div>
            {allCharacters.length === 0 && !searchQuery ? (
              <div className="text-xs text-slate-500 dark:text-slate-600 italic px-2">No characters saved. Search to add one!</div>
            ) : (
              allCharacters
                .filter(c => !c.isExternal || sessions.some(s => s.targetId === c.id)) 
                .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(char => (
                <div 
                  key={char.id}
                  onClick={() => startSession(char.id)}
                  className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {renderAvatar(char.avatar, char.color)}
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">{char.name}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[150px]">{char.description}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Install Button & Info Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <button 
            onClick={handleInstallClick}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 p-2.5 rounded-xl transition-all font-medium text-sm"
          >
            <Download className="w-4 h-4" /> Install / Share App
          </button>
          
          <div className="text-[10px] text-slate-500 leading-tight">
            <p className="flex items-start gap-1">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                AI powered by {provider === 'gemini' ? 'Google Gemini' : provider === 'groq' ? 'Groq' : 'Hugging Face'}.
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* --- MAIN CHAT AREA --- */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 relative overflow-hidden transition-colors duration-300">
        {activeSessionId && (() => {
          const session = sessions.find(s => s.id === activeSessionId);
          if (!session) return null;
          const entity = getEntity(session.targetId);
          if (!entity) return null;
          
          return (
            <div className="absolute inset-0 z-0 pointer-events-none">
              <div 
                className="absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-in-out"
                style={{ 
                  backgroundImage: `url(${entity.avatar})`, 
                  opacity: 1 
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-50 dark:from-slate-950 via-slate-50/80 dark:via-slate-950/80 to-slate-100/50 dark:to-slate-900/50" />
            </div>
          );
        })()}

        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none z-[1]"></div>
        
        <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur z-20">
          <div className="flex items-center gap-3">
             <button onClick={() => setMobileMenuOpen(true)} className="p-1 -ml-1">
              <Menu className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </button>
            <span className="font-bold text-lg text-slate-900 dark:text-slate-100">Otaku Verse</span>
          </div>
          {renderUsageBadge()}
        </div>

        {activeSessionId ? (
          <>
            <div className="h-16 border-b border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-20 relative">
              {(() => {
                const session = sessions.find(s => s.id === activeSessionId);
                const entity = session ? getEntity(session.targetId) : null;
                if (!entity) return null;
                return (
                  <div className="flex items-center gap-4">
                    {renderAvatar(entity.avatar, 'bg-slate-100 dark:bg-slate-800', "w-10 h-10")}
                    <div>
                      <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100 drop-shadow-md">{entity.name}</h2>
                      <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1 drop-shadow-md">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" /> 
                        {provider === 'gemini' ? 'Gemini' : provider === 'groq' ? 'Groq' : 'Mistral'} Online
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="flex gap-2">
                <button className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-full text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"><Search className="w-5 h-5" /></button>
                <button className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-full text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"><MoreVertical className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent z-10 relative">
              {sessions.find(s => s.id === activeSessionId)?.messages?.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 group ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden shadow-lg mt-1 border-2 border-slate-200/50 dark:border-slate-900/50
                    ${msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-700' : 'bg-white dark:bg-slate-800'}
                  `}>
                      {msg.role === 'user' ? (
                        userAvatar ? <img src={userAvatar} alt="User" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                      ) : (
                        (msg.avatar && msg.avatar.startsWith('http')) 
                        ? <img 
                            src={msg.avatar} 
                            alt="Bot" 
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                               e.currentTarget.style.display = 'none';
                               if (e.currentTarget.parentElement) {
                                   e.currentTarget.parentElement.innerText = '🤖';
                               }
                            }}
                          />
                        : (msg.avatar || '🤖')
                      )}
                  </div>
                  
                  <div className={`
                    flex flex-col max-w-[85%] md:max-w-[70%]
                    ${msg.role === 'user' ? 'items-end' : 'items-start'}
                  `}>
                    <div className={`
                      px-5 py-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-xl backdrop-blur-sm
                      ${msg.role === 'user' 
                        ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-sm' 
                        : 'bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 border border-slate-200/50 dark:border-slate-700/50 rounded-tl-sm'}
                    `}>
                      <FormatText text={msg.content} />
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4 z-10 relative">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">⏳</div>
                    <div className="bg-white/90 dark:bg-slate-900/90 px-4 py-3 rounded-2xl rounded-tl-sm border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-75" />
                      <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-150" />
                    </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur z-20">
              <div className="max-w-4xl mx-auto relative flex items-center gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={`Message...`}
                  disabled={provider === 'groq' && limitReached && !groqKey}
                  className="flex-1 bg-white/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-violet-500/50 placeholder-slate-400 dark:placeholder-slate-500 shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={isLoading || (provider === 'groq' && limitReached && !groqKey)}
                  className="p-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-900/20"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center bg-slate-50 dark:bg-slate-950 z-10 relative overflow-hidden transition-colors duration-300">
              <div className="absolute inset-0 z-0">
                <img 
                  key={currentBgIndex} 
                  src={GOKU_WALLPAPERS[currentBgIndex]} 
                  alt="Anime Background" 
                  loading="eager"
                  className="w-full h-full object-cover opacity-100 pointer-events-none transition-opacity duration-500"
                  onError={() => {
                    // Only retry a few times to prevent infinite loops
                    if (bgErrorCount.current < GOKU_WALLPAPERS.length) {
                        bgErrorCount.current += 1;
                        setCurrentBgIndex((prev) => (prev + 1) % GOKU_WALLPAPERS.length);
                    }
                  }}
                />
              </div>
              
              <div className="absolute inset-0 bg-slate-100/60 dark:bg-slate-950/60 z-0" />
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-24 h-24 bg-white/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-6 animate-pulse ring-1 ring-slate-200 dark:ring-slate-700 backdrop-blur-md">
                  <MessageSquare className="w-10 h-10 opacity-50 text-violet-500 dark:text-violet-400" />
                </div>
                
                <h2 className="text-4xl md:text-6xl font-black text-center mb-6">
                  <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-300 dark:via-purple-300 dark:to-pink-300 bg-clip-text text-transparent drop-shadow-md tracking-tighter">
                    Otaku Verse
                  </span>
                  <span className="block text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-200 mt-2 tracking-wide drop-shadow-md">
                    Universal Edition
                  </span>
                </h2>

                <p className="max-w-md text-slate-800 dark:text-slate-200 leading-relaxed drop-shadow-md px-4 font-medium">
                  Enter the multiverse. Chat, roleplay, and live your anime dreams with legendary characters powered by AI.
                  <br/>
                  <span className="text-sm opacity-80 mt-2 block text-slate-700 dark:text-slate-300">
                      Currently using: <span className="font-bold text-violet-700 dark:text-white uppercase">{provider}</span>
                  </span>
                </p>
             </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Settings className="w-5 h-5 text-violet-500" /> Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-6">
              
              {/* Provider Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">AI Provider</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => setProvider('gemini')}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all text-xs ${provider === 'gemini' ? 'bg-violet-100 border-violet-500 text-violet-900 dark:bg-violet-600/20 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    <Zap className="w-4 h-4" /> Gemini
                  </button>
                  <button 
                    onClick={() => setProvider('huggingface')}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all text-xs ${provider === 'huggingface' ? 'bg-yellow-100 border-yellow-500 text-yellow-900 dark:bg-yellow-600/20 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    <LayoutGrid className="w-4 h-4" /> HuggingFace
                  </button>
                  <button 
                    onClick={() => setProvider('groq')}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all text-xs ${provider === 'groq' ? 'bg-orange-100 border-orange-500 text-orange-900 dark:bg-orange-600/20 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    <Rocket className="w-4 h-4" /> Groq
                  </button>
                </div>
              </div>

              {/* Gemini Settings */}
              {provider === 'gemini' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Gemini API Key</label>
                    <input 
                      type="password" 
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Model ID</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={geminiModel}
                        onChange={(e) => setGeminiModel(e.target.value)}
                        placeholder="gemini-1.5-flash"
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:border-violet-500 focus:outline-none"
                      />
                      <button onClick={checkAvailableModels} className="px-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">Check</button>
                    </div>
                    
                    {modelCheckStatus === 'success' && availableModels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {availableModels.map(m => (
                          <button key={m} onClick={() => setGeminiModel(m)} className="px-2 py-1 text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded hover:border-violet-500 text-slate-700 dark:text-slate-300">
                            {m}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hugging Face Settings */}
              {provider === 'huggingface' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-500/30 p-3 rounded-lg text-xs text-yellow-800 dark:text-yellow-200">
                    Get a free token from <a href="https://huggingface.co/settings/tokens" target="_blank" className="underline font-bold">huggingface.co/settings/tokens</a>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Hugging Face Access Token</label>
                    <input 
                      type="password" 
                      value={hfKey}
                      onChange={(e) => setHfKey(e.target.value)}
                      placeholder="hf_..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:border-yellow-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Model Repo ID</label>
                    <input 
                      type="text" 
                      value={hfModel}
                      onChange={(e) => setHfModel(e.target.value)}
                      placeholder="mistralai/Mistral-7B-Instruct-v0.2"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:border-yellow-500 focus:outline-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">Recommended: <code>mistralai/Mistral-7B-Instruct-v0.2</code></p>
                  </div>
                </div>
              )}

              {/* Groq Settings */}
              {provider === 'groq' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <div className="bg-orange-100 dark:bg-orange-900/20 border border-orange-500/30 p-3 rounded-lg text-xs text-orange-800 dark:text-orange-200">
                    {!groqKey ? (
                      <span className="font-semibold text-orange-700 dark:text-orange-300">
                        ⚡ You are using the Free Tier (Limited to {DAILY_LIMIT} msgs/day). Add your own key below for unlimited access.
                      </span>
                    ) : (
                      <span>Using your personal API Key.</span>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Groq API Key</label>
                    <input 
                      type="password" 
                      value={groqKey}
                      onChange={(e) => setGroqKey(e.target.value)}
                      placeholder="gsk_..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Groq Model</label>
                    <input 
                      type="text" 
                      value={groqModel}
                      onChange={(e) => setGroqModel(e.target.value)}
                      placeholder="llama3-8b-8192"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:border-orange-500 focus:outline-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">Try: <code>llama3-8b-8192</code> or <code>mixtral-8x7b-32768</code></p>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Avatar URL</label>
                <input 
                  type="text" 
                  value={userAvatar}
                  onChange={(e) => setUserAvatar(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:border-slate-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end sticky bottom-0 bg-white dark:bg-slate-900 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button onClick={saveSettings} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors">Save & Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Install / Share Modal (Custom PWA Alternative) */}
      {showInstallModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-pink-500" />
             
             <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                   <Download className="w-5 h-5 text-violet-500" /> Install App
                </h3>
                <button onClick={() => setShowInstallModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                  <X className="w-5 h-5" />
                </button>
             </div>

             <div className="space-y-6">
                
                {/* 1. Copy Link Section */}
                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
                   <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Share className="w-3 h-3" /> Share Link
                   </div>
                   <div className="flex gap-2">
                      <input 
                         readOnly 
                         value={typeof window !== 'undefined' ? window.location.href : ''} 
                         className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-slate-300 truncate"
                      />
                      <button 
                        onClick={handleCopyLink}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${copied ? 'bg-green-500 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}
                      >
                         {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                         {copied ? 'Copied!' : 'Copy'}
                      </button>
                   </div>
                </div>

                {/* 2. Manual Install Instructions */}
                <div>
                   <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">How to add to Home Screen:</h4>
                   
                   <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                      
                      {/* iOS Instructions */}
                      <div className="flex gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                            <Smartphone className="w-4 h-4 text-slate-500" />
                         </div>
                         <div>
                            <span className="font-bold text-slate-900 dark:text-white block mb-0.5">iPhone / iPad (Safari)</span>
                            Tap the <Share className="w-3 h-3 inline mx-1" /> <span className="font-medium">Share</span> button in the toolbar, then scroll down and tap <span className="font-medium">&quot;Add to Home Screen&quot;</span>.
                         </div>
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800/50" />

                      {/* Android Instructions */}
                      <div className="flex gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                            <Monitor className="w-4 h-4 text-slate-500" />
                         </div>
                         <div>
                            <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Android (Chrome)</span>
                            Tap the menu icon (three dots), then select <span className="font-medium">&quot;Add to Home Screen&quot;</span> or &quot;Install App&quot;.
                         </div>
                      </div>
                   </div>
                </div>

                <div className="bg-violet-50 dark:bg-violet-900/10 p-3 rounded-lg text-xs text-violet-700 dark:text-violet-300 leading-relaxed">
                   <strong>Why install?</strong> Adding to your home screen gives you a fullscreen, app-like experience with easier access to your chats!
                </div>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}