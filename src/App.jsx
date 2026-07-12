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
  Database
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
  
  // Document States
  const [activeDoc, setActiveDoc] = useState(() => {
    const saved = localStorage.getItem('docchat_active_doc')
    return saved ? JSON.parse(saved) : null
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
      title: "Summarize this document",
      body: "Provide a quick bulleted summary of the main topics covered."
    },
    {
      title: "Key highlights & takeaways",
      body: "What are the most important conclusions or details here?"
    },
    {
      title: "Find contact/personal info",
      body: "Are there any emails, phone numbers, or addresses listed?"
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
      // Remove trailing slash if present
      const formattedUrl = urlToCheck.replace(/\/$/, '')
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), 4000) // 4 second timeout
      
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
    if (activeDoc) {
      localStorage.setItem('docchat_active_doc', JSON.stringify(activeDoc))
    } else {
      localStorage.removeItem('docchat_active_doc')
    }
  }, [activeDoc])

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
        handleUpload(file)
      } else {
        setUploadError("Please upload a PDF file only.")
      }
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0])
    }
  }

  const handleUpload = async (file) => {
    setIsUploading(true)
    setUploadError('')
    
    const formData = new FormData()
    formData.append('file', file)

    const formattedUrl = apiUrl.replace(/\/$/, '')

    try {
      const response = await fetch(`${formattedUrl}/ansgo`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed with status code ${response.status}`)
      }

      const data = await response.json()
      
      const fileInfo = {
        name: file.name,
        size: formatBytes(file.size),
        total_chunks: data.total_chunks,
        status: data.status || 'Processed'
      }

      setActiveDoc(fileInfo)
      
      // Inject system message
      const systemMsg = {
        id: Date.now(),
        sender: 'system',
        text: `Successfully uploaded and indexed "${file.name}". ${data.total_chunks ? `Split into ${data.total_chunks} chunks.` : ''} You can now start asking questions.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      
      setMessages([systemMsg])
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
      const response = await fetch(`${formattedUrl}/ask?question=${encodeURIComponent(queryText)}`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Request failed with status code ${response.status}`)
      }

      const data = await response.json()
      
      // Simulate real-time streaming text (Word by Word)
      const fullAnswer = data.answer || "No response details were returned by the model."
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
          setTimeout(streamWords, 25) // Smooth typing effect delay
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

  // Clear or reset active document and chat history
  const handleResetSession = () => {
    setActiveDoc(null)
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
      {/* Sidebar Panel */}
      <aside className="sidebar glass">
        <div className="sidebar-header">
          <div className="logo-icon">
            <MessageSquare size={20} color="#ffffff" />
          </div>
          <span className="logo-text">DocChat AI</span>
        </div>

        <div className="sidebar-content">
          {/* Active Document Section */}
          <div className="sidebar-section">
            <span className="section-title">Active Document</span>
            {activeDoc ? (
              <div className="doc-info-card">
                <div className="doc-header">
                  <div className="doc-icon-wrapper">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="doc-name" title={activeDoc.name}>{activeDoc.name}</div>
                    <div className="doc-size">{activeDoc.size}</div>
                  </div>
                </div>
                <div className="doc-badge">
                  {activeDoc.total_chunks ? `${activeDoc.total_chunks} Chunks` : activeDoc.status}
                </div>
                <button className="btn btn-secondary" style={{ width: '100%', fontSize: '11px', padding: '6px' }} onClick={handleResetSession}>
                  Upload Different PDF
                </button>
              </div>
            ) : (
              <div className="doc-info-card" style={{ borderStyle: 'dashed', textAlign: 'center', padding: '24px 16px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No document active</p>
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
          {activeDoc && (
            <div className="sidebar-section">
              <span className="section-title">Actions</span>
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={handleClearHistory}
                disabled={messages.length === 0}
              >
                <Trash2 size={16} />
                Clear Chat History
              </button>
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
          <div className="header-title-container">
            <div className="header-title">
              {activeDoc ? activeDoc.name : 'AI Document Assistant'}
            </div>
            <div className="header-subtitle">
              {activeDoc ? `RAG-powered chat with ${activeDoc.size}` : 'Connect a PDF document to begin asking questions'}
            </div>
          </div>
          <div className="header-actions">
            <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Server connected' : 'Server disconnected'}></div>
            <button className="icon-btn" onClick={() => setIsSettingsOpen(true)} title="Settings">
              <Settings size={18} />
            </button>
          </div>
        </header>

        {!activeDoc ? (
          /* Welcome & Upload Screen */
          <div className="welcome-container">
            <div className="welcome-inner">
              <div className="welcome-logo-badge">
                <Sparkles size={38} />
              </div>
              <h2 className="welcome-title">DocChat Intelligent Assistant</h2>
              <p className="welcome-desc">
                Upload your document to split, chunk, and embed it using Chroma Cloud and Gemini 3.5. 
                Once processed, you can ask context-aware questions instantly!
              </p>

              {/* Upload Dropzone */}
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
                    onChange={handleFileChange}
                  />
                  <UploadCloud size={48} className="upload-zone-icon" />
                  <div>
                    <p className="upload-zone-text">Drag and drop your PDF here</p>
                    <p className="upload-zone-subtext">or click to browse from files</p>
                  </div>
                  {uploadError && (
                    <div style={{ color: 'var(--error)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <AlertCircle size={14} />
                      {uploadError}
                    </div>
                  )}
                </div>
              ) : (
                /* Uploading / Embedding Progress State */
                <div className="upload-progress-card">
                  <div className="progress-spinner"></div>
                  <div>
                    <p className="progress-text">Analyzing & Chunking Document...</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Generating text embeddings and saving to vector store
                    </p>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill"></div>
                  </div>
                </div>
              )}

              {/* Optional: bypass if Chroma already has documents */}
              {!isUploading && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ fontSize: '12px' }}
                    onClick={() => {
                      setActiveDoc({
                        name: "Chroma Vector DB Collection",
                        size: "Persistent Store",
                        total_chunks: null,
                        status: "Persistent"
                      })
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
                      <div style={{ 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid var(--border-color)', 
                        padding: '8px 16px', 
                        borderRadius: '20px', 
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
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
                          /* Loading indicator within bubbles for stream */
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
              <div style={{ padding: '0 24px', display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
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
                  placeholder="Ask a question about the document..."
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
