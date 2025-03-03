// Basic popup functionality
document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const statusDiv = document.getElementById("status") as HTMLDivElement
  const suggestionDiv = document.getElementById("suggestion") as HTMLDivElement
  const sendButton = document.getElementById("send") as HTMLButtonElement
  const editButton = document.getElementById("edit") as HTMLButtonElement
  const chatHistoryDiv = document.getElementById("chatHistory") as HTMLDivElement
  const settingsButton = document.getElementById("settings") as HTMLButtonElement
  const generateButton = document.getElementById("generate") as HTMLButtonElement
  const spinner = document.querySelector(".loading-spinner") as HTMLElement
  const suggestionContainer = document.querySelector(".suggestion-container") as HTMLElement
  const messageCountBadge = document.getElementById("messageCount") as HTMLElement

  // Tab elements
  const tabs = document.querySelectorAll(".tab")
  const tabContents = document.querySelectorAll(".tab-content")

  // Competitor rates elements
  const zipInput = document.getElementById("zipCode") as HTMLInputElement
  const updateZipButton = document.getElementById("updateZip") as HTMLButtonElement
  const competitorRatesDiv = document.getElementById("competitorRates") as HTMLDivElement

  // Add proper types for chat history
  interface ChatMessage {
    role: string
    content: string
    timestamp?: string
  }

  // Add type for competitor rates
  interface CompetitorRate {
    provider: string
    speed: string
    price: string
    term: string
    icon: string
  }

  // Set initial status
  statusDiv.textContent = "Waiting for messages..."

  // Tab switching functionality
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabId = (tab as HTMLElement).dataset.tab

      // Update active tab
      tabs.forEach((t) => t.classList.remove("active"))
      tab.classList.add("active")

      // Show corresponding content
      tabContents.forEach((content) => {
        content.classList.remove("active")
        if (content.id === `${tabId}Tab`) {
          content.classList.add("active")
        }
      })
    })
  })

  function updateChatHistory(history: ChatMessage[]): void {
    if (history && history.length > 0) {
      displayChatHistory(history)
      statusDiv.textContent = "Chat history updated"
      messageCountBadge.textContent = history.length.toString()
    } else {
      chatHistoryDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <div class="empty-state-text">No messages yet</div>
          <div class="empty-state-subtext">Start chatting with Xfinity support to see messages here</div>
        </div>
      `
      statusDiv.textContent = "Waiting for new messages"
      messageCountBadge.textContent = "0"
    }
  }

  // Format timestamp
  function formatTimestamp(timestamp: string | undefined): string {
    if (!timestamp) {
      return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }

    // If timestamp is already in a readable format, return it
    if (timestamp.includes(":")) {
      return timestamp
    }

    // Otherwise, try to parse it
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } catch (e) {
      return timestamp
    }
  }

  // Request full state when popup opens
  chrome.runtime.sendMessage({ type: "getState" }, (state) => {
    console.log("Received state:", state)
    if (state) {
      updateChatHistory(state.chatHistory)

      if (state.currentSuggestion) {
        suggestionDiv.textContent = state.currentSuggestion
        statusDiv.textContent = "Suggestion ready"
        updateUIState(true)
      }

      if (state.lastError) {
        statusDiv.textContent = `Error: ${state.lastError}`
        statusDiv.classList.add("error")
      }

      // Load saved ZIP code if available
      if (state.zipCode) {
        zipInput.value = state.zipCode
        loadCompetitorRates(state.zipCode)
      }
    } else {
      console.log("No state received")
      chatHistoryDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <div class="empty-state-text">No messages yet</div>
          <div class="empty-state-subtext">Start chatting with Xfinity support to see messages here</div>
        </div>
      `
      statusDiv.textContent = "Waiting for connection..."
      messageCountBadge.textContent = "0"
    }
  })

  function displayChatHistory(history: Array<{ role: string; content: string; timestamp?: string }>): void {
    if (!chatHistoryDiv) return

    chatHistoryDiv.innerHTML = ""

    if (history.length === 0) {
      chatHistoryDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <div class="empty-state-text">No messages yet</div>
          <div class="empty-state-subtext">Start chatting with Xfinity support to see messages here</div>
        </div>
      `
      return
    }

    history.forEach((message, index) => {
      const messageElement = document.createElement("div")
      messageElement.classList.add("chat-message")
      messageElement.classList.add(message.role === "user" ? "user-message" : "assistant-message")

      const formattedTime = formatTimestamp(message.timestamp)

      messageElement.innerHTML = `
        <div class="name-tag">${message.role === "user" ? "You" : "Agent"}</div>
        <div class="message-bubble">
          ${message.content}
          <div class="message-time">${formattedTime}</div>
        </div>
      `

      chatHistoryDiv.appendChild(messageElement)
    })

    // Scroll to the bottom of the chat history
    chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight
  }

  settingsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage()
  })

  // Check if we're on Xfinity chat page
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url
    if (!url?.includes("xfinity.com")) {
      statusDiv.textContent = "Please navigate to Xfinity chat"
      statusDiv.classList.add("error")
      return
    }
  })

  // Update UI state based on suggestion
  function updateUIState(hasSuggestion: boolean) {
    sendButton.disabled = !hasSuggestion
    editButton.disabled = !hasSuggestion
    suggestionContainer.classList.toggle("has-suggestion", hasSuggestion)
  }

  // Initially disable secondary buttons
  updateUIState(false)

  // Listen for suggestions from background script
  chrome.runtime.onMessage.addListener((message: { type: string; text?: string }) => {
    if (message.type === "suggestion" && message.text) {
      suggestionDiv.textContent = message.text
      statusDiv.textContent = "Suggestion ready"
      statusDiv.classList.remove("error")
      statusDiv.classList.add("success")
      updateUIState(true)
      // Reset loading state
      generateButton.disabled = false
      spinner.style.display = "none"
    }
    if (message.type === "error") {
      statusDiv.textContent = "Error generating response"
      statusDiv.classList.add("error")
      updateUIState(false)
      // Reset loading state on error too
      generateButton.disabled = false
      spinner.style.display = "none"
    }
  })

  // Listen for chat history updates
  chrome.runtime.onMessage.addListener(
    (message: {
      type: string
      text?: string
      payload?: ChatMessage[]
    }) => {
      if (message.type === "chatHistoryUpdated" && message.payload) {
        updateChatHistory(message.payload)
      }
    },
  )

  // Send message handlers
  sendButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: "sendMessage",
          text: suggestionDiv.textContent,
        })

        // Clear suggestion after sending
        suggestionDiv.textContent = ""
        updateUIState(false)

        // Update status
        statusDiv.textContent = "Message sent!"
        statusDiv.classList.remove("error")
        statusDiv.classList.add("success")

        // Reset after 2 seconds
        setTimeout(() => {
          statusDiv.textContent = "Waiting for response..."
          statusDiv.classList.remove("success")
        }, 2000)
      }
    })
  })

  editButton.addEventListener("click", () => {
    suggestionDiv.contentEditable = "true"
    suggestionDiv.focus()

    // Place cursor at the end
    const range = document.createRange()
    range.selectNodeContents(suggestionDiv)
    range.collapse(false)
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }

    // Change edit button to save
    editButton.textContent = "Save"
    editButton.innerHTML = `
      <svg class="icon icon-sm" viewBox="0 0 24 24">
        <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
      </svg>
      Save
    `

    // Change function to save when clicked again
    const saveFunction = () => {
      suggestionDiv.contentEditable = "false"
      editButton.innerHTML = `
        <svg class="icon icon-sm" viewBox="0 0 24 24">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
        Edit
      `
      editButton.removeEventListener("click", saveFunction)
      editButton.addEventListener("click", () => {
        suggestionDiv.contentEditable = "true"
        suggestionDiv.focus()
      })
    }

    editButton.removeEventListener("click", () => {
      suggestionDiv.contentEditable = "true"
      suggestionDiv.focus()
    })

    editButton.addEventListener("click", saveFunction)
  })

  // Update generate button handler
  generateButton.addEventListener("click", async () => {
    // Prevent multiple clicks
    if (generateButton.disabled) return

    try {
      // Show loading state
      generateButton.disabled = true
      spinner.style.display = "inline-block"
      statusDiv.textContent = "Generating response..."
      statusDiv.classList.remove("error", "success")

      // Get ZIP code for context if available
      const zipCode = zipInput.value

      await chrome.runtime.sendMessage({
        type: "generateResponse",
        zipCode: zipCode,
      })
    } catch (error) {
      statusDiv.textContent = "Error generating response"
      statusDiv.classList.add("error")
      console.error("Error generating response:", error)
      // Reset loading state
      generateButton.disabled = false
      spinner.style.display = "none"
    }
  })

  // Mock function to get competitor rates - in a real implementation, this would call an API
  function getCompetitorRates(zipCode: string): CompetitorRate[] {
    // This is mock data - in a real implementation, you would fetch this from an API
    return [
      {
        provider: "AT&T",
        speed: "300 Mbps",
        price: "$49.99/mo",
        term: "12 months",
        icon: "A",
      },
      {
        provider: "Spectrum",
        speed: "500 Mbps",
        price: "$69.99/mo",
        term: "24 months",
        icon: "S",
      },
      {
        provider: "Verizon Fios",
        speed: "1 Gbps",
        price: "$89.99/mo",
        term: "No contract",
        icon: "V",
      },
    ]
  }

  // Load and display competitor rates
  function loadCompetitorRates(zipCode: string): void {
    if (!zipCode || zipCode.length !== 5 || !/^\d+$/.test(zipCode)) {
      competitorRatesDiv.innerHTML = `
        <div class="status error">Please enter a valid 5-digit ZIP code</div>
      `
      return
    }

    // Save ZIP code to state
    chrome.runtime.sendMessage({
      type: "saveZipCode",
      zipCode: zipCode,
    })

    const rates = getCompetitorRates(zipCode)

    if (rates.length === 0) {
      competitorRatesDiv.innerHTML = `
        <div class="status">No competitor rates found for this ZIP code</div>
      `
      return
    }

    competitorRatesDiv.innerHTML = ""

    rates.forEach((rate) => {
      const rateElement = document.createElement("div")
      rateElement.classList.add("competitor-card")

      // Create a random color for the provider icon
      const colors = ["#0061df", "#2ecc71", "#e74c3c", "#f39c12", "#9b59b6"]
      const randomColor = colors[Math.floor(Math.random() * colors.length)]

      rateElement.innerHTML = `
        <div class="competitor-header">
          <div class="competitor-name">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background-color: ${randomColor}; color: white; font-weight: bold; margin-right: 8px;">
              ${rate.icon}
            </span>
            ${rate.provider}
          </div>
          <div class="competitor-price">${rate.price}</div>
        </div>
        <div class="competitor-details">
          <svg class="icon icon-sm" viewBox="0 0 24 24" style="color: #6c757d;">
            <path d="M15.9 5c-.17 0-.32.09-.41.23l-.07.15-5.18 11.65c-.16.29-.26.61-.26.96 0 1.11.9 2.01 2.01 2.01.96 0 1.77-.68 1.96-1.59l.01-.03L16.4 5.5c0-.28-.22-.5-.5-.5zM1 9l2 2c2.88-2.88 6.79-4.08 10.53-3.62l1.19-2.68C9.89 3.84 4.74 5.27 1 9zm20 2l2-2c-1.64-1.64-3.55-2.82-5.59-3.57l-.53 2.82c1.5.62 2.9 1.53 4.12 2.75zm-4 4l2-2c-.8-.8-1.7-1.42-2.66-1.89l-.55 2.92c.42.27.83.59 1.21.97zM5 13l2 2c1.13-1.13 2.56-1.79 4.03-2l1.28-2.88c-2.63-.08-5.3.87-7.31 2.88z"/>
          </svg>
          ${rate.speed}
          <span style="margin: 0 8px; color: #6c757d;">•</span>
          <svg class="icon icon-sm" viewBox="0 0 24 24" style="color: #6c757d;">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
          </svg>
          ${rate.term}
        </div>
      `

      competitorRatesDiv.appendChild(rateElement)
    })
  }

  // Handle ZIP code update
  updateZipButton.addEventListener("click", () => {
    loadCompetitorRates(zipInput.value)
  })

  // Also update when Enter key is pressed in the ZIP input
  zipInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      loadCompetitorRates(zipInput.value)
    }
  })
})

