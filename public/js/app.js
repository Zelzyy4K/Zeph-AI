// app.js — Frontend Zeph AI
(function() {
    'use strict';

    // ── State ──
    const state = {
        messages: [],
        currentChatId: null,
        isGenerating: false,
        isSidebarOpen: true, // ← DIUBAH: selalu terbuka di desktop
        model: 'mixtral-8x7b-32768',
        history: [],
        favorites: [],
        folders: [],
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

    // ── API Base URL ──
    const API_BASE = window.location.origin;

    // ── DOM refs ──
    const $ = id => document.getElementById(id);
    const sidebar = $('sidebar');
    const overlay = $('sidebarOverlay');
    const chatMessages = $('chatMessages');
    const msgContainer = $('messageContainer');
    const welcomeScreen = $('welcomeScreen');
    const chatInput = $('chatInput');
    const sendBtn = $('sendBtn');
    const stopBtn = $('stopBtn');
    const clearBtn = $('clearBtn');
    const newChatBtn = $('newChatBtn');
    const menuToggle = $('menuToggle');
    const modelSelect = $('modelSelect');
    const darkToggle = $('darkModeToggle');
    const historyList = $('historyList');
    const favList = $('favList');
    const folderList = $('folderList');
    const searchInput = $('searchChat');
    const settingsPanel = $('settingsPanel');
    const settingsClose = $('settingsClose');
    const charCounter = $('charCounter');
    const profileBtn = $('profileBtn');
    const emojiBtn = $('emojiBtn');
    const uploadBtn = $('uploadBtn');
    const voiceBtn = $('voiceBtn');
    const exportTxtBtn = $('exportTxtBtn');
    const exportMdBtn = $('exportMdBtn');
    const importBtn = $('importBtn');

    // ── Utilities ──
    function uid() { return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatTime(ts) {
        const d = new Date(ts);
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }

    function truncate(str, n = 40) { return str.length > n ? str.slice(0, n) + '…' : str; }

    function getFirstText(msg) {
        const plain = msg.replace(/<[^>]*>/g, '');
        return truncate(plain, 50);
    }

    function countTokens(text) {
        const words = text.split(/\s+/).length;
        return Math.round(words * 1.3);
    }

    function countWords(text) {
        return text.split(/\s+/).filter(w => w.length > 0).length;
    }

    function renderMarkdown(text) {
        try {
            const raw = marked.parse(text || '');
            return DOMPurify.sanitize(raw, {
                ADD_TAGS: ['code', 'pre', 'span'],
                ADD_ATTR: ['class', 'style', 'data-*']
            });
        } catch { return escapeHtml(text); }
    }

    function highlightCodeBlocks(container) {
        container.querySelectorAll('pre code').forEach(block => {
            try { hljs.highlightElement(block); } catch {}
        });
    }

    // ── Save / Load State ──
    function saveState() {
        try {
            const data = {
                messages: state.messages,
                history: state.history,
                favorites: state.favorites,
                folders: state.folders,
                settings: state.settings,
                currentChatId: state.currentChatId,
                model: state.model,
            };
            localStorage.setItem('zeph_state', JSON.stringify(data));
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
            state.folders = data.folders || [];
            state.settings = { ...state.settings, ...(data.settings || {}) };
            state.currentChatId = data.currentChatId || null;
            state.model = data.model || 'mixtral-8x7b-32768';
            return true;
        } catch { return false; }
    }

    // ── Chat History Management ──
    function addHistory(chatId, title, lastMsg, folderId) {
        const existing = state.history.find(h => h.id === chatId);
        if (existing) {
            existing.title = title;
            existing.lastMessage = lastMsg;
            existing.updated = Date.now();
            if (folderId !== undefined) existing.folder = folderId;
        } else {
            state.history.unshift({ id: chatId, title, lastMessage: lastMsg, updated: Date.now(), folder: folderId ||
                    null });
        }
        if (state.history.length > 100) state.history.pop();
        saveState();
        renderAll();
    }

    function deleteHistory(chatId) {
        state.history = state.history.filter(h => h.id !== chatId);
        state.favorites = state.favorites.filter(id => id !== chatId);
        state.folders.forEach(f => {
            f.children = f.children.filter(id => id !== chatId);
        });
        if (state.currentChatId === chatId) {
            state.messages = [];
            state.currentChatId = null;
            renderMessages();
        }
        saveState();
        renderAll();
    }

    function renameHistory(chatId, newTitle) {
        const h = state.history.find(h => h.id === chatId);
        if (h) { h.title = newTitle;
            saveState();
            renderAll(); }
    }

    function toggleFavorite(chatId) {
        const idx = state.favorites.indexOf(chatId);
        if (idx > -1) state.favorites.splice(idx, 1);
        else state.favorites.push(chatId);
        saveState();
        renderAll();
    }

    function getChatTitle(chatId) {
        const h = state.history.find(h => h.id === chatId);
        return h ? h.title : 'Chat baru';
    }

    // ── Folder Management ──
    function createFolder(name) {
        const id = uid();
        state.folders.push({ id, name, children: [] });
        saveState();
        renderAll();
    }

    function deleteFolder(folderId) {
        state.folders = state.folders.filter(f => f.id !== folderId);
        state.history.forEach(h => { if (h.folder === folderId) h.folder = null; });
        saveState();
        renderAll();
    }

    function renameFolder(folderId, newName) {
        const f = state.folders.find(f => f.id === folderId);
        if (f) { f.name = newName;
            saveState();
            renderAll(); }
    }

    function moveChatToFolder(chatId, folderId) {
        const h = state.history.find(h => h.id === chatId);
        if (h) {
            h.folder = folderId || null;
            saveState();
            renderAll();
        }
    }

    // ── Render All ──
    function renderAll() {
        renderHistory();
        renderFavorites();
        renderFolders();
    }

    // ── Render Folders ──
    function renderFolders() {
        if (!folderList) return;
        if (state.folders.length === 0) {
            folderList.innerHTML =
                `<div class="text-white/20 text-xs text-center py-2">Belum ada folder</div>`;
            return;
        }
        let html = '';
        state.folders.forEach(f => {
            const childCount = f.children.length;
            html += `
                <div class="folder-item" data-id="${f.id}">
                  <span>📁</span>
                  <span class="flex-1 truncate">${escapeHtml(f.name)} (${childCount})</span>
                  <div class="folder-actions">
                    <button data-action="rename-folder" data-id="${f.id}" title="Rename">✏️</button>
                    <button data-action="delete-folder" data-id="${f.id}" title="Delete">✕</button>
                  </div>
                </div>
                <div class="folder-children">
                  ${state.history.filter(h => h.folder === f.id).map(h => `
                    <div class="history-item" data-id="${h.id}">
                      <span class="text-white/30 text-sm">💬</span>
                      <span class="flex-1 truncate">${escapeHtml(h.title)}</span>
                      <div class="actions">
                        <button data-action="move-out" data-id="${h.id}" title="Keluarkan dari folder">📤</button>
                        <button data-action="delete" data-id="${h.id}">✕</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `;
        });
        folderList.innerHTML = html;

        folderList.querySelectorAll('.folder-item').forEach(el => {
            const id = el.dataset.id;
            const renameBtn = el.querySelector('[data-action="rename-folder"]');
            if (renameBtn) {
                renameBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const newName = prompt('Nama folder baru:', state.folders.find(f => f.id === id)?.name ||
                        '');
                    if (newName && newName.trim()) renameFolder(id, newName.trim());
                });
            }
            const delBtn = el.querySelector('[data-action="delete-folder"]');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('Hapus folder ini?')) deleteFolder(id);
                });
            }
        });

        folderList.querySelectorAll('.folder-children .history-item').forEach(el => {
            const id = el.dataset.id;
            el.addEventListener('click', (e) => {
                if (e.target.closest('.actions')) return;
                loadChat(id);
            });
            const moveOut = el.querySelector('[data-action="move-out"]');
            if (moveOut) {
                moveOut.addEventListener('click', (e) => {
                    e.stopPropagation();
                    moveChatToFolder(id, null);
                });
            }
            const del = el.querySelector('[data-action="delete"]');
            if (del) {
                del.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('Hapus chat ini?')) deleteHistory(id);
                });
            }
        });
    }

    // ── Render History ──
    function renderHistory() {
        if (!historyList) return;
        const search = searchInput.value.toLowerCase();
        let items = state.history.filter(h => !h.folder);
        if (search) {
            items = items.filter(h => {
                if (h.title.toLowerCase().includes(search)) return true;
                const chatKey = `zeph_chat_${h.id}`;
                const raw = localStorage.getItem(chatKey);
                if (raw) {
                    try {
                        const msgs = JSON.parse(raw);
                        return msgs.some(m => m.content.toLowerCase().includes(search));
                    } catch {}
                }
                return false;
            });
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
                  <div class="actions">
                    <button data-action="rename" data-id="${h.id}" title="Rename">✏️</button>
                    <button data-action="fav" data-id="${h.id}" title="Toggle favorite">${isFav ? '★' : '☆'}</button>
                    <button data-action="folder" data-id="${h.id}" title="Pindah ke folder">📁</button>
                    <button data-action="delete" data-id="${h.id}" title="Delete">✕</button>
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
            const renameBtn = el.querySelector('[data-action="rename"]');
            if (renameBtn) {
                renameBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const newTitle = prompt('Rename chat:', getChatTitle(id));
                    if (newTitle && newTitle.trim()) renameHistory(id, newTitle.trim());
                });
            }
            const favBtn = el.querySelector('[data-action="fav"]');
            if (favBtn) {
                favBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleFavorite(id);
                });
            }
            const folderBtn = el.querySelector('[data-action="folder"]');
            if (folderBtn) {
                folderBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const folderNames = state.folders.map(f => `${f.name} (${f.id})`).join(', ');
                    const choice = prompt(
                        `Masukkan ID folder (lihat daftar: ${folderNames || 'tidak ada folder'}) atau kosongkan untuk keluar:`,
                        '');
                    if (choice !== null) {
                        const folderId = choice.trim() || null;
                        if (folderId && state.folders.some(f => f.id === folderId)) {
                            moveChatToFolder(id, folderId);
                        } else if (!folderId) {
                            moveChatToFolder(id, null);
                        } else {
                            alert('Folder tidak ditemukan.');
                        }
                    }
                });
            }
            const delBtn = el.querySelector('[data-action="delete"]');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('Hapus chat ini?')) deleteHistory(id);
                });
            }
        });
    }

    // ── Render Favorites ──
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
            return `<div class="history-item" data-id="${id}">
                <span class="text-yellow-500/60 text-sm">⭐</span>
                <span class="flex-1 truncate">${escapeHtml(h.title)}</span>
                <div class="actions">
                  <button data-action="unfav" data-id="${id}" title="Unfavorite">✕</button>
                </div>
              </div>`;
        }).join('');

        favList.querySelectorAll('.history-item').forEach(el => {
            const id = el.dataset.id;
            el.addEventListener('click', (e) => {
                if (e.target.closest('.actions')) return;
                loadChat(id);
            });
            const unfav = el.querySelector('[data-action="unfav"]');
            if (unfav) {
                unfav.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleFavorite(id);
                });
            }
        });
    }

    // ── Load Chat ──
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
        closeSidebar();
        saveState();
    }

    // ── Save chat messages ──
    function saveChatMessages() {
        if (state.currentChatId) {
            localStorage.setItem(`zeph_chat_${state.currentChatId}`, JSON.stringify(state.messages));
        }
    }

    // ── Render Messages ──
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
            const bubbleClass = isUser ? 'bubble-user self-end' : 'bubble-ai self-start';
            const alignClass = isUser ? 'items-end' : 'items-start';
            const content = isUser ? escapeHtml(msg.content) : renderMarkdown(msg.content);
            const tokenCount = countTokens(msg.content);
            const wordCount = countWords(msg.content);

            html += `
                <div class="message-group fade-in" data-id="${msg.id || idx}">
                  <div class="flex ${alignClass} gap-2.5">
                    <div class="avatar-ring ${avatarClass}">${avatar}</div>
                    <div class="${bubbleClass}" style="border-radius: ${state.settings.bubbleRadius}px;">
                      ${content}
                      <div class="text-[10px] text-white/20 mt-1 flex items-center gap-3 flex-wrap">
                        <span>${formatTime(msg.timestamp || Date.now())}</span>
                        <span>${wordCount} kata · ${tokenCount} token</span>
                        ${!isUser ? `
                          <button class="text-white/20 hover:text-white/60 transition" data-action="copy-msg" data-idx="${idx}">📋</button>
                          <button class="text-white/20 hover:text-white/60 transition" data-action="regenerate" data-idx="${idx}">🔄</button>
                          <button class="text-white/20 hover:text-white/60 transition" data-action="like" data-idx="${idx}">👍</button>
                          <button class="text-white/20 hover:text-white/60 transition" data-action="dislike" data-idx="${idx}">👎</button>
                        ` : `
                          <button class="text-white/20 hover:text-white/60 transition" data-action="edit-msg" data-idx="${idx}">✏️</button>
                        `}
                      </div>
                    </div>
                  </div>
                </div>
              `;
        });

        msgContainer.innerHTML = html;

        highlightCodeBlocks(msgContainer);

        // Copy code buttons
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

        // Action handlers
        msgContainer.querySelectorAll('[data-action="copy-msg"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                const msg = state.messages[idx];
                if (msg) {
                    navigator.clipboard.writeText(msg.content).then(() => {
                        btn.textContent = '✅';
                        setTimeout(() => btn.textContent = '📋', 1500);
                    }).catch(() => {});
                }
            });
        });

        msgContainer.querySelectorAll('[data-action="edit-msg"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                const msg = state.messages[idx];
                if (msg && msg.role === 'user') {
                    const newText = prompt('Edit pesan:', msg.content);
                    if (newText !== null && newText.trim()) {
                        msg.content = newText.trim();
                        const nextIdx = idx + 1;
                        if (nextIdx < state.messages.length && state.messages[nextIdx].role === 'ai') {
                            state.messages.splice(nextIdx, 1);
                        }
                        saveChatMessages();
                        saveState();
                        renderMessages();
                        sendMessage(newText.trim(), true);
                    }
                }
            });
        });

        msgContainer.querySelectorAll('[data-action="regenerate"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                const msg = state.messages[idx];
                if (msg && msg.role === 'ai') {
                    let userMsg = null;
                    let userIdx = idx - 1;
                    while (userIdx >= 0) {
                        if (state.messages[userIdx].role === 'user') {
                            userMsg = state.messages[userIdx];
                            break;
                        }
                        userIdx--;
                    }
                    if (userMsg) {
                        state.messages.splice(idx);
                        saveChatMessages();
                        saveState();
                        renderMessages();
                        sendMessage(userMsg.content, true);
                    }
                }
            });
        });

        msgContainer.querySelectorAll('[data-action="like"]').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.textContent = '✅';
                setTimeout(() => btn.textContent = '👍', 2000);
            });
        });
        msgContainer.querySelectorAll('[data-action="dislike"]').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.textContent = '✅';
                setTimeout(() => btn.textContent = '👎', 2000);
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

    // ── Send Message ke Backend ──
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
        autoResizeInput();
        charCounter.textContent = '0';
        saveState();

        if (!isEdit) {
            await callAI(content);
        }
    }

    // ── Panggil API AI ──
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
            // Siapkan history untuk dikirim ke API
            const chatHistory = state.messages
                .filter(m => m.content)
                .map(m => ({ role: m.role, content: m.content }));

            const response = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: chatHistory,
                    model: state.model,
                    stream: true,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

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
                    } catch (e) {
                        // Lewati JSON invalid
                    }
                }
            }

            if (fullText === '') {
                aiMsg.content = '[Tidak ada respons dari AI]';
                renderMessages();
            }

        } catch (error) {
            console.error('AI Error:', error);
            // Tampilkan error yang lebih detail
            let errorMsg = '❌ Terjadi kesalahan pada AI. ';
            if (error.message.includes('API key')) {
                errorMsg += 'API key tidak valid atau tidak ditemukan. Pastikan GROQ_API_KEY sudah diatur di environment variables.';
            } else if (error.message.includes('fetch')) {
                errorMsg += 'Gagal terhubung ke server. Periksa koneksi internet.';
            } else if (error.message.includes('HTTP 500')) {
                errorMsg += 'Server mengalami error internal. Coba lagi nanti.';
            } else {
                errorMsg += error.message || 'Silakan coba lagi.';
            }
            aiMsg.content = errorMsg;
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

    // ── New Chat ──
    function newChat() {
        state.messages = [];
        state.currentChatId = null;
        renderMessages();
        chatInput.value = '';
        charCounter.textContent = '0';
        autoResizeInput();
        closeSidebar();
        saveState();
        chatInput.focus();
    }

    // ── Auto-resize textarea ──
    function autoResizeInput() {
        const el = chatInput;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }

    // ── Sidebar Toggle ──
    function toggleSidebar() {
        const isOpen = sidebar.classList.toggle('open');
        overlay.classList.toggle('active', isOpen);
        state.isSidebarOpen = isOpen;
    }

    function closeSidebar() {
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            state.isSidebarOpen = false;
        }
    }

    // ── Settings ──
    function openSettings() {
        settingsPanel.classList.add('open');
        document.getElementById('setTheme').value = state.settings.theme;
        document.getElementById('setLang').value = state.settings.lang;
        document.getElementById('setFontSize').value = state.settings.fontSize;
        document.getElementById('fontSizeLabel').textContent = state.settings.fontSize + 'px';
        document.getElementById('setHistory').checked = state.settings.chatHistory;
        document.getElementById('setAutoScroll').checked = state.settings.autoScroll;
        document.getElementById('setStreaming').checked = state.settings.streaming;
        document.getElementById('setSidebarWidth').value = state.settings.sidebarWidth;
        document.getElementById('setBubbleRadius').value = state.settings.bubbleRadius;
        document.getElementById('setAnimSpeed').value = state.settings.animSpeed;
    }

    function closeSettings() {
        settingsPanel.classList.remove('open');
    }

    // ── Apply Settings ──
    function applySettings() {
        document.documentElement.style.fontSize = state.settings.fontSize + 'px';
        const width = state.settings.sidebarWidth;
        sidebar.style.width = width + 'px';
        sidebar.style.minWidth = width + 'px';
        const speed = state.settings.animSpeed;
        const dur = speed === 'fast' ? '0.15s' : speed === 'slow' ? '0.6s' : '0.3s';
        document.querySelectorAll('.fade-in, .slide-in, .sidebar, .settings-panel').forEach(el => {
            el.style.transitionDuration = dur;
        });
        if (state.settings.theme === 'light') {
            document.body.classList.add('light');
        } else {
            document.body.classList.remove('light');
        }
        localStorage.setItem('zeph_theme', state.settings.theme);
    }

    // ── Export Chat ──
    function exportChat(format) {
        if (!state.currentChatId) {
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
            content = `# ${title}\n\n`;
            content += state.messages.map(m =>
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

    // ── Import Chat ──
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
                                    newMessages.push({ role: currentRole, content: currentContent.trim(),
                                        timestamp: Date.now() });
                                    currentContent = '';
                                }
                                if (line.startsWith('User')) currentRole = 'user';
                                else currentRole = 'ai';
                            } else {
                                currentContent += line + '\n';
                            }
                        }
                        if (currentContent) {
                            newMessages.push({ role: currentRole, content: currentContent.trim(),
                                timestamp: Date.now() });
                        }
                        if (newMessages.length > 0) {
                            if (!state.currentChatId) {
                                state.currentChatId = uid();
                            }
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

    // ── Init ──
    function init() {
        const hasSaved = loadState();

        const savedTheme = localStorage.getItem('zeph_theme');
        if (savedTheme) {
            state.settings.theme = savedTheme;
        }
        applySettings();

        modelSelect.value = state.model || 'mixtral-8x7b-32768';

        renderAll();

        if (hasSaved && state.messages.length > 0) {
            renderMessages();
        } else {
            welcomeScreen.style.display = 'flex';
            msgContainer.innerHTML = '';
        }

        // ── Events ──
        sendBtn.addEventListener('click', () => {
            const text = chatInput.value;
            if (text.trim() && !state.isGenerating) {
                sendMessage(text);
            }
        });

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = chatInput.value;
                if (text.trim() && !state.isGenerating) {
                    sendMessage(text);
                }
            }
        });

        chatInput.addEventListener('input', () => {
            autoResizeInput();
            charCounter.textContent = chatInput.value.length;
        });

        newChatBtn.addEventListener('click', newChat);
        menuToggle.addEventListener('click', toggleSidebar);
        overlay.addEventListener('click', closeSidebar);

        modelSelect.addEventListener('change', () => {
            state.model = modelSelect.value;
            saveState();
        });

        darkToggle.addEventListener('click', () => {
            const isLight = document.body.classList.contains('light');
            state.settings.theme = isLight ? 'dark' : 'light';
            applySettings();
            saveState();
        });

        document.querySelectorAll('[data-action="settings"]').forEach(el => {
            el.addEventListener('click', openSettings);
        });
        settingsClose.addEventListener('click', closeSettings);
        settingsPanel.addEventListener('click', (e) => {
            if (e.target === settingsPanel) closeSettings();
        });

        document.getElementById('setTheme').addEventListener('change', (e) => {
            state.settings.theme = e.target.value;
            applySettings();
            saveState();
        });
        document.getElementById('setLang').addEventListener('change', (e) => {
            state.settings.lang = e.target.value;
            saveState();
        });
        document.getElementById('setFontSize').addEventListener('input', (e) => {
            state.settings.fontSize = parseInt(e.target.value);
            document.getElementById('fontSizeLabel').textContent = state.settings.fontSize + 'px';
            applySettings();
            saveState();
        });
        document.getElementById('setHistory').addEventListener('change', (e) => {
            state.settings.chatHistory = e.target.checked;
            saveState();
        });
        document.getElementById('setAutoScroll').addEventListener('change', (e) => {
            state.settings.autoScroll = e.target.checked;
            saveState();
        });
        document.getElementById('setStreaming').addEventListener('change', (e) => {
            state.settings.streaming = e.target.checked;
            saveState();
        });
        document.getElementById('setSidebarWidth').addEventListener('input', (e) => {
            state.settings.sidebarWidth = parseInt(e.target.value);
            applySettings();
            saveState();
        });
        document.getElementById('setBubbleRadius').addEventListener('input', (e) => {
            state.settings.bubbleRadius = parseInt(e.target.value);
            applySettings();
            renderMessages();
            saveState();
        });
        document.getElementById('setAnimSpeed').addEventListener('change', (e) => {
            state.settings.animSpeed = e.target.value;
            applySettings();
            saveState();
        });

        clearBtn.addEventListener('click', () => {
            if (state.messages.length === 0) return;
            if (confirm('Hapus semua pesan?')) {
                state.messages = [];
                renderMessages();
                saveState();
                saveChatMessages();
            }
        });

        searchInput.addEventListener('input', renderAll);
        profileBtn.addEventListener('click', openSettings);

        document.querySelectorAll('[data-action="help"]').forEach(el => {
            el.addEventListener('click', () => {
                alert('Zeph AI Help\n\nTips:\n- Enter untuk kirim\n- Shift+Enter baris baru\n- Double-click history rename\n- Klik ⭐ untuk favorit\n- Export/Import di header');
            });
        });
        document.querySelectorAll('[data-action="upgrade"]').forEach(el => {
            el.addEventListener('click', () => {
                alert('🚀 Upgrade ke Zeph Pro\n\nFitur Pro:\n- Respons lebih cepat\n- Model Vision\n- Prioritas antrian');
            });
        });

        document.querySelectorAll('[data-action="collapse"]').forEach(el => {
            el.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    toggleSidebar();
                } else {
                    sidebar.classList.toggle('collapsed');
                }
            });
        });

        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.dataset.prompt || card.textContent.trim();
                chatInput.value = prompt;
                autoResizeInput();
                charCounter.textContent = prompt.length;
                chatInput.focus();
                if (prompt.trim() && !state.isGenerating) {
                    sendMessage(prompt);
                }
            });
        });

        emojiBtn.addEventListener('click', () => {
            const emojis = ['😊', '🔥', '✨', '🚀', '💡', '🎯', '📌', '✅', '🎉', '💪', '🤖', '🧠'];
            const pick = emojis[Math.floor(Math.random() * emojis.length)];
            chatInput.value += pick;
            autoResizeInput();
            charCounter.textContent = chatInput.value.length;
            chatInput.focus();
        });

        uploadBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,.pdf,.txt,.md';
            input.onchange = (e) => {
                const file = e.target.files?.[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const content = ev.target?.result;
                        if (typeof content === 'string') {
                            chatInput.value += `\n[Upload: ${file.name}]\n${content.slice(0, 200)}...`;
                            autoResizeInput();
                            charCounter.textContent = chatInput.value.length;
                        } else {
                            chatInput.value += `\n[Upload: ${file.name}]`;
                            autoResizeInput();
                            charCounter.textContent = chatInput.value.length;
                        }
                        chatInput.focus();
                    };
                    if (file.type.startsWith('text/') || file.type === 'application/pdf' || file.name.endsWith(
                            '.md') || file.name.endsWith('.txt')) {
                        reader.readAsText(file);
                    } else {
                        chatInput.value += `\n[Upload: ${file.name} (gambar)]`;
                        autoResizeInput();
                        charCounter.textContent = chatInput.value.length;
                        chatInput.focus();
                    }
                }
            };
            input.click();
        });

        voiceBtn.addEventListener('click', () => {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                const recognizer = new SR();
                recognizer.lang = 'id-ID';
                recognizer.interimResults = false;
                recognizer.onresult = (e) => {
                    const transcript = e.results[0][0].transcript;
                    chatInput.value += transcript;
                    autoResizeInput();
                    charCounter.textContent = chatInput.value.length;
                    chatInput.focus();
                };
                recognizer.start();
            } else {
                alert('Voice input tidak didukung di browser ini.');
            }
        });

        exportTxtBtn.addEventListener('click', () => exportChat('txt'));
        exportMdBtn.addEventListener('click', () => exportChat('md'));
        importBtn.addEventListener('click', importChat);

        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                newChat();
            }
            if (e.key === 'Escape') {
                closeSettings();
                closeSidebar();
            }
        });

        chatInput.focus();

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            }
        });

        console.log('🚀 Zeph AI v1.0.0 — Siap digunakan!');
        console.log(`📡 API: ${API_BASE}/api/chat`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
