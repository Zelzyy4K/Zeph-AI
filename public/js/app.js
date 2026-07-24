// Zeph AI - Frontend Logic (FIXED)
(function() {
    'use strict';
    const state = {
        messages: [],
        currentChatId: null,
        isGenerating: false,
        model: 'openai/gpt-oss-20b',
        history: [],
        favorites: [],
        settings: {
            theme: 'dark',
            lang: 'id',
            fontSize: 15,
            chatHistory: true,
            autoScroll: true,
            streaming: true,
            sidebarWidth: 280,
            bubbleRadius: 18,
            animSpeed: 'normal',
        }
    };
    const API_BASE = window.location.origin;
    const $ = id => document.getElementById(id);
    const sidebar = $('sidebar');
    const overlay = $('sidebar-overlay');
    const chatMessages = $('chat-messages');
    const msgContainer = $('message-container');
    const welcomeScreen = $('welcome-screen');
    const chatInput = $('chat-input');
    const sendBtn = $('send-btn');
    const stopBtn = $('stop-btn');
    const clearBtn = $('clear-btn');
    const newChatBtn = $('new-chat-btn');
    const menuToggle = $('menu-toggle');
    const modelSelect = $('model-select');
    const darkToggle = $('dark-toggle');
    const historyList = $('history-list');
    const favList = $('fav-list');
    const searchInput = $('search-chat');
    const charCounter = $('char-counter');
    const toggleSidebarBtn = $('toggle-sidebar-btn');
    const toggleSidebarLabel = $('toggle-sidebar-label');
    const toggleSidebarIcon = $('toggle-sidebar-icon');
    const CHEVRON_LEFT = 'M11 19l-7-7 7-7m8 14l-7-7 7-7'; // « collapse
    const CHEVRON_RIGHT = 'M13 5l7 7-7 7M5 5l7 7-7 7'; // » expand
    let sidebarVisible = true;
    let activeController = null; // AbortController untuk membatalkan request AI yang sedang berjalan

    function uid(){ return Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7); }
    function escapeHtml(text){ const d=document.createElement('div'); d.textContent=text; return d.innerHTML; }
    function formatTime(ts){ return new Date(ts).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); }
    function truncate(str,n=40){ return str.length>n?str.slice(0,n)+'…':str; }
    function countWords(text){ return text.split(/\s+/).filter(w=>w.length>0).length; }
    function countTokens(text){ return Math.round(countWords(text)*1.3); }
    function renderMarkdown(text){ try{ const raw=marked.parse(text||''); return DOMPurify.sanitize(raw,{ADD_TAGS:['code','pre','span'],ADD_ATTR:['class','style']}); }catch{ return escapeHtml(text); } }
    function highlightCodeBlocks(container){ container.querySelectorAll('pre code').forEach(block=>{ try{ hljs.highlightElement(block); }catch{} }); }
    function saveState(){ try{ localStorage.setItem('zeph_state',JSON.stringify({ messages:state.messages, history:state.history, favorites:state.favorites, currentChatId:state.currentChatId, model:state.model, settings:state.settings })); }catch{} }
    function loadState(){ try{ const raw=localStorage.getItem('zeph_state'); if(!raw) return false; const data=JSON.parse(raw); state.messages=data.messages||[]; state.history=data.history||[]; state.favorites=data.favorites||[]; state.currentChatId=data.currentChatId||null; state.model=data.model||'openai/gpt-oss-20b'; state.settings={...state.settings,...(data.settings||{})}; return true; }catch{ return false; } }

    // ── APPLY SETTINGS ──
    // NOTE: this function themes elements that must already exist in the DOM.
    // Always call renderMessages()/renderAll() BEFORE applySettings() whenever
    // messages/history were just (re)rendered, otherwise the freshly created
    // elements won't receive the theme colors and will look wrong until the
    // next settings change.
    function applySettings(){
        if(state.settings.theme === 'light'){
            document.body.classList.add('light-mode');
            document.body.style.background = '#f5f5f5';
            document.body.style.color = '#111';

            // Chat area
            const chatArea = document.getElementById('chat-area');
            if(chatArea) chatArea.style.background = '#f5f5f5';

            // Sidebar
            if(sidebar) {
                sidebar.style.background = 'rgba(245,245,245,0.95)';
                sidebar.style.borderColor = 'rgba(0,0,0,0.05)';
            }

            // Header
            const header = document.querySelector('header');
            if(header) {
                header.style.background = 'rgba(245,245,245,0.9)';
                header.style.borderColor = 'rgba(0,0,0,0.05)';
            }
            document.querySelectorAll('header .text-white, header .text-white\\/40, header .text-white\\/60, header .logo-text, header .model-select').forEach(el => {
                if(el) el.style.color = '#111';
            });

            // Model select
            const modelSel = document.querySelector('.model-select');
            if(modelSel) {
                modelSel.style.color = '#111';
                modelSel.style.background = 'rgba(0,0,0,0.04)';
                modelSel.style.borderColor = 'rgba(0,0,0,0.06)';
            }

            // Sidebar text
            document.querySelectorAll('.sidebar-link, .history-item, .logo-text, .badge-pro, .text-white, .text-white\\/70, .text-white\\/30, .text-white\\/20, .text-xs').forEach(el => {
                if(el) el.style.color = '#111';
            });
            document.querySelectorAll('.history-item .text-white\\/30').forEach(el => {
                if(el) el.style.color = '#888';
            });
            document.querySelectorAll('.badge-pro').forEach(el => {
                if(el) {
                    el.style.color = '#555';
                    el.style.background = 'rgba(0,0,0,0.05)';
                    el.style.borderColor = 'rgba(0,0,0,0.06)';
                }
            });

            // Welcome screen
            document.querySelectorAll('#welcome-screen h1, #welcome-screen .text-3xl, #welcome-screen .text-white, #welcome-screen .text-white\\/50, #welcome-screen p, #welcome-screen .text-lg').forEach(el => {
                if(el) {
                    if(el.classList.contains('text-white') || el.classList.contains('text-white/50') || el.classList.contains('text-lg') || el.tagName === 'H1' || el.tagName === 'P') {
                        el.style.color = '#111';
                    }
                }
            });

            // Suggestion cards
            document.querySelectorAll('.suggestion-card').forEach(el => {
                if(el) {
                    el.style.color = '#333';
                    el.style.background = 'rgba(255,255,255,0.6)';
                    el.style.borderColor = 'rgba(0,0,0,0.06)';
                }
            });

            // Input
            const inputInner = document.getElementById('chat-input-inner');
            if(inputInner) {
                inputInner.style.background = 'rgba(255,255,255,0.8)';
                inputInner.style.borderColor = 'rgba(0,0,0,0.06)';
            }
            const textarea = document.querySelector('#chat-input-inner textarea');
            if(textarea) {
                textarea.style.color = '#111';
                textarea.style.background = 'transparent';
            }

            // Input buttons
            document.querySelectorAll('#chat-input-inner button').forEach(el => {
                if(el) el.style.color = '#666';
            });

            // Send button
            const sendBtnEl = document.getElementById('send-btn');
            if(sendBtnEl) {
                sendBtnEl.style.color = '#111';
                sendBtnEl.style.background = 'rgba(0,0,0,0.06)';
            }

            // Bubble user
            document.querySelectorAll('.bubble-user').forEach(el => {
                if(el) {
                    el.style.background = 'rgba(0,0,0,0.05)';
                    el.style.borderColor = 'rgba(0,0,0,0.08)';
                    el.style.color = '#111';
                }
            });

            // Bubble AI
            document.querySelectorAll('.bubble-ai').forEach(el => {
                if(el) {
                    el.style.background = 'rgba(255,255,255,0.8)';
                    el.style.borderColor = 'rgba(0,0,0,0.06)';
                    el.style.color = '#111';
                }
            });
            document.querySelectorAll('.bubble-ai .markdown-body').forEach(el => {
                if(el) el.style.color = '#111';
            });
            document.querySelectorAll('.bubble-ai .markdown-body code, .bubble-ai .markdown-body pre').forEach(el => {
                if(el) {
                    el.style.color = '#111';
                    el.style.background = '#f0f0f0';
                }
            });

            // Bubble timestamps
            document.querySelectorAll('.bubble-user .text-white\\/20, .bubble-ai .text-white\\/20, .text-white\\/20').forEach(el => {
                if(el) el.style.color = '#999';
            });

            // Avatar
            document.querySelectorAll('.avatar-ring').forEach(el => {
                if(el) {
                    el.style.background = 'rgba(0,0,0,0.05)';
                    el.style.borderColor = 'rgba(0,0,0,0.06)';
                    el.style.color = '#111';
                }
            });

            // Char counter
            const counter = document.getElementById('char-counter');
            if(counter) counter.style.color = '#888';

            // History
            document.querySelectorAll('.history-item').forEach(el => {
                if(el) el.style.color = '#444';
            });

            // Toggle sidebar button
            const toggleBtn = document.getElementById('toggle-sidebar-btn');
            if(toggleBtn) toggleBtn.style.color = '#444';

        } else {
            // ── DARK MODE ──
            document.body.classList.remove('light-mode');
            document.body.style.background = '#0A0A0A';
            document.body.style.color = '#FFFFFF';

            const chatArea = document.getElementById('chat-area');
            if(chatArea) chatArea.style.background = '#0A0A0A';

            if(sidebar) {
                sidebar.style.background = 'rgba(10,10,10,0.95)';
                sidebar.style.borderColor = 'rgba(255,255,255,0.05)';
            }

            const header = document.querySelector('header');
            if(header) {
                header.style.background = 'rgba(10,10,10,0.8)';
                header.style.borderColor = 'rgba(255,255,255,0.05)';
            }
            document.querySelectorAll('header .text-white, header .text-white\\/40, header .text-white\\/60, header .logo-text, header .model-select').forEach(el => {
                if(el) {
                    el.style.color = '#FFFFFF';
                    if(el.classList.contains('logo-text')) {
                        el.style.color = '';
                    }
                }
            });

            const modelSel = document.querySelector('.model-select');
            if(modelSel) {
                modelSel.style.color = '#eee';
                modelSel.style.background = 'rgba(255,255,255,0.04)';
                modelSel.style.borderColor = 'rgba(255,255,255,0.06)';
            }

            document.querySelectorAll('.sidebar-link, .history-item, .logo-text, .badge-pro, .text-white, .text-white\\/70, .text-white\\/30, .text-white\\/20, .text-xs').forEach(el => {
                if(el) {
                    el.style.color = '';
                    if(el.classList.contains('badge-pro')) {
                        el.style.color = '#aaa';
                        el.style.background = 'rgba(255,255,255,0.06)';
                        el.style.borderColor = 'rgba(255,255,255,0.06)';
                    }
                }
            });
            document.querySelectorAll('.badge-pro').forEach(el => {
                if(el) {
                    el.style.color = '#aaa';
                    el.style.background = 'rgba(255,255,255,0.06)';
                    el.style.borderColor = 'rgba(255,255,255,0.06)';
                }
            });

            document.querySelectorAll('#welcome-screen h1, #welcome-screen .text-3xl, #welcome-screen .text-white, #welcome-screen .text-white\\/50, #welcome-screen p, #welcome-screen .text-lg').forEach(el => {
                if(el) {
                    el.style.color = '';
                    if(el.classList.contains('text-white/50')) {
                        el.style.color = 'rgba(255,255,255,0.5)';
                    }
                }
            });

            document.querySelectorAll('.suggestion-card').forEach(el => {
                if(el) {
                    el.style.color = '';
                    el.style.background = '';
                    el.style.borderColor = '';
                }
            });

            const inputInner = document.getElementById('chat-input-inner');
            if(inputInner) {
                inputInner.style.background = 'rgba(24,24,24,0.80)';
                inputInner.style.borderColor = 'rgba(255,255,255,0.07)';
            }
            const textarea = document.querySelector('#chat-input-inner textarea');
            if(textarea) {
                textarea.style.color = '#f0f0f0';
                textarea.style.background = 'transparent';
            }

            document.querySelectorAll('#chat-input-inner button').forEach(el => {
                if(el) el.style.color = '#888';
            });

            const sendBtnEl = document.getElementById('send-btn');
            if(sendBtnEl) {
                sendBtnEl.style.color = '#fff';
                sendBtnEl.style.background = 'rgba(255,255,255,0.08)';
            }

            document.querySelectorAll('.bubble-user').forEach(el => {
                if(el) {
                    el.style.background = 'rgba(255,255,255,0.08)';
                    el.style.borderColor = 'rgba(255,255,255,0.06)';
                    el.style.color = '#FFFFFF';
                }
            });

            document.querySelectorAll('.bubble-ai').forEach(el => {
                if(el) {
                    el.style.background = 'rgba(24,24,24,0.70)';
                    el.style.borderColor = 'rgba(255,255,255,0.06)';
                    el.style.color = '#FFFFFF';
                }
            });
            document.querySelectorAll('.bubble-ai .markdown-body').forEach(el => {
                if(el) el.style.color = '#e8e8e8';
            });
            document.querySelectorAll('.bubble-ai .markdown-body code, .bubble-ai .markdown-body pre').forEach(el => {
                if(el) {
                    el.style.color = '';
                    el.style.background = '';
                }
            });

            document.querySelectorAll('.bubble-user .text-white\\/20, .bubble-ai .text-white\\/20, .text-white\\/20').forEach(el => {
                if(el) el.style.color = '';
            });

            document.querySelectorAll('.avatar-ring').forEach(el => {
                if(el) {
                    el.style.background = '';
                    el.style.borderColor = '';
                    el.style.color = '';
                }
            });

            const counter = document.getElementById('char-counter');
            if(counter) counter.style.color = '';

            document.querySelectorAll('.history-item').forEach(el => {
                if(el) el.style.color = '';
            });

            const toggleBtn = document.getElementById('toggle-sidebar-btn');
            if(toggleBtn) toggleBtn.style.color = '';
        }

        // FONT SIZE
        document.documentElement.style.fontSize = state.settings.fontSize + 'px';

        // SIDEBAR WIDTH
        if(sidebarVisible){
            sidebar.style.width = state.settings.sidebarWidth + 'px';
            sidebar.style.minWidth = state.settings.sidebarWidth + 'px';
        }

        // ANIMATION SPEED
        const speed = state.settings.animSpeed;
        const dur = speed==='fast'?'0.15s':speed==='slow'?'0.6s':'0.3s';
        document.querySelectorAll('.fade-in, .sidebar, .settings-overlay').forEach(el=>el.style.transitionDuration=dur);

        updateDarkToggleIcon();
        saveState();
    }

    function updateDarkToggleIcon() {
        const icon = darkToggle?.querySelector('svg');
        if(icon) {
            if(state.settings.theme === 'light') {
                icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>`;
            } else {
                icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>`;
            }
        }
    }

    function addHistory(chatId,title,lastMsg){ if(!state.settings.chatHistory) return; const existing=state.history.find(h=>h.id===chatId); if(existing){ existing.lastMessage=lastMsg; existing.updated=Date.now(); }else{ state.history.unshift({id:chatId,title,lastMessage:lastMsg,updated:Date.now()}); } saveState(); renderAll(); }
    function deleteHistory(chatId){ state.history=state.history.filter(h=>h.id!==chatId); state.favorites=state.favorites.filter(id=>id!==chatId); if(state.currentChatId===chatId){ state.messages=[]; state.currentChatId=null; renderMessages(); } saveState(); renderAll(); }
    function toggleFavorite(chatId){ const idx=state.favorites.indexOf(chatId); if(idx>-1) state.favorites.splice(idx,1); else state.favorites.push(chatId); saveState(); renderAll(); }
    function getChatTitle(chatId){ const h=state.history.find(h=>h.id===chatId); return h?h.title:'Chat baru'; }
    function renderAll(){ renderHistory(); renderFavorites(); }
    function renderHistory(){ if(!historyList) return; const search=searchInput.value.toLowerCase(); let items=state.history; if(search){ items=items.filter(h=>h.title.toLowerCase().includes(search)||(h.lastMessage&&h.lastMessage.toLowerCase().includes(search))); } if(items.length===0){ historyList.innerHTML=`<div class="text-white/20 text-xs text-center py-4">${search?'Tidak ditemukan':'Belum ada chat'}</div>`; return; } historyList.innerHTML=items.map(h=>{const isFav=state.favorites.includes(h.id); const isActive=h.id===state.currentChatId; return `<div class="history-item ${isActive?'bg-white/5 text-white':''}" data-id="${h.id}"><span class="text-white/30 text-sm">${isFav?'⭐':'💬'}</span><span class="flex-1 truncate">${escapeHtml(h.title)}</span><div class="actions flex gap-1"><button data-action="fav" data-id="${h.id}" class="text-white/30 hover:text-white/60 text-xs bg-transparent border-none cursor-pointer">${isFav?'★':'☆'}</button><button data-action="delete" data-id="${h.id}" class="text-white/30 hover:text-white/60 text-xs bg-transparent border-none cursor-pointer">✕</button></div></div>`;}).join(''); historyList.querySelectorAll('.history-item').forEach(el=>{const id=el.dataset.id; el.addEventListener('click',(e)=>{if(e.target.closest('.actions')) return; loadChat(id);}); const favBtn=el.querySelector('[data-action="fav"]'); if(favBtn) favBtn.addEventListener('click',e=>{e.stopPropagation(); toggleFavorite(id);}); const delBtn=el.querySelector('[data-action="delete"]'); if(delBtn) delBtn.addEventListener('click',e=>{e.stopPropagation(); if(confirm('Hapus chat ini?')) deleteHistory(id);}); }); }
    function renderFavorites(){ if(!favList) return; const favs=state.favorites; if(favs.length===0){ favList.innerHTML=`<div class="history-item text-white/30 italic text-xs">Belum ada favorit</div>`; return; } favList.innerHTML=favs.map(id=>{const h=state.history.find(h=>h.id===id); if(!h) return ''; return `<div class="history-item" data-id="${id}"><span class="text-yellow-500/60 text-sm">⭐</span><span class="flex-1 truncate">${escapeHtml(h.title)}</span><div class="actions"><button data-action="unfav" data-id="${id}" class="text-white/30 hover:text-white/60 text-xs bg-transparent border-none cursor-pointer">✕</button></div></div>`;}).join(''); favList.querySelectorAll('.history-item').forEach(el=>{const id=el.dataset.id; el.addEventListener('click',e=>{if(e.target.closest('.actions')) return; loadChat(id);}); const unfav=el.querySelector('[data-action="unfav"]'); if(unfav) unfav.addEventListener('click',e=>{e.stopPropagation(); toggleFavorite(id);}); }); }
    function loadChat(chatId){ const saved=localStorage.getItem(`zeph_chat_${chatId}`); if(saved){ try{ state.messages=JSON.parse(saved); }catch{ state.messages=[]; } }else{ state.messages=[]; } state.currentChatId=chatId; renderMessages(); renderAll(); saveState(); }
    function saveChatMessages(){ if(state.currentChatId){ localStorage.setItem(`zeph_chat_${state.currentChatId}`,JSON.stringify(state.messages)); } }
    function renderMessages(){ if(!msgContainer) return; const hasMessages=state.messages.length>0; if(!hasMessages){ welcomeScreen.style.display='flex'; msgContainer.innerHTML=''; return; } welcomeScreen.style.display='none'; let html=''; state.messages.forEach((msg,idx)=>{const isUser=msg.role==='user'; const avatar=isUser?'U':'Z'; const avatarClass=isUser?'user':'ai'; const bubbleClass=isUser?'bubble-user':'bubble-ai'; const radius=state.settings.bubbleRadius||18; const content=isUser?escapeHtml(msg.content):renderMarkdown(msg.content); const tokenCount=countTokens(msg.content); const wordCount=countWords(msg.content); html+=`<div class="message-group ${isUser?'message-user':'message-ai'} fade-in" data-id="${msg.id||idx}"><div class="flex ${isUser?'flex-row-reverse':'flex-row'} gap-2.5 w-full"><div class="avatar-ring ${avatarClass}">${avatar}</div><div class="${bubbleClass}" style="border-radius:${radius}px;">${content}<div class="text-[10px] text-white/20 mt-1 flex items-center gap-3 flex-wrap"><span>${formatTime(msg.timestamp||Date.now())}</span><span>${wordCount} kata · ${tokenCount} token</span></div></div></div></div>`;}); msgContainer.innerHTML=html; highlightCodeBlocks(msgContainer); msgContainer.querySelectorAll('pre code').forEach((block)=>{const pre=block.closest('pre'); if(!pre) return; const btn=document.createElement('button'); btn.className='absolute top-2 right-2 text-xs text-white/30 hover:text-white/70 bg-black/40 px-2 py-1 rounded border border-white/10 transition'; btn.textContent='Copy'; btn.style.position='absolute'; btn.style.top='8px'; btn.style.right='8px'; pre.style.position='relative'; pre.appendChild(btn); btn.addEventListener('click',()=>{const code=block.textContent||''; navigator.clipboard.writeText(code).then(()=>{btn.textContent='✓'; setTimeout(()=>btn.textContent='Copy',1500);}).catch(()=>{});});}); if(state.settings.autoScroll){ setTimeout(()=>{ chatMessages.scrollTop=chatMessages.scrollHeight; },50); } saveChatMessages(); saveState(); }
    // Only sets the chat title ONCE, when the chat is first created — it no longer
    // gets overwritten with every new message sent in that conversation.
    async function sendMessage(text,isEdit=false){
        if(!text||!text.trim()) return;
        const content=text.trim();
        const isNewChat = !state.currentChatId;
        if(isNewChat){
            state.currentChatId=uid();
            const title=truncate(content,40);
            addHistory(state.currentChatId,title,content);
        }
        const userMsg={id:uid(),role:'user',content:content,timestamp:Date.now()};
        state.messages.push(userMsg);
        const h=state.history.find(h=>h.id===state.currentChatId);
        if(h){ h.lastMessage=content; h.updated=Date.now(); }
        renderMessages();
        chatInput.value='';
        chatInput.style.height='auto';
        charCounter.textContent='0';
        saveState();
        if(!isEdit) await callAI(content);
    }

    // ── AI CALL (dengan dukungan pembatalan lewat AbortController) ──
    async function callAI(userContent){
        if(state.isGenerating) return;
        state.isGenerating=true;
        sendBtn.disabled=true;
        stopBtn.classList.remove('hidden');
        activeController = new AbortController();
        const aiMsg={id:uid(),role:'ai',content:'',timestamp:Date.now()};
        state.messages.push(aiMsg);
        renderMessages();
        try{
            // PENTING: pesan AI disimpan sebagai role:'ai' untuk keperluan UI,
            // tapi Groq/OpenAI API cuma mengenal 'system' | 'user' | 'assistant'.
            // Tanpa mapping ini, giliran chat kedua dan seterusnya akan gagal
            // karena riwayat berisi role yang tidak dikenali API.
            const chatHistory=state.messages.filter(m=>m.content).map(m=>({role:m.role==='user'?'user':'assistant',content:m.content}));
            const response=await fetch(`${API_BASE}/api/chat`,{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({messages:chatHistory,model:state.model,stream:state.settings.streaming!==false}),
                signal: activeController.signal
            });
            if(!response.ok){
                const errorData=await response.json().catch(()=>({}));
                throw new Error(errorData.error||`HTTP ${response.status}`);
            }
            if(state.settings.streaming!==false){
                const reader=response.body.getReader();
                const decoder=new TextDecoder();
                let fullText='';
                let done=false;
                while(!done){
                    const {value,done:doneReading}=await reader.read();
                    done=doneReading;
                    if(done) break;
                    const chunk=decoder.decode(value,{stream:true});
                    const lines=chunk.split('\n').filter(line=>line.startsWith('data: '));
                    for(const line of lines){
                        const data=line.slice(6).trim();
                        if(data==='[DONE]') continue;
                        try{
                            const json=JSON.parse(data);
                            if(json.content){
                                fullText+=json.content;
                                aiMsg.content=fullText;
                                renderMessages();
                                if(state.settings.autoScroll) chatMessages.scrollTop=chatMessages.scrollHeight;
                            }
                        }catch{}
                    }
                }
                if(fullText==='') aiMsg.content='[Tidak ada respons dari AI]';
            }else{
                const data=await response.json();
                aiMsg.content=data.content||'[Tidak ada respons]';
            }
            renderMessages();
        }catch(error){
            if(error.name === 'AbortError'){
                if(!aiMsg.content) aiMsg.content='[Dihentikan oleh pengguna]';
            }else{
                console.error('AI Error:',error);
                aiMsg.content=`❌ Terjadi kesalahan: ${error.message||'Silakan coba lagi.'}`;
            }
            renderMessages();
        }finally{
            activeController = null;
            state.isGenerating=false;
            sendBtn.disabled=false;
            stopBtn.classList.add('hidden');
            const h=state.history.find(h=>h.id===state.currentChatId);
            if(h){ h.lastMessage=aiMsg.content||userContent; h.updated=Date.now(); }
            saveChatMessages();
            saveState();
            renderAll();
            renderMessages();
            if(state.settings.autoScroll) chatMessages.scrollTop=chatMessages.scrollHeight;
        }
    }

    function newChat(){ state.messages=[]; state.currentChatId=null; renderMessages(); chatInput.value=''; charCounter.textContent='0'; chatInput.style.height='auto'; saveState(); chatInput.focus(); }
    // Sidebar toggle label kept fully in Bahasa Indonesia to match the rest of the app.
    function toggleSidebar(){
        if(window.innerWidth<=768){
            sidebar.classList.toggle('mobile-open');
            overlay.classList.toggle('active');
            return;
        }
        sidebarVisible=!sidebarVisible;
        if(sidebarVisible){
            sidebar.classList.remove('desktop-hidden');
            sidebar.style.width=state.settings.sidebarWidth+'px';
            sidebar.style.minWidth=state.settings.sidebarWidth+'px';
            sidebar.style.overflow='hidden';
            sidebar.style.borderRight='1px solid rgba(255,255,255,0.05)';
            if(toggleSidebarLabel) toggleSidebarLabel.textContent='Sembunyikan';
            if(toggleSidebarIcon) toggleSidebarIcon.innerHTML=`<path stroke-linecap="round" stroke-linejoin="round" d="${CHEVRON_LEFT}"/>`;
        }else{
            sidebar.classList.add('desktop-hidden');
            sidebar.style.width='0';
            sidebar.style.minWidth='0';
            sidebar.style.overflow='hidden';
            sidebar.style.borderRight='none';
            if(toggleSidebarLabel) toggleSidebarLabel.textContent='Tampilkan';
            if(toggleSidebarIcon) toggleSidebarIcon.innerHTML=`<path stroke-linecap="round" stroke-linejoin="round" d="${CHEVRON_RIGHT}"/>`;
        }
    }
    function closeSidebarMobile(){ if(window.innerWidth<=768){ sidebar.classList.remove('mobile-open'); overlay.classList.remove('active'); } }
    function exportChat(format){ if(!state.currentChatId||state.messages.length===0){ alert('Tidak ada chat yang aktif.'); return; } const title=getChatTitle(state.currentChatId); let content=''; if(format==='txt'){ content=state.messages.map(m=>`${m.role==='user'?'User':'Zeph AI'} (${formatTime(m.timestamp)}):\n${m.content}\n`).join('\n'); }else if(format==='md'){ content=`# ${title}\n\n`+state.messages.map(m=>`**${m.role==='user'?'User':'Zeph AI'}** (${formatTime(m.timestamp)})\n\n${m.content}\n\n`).join('---\n\n'); } const blob=new Blob([content],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${title}.${format}`; a.click(); URL.revokeObjectURL(url); }
    function importChat(){ const input=document.createElement('input'); input.type='file'; input.accept='.txt,.md'; input.onchange=(e)=>{ const file=e.target.files?.[0]; if(!file) return; const reader=new FileReader(); reader.onload=(ev)=>{ try{ const text=ev.target?.result; if(typeof text==='string'){ const lines=text.split('\n').filter(l=>l.trim()); const newMessages=[]; let currentRole='user'; let currentContent=''; for(const line of lines){ if(line.startsWith('User')||line.startsWith('Zeph AI')){ if(currentContent){ newMessages.push({role:currentRole,content:currentContent.trim(),timestamp:Date.now()}); currentContent=''; } currentRole=line.startsWith('User')?'user':'ai'; }else{ currentContent+=line+'\n'; } } if(currentContent){ newMessages.push({role:currentRole,content:currentContent.trim(),timestamp:Date.now()}); } if(newMessages.length>0){ if(!state.currentChatId) state.currentChatId=uid(); state.messages=newMessages; const title=getFirstText(newMessages[0]?.content||'Imported Chat'); addHistory(state.currentChatId,title,newMessages[0]?.content||''); renderMessages(); saveState(); renderAll(); }else{ alert('Format tidak dikenali.'); } } }catch(err){ alert('Gagal import: '+err.message); } }; reader.readAsText(file); }; input.click(); }
    function getFirstText(msg){ const plain=msg.replace(/<[^>]*>/g,''); return truncate(plain,50); }
    function openSettings(){ const overlay=document.getElementById('settings-overlay'); overlay.classList.remove('hidden'); overlay.classList.add('active'); document.getElementById('set-theme').value=state.settings.theme||'dark'; document.getElementById('set-lang').value=state.settings.lang||'id'; document.getElementById('set-fontsize').value=state.settings.fontSize||15; document.getElementById('fontsize-label').textContent=(state.settings.fontSize||15)+'px'; document.getElementById('set-history').checked=state.settings.chatHistory!==false; document.getElementById('set-autoscroll').checked=state.settings.autoScroll!==false; document.getElementById('set-streaming').checked=state.settings.streaming!==false; document.getElementById('set-sidebarwidth').value=state.settings.sidebarWidth||280; document.getElementById('set-bubbleradius').value=state.settings.bubbleRadius||18; document.getElementById('set-animspeed').value=state.settings.animSpeed||'normal'; }
    function closeSettings(){ const overlay=document.getElementById('settings-overlay'); overlay.classList.remove('active'); overlay.classList.add('hidden'); }
    // FIX: renderMessages() now runs BEFORE applySettings(). Previously applySettings()
    // ran first, then renderMessages() rebuilt the message bubbles from scratch and wiped
    // out the theme colors that were just applied — e.g. switching to Light Mode and
    // saving would leave the chat bubbles stuck in dark styling.
    function saveSettings(){
        state.settings.theme = document.getElementById('set-theme').value;
        state.settings.lang = document.getElementById('set-lang').value;
        state.settings.fontSize = parseInt(document.getElementById('set-fontsize').value);
        state.settings.chatHistory = document.getElementById('set-history').checked;
        state.settings.autoScroll = document.getElementById('set-autoscroll').checked;
        state.settings.streaming = document.getElementById('set-streaming').checked;
        state.settings.sidebarWidth = parseInt(document.getElementById('set-sidebarwidth').value);
        state.settings.bubbleRadius = parseInt(document.getElementById('set-bubbleradius').value);
        state.settings.animSpeed = document.getElementById('set-animspeed').value;
        renderMessages();
        applySettings();
        closeSettings();
        saveState();
    }
    function showHelp(){ alert('💡 Zeph AI Help\n\n• Enter untuk kirim\n• Shift+Enter untuk baris baru\n• ⭐ untuk favorit\n• Export/Import chat di header'); }
    function showUpgrade(){ alert('🚀 Upgrade ke Zeph Pro\n\n✅ Respons lebih cepat\n✅ Model Vision\n✅ Prioritas antrian\n✅ Chat tanpa batas'); }

    function toggleDarkLight() {
        state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
        applySettings();
        saveState();
        const themeSelect = document.getElementById('set-theme');
        if(themeSelect) themeSelect.value = state.settings.theme;
    }

    // FIX: renderAll()/renderMessages() now run BEFORE applySettings() on startup too,
    // for the same reason as saveSettings() above — otherwise a saved Light Mode
    // preference wouldn't be applied to the messages restored from localStorage.
    function init(){
        const hasSaved=loadState();
        modelSelect.value=state.model||'openai/gpt-oss-20b';
        renderAll();
        if(hasSaved&&state.messages.length>0) renderMessages();
        else{ welcomeScreen.style.display='flex'; msgContainer.innerHTML=''; }
        applySettings();

        sendBtn.addEventListener('click',()=>{const text=chatInput.value; if(text.trim()&&!state.isGenerating) sendMessage(text);});
        chatInput.addEventListener('keydown',(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault(); const text=chatInput.value; if(text.trim()&&!state.isGenerating) sendMessage(text);}});
        chatInput.addEventListener('input',()=>{chatInput.style.height='auto'; chatInput.style.height=Math.min(chatInput.scrollHeight,160)+'px'; charCounter.textContent=chatInput.value.length;});
        newChatBtn.addEventListener('click',newChat);
        if(menuToggle) menuToggle.addEventListener('click',toggleSidebar);
        if(toggleSidebarBtn) toggleSidebarBtn.addEventListener('click',toggleSidebar);
        if(overlay) overlay.addEventListener('click',closeSidebarMobile);
        modelSelect.addEventListener('change',()=>{state.model=modelSelect.value; saveState();});

        if(darkToggle) darkToggle.addEventListener('click', toggleDarkLight);

        clearBtn.addEventListener('click',()=>{if(state.messages.length===0) return; if(confirm('Hapus semua pesan?')){state.messages=[]; renderMessages(); saveState(); saveChatMessages();}});
        searchInput.addEventListener('input',renderAll);
        document.getElementById('profile-btn').addEventListener('click',openSettings);
        document.getElementById('settings-btn').addEventListener('click',openSettings);
        document.getElementById('settings-close').addEventListener('click',closeSettings);
        document.getElementById('settings-cancel').addEventListener('click',closeSettings);
        document.getElementById('settings-save').addEventListener('click',saveSettings);
        document.getElementById('settings-overlay').addEventListener('click',(e)=>{if(e.target===e.currentTarget) closeSettings();});
        document.getElementById('set-fontsize').addEventListener('input',(e)=>{document.getElementById('fontsize-label').textContent=e.target.value+'px';});
        document.getElementById('help-btn').addEventListener('click',showHelp);
        document.getElementById('upgrade-btn').addEventListener('click',showUpgrade);
        document.querySelectorAll('.suggestion-card').forEach(card=>{card.addEventListener('click',()=>{const prompt=card.dataset.prompt||card.textContent.trim(); chatInput.value=prompt; chatInput.style.height='auto'; chatInput.style.height=Math.min(chatInput.scrollHeight,160)+'px'; charCounter.textContent=prompt.length; chatInput.focus(); if(prompt.trim()&&!state.isGenerating) sendMessage(prompt);});});
        document.getElementById('emoji-btn').addEventListener('click',()=>{const emojis=['😊','🔥','✨','🚀','💡','🎯','📌','✅','🎉','💪','🤖','🧠']; const pick=emojis[Math.floor(Math.random()*emojis.length)]; chatInput.value+=pick; chatInput.style.height='auto'; chatInput.style.height=Math.min(chatInput.scrollHeight,160)+'px'; charCounter.textContent=chatInput.value.length; chatInput.focus();});
        document.getElementById('upload-btn').addEventListener('click',()=>{const input=document.createElement('input'); input.type='file'; input.accept='image/*,.pdf,.txt,.md'; input.click(); input.onchange=(e)=>{const file=e.target.files?.[0]; if(file){const reader=new FileReader(); reader.onload=(ev)=>{const content=ev.target?.result; if(typeof content==='string'){chatInput.value+=`\n[Upload: ${file.name}]\n${content.slice(0,200)}...`;}else{chatInput.value+=`\n[Upload: ${file.name}]`;} chatInput.style.height='auto'; chatInput.style.height=Math.min(chatInput.scrollHeight,160)+'px'; charCounter.textContent=chatInput.value.length; chatInput.focus();}; if(file.type.startsWith('text/')||file.name.endsWith('.md')||file.name.endsWith('.txt')){reader.readAsText(file);}else{chatInput.value+=`\n[Upload: ${file.name} (gambar)]`; chatInput.style.height='auto'; chatInput.style.height=Math.min(chatInput.scrollHeight,160)+'px'; charCounter.textContent=chatInput.value.length; chatInput.focus();}}};});
        document.getElementById('voice-btn').addEventListener('click',()=>{if('webkitSpeechRecognition' in window||'SpeechRecognition' in window){const SR=window.SpeechRecognition||window.webkitSpeechRecognition; const recognizer=new SR(); recognizer.lang= state.settings.lang==='en' ? 'en-US' : 'id-ID'; recognizer.interimResults=false; recognizer.onresult=(e)=>{const transcript=e.results[0][0].transcript; chatInput.value+=transcript; chatInput.style.height='auto'; chatInput.style.height=Math.min(chatInput.scrollHeight,160)+'px'; charCounter.textContent=chatInput.value.length; chatInput.focus();}; recognizer.start();}else{alert('Voice input tidak didukung di browser ini.');}});
        document.getElementById('export-txt').addEventListener('click',()=>exportChat('txt'));
        document.getElementById('export-md').addEventListener('click',()=>exportChat('md'));
        document.getElementById('import-btn').addEventListener('click',importChat);
        stopBtn.addEventListener('click',()=>{
            if(activeController) activeController.abort();
            state.isGenerating=false;
            sendBtn.disabled=false;
            stopBtn.classList.add('hidden');
        });
        document.addEventListener('keydown',(e)=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault(); newChat();} if(e.key==='Escape') closeSidebarMobile();});
        chatInput.focus();
        window.addEventListener('resize',()=>{if(window.innerWidth>768){sidebar.classList.remove('mobile-open'); overlay.classList.remove('active'); if(!sidebarVisible){sidebarVisible=true; sidebar.classList.remove('desktop-hidden'); sidebar.style.width=state.settings.sidebarWidth+'px'; sidebar.style.minWidth=state.settings.sidebarWidth+'px'; sidebar.style.overflow='hidden'; sidebar.style.borderRight='1px solid rgba(255,255,255,0.05)'; if(toggleSidebarLabel) toggleSidebarLabel.textContent='Sembunyikan'; if(toggleSidebarIcon) toggleSidebarIcon.innerHTML=`<path stroke-linecap="round" stroke-linejoin="round" d="${CHEVRON_LEFT}"/>`;}}});
        console.log('🚀 Zeph AI v2.2 ready! (theme-order fix + title fix + i18n fix)');
    }
    if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',init); }else{ init(); }
})();
