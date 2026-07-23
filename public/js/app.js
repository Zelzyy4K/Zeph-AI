<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Zeph AI</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&display=swap" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/marked@11.1.0/marked.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        html, body { height:100%; overflow:hidden; font-family:'Inter',sans-serif; background:#0A0A0A; color:#fff; }
        #app { display:flex; height:100vh; width:100vw; overflow:hidden; }
        
        /* ── SIDEBAR: PASTI MUNCUL DI DESKTOP ── */
        #sidebar { 
            width:280px; 
            min-width:280px; 
            background:rgba(10,10,10,0.95); 
            backdrop-filter:blur(20px); 
            border-right:1px solid rgba(255,255,255,0.05); 
            display:flex !important; 
            flex-direction:column; 
            height:100vh; 
            overflow:hidden; 
            z-index:50; 
            transition:all 0.3s ease; 
            flex-shrink:0; 
            position:relative;
            transform:translateX(0) !important;
        }
        #sidebar.desktop-hidden { 
            width:0 !important; 
            min-width:0 !important; 
            overflow:hidden; 
            border-right:none; 
            padding:0; 
            margin:0; 
            flex-shrink:0; 
            transform:translateX(-100%) !important;
        }
        
        @media(max-width:768px){ 
            #sidebar{ 
                position:fixed; 
                left:0; 
                top:0; 
                bottom:0; 
                transform:translateX(-100%); 
                width:280px; 
                z-index:100; 
            } 
            #sidebar.mobile-open{ transform:translateX(0) !important; } 
            #sidebar-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:99; } 
            #sidebar-overlay.active{ display:block; } 
        }
        
        #chat-area { flex:1; display:flex; flex-direction:column; height:100vh; overflow:hidden; background:#0A0A0A; min-width:0; }
        #chat-messages { flex:1; overflow-y:auto; padding:16px 20px 8px; }
        .message-group { display:flex; flex-direction:column; gap:4px; margin-bottom:14px; width:100%; }
        .message-user { align-items:flex-end; }
        .message-ai { align-items:flex-start; }
        .bubble-user { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.06); border-radius:18px 18px 4px 18px; padding:10px 16px; max-width:80%; }
        .bubble-ai { background:rgba(24,24,24,0.70); border:1px solid rgba(255,255,255,0.06); border-radius:18px 18px 18px 4px; padding:10px 16px; max-width:80%; }
        .avatar-ring { width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:center; font-weight:600; font-size:0.85rem; flex-shrink:0; }
        #chat-input-wrap { padding:10px 16px 16px; background:transparent; flex-shrink:0; min-height:60px; }
        #chat-input-inner { background:rgba(24,24,24,0.80); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.07); border-radius:20px; padding:6px 10px; display:flex; align-items:flex-end; gap:6px; }
        #chat-input-inner textarea { flex:1; background:transparent; border:none; outline:none; color:#f0f0f0; font-size:0.95rem; font-family:'Inter',sans-serif; resize:none; min-height:28px; max-height:160px; padding:6px 4px; line-height:1.5; }
        #chat-input-inner textarea::placeholder { color:#666; }
        #chat-input-inner button { background:transparent; border:none; color:#888; cursor:pointer; padding:6px 8px; border-radius:12px; transition:all 0.2s; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        #chat-input-inner button:hover { color:#fff; background:rgba(255,255,255,0.06); }
        #send-btn { background:rgba(255,255,255,0.08); color:#fff; padding:6px 14px; border-radius:14px; font-weight:500; font-size:0.85rem; gap:4px; }
        #send-btn:hover { background:rgba(255,255,255,0.16); }
        #send-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .logo-text { font-weight:700; font-size:1.2rem; background:linear-gradient(135deg,#fff 40%,#aaa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .sidebar-link { display:flex; align-items:center; gap:12px; padding:8px 14px; border-radius:12px; color:#aaa; font-size:0.9rem; transition:all 0.2s; cursor:pointer; }
        .sidebar-link:hover { background:rgba(255,255,255,0.05); color:#fff; }
        .history-item { display:flex; align-items:center; gap:10px; padding:6px 14px; border-radius:10px; color:#999; font-size:0.85rem; cursor:pointer; transition:all 0.2s; }
        .history-item:hover { background:rgba(255,255,255,0.04); color:#eee; }
        .badge-pro { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.06); border-radius:20px; padding:2px 12px; font-size:0.65rem; color:#aaa; }
        .model-select { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); border-radius:12px; color:#eee; padding:4px 12px; font-size:0.8rem; font-family:'Inter',sans-serif; outline:none; cursor:pointer; }
        .fade-in { animation:fadeIn 0.35s ease forwards; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .suggestion-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; max-width:640px; margin:18px auto 0; width:100%; }
        .suggestion-card { background:rgba(24,24,24,0.55); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.05); border-radius:14px; padding:12px 14px; text-align:center; font-size:0.85rem; color:#bbb; cursor:pointer; transition:all 0.25s; }
        .suggestion-card:hover { background:rgba(255,255,255,0.07); border-color:rgba(255,255,255,0.12); color:#fff; transform:translateY(-2px); }
        .suggestion-card .icon { font-size:1.4rem; display:block; margin-bottom:4px; }

        /* ── MOBILE ── */
        @media(max-width:768px){
            #chat-messages { padding:10px 10px 6px; }
            #chat-input-wrap { padding:6px 10px 12px; min-height:50px; }
            #chat-input-inner { padding:4px 8px; border-radius:16px; gap:4px; }
            #chat-input-inner textarea { font-size:0.85rem; min-height:20px; max-height:100px; padding:4px 2px; }
            #chat-input-inner button { padding:4px 5px; }
            #chat-input-inner button svg { width:18px; height:18px; }
            #send-btn { padding:4px 10px; font-size:0.7rem; border-radius:12px; }
            #send-btn svg { width:14px; height:14px; }
            .bubble-user, .bubble-ai { max-width:90%; padding:8px 12px; font-size:0.85rem; }
            .avatar-ring { width:26px; height:26px; font-size:0.65rem; }
            header { padding:4px 10px !important; }
            .model-select { font-size:0.65rem; padding:2px 6px; }
            .suggestion-grid { grid-template-columns:repeat(2,1fr); gap:6px; padding:0 4px; }
            .suggestion-card { padding:8px 6px; font-size:0.7rem; }
            #chat-input-wrap .text-xs { font-size:0.55rem; }
        }
        @media(max-width:480px){
            #chat-messages { padding:6px 6px 4px; }
            #chat-input-wrap { padding:4px 6px 10px; min-height:44px; }
            #chat-input-inner { padding:4px 6px; border-radius:14px; gap:3px; }
            #chat-input-inner textarea { font-size:0.8rem; min-height:18px; max-height:80px; padding:2px 2px; }
            #chat-input-inner button { padding:3px 4px; }
            #chat-input-inner button svg { width:16px; height:16px; }
            #send-btn { padding:3px 8px; font-size:0.6rem; border-radius:10px; }
            #send-btn svg { width:12px; height:12px; }
            .bubble-user, .bubble-ai { max-width:95%; padding:6px 10px; font-size:0.8rem; }
            .avatar-ring { width:22px; height:22px; font-size:0.55rem; }
        }
    </style>
</head>
<body>
<div id="app">
    <div id="sidebar-overlay"></div>
    <aside id="sidebar">
        <div class="p-4 flex items-center justify-between border-b border-white/5">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <span class="text-white font-bold text-lg">Z</span>
                </div>
                <span class="logo-text">Zeph AI</span>
            </div>
            <button id="new-chat-btn" class="p-1.5 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            </button>
        </div>
        <div class="px-3 py-3 flex-shrink-0">
            <div class="rounded-xl px-3 py-1.5 flex items-center gap-2 border border-white/5" style="background:rgba(255,255,255,0.04);">
                <svg class="w-4 h-4 text-white/30" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input id="search-chat" type="text" placeholder="Cari chat..." class="bg-transparent border-none outline-none text-white/70 text-sm w-full placeholder-white/30" />
            </div>
        </div>
        <div class="flex-1 overflow-y-auto px-2 pb-2 no-scrollbar">
            <div class="text-xs text-white/30 uppercase tracking-wider px-2 py-2">Recent</div>
            <div id="history-list" class="space-y-0.5"></div>
            <div class="text-xs text-white/30 uppercase tracking-wider px-2 py-3 mt-2">Favorites</div>
            <div id="fav-list" class="space-y-0.5"></div>
        </div>
        <div class="border-t border-white/5 p-3 flex-shrink-0 space-y-0.5">
            <div class="sidebar-link" id="settings-btn">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                Settings
            </div>
            <div class="sidebar-link" id="help-btn">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Help
            </div>
            <div class="sidebar-link" id="upgrade-btn">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                Upgrade <span class="badge-pro ml-auto">Pro</span>
            </div>
            <div class="sidebar-link" id="toggle-sidebar-btn">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
                Hide Sidebar
            </div>
        </div>
    </aside>

    <div id="chat-area">
        <header class="flex items-center justify-between px-4 py-2.5 border-b border-white/5 flex-shrink-0" style="background:#0A0A0A/80;">
            <div class="flex items-center gap-3">
                <button id="menu-toggle" class="p-1.5 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition lg:hidden">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
                <span class="logo-text text-base">Zeph AI</span>
                <select id="model-select" class="model-select">
                    <option value="llama3-70b-8192">Llama 3 70B</option>
                    <option value="mixtral-8x7b-32768" selected>Mixtral 8x7B</option>
                    <option value="gemma-7b-it">Gemma 7B</option>
                </select>
                <div class="flex items-center gap-1 ml-2">
                    <button id="export-txt" class="text-white/40 hover:text-white/70 text-xs px-2 py-1 rounded border border-white/10 transition">📄 TXT</button>
                    <button id="export-md" class="text-white/40 hover:text-white/70 text-xs px-2 py-1 rounded border border-white/10 transition">📝 MD</button>
                    <button id="import-btn" class="text-white/40 hover:text-white/70 text-xs px-2 py-1 rounded border border-white/10 transition">📂 Import</button>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button id="dark-toggle" class="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
                </button>
                <div class="avatar-ring user w-8 h-8 text-sm cursor-pointer" id="profile-btn">U</div>
            </div>
        </header>

        <div id="chat-messages">
            <div id="welcome-screen" class="flex flex-col items-center justify-center h-full text-center px-4 fade-in">
                <div class="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
                    <span class="text-4xl font-bold text-white">Z</span>
                </div>
                <h1 class="text-3xl font-semibold tracking-tight mb-2">Zeph AI</h1>
                <p class="text-white/50 text-lg mb-2">How can Zeph AI help you today?</p>
                <div class="suggestion-grid">
                    <div class="suggestion-card" data-prompt="Explain this code to me:"><span class="icon">💻</span>Explain Code</div>
                    <div class="suggestion-card" data-prompt="Write an article about "><span class="icon">✍️</span>Write Article</div>
                    <div class="suggestion-card" data-prompt="Translate this to Indonesian: "><span class="icon">🌐</span>Translate</div>
                    <div class="suggestion-card" data-prompt="Fix this bug: "><span class="icon">🐛</span>Fix Bug</div>
                    <div class="suggestion-card" data-prompt="Brainstorm ideas for "><span class="icon">💡</span>Brainstorm</div>
                    <div class="suggestion-card" data-prompt="Create a website for "><span class="icon">🌐</span>Create Website</div>
                    <div class="suggestion-card" data-prompt="Make a presentation about "><span class="icon">📊</span>Presentation</div>
                    <div class="suggestion-card" data-prompt="Summarize this PDF: "><span class="icon">📄</span>Summarize PDF</div>
                </div>
            </div>
            <div id="message-container" class="flex flex-col gap-3"></div>
        </div>

        <div id="chat-input-wrap">
            <div id="chat-input-inner">
                <button id="emoji-btn" class="text-white/40 hover:text-white/80" title="Emoji">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </button>
                <button id="upload-btn" class="text-white/40 hover:text-white/80" title="Upload file">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                </button>
                <button id="voice-btn" class="text-white/40 hover:text-white/80" title="Voice input">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                </button>
                <textarea id="chat-input" rows="1" placeholder="Tanyakan apa saja..."></textarea>
                <button id="clear-btn" class="text-white/30 hover:text-white/60" title="Clear chat">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
                <button id="send-btn" class="send-btn">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    Send
                </button>
                <button id="stop-btn" class="hidden" title="Stop generating">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                </button>
            </div>
            <div class="text-xs text-white/20 mt-2 px-1 flex justify-between">
                <span>Enter ↵ kirim · Shift+Enter baris baru</span>
                <span id="char-counter">0</span>
            </div>
        </div>
    </div>
</div>

<script src="/js/app.js"></script>
</body>
</html>
