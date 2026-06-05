class SuggestiveSearch {
  constructor(inputElement, options = {}) {
    this.input = inputElement
    this.onChange = options.onChange || (() => {})
    this.suggestions = options.suggestions || [
      "Search movies...",
      "Find users...",
      "Discover trends...",
    ]
    this.effect = options.effect || "typewriter"
    this.typeDurationMs = options.typeDurationMs || 700
    this.deleteDurationMs = options.deleteDurationMs || 400
    this.pauseAfterTypeMs = options.pauseAfterTypeMs || 1500

    this.state = {
      search: "",
      index: 0,
      focused: false,
    }

    this.overlay = document.getElementById("searchOverlay")
    this.placeholder = this.overlay?.querySelector(".search-placeholder")
    this.cursor = null

    this.bindEvents()
    this.updateOverlayVisibility()
    this.startAnimation()
  }

  bindEvents() {
    this.input.addEventListener("focus", () => {
      this.state.focused = true
      this.updateOverlayVisibility()
    })

    this.input.addEventListener("blur", () => {
      this.state.focused = false
      this.updateOverlayVisibility()
    })

    this.input.addEventListener("input", (e) => {
      this.state.search = e.target.value
      this.onChange(e.target.value)
      this.updateOverlayVisibility()
    })
  }

  updateOverlayVisibility() {
    if (this.overlay) {
      this.overlay.style.display =
        this.state.search === "" && !this.state.focused ? "flex" : "none"
    }
  }

  startAnimation() {
    if (this.effect === "typewriter") {
      this.typewriterEffect()
    } else if (this.effect === "slide") {
      this.slideEffect()
    } else if (this.effect === "fade") {
      this.fadeEffect()
    }
  }

  showCursor() {
    if (!this.cursor) {
      this.cursor = document.createElement("span")
      this.cursor.className = "typewriter-cursor"
      this.placeholder.appendChild(this.cursor)
    }
  }

  hideCursor() {
    if (this.cursor) {
      this.cursor.remove()
      this.cursor = null
    }
  }

  typewriterEffect() {
    const text = this.suggestions[this.state.index] || ""
    let charIndex = 0
    this.hideCursor()
    this.placeholder.textContent = ""

    const type = () => {
      if (charIndex <= text.length) {
        this.placeholder.textContent = text.slice(0, charIndex)
        charIndex++
        setTimeout(type, Math.max(30, this.typeDurationMs / text.length))
      } else {
        this.showCursor()
        setTimeout(() => {
          this.deleteText(text)
        }, this.pauseAfterTypeMs)
      }
    }

    type()
  }

  deleteText(text) {
    let charIndex = text.length
    const deleteInterval = setInterval(() => {
      charIndex--
      this.placeholder.textContent = text.slice(0, charIndex)
      this.placeholder.appendChild(this.cursor)

      if (charIndex === 0) {
        clearInterval(deleteInterval)
        this.hideCursor()
        this.state.index = (this.state.index + 1) % this.suggestions.length
        this.typewriterEffect()
      }
    }, Math.max(20, this.deleteDurationMs / text.length))
  }

  slideEffect() {
    const text = this.suggestions[this.state.index] || ""
    this.placeholder.textContent = text
    this.placeholder.className = "search-placeholder slide-effect"

    this.placeholder.classList.remove("slide-down")
    this.placeholder.classList.add("slide-up")

    setTimeout(() => {
      this.placeholder.classList.remove("slide-up")
      this.placeholder.classList.add("slide-down")

      setTimeout(() => {
        this.state.index = (this.state.index + 1) % this.suggestions.length
        this.slideEffect()
      }, this.deleteDurationMs)
    }, this.typeDurationMs + this.pauseAfterTypeMs)
  }

  fadeEffect() {
    const text = this.suggestions[this.state.index] || ""
    this.placeholder.textContent = text
    this.placeholder.className = "search-placeholder fade-effect"

    this.placeholder.classList.remove("fade-out")
    this.placeholder.classList.add("fade-in")

    setTimeout(() => {
      this.placeholder.classList.remove("fade-in")
      this.placeholder.classList.add("fade-out")

      setTimeout(() => {
        this.state.index = (this.state.index + 1) % this.suggestions.length
        this.fadeEffect()
      }, this.deleteDurationMs)
    }, this.typeDurationMs + this.pauseAfterTypeMs)
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput")
  if (searchInput) {
    new SuggestiveSearch(searchInput, {
      suggestions: [
        "جستجو در خدمات...",
        "پیش ثبت نام مدارس...",
        "وام ازدواج...",
        "کنکور سراسری...",
      ],
      effect: "typewriter",
    })
  }
})