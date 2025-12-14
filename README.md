# Tyler Schwenk Portfolio Website

Professional portfolio website showcasing software development projects and background music player.

## 🌐 Live Site
Visit: [tyler-schwenk.github.io](https://tyler-schwenk.github.io)

## 📋 Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Code Architecture](#code-architecture)
- [Setup & Development](#setup--development)
- [Technologies Used](#technologies-used)
- [Code Standards](#code-standards)

## 🎯 Overview

This is a professional portfolio website built to showcase software development projects and experience. The site features a clean, responsive design with integrated background music functionality.

### Template Credit
Built on the **Miniport** template by HTML5 UP (html5up.net)  
Licensed under CCA 3.0 (html5up.net/license)

## ✨ Features

### Core Features
- **Responsive Design**: Fully responsive layout optimized for desktop, tablet, and mobile
- **Project Showcase**: Highlighted projects including Ribbit Radar and Trade Routes
- **Professional Contact Section**: Direct email contact and social media links

### Music Player
- **Background Album Playback**: Integrated music player for album "Tezeta" by Hailu Mergia & The Walias Band
- **Full Playback Controls**: Play/pause, previous, next, and volume controls
- **Album Art Display**: Visual album artwork with artist/album information
- **Auto-advance**: Automatically plays next track when current track ends
- **Persistent UI**: Fixed bottom player that stays visible while scrolling

## 📁 Project Structure

```
tyler-schwenk.github.io/
├── index.html                 # Main portfolio page
├── assets/
│   ├── css/
│   │   ├── main.css          # Main stylesheet (with music player styles)
│   │   └── fontawesome-all.min.css
│   ├── js/
│   │   ├── music-player.js   # Music player module (refactored)
│   │   ├── main.js           # Site initialization
│   │   ├── util.js           # Utility functions
│   │   └── [vendor scripts]  # jQuery, breakpoints, etc.
│   └── webfonts/             # Custom Red Alert fonts
├── audio/                    # Album tracks (9 MP3 files)
├── images/                   # Project images and assets
│   └── walias.jpg           # Album artwork
└── README.md                # This file
```

## 🏗️ Code Architecture

### JavaScript Architecture

#### Music Player Module (`music-player.js`)
**Design Pattern**: IIFE (Immediately Invoked Function Expression) with modular organization

**Key Principles:**
- **Strict Mode**: Enforced with `'use strict'`
- **Encapsulation**: Private state and functions within IIFE closure
- **Separation of Concerns**: Clear separation between:
  - Configuration (PLAYLIST, SYMBOLS, DEFAULT_VOLUME)
  - State management (currentTrackIndex, isPlaying)
  - DOM manipulation (cached elements)
  - Event handling (dedicated handler functions)
  - Business logic (playback control functions)

**Code Organization:**
1. **Constants & Configuration**: Immutable data at the top
2. **State Management**: Centralized state object
3. **DOM Elements**: Cached references for performance
4. **Core Functions**: Initialization and setup
5. **Playback Controls**: Media control logic
6. **UI Updates**: Display refresh functions
7. **Event Handlers**: User interaction handlers
8. **Utility Functions**: Helper and validation functions

**Error Handling:**
- Null checks for DOM elements
- Try-catch for async playback operations
- Audio error event handling
- Input validation for track indices

### HTML Structure

**Accessibility Improvements:**
- Semantic HTML5 elements (`<nav>`, `<article>`, `<aside>`)
- ARIA labels and roles for screen readers
- Proper heading hierarchy
- Alt text for all images
- Language attribute on html element

**Organization:**
- Clear section comments for major page areas
- Descriptive comments following `============` pattern
- Logical grouping of related elements

### CSS Organization

**Structure:**
- Imported fonts and resets at top
- Custom sections clearly documented
- Music player styles in dedicated section
- Responsive breakpoints organized together

**Best Practices:**
- Mobile-first responsive design
- CSS custom properties for brand colors (HSL values)
- Consistent spacing and naming conventions
- Optimized selectors for performance

## 🚀 Setup & Development

### Prerequisites
- Modern web browser with HTML5 audio support
- Web server (for local development)

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Tyler-Schwenk/tyler-schwenk.github.io.git
   cd tyler-schwenk.github.io
   ```

2. **Serve locally:**
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js (http-server)
   npx http-server
   ```

3. **Open in browser:**
   Navigate to `http://localhost:8000`

### Deployment

The site is automatically deployed via GitHub Pages from the `main` branch.

**To deploy changes:**
```bash
git add .
git commit -m "Your commit message"
git push origin main
```

## 🛠️ Technologies Used

### Frontend
- **HTML5**: Semantic markup and audio API
- **CSS3**: Flexbox, Grid, custom properties, animations
- **JavaScript (ES6+)**: Modern syntax with const/let, arrow functions, promises

### Libraries & Frameworks
- **jQuery 3.x**: DOM manipulation and utilities
- **Font Awesome**: Icon library
- **Google Fonts**: Open Sans typography

### Tools
- **Git**: Version control
- **GitHub Pages**: Static site hosting

## 📐 Code Standards

### JavaScript
- **Style**: ES6+ modern JavaScript
- **Documentation**: JSDoc comments for all functions
- **Naming**: camelCase for variables/functions, UPPER_SNAKE_CASE for constants
- **Structure**: Modular with clear separation of concerns
- **Error Handling**: Comprehensive error checking and logging

### HTML
- **Validation**: Valid HTML5
- **Accessibility**: WCAG 2.1 AA compliance
- **Semantics**: Proper use of semantic elements
- **Comments**: Section headers for major areas

### CSS
- **Methodology**: Component-based organization
- **Naming**: Descriptive, semantic class names
- **Responsive**: Mobile-first approach
- **Comments**: Section headers with clear descriptions

## 🎵 Music Player Usage

The music player is automatically initialized on page load. Users can:

1. **Play/Pause**: Click the play button to start, pause button to stop
2. **Navigate**: Use previous/next buttons to skip tracks
3. **Adjust Volume**: Use the slider to control audio level
4. **View Info**: Current track and album information displayed

## 📝 License

### Website Code
Custom code by Tyler Schwenk - All rights reserved

### Template
Miniport template by HTML5 UP - CCA 3.0 License

### Music
"Tezeta" album by Hailu Mergia & The Walias Band - Personal use only

## 👤 Author

**Tyler Schwenk**  
Full-Stack Software Developer  
Email: tylerschwenk1@yahoo.com  
[LinkedIn](https://www.linkedin.com/in/tyler-schwenk-939570224/) | [GitHub](https://github.com/Tyler-Schwenk)

---

*Last Updated: December 2025*
