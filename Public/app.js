// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// State
let currentLang = 'en-US'; // 'en-US' or 'bn-BD'
let isListening = false;
let messageHistory = [];
let memories = JSON.parse(localStorage.getItem('assistant_memories') || '[]');
let masterPassword = localStorage.getItem('assistant_password') || '';

// DOM References
const orb = document.getElementById('ai-orb');
const orbState = document.getElementById('orb-state');
const chatContainer = document.getElementById('chat-container');
const textInput = document.getElementById('text-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const langToggle = document.getElementById('lang-toggle');
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeSettings = document.getElementById('close-settings');
const authPassInput = document.getElementById('auth-pass');
const memoryList = document.getElementById('memory-list');
const memCount = document.getElementById('mem-count');
const exportMemBtn = document.getElementById('export-mem-btn');
const clearMemBtn = document.getElementById('clear-mem-btn');
const confirmModal = document.getElementById('confirm-modal');
const confirmDesc = document.getElementById('confirm-desc');
const confirmActionBtn = document.getElementById('confirm-action-btn');
const cancelActionBtn = document.getElementById('cancel-action-btn');

authPassInput.value = masterPassword;
renderMemories();

// Language Toggle
langToggle.addEventListener('click', () => {
  if (currentLang === 'en-US') {
    currentLang = 'bn-BD';
    langToggle.innerText = '🌐 BN';
    orbState.innerText = 'বাংলা মোড সক্রিয়';
  } else {
    currentLang = 'en-US';
    langToggle.innerText = '🌐 EN';
    orbState.innerText = 'English Mode Active';
  }
});

// Settings Management
settingsBtn.onclick = () => {
  settingsModal.style.display = 'flex';
};

closeSettings.onclick = () => {
  masterPassword = authPassInput.value.trim();
  localStorage.setItem('assistant_password', masterPassword);
  settingsModal.style.display = 'none';
};

// Memory Handlers
function renderMemories() {
  memCount.innerText = memories.length;
  memoryList.innerHTML = '';
  memories.forEach((mem, index) => {
    const item = document.createElement('div');
    item.style.cssText = 'background:#0b0f19; padding:8px 12px; border-radius:6px; font-size:0.85rem; display:flex; justify-content:space-between; align-items:center;';
    item.innerHTML = `<span>${mem}</span> <button style="background:transparent;border:none;color:#ff4d4f;cursor:pointer;font-size:1rem;" onclick="deleteMemory(${index})">✕</button>`;
    memoryList.appendChild(item);
  });
}

window.deleteMemory = function(idx) {
  memories.splice(idx, 1);
  localStorage.setItem('assistant_memories', JSON.stringify(memories));
  renderMemories();
};

exportMemBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(memories, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `memories_${Date.now()}.json`;
  a.click();
};

clearMemBtn.onclick = () => {
  if (confirm('Are you sure you want to delete all long-term memories?')) {
    memories = [];
    localStorage.removeItem('assistant_memories');
    renderMemories();
  }
};

// Chat UI Helper
function appendMessage(role, text) {
  const msg = document.createElement('div');
  msg.className = `msg ${role}`;
  msg.innerText = text;
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Voice Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    orb.classList.add('listening');
    orbState.innerText = currentLang === 'bn-BD' ? 'শুনছি...' : 'Listening...';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    appendMessage('user', transcript);
    handleUserInput(transcript);
  };

  recognition.onerror = () => stopListening();
  recognition.onend = () => stopListening();
} else {
  orbState.innerText = 'Voice recognition unavailable in current browser';
}

function startListening() {
  if (!recognition) return;
  recognition.lang = currentLang;
  try {
    recognition.start();
  } catch(e) {}
}

function stopListening() {
  isListening = false;
  orb.classList.remove('listening');
  orbState.innerText = 'Tap orb or mic to speak';
}

orb.onclick = () => isListening ? stopListening() : startListening();
micBtn.onclick = () => isListening ? stopListening() : startListening();

