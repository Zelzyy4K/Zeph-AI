(function() {
  // ===== DOM REFS =====
  const chatContainer = document.getElementById('chatContainer');
  const messageContainer = document.getElementById('messageContainer');
  const welcomeScreen = document.getElementById('welcomeScreen');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const collapseSidebar = document.getElementById('collapseSidebar');
  const typingIndicator = document.getElementById('typingIndicator');
  const chatHistory = document.getElementById('chatHistory');
  
  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsClose = document.getElementById('settingsClose');
  const settingsNavBtn = document.getElementById('settingsNavBtn');

  const navHelp = document.getElementById('navHelp');
  const navUpgrade = document.getElementById('navUpgrade');

  const darkModeToggle = document.getElementById('darkModeToggle');
  const darkModeIcon = document.getElementById('darkModeIcon');
  const modelDropdown = document.getElementById('modelDropdown');
  const currentModel = document.getElementById('currentModel');
  const profileIcon = document.getElementById('profileIcon');

  const plusBtn = document.getElementById('plusBtn');
  const plusPopup = document.getElementById('plusPopup');
  const imageMenuItem = document.getElementById('imageMenuItem');
  const fileMenuItem = document.getElementById('fileMenuItem');
  const emojiMenuItem = document.getElementById('emojiMenuItem');
  const voiceBtn = document.getElementById('voiceBtn');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const searchChatInput = document.getElementById('searchChatInput');

  // ===== STATE =====
  let currentChatId = null;
  let chatData = {};
  let isTyping = false;
  let isSidebarCollapsed = false;
  let isDarkMode = true;
  let isPlusOpen = false;
  let chatIdCounter = 0;
  let editingChatId = null;
  let chatTitleSet = {};

  // ===== LOAD & SAVE =====
  function loadChats() {
    try {
      const saved = localStorage.getItem('zeph_chats');
      if (saved) {
        const data = JSON.parse(saved);
        chatData = data.chats || {};
        chatIdCounter = data.counter || 0;
        chatTitleSet = data.titleSet || {};
      }
    } catch (e) {
      console.warn('Failed to load chats:', e);
    }
  }

  function saveChats() {
    try {
      localStorage.setItem('zeph_chats', JSON.stringify({
        chats: chatData,
        counter: chatIdCounter,
        titleSet: chatTitleSet
      }));
    } catch (e) {
      console.warn('Failed to save chats:', e);
    }
  }

  // ===== RENDER CHAT HISTORY =====
  function renderChatHistory() {
    const ids = Object.keys(chatData);
    if (ids.length === 0) {
      chatHistory.innerHTML = '<div class="chat-history-empty">No chat history yet</div>';
      return;
    }
    
    chatHistory.innerHTML = '';
    
    const pinnedIds = ids.filter(id => chatData[id].pinned);
    const unpinnedIds = ids.filter(id => !chatData[id].pinned);
    
    const sortByDate = (a, b) => (chatData[b].updatedAt || 0) - (chatData[a].updatedAt || 0);
    pinnedIds.sort(sortByDate);
    unpinnedIds.sort(sortByDate);
    
    if (pinnedIds.length > 0) {
      const pinnedLabel = document.createElement('div');
      pinnedLabel.className = 'pinned-label';
      pinnedLabel.textContent = '📌 Pinned';
      chatHistory.appendChild(pinnedLabel);
      
      pinnedIds.forEach(id => {
        chatHistory.appendChild(createChatItem(id));
      });
    }
    
    if (unpinnedIds.length > 0) {
      if (pinnedIds.length > 0) {
        const spacer = document.createElement('div');
        spacer.style.height = '4px';
        chatHistory.appendChild(spacer);
      }
      unpinnedIds.forEach(id => {
        chatHistory.appendChild(createChatItem(id));
      });
    }
  }

  function createChatItem(id) {
    const chat = chatData[id];
    if (!chat) return document.createElement('div');
    
    const item = document.createElement('div');
    item.className = `chat-history-item${id === currentChatId ? ' active' : ''}`;
    item.dataset.chatId = id;
    
    const icon = document.createElement('i');
    icon.className = 'chat-icon fas fa-comment';
    if (chat.pinned) {
      icon.className = 'chat-icon fas fa-thumbtack';
      icon.style.color = '#f1c40f';
    }
    item.appendChild(icon);
    
    const titleSpan = document.createElement('span');
    titleSpan.className = 'chat-title';
    titleSpan.textContent = chat.title || 'New Chat';
    item.appendChild(titleSpan);
    
    const actions = document.createElement('div');
    actions.className = 'chat-actions';
    
    const pinBtn = document.createElement('button');
    pinBtn.className = `pin-btn${chat.pinned ? ' pinned' : ''}`;
    pinBtn.innerHTML = '<i class="fas fa-thumbtack"></i>';
    pinBtn.title = chat.pinned ? 'Unpin' : 'Pin';
    pinBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      togglePin(id);
    });
    actions.appendChild(pinBtn);
    
    const renameBtn = document.createElement('button');
    renameBtn.className = 'rename-btn';
    renameBtn.innerHTML = '<i class="fas fa-pen"></i>';
    renameBtn.title = 'Rename';
    renameBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      startRename(id);
    });
    actions.appendChild(renameBtn);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteChat(id);
    });
    actions.appendChild(deleteBtn);
    
    item.appendChild(actions);
    
    item.addEventListener('click', function(e) {
      if (e.target.closest('.chat-actions')) return;
      if (editingChatId === id) return;
      loadChat(id);
    });
    
    return item;
  }

  // ===== CHAT OPERATIONS =====
  function startRename(id) {
    const chat = chatData[id];
    if (!chat) return;
    
    const item = document.querySelector(`.chat-history-item[data-chat-id="${id}"]`);
    if (!item) return;
    
    const titleSpan = item.querySelector('.chat-title');
    const currentTitle = titleSpan.textContent;
    
    const input = document.createElement('input');
    input.className = 'chat-title-input';
    input.type = 'text';
    input.value = currentTitle;
    input.maxLength = 60;
    
    titleSpan.replaceWith(input);
    input.focus();
    input.select();
    editingChatId = id;
    
    const finishRename = () => {
      const newTitle = input.value.trim() || 'New Chat';
      chatData[id].title = newTitle;
      chatData[id].updatedAt = Date.now();
      chatTitleSet[id] = true;
      saveChats();
      renderChatHistory();
      editingChatId = null;
    };
    
    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
      if (e.key === 'Escape') {
        input.value = currentTitle;
        input.blur();
      }
    });
  }

  function togglePin(id) {
    if (!chatData[id]) return;
    chatData[id].pinned = !chatData[id].pinned;
    chatData[id].updatedAt = Date.now();
    saveChats();
    renderChatHistory();
  }

  function loadChat(id) {
    const chat = chatData[id];
    if (!chat) return;
    
    currentChatId = id;
    messageContainer.innerHTML = '';
    chat.messages.forEach(msg => {
      addMessageToUI(msg.role, msg.content);
    });
    welcomeScreen.style.display = 'none';
    renderChatHistory();
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function addMessageToUI(role, content) {
    const isUser = role === 'user';
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user' : 'ai'}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-feather-alt"></i>';
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const radius = document.getElementById('settingBubbleRadius').value;
    bubble.style.borderRadius = radius + 'px';
    
    if (isUser) {
      bubble.innerHTML = escapeHtml(content);
      bubble.style.borderTopRightRadius = '4px';
    } else {
      bubble.innerHTML = renderMarkdown(content);
      bubble.style.borderTopLeftRadius = '4px';
      addMessageActions(bubble);
    }
    
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    messageContainer.appendChild(msgDiv);
    
    if (document.getElementById('toggleAutoScroll').classList.contains('active')) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  function saveCurrentChat() {
    if (!currentChatId) return;
    
    const messages = [];
    document.querySelectorAll('.message').forEach(msg => {
      const role = msg.classList.contains('user') ? 'user' : 'ai';
      const content = msg.querySelector('.bubble').innerText;
      messages.push({ role, content });
    });
    
    if (messages.length === 0) {
      if (chatData[currentChatId]) {
        delete chatData[currentChatId];
        delete chatTitleSet[currentChatId];
        currentChatId = null;
        renderChatHistory();
        saveChats();
      }
      return;
    }
    
    const firstUserMsg = messages.find(m => m.role === 'user');
    let title = chatData[currentChatId]?.title || 'New Chat';
    
    if (!chatTitleSet[currentChatId] && firstUserMsg) {
      const content = firstUserMsg.content;
      title = content.substring(0, 40) + (content.length > 40 ? '...' : '');
      chatTitleSet[currentChatId] = true;
    }
    
    chatData[currentChatId] = {
      ...chatData[currentChatId],
      title: title,
      messages: messages,
      updatedAt: Date.now(),
      pinned: chatData[currentChatId]?.pinned || false
    };
    
    renderChatHistory();
    saveChats();
  }

  function deleteChat(id) {
    if (confirm('Delete this chat?')) {
      delete chatData[id];
      delete chatTitleSet[id];
      if (currentChatId === id) {
        currentChatId = null;
        messageContainer.innerHTML = '';
        welcomeScreen.style.display = 'flex';
      }
      renderChatHistory();
      saveChats();
    }
  }

  function createNewChat() {
    if (currentChatId && messageContainer.children.length > 0) {
      saveCurrentChat();
    }
    
    const id = 'chat_' + (++chatIdCounter);
    currentChatId = id;
    chatData[id] = {
      title: 'New Chat',
      messages: [],
      updatedAt: Date.now(),
      pinned: false
    };
    chatTitleSet[id] = false;
    messageContainer.innerHTML = '';
    welcomeScreen.style.display = 'flex';
    chatInput.value = '';
    chatInput.style.height = 'auto';
    renderChatHistory();
    saveChats();
    
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    }
  }

  // ===== HELPERS =====
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderMarkdown(text) {
    const raw = marked.parse(text);
    const div = document.createElement('div');
    div.innerHTML = raw;
    div.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
    return div.innerHTML;
  }

  function addMessageActions(bubble) {
    const codeBlocks = bubble.querySelectorAll('pre');
    codeBlocks.forEach(pre => {
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.innerHTML = '<i class="far fa-copy"></i> Copy';
      btn.onclick = (e) => {
        e.stopPropagation();
        const code = pre.querySelector('code')?.innerText || pre.innerText;
        navigator.clipboard?.writeText(code);
        btn.innerHTML = '<i class="fas fa-check"></i> Copied';
        setTimeout(() => btn.innerHTML = '<i class="far fa-copy"></i> Copy', 1500);
      };
      pre.appendChild(btn);
    });
    
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.innerHTML = `
      <i class="far fa-copy" title="Copy message"></i>
      <i class="far fa-edit" title="Edit message"></i>
      <i class="fas fa-redo" title="Regenerate response"></i>
      <i class="far fa-thumbs-up" title="Like"></i>
      <i class="far fa-thumbs-down" title="Dislike"></i>
    `;
    bubble.appendChild(actions);
    
    const copyBtn = actions.querySelector('.fa-copy');
    const editBtn = actions.querySelector('.fa-edit');
    const redoBtn = actions.querySelector('.fa-redo');
    const likeBtn = actions.querySelector('.fa-thumbs-up');
    const dislikeBtn = actions.querySelector('.fa-thumbs-down');
    
    copyBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const text = bubble.innerText.replace(/Copy|Edit|Regenerate|Like|Dislike|👍|👎/g, '').trim();
      navigator.clipboard?.writeText(text);
      this.className = 'fas fa-check';
      setTimeout(() => this.className = 'far fa-copy', 1200);
    });
    
    editBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const text = bubble.innerText.replace(/Copy|Edit|Regenerate|Like|Dislike|👍|👎/g, '').trim();
      chatInput.value = text;
      chatInput.focus();
      chatInput.style.height = 'auto';
      chatInput.style.height = chatInput.scrollHeight + 'px';
    });
    
    redoBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const parent = this.closest('.message');
      const previousUserMessage = parent.previousElementSibling;
      if (previousUserMessage && previousUserMessage.classList.contains('user')) {
        const userText = previousUserMessage.querySelector('.bubble').innerText;
        parent.remove();
        simulateStreamResponse(userText);
      }
    });
    
    let liked = false;
    let disliked = false;
    likeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (disliked) {
        dislikeBtn.classList.remove('disliked');
        disliked = false;
      }
      liked = !liked;
      this.classList.toggle('liked', liked);
    });
    
    dislikeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (liked) {
        likeBtn.classList.remove('liked');
        liked = false;
      }
      disliked = !disliked;
      this.classList.toggle('disliked', disliked);
    });
  }

  function addMessage(role, content, isStreaming = false) {
    const isUser = role === 'user';
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user' : 'ai'}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-feather-alt"></i>';
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const radius = document.getElementById('settingBubbleRadius').value;
    bubble.style.borderRadius = radius + 'px';
    
    if (isUser) {
      bubble.innerHTML = escapeHtml(content);
      bubble.style.borderTopRightRadius = '4px';
    } else {
      if (isStreaming) {
        bubble.id = 'streamBubble';
      }
      bubble.innerHTML = renderMarkdown(content);
      bubble.style.borderTopLeftRadius = '4px';
      if (!isStreaming) {
        addMessageActions(bubble);
      }
    }
    
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    messageContainer.appendChild(msgDiv);
    
    if (document.getElementById('toggleAutoScroll').classList.contains('active')) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    return msgDiv;
  }

  function simulateStreamResponse(userText) {
    if (isTyping) return;
    isTyping = true;
    typingIndicator.style.display = 'flex';
    
    if (!currentChatId) {
      const id = 'chat_' + (++chatIdCounter);
      currentChatId = id;
      chatData[id] = {
        title: 'New Chat',
        messages: [],
        updatedAt: Date.now(),
        pinned: false
      };
      chatTitleSet[id] = false;
      renderChatHistory();
      saveChats();
    }
    
    const streamingEnabled = document.getElementById('toggleStreaming').classList.contains('active');
    const aiMessage = document.createElement('div');
    aiMessage.className = 'message ai';
    aiMessage.innerHTML = `<div class="avatar"><i class="fas fa-feather-alt"></i></div><div class="bubble" id="streamBubble"></div>`;
    messageContainer.appendChild(aiMessage);
    const bubble = aiMessage.querySelector('.bubble');
    const radius = document.getElementById('settingBubbleRadius').value;
    bubble.style.borderRadius = radius + 'px';
    bubble.style.borderTopLeftRadius = '4px';
    
    const responses = [
      `I received: "${userText}". This is a streaming response. (Zeph AI)`,
      `Great question! Let me think about "${userText}"... Here's what I can tell you.`,
      `Processing "${userText}"... I've analyzed your query and here's my response.`,
      `Interesting point about "${userText}". Let me break this down for you.`
    ];
    const fullText = responses[Math.floor(Math.random() * responses.length)];
    
    if (!streamingEnabled) {
      bubble.innerHTML = renderMarkdown(fullText);
      isTyping = false;
      typingIndicator.style.display = 'none';
      addMessageActions(bubble);
      if (document.getElementById('toggleAutoScroll').classList.contains('active')) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
      setTimeout(saveCurrentChat, 100);
      return;
    }
    
    let index = 0;
    function streamChar() {
      if (index < fullText.length) {
        bubble.innerHTML = renderMarkdown(fullText.substring(0, index + 1));
        index++;
        if (document.getElementById('toggleAutoScroll').classList.contains('active')) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        setTimeout(streamChar, 20);
      } else {
        isTyping = false;
        typingIndicator.style.display = 'none';
        addMessageActions(bubble);
        if (document.getElementById('toggleAutoScroll').classList.contains('active')) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        setTimeout(saveCurrentChat, 100);
      }
    }
    streamChar();
  }

  // ===== SEND MESSAGE =====
  function handleSend() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    if (!currentChatId) {
      const id = 'chat_' + (++chatIdCounter);
      currentChatId = id;
      chatData[id] = {
        title: 'New Chat',
        messages: [],
        updatedAt: Date.now(),
        pinned: false
      };
      chatTitleSet[id] = false;
      renderChatHistory();
      saveChats();
    }
    
    welcomeScreen.style.display = 'none';
    addMessage('user', text);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    simulateStreamResponse(text);
    sendBtn.disabled = true;
    setTimeout(() => sendBtn.disabled = false, 500);
    closePlusPopup();
  }

  // ===== TOGGLE FUNCTIONS =====
  function togglePlusPopup() {
    isPlusOpen = !isPlusOpen;
    plusPopup.classList.toggle('active', isPlusOpen);
    plusBtn.classList.toggle('active', isPlusOpen);
  }

  function closePlusPopup() {
    isPlusOpen = false;
    plusPopup.classList.remove('active');
    plusBtn.classList.remove('active');
  }

  function toggleSidebarDesktop() {
    if (window.innerWidth <= 768) return;
    isSidebarCollapsed = !isSidebarCollapsed;
    sidebar.classList.toggle('collapsed', isSidebarCollapsed);
    const icon = hamburgerBtn.querySelector('i');
    icon.className = isSidebarCollapsed ? 'fas fa-bars' : 'fas fa-times';
  }

  // ===== SETTINGS =====
  function openSettings() {
    settingsOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSettings() {
    settingsOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function setupToggle(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      this.classList.toggle('active');
    });
  }

  // ===== EVENT LISTENERS =====
  sendBtn.addEventListener('click', handleSend);
  
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
  
  chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
  });

  plusBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    togglePlusPopup();
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.plus-btn') && !e.target.closest('.plus-popup')) {
      closePlusPopup();
    }
  });

  imageMenuItem.addEventListener('click', function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
      const file = e.target.files[0];
      if (file) {
        console.log(`Image "${file.name}" (${(file.size/1024).toFixed(1)}KB)`);
      }
    };
    input.click();
    closePlusPopup();
  });

  fileMenuItem.addEventListener('click', function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.pdf,.docx';
    input.onchange = function(e) {
      const file = e.target.files[0];
      if (file) {
        console.log(`File "${file.name}" (${(file.size/1024).toFixed(1)}KB)`);
      }
    };
    input.click();
    closePlusPopup();
  });

  emojiMenuItem.addEventListener('click', function() {
    const emojis = ['😊', '😂', '❤️', '🔥', '✨', '⭐', '👍', '👏', '🎉', '💡', '🚀', '💎'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    chatInput.value += randomEmoji;
    chatInput.focus();
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
    closePlusPopup();
  });

  newChatBtn.addEventListener('click', createNewChat);

  settingsNavBtn.addEventListener('click', openSettings);
  settingsClose.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', function(e) {
    if (e.target === this) closeSettings();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && settingsOverlay.classList.contains('active')) {
      closeSettings();
    }
  });

  hamburgerBtn.addEventListener('click', toggleSidebarDesktop);

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
    if (sidebar.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
    }
  });
  
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });

  collapseSidebar.addEventListener('click', function() {
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    } else {
      isSidebarCollapsed = !isSidebarCollapsed;
      sidebar.classList.toggle('collapsed', isSidebarCollapsed);
      const icon = hamburgerBtn.querySelector('i');
      icon.className = isSidebarCollapsed ? 'fas fa-bars' : 'fas fa-times';
    }
  });

  navHelp.addEventListener('click', function() {
    console.log('Help center opened');
  });
  navUpgrade.addEventListener('click', function() {
    console.log('Upgrade to Pro! 🚀');
  });

  // ===== SEARCH CHAT - FIXED =====
  searchChatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const query = this.value.trim().toLowerCase();
      if (query) {
        const ids = Object.keys(chatData);
        const found = ids.filter(id => 
          chatData[id].title.toLowerCase().includes(query)
        );
        if (found.length > 0) {
          // Highlight matching chats - TANPA menutup sidebar
          document.querySelectorAll('.chat-history-item').forEach(item => {
            const id = item.dataset.chatId;
            if (found.includes(id)) {
              item.style.background = '#2B2B2B';
              item.style.transition = 'background 0.3s';
              setTimeout(() => {
                item.style.background = '';
              }, 2000);
            }
          });
          console.log(`Found ${found.length} chat(s)`);
        } else {
          console.log('No chats found');
        }
      }
    }
  });

  // ===== PERBAIKAN: Search input tidak menutup sidebar =====
  searchChatInput.addEventListener('focus', function() {
    // Tidak melakukan apapun - biarkan sidebar tetap terbuka
    // Ini mencegah sidebar tertutup saat user mengetik di search
  });

  searchChatInput.addEventListener('click', function(e) {
    e.stopPropagation(); // Mencegah event bubbling yang bisa menutup sidebar
  });

  darkModeToggle.addEventListener('click', function() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('light-mode', !isDarkMode);
    darkModeIcon.className = isDarkMode ? 'fas fa-moon' : 'fas fa-sun';
  });

  let modelIndex = 0;
  const models = ['Zeph Lite', 'Zeph Pro', 'Zeph Vision'];
  modelDropdown.addEventListener('click', function() {
    modelIndex = (modelIndex + 1) % models.length;
    currentModel.textContent = models[modelIndex];
  });

  profileIcon.addEventListener('click', function() {
    console.log('Profile menu opened');
  });

  voiceBtn.addEventListener('click', function() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.start();
      recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        chatInput.value = transcript;
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
        handleSend();
      };
    }
  });

  clearChatBtn.addEventListener('click', function() {
    if (messageContainer.children.length > 0) {
      if (confirm('Clear all messages in this chat?')) {
        messageContainer.innerHTML = '';
        welcomeScreen.style.display = 'flex';
        if (currentChatId && chatData[currentChatId]) {
          delete chatData[currentChatId];
          delete chatTitleSet[currentChatId];
          currentChatId = null;
          renderChatHistory();
          saveChats();
        }
      }
    }
  });

  // ===== SETTINGS CONTROLS =====
  setupToggle('toggleHistory');
  setupToggle('toggleAutoScroll');
  setupToggle('toggleStreaming');

  const fontSizeRange = document.getElementById('settingFontSize');
  const fontSizeDisplay = document.getElementById('fontSizeDisplay');
  fontSizeRange.addEventListener('input', function() {
    fontSizeDisplay.textContent = this.value + 'px';
    document.querySelectorAll('.bubble, .chat-container, .input-wrapper textarea').forEach(el => {
      el.style.fontSize = this.value + 'px';
    });
  });

  const sidebarWidthRange = document.getElementById('settingSidebarWidth');
  const sidebarWidthDisplay = document.getElementById('sidebarWidthDisplay');
  sidebarWidthRange.addEventListener('input', function() {
    sidebarWidthDisplay.textContent = this.value + 'px';
    if (window.innerWidth > 768 && !isSidebarCollapsed) {
      sidebar.style.width = this.value + 'px';
      sidebar.style.minWidth = this.value + 'px';
    }
  });

  const bubbleRadiusRange = document.getElementById('settingBubbleRadius');
  const bubbleRadiusDisplay = document.getElementById('bubbleRadiusDisplay');
  bubbleRadiusRange.addEventListener('input', function() {
    bubbleRadiusDisplay.textContent = this.value + 'px';
    document.querySelectorAll('.bubble').forEach(b => {
      b.style.borderRadius = this.value + 'px';
    });
  });

  document.getElementById('settingTheme').addEventListener('change', function() {
    const isDark = this.value === 'dark';
    document.body.classList.toggle('light-mode', !isDark);
    isDarkMode = isDark;
    darkModeIcon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
  });

  document.getElementById('settingLanguage').addEventListener('change', function() {
    console.log(`Language: ${this.options[this.selectedIndex].text}`);
  });

  document.getElementById('settingAnimationSpeed').addEventListener('change', function() {
    console.log(`Animation speed: ${this.value}`);
  });

  document.getElementById('settingUsername').addEventListener('change', function() {
    console.log(`Username updated to "${this.value}"`);
  });

  document.getElementById('settingEmail').addEventListener('change', function() {
    console.log(`Email updated to "${this.value}"`);
  });

  document.getElementById('privacyPolicy').addEventListener('click', function() {
    console.log('Privacy Policy: Your data is encrypted and secure.');
  });
  
  document.getElementById('termsService').addEventListener('click', function() {
    console.log('Terms of Service: Standard terms apply.');
  });

  document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', function() {
      const text = this.getAttribute('data-text');
      chatInput.value = text;
      chatInput.focus();
      chatInput.style.height = 'auto';
      chatInput.style.height = chatInput.scrollHeight + 'px';
    });
  });

  // ===== WINDOW EVENTS =====
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
      if (isSidebarCollapsed) {
        sidebar.classList.add('collapsed');
      } else {
        sidebar.classList.remove('collapsed');
        const width = document.getElementById('settingSidebarWidth').value;
        sidebar.style.width = width + 'px';
        sidebar.style.minWidth = width + 'px';
      }
    } else {
      sidebar.classList.remove('collapsed');
      sidebar.style.width = '280px';
      sidebar.style.minWidth = '280px';
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    }
  });

  window.addEventListener('beforeunload', function() {
    if (currentChatId && messageContainer.children.length > 0) {
      saveCurrentChat();
    }
  });

  // ===== INIT =====
  window.addEventListener('load', () => {
    loadChats();
    renderChatHistory();
    chatInput.style.height = 'auto';
    const icon = hamburgerBtn.querySelector('i');
    icon.className = 'fas fa-times';
    const radius = document.getElementById('settingBubbleRadius').value;
    document.querySelectorAll('.bubble').forEach(b => {
      b.style.borderRadius = radius + 'px';
    });
    
    const ids = Object.keys(chatData);
    if (ids.length > 0) {
      const lastId = ids.sort((a, b) => (chatData[b].updatedAt || 0) - (chatData[a].updatedAt || 0))[0];
      if (lastId) {
        loadChat(lastId);
      }
    }
  });

  const observer = new MutationObserver(() => {
    const radius = document.getElementById('settingBubbleRadius').value;
    document.querySelectorAll('.bubble:not([style*="border-radius"])').forEach(b => {
      b.style.borderRadius = radius + 'px';
    });
  });
  observer.observe(messageContainer, { childList: true, subtree: true });

})();
