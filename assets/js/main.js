/**
 * Main Site Initialization
 * Handles page animations, navigation, and responsive behavior
 * 
 * @module Main
 * @author HTML5 UP / Modified by Tyler Schwenk
 * @version 2.0.0
 * @license CCA 3.0
 */

(function($) {
	'use strict';

	// ============================================================
	// DOM ELEMENTS
	// ============================================================
	
	/**
	 * Cached jQuery objects for performance
	 * @const
	 */
	const DOM = {
		$window: $(window),
		$body: $('body'),
		$nav: $('#nav')
	};

	// ============================================================
	// CONFIGURATION
	// ============================================================
	
	/**
	 * Responsive breakpoint configuration
	 * Defines viewport widths for different screen sizes
	 * @const
	 */
	const BREAKPOINTS = {
		xlarge: ['1281px', '1680px'],
		large:  ['981px',  '1280px'],
		medium: ['737px',  '980px'],
		small:  [null,     '736px']
	};

	/**
	 * Scrolling animation configuration
	 * @const
	 */
	const SCROLL_CONFIG = {
		speed: 1000,
		offsetCalculator: () => DOM.$nav.height()
	};

	/**
	 * Page load animation delay (ms)
	 * @const
	 */
	const PRELOAD_DELAY = 100;

	// ============================================================
	// INITIALIZATION
	// ============================================================
	
	/**
	 * Initialize responsive breakpoints
	 * Sets up media query listeners for different screen sizes
	 * @returns {void}
	 */
	function initializeBreakpoints() {
		breakpoints(BREAKPOINTS);
	}

	/**
	 * Initialize page load animations
	 * Removes preload class after delay for smooth transitions
	 * @returns {void}
	 */
	function initializeAnimations() {
		DOM.$window.on('load', () => {
			window.setTimeout(() => {
				DOM.$body.removeClass('is-preload');
			}, PRELOAD_DELAY);
		});
	}

	/**
	 * Initialize smooth scrolling behavior
	 * Applies scrolly plugin to navigation and scrollable links
	 * @returns {void}
	 */
	function initializeScrolling() {
		$('#nav a, .scrolly').scrolly({
			speed: SCROLL_CONFIG.speed,
			offset: SCROLL_CONFIG.offsetCalculator
		});
	}

	/**
	 * Main initialization function
	 * Runs all setup functions in correct order
	 * @returns {void}
	 */
	function init() {
		initializeBreakpoints();
		initializeAnimations();
		initializeScrolling();
	}

	// ============================================================
	// AUTO-INITIALIZE
	// ============================================================
	
	// Run initialization
	init();

})(jQuery);