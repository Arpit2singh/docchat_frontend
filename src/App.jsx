import { useState, useEffect, useRef } from 'react'
import { 
  MessageSquare, 
  UploadCloud, 
  FileText, 
  Settings, 
  Send, 
  Trash2, 
  HelpCircle, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  RefreshCw, 
  File, 
  ChevronRight,
  X,
  Database,
  Menu,
  Plus
} from 'lucide-react'

// Default Backend URL
const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  // App States
  const [apiUrl, setApiUrl] = useState(() => {
    return localStorage.getItem('docchat_api_url') || DEFAULT_API_URL
  })
  const [tempUrl, setTempUrl] = useState(apiUrl)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  // Document States (Multiple files supported)
  const [activeDocs, setActiveDocs] = useState(() => {
    const saved = localStorage.getItem('docchat_active_docs')
    return saved ? JSON.parse(saved) : []
  })
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [dragActive, setDragActive] = useState(false)

  // Chat States
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('docchat_messages')
    return saved ? JSON.parse(saved) : []
  })
  const [inputMessage, setInputMessage] = useState('')
  const [isBotResponding, setIsBotResponding] = useState(false)
  
  // Auto-scroll ref
  const chatEndRef = useRef(null)
  const fileInputRef = useRef(null)

  // Quick prompts for empty state
  const quickPrompts = [
    {
      title: "Summarize the documents",
      body: "Provide a quick bulleted summary of the main topics covered across all documents."
    },
    {
      title: "Key highlights & takeaways",
      body: "What are the most important conclusions or details here?"
    },
    {
      title: "Find personal or contact info",
      body: "Are there any emails, phone numbers, or addresses listed in the files?"
    },
    {
      title: "Explain the main concept",
      body: "Break down the core theme or thesis in simple terms."
    }
  ]

  // Monitor connection status
  const checkBackendStatus = async (urlToCheck = apiUrl) => {
    setIsCheckingStatus(true)
    try {
      const formattedUrl = urlToCheck.replace(/\/$/, '')
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), 4000)
      
      const response = await fetch(`${formattedUrl}/`, { 
        method: 'GET',
        signal: controller.signal
      })
      clearTimeout(id)
      
      if (response.ok) {
        setIsOnline(true)
      } else {
        setIsOnline(false)
      }
    } catch (error) {
      console.error("Backend status check failed:", error)
      setIsOnline(false)
    } finally {
      setIsCheckingStatus(false)
    }
  }

  // Check connection on mount and when API URL changes
  useEffect(() => {
    checkBackendStatus()
  }, [apiUrl])

  // Save state updates
  useEffect(() => {
    localStorage.setItem('docchat_messages', JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    localStorage.setItem('docchat_active_docs', JSON.stringify(activeDocs))
  }, [activeDocs])

  // Scroll to bottom helper
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isBotResponding])

  // Settings Handlers
  const handleSaveSettings = () => {
    let cleanUrl = tempUrl.trim()
    if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `http://${cleanUrl}`
    }
    setApiUrl(cleanUrl)
    localStorage.setItem('docchat_api_url', cleanUrl)
    setIsSettingsOpen(false)
  }

  // File Upload Logic
  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files)
      const pdfFiles = files.filter(file => file.type === "application/pdf" || file.name.endsWith('.pdf'))
      
      if (pdfFiles.length > 0) {
        handleUpload(pdfFiles)
      } else {
        setUploadError("Please upload PDF files only.")
      }
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(Array.from(e.target.files))
    }
  }

  const handleUpload = async (files) => {
    setIsUploading(true)
    setUploadError('')
    
    const formattedUrl = apiUrl.replace(/\/$/, '')
    
    // We will attempt to send all files to the `/upload` endpoint in a single request.
    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
      formData.append('file', file) // fallback for single-file API expectations
    })

    try {
      let response = await fetch(`${formattedUrl}/upload`, {
        method: 'POST',
        body: formData,
      })

      // Fallback: If /upload route returns 404/500, and it's a single file, try the old /ansgo route.
      if (!response.ok && files.length === 1) {
        console.warn("/upload failed, trying fallback to /ansgo")
        const fallbackFormData = new FormData()
        fallbackFormData.append('file', files[0])
        response = await fetch(`${formattedUrl}/ansgo`, {
          method: 'POST',
          body: fallbackFormData,
        })
      }

      if (!response.ok) {
        throw new Error(`Upload failed with status code ${response.status}`)
      }

      const data = await response.json()
      
      const newDocs = files.map((file, idx) => ({
        id: Date.now().toString() + idx + Math.random().toString(36).substr(2, 5),
        name: file.name,
        size: formatBytes(file.size),
        total_chunks: data.total_chunks || null,
        status: data.status || 'Processed'
      }))

      setActiveDocs(prev => [...prev, ...newDocs])
      
      // Inject system message
      const systemMsg = {
        id: Date.now(),
        sender: 'system',
        text: `Successfully uploaded and indexed ${files.length} document(s). ${data.total_chunks ? `Split into ${data.total_chunks} chunks total.` : ''} You can now ask questions!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      
      setMessages(prev => [...prev, systemMsg])
    } catch (error) {
      console.error("Upload error:", error)
      setUploadError(error.message || "An error occurred during file parsing.")
    } finally {
      setIsUploading(false)
    }
  }

  // Ask Question Logic
  const handleSendMessage = async (textToSend) => {
    const queryText = textToSend || inputMessage
    if (!queryText.trim()) return

    // Clear input
    if (!textToSend) setInputMessage('')

    // Add user message
    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setMessages(prev => [...prev, userMsg])
    
    setIsBotResponding(true)

    const formattedUrl = apiUrl.replace(/\/$/, '')

    try {
      let response;
      let isFallback = false;
      
      // Try GET /getanswer?ques=... first
      try {
        response = await fetch(`${formattedUrl}/getanswer?ques=${encodeURIComponent(queryText)}`, {
          method: 'GET'
        })
        if (!response.ok && response.status === 404) {
          isFallback = true
        }
      } catch (err) {
        console.warn("GET /getanswer failed, falling back to /ask...", err)
        isFallback = true
      }

      // Fallback to POST /ask?question=...
      if (isFallback) {
        response = await fetch(`${formattedUrl}/ask?question=${encodeURIComponent(queryText)}`, {
          method: 'POST',
        })
      }

      if (!response.ok) {
        throw new Error(`Request failed with status code ${response.status}`)
      }

      const data = await response.json()
      
      // Resilient answer extraction
      let fullAnswer = ""
      if (data && typeof data === 'object') {
        fullAnswer = data.answer || data.response || data.message || JSON.stringify(data)
      } else {
        fullAnswer = data || "No response details were returned by the model."
      }

      const words = fullAnswer.split(' ')
      let currentText = ''
      
      const botMsgId = Date.now() + 1
      
      // Create initial empty bot message
      setMessages(prev => [...prev, {
        id: botMsgId,
        sender: 'bot',
        text: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])

      let wordIndex = 0
      
      const streamWords = () => {
        if (wordIndex < words.length) {
          currentText += (wordIndex === 0 ? '' : ' ') + words[wordIndex]
          setMessages(prev => prev.map(msg => 
            msg.id === botMsgId ? { ...msg, text: currentText } : msg
          ))
          wordIndex++
          setTimeout(streamWords, 20)
        } else {
          setIsBotResponding(false)
        }
      }
      
      streamWords()

    } catch (error) {
      console.error("Ask query error:", error)
      setMessages(prev => [...prev, {
        id: Date.now() + 2,
        sender: 'bot',
        text: `Error communicating with backend: ${error.message}. Please check if the FastAPI backend is running and the connection status is green.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
      setIsBotResponding(false)
    }
  }

  // Remove a single file
  const handleRemoveDoc = (idToRemove) => {
    setActiveDocs(prev => prev.filter(doc => doc.id !== idToRemove))
  }

  // Clear session
  const handleResetSession = () => {
    setActiveDocs([])
    setMessages([])
    setUploadError('')
  }

  const handleClearHistory = () => {
    setMessages([])
  }

  // Helper formatting size bytes
  function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
  }

  return (
    <div className="app-container">
      {/* Sidebar Backdrop Overlay for Mobile Screen sizes */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar Panel */}
      <aside className={`sidebar glass ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-icon">
            <MessageSquare size={20} color="#ffffff" />
          </div>
          <span className="logo-text">DocChat AI</span>
          
          <button 
            className="sidebar-close-btn"
            onClick={() => setIsSidebarOpen(false)}
            title="Close Sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-content">
          {/* Active Documents Section */}
          <div className="sidebar-section">
            <span className="section-title">Active Documents ({activeDocs.length})</span>
            {activeDocs.length > 0 ? (
              <div className="docs-list">
                {activeDocs.map((doc) => (
                  <div key={doc.id} className="doc-info-card">
                    <div className="doc-header">
                      <div className="doc-icon-wrapper">
                        <FileText size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="doc-name" title={doc.name}>{doc.name}</div>
                        <div className="doc-size">{doc.size}</div>
                      </div>
                      <button 
                        className="remove-doc-btn" 
                        onClick={() => handleRemoveDoc(doc.id)}
                        title="Remove document"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {doc.total_chunks && (
                      <div className="doc-badge">
                        {doc.total_chunks} Chunks
                      </div>
                    )}
                  </div>
                ))}
                
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', fontSize: '11px', marginTop: '10px', padding: '8px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus size={14} />
                  Add More PDFs
                </button>
              </div>
            ) : (
              <div className="doc-info-card" style={{ borderStyle: 'dashed', textAlign: 'center', padding: '24px 16px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No documents loaded</p>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', fontSize: '11px', marginTop: '12px', padding: '8px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select File
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions Panel */}
          {activeDocs.length > 0 && (
            <div className="sidebar-section">
              <span className="section-title">Session Actions</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={handleClearHistory}
                  disabled={messages.length === 0}
                >
                  <Trash2 size={16} />
                  Clear Chat History
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--error)' }}
                  onClick={handleResetSession}
                >
                  <RefreshCw size={16} />
                  Reset Session
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer Details */}
        <div className="sidebar-footer">
          <div className="status-indicator">
            <div className={`status-dot ${isOnline ? 'online' : 'offline'}`}></div>
            <span>Backend: {isOnline ? 'Online' : 'Offline'}</span>
            <button 
              className="icon-btn" 
              style={{ width: '24px', height: '24px', marginLeft: 'auto' }}
              onClick={() => checkBackendStatus()}
              disabled={isCheckingStatus}
              title="Refresh connection status"
            >
              <RefreshCw size={12} className={isCheckingStatus ? 'spin' : ''} style={{ animation: isCheckingStatus ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
          
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%' }}
            onClick={() => {
              setTempUrl(apiUrl)
              setIsSettingsOpen(true)
            }}
          >
            <Settings size={16} />
            Configure Server
          </button>
        </div>
      </aside>

      {/* Main Chat Container */}
      <main className="main-content">
        <header className="chat-header glass" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <button 
            className="menu-toggle-btn"
            onClick={() => setIsSidebarOpen(true)}
            title="Open Sidebar"
          >
            <Menu size={20} />
          </button>

          <div className="header-title-container">
            <div className="header-title">
              {activeDocs.length > 0 
                ? (activeDocs.length === 1 ? activeDocs[0].name : `${activeDocs.length} Documents loaded`) 
                : 'AI Document Assistant'}
            </div>
            <div className="header-subtitle">
              {activeDocs.length > 0 
                ? `RAG-powered chat across your documents` 
                : 'Connect PDF documents to begin asking questions'}
            </div>
          </div>
          
          <div className="header-actions">
            <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Server connected' : 'Server disconnected'}></div>
            <button className="icon-btn" onClick={() => setIsSettingsOpen(true)} title="Settings">
              <Settings size={18} />
            </button>
          </div>
        </header>

        {activeDocs.length === 0 ? (
          /* ═══════════════════════════════════════════════════════
             DASHBOARD FRONTPAGE 
             ═══════════════════════════════════════════════════════ */
          <div className="welcome-container">
            <div className="welcome-inner dashboard-layout">

              {/* ── Hero Section ── */}
              <section className="hero-section">
                <div className="hero-glow"></div>
                <div className="hero-badge animate-float">
                  <div className="hero-badge-ring"></div>
                  <Sparkles size={36} />
                </div>
                <h1 className="hero-title">
                  Doc<span className="hero-title-accent">Chat</span> AI
                </h1>
                <p className="hero-tagline">Intelligent Multi-Document Assistant</p>
                <p className="hero-desc">
                  Upload PDFs, analyze content with AI-powered RAG, and get instant 
                  context-aware answers across all your documents.
                </p>

                {/* Status Pills */}
                <div className="hero-status-row">
                  <div className={`hero-pill ${isOnline ? 'online' : 'offline'}`}>
                    <div className={`status-dot ${isOnline ? 'online' : 'offline'}`}></div>
                    {isOnline ? 'Backend Online' : 'Backend Offline'}
                  </div>
                  <div className="hero-pill neutral">
                    <Database size={12} />
                    ChromaDB + Gemini
                  </div>
                </div>
              </section>

              {/* ── Feature Cards Grid ── */}
              <section className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon-wrap purple">
                    <UploadCloud size={22} />
                  </div>
                  <h3 className="feature-title">Multi-File Upload</h3>
                  <p className="feature-desc">Upload multiple PDFs at once. Drag & drop or browse to get started instantly.</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon-wrap blue">
                    <Sparkles size={22} />
                  </div>
                  <h3 className="feature-title">AI-Powered RAG</h3>
                  <p className="feature-desc">Documents are chunked, embedded, and stored for semantic retrieval using Gemini.</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon-wrap green">
                    <MessageSquare size={22} />
                  </div>
                  <h3 className="feature-title">Chat Interface</h3>
                  <p className="feature-desc">Ask natural language questions and get precise, context-aware answers in real time.</p>
                </div>
              </section>

              {/* ── Upload Zone ── */}
              <section className="upload-section">
                <h2 className="upload-section-title">Get Started</h2>
                {!isUploading ? (
                  <div 
                    className={`upload-zone ${dragActive ? 'dragging' : ''}`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      style={{ display: 'none' }} 
                      accept=".pdf" 
                      multiple
                      onChange={handleFileChange}
                    />
                    <div className="upload-zone-icon-wrap">
                      <UploadCloud size={40} className="upload-zone-icon" />
                    </div>
                    <div>
                      <p className="upload-zone-text">Drag & drop your PDFs here</p>
                      <p className="upload-zone-subtext">or click to browse · supports multiple files</p>
                    </div>
                    {uploadError && (
                      <div className="upload-error">
                        <AlertCircle size={14} />
                        {uploadError}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="upload-progress-card">
                    <div className="progress-spinner"></div>
                    <div>
                      <p className="progress-text">Analyzing & Chunking Documents...</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Generating text embeddings and saving to vector store
                      </p>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill"></div>
                    </div>
                  </div>
                )}

                {/* Chroma bypass */}
                {!isUploading && (
                  <div className="upload-actions-row">
                    <button 
                      className="btn btn-secondary btn-chroma" 
                      onClick={() => {
                        const collectionDoc = {
                          id: 'chroma-collection',
                          name: "Chroma Vector DB Collection",
                          size: "Persistent Store",
                          total_chunks: null,
                          status: "Persistent"
                        }
                        setActiveDocs([collectionDoc])
                        setMessages([{
                          id: Date.now(),
                          sender: 'system',
                          text: "Connected to the persistent Chroma cloud collection directly. Ask questions about previously uploaded documents.",
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }])
                      }}
                    >
                      <Database size={14} />
                      Chat with existing Chroma collection
                    </button>
                  </div>
                )}
              </section>

              {/* ── Footer branding ── */}
              <p className="dashboard-footer-text">
                Powered by <strong>FastAPI</strong> · <strong>ChromaDB</strong> · <strong>Google Gemini</strong>
              </p>
            </div>
          </div>
        ) : (
          /* Chat Feed Interface */
          <>
            <div className="chat-feed">
              {messages.map((msg) => {
                if (msg.sender === 'system') {
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '8px 0' }}>
                      <div className="system-message">
                        <CheckCircle size={14} color="var(--success)" />
                        <span>{msg.text}</span>
                      </div>
                    </div>
                  )
                }

                const isUser = msg.sender === 'user'
                return (
                  <div key={msg.id} className={`message-wrapper ${isUser ? 'user' : 'bot'}`}>
                    <div className={`avatar ${isUser ? 'user' : 'bot'}`}>
                      {isUser ? 'U' : 'AI'}
                    </div>
                    <div>
                      <div className="message-bubble">
                        {msg.text || (
                          <div className="typing-indicator">
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                          </div>
                        )}
                      </div>
                      <span className="message-time">{msg.timestamp}</span>
                    </div>
                  </div>
                )
              })}
              
              {/* Bot thinking bubble */}
              {isBotResponding && messages.length > 0 && messages[messages.length - 1].sender === 'user' && (
                <div className="message-wrapper bot">
                  <div className="avatar bot">AI</div>
                  <div>
                    <div className="message-bubble">
                      <div className="typing-indicator">
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>

            {/* Quick starter hints inside chat when history is short */}
            {messages.length <= 1 && (
              <div className="quick-prompts-wrapper">
                <div className="prompts-grid">
                  {quickPrompts.map((p, idx) => (
                    <div key={idx} className="prompt-card" onClick={() => handleSendMessage(p.title)}>
                      <div className="prompt-title">{p.title}</div>
                      <div className="prompt-body">{p.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Input Box */}
            <div className="chat-input-container">
              <div className="chat-input-wrapper">
                <textarea
                  className="chat-input"
                  placeholder="Ask a question about your documents..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  rows={1}
                />
                <button 
                  className="send-btn" 
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isBotResponding}
                  title="Send message"
                >
                  {isBotResponding ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Settings Modal (Backend URL Config) */}
      {isSettingsOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <div className="modal-header">
              <h3 className="modal-title">Server Configuration</h3>
              <button className="icon-btn" onClick={() => setIsSettingsOpen(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="form-group">
              <label className="form-label">FastAPI Backend URL</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. http://localhost:8000"
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Specify the address of your running FastAPI app. Default is `{DEFAULT_API_URL}`.
              </p>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setIsSettingsOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveSettings}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
