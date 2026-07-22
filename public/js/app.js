// Zeph AI - Frontend Logic (RAPIH VERSION)
(function() {
    'use strict';

    // ─── STATE ────────────────────────────────────────────────
    const state = {
        messages: [],
        currentChatId: null,
        isGenerating: false,
        model: 'mixtral-8x7b-32768',
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
            animSpeed: 'normal'
        }
    };

    const API_BASE = window.location.origin;

    // ─── DOM REFS ──────────────────────────────────────────────
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

    let sidebarVisible = true;

    // ─── UTILITIES ─────────────────────────────────────────────
    function uid() {
        return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    }

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    function formatTime(ts) {
        return new Date(ts).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function truncate(str, n = 40) {
        return str.length > n ? str.slice(0, n) + '…' : str;
    }

    function countWords(text) {
        return text.split(/\s+/).filter(w => w.length > 0).length;
    }

    function countTokens(text) {
        return Math.round(countWords(text) * 1.3);
    }

    function renderMarkdown(text) {
        try {
            const raw = marked.parse(text || '');
            return DOMPurify.sanitize(raw, {
                ADD_TAGS: ['code', 'pre', 'span'],
                ADD_ATTR: ['class', 'style']
            });
        } catch {
            return escapeHtml(text);
        }
    }

    function highlightCodeBlocks(container) {
        container.querySelectorAll('pre code').forEach(block => {
            try { hljs.highlightElement(block); } catch {}
        });
    }

    // ─── SAVE / LOAD ───────────────────────────────────────────
    function saveState() {
        try {
            localStorage.setItem('zeph_state', JSON.stringify({
                messages: state.messages,
                history: state.history,
                favorites: state.favorites,
                currentChatId: state.currentChatId,
                model: state.model,
                settings: state.settings
            }));
        } catch {}
    }

    function loadState() {
        try {
            const raw = localStorage.getItem('zeph_state');
            if (!raw) return false;
            const data = JSON.parse(raw);
            state.messages = data.messages || [];
            state.history = data.history || [];
            state.favorites = data.favorites || [];
            state.currentChatId = data.currentChatId || null;
            state.model = data.model || 'mixtral-8x7b-32768';
            state.settings = { ...state.settings, ...(data.settings || {}) };
            return true;
        } catch {
            return false;
        }
    }

    // ─── APPLY SETTINGS ────────────────────────────────────────
    function applySettings() {
        // Theme
        if (state.settings.theme === 'light') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }

        // Font Size
        document.documentElement.style.fontSize = state.settings.fontSize + 'px';

        // Sidebar Width
        if (sidebarVisible) {
            sidebar.style.width = state.settings.sidebarWidth + 'px';
            sidebar.style.minWidth = state.settings.sidebarWidth + 'px';
        }

        // Animation Speed
        const speed = state.settings.animSpeed;
        const dur = speed === 'fast' ? '0.15s' : speed === 'slow' ? '0.6s' : '0.3s';
        document.querySelectorAll('.fade-in, .sidebar, .settings-overlay').forEach(el => {
            el.style.transitionDuration = dur;
        });

        saveState();
    }

    // ─── HISTORY ───────────────────────────────────────────────
    function addHistory(chatId, title, lastMsg) {
        if (!state.settings.chatHistory) return;
        const existing = state.history.find(h => h.id === chatId);
        if (existing) {
            existing.title = title;
            existing.lastMessage = lastMsg;
            existing.updated = Date.now();
        } else {
            state.history.unshift({
                id: chatId,
                title,
                lastMessage: lastMsg,
                updated: Date.now()
            });
        }
        saveState();
        renderAll();
    }

    function deleteHistory(chatId) {
        state.history = state.history.filter(h => h.id !== chatId);
        state.favorites = state.favorites.filter(id => id !== chatId);
        if (state.currentChatId === chatId) {
            state.messages = [];
            state.currentChatId = null;
            renderMessages();
        }
        saveState();
        renderAll();
    }

    function toggleFavorite(chatId) {
        const idx = state.favorites.indexOf(chatId);
        if (idx > -1) {
            state.favorites.splice(idx, 1);
        } else {
            state.favorites.push(chatId);
        }
        saveState();
        renderAll();
    }

    function getChatTitle(chatId) {
        const h = state.history.find(h => h.id === chatId);
        return h ? h.title : 'Chat baru';
    }

    // ─── RENDER ─────────────────────────────────────────────────
    function renderAll() {
        renderHistory();
        renderFavorites();
    }

    function renderHistory() {
        if (!historyList) return;
        const search = searchInput.value.toLowerCase();
        let items = state.history;

        if (search) {
            items = items.filter(h =>
                h.title.toLowerCase().includes(search) ||
                (h.lastMessage && h.lastMessage.toLowerCase().includes(search))
            );
        }

        if (items.length === 0) {
            historyList.innerHTML =
                `<div class="text-white/20 text-xs text-center py-4">${search ? 'Tidak ditemukan' : 'Belum ada chat'}</div>`;
            return;
        }

        historyList.innerHTML = items.map(h => {
            const isFav = state.favorites.includes(h.id);
            const isActive = h.id === state.currentChatId;
            return `
                <div class="history-item ${isActive ? 'bg-white/5 text-white' : ''}" data-id="${h.id}">
                    <span class="text-white/30 text-sm">${isFav ? '⭐' : '💬'}</span>
                    <span class="flex-1 truncate">${escapeHtml(h.title)}</span>
                    <div class="actions flex gap-1">
                        <button data-action="fav" data-id="${h.id}" class="text-white/30 hover:text-white/60 text-xs bg-transparent border-none cursor-pointer">${isFav ? '★' : '☆'}</button>
                        <button data-action="delete" data-id="${h.id}" class="text-white/30 hover:text-white/60 text-xs bg-transparent border-none cursor-pointer">✕</button>
                    </div>
                </div>
            `;
        }).join('');

        historyList.querySelectorAll('.history-item').forEach(el => {
            const id = el.dataset.id;
            el.addEventListener('click', (e) => {
                if (e.target.closest('.actions')) return;
                loadChat(id);
            });

            const favBtn = el.querySelector('[data-action="fav"]');
            if (favBtn) {
                favBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    toggleFavorite(id);
                });
            }

            const delBtn = el.querySelector('[data-action="delete"]');
            if (delBtn) {
                delBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    if (confirm('Hapus chat ini?')) deleteHistory(id);
                });
            }
        });
    }

    function renderFavorites() {
        if (!favList) return;
        const favs = state.favorites;

        if (favs.length === 0) {
            favList.innerHTML =
                `<div class="history-item text-white/30 italic text-xs">Belum ada favorit</div>`;
            return;
        }

        favList.innerHTML = favs.map(id => {
            const h = state.history.find(h => h.id === id);
            if (!h) return '';
            return `
                <div class="history-item" data-id="${id}">
                    <span class="text-yellow-500/60 text-sm">⭐</span>
                    <span class="flex-1 truncate">${escapeHtml(h.title)}</span>
                    <div class="actions">
                        <button data-action="unfav" data-id="${id}" class="text-white/30 hover:text-white/60 text-xs bg-transparent border-none cursor-pointer">✕</button>
                    </div>
                </div>
            `;
        }).join('');

        favList.querySelectorAll('.history-item').forEach(el => {
            const id = el.dataset.id;
            el.addEventListener('click', e => {
                if (e.target.closest('.actions')) return;
                loadChat(id);
            });

            const unfav = el.querySelector('[data-action="unfav"]');
            if (unfav) {
                unfav.addEventListener('click', e => {
                    e.stopPropagation();
                    toggleFavorite(id);
                });
            }
        });
    }

    // ─── LOAD CHAT ──────────────────────────────────────────────
    function loadChat(chatId) {
        const saved = localStorage.getItem(`zeph_chat_${chatId}`);
        if (saved) {
            try { state.messages = JSON.parse(saved); } catch { state.messages = []; }
        } else {
            state.messages = [];
        }
        state.currentChatId = chatId;
        renderMessages();
        renderAll();
        saveState();
    }

    function saveChatMessages() {
        if (state.currentChatId) {
            localStorage.setItem(`zeph_chat_${state.currentChatId}`, JSON.stringify(state.messages));
        }
    }

    // ─── RENDER MESSAGES ────────────────────────────────────────
    function renderMessages() {
        if (!msgContainer) return;
        const hasMessages = state.messages.length > 0;

        if (!hasMessages) {
            welcomeScreen.style.display = 'flex';
            msgContainer.innerHTML = '';
            return;
        }

        welcomeScreen.style.display = 'none';
        let html = '';

        state.messages.forEach((msg, idx) => {
            const isUser = msg.role === 'user';
            const avatar = isUser ? 'U' : 'Z';
            const avatarClass = isUser ? 'user' : 'ai';
            const bubbleClass = isUser ? 'bubble-user' : 'bubble-ai';
            const radius = state.settings.bubbleRadius || 18;
            const content = isUser ? escapeHtml(msg.content) : renderMarkdown(msg.content);
            const tokenCount = countTokens(msg.content);
            const wordCount = countWords(msg.content);

            html += `
                <div class="message-group ${isUser ? 'message-user' : 'message-ai'} fade-in" data-id="${msg.id || idx}">
                    <div class="flex ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-2.5 w-full">
                        <div class="avatar-ring ${avatarClass}">${avatar}</div>
                        <div class="${bubbleClass}" style="border-radius:${radius}px;">
                            ${content}
                            <div class="text-[10px] text-white/20 mt-1 flex items-center gap-3 flex-wrap">
                                <span>${formatTime(msg.timestamp || Date.now())}</span>
                                <span>${wordCount} kata · ${tokenCount} token</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        msgContainer.innerHTML = html;
        highlightCodeBlocks(msgContainer);

        msgContainer.querySelectorAll('pre code').forEach((block) => {
            const pre = block.closest('pre');
            if (!pre) return;

            const btn = document.createElement('button');
            btn.className =
                'absolute top-2 right-2 text-xs text-white/30 hover:text-white/70 bg-black/40 px-2 py-1 rounded border border-white/10 transition';
            btn.textContent = 'Copy';
            btn.style.position = 'absolute';
            btn.style.top = '8px';
            btn.style.right = '8px';
            pre.style.position = 'relative';
            pre.appendChild(btn);

            btn.addEventListener('click', () => {
                const code = block.textContent || '';
                navigator.clipboard.writeText(code).then(() => {
                    btn.textContent = '✓';
                    setTimeout(() => btn.textContent = 'Copy', 1500);
                }).catch(() => {});
            });
        });

        if (state.settings.autoScroll) {
            setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 50);
        }

        saveChatMessages();
        saveState();
    }

    // ─── SEND MESSAGE ───────────────────────────────────────────
    async function sendMessage(text, isEdit = false) {
        if (!text || !text.trim()) return;
        const content = text.trim();

        if (!state.currentChatId) {
            state.currentChatId = uid();
            const title = truncate(content, 40);
            addHistory(state.currentChatId, title, content);
        }

        const userMsg = {
            id: uid(),
            role: 'user',
            content: content,
            timestamp: Date.now()
        };
        state.messages.push(userMsg);

        const h = state.history.find(h => h.id === state.currentChatId);
        if (h) {
            h.title = truncate(content, 40);
            h.lastMessage = content;
            h.updated = Date.now();
        }

        renderMessages();
        chatInput.value = '';
        chatInput.style.height = 'auto';
        charCounter.textContent = '0';
        saveState();

        if (!isEdit) await callAI(content);
    }

    // ─── CALL AI ─────────────────────────────────────────────────
    async function callAI(userContent) {
        if (state.isGenerating) return;
        state.isGenerating = true;
        sendBtn.disabled = true;
        stopBtn.classList.remove('hidden');

        const aiMsg = {
            id: uid(),
            role: 'ai',
            content: '',
            timestamp: Date.now()
        };
        state.messages.push(aiMsg);
        renderMessages();

        try {
            const chatHistory = state.messages
                .filter(m => m.content)
                .map(m => ({ role: m.role, content: m.content }));

            const response = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: chatHistory,
                    model: state.model,
                    stream: state.settings.streaming !== false
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            if (state.settings.streaming !== false) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullText = '';
                let done = false;

                while (!done) {
                    const { value, done: doneReading } = await reader.read();
                    done = doneReading;
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

                    for (const line of lines) {
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') continue;
                        try {
                            const json = JSON.parse(data);
                            if (json.content) {
                                fullText += json.content;
                                aiMsg.content = fullText;
                                renderMessages();
                                if (state.settings.autoScroll) {
                                    chatMessages.scrollTop = chatMessages.scrollHeight;
                                }
                            }
                        } catch {}
                    }
                }

                if (fullText === '') {
                    aiMsg.content = '[Tidak ada respons dari AI]';
                }
            } else {
                const data = await response.json();
                aiMsg.content = data.content || '[Tidak ada respons]';
            }

            renderMessages();

        } catch (error) {
            console.error('AI Error:', error);
            aiMsg.content = `❌ Terjadi kesalahan: ${error.message || 'Silakan coba lagi.'}`;
            renderMessages();
        } finally {
            state.isGenerating = false;
            sendBtn.disabled = false;
            stopBtn.classList.add('hidden');

            const h = state.history.find(h => h.id === state.currentChatId);
            if (h) {
                h.lastMessage = aiMsg.content || userContent;
                h.updated = Date.now();
            }

            saveChatMessages();
            saveState();
            renderAll();
            renderMessages();

            if (state.settings.autoScroll) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
    }

    // ─── NEW CHAT ────────────────────────────────────────────────
    function newChat() {
        state.messages = [];
        state.currentChatId = null;
        renderMessages();
        chatInput.value = '';
        charCounter.textContent = '0';
        chatInput.style.height = 'auto';
        saveState();
        chatInput.focus();
    }

    // ─── SIDEBAR TOGGLE ─────────────────────────────────────────
    function toggleSidebar() {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('mobile-open');
            overlay.classList.toggle('active');
        } else {
            sidebarVisible = !sidebarVisible;

            if (sidebarVisible) {
                sidebar.classList.remove('desktop-hidden');
                sidebar.style.width = state.settings.sidebarWidth + 'px';
                sidebar.style.minWidth = state.settings.sidebarWidth + 'px';
                sidebar.style.overflow = 'hidden';
                sidebar.style.borderRight = '1px solid rgba(255,255,255,0.05)';
                document.getElementById('toggle-sidebar-btn').innerHTML = `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                    </svg>
                    Hide Sidebar
                `;
            } else {
                sidebar.classList.add('desktop-hidden');
                sidebar.style.width = '0';
                sidebar.style.minWidth = '0';
                sidebar.style.overflow = 'hidden';
                sidebar.style.borderRight = 'none';
                document.getElementById('toggle-sidebar-btn').innerHTML = `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                    </svg>
                    Show Sidebar
                `;
            }
        }
    }

    function closeSidebarMobile() {
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
        }
    }

    // ─── EXPORT / IMPORT ─────────────────────────────────────────
    function exportChat(format) {
        if (!state.currentChatId || state.messages.length === 0) {
            alert('Tidak ada chat yang aktif.');
            return;
        }

        const title = getChatTitle(state.currentChatId);
        let content = '';

        if (format === 'txt') {
            content = state.messages.map(m =>
                `${m.role === 'user' ? 'User' : 'Zeph AI'} (${formatTime(m.timestamp)}):\n${m.content}\n`
            ).join('\n');
        } else if (format === 'md') {
            content = `# ${title}\n\n` +
                state.messages.map(m =>
                    `**${m.role === 'user' ? 'User' : 'Zeph AI'}** (${formatTime(m.timestamp)})\n\n${m.content}\n\n`
                ).join('---\n\n');
        }

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function importChat() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.md';

        input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const text = ev.target?.result;
                    if (typeof text === 'string') {
                        const lines = text.split('\n').filter(l => l.trim());
                        const newMessages = [];
                        let currentRole = 'user';
                        let currentContent = '';

                        for (const line of lines) {
                            if (line.startsWith('User') || line.startsWith('Zeph AI')) {
                                if (currentContent) {
                                    newMessages.push({
                                        role: currentRole,
                                        content: currentContent.trim(),
                                        timestamp: Date.now()
                                    });
                                    currentContent = '';
                                }
                                currentRole = line.startsWith('User') ? 'user' : 'ai';
                            } else {
                                currentContent += line + '\n';
                            }
                        }

                        if (currentContent) {
                            newMessages.push({
                                role: currentRole,
                                content: currentContent.trim(),
                                timestamp: Date.now()
                            });
                        }

                        if (newMessages.length > 0) {
                            if (!state.currentChatId) state.currentChatId = uid();
                            state.messages = newMessages;
                            const title = getFirstText(newMessages[0]?.content || 'Imported Chat');
                            addHistory(state.currentChatId, title, newMessages[0]?.content || '');
                            renderMessages();
                            saveState();
                            renderAll();
                        } else {
                            alert('Format tidak dikenali.');
                        }
                    }
                } catch (err) {
                    alert('Gagal import: ' + err.message);
                }
            };
            reader.readAsText(file);
        };

        input.click();
    }

    function getFirstText(msg) {
        const plain = msg.replace(/<[^>]*>/g, '');
        return truncate(plain, 50);
    }

    // ─── SETTINGS ─────────────────────────────────────────────────
    function openSettings() {
        const overlay = document.getElementById('settings-overlay');
        overlay.classList.add('active');

        document.getElementById('set-theme').value = state.settings.theme || 'dark';
        document.getElementById('set-lang').value = state.settings.lang || 'id';
        document.getElementById('set-fontsize').value = state.settings.fontSize || 15;
        document.getElementById('fontsize-label').textContent = (state.settings.fontSize || 15) + 'px';
        document.getElementById('set-history').checked = state.settings.chatHistory !== false;
        document.getElementById('set-autoscroll').checked = state.settings.autoScroll !== false;
        document.getElementById('set-streaming').checked = state.settings.streaming !== false;
        document.getElementById('set-sidebarwidth').value = state.settings.sidebarWidth || 280;
        document.getElementById('set-bubbleradius').value = state.settings.bubbleRadius || 18;
        document.getElementById('set-animspeed').value = state.settings.animSpeed || 'normal';
    }

    function closeSettings() {
        document.getElementById('settings-overlay').classList.remove('active');
    }

    function saveSettings() {
        state.settings.theme = document.getElementById('set-theme').value;
        state.settings.lang = document.getElementById('set-lang').value;
        state.settings.fontSize = parseInt(document.getElementById('set-fontsize').value);
        state.settings.chatHistory = document.getElementById('set-history').checked;
        state.settings.autoScroll = document.getElementById('set-autoscroll').checked;
        state.settings.streaming = document.getElementById('set-streaming').checked;
        state.settings.sidebarWidth = parseInt(document.getElementById('set-sidebarwidth').value);
        state.settings.bubbleRadius = parseInt(document.getElementById('set-bubbleradius').value);
        state.settings.animSpeed = document.getElementById('set-animspeed').value;

        applySettings();
        renderMessages();
        closeSettings();
        saveState();
    }

    // ─── HELP / UPGRADE ──────────────────────────────────────────
    function showHelp() {
        alert('💡 Zeph AI Help\n\n• Enter untuk kirim\n• Shift+Enter untuk baris baru\n• ⭐ untuk favorit\n• Export/Import chat di header');
    }

    function showUpgrade() {
        alert('🚀 Upgrade ke Zeph Pro\n\n✅ Respons lebih cepat\n✅ Model Vision\n✅ Prioritas antrian\n✅ Chat tanpa batas');
    }

    // ─── INIT ────────────────────────────────────────────────────
    function init() {
        const hasSaved = loadState();
        applySettings();

        modelSelect.value = state.model || 'mixtral-8x7b-32768';
        renderAll();

        if (hasSaved && state.messages.length > 0) {
            renderMessages();
        } else {
            welcomeScreen.style.display = 'flex';
            msgContainer.innerHTML = '';
        }

        // ─── EVENTS ──────────────────────────────────────────────

        // Send
        sendBtn.addEventListener('click', () => {
            const text = chatInput.value;
            if (text.trim() && !state.isGenerating) sendMessage(text);
        });

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = chatInput.value;
                if (text.trim() && !state.isGenerating) sendMessage(text);
            }
        });

        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
            charCounter.textContent = chatInput.value.length;
        });

        // New Chat
        newChatBtn.addEventListener('click', newChat);

        // Sidebar
        if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);
        if (toggleSidebarBtn) toggleSidebarBtn.addEventListener('click', toggleSidebar);
        if (overlay) overlay.addEventListener('click', closeSidebarMobile);

        // Model
        modelSelect.addEventListener('change', () => {
            state.model = modelSelect.value;
            saveState();
        });

        // Dark Mode
        darkToggle.addEventListener('click', () => {
            state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
            applySettings();
            saveState();
        });

        // Clear
        clearBtn.addEventListener('click', () => {
            if (state.messages.length === 0) return;
            if (confirm('Hapus semua pesan?')) {
                state.messages = [];
                renderMessages();
                saveState();
                saveChatMessages();
            }
        });

        // Search
        searchInput.addEventListener('input', renderAll);

        // Settings
        document.getElementById('profile-btn').addEventListener('click', openSettings);
        document.getElementById('settings-btn').addEventListener('click', openSettings);
        document.getElementById('settings-close').addEventListener('click', closeSettings);
        document.getElementById('settings-cancel').addEventListener('click', closeSettings);
        document.getElementById('settings-save').addEventListener('click', saveSettings);
        document.getElementById('settings-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeSettings();
        });

        // Help & Upgrade
        document.getElementById('help-btn').addEventListener('click', showHelp);
        document.getElementById('upgrade-btn').addEventListener('click', showUpgrade);

        // Suggestion Cards
        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.dataset.prompt || card.textContent.trim();
                chatInput.value = prompt;
                chatInput.style.height = 'auto';
                chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
                charCounter.textContent = prompt.length;
                chatInput.focus();
                if (prompt.trim() && !state.isGenerating) sendMessage(prompt);
            });
        });

        // Emoji
        document.getElementById('emoji-btn').addEventListener('click', () => {
            const emojis = ['😊', '🔥', '✨', '🚀', '💡', '🎯', '📌', '✅', '🎉', '💪', '🤖', '🧠'];
            const pick = emojis[Math.floor(Math.random() * emojis.length)];
            chatInput.value += pick;
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
            charCounter.textContent = chatInput.value.length;
            chatInput.focus();
        });

        // Upload
        document.getElementById('upload-btn').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,.pdf,.txt,.md';
            input.click();

            input.onchange = (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (ev) => {
                    const content = ev.target?.result;
                    if (typeof content === 'string') {
                        chatInput.value += `\n[Upload: ${file.name}]\n${content.slice(0, 200)}...`;
                    } else {
                        chatInput.value += `\n[Upload: ${file.name}]`;
                    }
                    chatInput.style.height = 'auto';
                    chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
                    charCounter.textContent = chatInput.value.length;
                    chatInput.focus();
                };

                if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
                    reader.readAsText(file);
                } else {
                    chatInput.value += `\n[Upload: ${file.name} (gambar)]`;
                    chatInput.style.height = 'auto';
                    chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
                    charCounter.textContent = chatInput.value.length;
                    chatInput.focus();
                }
            };
        });

        // Voice
        document.getElementById('voice-btn').addEventListener('click', () => {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                const recognizer = new SR();
                recognizer.lang = 'id-ID';
                recognizer.interimResults = false;
                recognizer.onresult = (e) => {
                    const transcript = e.results[0][0].transcript;
                    chatInput.value += transcript;
                    chatInput.style.height = 'auto';
                    chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
                    charCounter.textContent = chatInput.value.length;
                    chatInput.focus();
                };
                recognizer.start();
            } else {
                alert('Voice input tidak didukung di browser ini.');
            }
        });

        // Export/Import
        document.getElementById('export-txt').addEventListener('click', () => exportChat('txt'));
        document.getElementById('export-md').addEventListener('click', () => exportChat('md'));
        document.getElementById('import-btn').addEventListener('click', importChat);

        // Stop
        stopBtn.addEventListener('click', () => {
            state.isGenerating = false;
            sendBtn.disabled = false;
            stopBtn.classList.add('hidden');
        });

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                newChat();
            }
            if (e.key === 'Escape') closeSidebarMobile();
        });

        chatInput.focus();

        // Resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('active');

                if (!sidebarVisible) {
                    sidebarVisible = true;
                    sidebar.classList.remove('desktop-hidden');
                    sidebar.style.width = state.settings.sidebarWidth + 'px';
                    sidebar.style.minWidth = state.settings.sidebarWidth + 'px';
                    sidebar.style.overflow = 'hidden';
                    sidebar.style.borderRight = '1px solid rgba(255,255,255,0.05)';
                    document.getElementById('toggle-sidebar-btn').innerHTML = `
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                        </svg>
                        Hide Sidebar
                    `;
                }
            }
        });

        console.log('🚀 Zeph AI v2.0 ready!');
    }

    // ─── START ────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