// Voice Speech Synthesis
function speakResponse(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = currentLang;

  const voices = window.speechSynthesis.getVoices();
  const targetPrefix = currentLang.slice(0, 2);
  const matchedVoice = voices.find(v => v.lang.startsWith(targetPrefix));
  if (matchedVoice) utterance.voice = matchedVoice;

  window.speechSynthesis.speak(utterance);
}

// Send Actions
sendBtn.onclick = () => {
  const text = textInput.value.trim();
  if (!text) return;
  appendMessage('user', text);
  textInput.value = '';
  handleUserInput(text);
};

textInput.onkeydown = (e) => {
  if (e.key === 'Enter') sendBtn.click();
};

// Core Execution Engine
async function handleUserInput(inputText) {
  const lower = inputText.toLowerCase();

  // 1. Explicit Memory Command
  if (lower.startsWith('remember that') || lower.startsWith('মনে রাখো')) {
    const memoryContent = inputText.replace(/^(remember that|মনে রাখো)/i, '').trim();
    memories.push(memoryContent);
    localStorage.setItem('assistant_memories', JSON.stringify(memories));
    renderMemories();
    const reply = currentLang === 'bn-BD' ? 'আমি এটি আমার স্থায়ী মেমরিতে সংরক্ষণ করেছি।' : 'I have saved this to my persistent memory.';
    appendMessage('assistant', reply);
    speakResponse(reply);
    return;
  }

  // 2. Action confirmation for iPhone Shortcuts
  if (lower.startsWith('shortcut:') || lower.includes('run shortcut')) {
    const shortcutName = inputText.replace(/.*shortcut:? */i, '').trim();
    triggerConfirmation(`Run iPhone Shortcut: "${shortcutName}"?`, () => {
      window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}`;
    });
    return;
  }

  // 3. Offline Check
  if (!navigator.onLine) {
    const offlineReply = currentLang === 'bn-BD' 
      ? 'আপনি অফলাইনে আছেন। ইন্টারনেট ব্যতীত AI ব্রেন কাজ করতে পারে না।' 
      : 'You are offline. AI reasoning requires an active connection.';
    appendMessage('assistant', offlineReply);
    speakResponse(offlineReply);
    return;
  }

  // 4. Send to Backend
  const payload = [
    { role: 'system', content: `User's saved persistent memories: ${JSON.stringify(memories)}` },
    ...messageHistory.slice(-5),
    { role: 'user', content: inputText }
  ];

  orbState.innerText = currentLang === 'bn-BD' ? 'ভাবছি...' : 'Thinking...';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${masterPassword}`
      },
      body: JSON.stringify({ messages: payload, userLanguage: currentLang })
    });

    const data = await res.json();
    if (res.status === 401) {
      appendMessage('assistant', '⚠️ Unauthorized: Tap ⚙️ and enter your Master Passphrase.');
      orbState.innerText = 'Authentication required';
      return;
    }

    if (data.error) {
      appendMessage('assistant', `⚠️ Error: ${data.error}`);
      return;
    }

    const aiReply = data.reply;
    messageHistory.push({ role: 'user', content: inputText });
    messageHistory.push({ role: 'assistant', content: aiReply });

    appendMessage('assistant', aiReply);
    speakResponse(aiReply);
  } catch (err) {
    appendMessage('assistant', '⚠️ Communication failure with the server.');
  } finally {
    orbState.innerText = 'Tap orb or mic to speak';
  }
}

// Confirmation Dialog Helper
function triggerConfirmation(actionText, onConfirm) {
  confirmDesc.innerText = actionText;
  confirmModal.style.display = 'flex';

  confirmActionBtn.onclick = () => {
    confirmModal.style.display = 'none';
    onConfirm();
  };

  cancelActionBtn.onclick = () => {
    confirmModal.style.display = 'none';
    appendMessage('assistant', 'Action cancelled by user.');
  };
}
