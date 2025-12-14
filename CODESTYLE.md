# Tyler Schwenk Portfolio - Code Style Guide

## Overview
This document outlines the coding standards and best practices for the Tyler Schwenk portfolio website.

## General Principles
1. **Readability**: Code should be easy to read and understand
2. **Consistency**: Follow the same patterns throughout the codebase
3. **Documentation**: Comment complex logic and document all functions
4. **Accessibility**: Ensure all features are accessible (WCAG 2.1 AA)
5. **Performance**: Optimize for fast load times and smooth interactions

## HTML Standards

### Structure
- Use semantic HTML5 elements (`<nav>`, `<article>`, `<section>`, `<aside>`, etc.)
- Include proper ARIA labels for accessibility
- Add meaningful alt text to all images
- Use proper heading hierarchy (h1 → h2 → h3)

### Example
```html
<!-- Good -->
<article id="section-name" class="wrapper style1">
	<div class="container">
		<header>
			<h2>Section Title</h2>
		</header>
		<p>Content here...</p>
	</div>
</article>

<!-- Bad -->
<div id="section-name" class="wrapper style1">
	<div class="container">
		<div class="header">
			<div class="title">Section Title</div>
		</div>
		<div>Content here...</div>
	</div>
</div>
```

### Attributes
- Always include `lang` attribute on `<html>`
- Add `rel="noopener noreferrer"` to external links with `target="_blank"`
- Use descriptive `title` and `aria-label` attributes

## CSS Standards

### Organization
- Group related styles together
- Use section comments to separate major areas
- Order properties logically (positioning → box model → typography → visual → misc)

### Naming
- Use lowercase with hyphens for class names: `.my-class-name`
- Use semantic, descriptive names: `.project-card` not `.box-1`
- Prefix utility classes: `.u-text-center`, `.u-mb-2`

### CSS Variables
```css
/* Good - Use CSS custom properties for repeated values */
:root {
	--brand-color: hsl(18, 68%, 48%);
	--spacing-unit: 1rem;
	--font-family-primary: 'Open Sans', sans-serif;
}

.element {
	color: var(--brand-color);
	margin-bottom: var(--spacing-unit);
	font-family: var(--font-family-primary);
}
```

### Comments
```css
/* ============================================================
   SECTION NAME
   Brief description of what this section contains
   ============================================================ */

/* Subsection or component */
.component {
	/* Property explanation if needed */
	property: value;
}
```

## JavaScript Standards

### General
- Use `'use strict';` at the top of functions
- Prefer `const` and `let` over `var`
- Use arrow functions for callbacks
- Add semicolons (consistent style)

### Naming Conventions
- **Variables/Functions**: camelCase → `myVariable`, `myFunction()`
- **Constants**: UPPER_SNAKE_CASE → `MAX_WIDTH`, `API_URL`
- **Classes**: PascalCase → `MyClass`
- **Private**: prefix with underscore → `_privateMethod()`

### Documentation
Use JSDoc comments for all functions:

```javascript
/**
 * Brief description of what the function does
 * 
 * @param {string} paramName - Parameter description
 * @param {number} [optionalParam=10] - Optional parameter with default
 * @returns {boolean} What the function returns
 * @throws {Error} When this error occurs
 * 
 * @example
 * myFunction('test', 5); // returns true
 */
function myFunction(paramName, optionalParam = 10) {
	// Implementation
}
```

### Code Organization
```javascript
/**
 * Module Name
 * Module description
 */
(function() {
	'use strict';

	// ============================================================
	// CONSTANTS & CONFIGURATION
	// ============================================================
	
	const CONFIG = {
		// configuration here
	};

	// ============================================================
	// STATE MANAGEMENT
	// ============================================================
	
	const state = {
		// state variables
	};

	// ============================================================
	// DOM ELEMENTS
	// ============================================================
	
	const elements = {
		// cached DOM elements
	};

	// ============================================================
	// CORE FUNCTIONS
	// ============================================================
	
	function init() {
		// initialization logic
	}

	// ============================================================
	// EVENT HANDLERS
	// ============================================================
	
	function handleEvent(event) {
		// event handling
	}

	// ============================================================
	// UTILITY FUNCTIONS
	// ============================================================
	
	function utilityFunction() {
		// helper functions
	}

	// ============================================================
	// INITIALIZATION
	// ============================================================
	
	init();
	
})();
```

### Error Handling
```javascript
// Good - Handle errors appropriately
try {
	const data = await fetchData();
	processData(data);
} catch (error) {
	console.error('Failed to process data:', error);
	// Show user-friendly error message
	showErrorMessage('Unable to load data. Please try again.');
}

// Good - Validate inputs
function processUser(user) {
	if (!user || typeof user.name !== 'string') {
		throw new Error('Invalid user object');
	}
	// Process user
}
```

## File Organization

### Directory Structure
```
portfolio/
├── assets/
│   ├── css/
│   │   └── main.css
│   ├── js/
│   │   ├── main.js
│   │   ├── music-player.js
│   │   └── util.js
│   ├── webfonts/
│   └── data/
├── images/
├── audio/
├── video/
├── index.html
├── [project-pages].html
├── README.md
├── .gitignore
└── .editorconfig
```

## Git Commit Messages

### Format
```
<type>: <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process or tooling changes

### Examples
```
feat: Add album art to music player

- Display album artwork in player controls
- Add responsive sizing for mobile
- Update CSS with proper styling

Closes #12
```

```
fix: Correct navigation link in pac-tyler page

The portfolio link was pointing to wrong anchor
```

## Accessibility Checklist

- [ ] All images have meaningful alt text
- [ ] Color contrast meets WCAG AA standards (4.5:1 for normal text)
- [ ] All interactive elements are keyboard accessible
- [ ] ARIA labels on non-standard controls
- [ ] Semantic HTML structure
- [ ] Proper heading hierarchy
- [ ] Form labels associated with inputs
- [ ] Focus indicators visible
- [ ] No content relies solely on color
- [ ] Links are descriptive (not "click here")

## Performance Best Practices

1. **Images**: Optimize and use appropriate formats (WebP where supported)
2. **CSS**: Minimize and combine stylesheets
3. **JavaScript**: Defer non-critical scripts
4. **Fonts**: Preload critical fonts, use font-display: swap
5. **Caching**: Leverage browser caching
6. **Lazy Loading**: Load images and media as needed

## Browser Support

Target modern browsers:
- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)

Use appropriate fallbacks for older browsers where necessary.

## Testing

Before committing:
1. Test in multiple browsers
2. Test responsive design on different screen sizes
3. Validate HTML (https://validator.w3.org/)
4. Validate CSS
5. Check console for JavaScript errors
6. Test keyboard navigation
7. Run accessibility audit (Lighthouse/axe)

## Resources

- [MDN Web Docs](https://developer.mozilla.org/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Google Web Fundamentals](https://developers.google.com/web/fundamentals)
- [CSS Guidelines](https://cssguidelin.es/)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
