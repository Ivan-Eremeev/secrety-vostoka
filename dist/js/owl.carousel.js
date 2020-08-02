/**
 * Owl Carousel v2.3.3
 * Copyright 2013-2018 David Deutsch
 * Licensed under: SEE LICENSE IN https://github.com/OwlCarousel2/OwlCarousel2/blob/master/LICENSE
 */
/**
 * Owl carousel
 * @version 2.3.3
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 * @todo Lazy Load Icon
 * @todo prevent animationend bubling
 * @todo itemsScaleUp
 * @todo Test Zepto
 * @todo stagePadding calculate wrong active classes
 */
;(function($, window, document, undefined) {

	/**
	 * Creates a carousel.
	 * @class The Owl Carousel.
	 * @public
	 * @param {HTMLElement|jQuery} element - The element to create the carousel for.
	 * @param {Object} [options] - The options
	 */
	function Owl(element, options) {

		/**
		 * Current settings for the carousel.
		 * @public
		 */
		this.settings = null;

		/**
		 * Current options set by the caller including defaults.
		 * @public
		 */
		this.options = $.extend({}, Owl.Defaults, options);

		/**
		 * Plugin element.
		 * @public
		 */
		this.$element = $(element);

		/**
		 * Proxied event handlers.
		 * @protected
		 */
		this._handlers = {};

		/**
		 * References to the running plugins of this carousel.
		 * @protected
		 */
		this._plugins = {};

		/**
		 * Currently suppressed events to prevent them from being retriggered.
		 * @protected
		 */
		this._supress = {};

		/**
		 * Absolute current position.
		 * @protected
		 */
		this._current = null;

		/**
		 * Animation speed in milliseconds.
		 * @protected
		 */
		this._speed = null;

		/**
		 * Coordinates of all items in pixel.
		 * @todo The name of this member is missleading.
		 * @protected
		 */
		this._coordinates = [];

		/**
		 * Current breakpoint.
		 * @todo Real media queries would be nice.
		 * @protected
		 */
		this._breakpoint = null;

		/**
		 * Current width of the plugin element.
		 */
		this._width = null;

		/**
		 * All real items.
		 * @protected
		 */
		this._items = [];

		/**
		 * All cloned items.
		 * @protected
		 */
		this._clones = [];

		/**
		 * Merge values of all items.
		 * @todo Maybe this could be part of a plugin.
		 * @protected
		 */
		this._mergers = [];

		/**
		 * Widths of all items.
		 */
		this._widths = [];

		/**
		 * Invalidated parts within the update process.
		 * @protected
		 */
		this._invalidated = {};

		/**
		 * Ordered list of workers for the update process.
		 * @protected
		 */
		this._pipe = [];

		/**
		 * Current state information for the drag operation.
		 * @todo #261
		 * @protected
		 */
		this._drag = {
			time: null,
			target: null,
			pointer: null,
			stage: {
				start: null,
				current: null
			},
			direction: null
		};

		/**
		 * Current state information and their tags.
		 * @type {Object}
		 * @protected
		 */
		this._states = {
			current: {},
			tags: {
				'initializing': [ 'busy' ],
				'animating': [ 'busy' ],
				'dragging': [ 'interacting' ]
			}
		};

		$.each([ 'onResize', 'onThrottledResize' ], $.proxy(function(i, handler) {
			this._handlers[handler] = $.proxy(this[handler], this);
		}, this));

		$.each(Owl.Plugins, $.proxy(function(key, plugin) {
			this._plugins[key.charAt(0).toLowerCase() + key.slice(1)]
				= new plugin(this);
		}, this));

		$.each(Owl.Workers, $.proxy(function(priority, worker) {
			this._pipe.push({
				'filter': worker.filter,
				'run': $.proxy(worker.run, this)
			});
		}, this));

		this.setup();
		this.initialize();
	}

	/**
	 * Default options for the carousel.
	 * @public
	 */
	Owl.Defaults = {
		items: 3,
		loop: false,
		center: false,
		rewind: false,
		checkVisibility: true,

		mouseDrag: true,
		touchDrag: true,
		pullDrag: true,
		freeDrag: false,

		margin: 0,
		stagePadding: 0,

		merge: false,
		mergeFit: true,
		autoWidth: false,

		startPosition: 0,
		rtl: false,

		smartSpeed: 250,
		fluidSpeed: false,
		dragEndSpeed: false,

		responsive: {},
		responsiveRefreshRate: 200,
		responsiveBaseElement: window,

		fallbackEasing: 'swing',

		info: false,

		nestedItemSelector: false,
		itemElement: 'div',
		stageElement: 'div',

		refreshClass: 'owl-refresh',
		loadedClass: 'owl-loaded',
		loadingClass: 'owl-loading',
		rtlClass: 'owl-rtl',
		responsiveClass: 'owl-responsive',
		dragClass: 'owl-drag',
		itemClass: 'owl-item',
		stageClass: 'owl-stage',
		stageOuterClass: 'owl-stage-outer',
		grabClass: 'owl-grab'
	};

	/**
	 * Enumeration for width.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Width = {
		Default: 'default',
		Inner: 'inner',
		Outer: 'outer'
	};

	/**
	 * Enumeration for types.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Type = {
		Event: 'event',
		State: 'state'
	};

	/**
	 * Contains all registered plugins.
	 * @public
	 */
	Owl.Plugins = {};

	/**
	 * List of workers involved in the update process.
	 */
	Owl.Workers = [ {
		filter: [ 'width', 'settings' ],
		run: function() {
			this._width = this.$element.width();
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			cache.current = this._items && this._items[this.relative(this._current)];
		}
	}, {
		filter: [ 'items', 'settings' ],
		run: function() {
			this.$stage.children('.cloned').remove();
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var margin = this.settings.margin || '',
				grid = !this.settings.autoWidth,
				rtl = this.settings.rtl,
				css = {
					'width': 'auto',
					'margin-left': rtl ? margin : '',
					'margin-right': rtl ? '' : margin
				};

			!grid && this.$stage.children().css(css);

			cache.css = css;
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var width = (this.width() / this.settings.items).toFixed(3) - this.settings.margin,
				merge = null,
				iterator = this._items.length,
				grid = !this.settings.autoWidth,
				widths = [];

			cache.items = {
				merge: false,
				width: width
			};

			while (iterator--) {
				merge = this._mergers[iterator];
				merge = this.settings.mergeFit && Math.min(merge, this.settings.items) || merge;

				cache.items.merge = merge > 1 || cache.items.merge;

				widths[iterator] = !grid ? this._items[iterator].width() : width * merge;
			}

			this._widths = widths;
		}
	}, {
		filter: [ 'items', 'settings' ],
		run: function() {
			var clones = [],
				items = this._items,
				settings = this.settings,
				// TODO: Should be computed from number of min width items in stage
				view = Math.max(settings.items * 2, 4),
				size = Math.ceil(items.length / 2) * 2,
				repeat = settings.loop && items.length ? settings.rewind ? view : Math.max(view, size) : 0,
				append = '',
				prepend = '';

			repeat /= 2;

			while (repeat > 0) {
				// Switch to only using appended clones
				clones.push(this.normalize(clones.length / 2, true));
				append = append + items[clones[clones.length - 1]][0].outerHTML;
				clones.push(this.normalize(items.length - 1 - (clones.length - 1) / 2, true));
				prepend = items[clones[clones.length - 1]][0].outerHTML + prepend;
				repeat -= 1;
			}

			this._clones = clones;

			$(append).addClass('cloned').appendTo(this.$stage);
			$(prepend).addClass('cloned').prependTo(this.$stage);
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function() {
			var rtl = this.settings.rtl ? 1 : -1,
				size = this._clones.length + this._items.length,
				iterator = -1,
				previous = 0,
				current = 0,
				coordinates = [];

			while (++iterator < size) {
				previous = coordinates[iterator - 1] || 0;
				current = this._widths[this.relative(iterator)] + this.settings.margin;
				coordinates.push(previous + current * rtl);
			}

			this._coordinates = coordinates;
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function() {
			var padding = this.settings.stagePadding,
				coordinates = this._coordinates,
				css = {
					'width': Math.ceil(Math.abs(coordinates[coordinates.length - 1])) + padding * 2,
					'padding-left': padding || '',
					'padding-right': padding || ''
				};

			this.$stage.css(css);
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var iterator = this._coordinates.length,
				grid = !this.settings.autoWidth,
				items = this.$stage.children();

			if (grid && cache.items.merge) {
				while (iterator--) {
					cache.css.width = this._widths[this.relative(iterator)];
					items.eq(iterator).css(cache.css);
				}
			} else if (grid) {
				cache.css.width = cache.items.width;
				items.css(cache.css);
			}
		}
	}, {
		filter: [ 'items' ],
		run: function() {
			this._coordinates.length < 1 && this.$stage.removeAttr('style');
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			cache.current = cache.current ? this.$stage.children().index(cache.current) : 0;
			cache.current = Math.max(this.minimum(), Math.min(this.maximum(), cache.current));
			this.reset(cache.current);
		}
	}, {
		filter: [ 'position' ],
		run: function() {
			this.animate(this.coordinates(this._current));
		}
	}, {
		filter: [ 'width', 'position', 'items', 'settings' ],
		run: function() {
			var rtl = this.settings.rtl ? 1 : -1,
				padding = this.settings.stagePadding * 2,
				begin = this.coordinates(this.current()) + padding,
				end = begin + this.width() * rtl,
				inner, outer, matches = [], i, n;

			for (i = 0, n = this._coordinates.length; i < n; i++) {
				inner = this._coordinates[i - 1] || 0;
				outer = Math.abs(this._coordinates[i]) + padding * rtl;

				if ((this.op(inner, '<=', begin) && (this.op(inner, '>', end)))
					|| (this.op(outer, '<', begin) && this.op(outer, '>', end))) {
					matches.push(i);
				}
			}

			this.$stage.children('.active').removeClass('active');
			this.$stage.children(':eq(' + matches.join('), :eq(') + ')').addClass('active');

			this.$stage.children('.center').removeClass('center');
			if (this.settings.center) {
				this.$stage.children().eq(this.current()).addClass('center');
			}
		}
	} ];

	/**
	 * Create the stage DOM element
	 */
	Owl.prototype.initializeStage = function() {
		this.$stage = this.$element.find('.' + this.settings.stageClass);

		// if the stage is already in the DOM, grab it and skip stage initialization
		if (this.$stage.length) {
			return;
		}

		this.$element.addClass(this.options.loadingClass);

		// create stage
		this.$stage = $('<' + this.settings.stageElement + ' class="' + this.settings.stageClass + '"/>')
			.wrap('<div class="' + this.settings.stageOuterClass + '"/>');

		// append stage
		this.$element.append(this.$stage.parent());
	};

	/**
	 * Create item DOM elements
	 */
	Owl.prototype.initializeItems = function() {
		var $items = this.$element.find('.owl-item');

		// if the items are already in the DOM, grab them and skip item initialization
		if ($items.length) {
			this._items = $items.get().map(function(item) {
				return $(item);
			});

			this._mergers = this._items.map(function() {
				return 1;
			});

			this.refresh();

			return;
		}

		// append content
		this.replace(this.$element.children().not(this.$stage.parent()));

		// check visibility
		if (this.isVisible()) {
			// update view
			this.refresh();
		} else {
			// invalidate width
			this.invalidate('width');
		}

		this.$element
			.removeClass(this.options.loadingClass)
			.addClass(this.options.loadedClass);
	};

	/**
	 * Initializes the carousel.
	 * @protected
	 */
	Owl.prototype.initialize = function() {
		this.enter('initializing');
		this.trigger('initialize');

		this.$element.toggleClass(this.settings.rtlClass, this.settings.rtl);

		if (this.settings.autoWidth && !this.is('pre-loading')) {
			var imgs, nestedSelector, width;
			imgs = this.$element.find('img');
			nestedSelector = this.settings.nestedItemSelector ? '.' + this.settings.nestedItemSelector : undefined;
			width = this.$element.children(nestedSelector).width();

			if (imgs.length && width <= 0) {
				this.preloadAutoWidthImages(imgs);
			}
		}

		this.initializeStage();
		this.initializeItems();

		// register event handlers
		this.registerEventHandlers();

		this.leave('initializing');
		this.trigger('initialized');
	};

	/**
	 * @returns {Boolean} visibility of $element
	 *                    if you know the carousel will always be visible you can set `checkVisibility` to `false` to
	 *                    prevent the expensive browser layout forced reflow the $element.is(':visible') does
	 */
	Owl.prototype.isVisible = function() {
		return this.settings.checkVisibility
			? this.$element.is(':visible')
			: true;
	};

	/**
	 * Setups the current settings.
	 * @todo Remove responsive classes. Why should adaptive designs be brought into IE8?
	 * @todo Support for media queries by using `matchMedia` would be nice.
	 * @public
	 */
	Owl.prototype.setup = function() {
		var viewport = this.viewport(),
			overwrites = this.options.responsive,
			match = -1,
			settings = null;

		if (!overwrites) {
			settings = $.extend({}, this.options);
		} else {
			$.each(overwrites, function(breakpoint) {
				if (breakpoint <= viewport && breakpoint > match) {
					match = Number(breakpoint);
				}
			});

			settings = $.extend({}, this.options, overwrites[match]);
			if (typeof settings.stagePadding === 'function') {
				settings.stagePadding = settings.stagePadding();
			}
			delete settings.responsive;

			// responsive class
			if (settings.responsiveClass) {
				this.$element.attr('class',
					this.$element.attr('class').replace(new RegExp('(' + this.options.responsiveClass + '-)\\S+\\s', 'g'), '$1' + match)
				);
			}
		}

		this.trigger('change', { property: { name: 'settings', value: settings } });
		this._breakpoint = match;
		this.settings = settings;
		this.invalidate('settings');
		this.trigger('changed', { property: { name: 'settings', value: this.settings } });
	};

	/**
	 * Updates option logic if necessery.
	 * @protected
	 */
	Owl.prototype.optionsLogic = function() {
		if (this.settings.autoWidth) {
			this.settings.stagePadding = false;
			this.settings.merge = false;
		}
	};

	/**
	 * Prepares an item before add.
	 * @todo Rename event parameter `content` to `item`.
	 * @protected
	 * @returns {jQuery|HTMLElement} - The item container.
	 */
	Owl.prototype.prepare = function(item) {
		var event = this.trigger('prepare', { content: item });

		if (!event.data) {
			event.data = $('<' + this.settings.itemElement + '/>')
				.addClass(this.options.itemClass).append(item)
		}

		this.trigger('prepared', { content: event.data });

		return event.data;
	};

	/**
	 * Updates the view.
	 * @public
	 */
	Owl.prototype.update = function() {
		var i = 0,
			n = this._pipe.length,
			filter = $.proxy(function(p) { return this[p] }, this._invalidated),
			cache = {};

		while (i < n) {
			if (this._invalidated.all || $.grep(this._pipe[i].filter, filter).length > 0) {
				this._pipe[i].run(cache);
			}
			i++;
		}

		this._invalidated = {};

		!this.is('valid') && this.enter('valid');
	};

	/**
	 * Gets the width of the view.
	 * @public
	 * @param {Owl.Width} [dimension=Owl.Width.Default] - The dimension to return.
	 * @returns {Number} - The width of the view in pixel.
	 */
	Owl.prototype.width = function(dimension) {
		dimension = dimension || Owl.Width.Default;
		switch (dimension) {
			case Owl.Width.Inner:
			case Owl.Width.Outer:
				return this._width;
			default:
				return this._width - this.settings.stagePadding * 2 + this.settings.margin;
		}
	};

	/**
	 * Refreshes the carousel primarily for adaptive purposes.
	 * @public
	 */
	Owl.prototype.refresh = function() {
		this.enter('refreshing');
		this.trigger('refresh');

		this.setup();

		this.optionsLogic();

		this.$element.addClass(this.options.refreshClass);

		this.update();

		this.$element.removeClass(this.options.refreshClass);

		this.leave('refreshing');
		this.trigger('refreshed');
	};

	/**
	 * Checks window `resize` event.
	 * @protected
	 */
	Owl.prototype.onThrottledResize = function() {
		window.clearTimeout(this.resizeTimer);
		this.resizeTimer = window.setTimeout(this._handlers.onResize, this.settings.responsiveRefreshRate);
	};

	/**
	 * Checks window `resize` event.
	 * @protected
	 */
	Owl.prototype.onResize = function() {
		if (!this._items.length) {
			return false;
		}

		if (this._width === this.$element.width()) {
			return false;
		}

		if (!this.isVisible()) {
			return false;
		}

		this.enter('resizing');

		if (this.trigger('resize').isDefaultPrevented()) {
			this.leave('resizing');
			return false;
		}

		this.invalidate('width');

		this.refresh();

		this.leave('resizing');
		this.trigger('resized');
	};

	/**
	 * Registers event handlers.
	 * @todo Check `msPointerEnabled`
	 * @todo #261
	 * @protected
	 */
	Owl.prototype.registerEventHandlers = function() {
		if ($.support.transition) {
			this.$stage.on($.support.transition.end + '.owl.core', $.proxy(this.onTransitionEnd, this));
		}

		if (this.settings.responsive !== false) {
			this.on(window, 'resize', this._handlers.onThrottledResize);
		}

		if (this.settings.mouseDrag) {
			this.$element.addClass(this.options.dragClass);
			this.$stage.on('mousedown.owl.core', $.proxy(this.onDragStart, this));
			this.$stage.on('dragstart.owl.core selectstart.owl.core', function() { return false });
		}

		if (this.settings.touchDrag){
			this.$stage.on('touchstart.owl.core', $.proxy(this.onDragStart, this));
			this.$stage.on('touchcancel.owl.core', $.proxy(this.onDragEnd, this));
		}
	};

	/**
	 * Handles `touchstart` and `mousedown` events.
	 * @todo Horizontal swipe threshold as option
	 * @todo #261
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragStart = function(event) {
		var stage = null;

		if (event.which === 3) {
			return;
		}

		if ($.support.transform) {
			stage = this.$stage.css('transform').replace(/.*\(|\)| /g, '').split(',');
			stage = {
				x: stage[stage.length === 16 ? 12 : 4],
				y: stage[stage.length === 16 ? 13 : 5]
			};
		} else {
			stage = this.$stage.position();
			stage = {
				x: this.settings.rtl ?
					stage.left + this.$stage.width() - this.width() + this.settings.margin :
					stage.left,
				y: stage.top
			};
		}

		if (this.is('animating')) {
			$.support.transform ? this.animate(stage.x) : this.$stage.stop()
			this.invalidate('position');
		}

		this.$element.toggleClass(this.options.grabClass, event.type === 'mousedown');

		this.speed(0);

		this._drag.time = new Date().getTime();
		this._drag.target = $(event.target);
		this._drag.stage.start = stage;
		this._drag.stage.current = stage;
		this._drag.pointer = this.pointer(event);

		$(document).on('mouseup.owl.core touchend.owl.core', $.proxy(this.onDragEnd, this));

		$(document).one('mousemove.owl.core touchmove.owl.core', $.proxy(function(event) {
			var delta = this.difference(this._drag.pointer, this.pointer(event));

			$(document).on('mousemove.owl.core touchmove.owl.core', $.proxy(this.onDragMove, this));

			if (Math.abs(delta.x) < Math.abs(delta.y) && this.is('valid')) {
				return;
			}

			event.preventDefault();

			this.enter('dragging');
			this.trigger('drag');
		}, this));
	};

	/**
	 * Handles the `touchmove` and `mousemove` events.
	 * @todo #261
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragMove = function(event) {
		var minimum = null,
			maximum = null,
			pull = null,
			delta = this.difference(this._drag.pointer, this.pointer(event)),
			stage = this.difference(this._drag.stage.start, delta);

		if (!this.is('dragging')) {
			return;
		}

		event.preventDefault();

		if (this.settings.loop) {
			minimum = this.coordinates(this.minimum());
			maximum = this.coordinates(this.maximum() + 1) - minimum;
			stage.x = (((stage.x - minimum) % maximum + maximum) % maximum) + minimum;
		} else {
			minimum = this.settings.rtl ? this.coordinates(this.maximum()) : this.coordinates(this.minimum());
			maximum = this.settings.rtl ? this.coordinates(this.minimum()) : this.coordinates(this.maximum());
			pull = this.settings.pullDrag ? -1 * delta.x / 5 : 0;
			stage.x = Math.max(Math.min(stage.x, minimum + pull), maximum + pull);
		}

		this._drag.stage.current = stage;

		this.animate(stage.x);
	};

	/**
	 * Handles the `touchend` and `mouseup` events.
	 * @todo #261
	 * @todo Threshold for click event
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragEnd = function(event) {
		var delta = this.difference(this._drag.pointer, this.pointer(event)),
			stage = this._drag.stage.current,
			direction = delta.x > 0 ^ this.settings.rtl ? 'left' : 'right';

		$(document).off('.owl.core');

		this.$element.removeClass(this.options.grabClass);

		if (delta.x !== 0 && this.is('dragging') || !this.is('valid')) {
			this.speed(this.settings.dragEndSpeed || this.settings.smartSpeed);
			this.current(this.closest(stage.x, delta.x !== 0 ? direction : this._drag.direction));
			this.invalidate('position');
			this.update();

			this._drag.direction = direction;

			if (Math.abs(delta.x) > 3 || new Date().getTime() - this._drag.time > 300) {
				this._drag.target.one('click.owl.core', function() { return false; });
			}
		}

		if (!this.is('dragging')) {
			return;
		}

		this.leave('dragging');
		this.trigger('dragged');
	};

	/**
	 * Gets absolute position of the closest item for a coordinate.
	 * @todo Setting `freeDrag` makes `closest` not reusable. See #165.
	 * @protected
	 * @param {Number} coordinate - The coordinate in pixel.
	 * @param {String} direction - The direction to check for the closest item. Ether `left` or `right`.
	 * @return {Number} - The absolute position of the closest item.
	 */
	Owl.prototype.closest = function(coordinate, direction) {
		var position = -1,
			pull = 30,
			width = this.width(),
			coordinates = this.coordinates();

		if (!this.settings.freeDrag) {
			// check closest item
			$.each(coordinates, $.proxy(function(index, value) {
				// on a left pull, check on current index
				if (direction === 'left' && coordinate > value - pull && coordinate < value + pull) {
					position = index;
				// on a right pull, check on previous index
				// to do so, subtract width from value and set position = index + 1
				} else if (direction === 'right' && coordinate > value - width - pull && coordinate < value - width + pull) {
					position = index + 1;
				} else if (this.op(coordinate, '<', value)
					&& this.op(coordinate, '>', coordinates[index + 1] !== undefined ? coordinates[index + 1] : value - width)) {
					position = direction === 'left' ? index + 1 : index;
				}
				return position === -1;
			}, this));
		}

		if (!this.settings.loop) {
			// non loop boundries
			if (this.op(coordinate, '>', coordinates[this.minimum()])) {
				position = coordinate = this.minimum();
			} else if (this.op(coordinate, '<', coordinates[this.maximum()])) {
				position = coordinate = this.maximum();
			}
		}

		return position;
	};

	/**
	 * Animates the stage.
	 * @todo #270
	 * @public
	 * @param {Number} coordinate - The coordinate in pixels.
	 */
	Owl.prototype.animate = function(coordinate) {
		var animate = this.speed() > 0;

		this.is('animating') && this.onTransitionEnd();

		if (animate) {
			this.enter('animating');
			this.trigger('translate');
		}

		if ($.support.transform3d && $.support.transition) {
			this.$stage.css({
				transform: 'translate3d(' + coordinate + 'px,0px,0px)',
				transition: (this.speed() / 1000) + 's'
			});
		} else if (animate) {
			this.$stage.animate({
				left: coordinate + 'px'
			}, this.speed(), this.settings.fallbackEasing, $.proxy(this.onTransitionEnd, this));
		} else {
			this.$stage.css({
				left: coordinate + 'px'
			});
		}
	};

	/**
	 * Checks whether the carousel is in a specific state or not.
	 * @param {String} state - The state to check.
	 * @returns {Boolean} - The flag which indicates if the carousel is busy.
	 */
	Owl.prototype.is = function(state) {
		return this._states.current[state] && this._states.current[state] > 0;
	};

	/**
	 * Sets the absolute position of the current item.
	 * @public
	 * @param {Number} [position] - The new absolute position or nothing to leave it unchanged.
	 * @returns {Number} - The absolute position of the current item.
	 */
	Owl.prototype.current = function(position) {
		if (position === undefined) {
			return this._current;
		}

		if (this._items.length === 0) {
			return undefined;
		}

		position = this.normalize(position);

		if (this._current !== position) {
			var event = this.trigger('change', { property: { name: 'position', value: position } });

			if (event.data !== undefined) {
				position = this.normalize(event.data);
			}

			this._current = position;

			this.invalidate('position');

			this.trigger('changed', { property: { name: 'position', value: this._current } });
		}

		return this._current;
	};

	/**
	 * Invalidates the given part of the update routine.
	 * @param {String} [part] - The part to invalidate.
	 * @returns {Array.<String>} - The invalidated parts.
	 */
	Owl.prototype.invalidate = function(part) {
		if ($.type(part) === 'string') {
			this._invalidated[part] = true;
			this.is('valid') && this.leave('valid');
		}
		return $.map(this._invalidated, function(v, i) { return i });
	};

	/**
	 * Resets the absolute position of the current item.
	 * @public
	 * @param {Number} position - The absolute position of the new item.
	 */
	Owl.prototype.reset = function(position) {
		position = this.normalize(position);

		if (position === undefined) {
			return;
		}

		this._speed = 0;
		this._current = position;

		this.suppress([ 'translate', 'translated' ]);

		this.animate(this.coordinates(position));

		this.release([ 'translate', 'translated' ]);
	};

	/**
	 * Normalizes an absolute or a relative position of an item.
	 * @public
	 * @param {Number} position - The absolute or relative position to normalize.
	 * @param {Boolean} [relative=false] - Whether the given position is relative or not.
	 * @returns {Number} - The normalized position.
	 */
	Owl.prototype.normalize = function(position, relative) {
		var n = this._items.length,
			m = relative ? 0 : this._clones.length;

		if (!this.isNumeric(position) || n < 1) {
			position = undefined;
		} else if (position < 0 || position >= n + m) {
			position = ((position - m / 2) % n + n) % n + m / 2;
		}

		return position;
	};

	/**
	 * Converts an absolute position of an item into a relative one.
	 * @public
	 * @param {Number} position - The absolute position to convert.
	 * @returns {Number} - The converted position.
	 */
	Owl.prototype.relative = function(position) {
		position -= this._clones.length / 2;
		return this.normalize(position, true);
	};

	/**
	 * Gets the maximum position for the current item.
	 * @public
	 * @param {Boolean} [relative=false] - Whether to return an absolute position or a relative position.
	 * @returns {Number}
	 */
	Owl.prototype.maximum = function(relative) {
		var settings = this.settings,
			maximum = this._coordinates.length,
			iterator,
			reciprocalItemsWidth,
			elementWidth;

		if (settings.loop) {
			maximum = this._clones.length / 2 + this._items.length - 1;
		} else if (settings.autoWidth || settings.merge) {
			iterator = this._items.length;
			if (iterator) {
				reciprocalItemsWidth = this._items[--iterator].width();
				elementWidth = this.$element.width();
				while (iterator--) {
					reciprocalItemsWidth += this._items[iterator].width() + this.settings.margin;
					if (reciprocalItemsWidth > elementWidth) {
						break;
					}
				}
			}
			maximum = iterator + 1;
		} else if (settings.center) {
			maximum = this._items.length - 1;
		} else {
			maximum = this._items.length - settings.items;
		}

		if (relative) {
			maximum -= this._clones.length / 2;
		}

		return Math.max(maximum, 0);
	};

	/**
	 * Gets the minimum position for the current item.
	 * @public
	 * @param {Boolean} [relative=false] - Whether to return an absolute position or a relative position.
	 * @returns {Number}
	 */
	Owl.prototype.minimum = function(relative) {
		return relative ? 0 : this._clones.length / 2;
	};

	/**
	 * Gets an item at the specified relative position.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @return {jQuery|Array.<jQuery>} - The item at the given position or all items if no position was given.
	 */
	Owl.prototype.items = function(position) {
		if (position === undefined) {
			return this._items.slice();
		}

		position = this.normalize(position, true);
		return this._items[position];
	};

	/**
	 * Gets an item at the specified relative position.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @return {jQuery|Array.<jQuery>} - The item at the given position or all items if no position was given.
	 */
	Owl.prototype.mergers = function(position) {
		if (position === undefined) {
			return this._mergers.slice();
		}

		position = this.normalize(position, true);
		return this._mergers[position];
	};

	/**
	 * Gets the absolute positions of clones for an item.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @returns {Array.<Number>} - The absolute positions of clones for the item or all if no position was given.
	 */
	Owl.prototype.clones = function(position) {
		var odd = this._clones.length / 2,
			even = odd + this._items.length,
			map = function(index) { return index % 2 === 0 ? even + index / 2 : odd - (index + 1) / 2 };

		if (position === undefined) {
			return $.map(this._clones, function(v, i) { return map(i) });
		}

		return $.map(this._clones, function(v, i) { return v === position ? map(i) : null });
	};

	/**
	 * Sets the current animation speed.
	 * @public
	 * @param {Number} [speed] - The animation speed in milliseconds or nothing to leave it unchanged.
	 * @returns {Number} - The current animation speed in milliseconds.
	 */
	Owl.prototype.speed = function(speed) {
		if (speed !== undefined) {
			this._speed = speed;
		}

		return this._speed;
	};

	/**
	 * Gets the coordinate of an item.
	 * @todo The name of this method is missleanding.
	 * @public
	 * @param {Number} position - The absolute position of the item within `minimum()` and `maximum()`.
	 * @returns {Number|Array.<Number>} - The coordinate of the item in pixel or all coordinates.
	 */
	Owl.prototype.coordinates = function(position) {
		var multiplier = 1,
			newPosition = position - 1,
			coordinate;

		if (position === undefined) {
			return $.map(this._coordinates, $.proxy(function(coordinate, index) {
				return this.coordinates(index);
			}, this));
		}

		if (this.settings.center) {
			if (this.settings.rtl) {
				multiplier = -1;
				newPosition = position + 1;
			}

			coordinate = this._coordinates[position];
			coordinate += (this.width() - coordinate + (this._coordinates[newPosition] || 0)) / 2 * multiplier;
		} else {
			coordinate = this._coordinates[newPosition] || 0;
		}

		coordinate = Math.ceil(coordinate);

		return coordinate;
	};

	/**
	 * Calculates the speed for a translation.
	 * @protected
	 * @param {Number} from - The absolute position of the start item.
	 * @param {Number} to - The absolute position of the target item.
	 * @param {Number} [factor=undefined] - The time factor in milliseconds.
	 * @returns {Number} - The time in milliseconds for the translation.
	 */
	Owl.prototype.duration = function(from, to, factor) {
		if (factor === 0) {
			return 0;
		}

		return Math.min(Math.max(Math.abs(to - from), 1), 6) * Math.abs((factor || this.settings.smartSpeed));
	};

	/**
	 * Slides to the specified item.
	 * @public
	 * @param {Number} position - The position of the item.
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.to = function(position, speed) {
		var current = this.current(),
			revert = null,
			distance = position - this.relative(current),
			direction = (distance > 0) - (distance < 0),
			items = this._items.length,
			minimum = this.minimum(),
			maximum = this.maximum();

		if (this.settings.loop) {
			if (!this.settings.rewind && Math.abs(distance) > items / 2) {
				distance += direction * -1 * items;
			}

			position = current + distance;
			revert = ((position - minimum) % items + items) % items + minimum;

			if (revert !== position && revert - distance <= maximum && revert - distance > 0) {
				current = revert - distance;
				position = revert;
				this.reset(current);
			}
		} else if (this.settings.rewind) {
			maximum += 1;
			position = (position % maximum + maximum) % maximum;
		} else {
			position = Math.max(minimum, Math.min(maximum, position));
		}

		this.speed(this.duration(current, position, speed));
		this.current(position);

		if (this.isVisible()) {
			this.update();
		}
	};

	/**
	 * Slides to the next item.
	 * @public
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.next = function(speed) {
		speed = speed || false;
		this.to(this.relative(this.current()) + 1, speed);
	};

	/**
	 * Slides to the previous item.
	 * @public
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.prev = function(speed) {
		speed = speed || false;
		this.to(this.relative(this.current()) - 1, speed);
	};

	/**
	 * Handles the end of an animation.
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onTransitionEnd = function(event) {

		// if css2 animation then event object is undefined
		if (event !== undefined) {
			event.stopPropagation();

			// Catch only owl-stage transitionEnd event
			if ((event.target || event.srcElement || event.originalTarget) !== this.$stage.get(0)) {
				return false;
			}
		}

		this.leave('animating');
		this.trigger('translated');
	};

	/**
	 * Gets viewport width.
	 * @protected
	 * @return {Number} - The width in pixel.
	 */
	Owl.prototype.viewport = function() {
		var width;
		if (this.options.responsiveBaseElement !== window) {
			width = $(this.options.responsiveBaseElement).width();
		} else if (window.innerWidth) {
			width = window.innerWidth;
		} else if (document.documentElement && document.documentElement.clientWidth) {
			width = document.documentElement.clientWidth;
		} else {
			console.warn('Can not detect viewport width.');
		}
		return width;
	};

	/**
	 * Replaces the current content.
	 * @public
	 * @param {HTMLElement|jQuery|String} content - The new content.
	 */
	Owl.prototype.replace = function(content) {
		this.$stage.empty();
		this._items = [];

		if (content) {
			content = (content instanceof jQuery) ? content : $(content);
		}

		if (this.settings.nestedItemSelector) {
			content = content.find('.' + this.settings.nestedItemSelector);
		}

		content.filter(function() {
			return this.nodeType === 1;
		}).each($.proxy(function(index, item) {
			item = this.prepare(item);
			this.$stage.append(item);
			this._items.push(item);
			this._mergers.push(item.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		}, this));

		this.reset(this.isNumeric(this.settings.startPosition) ? this.settings.startPosition : 0);

		this.invalidate('items');
	};

	/**
	 * Adds an item.
	 * @todo Use `item` instead of `content` for the event arguments.
	 * @public
	 * @param {HTMLElement|jQuery|String} content - The item content to add.
	 * @param {Number} [position] - The relative position at which to insert the item otherwise the item will be added to the end.
	 */
	Owl.prototype.add = function(content, position) {
		var current = this.relative(this._current);

		position = position === undefined ? this._items.length : this.normalize(position, true);
		content = content instanceof jQuery ? content : $(content);

		this.trigger('add', { content: content, position: position });

		content = this.prepare(content);

		if (this._items.length === 0 || position === this._items.length) {
			this._items.length === 0 && this.$stage.append(content);
			this._items.length !== 0 && this._items[position - 1].after(content);
			this._items.push(content);
			this._mergers.push(content.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		} else {
			this._items[position].before(content);
			this._items.splice(position, 0, content);
			this._mergers.splice(position, 0, content.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		}

		this._items[current] && this.reset(this._items[current].index());

		this.invalidate('items');

		this.trigger('added', { content: content, position: position });
	};

	/**
	 * Removes an item by its position.
	 * @todo Use `item` instead of `content` for the event arguments.
	 * @public
	 * @param {Number} position - The relative position of the item to remove.
	 */
	Owl.prototype.remove = function(position) {
		position = this.normalize(position, true);

		if (position === undefined) {
			return;
		}

		this.trigger('remove', { content: this._items[position], position: position });

		this._items[position].remove();
		this._items.splice(position, 1);
		this._mergers.splice(position, 1);

		this.invalidate('items');

		this.trigger('removed', { content: null, position: position });
	};

	/**
	 * Preloads images with auto width.
	 * @todo Replace by a more generic approach
	 * @protected
	 */
	Owl.prototype.preloadAutoWidthImages = function(images) {
		images.each($.proxy(function(i, element) {
			this.enter('pre-loading');
			element = $(element);
			$(new Image()).one('load', $.proxy(function(e) {
				element.attr('src', e.target.src);
				element.css('opacity', 1);
				this.leave('pre-loading');
				!this.is('pre-loading') && !this.is('initializing') && this.refresh();
			}, this)).attr('src', element.attr('src') || element.attr('data-src') || element.attr('data-src-retina'));
		}, this));
	};

	/**
	 * Destroys the carousel.
	 * @public
	 */
	Owl.prototype.destroy = function() {

		this.$element.off('.owl.core');
		this.$stage.off('.owl.core');
		$(document).off('.owl.core');

		if (this.settings.responsive !== false) {
			window.clearTimeout(this.resizeTimer);
			this.off(window, 'resize', this._handlers.onThrottledResize);
		}

		for (var i in this._plugins) {
			this._plugins[i].destroy();
		}

		this.$stage.children('.cloned').remove();

		this.$stage.unwrap();
		this.$stage.children().contents().unwrap();
		this.$stage.children().unwrap();
		this.$stage.remove();
		this.$element
			.removeClass(this.options.refreshClass)
			.removeClass(this.options.loadingClass)
			.removeClass(this.options.loadedClass)
			.removeClass(this.options.rtlClass)
			.removeClass(this.options.dragClass)
			.removeClass(this.options.grabClass)
			.attr('class', this.$element.attr('class').replace(new RegExp(this.options.responsiveClass + '-\\S+\\s', 'g'), ''))
			.removeData('owl.carousel');
	};

	/**
	 * Operators to calculate right-to-left and left-to-right.
	 * @protected
	 * @param {Number} [a] - The left side operand.
	 * @param {String} [o] - The operator.
	 * @param {Number} [b] - The right side operand.
	 */
	Owl.prototype.op = function(a, o, b) {
		var rtl = this.settings.rtl;
		switch (o) {
			case '<':
				return rtl ? a > b : a < b;
			case '>':
				return rtl ? a < b : a > b;
			case '>=':
				return rtl ? a <= b : a >= b;
			case '<=':
				return rtl ? a >= b : a <= b;
			default:
				break;
		}
	};

	/**
	 * Attaches to an internal event.
	 * @protected
	 * @param {HTMLElement} element - The event source.
	 * @param {String} event - The event name.
	 * @param {Function} listener - The event handler to attach.
	 * @param {Boolean} capture - Wether the event should be handled at the capturing phase or not.
	 */
	Owl.prototype.on = function(element, event, listener, capture) {
		if (element.addEventListener) {
			element.addEventListener(event, listener, capture);
		} else if (element.attachEvent) {
			element.attachEvent('on' + event, listener);
		}
	};

	/**
	 * Detaches from an internal event.
	 * @protected
	 * @param {HTMLElement} element - The event source.
	 * @param {String} event - The event name.
	 * @param {Function} listener - The attached event handler to detach.
	 * @param {Boolean} capture - Wether the attached event handler was registered as a capturing listener or not.
	 */
	Owl.prototype.off = function(element, event, listener, capture) {
		if (element.removeEventListener) {
			element.removeEventListener(event, listener, capture);
		} else if (element.detachEvent) {
			element.detachEvent('on' + event, listener);
		}
	};

	/**
	 * Triggers a public event.
	 * @todo Remove `status`, `relatedTarget` should be used instead.
	 * @protected
	 * @param {String} name - The event name.
	 * @param {*} [data=null] - The event data.
	 * @param {String} [namespace=carousel] - The event namespace.
	 * @param {String} [state] - The state which is associated with the event.
	 * @param {Boolean} [enter=false] - Indicates if the call enters the specified state or not.
	 * @returns {Event} - The event arguments.
	 */
	Owl.prototype.trigger = function(name, data, namespace, state, enter) {
		var status = {
			item: { count: this._items.length, index: this.current() }
		}, handler = $.camelCase(
			$.grep([ 'on', name, namespace ], function(v) { return v })
				.join('-').toLowerCase()
		), event = $.Event(
			[ name, 'owl', namespace || 'carousel' ].join('.').toLowerCase(),
			$.extend({ relatedTarget: this }, status, data)
		);

		if (!this._supress[name]) {
			$.each(this._plugins, function(name, plugin) {
				if (plugin.onTrigger) {
					plugin.onTrigger(event);
				}
			});

			this.register({ type: Owl.Type.Event, name: name });
			this.$element.trigger(event);

			if (this.settings && typeof this.settings[handler] === 'function') {
				this.settings[handler].call(this, event);
			}
		}

		return event;
	};

	/**
	 * Enters a state.
	 * @param name - The state name.
	 */
	Owl.prototype.enter = function(name) {
		$.each([ name ].concat(this._states.tags[name] || []), $.proxy(function(i, name) {
			if (this._states.current[name] === undefined) {
				this._states.current[name] = 0;
			}

			this._states.current[name]++;
		}, this));
	};

	/**
	 * Leaves a state.
	 * @param name - The state name.
	 */
	Owl.prototype.leave = function(name) {
		$.each([ name ].concat(this._states.tags[name] || []), $.proxy(function(i, name) {
			this._states.current[name]--;
		}, this));
	};

	/**
	 * Registers an event or state.
	 * @public
	 * @param {Object} object - The event or state to register.
	 */
	Owl.prototype.register = function(object) {
		if (object.type === Owl.Type.Event) {
			if (!$.event.special[object.name]) {
				$.event.special[object.name] = {};
			}

			if (!$.event.special[object.name].owl) {
				var _default = $.event.special[object.name]._default;
				$.event.special[object.name]._default = function(e) {
					if (_default && _default.apply && (!e.namespace || e.namespace.indexOf('owl') === -1)) {
						return _default.apply(this, arguments);
					}
					return e.namespace && e.namespace.indexOf('owl') > -1;
				};
				$.event.special[object.name].owl = true;
			}
		} else if (object.type === Owl.Type.State) {
			if (!this._states.tags[object.name]) {
				this._states.tags[object.name] = object.tags;
			} else {
				this._states.tags[object.name] = this._states.tags[object.name].concat(object.tags);
			}

			this._states.tags[object.name] = $.grep(this._states.tags[object.name], $.proxy(function(tag, i) {
				return $.inArray(tag, this._states.tags[object.name]) === i;
			}, this));
		}
	};

	/**
	 * Suppresses events.
	 * @protected
	 * @param {Array.<String>} events - The events to suppress.
	 */
	Owl.prototype.suppress = function(events) {
		$.each(events, $.proxy(function(index, event) {
			this._supress[event] = true;
		}, this));
	};

	/**
	 * Releases suppressed events.
	 * @protected
	 * @param {Array.<String>} events - The events to release.
	 */
	Owl.prototype.release = function(events) {
		$.each(events, $.proxy(function(index, event) {
			delete this._supress[event];
		}, this));
	};

	/**
	 * Gets unified pointer coordinates from event.
	 * @todo #261
	 * @protected
	 * @param {Event} - The `mousedown` or `touchstart` event.
	 * @returns {Object} - Contains `x` and `y` coordinates of current pointer position.
	 */
	Owl.prototype.pointer = function(event) {
		var result = { x: null, y: null };

		event = event.originalEvent || event || window.event;

		event = event.touches && event.touches.length ?
			event.touches[0] : event.changedTouches && event.changedTouches.length ?
				event.changedTouches[0] : event;

		if (event.pageX) {
			result.x = event.pageX;
			result.y = event.pageY;
		} else {
			result.x = event.clientX;
			result.y = event.clientY;
		}

		return result;
	};

	/**
	 * Determines if the input is a Number or something that can be coerced to a Number
	 * @protected
	 * @param {Number|String|Object|Array|Boolean|RegExp|Function|Symbol} - The input to be tested
	 * @returns {Boolean} - An indication if the input is a Number or can be coerced to a Number
	 */
	Owl.prototype.isNumeric = function(number) {
		return !isNaN(parseFloat(number));
	};

	/**
	 * Gets the difference of two vectors.
	 * @todo #261
	 * @protected
	 * @param {Object} - The first vector.
	 * @param {Object} - The second vector.
	 * @returns {Object} - The difference.
	 */
	Owl.prototype.difference = function(first, second) {
		return {
			x: first.x - second.x,
			y: first.y - second.y
		};
	};

	/**
	 * The jQuery Plugin for the Owl Carousel
	 * @todo Navigation plugin `next` and `prev`
	 * @public
	 */
	$.fn.owlCarousel = function(option) {
		var args = Array.prototype.slice.call(arguments, 1);

		return this.each(function() {
			var $this = $(this),
				data = $this.data('owl.carousel');

			if (!data) {
				data = new Owl(this, typeof option == 'object' && option);
				$this.data('owl.carousel', data);

				$.each([
					'next', 'prev', 'to', 'destroy', 'refresh', 'replace', 'add', 'remove'
				], function(i, event) {
					data.register({ type: Owl.Type.Event, name: event });
					data.$element.on(event + '.owl.carousel.core', $.proxy(function(e) {
						if (e.namespace && e.relatedTarget !== this) {
							this.suppress([ event ]);
							data[event].apply(this, [].slice.call(arguments, 1));
							this.release([ event ]);
						}
					}, data));
				});
			}

			if (typeof option == 'string' && option.charAt(0) !== '_') {
				data[option].apply(data, args);
			}
		});
	};

	/**
	 * The constructor for the jQuery Plugin
	 * @public
	 */
	$.fn.owlCarousel.Constructor = Owl;

})(window.Zepto || window.jQuery, window, document);

/**
 * AutoRefresh Plugin
 * @version 2.3.3
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the auto refresh plugin.
	 * @class The Auto Refresh Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var AutoRefresh = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Refresh interval.
		 * @protected
		 * @type {number}
		 */
		this._interval = null;

		/**
		 * Whether the element is currently visible or not.
		 * @protected
		 * @type {Boolean}
		 */
		this._visible = null;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoRefresh) {
					this.watch();
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, AutoRefresh.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	AutoRefresh.Defaults = {
		autoRefresh: true,
		autoRefreshInterval: 500
	};

	/**
	 * Watches the element.
	 */
	AutoRefresh.prototype.watch = function() {
		if (this._interval) {
			return;
		}

		this._visible = this._core.isVisible();
		this._interval = window.setInterval($.proxy(this.refresh, this), this._core.settings.autoRefreshInterval);
	};

	/**
	 * Refreshes the element.
	 */
	AutoRefresh.prototype.refresh = function() {
		if (this._core.isVisible() === this._visible) {
			return;
		}

		this._visible = !this._visible;

		this._core.$element.toggleClass('owl-hidden', !this._visible);

		this._visible && (this._core.invalidate('width') && this._core.refresh());
	};

	/**
	 * Destroys the plugin.
	 */
	AutoRefresh.prototype.destroy = function() {
		var handler, property;

		window.clearInterval(this._interval);

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.AutoRefresh = AutoRefresh;

})(window.Zepto || window.jQuery, window, document);

/**
 * Lazy Plugin
 * @version 2.3.3
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the lazy plugin.
	 * @class The Lazy Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Lazy = function(carousel) {

		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Already loaded items.
		 * @protected
		 * @type {Array.<jQuery>}
		 */
		this._loaded = [];

		/**
		 * Event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel change.owl.carousel resized.owl.carousel': $.proxy(function(e) {
				if (!e.namespace) {
					return;
				}

				if (!this._core.settings || !this._core.settings.lazyLoad) {
					return;
				}

				if ((e.property && e.property.name == 'position') || e.type == 'initialized') {
					var settings = this._core.settings,
						n = (settings.center && Math.ceil(settings.items / 2) || settings.items),
						i = ((settings.center && n * -1) || 0),
						position = (e.property && e.property.value !== undefined ? e.property.value : this._core.current()) + i,
						clones = this._core.clones().length,
						load = $.proxy(function(i, v) { this.load(v) }, this);

					while (i++ < n) {
						this.load(clones / 2 + this._core.relative(position));
						clones && $.each(this._core.clones(this._core.relative(position)), load);
						position++;
					}
				}
			}, this)
		};

		// set the default options
		this._core.options = $.extend({}, Lazy.Defaults, this._core.options);

		// register event handler
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	Lazy.Defaults = {
		lazyLoad: false
	};

	/**
	 * Loads all resources of an item at the specified position.
	 * @param {Number} position - The absolute position of the item.
	 * @protected
	 */
	Lazy.prototype.load = function(position) {
		var $item = this._core.$stage.children().eq(position),
			$elements = $item && $item.find('.owl-lazy');

		if (!$elements || $.inArray($item.get(0), this._loaded) > -1) {
			return;
		}

		$elements.each($.proxy(function(index, element) {
			var $element = $(element), image,
                url = (window.devicePixelRatio > 1 && $element.attr('data-src-retina')) || $element.attr('data-src') || $element.attr('data-srcset');

			this._core.trigger('load', { element: $element, url: url }, 'lazy');

			if ($element.is('img')) {
				$element.one('load.owl.lazy', $.proxy(function() {
					$element.css('opacity', 1);
					this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
				}, this)).attr('src', url);
            } else if ($element.is('source')) {
                $element.one('load.owl.lazy', $.proxy(function() {
                    this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
                }, this)).attr('srcset', url);
			} else {
				image = new Image();
				image.onload = $.proxy(function() {
					$element.css({
						'background-image': 'url("' + url + '")',
						'opacity': '1'
					});
					this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
				}, this);
				image.src = url;
			}
		}, this));

		this._loaded.push($item.get(0));
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Lazy.prototype.destroy = function() {
		var handler, property;

		for (handler in this.handlers) {
			this._core.$element.off(handler, this.handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Lazy = Lazy;

})(window.Zepto || window.jQuery, window, document);

/**
 * AutoHeight Plugin
 * @version 2.3.3
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the auto height plugin.
	 * @class The Auto Height Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var AutoHeight = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight) {
					this.update();
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight && e.property.name === 'position'){
					console.log('update called');
					this.update();
				}
			}, this),
			'loaded.owl.lazy': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight
					&& e.element.closest('.' + this._core.settings.itemClass).index() === this._core.current()) {
					this.update();
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, AutoHeight.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);
		this._intervalId = null;
		var refThis = this;

		// These changes have been taken from a PR by gavrochelegnou proposed in #1575
		// and have been made compatible with the latest jQuery version
		$(window).on('load', function() {
			if (refThis._core.settings.autoHeight) {
				refThis.update();
			}
		});

		// Autoresize the height of the carousel when window is resized
		// When carousel has images, the height is dependent on the width
		// and should also change on resize
		$(window).resize(function() {
			if (refThis._core.settings.autoHeight) {
				if (refThis._intervalId != null) {
					clearTimeout(refThis._intervalId);
				}

				refThis._intervalId = setTimeout(function() {
					refThis.update();
				}, 250);
			}
		});

	};

	/**
	 * Default options.
	 * @public
	 */
	AutoHeight.Defaults = {
		autoHeight: false,
		autoHeightClass: 'owl-height'
	};

	/**
	 * Updates the view.
	 */
	AutoHeight.prototype.update = function() {
		var start = this._core._current,
			end = start + this._core.settings.items,
			visible = this._core.$stage.children().toArray().slice(start, end),
			heights = [],
			maxheight = 0;

		$.each(visible, function(index, item) {
			heights.push($(item).height());
		});

		maxheight = Math.max.apply(null, heights);

		this._core.$stage.parent()
			.height(maxheight)
			.addClass(this._core.settings.autoHeightClass);
	};

	AutoHeight.prototype.destroy = function() {
		var handler, property;

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] !== 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.AutoHeight = AutoHeight;

})(window.Zepto || window.jQuery, window, document);

/**
 * Video Plugin
 * @version 2.3.3
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the video plugin.
	 * @class The Video Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Video = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Cache all video URLs.
		 * @protected
		 * @type {Object}
		 */
		this._videos = {};

		/**
		 * Current playing item.
		 * @protected
		 * @type {jQuery}
		 */
		this._playing = null;

		/**
		 * All event handlers.
		 * @todo The cloned content removale is too late
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					this._core.register({ type: 'state', name: 'playing', tags: [ 'interacting' ] });
				}
			}, this),
			'resize.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.video && this.isInFullScreen()) {
					e.preventDefault();
				}
			}, this),
			'refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.is('resizing')) {
					this._core.$stage.find('.cloned .owl-video-frame').remove();
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'position' && this._playing) {
					this.stop();
				}
			}, this),
			'prepared.owl.carousel': $.proxy(function(e) {
				if (!e.namespace) {
					return;
				}

				var $element = $(e.content).find('.owl-video');

				if ($element.length) {
					$element.css('display', 'none');
					this.fetch($element, $(e.content));
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Video.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);

		this._core.$element.on('click.owl.video', '.owl-video-play-icon', $.proxy(function(e) {
			this.play(e);
		}, this));
	};

	/**
	 * Default options.
	 * @public
	 */
	Video.Defaults = {
		video: false,
		videoHeight: false,
		videoWidth: false
	};

	/**
	 * Gets the video ID and the type (YouTube/Vimeo/vzaar only).
	 * @protected
	 * @param {jQuery} target - The target containing the video data.
	 * @param {jQuery} item - The item containing the video.
	 */
	Video.prototype.fetch = function(target, item) {
			var type = (function() {
					if (target.attr('data-vimeo-id')) {
						return 'vimeo';
					} else if (target.attr('data-vzaar-id')) {
						return 'vzaar'
					} else {
						return 'youtube';
					}
				})(),
				id = target.attr('data-vimeo-id') || target.attr('data-youtube-id') || target.attr('data-vzaar-id'),
				width = target.attr('data-width') || this._core.settings.videoWidth,
				height = target.attr('data-height') || this._core.settings.videoHeight,
				url = target.attr('href');

		if (url) {

			/*
					Parses the id's out of the following urls (and probably more):
					https://www.youtube.com/watch?v=:id
					https://youtu.be/:id
					https://vimeo.com/:id
					https://vimeo.com/channels/:channel/:id
					https://vimeo.com/groups/:group/videos/:id
					https://app.vzaar.com/videos/:id

					Visual example: https://regexper.com/#(http%3A%7Chttps%3A%7C)%5C%2F%5C%2F(player.%7Cwww.%7Capp.)%3F(vimeo%5C.com%7Cyoutu(be%5C.com%7C%5C.be%7Cbe%5C.googleapis%5C.com)%7Cvzaar%5C.com)%5C%2F(video%5C%2F%7Cvideos%5C%2F%7Cembed%5C%2F%7Cchannels%5C%2F.%2B%5C%2F%7Cgroups%5C%2F.%2B%5C%2F%7Cwatch%5C%3Fv%3D%7Cv%5C%2F)%3F(%5BA-Za-z0-9._%25-%5D*)(%5C%26%5CS%2B)%3F
			*/

			id = url.match(/(http:|https:|)\/\/(player.|www.|app.)?(vimeo\.com|youtu(be\.com|\.be|be\.googleapis\.com)|vzaar\.com)\/(video\/|videos\/|embed\/|channels\/.+\/|groups\/.+\/|watch\?v=|v\/)?([A-Za-z0-9._%-]*)(\&\S+)?/);

			if (id[3].indexOf('youtu') > -1) {
				type = 'youtube';
			} else if (id[3].indexOf('vimeo') > -1) {
				type = 'vimeo';
			} else if (id[3].indexOf('vzaar') > -1) {
				type = 'vzaar';
			} else {
				throw new Error('Video URL not supported.');
			}
			id = id[6];
		} else {
			throw new Error('Missing video URL.');
		}

		this._videos[url] = {
			type: type,
			id: id,
			width: width,
			height: height
		};

		item.attr('data-video', url);

		this.thumbnail(target, this._videos[url]);
	};

	/**
	 * Creates video thumbnail.
	 * @protected
	 * @param {jQuery} target - The target containing the video data.
	 * @param {Object} info - The video info object.
	 * @see `fetch`
	 */
	Video.prototype.thumbnail = function(target, video) {
		var tnLink,
			icon,
			path,
			dimensions = video.width && video.height ? 'style="width:' + video.width + 'px;height:' + video.height + 'px;"' : '',
			customTn = target.find('img'),
			srcType = 'src',
			lazyClass = '',
			settings = this._core.settings,
			create = function(path) {
				icon = '<div class="owl-video-play-icon"></div>';

				if (settings.lazyLoad) {
					tnLink = '<div class="owl-video-tn ' + lazyClass + '" ' + srcType + '="' + path + '"></div>';
				} else {
					tnLink = '<div class="owl-video-tn" style="opacity:1;background-image:url(' + path + ')"></div>';
				}
				target.after(tnLink);
				target.after(icon);
			};

		// wrap video content into owl-video-wrapper div
		target.wrap('<div class="owl-video-wrapper"' + dimensions + '></div>');

		if (this._core.settings.lazyLoad) {
			srcType = 'data-src';
			lazyClass = 'owl-lazy';
		}

		// custom thumbnail
		if (customTn.length) {
			create(customTn.attr(srcType));
			customTn.remove();
			return false;
		}

		if (video.type === 'youtube') {
			path = "//img.youtube.com/vi/" + video.id + "/hqdefault.jpg";
			create(path);
		} else if (video.type === 'vimeo') {
			$.ajax({
				type: 'GET',
				url: '//vimeo.com/api/v2/video/' + video.id + '.json',
				jsonp: 'callback',
				dataType: 'jsonp',
				success: function(data) {
					path = data[0].thumbnail_large;
					create(path);
				}
			});
		} else if (video.type === 'vzaar') {
			$.ajax({
				type: 'GET',
				url: '//vzaar.com/api/videos/' + video.id + '.json',
				jsonp: 'callback',
				dataType: 'jsonp',
				success: function(data) {
					path = data.framegrab_url;
					create(path);
				}
			});
		}
	};

	/**
	 * Stops the current video.
	 * @public
	 */
	Video.prototype.stop = function() {
		this._core.trigger('stop', null, 'video');
		this._playing.find('.owl-video-frame').remove();
		this._playing.removeClass('owl-video-playing');
		this._playing = null;
		this._core.leave('playing');
		this._core.trigger('stopped', null, 'video');
	};

	/**
	 * Starts the current video.
	 * @public
	 * @param {Event} event - The event arguments.
	 */
	Video.prototype.play = function(event) {
		var target = $(event.target),
			item = target.closest('.' + this._core.settings.itemClass),
			video = this._videos[item.attr('data-video')],
			width = video.width || '100%',
			height = video.height || this._core.$stage.height(),
			html;

		if (this._playing) {
			return;
		}

		this._core.enter('playing');
		this._core.trigger('play', null, 'video');

		item = this._core.items(this._core.relative(item.index()));

		this._core.reset(item.index());

		if (video.type === 'youtube') {
			html = '<iframe width="' + width + '" height="' + height + '" src="//www.youtube.com/embed/' +
				video.id + '?autoplay=1&rel=0&v=' + video.id + '" frameborder="0" allowfullscreen></iframe>';
		} else if (video.type === 'vimeo') {
			html = '<iframe src="//player.vimeo.com/video/' + video.id +
				'?autoplay=1" width="' + width + '" height="' + height +
				'" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>';
		} else if (video.type === 'vzaar') {
			html = '<iframe frameborder="0"' + 'height="' + height + '"' + 'width="' + width +
				'" allowfullscreen mozallowfullscreen webkitAllowFullScreen ' +
				'src="//view.vzaar.com/' + video.id + '/player?autoplay=true"></iframe>';
		}

		$('<div class="owl-video-frame">' + html + '</div>').insertAfter(item.find('.owl-video'));

		this._playing = item.addClass('owl-video-playing');
	};

	/**
	 * Checks whether an video is currently in full screen mode or not.
	 * @todo Bad style because looks like a readonly method but changes members.
	 * @protected
	 * @returns {Boolean}
	 */
	Video.prototype.isInFullScreen = function() {
		var element = document.fullscreenElement || document.mozFullScreenElement ||
				document.webkitFullscreenElement;

		return element && $(element).parent().hasClass('owl-video-frame');
	};

	/**
	 * Destroys the plugin.
	 */
	Video.prototype.destroy = function() {
		var handler, property;

		this._core.$element.off('click.owl.video');

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Video = Video;

})(window.Zepto || window.jQuery, window, document);

/**
 * Animate Plugin
 * @version 2.3.3
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the animate plugin.
	 * @class The Navigation Plugin
	 * @param {Owl} scope - The Owl Carousel
	 */
	var Animate = function(scope) {
		this.core = scope;
		this.core.options = $.extend({}, Animate.Defaults, this.core.options);
		this.swapping = true;
		this.previous = undefined;
		this.next = undefined;

		this.handlers = {
			'change.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name == 'position') {
					this.previous = this.core.current();
					this.next = e.property.value;
				}
			}, this),
			'drag.owl.carousel dragged.owl.carousel translated.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					this.swapping = e.type == 'translated';
				}
			}, this),
			'translate.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this.swapping && (this.core.options.animateOut || this.core.options.animateIn)) {
					this.swap();
				}
			}, this)
		};

		this.core.$element.on(this.handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	Animate.Defaults = {
		animateOut: false,
		animateIn: false
	};

	/**
	 * Toggles the animation classes whenever an translations starts.
	 * @protected
	 * @returns {Boolean|undefined}
	 */
	Animate.prototype.swap = function() {

		if (this.core.settings.items !== 1) {
			return;
		}

		if (!$.support.animation || !$.support.transition) {
			return;
		}

		this.core.speed(0);

		var left,
			clear = $.proxy(this.clear, this),
			previous = this.core.$stage.children().eq(this.previous),
			next = this.core.$stage.children().eq(this.next),
			incoming = this.core.settings.animateIn,
			outgoing = this.core.settings.animateOut;

		if (this.core.current() === this.previous) {
			return;
		}

		if (outgoing) {
			left = this.core.coordinates(this.previous) - this.core.coordinates(this.next);
			previous.one($.support.animation.end, clear)
				.css( { 'left': left + 'px' } )
				.addClass('animated owl-animated-out')
				.addClass(outgoing);
		}

		if (incoming) {
			next.one($.support.animation.end, clear)
				.addClass('animated owl-animated-in')
				.addClass(incoming);
		}
	};

	Animate.prototype.clear = function(e) {
		$(e.target).css( { 'left': '' } )
			.removeClass('animated owl-animated-out owl-animated-in')
			.removeClass(this.core.settings.animateIn)
			.removeClass(this.core.settings.animateOut);
		this.core.onTransitionEnd();
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Animate.prototype.destroy = function() {
		var handler, property;

		for (handler in this.handlers) {
			this.core.$element.off(handler, this.handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Animate = Animate;

})(window.Zepto || window.jQuery, window, document);

/**
 * Autoplay Plugin
 * @version 2.3.3
 * @author Bartosz Wojciechowski
 * @author Artus Kolanowski
 * @author David Deutsch
 * @author Tom De Caluwé
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the autoplay plugin.
	 * @class The Autoplay Plugin
	 * @param {Owl} scope - The Owl Carousel
	 */
	var Autoplay = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * The autoplay timeout id.
		 * @type {Number}
		 */
		this._call = null;

		/**
		 * Depending on the state of the plugin, this variable contains either
		 * the start time of the timer or the current timer value if it's
		 * paused. Since we start in a paused state we initialize the timer
		 * value.
		 * @type {Number}
		 */
		this._time = 0;

		/**
		 * Stores the timeout currently used.
		 * @type {Number}
		 */
		this._timeout = 0;

		/**
		 * Indicates whenever the autoplay is paused.
		 * @type {Boolean}
		 */
		this._paused = true;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'settings') {
					if (this._core.settings.autoplay) {
						this.play();
					} else {
						this.stop();
					}
				} else if (e.namespace && e.property.name === 'position' && this._paused) {
					// Reset the timer. This code is triggered when the position
					// of the carousel was changed through user interaction.
					this._time = 0;
				}
			}, this),
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoplay) {
					this.play();
				}
			}, this),
			'play.owl.autoplay': $.proxy(function(e, t, s) {
				if (e.namespace) {
					this.play(t, s);
				}
			}, this),
			'stop.owl.autoplay': $.proxy(function(e) {
				if (e.namespace) {
					this.stop();
				}
			}, this),
			'mouseover.owl.autoplay': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.pause();
				}
			}, this),
			'mouseleave.owl.autoplay': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.play();
				}
			}, this),
			'touchstart.owl.core': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.pause();
				}
			}, this),
			'touchend.owl.core': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause) {
					this.play();
				}
			}, this)
		};

		// register event handlers
		this._core.$element.on(this._handlers);

		// set default options
		this._core.options = $.extend({}, Autoplay.Defaults, this._core.options);
	};

	/**
	 * Default options.
	 * @public
	 */
	Autoplay.Defaults = {
		autoplay: false,
		autoplayTimeout: 5000,
		autoplayHoverPause: false,
		autoplaySpeed: false
	};

	/**
	 * Transition to the next slide and set a timeout for the next transition.
	 * @private
	 * @param {Number} [speed] - The animation speed for the animations.
	 */
	Autoplay.prototype._next = function(speed) {
		this._call = window.setTimeout(
			$.proxy(this._next, this, speed),
			this._timeout * (Math.round(this.read() / this._timeout) + 1) - this.read()
		);

		if (this._core.is('interacting') || document.hidden) {
			return;
		}
		this._core.next(speed || this._core.settings.autoplaySpeed);
	}

	/**
	 * Reads the current timer value when the timer is playing.
	 * @public
	 */
	Autoplay.prototype.read = function() {
		return new Date().getTime() - this._time;
	};

	/**
	 * Starts the autoplay.
	 * @public
	 * @param {Number} [timeout] - The interval before the next animation starts.
	 * @param {Number} [speed] - The animation speed for the animations.
	 */
	Autoplay.prototype.play = function(timeout, speed) {
		var elapsed;

		if (!this._core.is('rotating')) {
			this._core.enter('rotating');
		}

		timeout = timeout || this._core.settings.autoplayTimeout;

		// Calculate the elapsed time since the last transition. If the carousel
		// wasn't playing this calculation will yield zero.
		elapsed = Math.min(this._time % (this._timeout || timeout), timeout);

		if (this._paused) {
			// Start the clock.
			this._time = this.read();
			this._paused = false;
		} else {
			// Clear the active timeout to allow replacement.
			window.clearTimeout(this._call);
		}

		// Adjust the origin of the timer to match the new timeout value.
		this._time += this.read() % timeout - elapsed;

		this._timeout = timeout;
		this._call = window.setTimeout($.proxy(this._next, this, speed), timeout - elapsed);
	};

	/**
	 * Stops the autoplay.
	 * @public
	 */
	Autoplay.prototype.stop = function() {
		if (this._core.is('rotating')) {
			// Reset the clock.
			this._time = 0;
			this._paused = true;

			window.clearTimeout(this._call);
			this._core.leave('rotating');
		}
	};

	/**
	 * Pauses the autoplay.
	 * @public
	 */
	Autoplay.prototype.pause = function() {
		if (this._core.is('rotating') && !this._paused) {
			// Pause the clock.
			this._time = this.read();
			this._paused = true;

			window.clearTimeout(this._call);
		}
	};

	/**
	 * Destroys the plugin.
	 */
	Autoplay.prototype.destroy = function() {
		var handler, property;

		this.stop();

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.autoplay = Autoplay;

})(window.Zepto || window.jQuery, window, document);

/**
 * Navigation Plugin
 * @version 2.3.3
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {
	'use strict';

	/**
	 * Creates the navigation plugin.
	 * @class The Navigation Plugin
	 * @param {Owl} carousel - The Owl Carousel.
	 */
	var Navigation = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Indicates whether the plugin is initialized or not.
		 * @protected
		 * @type {Boolean}
		 */
		this._initialized = false;

		/**
		 * The current paging indexes.
		 * @protected
		 * @type {Array}
		 */
		this._pages = [];

		/**
		 * All DOM elements of the user interface.
		 * @protected
		 * @type {Object}
		 */
		this._controls = {};

		/**
		 * Markup for an indicator.
		 * @protected
		 * @type {Array.<String>}
		 */
		this._templates = [];

		/**
		 * The carousel element.
		 * @type {jQuery}
		 */
		this.$element = this._core.$element;

		/**
		 * Overridden methods of the carousel.
		 * @protected
		 * @type {Object}
		 */
		this._overrides = {
			next: this._core.next,
			prev: this._core.prev,
			to: this._core.to
		};

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'prepared.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.push('<div class="' + this._core.settings.dotClass + '">' +
						$(e.content).find('[data-dot]').addBack('[data-dot]').attr('data-dot') + '</div>');
				}
			}, this),
			'added.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.splice(e.position, 0, this._templates.pop());
				}
			}, this),
			'remove.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.splice(e.position, 1);
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name == 'position') {
					this.draw();
				}
			}, this),
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && !this._initialized) {
					this._core.trigger('initialize', null, 'navigation');
					this.initialize();
					this.update();
					this.draw();
					this._initialized = true;
					this._core.trigger('initialized', null, 'navigation');
				}
			}, this),
			'refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._initialized) {
					this._core.trigger('refresh', null, 'navigation');
					this.update();
					this.draw();
					this._core.trigger('refreshed', null, 'navigation');
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Navigation.Defaults, this._core.options);

		// register event handlers
		this.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 * @todo Rename `slideBy` to `navBy`
	 */
	Navigation.Defaults = {
		nav: false,
		navText: [
			'<span aria-label="' + 'Previous' + '">&#x2039;</span>',
			'<span aria-label="' + 'Next' + '">&#x203a;</span>'
		],
		navSpeed: false,
		navElement: 'button type="button" role="presentation"',
		navContainer: false,
		navContainerClass: 'owl-nav',
		navClass: [
			'owl-prev',
			'owl-next'
		],
		slideBy: 1,
		dotClass: 'owl-dot',
		dotsClass: 'owl-dots',
		dots: true,
		dotsEach: false,
		dotsData: false,
		dotsSpeed: false,
		dotsContainer: false
	};

	/**
	 * Initializes the layout of the plugin and extends the carousel.
	 * @protected
	 */
	Navigation.prototype.initialize = function() {
		var override,
			settings = this._core.settings;

		// create DOM structure for relative navigation
		this._controls.$relative = (settings.navContainer ? $(settings.navContainer)
			: $('<div>').addClass(settings.navContainerClass).appendTo(this.$element)).addClass('disabled');

		this._controls.$previous = $('<' + settings.navElement + '>')
			.addClass(settings.navClass[0])
			.html(settings.navText[0])
			.prependTo(this._controls.$relative)
			.on('click', $.proxy(function(e) {
				this.prev(settings.navSpeed);
			}, this));
		this._controls.$next = $('<' + settings.navElement + '>')
			.addClass(settings.navClass[1])
			.html(settings.navText[1])
			.appendTo(this._controls.$relative)
			.on('click', $.proxy(function(e) {
				this.next(settings.navSpeed);
			}, this));

		// create DOM structure for absolute navigation
		if (!settings.dotsData) {
			this._templates = [ $('<button role="button">')
				.addClass(settings.dotClass)
				.append($('<span>'))
				.prop('outerHTML') ];
		}

		this._controls.$absolute = (settings.dotsContainer ? $(settings.dotsContainer)
			: $('<div>').addClass(settings.dotsClass).appendTo(this.$element)).addClass('disabled');

		this._controls.$absolute.on('click', 'button', $.proxy(function(e) {
			var index = $(e.target).parent().is(this._controls.$absolute)
				? $(e.target).index() : $(e.target).parent().index();

			e.preventDefault();

			this.to(index, settings.dotsSpeed);
		}, this));

		/*$el.on('focusin', function() {
			$(document).off(".carousel");

			$(document).on('keydown.carousel', function(e) {
				if(e.keyCode == 37) {
					$el.trigger('prev.owl')
				}
				if(e.keyCode == 39) {
					$el.trigger('next.owl')
				}
			});
		});*/

		// override public methods of the carousel
		for (override in this._overrides) {
			this._core[override] = $.proxy(this[override], this);
		}
	};

	/**
	 * Destroys the plugin.
	 * @protected
	 */
	Navigation.prototype.destroy = function() {
		var handler, control, property, override, settings;
		settings = this._core.settings;

		for (handler in this._handlers) {
			this.$element.off(handler, this._handlers[handler]);
		}
		for (control in this._controls) {
			if (control === '$relative' && settings.navContainer) {
				this._controls[control].html('');
			} else {
				this._controls[control].remove();
			}
		}
		for (override in this.overides) {
			this._core[override] = this._overrides[override];
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	/**
	 * Updates the internal state.
	 * @protected
	 */
	Navigation.prototype.update = function() {
		var i, j, k,
			lower = this._core.clones().length / 2,
			upper = lower + this._core.items().length,
			maximum = this._core.maximum(true),
			settings = this._core.settings,
			size = settings.center || settings.autoWidth || settings.dotsData
				? 1 : settings.dotsEach || settings.items;

		if (settings.slideBy !== 'page') {
			settings.slideBy = Math.min(settings.slideBy, settings.items);
		}

		if (settings.dots || settings.slideBy == 'page') {
			this._pages = [];

			for (i = lower, j = 0, k = 0; i < upper; i++) {
				if (j >= size || j === 0) {
					this._pages.push({
						start: Math.min(maximum, i - lower),
						end: i - lower + size - 1
					});
					if (Math.min(maximum, i - lower) === maximum) {
						break;
					}
					j = 0, ++k;
				}
				j += this._core.mergers(this._core.relative(i));
			}
		}
	};

	/**
	 * Draws the user interface.
	 * @todo The option `dotsData` wont work.
	 * @protected
	 */
	Navigation.prototype.draw = function() {
		var difference,
			settings = this._core.settings,
			disabled = this._core.items().length <= settings.items,
			index = this._core.relative(this._core.current()),
			loop = settings.loop || settings.rewind;

		this._controls.$relative.toggleClass('disabled', !settings.nav || disabled);

		if (settings.nav) {
			this._controls.$previous.toggleClass('disabled', !loop && index <= this._core.minimum(true));
			this._controls.$next.toggleClass('disabled', !loop && index >= this._core.maximum(true));
		}

		this._controls.$absolute.toggleClass('disabled', !settings.dots || disabled);

		if (settings.dots) {
			difference = this._pages.length - this._controls.$absolute.children().length;

			if (settings.dotsData && difference !== 0) {
				this._controls.$absolute.html(this._templates.join(''));
			} else if (difference > 0) {
				this._controls.$absolute.append(new Array(difference + 1).join(this._templates[0]));
			} else if (difference < 0) {
				this._controls.$absolute.children().slice(difference).remove();
			}

			this._controls.$absolute.find('.active').removeClass('active');
			this._controls.$absolute.children().eq($.inArray(this.current(), this._pages)).addClass('active');
		}
	};

	/**
	 * Extends event data.
	 * @protected
	 * @param {Event} event - The event object which gets thrown.
	 */
	Navigation.prototype.onTrigger = function(event) {
		var settings = this._core.settings;

		event.page = {
			index: $.inArray(this.current(), this._pages),
			count: this._pages.length,
			size: settings && (settings.center || settings.autoWidth || settings.dotsData
				? 1 : settings.dotsEach || settings.items)
		};
	};

	/**
	 * Gets the current page position of the carousel.
	 * @protected
	 * @returns {Number}
	 */
	Navigation.prototype.current = function() {
		var current = this._core.relative(this._core.current());
		return $.grep(this._pages, $.proxy(function(page, index) {
			return page.start <= current && page.end >= current;
		}, this)).pop();
	};

	/**
	 * Gets the current succesor/predecessor position.
	 * @protected
	 * @returns {Number}
	 */
	Navigation.prototype.getPosition = function(successor) {
		var position, length,
			settings = this._core.settings;

		if (settings.slideBy == 'page') {
			position = $.inArray(this.current(), this._pages);
			length = this._pages.length;
			successor ? ++position : --position;
			position = this._pages[((position % length) + length) % length].start;
		} else {
			position = this._core.relative(this._core.current());
			length = this._core.items().length;
			successor ? position += settings.slideBy : position -= settings.slideBy;
		}

		return position;
	};

	/**
	 * Slides to the next item or page.
	 * @public
	 * @param {Number} [speed=false] - The time in milliseconds for the transition.
	 */
	Navigation.prototype.next = function(speed) {
		$.proxy(this._overrides.to, this._core)(this.getPosition(true), speed);
	};

	/**
	 * Slides to the previous item or page.
	 * @public
	 * @param {Number} [speed=false] - The time in milliseconds for the transition.
	 */
	Navigation.prototype.prev = function(speed) {
		$.proxy(this._overrides.to, this._core)(this.getPosition(false), speed);
	};

	/**
	 * Slides to the specified item or page.
	 * @public
	 * @param {Number} position - The position of the item or page.
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 * @param {Boolean} [standard=false] - Whether to use the standard behaviour or not.
	 */
	Navigation.prototype.to = function(position, speed, standard) {
		var length;

		if (!standard && this._pages.length) {
			length = this._pages.length;
			$.proxy(this._overrides.to, this._core)(this._pages[((position % length) + length) % length].start, speed);
		} else {
			$.proxy(this._overrides.to, this._core)(position, speed);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Navigation = Navigation;

})(window.Zepto || window.jQuery, window, document);

/**
 * Hash Plugin
 * @version 2.3.3
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {
	'use strict';

	/**
	 * Creates the hash plugin.
	 * @class The Hash Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Hash = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Hash index for the items.
		 * @protected
		 * @type {Object}
		 */
		this._hashes = {};

		/**
		 * The carousel element.
		 * @type {jQuery}
		 */
		this.$element = this._core.$element;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.startPosition === 'URLHash') {
					$(window).trigger('hashchange.owl.navigation');
				}
			}, this),
			'prepared.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					var hash = $(e.content).find('[data-hash]').addBack('[data-hash]').attr('data-hash');

					if (!hash) {
						return;
					}

					this._hashes[hash] = e.content;
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'position') {
					var current = this._core.items(this._core.relative(this._core.current())),
						hash = $.map(this._hashes, function(item, hash) {
							return item === current ? hash : null;
						}).join();

					if (!hash || window.location.hash.slice(1) === hash) {
						return;
					}

					window.location.hash = hash;
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Hash.Defaults, this._core.options);

		// register the event handlers
		this.$element.on(this._handlers);

		// register event listener for hash navigation
		$(window).on('hashchange.owl.navigation', $.proxy(function(e) {
			var hash = window.location.hash.substring(1),
				items = this._core.$stage.children(),
				position = this._hashes[hash] && items.index(this._hashes[hash]);

			if (position === undefined || position === this._core.current()) {
				return;
			}

			this._core.to(this._core.relative(position), false, true);
		}, this));
	};

	/**
	 * Default options.
	 * @public
	 */
	Hash.Defaults = {
		URLhashListener: false
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Hash.prototype.destroy = function() {
		var handler, property;

		$(window).off('hashchange.owl.navigation');

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Hash = Hash;

})(window.Zepto || window.jQuery, window, document);

/**
 * Support Plugin
 *
 * @version 2.3.3
 * @author Vivid Planet Software GmbH
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	var style = $('<support>').get(0).style,
		prefixes = 'Webkit Moz O ms'.split(' '),
		events = {
			transition: {
				end: {
					WebkitTransition: 'webkitTransitionEnd',
					MozTransition: 'transitionend',
					OTransition: 'oTransitionEnd',
					transition: 'transitionend'
				}
			},
			animation: {
				end: {
					WebkitAnimation: 'webkitAnimationEnd',
					MozAnimation: 'animationend',
					OAnimation: 'oAnimationEnd',
					animation: 'animationend'
				}
			}
		},
		tests = {
			csstransforms: function() {
				return !!test('transform');
			},
			csstransforms3d: function() {
				return !!test('perspective');
			},
			csstransitions: function() {
				return !!test('transition');
			},
			cssanimations: function() {
				return !!test('animation');
			}
		};

	function test(property, prefixed) {
		var result = false,
			upper = property.charAt(0).toUpperCase() + property.slice(1);

		$.each((property + ' ' + prefixes.join(upper + ' ') + upper).split(' '), function(i, property) {
			if (style[property] !== undefined) {
				result = prefixed ? property : true;
				return false;
			}
		});

		return result;
	}

	function prefixed(property) {
		return test(property, true);
	}

	if (tests.csstransitions()) {
		/* jshint -W053 */
		$.support.transition = new String(prefixed('transition'))
		$.support.transition.end = events.transition.end[ $.support.transition ];
	}

	if (tests.cssanimations()) {
		/* jshint -W053 */
		$.support.animation = new String(prefixed('animation'))
		$.support.animation.end = events.animation.end[ $.support.animation ];
	}

	if (tests.csstransforms()) {
		/* jshint -W053 */
		$.support.transform = new String(prefixed('transform'));
		$.support.transform3d = tests.csstransforms3d();
	}

})(window.Zepto || window.jQuery, window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJvd2wuY2Fyb3VzZWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIE93bCBDYXJvdXNlbCB2Mi4zLjNcclxuICogQ29weXJpZ2h0IDIwMTMtMjAxOCBEYXZpZCBEZXV0c2NoXHJcbiAqIExpY2Vuc2VkIHVuZGVyOiBTRUUgTElDRU5TRSBJTiBodHRwczovL2dpdGh1Yi5jb20vT3dsQ2Fyb3VzZWwyL093bENhcm91c2VsMi9ibG9iL21hc3Rlci9MSUNFTlNFXHJcbiAqL1xyXG4vKipcclxuICogT3dsIGNhcm91c2VsXHJcbiAqIEB2ZXJzaW9uIDIuMy4zXHJcbiAqIEBhdXRob3IgQmFydG9zeiBXb2pjaWVjaG93c2tpXHJcbiAqIEBhdXRob3IgRGF2aWQgRGV1dHNjaFxyXG4gKiBAbGljZW5zZSBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICogQHRvZG8gTGF6eSBMb2FkIEljb25cclxuICogQHRvZG8gcHJldmVudCBhbmltYXRpb25lbmQgYnVibGluZ1xyXG4gKiBAdG9kbyBpdGVtc1NjYWxlVXBcclxuICogQHRvZG8gVGVzdCBaZXB0b1xyXG4gKiBAdG9kbyBzdGFnZVBhZGRpbmcgY2FsY3VsYXRlIHdyb25nIGFjdGl2ZSBjbGFzc2VzXHJcbiAqL1xyXG47KGZ1bmN0aW9uKCQsIHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xyXG5cclxuXHQvKipcclxuXHQgKiBDcmVhdGVzIGEgY2Fyb3VzZWwuXHJcblx0ICogQGNsYXNzIFRoZSBPd2wgQ2Fyb3VzZWwuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8alF1ZXJ5fSBlbGVtZW50IC0gVGhlIGVsZW1lbnQgdG8gY3JlYXRlIHRoZSBjYXJvdXNlbCBmb3IuXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSAtIFRoZSBvcHRpb25zXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gT3dsKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEN1cnJlbnQgc2V0dGluZ3MgZm9yIHRoZSBjYXJvdXNlbC5cclxuXHRcdCAqIEBwdWJsaWNcclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5zZXR0aW5ncyA9IG51bGw7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDdXJyZW50IG9wdGlvbnMgc2V0IGJ5IHRoZSBjYWxsZXIgaW5jbHVkaW5nIGRlZmF1bHRzLlxyXG5cdFx0ICogQHB1YmxpY1xyXG5cdFx0ICovXHJcblx0XHR0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgT3dsLkRlZmF1bHRzLCBvcHRpb25zKTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFBsdWdpbiBlbGVtZW50LlxyXG5cdFx0ICogQHB1YmxpY1xyXG5cdFx0ICovXHJcblx0XHR0aGlzLiRlbGVtZW50ID0gJChlbGVtZW50KTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFByb3hpZWQgZXZlbnQgaGFuZGxlcnMuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2hhbmRsZXJzID0ge307XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZWZlcmVuY2VzIHRvIHRoZSBydW5uaW5nIHBsdWdpbnMgb2YgdGhpcyBjYXJvdXNlbC5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fcGx1Z2lucyA9IHt9O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ3VycmVudGx5IHN1cHByZXNzZWQgZXZlbnRzIHRvIHByZXZlbnQgdGhlbSBmcm9tIGJlaW5nIHJldHJpZ2dlcmVkLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9zdXByZXNzID0ge307XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBYnNvbHV0ZSBjdXJyZW50IHBvc2l0aW9uLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9jdXJyZW50ID0gbnVsbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFuaW1hdGlvbiBzcGVlZCBpbiBtaWxsaXNlY29uZHMuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX3NwZWVkID0gbnVsbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENvb3JkaW5hdGVzIG9mIGFsbCBpdGVtcyBpbiBwaXhlbC5cclxuXHRcdCAqIEB0b2RvIFRoZSBuYW1lIG9mIHRoaXMgbWVtYmVyIGlzIG1pc3NsZWFkaW5nLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9jb29yZGluYXRlcyA9IFtdO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ3VycmVudCBicmVha3BvaW50LlxyXG5cdFx0ICogQHRvZG8gUmVhbCBtZWRpYSBxdWVyaWVzIHdvdWxkIGJlIG5pY2UuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2JyZWFrcG9pbnQgPSBudWxsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ3VycmVudCB3aWR0aCBvZiB0aGUgcGx1Z2luIGVsZW1lbnQuXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX3dpZHRoID0gbnVsbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFsbCByZWFsIGl0ZW1zLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9pdGVtcyA9IFtdO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWxsIGNsb25lZCBpdGVtcy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY2xvbmVzID0gW107XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBNZXJnZSB2YWx1ZXMgb2YgYWxsIGl0ZW1zLlxyXG5cdFx0ICogQHRvZG8gTWF5YmUgdGhpcyBjb3VsZCBiZSBwYXJ0IG9mIGEgcGx1Z2luLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9tZXJnZXJzID0gW107XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBXaWR0aHMgb2YgYWxsIGl0ZW1zLlxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl93aWR0aHMgPSBbXTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEludmFsaWRhdGVkIHBhcnRzIHdpdGhpbiB0aGUgdXBkYXRlIHByb2Nlc3MuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2ludmFsaWRhdGVkID0ge307XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPcmRlcmVkIGxpc3Qgb2Ygd29ya2VycyBmb3IgdGhlIHVwZGF0ZSBwcm9jZXNzLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9waXBlID0gW107XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDdXJyZW50IHN0YXRlIGluZm9ybWF0aW9uIGZvciB0aGUgZHJhZyBvcGVyYXRpb24uXHJcblx0XHQgKiBAdG9kbyAjMjYxXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2RyYWcgPSB7XHJcblx0XHRcdHRpbWU6IG51bGwsXHJcblx0XHRcdHRhcmdldDogbnVsbCxcclxuXHRcdFx0cG9pbnRlcjogbnVsbCxcclxuXHRcdFx0c3RhZ2U6IHtcclxuXHRcdFx0XHRzdGFydDogbnVsbCxcclxuXHRcdFx0XHRjdXJyZW50OiBudWxsXHJcblx0XHRcdH0sXHJcblx0XHRcdGRpcmVjdGlvbjogbnVsbFxyXG5cdFx0fTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEN1cnJlbnQgc3RhdGUgaW5mb3JtYXRpb24gYW5kIHRoZWlyIHRhZ3MuXHJcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9zdGF0ZXMgPSB7XHJcblx0XHRcdGN1cnJlbnQ6IHt9LFxyXG5cdFx0XHR0YWdzOiB7XHJcblx0XHRcdFx0J2luaXRpYWxpemluZyc6IFsgJ2J1c3knIF0sXHJcblx0XHRcdFx0J2FuaW1hdGluZyc6IFsgJ2J1c3knIF0sXHJcblx0XHRcdFx0J2RyYWdnaW5nJzogWyAnaW50ZXJhY3RpbmcnIF1cclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHJcblx0XHQkLmVhY2goWyAnb25SZXNpemUnLCAnb25UaHJvdHRsZWRSZXNpemUnIF0sICQucHJveHkoZnVuY3Rpb24oaSwgaGFuZGxlcikge1xyXG5cdFx0XHR0aGlzLl9oYW5kbGVyc1toYW5kbGVyXSA9ICQucHJveHkodGhpc1toYW5kbGVyXSwgdGhpcyk7XHJcblx0XHR9LCB0aGlzKSk7XHJcblxyXG5cdFx0JC5lYWNoKE93bC5QbHVnaW5zLCAkLnByb3h5KGZ1bmN0aW9uKGtleSwgcGx1Z2luKSB7XHJcblx0XHRcdHRoaXMuX3BsdWdpbnNba2V5LmNoYXJBdCgwKS50b0xvd2VyQ2FzZSgpICsga2V5LnNsaWNlKDEpXVxyXG5cdFx0XHRcdD0gbmV3IHBsdWdpbih0aGlzKTtcclxuXHRcdH0sIHRoaXMpKTtcclxuXHJcblx0XHQkLmVhY2goT3dsLldvcmtlcnMsICQucHJveHkoZnVuY3Rpb24ocHJpb3JpdHksIHdvcmtlcikge1xyXG5cdFx0XHR0aGlzLl9waXBlLnB1c2goe1xyXG5cdFx0XHRcdCdmaWx0ZXInOiB3b3JrZXIuZmlsdGVyLFxyXG5cdFx0XHRcdCdydW4nOiAkLnByb3h5KHdvcmtlci5ydW4sIHRoaXMpXHJcblx0XHRcdH0pO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cclxuXHRcdHRoaXMuc2V0dXAoKTtcclxuXHRcdHRoaXMuaW5pdGlhbGl6ZSgpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogRGVmYXVsdCBvcHRpb25zIGZvciB0aGUgY2Fyb3VzZWwuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdE93bC5EZWZhdWx0cyA9IHtcclxuXHRcdGl0ZW1zOiAzLFxyXG5cdFx0bG9vcDogZmFsc2UsXHJcblx0XHRjZW50ZXI6IGZhbHNlLFxyXG5cdFx0cmV3aW5kOiBmYWxzZSxcclxuXHRcdGNoZWNrVmlzaWJpbGl0eTogdHJ1ZSxcclxuXHJcblx0XHRtb3VzZURyYWc6IHRydWUsXHJcblx0XHR0b3VjaERyYWc6IHRydWUsXHJcblx0XHRwdWxsRHJhZzogdHJ1ZSxcclxuXHRcdGZyZWVEcmFnOiBmYWxzZSxcclxuXHJcblx0XHRtYXJnaW46IDAsXHJcblx0XHRzdGFnZVBhZGRpbmc6IDAsXHJcblxyXG5cdFx0bWVyZ2U6IGZhbHNlLFxyXG5cdFx0bWVyZ2VGaXQ6IHRydWUsXHJcblx0XHRhdXRvV2lkdGg6IGZhbHNlLFxyXG5cclxuXHRcdHN0YXJ0UG9zaXRpb246IDAsXHJcblx0XHRydGw6IGZhbHNlLFxyXG5cclxuXHRcdHNtYXJ0U3BlZWQ6IDI1MCxcclxuXHRcdGZsdWlkU3BlZWQ6IGZhbHNlLFxyXG5cdFx0ZHJhZ0VuZFNwZWVkOiBmYWxzZSxcclxuXHJcblx0XHRyZXNwb25zaXZlOiB7fSxcclxuXHRcdHJlc3BvbnNpdmVSZWZyZXNoUmF0ZTogMjAwLFxyXG5cdFx0cmVzcG9uc2l2ZUJhc2VFbGVtZW50OiB3aW5kb3csXHJcblxyXG5cdFx0ZmFsbGJhY2tFYXNpbmc6ICdzd2luZycsXHJcblxyXG5cdFx0aW5mbzogZmFsc2UsXHJcblxyXG5cdFx0bmVzdGVkSXRlbVNlbGVjdG9yOiBmYWxzZSxcclxuXHRcdGl0ZW1FbGVtZW50OiAnZGl2JyxcclxuXHRcdHN0YWdlRWxlbWVudDogJ2RpdicsXHJcblxyXG5cdFx0cmVmcmVzaENsYXNzOiAnb3dsLXJlZnJlc2gnLFxyXG5cdFx0bG9hZGVkQ2xhc3M6ICdvd2wtbG9hZGVkJyxcclxuXHRcdGxvYWRpbmdDbGFzczogJ293bC1sb2FkaW5nJyxcclxuXHRcdHJ0bENsYXNzOiAnb3dsLXJ0bCcsXHJcblx0XHRyZXNwb25zaXZlQ2xhc3M6ICdvd2wtcmVzcG9uc2l2ZScsXHJcblx0XHRkcmFnQ2xhc3M6ICdvd2wtZHJhZycsXHJcblx0XHRpdGVtQ2xhc3M6ICdvd2wtaXRlbScsXHJcblx0XHRzdGFnZUNsYXNzOiAnb3dsLXN0YWdlJyxcclxuXHRcdHN0YWdlT3V0ZXJDbGFzczogJ293bC1zdGFnZS1vdXRlcicsXHJcblx0XHRncmFiQ2xhc3M6ICdvd2wtZ3JhYidcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBFbnVtZXJhdGlvbiBmb3Igd2lkdGguXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEByZWFkb25seVxyXG5cdCAqIEBlbnVtIHtTdHJpbmd9XHJcblx0ICovXHJcblx0T3dsLldpZHRoID0ge1xyXG5cdFx0RGVmYXVsdDogJ2RlZmF1bHQnLFxyXG5cdFx0SW5uZXI6ICdpbm5lcicsXHJcblx0XHRPdXRlcjogJ291dGVyJ1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVudW1lcmF0aW9uIGZvciB0eXBlcy5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHJlYWRvbmx5XHJcblx0ICogQGVudW0ge1N0cmluZ31cclxuXHQgKi9cclxuXHRPd2wuVHlwZSA9IHtcclxuXHRcdEV2ZW50OiAnZXZlbnQnLFxyXG5cdFx0U3RhdGU6ICdzdGF0ZSdcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDb250YWlucyBhbGwgcmVnaXN0ZXJlZCBwbHVnaW5zLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRPd2wuUGx1Z2lucyA9IHt9O1xyXG5cclxuXHQvKipcclxuXHQgKiBMaXN0IG9mIHdvcmtlcnMgaW52b2x2ZWQgaW4gdGhlIHVwZGF0ZSBwcm9jZXNzLlxyXG5cdCAqL1xyXG5cdE93bC5Xb3JrZXJzID0gWyB7XHJcblx0XHRmaWx0ZXI6IFsgJ3dpZHRoJywgJ3NldHRpbmdzJyBdLFxyXG5cdFx0cnVuOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dGhpcy5fd2lkdGggPSB0aGlzLiRlbGVtZW50LndpZHRoKCk7XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICd3aWR0aCcsICdpdGVtcycsICdzZXR0aW5ncycgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oY2FjaGUpIHtcclxuXHRcdFx0Y2FjaGUuY3VycmVudCA9IHRoaXMuX2l0ZW1zICYmIHRoaXMuX2l0ZW1zW3RoaXMucmVsYXRpdmUodGhpcy5fY3VycmVudCldO1xyXG5cdFx0fVxyXG5cdH0sIHtcclxuXHRcdGZpbHRlcjogWyAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXHJcblx0XHRydW46IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR0aGlzLiRzdGFnZS5jaGlsZHJlbignLmNsb25lZCcpLnJlbW92ZSgpO1xyXG5cdFx0fVxyXG5cdH0sIHtcclxuXHRcdGZpbHRlcjogWyAnd2lkdGgnLCAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXHJcblx0XHRydW46IGZ1bmN0aW9uKGNhY2hlKSB7XHJcblx0XHRcdHZhciBtYXJnaW4gPSB0aGlzLnNldHRpbmdzLm1hcmdpbiB8fCAnJyxcclxuXHRcdFx0XHRncmlkID0gIXRoaXMuc2V0dGluZ3MuYXV0b1dpZHRoLFxyXG5cdFx0XHRcdHJ0bCA9IHRoaXMuc2V0dGluZ3MucnRsLFxyXG5cdFx0XHRcdGNzcyA9IHtcclxuXHRcdFx0XHRcdCd3aWR0aCc6ICdhdXRvJyxcclxuXHRcdFx0XHRcdCdtYXJnaW4tbGVmdCc6IHJ0bCA/IG1hcmdpbiA6ICcnLFxyXG5cdFx0XHRcdFx0J21hcmdpbi1yaWdodCc6IHJ0bCA/ICcnIDogbWFyZ2luXHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdCFncmlkICYmIHRoaXMuJHN0YWdlLmNoaWxkcmVuKCkuY3NzKGNzcyk7XHJcblxyXG5cdFx0XHRjYWNoZS5jc3MgPSBjc3M7XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICd3aWR0aCcsICdpdGVtcycsICdzZXR0aW5ncycgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oY2FjaGUpIHtcclxuXHRcdFx0dmFyIHdpZHRoID0gKHRoaXMud2lkdGgoKSAvIHRoaXMuc2V0dGluZ3MuaXRlbXMpLnRvRml4ZWQoMykgLSB0aGlzLnNldHRpbmdzLm1hcmdpbixcclxuXHRcdFx0XHRtZXJnZSA9IG51bGwsXHJcblx0XHRcdFx0aXRlcmF0b3IgPSB0aGlzLl9pdGVtcy5sZW5ndGgsXHJcblx0XHRcdFx0Z3JpZCA9ICF0aGlzLnNldHRpbmdzLmF1dG9XaWR0aCxcclxuXHRcdFx0XHR3aWR0aHMgPSBbXTtcclxuXHJcblx0XHRcdGNhY2hlLml0ZW1zID0ge1xyXG5cdFx0XHRcdG1lcmdlOiBmYWxzZSxcclxuXHRcdFx0XHR3aWR0aDogd2lkdGhcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdHdoaWxlIChpdGVyYXRvci0tKSB7XHJcblx0XHRcdFx0bWVyZ2UgPSB0aGlzLl9tZXJnZXJzW2l0ZXJhdG9yXTtcclxuXHRcdFx0XHRtZXJnZSA9IHRoaXMuc2V0dGluZ3MubWVyZ2VGaXQgJiYgTWF0aC5taW4obWVyZ2UsIHRoaXMuc2V0dGluZ3MuaXRlbXMpIHx8IG1lcmdlO1xyXG5cclxuXHRcdFx0XHRjYWNoZS5pdGVtcy5tZXJnZSA9IG1lcmdlID4gMSB8fCBjYWNoZS5pdGVtcy5tZXJnZTtcclxuXHJcblx0XHRcdFx0d2lkdGhzW2l0ZXJhdG9yXSA9ICFncmlkID8gdGhpcy5faXRlbXNbaXRlcmF0b3JdLndpZHRoKCkgOiB3aWR0aCAqIG1lcmdlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLl93aWR0aHMgPSB3aWR0aHM7XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICdpdGVtcycsICdzZXR0aW5ncycgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciBjbG9uZXMgPSBbXSxcclxuXHRcdFx0XHRpdGVtcyA9IHRoaXMuX2l0ZW1zLFxyXG5cdFx0XHRcdHNldHRpbmdzID0gdGhpcy5zZXR0aW5ncyxcclxuXHRcdFx0XHQvLyBUT0RPOiBTaG91bGQgYmUgY29tcHV0ZWQgZnJvbSBudW1iZXIgb2YgbWluIHdpZHRoIGl0ZW1zIGluIHN0YWdlXHJcblx0XHRcdFx0dmlldyA9IE1hdGgubWF4KHNldHRpbmdzLml0ZW1zICogMiwgNCksXHJcblx0XHRcdFx0c2l6ZSA9IE1hdGguY2VpbChpdGVtcy5sZW5ndGggLyAyKSAqIDIsXHJcblx0XHRcdFx0cmVwZWF0ID0gc2V0dGluZ3MubG9vcCAmJiBpdGVtcy5sZW5ndGggPyBzZXR0aW5ncy5yZXdpbmQgPyB2aWV3IDogTWF0aC5tYXgodmlldywgc2l6ZSkgOiAwLFxyXG5cdFx0XHRcdGFwcGVuZCA9ICcnLFxyXG5cdFx0XHRcdHByZXBlbmQgPSAnJztcclxuXHJcblx0XHRcdHJlcGVhdCAvPSAyO1xyXG5cclxuXHRcdFx0d2hpbGUgKHJlcGVhdCA+IDApIHtcclxuXHRcdFx0XHQvLyBTd2l0Y2ggdG8gb25seSB1c2luZyBhcHBlbmRlZCBjbG9uZXNcclxuXHRcdFx0XHRjbG9uZXMucHVzaCh0aGlzLm5vcm1hbGl6ZShjbG9uZXMubGVuZ3RoIC8gMiwgdHJ1ZSkpO1xyXG5cdFx0XHRcdGFwcGVuZCA9IGFwcGVuZCArIGl0ZW1zW2Nsb25lc1tjbG9uZXMubGVuZ3RoIC0gMV1dWzBdLm91dGVySFRNTDtcclxuXHRcdFx0XHRjbG9uZXMucHVzaCh0aGlzLm5vcm1hbGl6ZShpdGVtcy5sZW5ndGggLSAxIC0gKGNsb25lcy5sZW5ndGggLSAxKSAvIDIsIHRydWUpKTtcclxuXHRcdFx0XHRwcmVwZW5kID0gaXRlbXNbY2xvbmVzW2Nsb25lcy5sZW5ndGggLSAxXV1bMF0ub3V0ZXJIVE1MICsgcHJlcGVuZDtcclxuXHRcdFx0XHRyZXBlYXQgLT0gMTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5fY2xvbmVzID0gY2xvbmVzO1xyXG5cclxuXHRcdFx0JChhcHBlbmQpLmFkZENsYXNzKCdjbG9uZWQnKS5hcHBlbmRUbyh0aGlzLiRzdGFnZSk7XHJcblx0XHRcdCQocHJlcGVuZCkuYWRkQ2xhc3MoJ2Nsb25lZCcpLnByZXBlbmRUbyh0aGlzLiRzdGFnZSk7XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICd3aWR0aCcsICdpdGVtcycsICdzZXR0aW5ncycgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciBydGwgPSB0aGlzLnNldHRpbmdzLnJ0bCA/IDEgOiAtMSxcclxuXHRcdFx0XHRzaXplID0gdGhpcy5fY2xvbmVzLmxlbmd0aCArIHRoaXMuX2l0ZW1zLmxlbmd0aCxcclxuXHRcdFx0XHRpdGVyYXRvciA9IC0xLFxyXG5cdFx0XHRcdHByZXZpb3VzID0gMCxcclxuXHRcdFx0XHRjdXJyZW50ID0gMCxcclxuXHRcdFx0XHRjb29yZGluYXRlcyA9IFtdO1xyXG5cclxuXHRcdFx0d2hpbGUgKCsraXRlcmF0b3IgPCBzaXplKSB7XHJcblx0XHRcdFx0cHJldmlvdXMgPSBjb29yZGluYXRlc1tpdGVyYXRvciAtIDFdIHx8IDA7XHJcblx0XHRcdFx0Y3VycmVudCA9IHRoaXMuX3dpZHRoc1t0aGlzLnJlbGF0aXZlKGl0ZXJhdG9yKV0gKyB0aGlzLnNldHRpbmdzLm1hcmdpbjtcclxuXHRcdFx0XHRjb29yZGluYXRlcy5wdXNoKHByZXZpb3VzICsgY3VycmVudCAqIHJ0bCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX2Nvb3JkaW5hdGVzID0gY29vcmRpbmF0ZXM7XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICd3aWR0aCcsICdpdGVtcycsICdzZXR0aW5ncycgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciBwYWRkaW5nID0gdGhpcy5zZXR0aW5ncy5zdGFnZVBhZGRpbmcsXHJcblx0XHRcdFx0Y29vcmRpbmF0ZXMgPSB0aGlzLl9jb29yZGluYXRlcyxcclxuXHRcdFx0XHRjc3MgPSB7XHJcblx0XHRcdFx0XHQnd2lkdGgnOiBNYXRoLmNlaWwoTWF0aC5hYnMoY29vcmRpbmF0ZXNbY29vcmRpbmF0ZXMubGVuZ3RoIC0gMV0pKSArIHBhZGRpbmcgKiAyLFxyXG5cdFx0XHRcdFx0J3BhZGRpbmctbGVmdCc6IHBhZGRpbmcgfHwgJycsXHJcblx0XHRcdFx0XHQncGFkZGluZy1yaWdodCc6IHBhZGRpbmcgfHwgJydcclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0dGhpcy4kc3RhZ2UuY3NzKGNzcyk7XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICd3aWR0aCcsICdpdGVtcycsICdzZXR0aW5ncycgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oY2FjaGUpIHtcclxuXHRcdFx0dmFyIGl0ZXJhdG9yID0gdGhpcy5fY29vcmRpbmF0ZXMubGVuZ3RoLFxyXG5cdFx0XHRcdGdyaWQgPSAhdGhpcy5zZXR0aW5ncy5hdXRvV2lkdGgsXHJcblx0XHRcdFx0aXRlbXMgPSB0aGlzLiRzdGFnZS5jaGlsZHJlbigpO1xyXG5cclxuXHRcdFx0aWYgKGdyaWQgJiYgY2FjaGUuaXRlbXMubWVyZ2UpIHtcclxuXHRcdFx0XHR3aGlsZSAoaXRlcmF0b3ItLSkge1xyXG5cdFx0XHRcdFx0Y2FjaGUuY3NzLndpZHRoID0gdGhpcy5fd2lkdGhzW3RoaXMucmVsYXRpdmUoaXRlcmF0b3IpXTtcclxuXHRcdFx0XHRcdGl0ZW1zLmVxKGl0ZXJhdG9yKS5jc3MoY2FjaGUuY3NzKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSBpZiAoZ3JpZCkge1xyXG5cdFx0XHRcdGNhY2hlLmNzcy53aWR0aCA9IGNhY2hlLml0ZW1zLndpZHRoO1xyXG5cdFx0XHRcdGl0ZW1zLmNzcyhjYWNoZS5jc3MpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICdpdGVtcycgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHRoaXMuX2Nvb3JkaW5hdGVzLmxlbmd0aCA8IDEgJiYgdGhpcy4kc3RhZ2UucmVtb3ZlQXR0cignc3R5bGUnKTtcclxuXHRcdH1cclxuXHR9LCB7XHJcblx0XHRmaWx0ZXI6IFsgJ3dpZHRoJywgJ2l0ZW1zJywgJ3NldHRpbmdzJyBdLFxyXG5cdFx0cnVuOiBmdW5jdGlvbihjYWNoZSkge1xyXG5cdFx0XHRjYWNoZS5jdXJyZW50ID0gY2FjaGUuY3VycmVudCA/IHRoaXMuJHN0YWdlLmNoaWxkcmVuKCkuaW5kZXgoY2FjaGUuY3VycmVudCkgOiAwO1xyXG5cdFx0XHRjYWNoZS5jdXJyZW50ID0gTWF0aC5tYXgodGhpcy5taW5pbXVtKCksIE1hdGgubWluKHRoaXMubWF4aW11bSgpLCBjYWNoZS5jdXJyZW50KSk7XHJcblx0XHRcdHRoaXMucmVzZXQoY2FjaGUuY3VycmVudCk7XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICdwb3NpdGlvbicgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHRoaXMuYW5pbWF0ZSh0aGlzLmNvb3JkaW5hdGVzKHRoaXMuX2N1cnJlbnQpKTtcclxuXHRcdH1cclxuXHR9LCB7XHJcblx0XHRmaWx0ZXI6IFsgJ3dpZHRoJywgJ3Bvc2l0aW9uJywgJ2l0ZW1zJywgJ3NldHRpbmdzJyBdLFxyXG5cdFx0cnVuOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIHJ0bCA9IHRoaXMuc2V0dGluZ3MucnRsID8gMSA6IC0xLFxyXG5cdFx0XHRcdHBhZGRpbmcgPSB0aGlzLnNldHRpbmdzLnN0YWdlUGFkZGluZyAqIDIsXHJcblx0XHRcdFx0YmVnaW4gPSB0aGlzLmNvb3JkaW5hdGVzKHRoaXMuY3VycmVudCgpKSArIHBhZGRpbmcsXHJcblx0XHRcdFx0ZW5kID0gYmVnaW4gKyB0aGlzLndpZHRoKCkgKiBydGwsXHJcblx0XHRcdFx0aW5uZXIsIG91dGVyLCBtYXRjaGVzID0gW10sIGksIG47XHJcblxyXG5cdFx0XHRmb3IgKGkgPSAwLCBuID0gdGhpcy5fY29vcmRpbmF0ZXMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcblx0XHRcdFx0aW5uZXIgPSB0aGlzLl9jb29yZGluYXRlc1tpIC0gMV0gfHwgMDtcclxuXHRcdFx0XHRvdXRlciA9IE1hdGguYWJzKHRoaXMuX2Nvb3JkaW5hdGVzW2ldKSArIHBhZGRpbmcgKiBydGw7XHJcblxyXG5cdFx0XHRcdGlmICgodGhpcy5vcChpbm5lciwgJzw9JywgYmVnaW4pICYmICh0aGlzLm9wKGlubmVyLCAnPicsIGVuZCkpKVxyXG5cdFx0XHRcdFx0fHwgKHRoaXMub3Aob3V0ZXIsICc8JywgYmVnaW4pICYmIHRoaXMub3Aob3V0ZXIsICc+JywgZW5kKSkpIHtcclxuXHRcdFx0XHRcdG1hdGNoZXMucHVzaChpKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuJHN0YWdlLmNoaWxkcmVuKCcuYWN0aXZlJykucmVtb3ZlQ2xhc3MoJ2FjdGl2ZScpO1xyXG5cdFx0XHR0aGlzLiRzdGFnZS5jaGlsZHJlbignOmVxKCcgKyBtYXRjaGVzLmpvaW4oJyksIDplcSgnKSArICcpJykuYWRkQ2xhc3MoJ2FjdGl2ZScpO1xyXG5cclxuXHRcdFx0dGhpcy4kc3RhZ2UuY2hpbGRyZW4oJy5jZW50ZXInKS5yZW1vdmVDbGFzcygnY2VudGVyJyk7XHJcblx0XHRcdGlmICh0aGlzLnNldHRpbmdzLmNlbnRlcikge1xyXG5cdFx0XHRcdHRoaXMuJHN0YWdlLmNoaWxkcmVuKCkuZXEodGhpcy5jdXJyZW50KCkpLmFkZENsYXNzKCdjZW50ZXInKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0gXTtcclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlIHRoZSBzdGFnZSBET00gZWxlbWVudFxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuaW5pdGlhbGl6ZVN0YWdlID0gZnVuY3Rpb24oKSB7XHJcblx0XHR0aGlzLiRzdGFnZSA9IHRoaXMuJGVsZW1lbnQuZmluZCgnLicgKyB0aGlzLnNldHRpbmdzLnN0YWdlQ2xhc3MpO1xyXG5cclxuXHRcdC8vIGlmIHRoZSBzdGFnZSBpcyBhbHJlYWR5IGluIHRoZSBET00sIGdyYWIgaXQgYW5kIHNraXAgc3RhZ2UgaW5pdGlhbGl6YXRpb25cclxuXHRcdGlmICh0aGlzLiRzdGFnZS5sZW5ndGgpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuJGVsZW1lbnQuYWRkQ2xhc3ModGhpcy5vcHRpb25zLmxvYWRpbmdDbGFzcyk7XHJcblxyXG5cdFx0Ly8gY3JlYXRlIHN0YWdlXHJcblx0XHR0aGlzLiRzdGFnZSA9ICQoJzwnICsgdGhpcy5zZXR0aW5ncy5zdGFnZUVsZW1lbnQgKyAnIGNsYXNzPVwiJyArIHRoaXMuc2V0dGluZ3Muc3RhZ2VDbGFzcyArICdcIi8+JylcclxuXHRcdFx0LndyYXAoJzxkaXYgY2xhc3M9XCInICsgdGhpcy5zZXR0aW5ncy5zdGFnZU91dGVyQ2xhc3MgKyAnXCIvPicpO1xyXG5cclxuXHRcdC8vIGFwcGVuZCBzdGFnZVxyXG5cdFx0dGhpcy4kZWxlbWVudC5hcHBlbmQodGhpcy4kc3RhZ2UucGFyZW50KCkpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZSBpdGVtIERPTSBlbGVtZW50c1xyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuaW5pdGlhbGl6ZUl0ZW1zID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgJGl0ZW1zID0gdGhpcy4kZWxlbWVudC5maW5kKCcub3dsLWl0ZW0nKTtcclxuXHJcblx0XHQvLyBpZiB0aGUgaXRlbXMgYXJlIGFscmVhZHkgaW4gdGhlIERPTSwgZ3JhYiB0aGVtIGFuZCBza2lwIGl0ZW0gaW5pdGlhbGl6YXRpb25cclxuXHRcdGlmICgkaXRlbXMubGVuZ3RoKSB7XHJcblx0XHRcdHRoaXMuX2l0ZW1zID0gJGl0ZW1zLmdldCgpLm1hcChmdW5jdGlvbihpdGVtKSB7XHJcblx0XHRcdFx0cmV0dXJuICQoaXRlbSk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0dGhpcy5fbWVyZ2VycyA9IHRoaXMuX2l0ZW1zLm1hcChmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRyZXR1cm4gMTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHR0aGlzLnJlZnJlc2goKTtcclxuXHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBhcHBlbmQgY29udGVudFxyXG5cdFx0dGhpcy5yZXBsYWNlKHRoaXMuJGVsZW1lbnQuY2hpbGRyZW4oKS5ub3QodGhpcy4kc3RhZ2UucGFyZW50KCkpKTtcclxuXHJcblx0XHQvLyBjaGVjayB2aXNpYmlsaXR5XHJcblx0XHRpZiAodGhpcy5pc1Zpc2libGUoKSkge1xyXG5cdFx0XHQvLyB1cGRhdGUgdmlld1xyXG5cdFx0XHR0aGlzLnJlZnJlc2goKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdC8vIGludmFsaWRhdGUgd2lkdGhcclxuXHRcdFx0dGhpcy5pbnZhbGlkYXRlKCd3aWR0aCcpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuJGVsZW1lbnRcclxuXHRcdFx0LnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5sb2FkaW5nQ2xhc3MpXHJcblx0XHRcdC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMubG9hZGVkQ2xhc3MpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEluaXRpYWxpemVzIHRoZSBjYXJvdXNlbC5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24oKSB7XHJcblx0XHR0aGlzLmVudGVyKCdpbml0aWFsaXppbmcnKTtcclxuXHRcdHRoaXMudHJpZ2dlcignaW5pdGlhbGl6ZScpO1xyXG5cclxuXHRcdHRoaXMuJGVsZW1lbnQudG9nZ2xlQ2xhc3ModGhpcy5zZXR0aW5ncy5ydGxDbGFzcywgdGhpcy5zZXR0aW5ncy5ydGwpO1xyXG5cclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLmF1dG9XaWR0aCAmJiAhdGhpcy5pcygncHJlLWxvYWRpbmcnKSkge1xyXG5cdFx0XHR2YXIgaW1ncywgbmVzdGVkU2VsZWN0b3IsIHdpZHRoO1xyXG5cdFx0XHRpbWdzID0gdGhpcy4kZWxlbWVudC5maW5kKCdpbWcnKTtcclxuXHRcdFx0bmVzdGVkU2VsZWN0b3IgPSB0aGlzLnNldHRpbmdzLm5lc3RlZEl0ZW1TZWxlY3RvciA/ICcuJyArIHRoaXMuc2V0dGluZ3MubmVzdGVkSXRlbVNlbGVjdG9yIDogdW5kZWZpbmVkO1xyXG5cdFx0XHR3aWR0aCA9IHRoaXMuJGVsZW1lbnQuY2hpbGRyZW4obmVzdGVkU2VsZWN0b3IpLndpZHRoKCk7XHJcblxyXG5cdFx0XHRpZiAoaW1ncy5sZW5ndGggJiYgd2lkdGggPD0gMCkge1xyXG5cdFx0XHRcdHRoaXMucHJlbG9hZEF1dG9XaWR0aEltYWdlcyhpbWdzKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuaW5pdGlhbGl6ZVN0YWdlKCk7XHJcblx0XHR0aGlzLmluaXRpYWxpemVJdGVtcygpO1xyXG5cclxuXHRcdC8vIHJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzXHJcblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnRIYW5kbGVycygpO1xyXG5cclxuXHRcdHRoaXMubGVhdmUoJ2luaXRpYWxpemluZycpO1xyXG5cdFx0dGhpcy50cmlnZ2VyKCdpbml0aWFsaXplZCcpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEByZXR1cm5zIHtCb29sZWFufSB2aXNpYmlsaXR5IG9mICRlbGVtZW50XHJcblx0ICogICAgICAgICAgICAgICAgICAgIGlmIHlvdSBrbm93IHRoZSBjYXJvdXNlbCB3aWxsIGFsd2F5cyBiZSB2aXNpYmxlIHlvdSBjYW4gc2V0IGBjaGVja1Zpc2liaWxpdHlgIHRvIGBmYWxzZWAgdG9cclxuXHQgKiAgICAgICAgICAgICAgICAgICAgcHJldmVudCB0aGUgZXhwZW5zaXZlIGJyb3dzZXIgbGF5b3V0IGZvcmNlZCByZWZsb3cgdGhlICRlbGVtZW50LmlzKCc6dmlzaWJsZScpIGRvZXNcclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmlzVmlzaWJsZSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuc2V0dGluZ3MuY2hlY2tWaXNpYmlsaXR5XHJcblx0XHRcdD8gdGhpcy4kZWxlbWVudC5pcygnOnZpc2libGUnKVxyXG5cdFx0XHQ6IHRydWU7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0dXBzIHRoZSBjdXJyZW50IHNldHRpbmdzLlxyXG5cdCAqIEB0b2RvIFJlbW92ZSByZXNwb25zaXZlIGNsYXNzZXMuIFdoeSBzaG91bGQgYWRhcHRpdmUgZGVzaWducyBiZSBicm91Z2h0IGludG8gSUU4P1xyXG5cdCAqIEB0b2RvIFN1cHBvcnQgZm9yIG1lZGlhIHF1ZXJpZXMgYnkgdXNpbmcgYG1hdGNoTWVkaWFgIHdvdWxkIGJlIG5pY2UuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuc2V0dXAgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciB2aWV3cG9ydCA9IHRoaXMudmlld3BvcnQoKSxcclxuXHRcdFx0b3ZlcndyaXRlcyA9IHRoaXMub3B0aW9ucy5yZXNwb25zaXZlLFxyXG5cdFx0XHRtYXRjaCA9IC0xLFxyXG5cdFx0XHRzZXR0aW5ncyA9IG51bGw7XHJcblxyXG5cdFx0aWYgKCFvdmVyd3JpdGVzKSB7XHJcblx0XHRcdHNldHRpbmdzID0gJC5leHRlbmQoe30sIHRoaXMub3B0aW9ucyk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQkLmVhY2gob3ZlcndyaXRlcywgZnVuY3Rpb24oYnJlYWtwb2ludCkge1xyXG5cdFx0XHRcdGlmIChicmVha3BvaW50IDw9IHZpZXdwb3J0ICYmIGJyZWFrcG9pbnQgPiBtYXRjaCkge1xyXG5cdFx0XHRcdFx0bWF0Y2ggPSBOdW1iZXIoYnJlYWtwb2ludCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdHNldHRpbmdzID0gJC5leHRlbmQoe30sIHRoaXMub3B0aW9ucywgb3ZlcndyaXRlc1ttYXRjaF0pO1xyXG5cdFx0XHRpZiAodHlwZW9mIHNldHRpbmdzLnN0YWdlUGFkZGluZyA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRcdHNldHRpbmdzLnN0YWdlUGFkZGluZyA9IHNldHRpbmdzLnN0YWdlUGFkZGluZygpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGRlbGV0ZSBzZXR0aW5ncy5yZXNwb25zaXZlO1xyXG5cclxuXHRcdFx0Ly8gcmVzcG9uc2l2ZSBjbGFzc1xyXG5cdFx0XHRpZiAoc2V0dGluZ3MucmVzcG9uc2l2ZUNsYXNzKSB7XHJcblx0XHRcdFx0dGhpcy4kZWxlbWVudC5hdHRyKCdjbGFzcycsXHJcblx0XHRcdFx0XHR0aGlzLiRlbGVtZW50LmF0dHIoJ2NsYXNzJykucmVwbGFjZShuZXcgUmVnRXhwKCcoJyArIHRoaXMub3B0aW9ucy5yZXNwb25zaXZlQ2xhc3MgKyAnLSlcXFxcUytcXFxccycsICdnJyksICckMScgKyBtYXRjaClcclxuXHRcdFx0XHQpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy50cmlnZ2VyKCdjaGFuZ2UnLCB7IHByb3BlcnR5OiB7IG5hbWU6ICdzZXR0aW5ncycsIHZhbHVlOiBzZXR0aW5ncyB9IH0pO1xyXG5cdFx0dGhpcy5fYnJlYWtwb2ludCA9IG1hdGNoO1xyXG5cdFx0dGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xyXG5cdFx0dGhpcy5pbnZhbGlkYXRlKCdzZXR0aW5ncycpO1xyXG5cdFx0dGhpcy50cmlnZ2VyKCdjaGFuZ2VkJywgeyBwcm9wZXJ0eTogeyBuYW1lOiAnc2V0dGluZ3MnLCB2YWx1ZTogdGhpcy5zZXR0aW5ncyB9IH0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFVwZGF0ZXMgb3B0aW9uIGxvZ2ljIGlmIG5lY2Vzc2VyeS5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5vcHRpb25zTG9naWMgPSBmdW5jdGlvbigpIHtcclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLmF1dG9XaWR0aCkge1xyXG5cdFx0XHR0aGlzLnNldHRpbmdzLnN0YWdlUGFkZGluZyA9IGZhbHNlO1xyXG5cdFx0XHR0aGlzLnNldHRpbmdzLm1lcmdlID0gZmFsc2U7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUHJlcGFyZXMgYW4gaXRlbSBiZWZvcmUgYWRkLlxyXG5cdCAqIEB0b2RvIFJlbmFtZSBldmVudCBwYXJhbWV0ZXIgYGNvbnRlbnRgIHRvIGBpdGVtYC5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHJldHVybnMge2pRdWVyeXxIVE1MRWxlbWVudH0gLSBUaGUgaXRlbSBjb250YWluZXIuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5wcmVwYXJlID0gZnVuY3Rpb24oaXRlbSkge1xyXG5cdFx0dmFyIGV2ZW50ID0gdGhpcy50cmlnZ2VyKCdwcmVwYXJlJywgeyBjb250ZW50OiBpdGVtIH0pO1xyXG5cclxuXHRcdGlmICghZXZlbnQuZGF0YSkge1xyXG5cdFx0XHRldmVudC5kYXRhID0gJCgnPCcgKyB0aGlzLnNldHRpbmdzLml0ZW1FbGVtZW50ICsgJy8+JylcclxuXHRcdFx0XHQuYWRkQ2xhc3ModGhpcy5vcHRpb25zLml0ZW1DbGFzcykuYXBwZW5kKGl0ZW0pXHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy50cmlnZ2VyKCdwcmVwYXJlZCcsIHsgY29udGVudDogZXZlbnQuZGF0YSB9KTtcclxuXHJcblx0XHRyZXR1cm4gZXZlbnQuZGF0YTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBVcGRhdGVzIHRoZSB2aWV3LlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGkgPSAwLFxyXG5cdFx0XHRuID0gdGhpcy5fcGlwZS5sZW5ndGgsXHJcblx0XHRcdGZpbHRlciA9ICQucHJveHkoZnVuY3Rpb24ocCkgeyByZXR1cm4gdGhpc1twXSB9LCB0aGlzLl9pbnZhbGlkYXRlZCksXHJcblx0XHRcdGNhY2hlID0ge307XHJcblxyXG5cdFx0d2hpbGUgKGkgPCBuKSB7XHJcblx0XHRcdGlmICh0aGlzLl9pbnZhbGlkYXRlZC5hbGwgfHwgJC5ncmVwKHRoaXMuX3BpcGVbaV0uZmlsdGVyLCBmaWx0ZXIpLmxlbmd0aCA+IDApIHtcclxuXHRcdFx0XHR0aGlzLl9waXBlW2ldLnJ1bihjYWNoZSk7XHJcblx0XHRcdH1cclxuXHRcdFx0aSsrO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2ludmFsaWRhdGVkID0ge307XHJcblxyXG5cdFx0IXRoaXMuaXMoJ3ZhbGlkJykgJiYgdGhpcy5lbnRlcigndmFsaWQnKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXRzIHRoZSB3aWR0aCBvZiB0aGUgdmlldy5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtPd2wuV2lkdGh9IFtkaW1lbnNpb249T3dsLldpZHRoLkRlZmF1bHRdIC0gVGhlIGRpbWVuc2lvbiB0byByZXR1cm4uXHJcblx0ICogQHJldHVybnMge051bWJlcn0gLSBUaGUgd2lkdGggb2YgdGhlIHZpZXcgaW4gcGl4ZWwuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS53aWR0aCA9IGZ1bmN0aW9uKGRpbWVuc2lvbikge1xyXG5cdFx0ZGltZW5zaW9uID0gZGltZW5zaW9uIHx8IE93bC5XaWR0aC5EZWZhdWx0O1xyXG5cdFx0c3dpdGNoIChkaW1lbnNpb24pIHtcclxuXHRcdFx0Y2FzZSBPd2wuV2lkdGguSW5uZXI6XHJcblx0XHRcdGNhc2UgT3dsLldpZHRoLk91dGVyOlxyXG5cdFx0XHRcdHJldHVybiB0aGlzLl93aWR0aDtcclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHRyZXR1cm4gdGhpcy5fd2lkdGggLSB0aGlzLnNldHRpbmdzLnN0YWdlUGFkZGluZyAqIDIgKyB0aGlzLnNldHRpbmdzLm1hcmdpbjtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBSZWZyZXNoZXMgdGhlIGNhcm91c2VsIHByaW1hcmlseSBmb3IgYWRhcHRpdmUgcHVycG9zZXMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUucmVmcmVzaCA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dGhpcy5lbnRlcigncmVmcmVzaGluZycpO1xyXG5cdFx0dGhpcy50cmlnZ2VyKCdyZWZyZXNoJyk7XHJcblxyXG5cdFx0dGhpcy5zZXR1cCgpO1xyXG5cclxuXHRcdHRoaXMub3B0aW9uc0xvZ2ljKCk7XHJcblxyXG5cdFx0dGhpcy4kZWxlbWVudC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMucmVmcmVzaENsYXNzKTtcclxuXHJcblx0XHR0aGlzLnVwZGF0ZSgpO1xyXG5cclxuXHRcdHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLnJlZnJlc2hDbGFzcyk7XHJcblxyXG5cdFx0dGhpcy5sZWF2ZSgncmVmcmVzaGluZycpO1xyXG5cdFx0dGhpcy50cmlnZ2VyKCdyZWZyZXNoZWQnKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDaGVja3Mgd2luZG93IGByZXNpemVgIGV2ZW50LlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLm9uVGhyb3R0bGVkUmVzaXplID0gZnVuY3Rpb24oKSB7XHJcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMucmVzaXplVGltZXIpO1xyXG5cdFx0dGhpcy5yZXNpemVUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMuX2hhbmRsZXJzLm9uUmVzaXplLCB0aGlzLnNldHRpbmdzLnJlc3BvbnNpdmVSZWZyZXNoUmF0ZSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQ2hlY2tzIHdpbmRvdyBgcmVzaXplYCBldmVudC5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5vblJlc2l6ZSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0aWYgKCF0aGlzLl9pdGVtcy5sZW5ndGgpIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh0aGlzLl93aWR0aCA9PT0gdGhpcy4kZWxlbWVudC53aWR0aCgpKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIXRoaXMuaXNWaXNpYmxlKCkpIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuZW50ZXIoJ3Jlc2l6aW5nJyk7XHJcblxyXG5cdFx0aWYgKHRoaXMudHJpZ2dlcigncmVzaXplJykuaXNEZWZhdWx0UHJldmVudGVkKCkpIHtcclxuXHRcdFx0dGhpcy5sZWF2ZSgncmVzaXppbmcnKTtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuaW52YWxpZGF0ZSgnd2lkdGgnKTtcclxuXHJcblx0XHR0aGlzLnJlZnJlc2goKTtcclxuXHJcblx0XHR0aGlzLmxlYXZlKCdyZXNpemluZycpO1xyXG5cdFx0dGhpcy50cmlnZ2VyKCdyZXNpemVkJyk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUmVnaXN0ZXJzIGV2ZW50IGhhbmRsZXJzLlxyXG5cdCAqIEB0b2RvIENoZWNrIGBtc1BvaW50ZXJFbmFibGVkYFxyXG5cdCAqIEB0b2RvICMyNjFcclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50SGFuZGxlcnMgPSBmdW5jdGlvbigpIHtcclxuXHRcdGlmICgkLnN1cHBvcnQudHJhbnNpdGlvbikge1xyXG5cdFx0XHR0aGlzLiRzdGFnZS5vbigkLnN1cHBvcnQudHJhbnNpdGlvbi5lbmQgKyAnLm93bC5jb3JlJywgJC5wcm94eSh0aGlzLm9uVHJhbnNpdGlvbkVuZCwgdGhpcykpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLnJlc3BvbnNpdmUgIT09IGZhbHNlKSB7XHJcblx0XHRcdHRoaXMub24od2luZG93LCAncmVzaXplJywgdGhpcy5faGFuZGxlcnMub25UaHJvdHRsZWRSZXNpemUpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLm1vdXNlRHJhZykge1xyXG5cdFx0XHR0aGlzLiRlbGVtZW50LmFkZENsYXNzKHRoaXMub3B0aW9ucy5kcmFnQ2xhc3MpO1xyXG5cdFx0XHR0aGlzLiRzdGFnZS5vbignbW91c2Vkb3duLm93bC5jb3JlJywgJC5wcm94eSh0aGlzLm9uRHJhZ1N0YXJ0LCB0aGlzKSk7XHJcblx0XHRcdHRoaXMuJHN0YWdlLm9uKCdkcmFnc3RhcnQub3dsLmNvcmUgc2VsZWN0c3RhcnQub3dsLmNvcmUnLCBmdW5jdGlvbigpIHsgcmV0dXJuIGZhbHNlIH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLnRvdWNoRHJhZyl7XHJcblx0XHRcdHRoaXMuJHN0YWdlLm9uKCd0b3VjaHN0YXJ0Lm93bC5jb3JlJywgJC5wcm94eSh0aGlzLm9uRHJhZ1N0YXJ0LCB0aGlzKSk7XHJcblx0XHRcdHRoaXMuJHN0YWdlLm9uKCd0b3VjaGNhbmNlbC5vd2wuY29yZScsICQucHJveHkodGhpcy5vbkRyYWdFbmQsIHRoaXMpKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBIYW5kbGVzIGB0b3VjaHN0YXJ0YCBhbmQgYG1vdXNlZG93bmAgZXZlbnRzLlxyXG5cdCAqIEB0b2RvIEhvcml6b250YWwgc3dpcGUgdGhyZXNob2xkIGFzIG9wdGlvblxyXG5cdCAqIEB0b2RvICMyNjFcclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQgYXJndW1lbnRzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUub25EcmFnU3RhcnQgPSBmdW5jdGlvbihldmVudCkge1xyXG5cdFx0dmFyIHN0YWdlID0gbnVsbDtcclxuXHJcblx0XHRpZiAoZXZlbnQud2hpY2ggPT09IDMpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICgkLnN1cHBvcnQudHJhbnNmb3JtKSB7XHJcblx0XHRcdHN0YWdlID0gdGhpcy4kc3RhZ2UuY3NzKCd0cmFuc2Zvcm0nKS5yZXBsYWNlKC8uKlxcKHxcXCl8IC9nLCAnJykuc3BsaXQoJywnKTtcclxuXHRcdFx0c3RhZ2UgPSB7XHJcblx0XHRcdFx0eDogc3RhZ2Vbc3RhZ2UubGVuZ3RoID09PSAxNiA/IDEyIDogNF0sXHJcblx0XHRcdFx0eTogc3RhZ2Vbc3RhZ2UubGVuZ3RoID09PSAxNiA/IDEzIDogNV1cclxuXHRcdFx0fTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHN0YWdlID0gdGhpcy4kc3RhZ2UucG9zaXRpb24oKTtcclxuXHRcdFx0c3RhZ2UgPSB7XHJcblx0XHRcdFx0eDogdGhpcy5zZXR0aW5ncy5ydGwgP1xyXG5cdFx0XHRcdFx0c3RhZ2UubGVmdCArIHRoaXMuJHN0YWdlLndpZHRoKCkgLSB0aGlzLndpZHRoKCkgKyB0aGlzLnNldHRpbmdzLm1hcmdpbiA6XHJcblx0XHRcdFx0XHRzdGFnZS5sZWZ0LFxyXG5cdFx0XHRcdHk6IHN0YWdlLnRvcFxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh0aGlzLmlzKCdhbmltYXRpbmcnKSkge1xyXG5cdFx0XHQkLnN1cHBvcnQudHJhbnNmb3JtID8gdGhpcy5hbmltYXRlKHN0YWdlLngpIDogdGhpcy4kc3RhZ2Uuc3RvcCgpXHJcblx0XHRcdHRoaXMuaW52YWxpZGF0ZSgncG9zaXRpb24nKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLiRlbGVtZW50LnRvZ2dsZUNsYXNzKHRoaXMub3B0aW9ucy5ncmFiQ2xhc3MsIGV2ZW50LnR5cGUgPT09ICdtb3VzZWRvd24nKTtcclxuXHJcblx0XHR0aGlzLnNwZWVkKDApO1xyXG5cclxuXHRcdHRoaXMuX2RyYWcudGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG5cdFx0dGhpcy5fZHJhZy50YXJnZXQgPSAkKGV2ZW50LnRhcmdldCk7XHJcblx0XHR0aGlzLl9kcmFnLnN0YWdlLnN0YXJ0ID0gc3RhZ2U7XHJcblx0XHR0aGlzLl9kcmFnLnN0YWdlLmN1cnJlbnQgPSBzdGFnZTtcclxuXHRcdHRoaXMuX2RyYWcucG9pbnRlciA9IHRoaXMucG9pbnRlcihldmVudCk7XHJcblxyXG5cdFx0JChkb2N1bWVudCkub24oJ21vdXNldXAub3dsLmNvcmUgdG91Y2hlbmQub3dsLmNvcmUnLCAkLnByb3h5KHRoaXMub25EcmFnRW5kLCB0aGlzKSk7XHJcblxyXG5cdFx0JChkb2N1bWVudCkub25lKCdtb3VzZW1vdmUub3dsLmNvcmUgdG91Y2htb3ZlLm93bC5jb3JlJywgJC5wcm94eShmdW5jdGlvbihldmVudCkge1xyXG5cdFx0XHR2YXIgZGVsdGEgPSB0aGlzLmRpZmZlcmVuY2UodGhpcy5fZHJhZy5wb2ludGVyLCB0aGlzLnBvaW50ZXIoZXZlbnQpKTtcclxuXHJcblx0XHRcdCQoZG9jdW1lbnQpLm9uKCdtb3VzZW1vdmUub3dsLmNvcmUgdG91Y2htb3ZlLm93bC5jb3JlJywgJC5wcm94eSh0aGlzLm9uRHJhZ01vdmUsIHRoaXMpKTtcclxuXHJcblx0XHRcdGlmIChNYXRoLmFicyhkZWx0YS54KSA8IE1hdGguYWJzKGRlbHRhLnkpICYmIHRoaXMuaXMoJ3ZhbGlkJykpIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHR0aGlzLmVudGVyKCdkcmFnZ2luZycpO1xyXG5cdFx0XHR0aGlzLnRyaWdnZXIoJ2RyYWcnKTtcclxuXHRcdH0sIHRoaXMpKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBIYW5kbGVzIHRoZSBgdG91Y2htb3ZlYCBhbmQgYG1vdXNlbW92ZWAgZXZlbnRzLlxyXG5cdCAqIEB0b2RvICMyNjFcclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQgYXJndW1lbnRzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUub25EcmFnTW92ZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcblx0XHR2YXIgbWluaW11bSA9IG51bGwsXHJcblx0XHRcdG1heGltdW0gPSBudWxsLFxyXG5cdFx0XHRwdWxsID0gbnVsbCxcclxuXHRcdFx0ZGVsdGEgPSB0aGlzLmRpZmZlcmVuY2UodGhpcy5fZHJhZy5wb2ludGVyLCB0aGlzLnBvaW50ZXIoZXZlbnQpKSxcclxuXHRcdFx0c3RhZ2UgPSB0aGlzLmRpZmZlcmVuY2UodGhpcy5fZHJhZy5zdGFnZS5zdGFydCwgZGVsdGEpO1xyXG5cclxuXHRcdGlmICghdGhpcy5pcygnZHJhZ2dpbmcnKSkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHRpZiAodGhpcy5zZXR0aW5ncy5sb29wKSB7XHJcblx0XHRcdG1pbmltdW0gPSB0aGlzLmNvb3JkaW5hdGVzKHRoaXMubWluaW11bSgpKTtcclxuXHRcdFx0bWF4aW11bSA9IHRoaXMuY29vcmRpbmF0ZXModGhpcy5tYXhpbXVtKCkgKyAxKSAtIG1pbmltdW07XHJcblx0XHRcdHN0YWdlLnggPSAoKChzdGFnZS54IC0gbWluaW11bSkgJSBtYXhpbXVtICsgbWF4aW11bSkgJSBtYXhpbXVtKSArIG1pbmltdW07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRtaW5pbXVtID0gdGhpcy5zZXR0aW5ncy5ydGwgPyB0aGlzLmNvb3JkaW5hdGVzKHRoaXMubWF4aW11bSgpKSA6IHRoaXMuY29vcmRpbmF0ZXModGhpcy5taW5pbXVtKCkpO1xyXG5cdFx0XHRtYXhpbXVtID0gdGhpcy5zZXR0aW5ncy5ydGwgPyB0aGlzLmNvb3JkaW5hdGVzKHRoaXMubWluaW11bSgpKSA6IHRoaXMuY29vcmRpbmF0ZXModGhpcy5tYXhpbXVtKCkpO1xyXG5cdFx0XHRwdWxsID0gdGhpcy5zZXR0aW5ncy5wdWxsRHJhZyA/IC0xICogZGVsdGEueCAvIDUgOiAwO1xyXG5cdFx0XHRzdGFnZS54ID0gTWF0aC5tYXgoTWF0aC5taW4oc3RhZ2UueCwgbWluaW11bSArIHB1bGwpLCBtYXhpbXVtICsgcHVsbCk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fZHJhZy5zdGFnZS5jdXJyZW50ID0gc3RhZ2U7XHJcblxyXG5cdFx0dGhpcy5hbmltYXRlKHN0YWdlLngpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEhhbmRsZXMgdGhlIGB0b3VjaGVuZGAgYW5kIGBtb3VzZXVwYCBldmVudHMuXHJcblx0ICogQHRvZG8gIzI2MVxyXG5cdCAqIEB0b2RvIFRocmVzaG9sZCBmb3IgY2xpY2sgZXZlbnRcclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQgYXJndW1lbnRzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUub25EcmFnRW5kID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuXHRcdHZhciBkZWx0YSA9IHRoaXMuZGlmZmVyZW5jZSh0aGlzLl9kcmFnLnBvaW50ZXIsIHRoaXMucG9pbnRlcihldmVudCkpLFxyXG5cdFx0XHRzdGFnZSA9IHRoaXMuX2RyYWcuc3RhZ2UuY3VycmVudCxcclxuXHRcdFx0ZGlyZWN0aW9uID0gZGVsdGEueCA+IDAgXiB0aGlzLnNldHRpbmdzLnJ0bCA/ICdsZWZ0JyA6ICdyaWdodCc7XHJcblxyXG5cdFx0JChkb2N1bWVudCkub2ZmKCcub3dsLmNvcmUnKTtcclxuXHJcblx0XHR0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5ncmFiQ2xhc3MpO1xyXG5cclxuXHRcdGlmIChkZWx0YS54ICE9PSAwICYmIHRoaXMuaXMoJ2RyYWdnaW5nJykgfHwgIXRoaXMuaXMoJ3ZhbGlkJykpIHtcclxuXHRcdFx0dGhpcy5zcGVlZCh0aGlzLnNldHRpbmdzLmRyYWdFbmRTcGVlZCB8fCB0aGlzLnNldHRpbmdzLnNtYXJ0U3BlZWQpO1xyXG5cdFx0XHR0aGlzLmN1cnJlbnQodGhpcy5jbG9zZXN0KHN0YWdlLngsIGRlbHRhLnggIT09IDAgPyBkaXJlY3Rpb24gOiB0aGlzLl9kcmFnLmRpcmVjdGlvbikpO1xyXG5cdFx0XHR0aGlzLmludmFsaWRhdGUoJ3Bvc2l0aW9uJyk7XHJcblx0XHRcdHRoaXMudXBkYXRlKCk7XHJcblxyXG5cdFx0XHR0aGlzLl9kcmFnLmRpcmVjdGlvbiA9IGRpcmVjdGlvbjtcclxuXHJcblx0XHRcdGlmIChNYXRoLmFicyhkZWx0YS54KSA+IDMgfHwgbmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0aGlzLl9kcmFnLnRpbWUgPiAzMDApIHtcclxuXHRcdFx0XHR0aGlzLl9kcmFnLnRhcmdldC5vbmUoJ2NsaWNrLm93bC5jb3JlJywgZnVuY3Rpb24oKSB7IHJldHVybiBmYWxzZTsgfSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIXRoaXMuaXMoJ2RyYWdnaW5nJykpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMubGVhdmUoJ2RyYWdnaW5nJyk7XHJcblx0XHR0aGlzLnRyaWdnZXIoJ2RyYWdnZWQnKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXRzIGFic29sdXRlIHBvc2l0aW9uIG9mIHRoZSBjbG9zZXN0IGl0ZW0gZm9yIGEgY29vcmRpbmF0ZS5cclxuXHQgKiBAdG9kbyBTZXR0aW5nIGBmcmVlRHJhZ2AgbWFrZXMgYGNsb3Nlc3RgIG5vdCByZXVzYWJsZS4gU2VlICMxNjUuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb29yZGluYXRlIC0gVGhlIGNvb3JkaW5hdGUgaW4gcGl4ZWwuXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGRpcmVjdGlvbiAtIFRoZSBkaXJlY3Rpb24gdG8gY2hlY2sgZm9yIHRoZSBjbG9zZXN0IGl0ZW0uIEV0aGVyIGBsZWZ0YCBvciBgcmlnaHRgLlxyXG5cdCAqIEByZXR1cm4ge051bWJlcn0gLSBUaGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIGNsb3Nlc3QgaXRlbS5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmNsb3Nlc3QgPSBmdW5jdGlvbihjb29yZGluYXRlLCBkaXJlY3Rpb24pIHtcclxuXHRcdHZhciBwb3NpdGlvbiA9IC0xLFxyXG5cdFx0XHRwdWxsID0gMzAsXHJcblx0XHRcdHdpZHRoID0gdGhpcy53aWR0aCgpLFxyXG5cdFx0XHRjb29yZGluYXRlcyA9IHRoaXMuY29vcmRpbmF0ZXMoKTtcclxuXHJcblx0XHRpZiAoIXRoaXMuc2V0dGluZ3MuZnJlZURyYWcpIHtcclxuXHRcdFx0Ly8gY2hlY2sgY2xvc2VzdCBpdGVtXHJcblx0XHRcdCQuZWFjaChjb29yZGluYXRlcywgJC5wcm94eShmdW5jdGlvbihpbmRleCwgdmFsdWUpIHtcclxuXHRcdFx0XHQvLyBvbiBhIGxlZnQgcHVsbCwgY2hlY2sgb24gY3VycmVudCBpbmRleFxyXG5cdFx0XHRcdGlmIChkaXJlY3Rpb24gPT09ICdsZWZ0JyAmJiBjb29yZGluYXRlID4gdmFsdWUgLSBwdWxsICYmIGNvb3JkaW5hdGUgPCB2YWx1ZSArIHB1bGwpIHtcclxuXHRcdFx0XHRcdHBvc2l0aW9uID0gaW5kZXg7XHJcblx0XHRcdFx0Ly8gb24gYSByaWdodCBwdWxsLCBjaGVjayBvbiBwcmV2aW91cyBpbmRleFxyXG5cdFx0XHRcdC8vIHRvIGRvIHNvLCBzdWJ0cmFjdCB3aWR0aCBmcm9tIHZhbHVlIGFuZCBzZXQgcG9zaXRpb24gPSBpbmRleCArIDFcclxuXHRcdFx0XHR9IGVsc2UgaWYgKGRpcmVjdGlvbiA9PT0gJ3JpZ2h0JyAmJiBjb29yZGluYXRlID4gdmFsdWUgLSB3aWR0aCAtIHB1bGwgJiYgY29vcmRpbmF0ZSA8IHZhbHVlIC0gd2lkdGggKyBwdWxsKSB7XHJcblx0XHRcdFx0XHRwb3NpdGlvbiA9IGluZGV4ICsgMTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKHRoaXMub3AoY29vcmRpbmF0ZSwgJzwnLCB2YWx1ZSlcclxuXHRcdFx0XHRcdCYmIHRoaXMub3AoY29vcmRpbmF0ZSwgJz4nLCBjb29yZGluYXRlc1tpbmRleCArIDFdICE9PSB1bmRlZmluZWQgPyBjb29yZGluYXRlc1tpbmRleCArIDFdIDogdmFsdWUgLSB3aWR0aCkpIHtcclxuXHRcdFx0XHRcdHBvc2l0aW9uID0gZGlyZWN0aW9uID09PSAnbGVmdCcgPyBpbmRleCArIDEgOiBpbmRleDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuIHBvc2l0aW9uID09PSAtMTtcclxuXHRcdFx0fSwgdGhpcykpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5sb29wKSB7XHJcblx0XHRcdC8vIG5vbiBsb29wIGJvdW5kcmllc1xyXG5cdFx0XHRpZiAodGhpcy5vcChjb29yZGluYXRlLCAnPicsIGNvb3JkaW5hdGVzW3RoaXMubWluaW11bSgpXSkpIHtcclxuXHRcdFx0XHRwb3NpdGlvbiA9IGNvb3JkaW5hdGUgPSB0aGlzLm1pbmltdW0oKTtcclxuXHRcdFx0fSBlbHNlIGlmICh0aGlzLm9wKGNvb3JkaW5hdGUsICc8JywgY29vcmRpbmF0ZXNbdGhpcy5tYXhpbXVtKCldKSkge1xyXG5cdFx0XHRcdHBvc2l0aW9uID0gY29vcmRpbmF0ZSA9IHRoaXMubWF4aW11bSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBvc2l0aW9uO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFuaW1hdGVzIHRoZSBzdGFnZS5cclxuXHQgKiBAdG9kbyAjMjcwXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb29yZGluYXRlIC0gVGhlIGNvb3JkaW5hdGUgaW4gcGl4ZWxzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuYW5pbWF0ZSA9IGZ1bmN0aW9uKGNvb3JkaW5hdGUpIHtcclxuXHRcdHZhciBhbmltYXRlID0gdGhpcy5zcGVlZCgpID4gMDtcclxuXHJcblx0XHR0aGlzLmlzKCdhbmltYXRpbmcnKSAmJiB0aGlzLm9uVHJhbnNpdGlvbkVuZCgpO1xyXG5cclxuXHRcdGlmIChhbmltYXRlKSB7XHJcblx0XHRcdHRoaXMuZW50ZXIoJ2FuaW1hdGluZycpO1xyXG5cdFx0XHR0aGlzLnRyaWdnZXIoJ3RyYW5zbGF0ZScpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICgkLnN1cHBvcnQudHJhbnNmb3JtM2QgJiYgJC5zdXBwb3J0LnRyYW5zaXRpb24pIHtcclxuXHRcdFx0dGhpcy4kc3RhZ2UuY3NzKHtcclxuXHRcdFx0XHR0cmFuc2Zvcm06ICd0cmFuc2xhdGUzZCgnICsgY29vcmRpbmF0ZSArICdweCwwcHgsMHB4KScsXHJcblx0XHRcdFx0dHJhbnNpdGlvbjogKHRoaXMuc3BlZWQoKSAvIDEwMDApICsgJ3MnXHJcblx0XHRcdH0pO1xyXG5cdFx0fSBlbHNlIGlmIChhbmltYXRlKSB7XHJcblx0XHRcdHRoaXMuJHN0YWdlLmFuaW1hdGUoe1xyXG5cdFx0XHRcdGxlZnQ6IGNvb3JkaW5hdGUgKyAncHgnXHJcblx0XHRcdH0sIHRoaXMuc3BlZWQoKSwgdGhpcy5zZXR0aW5ncy5mYWxsYmFja0Vhc2luZywgJC5wcm94eSh0aGlzLm9uVHJhbnNpdGlvbkVuZCwgdGhpcykpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy4kc3RhZ2UuY3NzKHtcclxuXHRcdFx0XHRsZWZ0OiBjb29yZGluYXRlICsgJ3B4J1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDaGVja3Mgd2hldGhlciB0aGUgY2Fyb3VzZWwgaXMgaW4gYSBzcGVjaWZpYyBzdGF0ZSBvciBub3QuXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IHN0YXRlIC0gVGhlIHN0YXRlIHRvIGNoZWNrLlxyXG5cdCAqIEByZXR1cm5zIHtCb29sZWFufSAtIFRoZSBmbGFnIHdoaWNoIGluZGljYXRlcyBpZiB0aGUgY2Fyb3VzZWwgaXMgYnVzeS5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmlzID0gZnVuY3Rpb24oc3RhdGUpIHtcclxuXHRcdHJldHVybiB0aGlzLl9zdGF0ZXMuY3VycmVudFtzdGF0ZV0gJiYgdGhpcy5fc3RhdGVzLmN1cnJlbnRbc3RhdGVdID4gMDtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXRzIHRoZSBhYnNvbHV0ZSBwb3NpdGlvbiBvZiB0aGUgY3VycmVudCBpdGVtLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3Bvc2l0aW9uXSAtIFRoZSBuZXcgYWJzb2x1dGUgcG9zaXRpb24gb3Igbm90aGluZyB0byBsZWF2ZSBpdCB1bmNoYW5nZWQuXHJcblx0ICogQHJldHVybnMge051bWJlcn0gLSBUaGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIGN1cnJlbnQgaXRlbS5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmN1cnJlbnQgPSBmdW5jdGlvbihwb3NpdGlvbikge1xyXG5cdFx0aWYgKHBvc2l0aW9uID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuX2N1cnJlbnQ7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHRoaXMuX2l0ZW1zLmxlbmd0aCA9PT0gMCkge1xyXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xyXG5cdFx0fVxyXG5cclxuXHRcdHBvc2l0aW9uID0gdGhpcy5ub3JtYWxpemUocG9zaXRpb24pO1xyXG5cclxuXHRcdGlmICh0aGlzLl9jdXJyZW50ICE9PSBwb3NpdGlvbikge1xyXG5cdFx0XHR2YXIgZXZlbnQgPSB0aGlzLnRyaWdnZXIoJ2NoYW5nZScsIHsgcHJvcGVydHk6IHsgbmFtZTogJ3Bvc2l0aW9uJywgdmFsdWU6IHBvc2l0aW9uIH0gfSk7XHJcblxyXG5cdFx0XHRpZiAoZXZlbnQuZGF0YSAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdFx0cG9zaXRpb24gPSB0aGlzLm5vcm1hbGl6ZShldmVudC5kYXRhKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5fY3VycmVudCA9IHBvc2l0aW9uO1xyXG5cclxuXHRcdFx0dGhpcy5pbnZhbGlkYXRlKCdwb3NpdGlvbicpO1xyXG5cclxuXHRcdFx0dGhpcy50cmlnZ2VyKCdjaGFuZ2VkJywgeyBwcm9wZXJ0eTogeyBuYW1lOiAncG9zaXRpb24nLCB2YWx1ZTogdGhpcy5fY3VycmVudCB9IH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzLl9jdXJyZW50O1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEludmFsaWRhdGVzIHRoZSBnaXZlbiBwYXJ0IG9mIHRoZSB1cGRhdGUgcm91dGluZS5cclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gW3BhcnRdIC0gVGhlIHBhcnQgdG8gaW52YWxpZGF0ZS5cclxuXHQgKiBAcmV0dXJucyB7QXJyYXkuPFN0cmluZz59IC0gVGhlIGludmFsaWRhdGVkIHBhcnRzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuaW52YWxpZGF0ZSA9IGZ1bmN0aW9uKHBhcnQpIHtcclxuXHRcdGlmICgkLnR5cGUocGFydCkgPT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdHRoaXMuX2ludmFsaWRhdGVkW3BhcnRdID0gdHJ1ZTtcclxuXHRcdFx0dGhpcy5pcygndmFsaWQnKSAmJiB0aGlzLmxlYXZlKCd2YWxpZCcpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuICQubWFwKHRoaXMuX2ludmFsaWRhdGVkLCBmdW5jdGlvbih2LCBpKSB7IHJldHVybiBpIH0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlc2V0cyB0aGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIGN1cnJlbnQgaXRlbS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIGFic29sdXRlIHBvc2l0aW9uIG9mIHRoZSBuZXcgaXRlbS5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcclxuXHRcdHBvc2l0aW9uID0gdGhpcy5ub3JtYWxpemUocG9zaXRpb24pO1xyXG5cclxuXHRcdGlmIChwb3NpdGlvbiA9PT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9zcGVlZCA9IDA7XHJcblx0XHR0aGlzLl9jdXJyZW50ID0gcG9zaXRpb247XHJcblxyXG5cdFx0dGhpcy5zdXBwcmVzcyhbICd0cmFuc2xhdGUnLCAndHJhbnNsYXRlZCcgXSk7XHJcblxyXG5cdFx0dGhpcy5hbmltYXRlKHRoaXMuY29vcmRpbmF0ZXMocG9zaXRpb24pKTtcclxuXHJcblx0XHR0aGlzLnJlbGVhc2UoWyAndHJhbnNsYXRlJywgJ3RyYW5zbGF0ZWQnIF0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIE5vcm1hbGl6ZXMgYW4gYWJzb2x1dGUgb3IgYSByZWxhdGl2ZSBwb3NpdGlvbiBvZiBhbiBpdGVtLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSBUaGUgYWJzb2x1dGUgb3IgcmVsYXRpdmUgcG9zaXRpb24gdG8gbm9ybWFsaXplLlxyXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gW3JlbGF0aXZlPWZhbHNlXSAtIFdoZXRoZXIgdGhlIGdpdmVuIHBvc2l0aW9uIGlzIHJlbGF0aXZlIG9yIG5vdC5cclxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSAtIFRoZSBub3JtYWxpemVkIHBvc2l0aW9uLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUubm9ybWFsaXplID0gZnVuY3Rpb24ocG9zaXRpb24sIHJlbGF0aXZlKSB7XHJcblx0XHR2YXIgbiA9IHRoaXMuX2l0ZW1zLmxlbmd0aCxcclxuXHRcdFx0bSA9IHJlbGF0aXZlID8gMCA6IHRoaXMuX2Nsb25lcy5sZW5ndGg7XHJcblxyXG5cdFx0aWYgKCF0aGlzLmlzTnVtZXJpYyhwb3NpdGlvbikgfHwgbiA8IDEpIHtcclxuXHRcdFx0cG9zaXRpb24gPSB1bmRlZmluZWQ7XHJcblx0XHR9IGVsc2UgaWYgKHBvc2l0aW9uIDwgMCB8fCBwb3NpdGlvbiA+PSBuICsgbSkge1xyXG5cdFx0XHRwb3NpdGlvbiA9ICgocG9zaXRpb24gLSBtIC8gMikgJSBuICsgbikgJSBuICsgbSAvIDI7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBvc2l0aW9uO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENvbnZlcnRzIGFuIGFic29sdXRlIHBvc2l0aW9uIG9mIGFuIGl0ZW0gaW50byBhIHJlbGF0aXZlIG9uZS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIGFic29sdXRlIHBvc2l0aW9uIHRvIGNvbnZlcnQuXHJcblx0ICogQHJldHVybnMge051bWJlcn0gLSBUaGUgY29udmVydGVkIHBvc2l0aW9uLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUucmVsYXRpdmUgPSBmdW5jdGlvbihwb3NpdGlvbikge1xyXG5cdFx0cG9zaXRpb24gLT0gdGhpcy5fY2xvbmVzLmxlbmd0aCAvIDI7XHJcblx0XHRyZXR1cm4gdGhpcy5ub3JtYWxpemUocG9zaXRpb24sIHRydWUpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgdGhlIG1heGltdW0gcG9zaXRpb24gZm9yIHRoZSBjdXJyZW50IGl0ZW0uXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gW3JlbGF0aXZlPWZhbHNlXSAtIFdoZXRoZXIgdG8gcmV0dXJuIGFuIGFic29sdXRlIHBvc2l0aW9uIG9yIGEgcmVsYXRpdmUgcG9zaXRpb24uXHJcblx0ICogQHJldHVybnMge051bWJlcn1cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLm1heGltdW0gPSBmdW5jdGlvbihyZWxhdGl2ZSkge1xyXG5cdFx0dmFyIHNldHRpbmdzID0gdGhpcy5zZXR0aW5ncyxcclxuXHRcdFx0bWF4aW11bSA9IHRoaXMuX2Nvb3JkaW5hdGVzLmxlbmd0aCxcclxuXHRcdFx0aXRlcmF0b3IsXHJcblx0XHRcdHJlY2lwcm9jYWxJdGVtc1dpZHRoLFxyXG5cdFx0XHRlbGVtZW50V2lkdGg7XHJcblxyXG5cdFx0aWYgKHNldHRpbmdzLmxvb3ApIHtcclxuXHRcdFx0bWF4aW11bSA9IHRoaXMuX2Nsb25lcy5sZW5ndGggLyAyICsgdGhpcy5faXRlbXMubGVuZ3RoIC0gMTtcclxuXHRcdH0gZWxzZSBpZiAoc2V0dGluZ3MuYXV0b1dpZHRoIHx8IHNldHRpbmdzLm1lcmdlKSB7XHJcblx0XHRcdGl0ZXJhdG9yID0gdGhpcy5faXRlbXMubGVuZ3RoO1xyXG5cdFx0XHRpZiAoaXRlcmF0b3IpIHtcclxuXHRcdFx0XHRyZWNpcHJvY2FsSXRlbXNXaWR0aCA9IHRoaXMuX2l0ZW1zWy0taXRlcmF0b3JdLndpZHRoKCk7XHJcblx0XHRcdFx0ZWxlbWVudFdpZHRoID0gdGhpcy4kZWxlbWVudC53aWR0aCgpO1xyXG5cdFx0XHRcdHdoaWxlIChpdGVyYXRvci0tKSB7XHJcblx0XHRcdFx0XHRyZWNpcHJvY2FsSXRlbXNXaWR0aCArPSB0aGlzLl9pdGVtc1tpdGVyYXRvcl0ud2lkdGgoKSArIHRoaXMuc2V0dGluZ3MubWFyZ2luO1xyXG5cdFx0XHRcdFx0aWYgKHJlY2lwcm9jYWxJdGVtc1dpZHRoID4gZWxlbWVudFdpZHRoKSB7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRtYXhpbXVtID0gaXRlcmF0b3IgKyAxO1xyXG5cdFx0fSBlbHNlIGlmIChzZXR0aW5ncy5jZW50ZXIpIHtcclxuXHRcdFx0bWF4aW11bSA9IHRoaXMuX2l0ZW1zLmxlbmd0aCAtIDE7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRtYXhpbXVtID0gdGhpcy5faXRlbXMubGVuZ3RoIC0gc2V0dGluZ3MuaXRlbXM7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHJlbGF0aXZlKSB7XHJcblx0XHRcdG1heGltdW0gLT0gdGhpcy5fY2xvbmVzLmxlbmd0aCAvIDI7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIE1hdGgubWF4KG1heGltdW0sIDApO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgdGhlIG1pbmltdW0gcG9zaXRpb24gZm9yIHRoZSBjdXJyZW50IGl0ZW0uXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gW3JlbGF0aXZlPWZhbHNlXSAtIFdoZXRoZXIgdG8gcmV0dXJuIGFuIGFic29sdXRlIHBvc2l0aW9uIG9yIGEgcmVsYXRpdmUgcG9zaXRpb24uXHJcblx0ICogQHJldHVybnMge051bWJlcn1cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLm1pbmltdW0gPSBmdW5jdGlvbihyZWxhdGl2ZSkge1xyXG5cdFx0cmV0dXJuIHJlbGF0aXZlID8gMCA6IHRoaXMuX2Nsb25lcy5sZW5ndGggLyAyO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgYW4gaXRlbSBhdCB0aGUgc3BlY2lmaWVkIHJlbGF0aXZlIHBvc2l0aW9uLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3Bvc2l0aW9uXSAtIFRoZSByZWxhdGl2ZSBwb3NpdGlvbiBvZiB0aGUgaXRlbS5cclxuXHQgKiBAcmV0dXJuIHtqUXVlcnl8QXJyYXkuPGpRdWVyeT59IC0gVGhlIGl0ZW0gYXQgdGhlIGdpdmVuIHBvc2l0aW9uIG9yIGFsbCBpdGVtcyBpZiBubyBwb3NpdGlvbiB3YXMgZ2l2ZW4uXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5pdGVtcyA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XHJcblx0XHRpZiAocG9zaXRpb24gPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5faXRlbXMuc2xpY2UoKTtcclxuXHRcdH1cclxuXHJcblx0XHRwb3NpdGlvbiA9IHRoaXMubm9ybWFsaXplKHBvc2l0aW9uLCB0cnVlKTtcclxuXHRcdHJldHVybiB0aGlzLl9pdGVtc1twb3NpdGlvbl07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0cyBhbiBpdGVtIGF0IHRoZSBzcGVjaWZpZWQgcmVsYXRpdmUgcG9zaXRpb24uXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbcG9zaXRpb25dIC0gVGhlIHJlbGF0aXZlIHBvc2l0aW9uIG9mIHRoZSBpdGVtLlxyXG5cdCAqIEByZXR1cm4ge2pRdWVyeXxBcnJheS48alF1ZXJ5Pn0gLSBUaGUgaXRlbSBhdCB0aGUgZ2l2ZW4gcG9zaXRpb24gb3IgYWxsIGl0ZW1zIGlmIG5vIHBvc2l0aW9uIHdhcyBnaXZlbi5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLm1lcmdlcnMgPSBmdW5jdGlvbihwb3NpdGlvbikge1xyXG5cdFx0aWYgKHBvc2l0aW9uID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuX21lcmdlcnMuc2xpY2UoKTtcclxuXHRcdH1cclxuXHJcblx0XHRwb3NpdGlvbiA9IHRoaXMubm9ybWFsaXplKHBvc2l0aW9uLCB0cnVlKTtcclxuXHRcdHJldHVybiB0aGlzLl9tZXJnZXJzW3Bvc2l0aW9uXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXRzIHRoZSBhYnNvbHV0ZSBwb3NpdGlvbnMgb2YgY2xvbmVzIGZvciBhbiBpdGVtLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3Bvc2l0aW9uXSAtIFRoZSByZWxhdGl2ZSBwb3NpdGlvbiBvZiB0aGUgaXRlbS5cclxuXHQgKiBAcmV0dXJucyB7QXJyYXkuPE51bWJlcj59IC0gVGhlIGFic29sdXRlIHBvc2l0aW9ucyBvZiBjbG9uZXMgZm9yIHRoZSBpdGVtIG9yIGFsbCBpZiBubyBwb3NpdGlvbiB3YXMgZ2l2ZW4uXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5jbG9uZXMgPSBmdW5jdGlvbihwb3NpdGlvbikge1xyXG5cdFx0dmFyIG9kZCA9IHRoaXMuX2Nsb25lcy5sZW5ndGggLyAyLFxyXG5cdFx0XHRldmVuID0gb2RkICsgdGhpcy5faXRlbXMubGVuZ3RoLFxyXG5cdFx0XHRtYXAgPSBmdW5jdGlvbihpbmRleCkgeyByZXR1cm4gaW5kZXggJSAyID09PSAwID8gZXZlbiArIGluZGV4IC8gMiA6IG9kZCAtIChpbmRleCArIDEpIC8gMiB9O1xyXG5cclxuXHRcdGlmIChwb3NpdGlvbiA9PT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdHJldHVybiAkLm1hcCh0aGlzLl9jbG9uZXMsIGZ1bmN0aW9uKHYsIGkpIHsgcmV0dXJuIG1hcChpKSB9KTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gJC5tYXAodGhpcy5fY2xvbmVzLCBmdW5jdGlvbih2LCBpKSB7IHJldHVybiB2ID09PSBwb3NpdGlvbiA/IG1hcChpKSA6IG51bGwgfSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0cyB0aGUgY3VycmVudCBhbmltYXRpb24gc3BlZWQuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbc3BlZWRdIC0gVGhlIGFuaW1hdGlvbiBzcGVlZCBpbiBtaWxsaXNlY29uZHMgb3Igbm90aGluZyB0byBsZWF2ZSBpdCB1bmNoYW5nZWQuXHJcblx0ICogQHJldHVybnMge051bWJlcn0gLSBUaGUgY3VycmVudCBhbmltYXRpb24gc3BlZWQgaW4gbWlsbGlzZWNvbmRzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuc3BlZWQgPSBmdW5jdGlvbihzcGVlZCkge1xyXG5cdFx0aWYgKHNwZWVkICE9PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0dGhpcy5fc3BlZWQgPSBzcGVlZDtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcy5fc3BlZWQ7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0cyB0aGUgY29vcmRpbmF0ZSBvZiBhbiBpdGVtLlxyXG5cdCAqIEB0b2RvIFRoZSBuYW1lIG9mIHRoaXMgbWV0aG9kIGlzIG1pc3NsZWFuZGluZy5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIGFic29sdXRlIHBvc2l0aW9uIG9mIHRoZSBpdGVtIHdpdGhpbiBgbWluaW11bSgpYCBhbmQgYG1heGltdW0oKWAuXHJcblx0ICogQHJldHVybnMge051bWJlcnxBcnJheS48TnVtYmVyPn0gLSBUaGUgY29vcmRpbmF0ZSBvZiB0aGUgaXRlbSBpbiBwaXhlbCBvciBhbGwgY29vcmRpbmF0ZXMuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5jb29yZGluYXRlcyA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XHJcblx0XHR2YXIgbXVsdGlwbGllciA9IDEsXHJcblx0XHRcdG5ld1Bvc2l0aW9uID0gcG9zaXRpb24gLSAxLFxyXG5cdFx0XHRjb29yZGluYXRlO1xyXG5cclxuXHRcdGlmIChwb3NpdGlvbiA9PT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdHJldHVybiAkLm1hcCh0aGlzLl9jb29yZGluYXRlcywgJC5wcm94eShmdW5jdGlvbihjb29yZGluYXRlLCBpbmRleCkge1xyXG5cdFx0XHRcdHJldHVybiB0aGlzLmNvb3JkaW5hdGVzKGluZGV4KTtcclxuXHRcdFx0fSwgdGhpcykpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLmNlbnRlcikge1xyXG5cdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5ydGwpIHtcclxuXHRcdFx0XHRtdWx0aXBsaWVyID0gLTE7XHJcblx0XHRcdFx0bmV3UG9zaXRpb24gPSBwb3NpdGlvbiArIDE7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvb3JkaW5hdGUgPSB0aGlzLl9jb29yZGluYXRlc1twb3NpdGlvbl07XHJcblx0XHRcdGNvb3JkaW5hdGUgKz0gKHRoaXMud2lkdGgoKSAtIGNvb3JkaW5hdGUgKyAodGhpcy5fY29vcmRpbmF0ZXNbbmV3UG9zaXRpb25dIHx8IDApKSAvIDIgKiBtdWx0aXBsaWVyO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0Y29vcmRpbmF0ZSA9IHRoaXMuX2Nvb3JkaW5hdGVzW25ld1Bvc2l0aW9uXSB8fCAwO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvb3JkaW5hdGUgPSBNYXRoLmNlaWwoY29vcmRpbmF0ZSk7XHJcblxyXG5cdFx0cmV0dXJuIGNvb3JkaW5hdGU7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQ2FsY3VsYXRlcyB0aGUgc3BlZWQgZm9yIGEgdHJhbnNsYXRpb24uXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBmcm9tIC0gVGhlIGFic29sdXRlIHBvc2l0aW9uIG9mIHRoZSBzdGFydCBpdGVtLlxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSB0byAtIFRoZSBhYnNvbHV0ZSBwb3NpdGlvbiBvZiB0aGUgdGFyZ2V0IGl0ZW0uXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtmYWN0b3I9dW5kZWZpbmVkXSAtIFRoZSB0aW1lIGZhY3RvciBpbiBtaWxsaXNlY29uZHMuXHJcblx0ICogQHJldHVybnMge051bWJlcn0gLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgZm9yIHRoZSB0cmFuc2xhdGlvbi5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmR1cmF0aW9uID0gZnVuY3Rpb24oZnJvbSwgdG8sIGZhY3Rvcikge1xyXG5cdFx0aWYgKGZhY3RvciA9PT0gMCkge1xyXG5cdFx0XHRyZXR1cm4gMDtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gTWF0aC5taW4oTWF0aC5tYXgoTWF0aC5hYnModG8gLSBmcm9tKSwgMSksIDYpICogTWF0aC5hYnMoKGZhY3RvciB8fCB0aGlzLnNldHRpbmdzLnNtYXJ0U3BlZWQpKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTbGlkZXMgdG8gdGhlIHNwZWNpZmllZCBpdGVtLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSBUaGUgcG9zaXRpb24gb2YgdGhlIGl0ZW0uXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtzcGVlZF0gLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgZm9yIHRoZSB0cmFuc2l0aW9uLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUudG8gPSBmdW5jdGlvbihwb3NpdGlvbiwgc3BlZWQpIHtcclxuXHRcdHZhciBjdXJyZW50ID0gdGhpcy5jdXJyZW50KCksXHJcblx0XHRcdHJldmVydCA9IG51bGwsXHJcblx0XHRcdGRpc3RhbmNlID0gcG9zaXRpb24gLSB0aGlzLnJlbGF0aXZlKGN1cnJlbnQpLFxyXG5cdFx0XHRkaXJlY3Rpb24gPSAoZGlzdGFuY2UgPiAwKSAtIChkaXN0YW5jZSA8IDApLFxyXG5cdFx0XHRpdGVtcyA9IHRoaXMuX2l0ZW1zLmxlbmd0aCxcclxuXHRcdFx0bWluaW11bSA9IHRoaXMubWluaW11bSgpLFxyXG5cdFx0XHRtYXhpbXVtID0gdGhpcy5tYXhpbXVtKCk7XHJcblxyXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MubG9vcCkge1xyXG5cdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3MucmV3aW5kICYmIE1hdGguYWJzKGRpc3RhbmNlKSA+IGl0ZW1zIC8gMikge1xyXG5cdFx0XHRcdGRpc3RhbmNlICs9IGRpcmVjdGlvbiAqIC0xICogaXRlbXM7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHBvc2l0aW9uID0gY3VycmVudCArIGRpc3RhbmNlO1xyXG5cdFx0XHRyZXZlcnQgPSAoKHBvc2l0aW9uIC0gbWluaW11bSkgJSBpdGVtcyArIGl0ZW1zKSAlIGl0ZW1zICsgbWluaW11bTtcclxuXHJcblx0XHRcdGlmIChyZXZlcnQgIT09IHBvc2l0aW9uICYmIHJldmVydCAtIGRpc3RhbmNlIDw9IG1heGltdW0gJiYgcmV2ZXJ0IC0gZGlzdGFuY2UgPiAwKSB7XHJcblx0XHRcdFx0Y3VycmVudCA9IHJldmVydCAtIGRpc3RhbmNlO1xyXG5cdFx0XHRcdHBvc2l0aW9uID0gcmV2ZXJ0O1xyXG5cdFx0XHRcdHRoaXMucmVzZXQoY3VycmVudCk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSBpZiAodGhpcy5zZXR0aW5ncy5yZXdpbmQpIHtcclxuXHRcdFx0bWF4aW11bSArPSAxO1xyXG5cdFx0XHRwb3NpdGlvbiA9IChwb3NpdGlvbiAlIG1heGltdW0gKyBtYXhpbXVtKSAlIG1heGltdW07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRwb3NpdGlvbiA9IE1hdGgubWF4KG1pbmltdW0sIE1hdGgubWluKG1heGltdW0sIHBvc2l0aW9uKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5zcGVlZCh0aGlzLmR1cmF0aW9uKGN1cnJlbnQsIHBvc2l0aW9uLCBzcGVlZCkpO1xyXG5cdFx0dGhpcy5jdXJyZW50KHBvc2l0aW9uKTtcclxuXHJcblx0XHRpZiAodGhpcy5pc1Zpc2libGUoKSkge1xyXG5cdFx0XHR0aGlzLnVwZGF0ZSgpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNsaWRlcyB0byB0aGUgbmV4dCBpdGVtLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3NwZWVkXSAtIFRoZSB0aW1lIGluIG1pbGxpc2Vjb25kcyBmb3IgdGhlIHRyYW5zaXRpb24uXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24oc3BlZWQpIHtcclxuXHRcdHNwZWVkID0gc3BlZWQgfHwgZmFsc2U7XHJcblx0XHR0aGlzLnRvKHRoaXMucmVsYXRpdmUodGhpcy5jdXJyZW50KCkpICsgMSwgc3BlZWQpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNsaWRlcyB0byB0aGUgcHJldmlvdXMgaXRlbS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtzcGVlZF0gLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgZm9yIHRoZSB0cmFuc2l0aW9uLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUucHJldiA9IGZ1bmN0aW9uKHNwZWVkKSB7XHJcblx0XHRzcGVlZCA9IHNwZWVkIHx8IGZhbHNlO1xyXG5cdFx0dGhpcy50byh0aGlzLnJlbGF0aXZlKHRoaXMuY3VycmVudCgpKSAtIDEsIHNwZWVkKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBIYW5kbGVzIHRoZSBlbmQgb2YgYW4gYW5pbWF0aW9uLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCAtIFRoZSBldmVudCBhcmd1bWVudHMuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5vblRyYW5zaXRpb25FbmQgPSBmdW5jdGlvbihldmVudCkge1xyXG5cclxuXHRcdC8vIGlmIGNzczIgYW5pbWF0aW9uIHRoZW4gZXZlbnQgb2JqZWN0IGlzIHVuZGVmaW5lZFxyXG5cdFx0aWYgKGV2ZW50ICE9PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblxyXG5cdFx0XHQvLyBDYXRjaCBvbmx5IG93bC1zdGFnZSB0cmFuc2l0aW9uRW5kIGV2ZW50XHJcblx0XHRcdGlmICgoZXZlbnQudGFyZ2V0IHx8IGV2ZW50LnNyY0VsZW1lbnQgfHwgZXZlbnQub3JpZ2luYWxUYXJnZXQpICE9PSB0aGlzLiRzdGFnZS5nZXQoMCkpIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmxlYXZlKCdhbmltYXRpbmcnKTtcclxuXHRcdHRoaXMudHJpZ2dlcigndHJhbnNsYXRlZCcpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgdmlld3BvcnQgd2lkdGguXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEByZXR1cm4ge051bWJlcn0gLSBUaGUgd2lkdGggaW4gcGl4ZWwuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS52aWV3cG9ydCA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIHdpZHRoO1xyXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5yZXNwb25zaXZlQmFzZUVsZW1lbnQgIT09IHdpbmRvdykge1xyXG5cdFx0XHR3aWR0aCA9ICQodGhpcy5vcHRpb25zLnJlc3BvbnNpdmVCYXNlRWxlbWVudCkud2lkdGgoKTtcclxuXHRcdH0gZWxzZSBpZiAod2luZG93LmlubmVyV2lkdGgpIHtcclxuXHRcdFx0d2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcclxuXHRcdH0gZWxzZSBpZiAoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50ICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCkge1xyXG5cdFx0XHR3aWR0aCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aDtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGNvbnNvbGUud2FybignQ2FuIG5vdCBkZXRlY3Qgdmlld3BvcnQgd2lkdGguJyk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gd2lkdGg7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUmVwbGFjZXMgdGhlIGN1cnJlbnQgY29udGVudC5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxqUXVlcnl8U3RyaW5nfSBjb250ZW50IC0gVGhlIG5ldyBjb250ZW50LlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUucmVwbGFjZSA9IGZ1bmN0aW9uKGNvbnRlbnQpIHtcclxuXHRcdHRoaXMuJHN0YWdlLmVtcHR5KCk7XHJcblx0XHR0aGlzLl9pdGVtcyA9IFtdO1xyXG5cclxuXHRcdGlmIChjb250ZW50KSB7XHJcblx0XHRcdGNvbnRlbnQgPSAoY29udGVudCBpbnN0YW5jZW9mIGpRdWVyeSkgPyBjb250ZW50IDogJChjb250ZW50KTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAodGhpcy5zZXR0aW5ncy5uZXN0ZWRJdGVtU2VsZWN0b3IpIHtcclxuXHRcdFx0Y29udGVudCA9IGNvbnRlbnQuZmluZCgnLicgKyB0aGlzLnNldHRpbmdzLm5lc3RlZEl0ZW1TZWxlY3Rvcik7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29udGVudC5maWx0ZXIoZnVuY3Rpb24oKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLm5vZGVUeXBlID09PSAxO1xyXG5cdFx0fSkuZWFjaCgkLnByb3h5KGZ1bmN0aW9uKGluZGV4LCBpdGVtKSB7XHJcblx0XHRcdGl0ZW0gPSB0aGlzLnByZXBhcmUoaXRlbSk7XHJcblx0XHRcdHRoaXMuJHN0YWdlLmFwcGVuZChpdGVtKTtcclxuXHRcdFx0dGhpcy5faXRlbXMucHVzaChpdGVtKTtcclxuXHRcdFx0dGhpcy5fbWVyZ2Vycy5wdXNoKGl0ZW0uZmluZCgnW2RhdGEtbWVyZ2VdJykuYWRkQmFjaygnW2RhdGEtbWVyZ2VdJykuYXR0cignZGF0YS1tZXJnZScpICogMSB8fCAxKTtcclxuXHRcdH0sIHRoaXMpKTtcclxuXHJcblx0XHR0aGlzLnJlc2V0KHRoaXMuaXNOdW1lcmljKHRoaXMuc2V0dGluZ3Muc3RhcnRQb3NpdGlvbikgPyB0aGlzLnNldHRpbmdzLnN0YXJ0UG9zaXRpb24gOiAwKTtcclxuXHJcblx0XHR0aGlzLmludmFsaWRhdGUoJ2l0ZW1zJyk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQWRkcyBhbiBpdGVtLlxyXG5cdCAqIEB0b2RvIFVzZSBgaXRlbWAgaW5zdGVhZCBvZiBgY29udGVudGAgZm9yIHRoZSBldmVudCBhcmd1bWVudHMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8alF1ZXJ5fFN0cmluZ30gY29udGVudCAtIFRoZSBpdGVtIGNvbnRlbnQgdG8gYWRkLlxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbcG9zaXRpb25dIC0gVGhlIHJlbGF0aXZlIHBvc2l0aW9uIGF0IHdoaWNoIHRvIGluc2VydCB0aGUgaXRlbSBvdGhlcndpc2UgdGhlIGl0ZW0gd2lsbCBiZSBhZGRlZCB0byB0aGUgZW5kLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oY29udGVudCwgcG9zaXRpb24pIHtcclxuXHRcdHZhciBjdXJyZW50ID0gdGhpcy5yZWxhdGl2ZSh0aGlzLl9jdXJyZW50KTtcclxuXHJcblx0XHRwb3NpdGlvbiA9IHBvc2l0aW9uID09PSB1bmRlZmluZWQgPyB0aGlzLl9pdGVtcy5sZW5ndGggOiB0aGlzLm5vcm1hbGl6ZShwb3NpdGlvbiwgdHJ1ZSk7XHJcblx0XHRjb250ZW50ID0gY29udGVudCBpbnN0YW5jZW9mIGpRdWVyeSA/IGNvbnRlbnQgOiAkKGNvbnRlbnQpO1xyXG5cclxuXHRcdHRoaXMudHJpZ2dlcignYWRkJywgeyBjb250ZW50OiBjb250ZW50LCBwb3NpdGlvbjogcG9zaXRpb24gfSk7XHJcblxyXG5cdFx0Y29udGVudCA9IHRoaXMucHJlcGFyZShjb250ZW50KTtcclxuXHJcblx0XHRpZiAodGhpcy5faXRlbXMubGVuZ3RoID09PSAwIHx8IHBvc2l0aW9uID09PSB0aGlzLl9pdGVtcy5sZW5ndGgpIHtcclxuXHRcdFx0dGhpcy5faXRlbXMubGVuZ3RoID09PSAwICYmIHRoaXMuJHN0YWdlLmFwcGVuZChjb250ZW50KTtcclxuXHRcdFx0dGhpcy5faXRlbXMubGVuZ3RoICE9PSAwICYmIHRoaXMuX2l0ZW1zW3Bvc2l0aW9uIC0gMV0uYWZ0ZXIoY29udGVudCk7XHJcblx0XHRcdHRoaXMuX2l0ZW1zLnB1c2goY29udGVudCk7XHJcblx0XHRcdHRoaXMuX21lcmdlcnMucHVzaChjb250ZW50LmZpbmQoJ1tkYXRhLW1lcmdlXScpLmFkZEJhY2soJ1tkYXRhLW1lcmdlXScpLmF0dHIoJ2RhdGEtbWVyZ2UnKSAqIDEgfHwgMSk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLl9pdGVtc1twb3NpdGlvbl0uYmVmb3JlKGNvbnRlbnQpO1xyXG5cdFx0XHR0aGlzLl9pdGVtcy5zcGxpY2UocG9zaXRpb24sIDAsIGNvbnRlbnQpO1xyXG5cdFx0XHR0aGlzLl9tZXJnZXJzLnNwbGljZShwb3NpdGlvbiwgMCwgY29udGVudC5maW5kKCdbZGF0YS1tZXJnZV0nKS5hZGRCYWNrKCdbZGF0YS1tZXJnZV0nKS5hdHRyKCdkYXRhLW1lcmdlJykgKiAxIHx8IDEpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2l0ZW1zW2N1cnJlbnRdICYmIHRoaXMucmVzZXQodGhpcy5faXRlbXNbY3VycmVudF0uaW5kZXgoKSk7XHJcblxyXG5cdFx0dGhpcy5pbnZhbGlkYXRlKCdpdGVtcycpO1xyXG5cclxuXHRcdHRoaXMudHJpZ2dlcignYWRkZWQnLCB7IGNvbnRlbnQ6IGNvbnRlbnQsIHBvc2l0aW9uOiBwb3NpdGlvbiB9KTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBSZW1vdmVzIGFuIGl0ZW0gYnkgaXRzIHBvc2l0aW9uLlxyXG5cdCAqIEB0b2RvIFVzZSBgaXRlbWAgaW5zdGVhZCBvZiBgY29udGVudGAgZm9yIHRoZSBldmVudCBhcmd1bWVudHMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBwb3NpdGlvbiAtIFRoZSByZWxhdGl2ZSBwb3NpdGlvbiBvZiB0aGUgaXRlbSB0byByZW1vdmUuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbihwb3NpdGlvbikge1xyXG5cdFx0cG9zaXRpb24gPSB0aGlzLm5vcm1hbGl6ZShwb3NpdGlvbiwgdHJ1ZSk7XHJcblxyXG5cdFx0aWYgKHBvc2l0aW9uID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMudHJpZ2dlcigncmVtb3ZlJywgeyBjb250ZW50OiB0aGlzLl9pdGVtc1twb3NpdGlvbl0sIHBvc2l0aW9uOiBwb3NpdGlvbiB9KTtcclxuXHJcblx0XHR0aGlzLl9pdGVtc1twb3NpdGlvbl0ucmVtb3ZlKCk7XHJcblx0XHR0aGlzLl9pdGVtcy5zcGxpY2UocG9zaXRpb24sIDEpO1xyXG5cdFx0dGhpcy5fbWVyZ2Vycy5zcGxpY2UocG9zaXRpb24sIDEpO1xyXG5cclxuXHRcdHRoaXMuaW52YWxpZGF0ZSgnaXRlbXMnKTtcclxuXHJcblx0XHR0aGlzLnRyaWdnZXIoJ3JlbW92ZWQnLCB7IGNvbnRlbnQ6IG51bGwsIHBvc2l0aW9uOiBwb3NpdGlvbiB9KTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBQcmVsb2FkcyBpbWFnZXMgd2l0aCBhdXRvIHdpZHRoLlxyXG5cdCAqIEB0b2RvIFJlcGxhY2UgYnkgYSBtb3JlIGdlbmVyaWMgYXBwcm9hY2hcclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5wcmVsb2FkQXV0b1dpZHRoSW1hZ2VzID0gZnVuY3Rpb24oaW1hZ2VzKSB7XHJcblx0XHRpbWFnZXMuZWFjaCgkLnByb3h5KGZ1bmN0aW9uKGksIGVsZW1lbnQpIHtcclxuXHRcdFx0dGhpcy5lbnRlcigncHJlLWxvYWRpbmcnKTtcclxuXHRcdFx0ZWxlbWVudCA9ICQoZWxlbWVudCk7XHJcblx0XHRcdCQobmV3IEltYWdlKCkpLm9uZSgnbG9hZCcsICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGVsZW1lbnQuYXR0cignc3JjJywgZS50YXJnZXQuc3JjKTtcclxuXHRcdFx0XHRlbGVtZW50LmNzcygnb3BhY2l0eScsIDEpO1xyXG5cdFx0XHRcdHRoaXMubGVhdmUoJ3ByZS1sb2FkaW5nJyk7XHJcblx0XHRcdFx0IXRoaXMuaXMoJ3ByZS1sb2FkaW5nJykgJiYgIXRoaXMuaXMoJ2luaXRpYWxpemluZycpICYmIHRoaXMucmVmcmVzaCgpO1xyXG5cdFx0XHR9LCB0aGlzKSkuYXR0cignc3JjJywgZWxlbWVudC5hdHRyKCdzcmMnKSB8fCBlbGVtZW50LmF0dHIoJ2RhdGEtc3JjJykgfHwgZWxlbWVudC5hdHRyKCdkYXRhLXNyYy1yZXRpbmEnKSk7XHJcblx0XHR9LCB0aGlzKSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGVzdHJveXMgdGhlIGNhcm91c2VsLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0XHR0aGlzLiRlbGVtZW50Lm9mZignLm93bC5jb3JlJyk7XHJcblx0XHR0aGlzLiRzdGFnZS5vZmYoJy5vd2wuY29yZScpO1xyXG5cdFx0JChkb2N1bWVudCkub2ZmKCcub3dsLmNvcmUnKTtcclxuXHJcblx0XHRpZiAodGhpcy5zZXR0aW5ncy5yZXNwb25zaXZlICE9PSBmYWxzZSkge1xyXG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMucmVzaXplVGltZXIpO1xyXG5cdFx0XHR0aGlzLm9mZih3aW5kb3csICdyZXNpemUnLCB0aGlzLl9oYW5kbGVycy5vblRocm90dGxlZFJlc2l6ZSk7XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yICh2YXIgaSBpbiB0aGlzLl9wbHVnaW5zKSB7XHJcblx0XHRcdHRoaXMuX3BsdWdpbnNbaV0uZGVzdHJveSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuJHN0YWdlLmNoaWxkcmVuKCcuY2xvbmVkJykucmVtb3ZlKCk7XHJcblxyXG5cdFx0dGhpcy4kc3RhZ2UudW53cmFwKCk7XHJcblx0XHR0aGlzLiRzdGFnZS5jaGlsZHJlbigpLmNvbnRlbnRzKCkudW53cmFwKCk7XHJcblx0XHR0aGlzLiRzdGFnZS5jaGlsZHJlbigpLnVud3JhcCgpO1xyXG5cdFx0dGhpcy4kc3RhZ2UucmVtb3ZlKCk7XHJcblx0XHR0aGlzLiRlbGVtZW50XHJcblx0XHRcdC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMucmVmcmVzaENsYXNzKVxyXG5cdFx0XHQucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmxvYWRpbmdDbGFzcylcclxuXHRcdFx0LnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5sb2FkZWRDbGFzcylcclxuXHRcdFx0LnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5ydGxDbGFzcylcclxuXHRcdFx0LnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5kcmFnQ2xhc3MpXHJcblx0XHRcdC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMuZ3JhYkNsYXNzKVxyXG5cdFx0XHQuYXR0cignY2xhc3MnLCB0aGlzLiRlbGVtZW50LmF0dHIoJ2NsYXNzJykucmVwbGFjZShuZXcgUmVnRXhwKHRoaXMub3B0aW9ucy5yZXNwb25zaXZlQ2xhc3MgKyAnLVxcXFxTK1xcXFxzJywgJ2cnKSwgJycpKVxyXG5cdFx0XHQucmVtb3ZlRGF0YSgnb3dsLmNhcm91c2VsJyk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogT3BlcmF0b3JzIHRvIGNhbGN1bGF0ZSByaWdodC10by1sZWZ0IGFuZCBsZWZ0LXRvLXJpZ2h0LlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW2FdIC0gVGhlIGxlZnQgc2lkZSBvcGVyYW5kLlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBbb10gLSBUaGUgb3BlcmF0b3IuXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtiXSAtIFRoZSByaWdodCBzaWRlIG9wZXJhbmQuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5vcCA9IGZ1bmN0aW9uKGEsIG8sIGIpIHtcclxuXHRcdHZhciBydGwgPSB0aGlzLnNldHRpbmdzLnJ0bDtcclxuXHRcdHN3aXRjaCAobykge1xyXG5cdFx0XHRjYXNlICc8JzpcclxuXHRcdFx0XHRyZXR1cm4gcnRsID8gYSA+IGIgOiBhIDwgYjtcclxuXHRcdFx0Y2FzZSAnPic6XHJcblx0XHRcdFx0cmV0dXJuIHJ0bCA/IGEgPCBiIDogYSA+IGI7XHJcblx0XHRcdGNhc2UgJz49JzpcclxuXHRcdFx0XHRyZXR1cm4gcnRsID8gYSA8PSBiIDogYSA+PSBiO1xyXG5cdFx0XHRjYXNlICc8PSc6XHJcblx0XHRcdFx0cmV0dXJuIHJ0bCA/IGEgPj0gYiA6IGEgPD0gYjtcclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBBdHRhY2hlcyB0byBhbiBpbnRlcm5hbCBldmVudC5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbWVudCAtIFRoZSBldmVudCBzb3VyY2UuXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0gVGhlIGV2ZW50IG5hbWUuXHJcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgLSBUaGUgZXZlbnQgaGFuZGxlciB0byBhdHRhY2guXHJcblx0ICogQHBhcmFtIHtCb29sZWFufSBjYXB0dXJlIC0gV2V0aGVyIHRoZSBldmVudCBzaG91bGQgYmUgaGFuZGxlZCBhdCB0aGUgY2FwdHVyaW5nIHBoYXNlIG9yIG5vdC5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oZWxlbWVudCwgZXZlbnQsIGxpc3RlbmVyLCBjYXB0dXJlKSB7XHJcblx0XHRpZiAoZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKSB7XHJcblx0XHRcdGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgbGlzdGVuZXIsIGNhcHR1cmUpO1xyXG5cdFx0fSBlbHNlIGlmIChlbGVtZW50LmF0dGFjaEV2ZW50KSB7XHJcblx0XHRcdGVsZW1lbnQuYXR0YWNoRXZlbnQoJ29uJyArIGV2ZW50LCBsaXN0ZW5lcik7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGV0YWNoZXMgZnJvbSBhbiBpbnRlcm5hbCBldmVudC5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbWVudCAtIFRoZSBldmVudCBzb3VyY2UuXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0gVGhlIGV2ZW50IG5hbWUuXHJcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgLSBUaGUgYXR0YWNoZWQgZXZlbnQgaGFuZGxlciB0byBkZXRhY2guXHJcblx0ICogQHBhcmFtIHtCb29sZWFufSBjYXB0dXJlIC0gV2V0aGVyIHRoZSBhdHRhY2hlZCBldmVudCBoYW5kbGVyIHdhcyByZWdpc3RlcmVkIGFzIGEgY2FwdHVyaW5nIGxpc3RlbmVyIG9yIG5vdC5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uKGVsZW1lbnQsIGV2ZW50LCBsaXN0ZW5lciwgY2FwdHVyZSkge1xyXG5cdFx0aWYgKGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcikge1xyXG5cdFx0XHRlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGxpc3RlbmVyLCBjYXB0dXJlKTtcclxuXHRcdH0gZWxzZSBpZiAoZWxlbWVudC5kZXRhY2hFdmVudCkge1xyXG5cdFx0XHRlbGVtZW50LmRldGFjaEV2ZW50KCdvbicgKyBldmVudCwgbGlzdGVuZXIpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRyaWdnZXJzIGEgcHVibGljIGV2ZW50LlxyXG5cdCAqIEB0b2RvIFJlbW92ZSBgc3RhdHVzYCwgYHJlbGF0ZWRUYXJnZXRgIHNob3VsZCBiZSB1c2VkIGluc3RlYWQuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIC0gVGhlIGV2ZW50IG5hbWUuXHJcblx0ICogQHBhcmFtIHsqfSBbZGF0YT1udWxsXSAtIFRoZSBldmVudCBkYXRhLlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBbbmFtZXNwYWNlPWNhcm91c2VsXSAtIFRoZSBldmVudCBuYW1lc3BhY2UuXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IFtzdGF0ZV0gLSBUaGUgc3RhdGUgd2hpY2ggaXMgYXNzb2NpYXRlZCB3aXRoIHRoZSBldmVudC5cclxuXHQgKiBAcGFyYW0ge0Jvb2xlYW59IFtlbnRlcj1mYWxzZV0gLSBJbmRpY2F0ZXMgaWYgdGhlIGNhbGwgZW50ZXJzIHRoZSBzcGVjaWZpZWQgc3RhdGUgb3Igbm90LlxyXG5cdCAqIEByZXR1cm5zIHtFdmVudH0gLSBUaGUgZXZlbnQgYXJndW1lbnRzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUudHJpZ2dlciA9IGZ1bmN0aW9uKG5hbWUsIGRhdGEsIG5hbWVzcGFjZSwgc3RhdGUsIGVudGVyKSB7XHJcblx0XHR2YXIgc3RhdHVzID0ge1xyXG5cdFx0XHRpdGVtOiB7IGNvdW50OiB0aGlzLl9pdGVtcy5sZW5ndGgsIGluZGV4OiB0aGlzLmN1cnJlbnQoKSB9XHJcblx0XHR9LCBoYW5kbGVyID0gJC5jYW1lbENhc2UoXHJcblx0XHRcdCQuZ3JlcChbICdvbicsIG5hbWUsIG5hbWVzcGFjZSBdLCBmdW5jdGlvbih2KSB7IHJldHVybiB2IH0pXHJcblx0XHRcdFx0LmpvaW4oJy0nKS50b0xvd2VyQ2FzZSgpXHJcblx0XHQpLCBldmVudCA9ICQuRXZlbnQoXHJcblx0XHRcdFsgbmFtZSwgJ293bCcsIG5hbWVzcGFjZSB8fCAnY2Fyb3VzZWwnIF0uam9pbignLicpLnRvTG93ZXJDYXNlKCksXHJcblx0XHRcdCQuZXh0ZW5kKHsgcmVsYXRlZFRhcmdldDogdGhpcyB9LCBzdGF0dXMsIGRhdGEpXHJcblx0XHQpO1xyXG5cclxuXHRcdGlmICghdGhpcy5fc3VwcmVzc1tuYW1lXSkge1xyXG5cdFx0XHQkLmVhY2godGhpcy5fcGx1Z2lucywgZnVuY3Rpb24obmFtZSwgcGx1Z2luKSB7XHJcblx0XHRcdFx0aWYgKHBsdWdpbi5vblRyaWdnZXIpIHtcclxuXHRcdFx0XHRcdHBsdWdpbi5vblRyaWdnZXIoZXZlbnQpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHR0aGlzLnJlZ2lzdGVyKHsgdHlwZTogT3dsLlR5cGUuRXZlbnQsIG5hbWU6IG5hbWUgfSk7XHJcblx0XHRcdHRoaXMuJGVsZW1lbnQudHJpZ2dlcihldmVudCk7XHJcblxyXG5cdFx0XHRpZiAodGhpcy5zZXR0aW5ncyAmJiB0eXBlb2YgdGhpcy5zZXR0aW5nc1toYW5kbGVyXSA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRcdHRoaXMuc2V0dGluZ3NbaGFuZGxlcl0uY2FsbCh0aGlzLCBldmVudCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZXZlbnQ7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRW50ZXJzIGEgc3RhdGUuXHJcblx0ICogQHBhcmFtIG5hbWUgLSBUaGUgc3RhdGUgbmFtZS5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmVudGVyID0gZnVuY3Rpb24obmFtZSkge1xyXG5cdFx0JC5lYWNoKFsgbmFtZSBdLmNvbmNhdCh0aGlzLl9zdGF0ZXMudGFnc1tuYW1lXSB8fCBbXSksICQucHJveHkoZnVuY3Rpb24oaSwgbmFtZSkge1xyXG5cdFx0XHRpZiAodGhpcy5fc3RhdGVzLmN1cnJlbnRbbmFtZV0gPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRcdHRoaXMuX3N0YXRlcy5jdXJyZW50W25hbWVdID0gMDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5fc3RhdGVzLmN1cnJlbnRbbmFtZV0rKztcclxuXHRcdH0sIHRoaXMpKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBMZWF2ZXMgYSBzdGF0ZS5cclxuXHQgKiBAcGFyYW0gbmFtZSAtIFRoZSBzdGF0ZSBuYW1lLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUubGVhdmUgPSBmdW5jdGlvbihuYW1lKSB7XHJcblx0XHQkLmVhY2goWyBuYW1lIF0uY29uY2F0KHRoaXMuX3N0YXRlcy50YWdzW25hbWVdIHx8IFtdKSwgJC5wcm94eShmdW5jdGlvbihpLCBuYW1lKSB7XHJcblx0XHRcdHRoaXMuX3N0YXRlcy5jdXJyZW50W25hbWVdLS07XHJcblx0XHR9LCB0aGlzKSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUmVnaXN0ZXJzIGFuIGV2ZW50IG9yIHN0YXRlLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IC0gVGhlIGV2ZW50IG9yIHN0YXRlIHRvIHJlZ2lzdGVyLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUucmVnaXN0ZXIgPSBmdW5jdGlvbihvYmplY3QpIHtcclxuXHRcdGlmIChvYmplY3QudHlwZSA9PT0gT3dsLlR5cGUuRXZlbnQpIHtcclxuXHRcdFx0aWYgKCEkLmV2ZW50LnNwZWNpYWxbb2JqZWN0Lm5hbWVdKSB7XHJcblx0XHRcdFx0JC5ldmVudC5zcGVjaWFsW29iamVjdC5uYW1lXSA9IHt9O1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoISQuZXZlbnQuc3BlY2lhbFtvYmplY3QubmFtZV0ub3dsKSB7XHJcblx0XHRcdFx0dmFyIF9kZWZhdWx0ID0gJC5ldmVudC5zcGVjaWFsW29iamVjdC5uYW1lXS5fZGVmYXVsdDtcclxuXHRcdFx0XHQkLmV2ZW50LnNwZWNpYWxbb2JqZWN0Lm5hbWVdLl9kZWZhdWx0ID0gZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdFx0aWYgKF9kZWZhdWx0ICYmIF9kZWZhdWx0LmFwcGx5ICYmICghZS5uYW1lc3BhY2UgfHwgZS5uYW1lc3BhY2UuaW5kZXhPZignb3dsJykgPT09IC0xKSkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gX2RlZmF1bHQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJldHVybiBlLm5hbWVzcGFjZSAmJiBlLm5hbWVzcGFjZS5pbmRleE9mKCdvd2wnKSA+IC0xO1xyXG5cdFx0XHRcdH07XHJcblx0XHRcdFx0JC5ldmVudC5zcGVjaWFsW29iamVjdC5uYW1lXS5vd2wgPSB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2UgaWYgKG9iamVjdC50eXBlID09PSBPd2wuVHlwZS5TdGF0ZSkge1xyXG5cdFx0XHRpZiAoIXRoaXMuX3N0YXRlcy50YWdzW29iamVjdC5uYW1lXSkge1xyXG5cdFx0XHRcdHRoaXMuX3N0YXRlcy50YWdzW29iamVjdC5uYW1lXSA9IG9iamVjdC50YWdzO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHRoaXMuX3N0YXRlcy50YWdzW29iamVjdC5uYW1lXSA9IHRoaXMuX3N0YXRlcy50YWdzW29iamVjdC5uYW1lXS5jb25jYXQob2JqZWN0LnRhZ3MpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLl9zdGF0ZXMudGFnc1tvYmplY3QubmFtZV0gPSAkLmdyZXAodGhpcy5fc3RhdGVzLnRhZ3Nbb2JqZWN0Lm5hbWVdLCAkLnByb3h5KGZ1bmN0aW9uKHRhZywgaSkge1xyXG5cdFx0XHRcdHJldHVybiAkLmluQXJyYXkodGFnLCB0aGlzLl9zdGF0ZXMudGFnc1tvYmplY3QubmFtZV0pID09PSBpO1xyXG5cdFx0XHR9LCB0aGlzKSk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU3VwcHJlc3NlcyBldmVudHMuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7QXJyYXkuPFN0cmluZz59IGV2ZW50cyAtIFRoZSBldmVudHMgdG8gc3VwcHJlc3MuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5zdXBwcmVzcyA9IGZ1bmN0aW9uKGV2ZW50cykge1xyXG5cdFx0JC5lYWNoKGV2ZW50cywgJC5wcm94eShmdW5jdGlvbihpbmRleCwgZXZlbnQpIHtcclxuXHRcdFx0dGhpcy5fc3VwcmVzc1tldmVudF0gPSB0cnVlO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbGVhc2VzIHN1cHByZXNzZWQgZXZlbnRzLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge0FycmF5LjxTdHJpbmc+fSBldmVudHMgLSBUaGUgZXZlbnRzIHRvIHJlbGVhc2UuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5yZWxlYXNlID0gZnVuY3Rpb24oZXZlbnRzKSB7XHJcblx0XHQkLmVhY2goZXZlbnRzLCAkLnByb3h5KGZ1bmN0aW9uKGluZGV4LCBldmVudCkge1xyXG5cdFx0XHRkZWxldGUgdGhpcy5fc3VwcmVzc1tldmVudF07XHJcblx0XHR9LCB0aGlzKSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0cyB1bmlmaWVkIHBvaW50ZXIgY29vcmRpbmF0ZXMgZnJvbSBldmVudC5cclxuXHQgKiBAdG9kbyAjMjYxXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7RXZlbnR9IC0gVGhlIGBtb3VzZWRvd25gIG9yIGB0b3VjaHN0YXJ0YCBldmVudC5cclxuXHQgKiBAcmV0dXJucyB7T2JqZWN0fSAtIENvbnRhaW5zIGB4YCBhbmQgYHlgIGNvb3JkaW5hdGVzIG9mIGN1cnJlbnQgcG9pbnRlciBwb3NpdGlvbi5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnBvaW50ZXIgPSBmdW5jdGlvbihldmVudCkge1xyXG5cdFx0dmFyIHJlc3VsdCA9IHsgeDogbnVsbCwgeTogbnVsbCB9O1xyXG5cclxuXHRcdGV2ZW50ID0gZXZlbnQub3JpZ2luYWxFdmVudCB8fCBldmVudCB8fCB3aW5kb3cuZXZlbnQ7XHJcblxyXG5cdFx0ZXZlbnQgPSBldmVudC50b3VjaGVzICYmIGV2ZW50LnRvdWNoZXMubGVuZ3RoID9cclxuXHRcdFx0ZXZlbnQudG91Y2hlc1swXSA6IGV2ZW50LmNoYW5nZWRUb3VjaGVzICYmIGV2ZW50LmNoYW5nZWRUb3VjaGVzLmxlbmd0aCA/XHJcblx0XHRcdFx0ZXZlbnQuY2hhbmdlZFRvdWNoZXNbMF0gOiBldmVudDtcclxuXHJcblx0XHRpZiAoZXZlbnQucGFnZVgpIHtcclxuXHRcdFx0cmVzdWx0LnggPSBldmVudC5wYWdlWDtcclxuXHRcdFx0cmVzdWx0LnkgPSBldmVudC5wYWdlWTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHJlc3VsdC54ID0gZXZlbnQuY2xpZW50WDtcclxuXHRcdFx0cmVzdWx0LnkgPSBldmVudC5jbGllbnRZO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiByZXN1bHQ7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGV0ZXJtaW5lcyBpZiB0aGUgaW5wdXQgaXMgYSBOdW1iZXIgb3Igc29tZXRoaW5nIHRoYXQgY2FuIGJlIGNvZXJjZWQgdG8gYSBOdW1iZXJcclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ8U3RyaW5nfE9iamVjdHxBcnJheXxCb29sZWFufFJlZ0V4cHxGdW5jdGlvbnxTeW1ib2x9IC0gVGhlIGlucHV0IHRvIGJlIHRlc3RlZFxyXG5cdCAqIEByZXR1cm5zIHtCb29sZWFufSAtIEFuIGluZGljYXRpb24gaWYgdGhlIGlucHV0IGlzIGEgTnVtYmVyIG9yIGNhbiBiZSBjb2VyY2VkIHRvIGEgTnVtYmVyXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5pc051bWVyaWMgPSBmdW5jdGlvbihudW1iZXIpIHtcclxuXHRcdHJldHVybiAhaXNOYU4ocGFyc2VGbG9hdChudW1iZXIpKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXRzIHRoZSBkaWZmZXJlbmNlIG9mIHR3byB2ZWN0b3JzLlxyXG5cdCAqIEB0b2RvICMyNjFcclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IC0gVGhlIGZpcnN0IHZlY3Rvci5cclxuXHQgKiBAcGFyYW0ge09iamVjdH0gLSBUaGUgc2Vjb25kIHZlY3Rvci5cclxuXHQgKiBAcmV0dXJucyB7T2JqZWN0fSAtIFRoZSBkaWZmZXJlbmNlLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuZGlmZmVyZW5jZSA9IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQpIHtcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHg6IGZpcnN0LnggLSBzZWNvbmQueCxcclxuXHRcdFx0eTogZmlyc3QueSAtIHNlY29uZC55XHJcblx0XHR9O1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRoZSBqUXVlcnkgUGx1Z2luIGZvciB0aGUgT3dsIENhcm91c2VsXHJcblx0ICogQHRvZG8gTmF2aWdhdGlvbiBwbHVnaW4gYG5leHRgIGFuZCBgcHJldmBcclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0JC5mbi5vd2xDYXJvdXNlbCA9IGZ1bmN0aW9uKG9wdGlvbikge1xyXG5cdFx0dmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xyXG5cclxuXHRcdHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciAkdGhpcyA9ICQodGhpcyksXHJcblx0XHRcdFx0ZGF0YSA9ICR0aGlzLmRhdGEoJ293bC5jYXJvdXNlbCcpO1xyXG5cclxuXHRcdFx0aWYgKCFkYXRhKSB7XHJcblx0XHRcdFx0ZGF0YSA9IG5ldyBPd2wodGhpcywgdHlwZW9mIG9wdGlvbiA9PSAnb2JqZWN0JyAmJiBvcHRpb24pO1xyXG5cdFx0XHRcdCR0aGlzLmRhdGEoJ293bC5jYXJvdXNlbCcsIGRhdGEpO1xyXG5cclxuXHRcdFx0XHQkLmVhY2goW1xyXG5cdFx0XHRcdFx0J25leHQnLCAncHJldicsICd0bycsICdkZXN0cm95JywgJ3JlZnJlc2gnLCAncmVwbGFjZScsICdhZGQnLCAncmVtb3ZlJ1xyXG5cdFx0XHRcdF0sIGZ1bmN0aW9uKGksIGV2ZW50KSB7XHJcblx0XHRcdFx0XHRkYXRhLnJlZ2lzdGVyKHsgdHlwZTogT3dsLlR5cGUuRXZlbnQsIG5hbWU6IGV2ZW50IH0pO1xyXG5cdFx0XHRcdFx0ZGF0YS4kZWxlbWVudC5vbihldmVudCArICcub3dsLmNhcm91c2VsLmNvcmUnLCAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIGUucmVsYXRlZFRhcmdldCAhPT0gdGhpcykge1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMuc3VwcHJlc3MoWyBldmVudCBdKTtcclxuXHRcdFx0XHRcdFx0XHRkYXRhW2V2ZW50XS5hcHBseSh0aGlzLCBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMucmVsZWFzZShbIGV2ZW50IF0pO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9LCBkYXRhKSk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICh0eXBlb2Ygb3B0aW9uID09ICdzdHJpbmcnICYmIG9wdGlvbi5jaGFyQXQoMCkgIT09ICdfJykge1xyXG5cdFx0XHRcdGRhdGFbb3B0aW9uXS5hcHBseShkYXRhLCBhcmdzKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogVGhlIGNvbnN0cnVjdG9yIGZvciB0aGUgalF1ZXJ5IFBsdWdpblxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHQkLmZuLm93bENhcm91c2VsLkNvbnN0cnVjdG9yID0gT3dsO1xyXG5cclxufSkod2luZG93LlplcHRvIHx8IHdpbmRvdy5qUXVlcnksIHdpbmRvdywgZG9jdW1lbnQpO1xyXG5cclxuLyoqXHJcbiAqIEF1dG9SZWZyZXNoIFBsdWdpblxyXG4gKiBAdmVyc2lvbiAyLjMuM1xyXG4gKiBAYXV0aG9yIEFydHVzIEtvbGFub3dza2lcclxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXHJcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4gKi9cclxuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlcyB0aGUgYXV0byByZWZyZXNoIHBsdWdpbi5cclxuXHQgKiBAY2xhc3MgVGhlIEF1dG8gUmVmcmVzaCBQbHVnaW5cclxuXHQgKiBAcGFyYW0ge093bH0gY2Fyb3VzZWwgLSBUaGUgT3dsIENhcm91c2VsXHJcblx0ICovXHJcblx0dmFyIEF1dG9SZWZyZXNoID0gZnVuY3Rpb24oY2Fyb3VzZWwpIHtcclxuXHRcdC8qKlxyXG5cdFx0ICogUmVmZXJlbmNlIHRvIHRoZSBjb3JlLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge093bH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY29yZSA9IGNhcm91c2VsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVmcmVzaCBpbnRlcnZhbC5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtudW1iZXJ9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2ludGVydmFsID0gbnVsbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFdoZXRoZXIgdGhlIGVsZW1lbnQgaXMgY3VycmVudGx5IHZpc2libGUgb3Igbm90LlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge0Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX3Zpc2libGUgPSBudWxsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWxsIGV2ZW50IGhhbmRsZXJzLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5faGFuZGxlcnMgPSB7XHJcblx0XHRcdCdpbml0aWFsaXplZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvUmVmcmVzaCkge1xyXG5cdFx0XHRcdFx0dGhpcy53YXRjaCgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcylcclxuXHRcdH07XHJcblxyXG5cdFx0Ly8gc2V0IGRlZmF1bHQgb3B0aW9uc1xyXG5cdFx0dGhpcy5fY29yZS5vcHRpb25zID0gJC5leHRlbmQoe30sIEF1dG9SZWZyZXNoLkRlZmF1bHRzLCB0aGlzLl9jb3JlLm9wdGlvbnMpO1xyXG5cclxuXHRcdC8vIHJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzXHJcblx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9uKHRoaXMuX2hhbmRsZXJzKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdEF1dG9SZWZyZXNoLkRlZmF1bHRzID0ge1xyXG5cdFx0YXV0b1JlZnJlc2g6IHRydWUsXHJcblx0XHRhdXRvUmVmcmVzaEludGVydmFsOiA1MDBcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBXYXRjaGVzIHRoZSBlbGVtZW50LlxyXG5cdCAqL1xyXG5cdEF1dG9SZWZyZXNoLnByb3RvdHlwZS53YXRjaCA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0aWYgKHRoaXMuX2ludGVydmFsKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl92aXNpYmxlID0gdGhpcy5fY29yZS5pc1Zpc2libGUoKTtcclxuXHRcdHRoaXMuX2ludGVydmFsID0gd2luZG93LnNldEludGVydmFsKCQucHJveHkodGhpcy5yZWZyZXNoLCB0aGlzKSwgdGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvUmVmcmVzaEludGVydmFsKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBSZWZyZXNoZXMgdGhlIGVsZW1lbnQuXHJcblx0ICovXHJcblx0QXV0b1JlZnJlc2gucHJvdG90eXBlLnJlZnJlc2ggPSBmdW5jdGlvbigpIHtcclxuXHRcdGlmICh0aGlzLl9jb3JlLmlzVmlzaWJsZSgpID09PSB0aGlzLl92aXNpYmxlKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl92aXNpYmxlID0gIXRoaXMuX3Zpc2libGU7XHJcblxyXG5cdFx0dGhpcy5fY29yZS4kZWxlbWVudC50b2dnbGVDbGFzcygnb3dsLWhpZGRlbicsICF0aGlzLl92aXNpYmxlKTtcclxuXHJcblx0XHR0aGlzLl92aXNpYmxlICYmICh0aGlzLl9jb3JlLmludmFsaWRhdGUoJ3dpZHRoJykgJiYgdGhpcy5fY29yZS5yZWZyZXNoKCkpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlc3Ryb3lzIHRoZSBwbHVnaW4uXHJcblx0ICovXHJcblx0QXV0b1JlZnJlc2gucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBoYW5kbGVyLCBwcm9wZXJ0eTtcclxuXHJcblx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLl9pbnRlcnZhbCk7XHJcblxyXG5cdFx0Zm9yIChoYW5kbGVyIGluIHRoaXMuX2hhbmRsZXJzKSB7XHJcblx0XHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub2ZmKGhhbmRsZXIsIHRoaXMuX2hhbmRsZXJzW2hhbmRsZXJdKTtcclxuXHRcdH1cclxuXHRcdGZvciAocHJvcGVydHkgaW4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGhpcykpIHtcclxuXHRcdFx0dHlwZW9mIHRoaXNbcHJvcGVydHldICE9ICdmdW5jdGlvbicgJiYgKHRoaXNbcHJvcGVydHldID0gbnVsbCk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0JC5mbi5vd2xDYXJvdXNlbC5Db25zdHJ1Y3Rvci5QbHVnaW5zLkF1dG9SZWZyZXNoID0gQXV0b1JlZnJlc2g7XHJcblxyXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7XHJcblxyXG4vKipcclxuICogTGF6eSBQbHVnaW5cclxuICogQHZlcnNpb24gMi4zLjNcclxuICogQGF1dGhvciBCYXJ0b3N6IFdvamNpZWNob3dza2lcclxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXHJcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4gKi9cclxuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlcyB0aGUgbGF6eSBwbHVnaW4uXHJcblx0ICogQGNsYXNzIFRoZSBMYXp5IFBsdWdpblxyXG5cdCAqIEBwYXJhbSB7T3dsfSBjYXJvdXNlbCAtIFRoZSBPd2wgQ2Fyb3VzZWxcclxuXHQgKi9cclxuXHR2YXIgTGF6eSA9IGZ1bmN0aW9uKGNhcm91c2VsKSB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZWZlcmVuY2UgdG8gdGhlIGNvcmUuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7T3dsfVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9jb3JlID0gY2Fyb3VzZWw7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBbHJlYWR5IGxvYWRlZCBpdGVtcy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtBcnJheS48alF1ZXJ5Pn1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fbG9hZGVkID0gW107XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFdmVudCBoYW5kbGVycy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2hhbmRsZXJzID0ge1xyXG5cdFx0XHQnaW5pdGlhbGl6ZWQub3dsLmNhcm91c2VsIGNoYW5nZS5vd2wuY2Fyb3VzZWwgcmVzaXplZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoIWUubmFtZXNwYWNlKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoIXRoaXMuX2NvcmUuc2V0dGluZ3MgfHwgIXRoaXMuX2NvcmUuc2V0dGluZ3MubGF6eUxvYWQpIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICgoZS5wcm9wZXJ0eSAmJiBlLnByb3BlcnR5Lm5hbWUgPT0gJ3Bvc2l0aW9uJykgfHwgZS50eXBlID09ICdpbml0aWFsaXplZCcpIHtcclxuXHRcdFx0XHRcdHZhciBzZXR0aW5ncyA9IHRoaXMuX2NvcmUuc2V0dGluZ3MsXHJcblx0XHRcdFx0XHRcdG4gPSAoc2V0dGluZ3MuY2VudGVyICYmIE1hdGguY2VpbChzZXR0aW5ncy5pdGVtcyAvIDIpIHx8IHNldHRpbmdzLml0ZW1zKSxcclxuXHRcdFx0XHRcdFx0aSA9ICgoc2V0dGluZ3MuY2VudGVyICYmIG4gKiAtMSkgfHwgMCksXHJcblx0XHRcdFx0XHRcdHBvc2l0aW9uID0gKGUucHJvcGVydHkgJiYgZS5wcm9wZXJ0eS52YWx1ZSAhPT0gdW5kZWZpbmVkID8gZS5wcm9wZXJ0eS52YWx1ZSA6IHRoaXMuX2NvcmUuY3VycmVudCgpKSArIGksXHJcblx0XHRcdFx0XHRcdGNsb25lcyA9IHRoaXMuX2NvcmUuY2xvbmVzKCkubGVuZ3RoLFxyXG5cdFx0XHRcdFx0XHRsb2FkID0gJC5wcm94eShmdW5jdGlvbihpLCB2KSB7IHRoaXMubG9hZCh2KSB9LCB0aGlzKTtcclxuXHJcblx0XHRcdFx0XHR3aGlsZSAoaSsrIDwgbikge1xyXG5cdFx0XHRcdFx0XHR0aGlzLmxvYWQoY2xvbmVzIC8gMiArIHRoaXMuX2NvcmUucmVsYXRpdmUocG9zaXRpb24pKTtcclxuXHRcdFx0XHRcdFx0Y2xvbmVzICYmICQuZWFjaCh0aGlzLl9jb3JlLmNsb25lcyh0aGlzLl9jb3JlLnJlbGF0aXZlKHBvc2l0aW9uKSksIGxvYWQpO1xyXG5cdFx0XHRcdFx0XHRwb3NpdGlvbisrO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcylcclxuXHRcdH07XHJcblxyXG5cdFx0Ly8gc2V0IHRoZSBkZWZhdWx0IG9wdGlvbnNcclxuXHRcdHRoaXMuX2NvcmUub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBMYXp5LkRlZmF1bHRzLCB0aGlzLl9jb3JlLm9wdGlvbnMpO1xyXG5cclxuXHRcdC8vIHJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJcclxuXHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub24odGhpcy5faGFuZGxlcnMpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlZmF1bHQgb3B0aW9ucy5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0TGF6eS5EZWZhdWx0cyA9IHtcclxuXHRcdGxhenlMb2FkOiBmYWxzZVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIExvYWRzIGFsbCByZXNvdXJjZXMgb2YgYW4gaXRlbSBhdCB0aGUgc3BlY2lmaWVkIHBvc2l0aW9uLlxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBwb3NpdGlvbiAtIFRoZSBhYnNvbHV0ZSBwb3NpdGlvbiBvZiB0aGUgaXRlbS5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICovXHJcblx0TGF6eS5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XHJcblx0XHR2YXIgJGl0ZW0gPSB0aGlzLl9jb3JlLiRzdGFnZS5jaGlsZHJlbigpLmVxKHBvc2l0aW9uKSxcclxuXHRcdFx0JGVsZW1lbnRzID0gJGl0ZW0gJiYgJGl0ZW0uZmluZCgnLm93bC1sYXp5Jyk7XHJcblxyXG5cdFx0aWYgKCEkZWxlbWVudHMgfHwgJC5pbkFycmF5KCRpdGVtLmdldCgwKSwgdGhpcy5fbG9hZGVkKSA+IC0xKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkZWxlbWVudHMuZWFjaCgkLnByb3h5KGZ1bmN0aW9uKGluZGV4LCBlbGVtZW50KSB7XHJcblx0XHRcdHZhciAkZWxlbWVudCA9ICQoZWxlbWVudCksIGltYWdlLFxyXG4gICAgICAgICAgICAgICAgdXJsID0gKHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvID4gMSAmJiAkZWxlbWVudC5hdHRyKCdkYXRhLXNyYy1yZXRpbmEnKSkgfHwgJGVsZW1lbnQuYXR0cignZGF0YS1zcmMnKSB8fCAkZWxlbWVudC5hdHRyKCdkYXRhLXNyY3NldCcpO1xyXG5cclxuXHRcdFx0dGhpcy5fY29yZS50cmlnZ2VyKCdsb2FkJywgeyBlbGVtZW50OiAkZWxlbWVudCwgdXJsOiB1cmwgfSwgJ2xhenknKTtcclxuXHJcblx0XHRcdGlmICgkZWxlbWVudC5pcygnaW1nJykpIHtcclxuXHRcdFx0XHQkZWxlbWVudC5vbmUoJ2xvYWQub3dsLmxhenknLCAkLnByb3h5KGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0JGVsZW1lbnQuY3NzKCdvcGFjaXR5JywgMSk7XHJcblx0XHRcdFx0XHR0aGlzLl9jb3JlLnRyaWdnZXIoJ2xvYWRlZCcsIHsgZWxlbWVudDogJGVsZW1lbnQsIHVybDogdXJsIH0sICdsYXp5Jyk7XHJcblx0XHRcdFx0fSwgdGhpcykpLmF0dHIoJ3NyYycsIHVybCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoJGVsZW1lbnQuaXMoJ3NvdXJjZScpKSB7XHJcbiAgICAgICAgICAgICAgICAkZWxlbWVudC5vbmUoJ2xvYWQub3dsLmxhenknLCAkLnByb3h5KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NvcmUudHJpZ2dlcignbG9hZGVkJywgeyBlbGVtZW50OiAkZWxlbWVudCwgdXJsOiB1cmwgfSwgJ2xhenknKTtcclxuICAgICAgICAgICAgICAgIH0sIHRoaXMpKS5hdHRyKCdzcmNzZXQnLCB1cmwpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGltYWdlID0gbmV3IEltYWdlKCk7XHJcblx0XHRcdFx0aW1hZ2Uub25sb2FkID0gJC5wcm94eShmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdCRlbGVtZW50LmNzcyh7XHJcblx0XHRcdFx0XHRcdCdiYWNrZ3JvdW5kLWltYWdlJzogJ3VybChcIicgKyB1cmwgKyAnXCIpJyxcclxuXHRcdFx0XHRcdFx0J29wYWNpdHknOiAnMSdcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdFx0dGhpcy5fY29yZS50cmlnZ2VyKCdsb2FkZWQnLCB7IGVsZW1lbnQ6ICRlbGVtZW50LCB1cmw6IHVybCB9LCAnbGF6eScpO1xyXG5cdFx0XHRcdH0sIHRoaXMpO1xyXG5cdFx0XHRcdGltYWdlLnNyYyA9IHVybDtcclxuXHRcdFx0fVxyXG5cdFx0fSwgdGhpcykpO1xyXG5cclxuXHRcdHRoaXMuX2xvYWRlZC5wdXNoKCRpdGVtLmdldCgwKSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGVzdHJveXMgdGhlIHBsdWdpbi5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0TGF6eS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGhhbmRsZXIsIHByb3BlcnR5O1xyXG5cclxuXHRcdGZvciAoaGFuZGxlciBpbiB0aGlzLmhhbmRsZXJzKSB7XHJcblx0XHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub2ZmKGhhbmRsZXIsIHRoaXMuaGFuZGxlcnNbaGFuZGxlcl0pO1xyXG5cdFx0fVxyXG5cdFx0Zm9yIChwcm9wZXJ0eSBpbiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0aGlzKSkge1xyXG5cdFx0XHR0eXBlb2YgdGhpc1twcm9wZXJ0eV0gIT0gJ2Z1bmN0aW9uJyAmJiAodGhpc1twcm9wZXJ0eV0gPSBudWxsKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQkLmZuLm93bENhcm91c2VsLkNvbnN0cnVjdG9yLlBsdWdpbnMuTGF6eSA9IExhenk7XHJcblxyXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7XHJcblxyXG4vKipcclxuICogQXV0b0hlaWdodCBQbHVnaW5cclxuICogQHZlcnNpb24gMi4zLjNcclxuICogQGF1dGhvciBCYXJ0b3N6IFdvamNpZWNob3dza2lcclxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXHJcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4gKi9cclxuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlcyB0aGUgYXV0byBoZWlnaHQgcGx1Z2luLlxyXG5cdCAqIEBjbGFzcyBUaGUgQXV0byBIZWlnaHQgUGx1Z2luXHJcblx0ICogQHBhcmFtIHtPd2x9IGNhcm91c2VsIC0gVGhlIE93bCBDYXJvdXNlbFxyXG5cdCAqL1xyXG5cdHZhciBBdXRvSGVpZ2h0ID0gZnVuY3Rpb24oY2Fyb3VzZWwpIHtcclxuXHRcdC8qKlxyXG5cdFx0ICogUmVmZXJlbmNlIHRvIHRoZSBjb3JlLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge093bH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY29yZSA9IGNhcm91c2VsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWxsIGV2ZW50IGhhbmRsZXJzLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5faGFuZGxlcnMgPSB7XHJcblx0XHRcdCdpbml0aWFsaXplZC5vd2wuY2Fyb3VzZWwgcmVmcmVzaGVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiB0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9IZWlnaHQpIHtcclxuXHRcdFx0XHRcdHRoaXMudXBkYXRlKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J2NoYW5nZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b0hlaWdodCAmJiBlLnByb3BlcnR5Lm5hbWUgPT09ICdwb3NpdGlvbicpe1xyXG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJ3VwZGF0ZSBjYWxsZWQnKTtcclxuXHRcdFx0XHRcdHRoaXMudXBkYXRlKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J2xvYWRlZC5vd2wubGF6eSc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiB0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9IZWlnaHRcclxuXHRcdFx0XHRcdCYmIGUuZWxlbWVudC5jbG9zZXN0KCcuJyArIHRoaXMuX2NvcmUuc2V0dGluZ3MuaXRlbUNsYXNzKS5pbmRleCgpID09PSB0aGlzLl9jb3JlLmN1cnJlbnQoKSkge1xyXG5cdFx0XHRcdFx0dGhpcy51cGRhdGUoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpXHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcclxuXHRcdHRoaXMuX2NvcmUub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBBdXRvSGVpZ2h0LkRlZmF1bHRzLCB0aGlzLl9jb3JlLm9wdGlvbnMpO1xyXG5cclxuXHRcdC8vIHJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzXHJcblx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9uKHRoaXMuX2hhbmRsZXJzKTtcclxuXHRcdHRoaXMuX2ludGVydmFsSWQgPSBudWxsO1xyXG5cdFx0dmFyIHJlZlRoaXMgPSB0aGlzO1xyXG5cclxuXHRcdC8vIFRoZXNlIGNoYW5nZXMgaGF2ZSBiZWVuIHRha2VuIGZyb20gYSBQUiBieSBnYXZyb2NoZWxlZ25vdSBwcm9wb3NlZCBpbiAjMTU3NVxyXG5cdFx0Ly8gYW5kIGhhdmUgYmVlbiBtYWRlIGNvbXBhdGlibGUgd2l0aCB0aGUgbGF0ZXN0IGpRdWVyeSB2ZXJzaW9uXHJcblx0XHQkKHdpbmRvdykub24oJ2xvYWQnLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0aWYgKHJlZlRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b0hlaWdodCkge1xyXG5cdFx0XHRcdHJlZlRoaXMudXBkYXRlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdC8vIEF1dG9yZXNpemUgdGhlIGhlaWdodCBvZiB0aGUgY2Fyb3VzZWwgd2hlbiB3aW5kb3cgaXMgcmVzaXplZFxyXG5cdFx0Ly8gV2hlbiBjYXJvdXNlbCBoYXMgaW1hZ2VzLCB0aGUgaGVpZ2h0IGlzIGRlcGVuZGVudCBvbiB0aGUgd2lkdGhcclxuXHRcdC8vIGFuZCBzaG91bGQgYWxzbyBjaGFuZ2Ugb24gcmVzaXplXHJcblx0XHQkKHdpbmRvdykucmVzaXplKGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRpZiAocmVmVGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvSGVpZ2h0KSB7XHJcblx0XHRcdFx0aWYgKHJlZlRoaXMuX2ludGVydmFsSWQgIT0gbnVsbCkge1xyXG5cdFx0XHRcdFx0Y2xlYXJUaW1lb3V0KHJlZlRoaXMuX2ludGVydmFsSWQpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmVmVGhpcy5faW50ZXJ2YWxJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRyZWZUaGlzLnVwZGF0ZSgpO1xyXG5cdFx0XHRcdH0sIDI1MCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdEF1dG9IZWlnaHQuRGVmYXVsdHMgPSB7XHJcblx0XHRhdXRvSGVpZ2h0OiBmYWxzZSxcclxuXHRcdGF1dG9IZWlnaHRDbGFzczogJ293bC1oZWlnaHQnXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogVXBkYXRlcyB0aGUgdmlldy5cclxuXHQgKi9cclxuXHRBdXRvSGVpZ2h0LnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBzdGFydCA9IHRoaXMuX2NvcmUuX2N1cnJlbnQsXHJcblx0XHRcdGVuZCA9IHN0YXJ0ICsgdGhpcy5fY29yZS5zZXR0aW5ncy5pdGVtcyxcclxuXHRcdFx0dmlzaWJsZSA9IHRoaXMuX2NvcmUuJHN0YWdlLmNoaWxkcmVuKCkudG9BcnJheSgpLnNsaWNlKHN0YXJ0LCBlbmQpLFxyXG5cdFx0XHRoZWlnaHRzID0gW10sXHJcblx0XHRcdG1heGhlaWdodCA9IDA7XHJcblxyXG5cdFx0JC5lYWNoKHZpc2libGUsIGZ1bmN0aW9uKGluZGV4LCBpdGVtKSB7XHJcblx0XHRcdGhlaWdodHMucHVzaCgkKGl0ZW0pLmhlaWdodCgpKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdG1heGhlaWdodCA9IE1hdGgubWF4LmFwcGx5KG51bGwsIGhlaWdodHMpO1xyXG5cclxuXHRcdHRoaXMuX2NvcmUuJHN0YWdlLnBhcmVudCgpXHJcblx0XHRcdC5oZWlnaHQobWF4aGVpZ2h0KVxyXG5cdFx0XHQuYWRkQ2xhc3ModGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvSGVpZ2h0Q2xhc3MpO1xyXG5cdH07XHJcblxyXG5cdEF1dG9IZWlnaHQucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBoYW5kbGVyLCBwcm9wZXJ0eTtcclxuXHJcblx0XHRmb3IgKGhhbmRsZXIgaW4gdGhpcy5faGFuZGxlcnMpIHtcclxuXHRcdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vZmYoaGFuZGxlciwgdGhpcy5faGFuZGxlcnNbaGFuZGxlcl0pO1xyXG5cdFx0fVxyXG5cdFx0Zm9yIChwcm9wZXJ0eSBpbiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0aGlzKSkge1xyXG5cdFx0XHR0eXBlb2YgdGhpc1twcm9wZXJ0eV0gIT09ICdmdW5jdGlvbicgJiYgKHRoaXNbcHJvcGVydHldID0gbnVsbCk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0JC5mbi5vd2xDYXJvdXNlbC5Db25zdHJ1Y3Rvci5QbHVnaW5zLkF1dG9IZWlnaHQgPSBBdXRvSGVpZ2h0O1xyXG5cclxufSkod2luZG93LlplcHRvIHx8IHdpbmRvdy5qUXVlcnksIHdpbmRvdywgZG9jdW1lbnQpO1xyXG5cclxuLyoqXHJcbiAqIFZpZGVvIFBsdWdpblxyXG4gKiBAdmVyc2lvbiAyLjMuM1xyXG4gKiBAYXV0aG9yIEJhcnRvc3ogV29qY2llY2hvd3NraVxyXG4gKiBAYXV0aG9yIERhdmlkIERldXRzY2hcclxuICogQGxpY2Vuc2UgVGhlIE1JVCBMaWNlbnNlIChNSVQpXHJcbiAqL1xyXG47KGZ1bmN0aW9uKCQsIHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xyXG5cclxuXHQvKipcclxuXHQgKiBDcmVhdGVzIHRoZSB2aWRlbyBwbHVnaW4uXHJcblx0ICogQGNsYXNzIFRoZSBWaWRlbyBQbHVnaW5cclxuXHQgKiBAcGFyYW0ge093bH0gY2Fyb3VzZWwgLSBUaGUgT3dsIENhcm91c2VsXHJcblx0ICovXHJcblx0dmFyIFZpZGVvID0gZnVuY3Rpb24oY2Fyb3VzZWwpIHtcclxuXHRcdC8qKlxyXG5cdFx0ICogUmVmZXJlbmNlIHRvIHRoZSBjb3JlLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge093bH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY29yZSA9IGNhcm91c2VsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2FjaGUgYWxsIHZpZGVvIFVSTHMuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl92aWRlb3MgPSB7fTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEN1cnJlbnQgcGxheWluZyBpdGVtLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge2pRdWVyeX1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fcGxheWluZyA9IG51bGw7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBbGwgZXZlbnQgaGFuZGxlcnMuXHJcblx0XHQgKiBAdG9kbyBUaGUgY2xvbmVkIGNvbnRlbnQgcmVtb3ZhbGUgaXMgdG9vIGxhdGVcclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2hhbmRsZXJzID0ge1xyXG5cdFx0XHQnaW5pdGlhbGl6ZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlKSB7XHJcblx0XHRcdFx0XHR0aGlzLl9jb3JlLnJlZ2lzdGVyKHsgdHlwZTogJ3N0YXRlJywgbmFtZTogJ3BsYXlpbmcnLCB0YWdzOiBbICdpbnRlcmFjdGluZycgXSB9KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQncmVzaXplLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiB0aGlzLl9jb3JlLnNldHRpbmdzLnZpZGVvICYmIHRoaXMuaXNJbkZ1bGxTY3JlZW4oKSkge1xyXG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdyZWZyZXNoZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuaXMoJ3Jlc2l6aW5nJykpIHtcclxuXHRcdFx0XHRcdHRoaXMuX2NvcmUuJHN0YWdlLmZpbmQoJy5jbG9uZWQgLm93bC12aWRlby1mcmFtZScpLnJlbW92ZSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdjaGFuZ2VkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiBlLnByb3BlcnR5Lm5hbWUgPT09ICdwb3NpdGlvbicgJiYgdGhpcy5fcGxheWluZykge1xyXG5cdFx0XHRcdFx0dGhpcy5zdG9wKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J3ByZXBhcmVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmICghZS5uYW1lc3BhY2UpIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHZhciAkZWxlbWVudCA9ICQoZS5jb250ZW50KS5maW5kKCcub3dsLXZpZGVvJyk7XHJcblxyXG5cdFx0XHRcdGlmICgkZWxlbWVudC5sZW5ndGgpIHtcclxuXHRcdFx0XHRcdCRlbGVtZW50LmNzcygnZGlzcGxheScsICdub25lJyk7XHJcblx0XHRcdFx0XHR0aGlzLmZldGNoKCRlbGVtZW50LCAkKGUuY29udGVudCkpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcylcclxuXHRcdH07XHJcblxyXG5cdFx0Ly8gc2V0IGRlZmF1bHQgb3B0aW9uc1xyXG5cdFx0dGhpcy5fY29yZS5vcHRpb25zID0gJC5leHRlbmQoe30sIFZpZGVvLkRlZmF1bHRzLCB0aGlzLl9jb3JlLm9wdGlvbnMpO1xyXG5cclxuXHRcdC8vIHJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzXHJcblx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9uKHRoaXMuX2hhbmRsZXJzKTtcclxuXHJcblx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9uKCdjbGljay5vd2wudmlkZW8nLCAnLm93bC12aWRlby1wbGF5LWljb24nLCAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0dGhpcy5wbGF5KGUpO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlZmF1bHQgb3B0aW9ucy5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0VmlkZW8uRGVmYXVsdHMgPSB7XHJcblx0XHR2aWRlbzogZmFsc2UsXHJcblx0XHR2aWRlb0hlaWdodDogZmFsc2UsXHJcblx0XHR2aWRlb1dpZHRoOiBmYWxzZVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgdGhlIHZpZGVvIElEIGFuZCB0aGUgdHlwZSAoWW91VHViZS9WaW1lby92emFhciBvbmx5KS5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtqUXVlcnl9IHRhcmdldCAtIFRoZSB0YXJnZXQgY29udGFpbmluZyB0aGUgdmlkZW8gZGF0YS5cclxuXHQgKiBAcGFyYW0ge2pRdWVyeX0gaXRlbSAtIFRoZSBpdGVtIGNvbnRhaW5pbmcgdGhlIHZpZGVvLlxyXG5cdCAqL1xyXG5cdFZpZGVvLnByb3RvdHlwZS5mZXRjaCA9IGZ1bmN0aW9uKHRhcmdldCwgaXRlbSkge1xyXG5cdFx0XHR2YXIgdHlwZSA9IChmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdGlmICh0YXJnZXQuYXR0cignZGF0YS12aW1lby1pZCcpKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiAndmltZW8nO1xyXG5cdFx0XHRcdFx0fSBlbHNlIGlmICh0YXJnZXQuYXR0cignZGF0YS12emFhci1pZCcpKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiAndnphYXInXHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gJ3lvdXR1YmUnO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0pKCksXHJcblx0XHRcdFx0aWQgPSB0YXJnZXQuYXR0cignZGF0YS12aW1lby1pZCcpIHx8IHRhcmdldC5hdHRyKCdkYXRhLXlvdXR1YmUtaWQnKSB8fCB0YXJnZXQuYXR0cignZGF0YS12emFhci1pZCcpLFxyXG5cdFx0XHRcdHdpZHRoID0gdGFyZ2V0LmF0dHIoJ2RhdGEtd2lkdGgnKSB8fCB0aGlzLl9jb3JlLnNldHRpbmdzLnZpZGVvV2lkdGgsXHJcblx0XHRcdFx0aGVpZ2h0ID0gdGFyZ2V0LmF0dHIoJ2RhdGEtaGVpZ2h0JykgfHwgdGhpcy5fY29yZS5zZXR0aW5ncy52aWRlb0hlaWdodCxcclxuXHRcdFx0XHR1cmwgPSB0YXJnZXQuYXR0cignaHJlZicpO1xyXG5cclxuXHRcdGlmICh1cmwpIHtcclxuXHJcblx0XHRcdC8qXHJcblx0XHRcdFx0XHRQYXJzZXMgdGhlIGlkJ3Mgb3V0IG9mIHRoZSBmb2xsb3dpbmcgdXJscyAoYW5kIHByb2JhYmx5IG1vcmUpOlxyXG5cdFx0XHRcdFx0aHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g/dj06aWRcclxuXHRcdFx0XHRcdGh0dHBzOi8veW91dHUuYmUvOmlkXHJcblx0XHRcdFx0XHRodHRwczovL3ZpbWVvLmNvbS86aWRcclxuXHRcdFx0XHRcdGh0dHBzOi8vdmltZW8uY29tL2NoYW5uZWxzLzpjaGFubmVsLzppZFxyXG5cdFx0XHRcdFx0aHR0cHM6Ly92aW1lby5jb20vZ3JvdXBzLzpncm91cC92aWRlb3MvOmlkXHJcblx0XHRcdFx0XHRodHRwczovL2FwcC52emFhci5jb20vdmlkZW9zLzppZFxyXG5cclxuXHRcdFx0XHRcdFZpc3VhbCBleGFtcGxlOiBodHRwczovL3JlZ2V4cGVyLmNvbS8jKGh0dHAlM0ElN0NodHRwcyUzQSU3QyklNUMlMkYlNUMlMkYocGxheWVyLiU3Q3d3dy4lN0NhcHAuKSUzRih2aW1lbyU1Qy5jb20lN0N5b3V0dShiZSU1Qy5jb20lN0MlNUMuYmUlN0NiZSU1Qy5nb29nbGVhcGlzJTVDLmNvbSklN0N2emFhciU1Qy5jb20pJTVDJTJGKHZpZGVvJTVDJTJGJTdDdmlkZW9zJTVDJTJGJTdDZW1iZWQlNUMlMkYlN0NjaGFubmVscyU1QyUyRi4lMkIlNUMlMkYlN0Nncm91cHMlNUMlMkYuJTJCJTVDJTJGJTdDd2F0Y2glNUMlM0Z2JTNEJTdDdiU1QyUyRiklM0YoJTVCQS1aYS16MC05Ll8lMjUtJTVEKikoJTVDJTI2JTVDUyUyQiklM0ZcclxuXHRcdFx0Ki9cclxuXHJcblx0XHRcdGlkID0gdXJsLm1hdGNoKC8oaHR0cDp8aHR0cHM6fClcXC9cXC8ocGxheWVyLnx3d3cufGFwcC4pPyh2aW1lb1xcLmNvbXx5b3V0dShiZVxcLmNvbXxcXC5iZXxiZVxcLmdvb2dsZWFwaXNcXC5jb20pfHZ6YWFyXFwuY29tKVxcLyh2aWRlb1xcL3x2aWRlb3NcXC98ZW1iZWRcXC98Y2hhbm5lbHNcXC8uK1xcL3xncm91cHNcXC8uK1xcL3x3YXRjaFxcP3Y9fHZcXC8pPyhbQS1aYS16MC05Ll8lLV0qKShcXCZcXFMrKT8vKTtcclxuXHJcblx0XHRcdGlmIChpZFszXS5pbmRleE9mKCd5b3V0dScpID4gLTEpIHtcclxuXHRcdFx0XHR0eXBlID0gJ3lvdXR1YmUnO1xyXG5cdFx0XHR9IGVsc2UgaWYgKGlkWzNdLmluZGV4T2YoJ3ZpbWVvJykgPiAtMSkge1xyXG5cdFx0XHRcdHR5cGUgPSAndmltZW8nO1xyXG5cdFx0XHR9IGVsc2UgaWYgKGlkWzNdLmluZGV4T2YoJ3Z6YWFyJykgPiAtMSkge1xyXG5cdFx0XHRcdHR5cGUgPSAndnphYXInO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignVmlkZW8gVVJMIG5vdCBzdXBwb3J0ZWQuJyk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWQgPSBpZFs2XTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignTWlzc2luZyB2aWRlbyBVUkwuJyk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fdmlkZW9zW3VybF0gPSB7XHJcblx0XHRcdHR5cGU6IHR5cGUsXHJcblx0XHRcdGlkOiBpZCxcclxuXHRcdFx0d2lkdGg6IHdpZHRoLFxyXG5cdFx0XHRoZWlnaHQ6IGhlaWdodFxyXG5cdFx0fTtcclxuXHJcblx0XHRpdGVtLmF0dHIoJ2RhdGEtdmlkZW8nLCB1cmwpO1xyXG5cclxuXHRcdHRoaXMudGh1bWJuYWlsKHRhcmdldCwgdGhpcy5fdmlkZW9zW3VybF0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZXMgdmlkZW8gdGh1bWJuYWlsLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge2pRdWVyeX0gdGFyZ2V0IC0gVGhlIHRhcmdldCBjb250YWluaW5nIHRoZSB2aWRlbyBkYXRhLlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBpbmZvIC0gVGhlIHZpZGVvIGluZm8gb2JqZWN0LlxyXG5cdCAqIEBzZWUgYGZldGNoYFxyXG5cdCAqL1xyXG5cdFZpZGVvLnByb3RvdHlwZS50aHVtYm5haWwgPSBmdW5jdGlvbih0YXJnZXQsIHZpZGVvKSB7XHJcblx0XHR2YXIgdG5MaW5rLFxyXG5cdFx0XHRpY29uLFxyXG5cdFx0XHRwYXRoLFxyXG5cdFx0XHRkaW1lbnNpb25zID0gdmlkZW8ud2lkdGggJiYgdmlkZW8uaGVpZ2h0ID8gJ3N0eWxlPVwid2lkdGg6JyArIHZpZGVvLndpZHRoICsgJ3B4O2hlaWdodDonICsgdmlkZW8uaGVpZ2h0ICsgJ3B4O1wiJyA6ICcnLFxyXG5cdFx0XHRjdXN0b21UbiA9IHRhcmdldC5maW5kKCdpbWcnKSxcclxuXHRcdFx0c3JjVHlwZSA9ICdzcmMnLFxyXG5cdFx0XHRsYXp5Q2xhc3MgPSAnJyxcclxuXHRcdFx0c2V0dGluZ3MgPSB0aGlzLl9jb3JlLnNldHRpbmdzLFxyXG5cdFx0XHRjcmVhdGUgPSBmdW5jdGlvbihwYXRoKSB7XHJcblx0XHRcdFx0aWNvbiA9ICc8ZGl2IGNsYXNzPVwib3dsLXZpZGVvLXBsYXktaWNvblwiPjwvZGl2Pic7XHJcblxyXG5cdFx0XHRcdGlmIChzZXR0aW5ncy5sYXp5TG9hZCkge1xyXG5cdFx0XHRcdFx0dG5MaW5rID0gJzxkaXYgY2xhc3M9XCJvd2wtdmlkZW8tdG4gJyArIGxhenlDbGFzcyArICdcIiAnICsgc3JjVHlwZSArICc9XCInICsgcGF0aCArICdcIj48L2Rpdj4nO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0bkxpbmsgPSAnPGRpdiBjbGFzcz1cIm93bC12aWRlby10blwiIHN0eWxlPVwib3BhY2l0eToxO2JhY2tncm91bmQtaW1hZ2U6dXJsKCcgKyBwYXRoICsgJylcIj48L2Rpdj4nO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR0YXJnZXQuYWZ0ZXIodG5MaW5rKTtcclxuXHRcdFx0XHR0YXJnZXQuYWZ0ZXIoaWNvbik7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0Ly8gd3JhcCB2aWRlbyBjb250ZW50IGludG8gb3dsLXZpZGVvLXdyYXBwZXIgZGl2XHJcblx0XHR0YXJnZXQud3JhcCgnPGRpdiBjbGFzcz1cIm93bC12aWRlby13cmFwcGVyXCInICsgZGltZW5zaW9ucyArICc+PC9kaXY+Jyk7XHJcblxyXG5cdFx0aWYgKHRoaXMuX2NvcmUuc2V0dGluZ3MubGF6eUxvYWQpIHtcclxuXHRcdFx0c3JjVHlwZSA9ICdkYXRhLXNyYyc7XHJcblx0XHRcdGxhenlDbGFzcyA9ICdvd2wtbGF6eSc7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gY3VzdG9tIHRodW1ibmFpbFxyXG5cdFx0aWYgKGN1c3RvbVRuLmxlbmd0aCkge1xyXG5cdFx0XHRjcmVhdGUoY3VzdG9tVG4uYXR0cihzcmNUeXBlKSk7XHJcblx0XHRcdGN1c3RvbVRuLnJlbW92ZSgpO1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHZpZGVvLnR5cGUgPT09ICd5b3V0dWJlJykge1xyXG5cdFx0XHRwYXRoID0gXCIvL2ltZy55b3V0dWJlLmNvbS92aS9cIiArIHZpZGVvLmlkICsgXCIvaHFkZWZhdWx0LmpwZ1wiO1xyXG5cdFx0XHRjcmVhdGUocGF0aCk7XHJcblx0XHR9IGVsc2UgaWYgKHZpZGVvLnR5cGUgPT09ICd2aW1lbycpIHtcclxuXHRcdFx0JC5hamF4KHtcclxuXHRcdFx0XHR0eXBlOiAnR0VUJyxcclxuXHRcdFx0XHR1cmw6ICcvL3ZpbWVvLmNvbS9hcGkvdjIvdmlkZW8vJyArIHZpZGVvLmlkICsgJy5qc29uJyxcclxuXHRcdFx0XHRqc29ucDogJ2NhbGxiYWNrJyxcclxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb25wJyxcclxuXHRcdFx0XHRzdWNjZXNzOiBmdW5jdGlvbihkYXRhKSB7XHJcblx0XHRcdFx0XHRwYXRoID0gZGF0YVswXS50aHVtYm5haWxfbGFyZ2U7XHJcblx0XHRcdFx0XHRjcmVhdGUocGF0aCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHRcdH0gZWxzZSBpZiAodmlkZW8udHlwZSA9PT0gJ3Z6YWFyJykge1xyXG5cdFx0XHQkLmFqYXgoe1xyXG5cdFx0XHRcdHR5cGU6ICdHRVQnLFxyXG5cdFx0XHRcdHVybDogJy8vdnphYXIuY29tL2FwaS92aWRlb3MvJyArIHZpZGVvLmlkICsgJy5qc29uJyxcclxuXHRcdFx0XHRqc29ucDogJ2NhbGxiYWNrJyxcclxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb25wJyxcclxuXHRcdFx0XHRzdWNjZXNzOiBmdW5jdGlvbihkYXRhKSB7XHJcblx0XHRcdFx0XHRwYXRoID0gZGF0YS5mcmFtZWdyYWJfdXJsO1xyXG5cdFx0XHRcdFx0Y3JlYXRlKHBhdGgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU3RvcHMgdGhlIGN1cnJlbnQgdmlkZW8uXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdFZpZGVvLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XHJcblx0XHR0aGlzLl9jb3JlLnRyaWdnZXIoJ3N0b3AnLCBudWxsLCAndmlkZW8nKTtcclxuXHRcdHRoaXMuX3BsYXlpbmcuZmluZCgnLm93bC12aWRlby1mcmFtZScpLnJlbW92ZSgpO1xyXG5cdFx0dGhpcy5fcGxheWluZy5yZW1vdmVDbGFzcygnb3dsLXZpZGVvLXBsYXlpbmcnKTtcclxuXHRcdHRoaXMuX3BsYXlpbmcgPSBudWxsO1xyXG5cdFx0dGhpcy5fY29yZS5sZWF2ZSgncGxheWluZycpO1xyXG5cdFx0dGhpcy5fY29yZS50cmlnZ2VyKCdzdG9wcGVkJywgbnVsbCwgJ3ZpZGVvJyk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU3RhcnRzIHRoZSBjdXJyZW50IHZpZGVvLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCAtIFRoZSBldmVudCBhcmd1bWVudHMuXHJcblx0ICovXHJcblx0VmlkZW8ucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihldmVudCkge1xyXG5cdFx0dmFyIHRhcmdldCA9ICQoZXZlbnQudGFyZ2V0KSxcclxuXHRcdFx0aXRlbSA9IHRhcmdldC5jbG9zZXN0KCcuJyArIHRoaXMuX2NvcmUuc2V0dGluZ3MuaXRlbUNsYXNzKSxcclxuXHRcdFx0dmlkZW8gPSB0aGlzLl92aWRlb3NbaXRlbS5hdHRyKCdkYXRhLXZpZGVvJyldLFxyXG5cdFx0XHR3aWR0aCA9IHZpZGVvLndpZHRoIHx8ICcxMDAlJyxcclxuXHRcdFx0aGVpZ2h0ID0gdmlkZW8uaGVpZ2h0IHx8IHRoaXMuX2NvcmUuJHN0YWdlLmhlaWdodCgpLFxyXG5cdFx0XHRodG1sO1xyXG5cclxuXHRcdGlmICh0aGlzLl9wbGF5aW5nKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9jb3JlLmVudGVyKCdwbGF5aW5nJyk7XHJcblx0XHR0aGlzLl9jb3JlLnRyaWdnZXIoJ3BsYXknLCBudWxsLCAndmlkZW8nKTtcclxuXHJcblx0XHRpdGVtID0gdGhpcy5fY29yZS5pdGVtcyh0aGlzLl9jb3JlLnJlbGF0aXZlKGl0ZW0uaW5kZXgoKSkpO1xyXG5cclxuXHRcdHRoaXMuX2NvcmUucmVzZXQoaXRlbS5pbmRleCgpKTtcclxuXHJcblx0XHRpZiAodmlkZW8udHlwZSA9PT0gJ3lvdXR1YmUnKSB7XHJcblx0XHRcdGh0bWwgPSAnPGlmcmFtZSB3aWR0aD1cIicgKyB3aWR0aCArICdcIiBoZWlnaHQ9XCInICsgaGVpZ2h0ICsgJ1wiIHNyYz1cIi8vd3d3LnlvdXR1YmUuY29tL2VtYmVkLycgK1xyXG5cdFx0XHRcdHZpZGVvLmlkICsgJz9hdXRvcGxheT0xJnJlbD0wJnY9JyArIHZpZGVvLmlkICsgJ1wiIGZyYW1lYm9yZGVyPVwiMFwiIGFsbG93ZnVsbHNjcmVlbj48L2lmcmFtZT4nO1xyXG5cdFx0fSBlbHNlIGlmICh2aWRlby50eXBlID09PSAndmltZW8nKSB7XHJcblx0XHRcdGh0bWwgPSAnPGlmcmFtZSBzcmM9XCIvL3BsYXllci52aW1lby5jb20vdmlkZW8vJyArIHZpZGVvLmlkICtcclxuXHRcdFx0XHQnP2F1dG9wbGF5PTFcIiB3aWR0aD1cIicgKyB3aWR0aCArICdcIiBoZWlnaHQ9XCInICsgaGVpZ2h0ICtcclxuXHRcdFx0XHQnXCIgZnJhbWVib3JkZXI9XCIwXCIgd2Via2l0YWxsb3dmdWxsc2NyZWVuIG1vemFsbG93ZnVsbHNjcmVlbiBhbGxvd2Z1bGxzY3JlZW4+PC9pZnJhbWU+JztcclxuXHRcdH0gZWxzZSBpZiAodmlkZW8udHlwZSA9PT0gJ3Z6YWFyJykge1xyXG5cdFx0XHRodG1sID0gJzxpZnJhbWUgZnJhbWVib3JkZXI9XCIwXCInICsgJ2hlaWdodD1cIicgKyBoZWlnaHQgKyAnXCInICsgJ3dpZHRoPVwiJyArIHdpZHRoICtcclxuXHRcdFx0XHQnXCIgYWxsb3dmdWxsc2NyZWVuIG1vemFsbG93ZnVsbHNjcmVlbiB3ZWJraXRBbGxvd0Z1bGxTY3JlZW4gJyArXHJcblx0XHRcdFx0J3NyYz1cIi8vdmlldy52emFhci5jb20vJyArIHZpZGVvLmlkICsgJy9wbGF5ZXI/YXV0b3BsYXk9dHJ1ZVwiPjwvaWZyYW1lPic7XHJcblx0XHR9XHJcblxyXG5cdFx0JCgnPGRpdiBjbGFzcz1cIm93bC12aWRlby1mcmFtZVwiPicgKyBodG1sICsgJzwvZGl2PicpLmluc2VydEFmdGVyKGl0ZW0uZmluZCgnLm93bC12aWRlbycpKTtcclxuXHJcblx0XHR0aGlzLl9wbGF5aW5nID0gaXRlbS5hZGRDbGFzcygnb3dsLXZpZGVvLXBsYXlpbmcnKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDaGVja3Mgd2hldGhlciBhbiB2aWRlbyBpcyBjdXJyZW50bHkgaW4gZnVsbCBzY3JlZW4gbW9kZSBvciBub3QuXHJcblx0ICogQHRvZG8gQmFkIHN0eWxlIGJlY2F1c2UgbG9va3MgbGlrZSBhIHJlYWRvbmx5IG1ldGhvZCBidXQgY2hhbmdlcyBtZW1iZXJzLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuXHQgKi9cclxuXHRWaWRlby5wcm90b3R5cGUuaXNJbkZ1bGxTY3JlZW4gPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBlbGVtZW50ID0gZG9jdW1lbnQuZnVsbHNjcmVlbkVsZW1lbnQgfHwgZG9jdW1lbnQubW96RnVsbFNjcmVlbkVsZW1lbnQgfHxcclxuXHRcdFx0XHRkb2N1bWVudC53ZWJraXRGdWxsc2NyZWVuRWxlbWVudDtcclxuXHJcblx0XHRyZXR1cm4gZWxlbWVudCAmJiAkKGVsZW1lbnQpLnBhcmVudCgpLmhhc0NsYXNzKCdvd2wtdmlkZW8tZnJhbWUnKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxyXG5cdCAqL1xyXG5cdFZpZGVvLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgaGFuZGxlciwgcHJvcGVydHk7XHJcblxyXG5cdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vZmYoJ2NsaWNrLm93bC52aWRlbycpO1xyXG5cclxuXHRcdGZvciAoaGFuZGxlciBpbiB0aGlzLl9oYW5kbGVycykge1xyXG5cdFx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9mZihoYW5kbGVyLCB0aGlzLl9oYW5kbGVyc1toYW5kbGVyXSk7XHJcblx0XHR9XHJcblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XHJcblx0XHRcdHR5cGVvZiB0aGlzW3Byb3BlcnR5XSAhPSAnZnVuY3Rpb24nICYmICh0aGlzW3Byb3BlcnR5XSA9IG51bGwpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdCQuZm4ub3dsQ2Fyb3VzZWwuQ29uc3RydWN0b3IuUGx1Z2lucy5WaWRlbyA9IFZpZGVvO1xyXG5cclxufSkod2luZG93LlplcHRvIHx8IHdpbmRvdy5qUXVlcnksIHdpbmRvdywgZG9jdW1lbnQpO1xyXG5cclxuLyoqXHJcbiAqIEFuaW1hdGUgUGx1Z2luXHJcbiAqIEB2ZXJzaW9uIDIuMy4zXHJcbiAqIEBhdXRob3IgQmFydG9zeiBXb2pjaWVjaG93c2tpXHJcbiAqIEBhdXRob3IgRGF2aWQgRGV1dHNjaFxyXG4gKiBAbGljZW5zZSBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICovXHJcbjsoZnVuY3Rpb24oJCwgd2luZG93LCBkb2N1bWVudCwgdW5kZWZpbmVkKSB7XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZXMgdGhlIGFuaW1hdGUgcGx1Z2luLlxyXG5cdCAqIEBjbGFzcyBUaGUgTmF2aWdhdGlvbiBQbHVnaW5cclxuXHQgKiBAcGFyYW0ge093bH0gc2NvcGUgLSBUaGUgT3dsIENhcm91c2VsXHJcblx0ICovXHJcblx0dmFyIEFuaW1hdGUgPSBmdW5jdGlvbihzY29wZSkge1xyXG5cdFx0dGhpcy5jb3JlID0gc2NvcGU7XHJcblx0XHR0aGlzLmNvcmUub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBBbmltYXRlLkRlZmF1bHRzLCB0aGlzLmNvcmUub3B0aW9ucyk7XHJcblx0XHR0aGlzLnN3YXBwaW5nID0gdHJ1ZTtcclxuXHRcdHRoaXMucHJldmlvdXMgPSB1bmRlZmluZWQ7XHJcblx0XHR0aGlzLm5leHQgPSB1bmRlZmluZWQ7XHJcblxyXG5cdFx0dGhpcy5oYW5kbGVycyA9IHtcclxuXHRcdFx0J2NoYW5nZS5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgZS5wcm9wZXJ0eS5uYW1lID09ICdwb3NpdGlvbicpIHtcclxuXHRcdFx0XHRcdHRoaXMucHJldmlvdXMgPSB0aGlzLmNvcmUuY3VycmVudCgpO1xyXG5cdFx0XHRcdFx0dGhpcy5uZXh0ID0gZS5wcm9wZXJ0eS52YWx1ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQnZHJhZy5vd2wuY2Fyb3VzZWwgZHJhZ2dlZC5vd2wuY2Fyb3VzZWwgdHJhbnNsYXRlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UpIHtcclxuXHRcdFx0XHRcdHRoaXMuc3dhcHBpbmcgPSBlLnR5cGUgPT0gJ3RyYW5zbGF0ZWQnO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCd0cmFuc2xhdGUub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuc3dhcHBpbmcgJiYgKHRoaXMuY29yZS5vcHRpb25zLmFuaW1hdGVPdXQgfHwgdGhpcy5jb3JlLm9wdGlvbnMuYW5pbWF0ZUluKSkge1xyXG5cdFx0XHRcdFx0dGhpcy5zd2FwKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKVxyXG5cdFx0fTtcclxuXHJcblx0XHR0aGlzLmNvcmUuJGVsZW1lbnQub24odGhpcy5oYW5kbGVycyk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGVmYXVsdCBvcHRpb25zLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRBbmltYXRlLkRlZmF1bHRzID0ge1xyXG5cdFx0YW5pbWF0ZU91dDogZmFsc2UsXHJcblx0XHRhbmltYXRlSW46IGZhbHNlXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogVG9nZ2xlcyB0aGUgYW5pbWF0aW9uIGNsYXNzZXMgd2hlbmV2ZXIgYW4gdHJhbnNsYXRpb25zIHN0YXJ0cy5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHJldHVybnMge0Jvb2xlYW58dW5kZWZpbmVkfVxyXG5cdCAqL1xyXG5cdEFuaW1hdGUucHJvdG90eXBlLnN3YXAgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0XHRpZiAodGhpcy5jb3JlLnNldHRpbmdzLml0ZW1zICE9PSAxKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoISQuc3VwcG9ydC5hbmltYXRpb24gfHwgISQuc3VwcG9ydC50cmFuc2l0aW9uKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmNvcmUuc3BlZWQoMCk7XHJcblxyXG5cdFx0dmFyIGxlZnQsXHJcblx0XHRcdGNsZWFyID0gJC5wcm94eSh0aGlzLmNsZWFyLCB0aGlzKSxcclxuXHRcdFx0cHJldmlvdXMgPSB0aGlzLmNvcmUuJHN0YWdlLmNoaWxkcmVuKCkuZXEodGhpcy5wcmV2aW91cyksXHJcblx0XHRcdG5leHQgPSB0aGlzLmNvcmUuJHN0YWdlLmNoaWxkcmVuKCkuZXEodGhpcy5uZXh0KSxcclxuXHRcdFx0aW5jb21pbmcgPSB0aGlzLmNvcmUuc2V0dGluZ3MuYW5pbWF0ZUluLFxyXG5cdFx0XHRvdXRnb2luZyA9IHRoaXMuY29yZS5zZXR0aW5ncy5hbmltYXRlT3V0O1xyXG5cclxuXHRcdGlmICh0aGlzLmNvcmUuY3VycmVudCgpID09PSB0aGlzLnByZXZpb3VzKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAob3V0Z29pbmcpIHtcclxuXHRcdFx0bGVmdCA9IHRoaXMuY29yZS5jb29yZGluYXRlcyh0aGlzLnByZXZpb3VzKSAtIHRoaXMuY29yZS5jb29yZGluYXRlcyh0aGlzLm5leHQpO1xyXG5cdFx0XHRwcmV2aW91cy5vbmUoJC5zdXBwb3J0LmFuaW1hdGlvbi5lbmQsIGNsZWFyKVxyXG5cdFx0XHRcdC5jc3MoIHsgJ2xlZnQnOiBsZWZ0ICsgJ3B4JyB9IClcclxuXHRcdFx0XHQuYWRkQ2xhc3MoJ2FuaW1hdGVkIG93bC1hbmltYXRlZC1vdXQnKVxyXG5cdFx0XHRcdC5hZGRDbGFzcyhvdXRnb2luZyk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGluY29taW5nKSB7XHJcblx0XHRcdG5leHQub25lKCQuc3VwcG9ydC5hbmltYXRpb24uZW5kLCBjbGVhcilcclxuXHRcdFx0XHQuYWRkQ2xhc3MoJ2FuaW1hdGVkIG93bC1hbmltYXRlZC1pbicpXHJcblx0XHRcdFx0LmFkZENsYXNzKGluY29taW5nKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHRBbmltYXRlLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKGUpIHtcclxuXHRcdCQoZS50YXJnZXQpLmNzcyggeyAnbGVmdCc6ICcnIH0gKVxyXG5cdFx0XHQucmVtb3ZlQ2xhc3MoJ2FuaW1hdGVkIG93bC1hbmltYXRlZC1vdXQgb3dsLWFuaW1hdGVkLWluJylcclxuXHRcdFx0LnJlbW92ZUNsYXNzKHRoaXMuY29yZS5zZXR0aW5ncy5hbmltYXRlSW4pXHJcblx0XHRcdC5yZW1vdmVDbGFzcyh0aGlzLmNvcmUuc2V0dGluZ3MuYW5pbWF0ZU91dCk7XHJcblx0XHR0aGlzLmNvcmUub25UcmFuc2l0aW9uRW5kKCk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGVzdHJveXMgdGhlIHBsdWdpbi5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0QW5pbWF0ZS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGhhbmRsZXIsIHByb3BlcnR5O1xyXG5cclxuXHRcdGZvciAoaGFuZGxlciBpbiB0aGlzLmhhbmRsZXJzKSB7XHJcblx0XHRcdHRoaXMuY29yZS4kZWxlbWVudC5vZmYoaGFuZGxlciwgdGhpcy5oYW5kbGVyc1toYW5kbGVyXSk7XHJcblx0XHR9XHJcblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XHJcblx0XHRcdHR5cGVvZiB0aGlzW3Byb3BlcnR5XSAhPSAnZnVuY3Rpb24nICYmICh0aGlzW3Byb3BlcnR5XSA9IG51bGwpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdCQuZm4ub3dsQ2Fyb3VzZWwuQ29uc3RydWN0b3IuUGx1Z2lucy5BbmltYXRlID0gQW5pbWF0ZTtcclxuXHJcbn0pKHdpbmRvdy5aZXB0byB8fCB3aW5kb3cualF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50KTtcclxuXHJcbi8qKlxyXG4gKiBBdXRvcGxheSBQbHVnaW5cclxuICogQHZlcnNpb24gMi4zLjNcclxuICogQGF1dGhvciBCYXJ0b3N6IFdvamNpZWNob3dza2lcclxuICogQGF1dGhvciBBcnR1cyBLb2xhbm93c2tpXHJcbiAqIEBhdXRob3IgRGF2aWQgRGV1dHNjaFxyXG4gKiBAYXV0aG9yIFRvbSBEZSBDYWx1d8OpXHJcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4gKi9cclxuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlcyB0aGUgYXV0b3BsYXkgcGx1Z2luLlxyXG5cdCAqIEBjbGFzcyBUaGUgQXV0b3BsYXkgUGx1Z2luXHJcblx0ICogQHBhcmFtIHtPd2x9IHNjb3BlIC0gVGhlIE93bCBDYXJvdXNlbFxyXG5cdCAqL1xyXG5cdHZhciBBdXRvcGxheSA9IGZ1bmN0aW9uKGNhcm91c2VsKSB7XHJcblx0XHQvKipcclxuXHRcdCAqIFJlZmVyZW5jZSB0byB0aGUgY29yZS5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPd2x9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2NvcmUgPSBjYXJvdXNlbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFRoZSBhdXRvcGxheSB0aW1lb3V0IGlkLlxyXG5cdFx0ICogQHR5cGUge051bWJlcn1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY2FsbCA9IG51bGw7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZXBlbmRpbmcgb24gdGhlIHN0YXRlIG9mIHRoZSBwbHVnaW4sIHRoaXMgdmFyaWFibGUgY29udGFpbnMgZWl0aGVyXHJcblx0XHQgKiB0aGUgc3RhcnQgdGltZSBvZiB0aGUgdGltZXIgb3IgdGhlIGN1cnJlbnQgdGltZXIgdmFsdWUgaWYgaXQnc1xyXG5cdFx0ICogcGF1c2VkLiBTaW5jZSB3ZSBzdGFydCBpbiBhIHBhdXNlZCBzdGF0ZSB3ZSBpbml0aWFsaXplIHRoZSB0aW1lclxyXG5cdFx0ICogdmFsdWUuXHJcblx0XHQgKiBAdHlwZSB7TnVtYmVyfVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl90aW1lID0gMDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFN0b3JlcyB0aGUgdGltZW91dCBjdXJyZW50bHkgdXNlZC5cclxuXHRcdCAqIEB0eXBlIHtOdW1iZXJ9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX3RpbWVvdXQgPSAwO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSW5kaWNhdGVzIHdoZW5ldmVyIHRoZSBhdXRvcGxheSBpcyBwYXVzZWQuXHJcblx0XHQgKiBAdHlwZSB7Qm9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fcGF1c2VkID0gdHJ1ZTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFsbCBldmVudCBoYW5kbGVycy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2hhbmRsZXJzID0ge1xyXG5cdFx0XHQnY2hhbmdlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgZS5wcm9wZXJ0eS5uYW1lID09PSAnc2V0dGluZ3MnKSB7XHJcblx0XHRcdFx0XHRpZiAodGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvcGxheSkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnBsYXkoKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdHRoaXMuc3RvcCgpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSBpZiAoZS5uYW1lc3BhY2UgJiYgZS5wcm9wZXJ0eS5uYW1lID09PSAncG9zaXRpb24nICYmIHRoaXMuX3BhdXNlZCkge1xyXG5cdFx0XHRcdFx0Ly8gUmVzZXQgdGhlIHRpbWVyLiBUaGlzIGNvZGUgaXMgdHJpZ2dlcmVkIHdoZW4gdGhlIHBvc2l0aW9uXHJcblx0XHRcdFx0XHQvLyBvZiB0aGUgY2Fyb3VzZWwgd2FzIGNoYW5nZWQgdGhyb3VnaCB1c2VyIGludGVyYWN0aW9uLlxyXG5cdFx0XHRcdFx0dGhpcy5fdGltZSA9IDA7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J2luaXRpYWxpemVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiB0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9wbGF5KSB7XHJcblx0XHRcdFx0XHR0aGlzLnBsYXkoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQncGxheS5vd2wuYXV0b3BsYXknOiAkLnByb3h5KGZ1bmN0aW9uKGUsIHQsIHMpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UpIHtcclxuXHRcdFx0XHRcdHRoaXMucGxheSh0LCBzKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQnc3RvcC5vd2wuYXV0b3BsYXknOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UpIHtcclxuXHRcdFx0XHRcdHRoaXMuc3RvcCgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdtb3VzZW92ZXIub3dsLmF1dG9wbGF5JzogJC5wcm94eShmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRpZiAodGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvcGxheUhvdmVyUGF1c2UgJiYgdGhpcy5fY29yZS5pcygncm90YXRpbmcnKSkge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXVzZSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdtb3VzZWxlYXZlLm93bC5hdXRvcGxheSc6ICQucHJveHkoZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0aWYgKHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b3BsYXlIb3ZlclBhdXNlICYmIHRoaXMuX2NvcmUuaXMoJ3JvdGF0aW5nJykpIHtcclxuXHRcdFx0XHRcdHRoaXMucGxheSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCd0b3VjaHN0YXJ0Lm93bC5jb3JlJzogJC5wcm94eShmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRpZiAodGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvcGxheUhvdmVyUGF1c2UgJiYgdGhpcy5fY29yZS5pcygncm90YXRpbmcnKSkge1xyXG5cdFx0XHRcdFx0dGhpcy5wYXVzZSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCd0b3VjaGVuZC5vd2wuY29yZSc6ICQucHJveHkoZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0aWYgKHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b3BsYXlIb3ZlclBhdXNlKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBsYXkoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpXHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIHJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzXHJcblx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9uKHRoaXMuX2hhbmRsZXJzKTtcclxuXHJcblx0XHQvLyBzZXQgZGVmYXVsdCBvcHRpb25zXHJcblx0XHR0aGlzLl9jb3JlLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgQXV0b3BsYXkuRGVmYXVsdHMsIHRoaXMuX2NvcmUub3B0aW9ucyk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGVmYXVsdCBvcHRpb25zLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRBdXRvcGxheS5EZWZhdWx0cyA9IHtcclxuXHRcdGF1dG9wbGF5OiBmYWxzZSxcclxuXHRcdGF1dG9wbGF5VGltZW91dDogNTAwMCxcclxuXHRcdGF1dG9wbGF5SG92ZXJQYXVzZTogZmFsc2UsXHJcblx0XHRhdXRvcGxheVNwZWVkOiBmYWxzZVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRyYW5zaXRpb24gdG8gdGhlIG5leHQgc2xpZGUgYW5kIHNldCBhIHRpbWVvdXQgZm9yIHRoZSBuZXh0IHRyYW5zaXRpb24uXHJcblx0ICogQHByaXZhdGVcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3NwZWVkXSAtIFRoZSBhbmltYXRpb24gc3BlZWQgZm9yIHRoZSBhbmltYXRpb25zLlxyXG5cdCAqL1xyXG5cdEF1dG9wbGF5LnByb3RvdHlwZS5fbmV4dCA9IGZ1bmN0aW9uKHNwZWVkKSB7XHJcblx0XHR0aGlzLl9jYWxsID0gd2luZG93LnNldFRpbWVvdXQoXHJcblx0XHRcdCQucHJveHkodGhpcy5fbmV4dCwgdGhpcywgc3BlZWQpLFxyXG5cdFx0XHR0aGlzLl90aW1lb3V0ICogKE1hdGgucm91bmQodGhpcy5yZWFkKCkgLyB0aGlzLl90aW1lb3V0KSArIDEpIC0gdGhpcy5yZWFkKClcclxuXHRcdCk7XHJcblxyXG5cdFx0aWYgKHRoaXMuX2NvcmUuaXMoJ2ludGVyYWN0aW5nJykgfHwgZG9jdW1lbnQuaGlkZGVuKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHRoaXMuX2NvcmUubmV4dChzcGVlZCB8fCB0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9wbGF5U3BlZWQpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVhZHMgdGhlIGN1cnJlbnQgdGltZXIgdmFsdWUgd2hlbiB0aGUgdGltZXIgaXMgcGxheWluZy5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0QXV0b3BsYXkucHJvdG90eXBlLnJlYWQgPSBmdW5jdGlvbigpIHtcclxuXHRcdHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHRoaXMuX3RpbWU7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU3RhcnRzIHRoZSBhdXRvcGxheS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFt0aW1lb3V0XSAtIFRoZSBpbnRlcnZhbCBiZWZvcmUgdGhlIG5leHQgYW5pbWF0aW9uIHN0YXJ0cy5cclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3NwZWVkXSAtIFRoZSBhbmltYXRpb24gc3BlZWQgZm9yIHRoZSBhbmltYXRpb25zLlxyXG5cdCAqL1xyXG5cdEF1dG9wbGF5LnByb3RvdHlwZS5wbGF5ID0gZnVuY3Rpb24odGltZW91dCwgc3BlZWQpIHtcclxuXHRcdHZhciBlbGFwc2VkO1xyXG5cclxuXHRcdGlmICghdGhpcy5fY29yZS5pcygncm90YXRpbmcnKSkge1xyXG5cdFx0XHR0aGlzLl9jb3JlLmVudGVyKCdyb3RhdGluZycpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRpbWVvdXQgPSB0aW1lb3V0IHx8IHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b3BsYXlUaW1lb3V0O1xyXG5cclxuXHRcdC8vIENhbGN1bGF0ZSB0aGUgZWxhcHNlZCB0aW1lIHNpbmNlIHRoZSBsYXN0IHRyYW5zaXRpb24uIElmIHRoZSBjYXJvdXNlbFxyXG5cdFx0Ly8gd2Fzbid0IHBsYXlpbmcgdGhpcyBjYWxjdWxhdGlvbiB3aWxsIHlpZWxkIHplcm8uXHJcblx0XHRlbGFwc2VkID0gTWF0aC5taW4odGhpcy5fdGltZSAlICh0aGlzLl90aW1lb3V0IHx8IHRpbWVvdXQpLCB0aW1lb3V0KTtcclxuXHJcblx0XHRpZiAodGhpcy5fcGF1c2VkKSB7XHJcblx0XHRcdC8vIFN0YXJ0IHRoZSBjbG9jay5cclxuXHRcdFx0dGhpcy5fdGltZSA9IHRoaXMucmVhZCgpO1xyXG5cdFx0XHR0aGlzLl9wYXVzZWQgPSBmYWxzZTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdC8vIENsZWFyIHRoZSBhY3RpdmUgdGltZW91dCB0byBhbGxvdyByZXBsYWNlbWVudC5cclxuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLl9jYWxsKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBBZGp1c3QgdGhlIG9yaWdpbiBvZiB0aGUgdGltZXIgdG8gbWF0Y2ggdGhlIG5ldyB0aW1lb3V0IHZhbHVlLlxyXG5cdFx0dGhpcy5fdGltZSArPSB0aGlzLnJlYWQoKSAlIHRpbWVvdXQgLSBlbGFwc2VkO1xyXG5cclxuXHRcdHRoaXMuX3RpbWVvdXQgPSB0aW1lb3V0O1xyXG5cdFx0dGhpcy5fY2FsbCA9IHdpbmRvdy5zZXRUaW1lb3V0KCQucHJveHkodGhpcy5fbmV4dCwgdGhpcywgc3BlZWQpLCB0aW1lb3V0IC0gZWxhcHNlZCk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU3RvcHMgdGhlIGF1dG9wbGF5LlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRBdXRvcGxheS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0aWYgKHRoaXMuX2NvcmUuaXMoJ3JvdGF0aW5nJykpIHtcclxuXHRcdFx0Ly8gUmVzZXQgdGhlIGNsb2NrLlxyXG5cdFx0XHR0aGlzLl90aW1lID0gMDtcclxuXHRcdFx0dGhpcy5fcGF1c2VkID0gdHJ1ZTtcclxuXHJcblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5fY2FsbCk7XHJcblx0XHRcdHRoaXMuX2NvcmUubGVhdmUoJ3JvdGF0aW5nJyk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUGF1c2VzIHRoZSBhdXRvcGxheS5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0QXV0b3BsYXkucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oKSB7XHJcblx0XHRpZiAodGhpcy5fY29yZS5pcygncm90YXRpbmcnKSAmJiAhdGhpcy5fcGF1c2VkKSB7XHJcblx0XHRcdC8vIFBhdXNlIHRoZSBjbG9jay5cclxuXHRcdFx0dGhpcy5fdGltZSA9IHRoaXMucmVhZCgpO1xyXG5cdFx0XHR0aGlzLl9wYXVzZWQgPSB0cnVlO1xyXG5cclxuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLl9jYWxsKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxyXG5cdCAqL1xyXG5cdEF1dG9wbGF5LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgaGFuZGxlciwgcHJvcGVydHk7XHJcblxyXG5cdFx0dGhpcy5zdG9wKCk7XHJcblxyXG5cdFx0Zm9yIChoYW5kbGVyIGluIHRoaXMuX2hhbmRsZXJzKSB7XHJcblx0XHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub2ZmKGhhbmRsZXIsIHRoaXMuX2hhbmRsZXJzW2hhbmRsZXJdKTtcclxuXHRcdH1cclxuXHRcdGZvciAocHJvcGVydHkgaW4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGhpcykpIHtcclxuXHRcdFx0dHlwZW9mIHRoaXNbcHJvcGVydHldICE9ICdmdW5jdGlvbicgJiYgKHRoaXNbcHJvcGVydHldID0gbnVsbCk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0JC5mbi5vd2xDYXJvdXNlbC5Db25zdHJ1Y3Rvci5QbHVnaW5zLmF1dG9wbGF5ID0gQXV0b3BsYXk7XHJcblxyXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7XHJcblxyXG4vKipcclxuICogTmF2aWdhdGlvbiBQbHVnaW5cclxuICogQHZlcnNpb24gMi4zLjNcclxuICogQGF1dGhvciBBcnR1cyBLb2xhbm93c2tpXHJcbiAqIEBhdXRob3IgRGF2aWQgRGV1dHNjaFxyXG4gKiBAbGljZW5zZSBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICovXHJcbjsoZnVuY3Rpb24oJCwgd2luZG93LCBkb2N1bWVudCwgdW5kZWZpbmVkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvKipcclxuXHQgKiBDcmVhdGVzIHRoZSBuYXZpZ2F0aW9uIHBsdWdpbi5cclxuXHQgKiBAY2xhc3MgVGhlIE5hdmlnYXRpb24gUGx1Z2luXHJcblx0ICogQHBhcmFtIHtPd2x9IGNhcm91c2VsIC0gVGhlIE93bCBDYXJvdXNlbC5cclxuXHQgKi9cclxuXHR2YXIgTmF2aWdhdGlvbiA9IGZ1bmN0aW9uKGNhcm91c2VsKSB7XHJcblx0XHQvKipcclxuXHRcdCAqIFJlZmVyZW5jZSB0byB0aGUgY29yZS5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPd2x9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2NvcmUgPSBjYXJvdXNlbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEluZGljYXRlcyB3aGV0aGVyIHRoZSBwbHVnaW4gaXMgaW5pdGlhbGl6ZWQgb3Igbm90LlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge0Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2luaXRpYWxpemVkID0gZmFsc2U7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBUaGUgY3VycmVudCBwYWdpbmcgaW5kZXhlcy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtBcnJheX1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fcGFnZXMgPSBbXTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFsbCBET00gZWxlbWVudHMgb2YgdGhlIHVzZXIgaW50ZXJmYWNlLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY29udHJvbHMgPSB7fTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE1hcmt1cCBmb3IgYW4gaW5kaWNhdG9yLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge0FycmF5LjxTdHJpbmc+fVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl90ZW1wbGF0ZXMgPSBbXTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFRoZSBjYXJvdXNlbCBlbGVtZW50LlxyXG5cdFx0ICogQHR5cGUge2pRdWVyeX1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy4kZWxlbWVudCA9IHRoaXMuX2NvcmUuJGVsZW1lbnQ7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPdmVycmlkZGVuIG1ldGhvZHMgb2YgdGhlIGNhcm91c2VsLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fb3ZlcnJpZGVzID0ge1xyXG5cdFx0XHRuZXh0OiB0aGlzLl9jb3JlLm5leHQsXHJcblx0XHRcdHByZXY6IHRoaXMuX2NvcmUucHJldixcclxuXHRcdFx0dG86IHRoaXMuX2NvcmUudG9cclxuXHRcdH07XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBbGwgZXZlbnQgaGFuZGxlcnMuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9oYW5kbGVycyA9IHtcclxuXHRcdFx0J3ByZXBhcmVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiB0aGlzLl9jb3JlLnNldHRpbmdzLmRvdHNEYXRhKSB7XHJcblx0XHRcdFx0XHR0aGlzLl90ZW1wbGF0ZXMucHVzaCgnPGRpdiBjbGFzcz1cIicgKyB0aGlzLl9jb3JlLnNldHRpbmdzLmRvdENsYXNzICsgJ1wiPicgK1xyXG5cdFx0XHRcdFx0XHQkKGUuY29udGVudCkuZmluZCgnW2RhdGEtZG90XScpLmFkZEJhY2soJ1tkYXRhLWRvdF0nKS5hdHRyKCdkYXRhLWRvdCcpICsgJzwvZGl2PicpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdhZGRlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5fY29yZS5zZXR0aW5ncy5kb3RzRGF0YSkge1xyXG5cdFx0XHRcdFx0dGhpcy5fdGVtcGxhdGVzLnNwbGljZShlLnBvc2l0aW9uLCAwLCB0aGlzLl90ZW1wbGF0ZXMucG9wKCkpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdyZW1vdmUub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MuZG90c0RhdGEpIHtcclxuXHRcdFx0XHRcdHRoaXMuX3RlbXBsYXRlcy5zcGxpY2UoZS5wb3NpdGlvbiwgMSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J2NoYW5nZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIGUucHJvcGVydHkubmFtZSA9PSAncG9zaXRpb24nKSB7XHJcblx0XHRcdFx0XHR0aGlzLmRyYXcoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQnaW5pdGlhbGl6ZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmICF0aGlzLl9pbml0aWFsaXplZCkge1xyXG5cdFx0XHRcdFx0dGhpcy5fY29yZS50cmlnZ2VyKCdpbml0aWFsaXplJywgbnVsbCwgJ25hdmlnYXRpb24nKTtcclxuXHRcdFx0XHRcdHRoaXMuaW5pdGlhbGl6ZSgpO1xyXG5cdFx0XHRcdFx0dGhpcy51cGRhdGUoKTtcclxuXHRcdFx0XHRcdHRoaXMuZHJhdygpO1xyXG5cdFx0XHRcdFx0dGhpcy5faW5pdGlhbGl6ZWQgPSB0cnVlO1xyXG5cdFx0XHRcdFx0dGhpcy5fY29yZS50cmlnZ2VyKCdpbml0aWFsaXplZCcsIG51bGwsICduYXZpZ2F0aW9uJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J3JlZnJlc2hlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5faW5pdGlhbGl6ZWQpIHtcclxuXHRcdFx0XHRcdHRoaXMuX2NvcmUudHJpZ2dlcigncmVmcmVzaCcsIG51bGwsICduYXZpZ2F0aW9uJyk7XHJcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZSgpO1xyXG5cdFx0XHRcdFx0dGhpcy5kcmF3KCk7XHJcblx0XHRcdFx0XHR0aGlzLl9jb3JlLnRyaWdnZXIoJ3JlZnJlc2hlZCcsIG51bGwsICduYXZpZ2F0aW9uJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKVxyXG5cdFx0fTtcclxuXHJcblx0XHQvLyBzZXQgZGVmYXVsdCBvcHRpb25zXHJcblx0XHR0aGlzLl9jb3JlLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgTmF2aWdhdGlvbi5EZWZhdWx0cywgdGhpcy5fY29yZS5vcHRpb25zKTtcclxuXHJcblx0XHQvLyByZWdpc3RlciBldmVudCBoYW5kbGVyc1xyXG5cdFx0dGhpcy4kZWxlbWVudC5vbih0aGlzLl9oYW5kbGVycyk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGVmYXVsdCBvcHRpb25zLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAdG9kbyBSZW5hbWUgYHNsaWRlQnlgIHRvIGBuYXZCeWBcclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLkRlZmF1bHRzID0ge1xyXG5cdFx0bmF2OiBmYWxzZSxcclxuXHRcdG5hdlRleHQ6IFtcclxuXHRcdFx0JzxzcGFuIGFyaWEtbGFiZWw9XCInICsgJ1ByZXZpb3VzJyArICdcIj4mI3gyMDM5Ozwvc3Bhbj4nLFxyXG5cdFx0XHQnPHNwYW4gYXJpYS1sYWJlbD1cIicgKyAnTmV4dCcgKyAnXCI+JiN4MjAzYTs8L3NwYW4+J1xyXG5cdFx0XSxcclxuXHRcdG5hdlNwZWVkOiBmYWxzZSxcclxuXHRcdG5hdkVsZW1lbnQ6ICdidXR0b24gdHlwZT1cImJ1dHRvblwiIHJvbGU9XCJwcmVzZW50YXRpb25cIicsXHJcblx0XHRuYXZDb250YWluZXI6IGZhbHNlLFxyXG5cdFx0bmF2Q29udGFpbmVyQ2xhc3M6ICdvd2wtbmF2JyxcclxuXHRcdG5hdkNsYXNzOiBbXHJcblx0XHRcdCdvd2wtcHJldicsXHJcblx0XHRcdCdvd2wtbmV4dCdcclxuXHRcdF0sXHJcblx0XHRzbGlkZUJ5OiAxLFxyXG5cdFx0ZG90Q2xhc3M6ICdvd2wtZG90JyxcclxuXHRcdGRvdHNDbGFzczogJ293bC1kb3RzJyxcclxuXHRcdGRvdHM6IHRydWUsXHJcblx0XHRkb3RzRWFjaDogZmFsc2UsXHJcblx0XHRkb3RzRGF0YTogZmFsc2UsXHJcblx0XHRkb3RzU3BlZWQ6IGZhbHNlLFxyXG5cdFx0ZG90c0NvbnRhaW5lcjogZmFsc2VcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBJbml0aWFsaXplcyB0aGUgbGF5b3V0IG9mIHRoZSBwbHVnaW4gYW5kIGV4dGVuZHMgdGhlIGNhcm91c2VsLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgb3ZlcnJpZGUsXHJcblx0XHRcdHNldHRpbmdzID0gdGhpcy5fY29yZS5zZXR0aW5ncztcclxuXHJcblx0XHQvLyBjcmVhdGUgRE9NIHN0cnVjdHVyZSBmb3IgcmVsYXRpdmUgbmF2aWdhdGlvblxyXG5cdFx0dGhpcy5fY29udHJvbHMuJHJlbGF0aXZlID0gKHNldHRpbmdzLm5hdkNvbnRhaW5lciA/ICQoc2V0dGluZ3MubmF2Q29udGFpbmVyKVxyXG5cdFx0XHQ6ICQoJzxkaXY+JykuYWRkQ2xhc3Moc2V0dGluZ3MubmF2Q29udGFpbmVyQ2xhc3MpLmFwcGVuZFRvKHRoaXMuJGVsZW1lbnQpKS5hZGRDbGFzcygnZGlzYWJsZWQnKTtcclxuXHJcblx0XHR0aGlzLl9jb250cm9scy4kcHJldmlvdXMgPSAkKCc8JyArIHNldHRpbmdzLm5hdkVsZW1lbnQgKyAnPicpXHJcblx0XHRcdC5hZGRDbGFzcyhzZXR0aW5ncy5uYXZDbGFzc1swXSlcclxuXHRcdFx0Lmh0bWwoc2V0dGluZ3MubmF2VGV4dFswXSlcclxuXHRcdFx0LnByZXBlbmRUbyh0aGlzLl9jb250cm9scy4kcmVsYXRpdmUpXHJcblx0XHRcdC5vbignY2xpY2snLCAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHR0aGlzLnByZXYoc2V0dGluZ3MubmF2U3BlZWQpO1xyXG5cdFx0XHR9LCB0aGlzKSk7XHJcblx0XHR0aGlzLl9jb250cm9scy4kbmV4dCA9ICQoJzwnICsgc2V0dGluZ3MubmF2RWxlbWVudCArICc+JylcclxuXHRcdFx0LmFkZENsYXNzKHNldHRpbmdzLm5hdkNsYXNzWzFdKVxyXG5cdFx0XHQuaHRtbChzZXR0aW5ncy5uYXZUZXh0WzFdKVxyXG5cdFx0XHQuYXBwZW5kVG8odGhpcy5fY29udHJvbHMuJHJlbGF0aXZlKVxyXG5cdFx0XHQub24oJ2NsaWNrJywgJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0dGhpcy5uZXh0KHNldHRpbmdzLm5hdlNwZWVkKTtcclxuXHRcdFx0fSwgdGhpcykpO1xyXG5cclxuXHRcdC8vIGNyZWF0ZSBET00gc3RydWN0dXJlIGZvciBhYnNvbHV0ZSBuYXZpZ2F0aW9uXHJcblx0XHRpZiAoIXNldHRpbmdzLmRvdHNEYXRhKSB7XHJcblx0XHRcdHRoaXMuX3RlbXBsYXRlcyA9IFsgJCgnPGJ1dHRvbiByb2xlPVwiYnV0dG9uXCI+JylcclxuXHRcdFx0XHQuYWRkQ2xhc3Moc2V0dGluZ3MuZG90Q2xhc3MpXHJcblx0XHRcdFx0LmFwcGVuZCgkKCc8c3Bhbj4nKSlcclxuXHRcdFx0XHQucHJvcCgnb3V0ZXJIVE1MJykgXTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9jb250cm9scy4kYWJzb2x1dGUgPSAoc2V0dGluZ3MuZG90c0NvbnRhaW5lciA/ICQoc2V0dGluZ3MuZG90c0NvbnRhaW5lcilcclxuXHRcdFx0OiAkKCc8ZGl2PicpLmFkZENsYXNzKHNldHRpbmdzLmRvdHNDbGFzcykuYXBwZW5kVG8odGhpcy4kZWxlbWVudCkpLmFkZENsYXNzKCdkaXNhYmxlZCcpO1xyXG5cclxuXHRcdHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZS5vbignY2xpY2snLCAnYnV0dG9uJywgJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdHZhciBpbmRleCA9ICQoZS50YXJnZXQpLnBhcmVudCgpLmlzKHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZSlcclxuXHRcdFx0XHQ/ICQoZS50YXJnZXQpLmluZGV4KCkgOiAkKGUudGFyZ2V0KS5wYXJlbnQoKS5pbmRleCgpO1xyXG5cclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0dGhpcy50byhpbmRleCwgc2V0dGluZ3MuZG90c1NwZWVkKTtcclxuXHRcdH0sIHRoaXMpKTtcclxuXHJcblx0XHQvKiRlbC5vbignZm9jdXNpbicsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHQkKGRvY3VtZW50KS5vZmYoXCIuY2Fyb3VzZWxcIik7XHJcblxyXG5cdFx0XHQkKGRvY3VtZW50KS5vbigna2V5ZG93bi5jYXJvdXNlbCcsIGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZihlLmtleUNvZGUgPT0gMzcpIHtcclxuXHRcdFx0XHRcdCRlbC50cmlnZ2VyKCdwcmV2Lm93bCcpXHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmKGUua2V5Q29kZSA9PSAzOSkge1xyXG5cdFx0XHRcdFx0JGVsLnRyaWdnZXIoJ25leHQub3dsJylcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7Ki9cclxuXHJcblx0XHQvLyBvdmVycmlkZSBwdWJsaWMgbWV0aG9kcyBvZiB0aGUgY2Fyb3VzZWxcclxuXHRcdGZvciAob3ZlcnJpZGUgaW4gdGhpcy5fb3ZlcnJpZGVzKSB7XHJcblx0XHRcdHRoaXMuX2NvcmVbb3ZlcnJpZGVdID0gJC5wcm94eSh0aGlzW292ZXJyaWRlXSwgdGhpcyk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGVzdHJveXMgdGhlIHBsdWdpbi5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICovXHJcblx0TmF2aWdhdGlvbi5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGhhbmRsZXIsIGNvbnRyb2wsIHByb3BlcnR5LCBvdmVycmlkZSwgc2V0dGluZ3M7XHJcblx0XHRzZXR0aW5ncyA9IHRoaXMuX2NvcmUuc2V0dGluZ3M7XHJcblxyXG5cdFx0Zm9yIChoYW5kbGVyIGluIHRoaXMuX2hhbmRsZXJzKSB7XHJcblx0XHRcdHRoaXMuJGVsZW1lbnQub2ZmKGhhbmRsZXIsIHRoaXMuX2hhbmRsZXJzW2hhbmRsZXJdKTtcclxuXHRcdH1cclxuXHRcdGZvciAoY29udHJvbCBpbiB0aGlzLl9jb250cm9scykge1xyXG5cdFx0XHRpZiAoY29udHJvbCA9PT0gJyRyZWxhdGl2ZScgJiYgc2V0dGluZ3MubmF2Q29udGFpbmVyKSB7XHJcblx0XHRcdFx0dGhpcy5fY29udHJvbHNbY29udHJvbF0uaHRtbCgnJyk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dGhpcy5fY29udHJvbHNbY29udHJvbF0ucmVtb3ZlKCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdGZvciAob3ZlcnJpZGUgaW4gdGhpcy5vdmVyaWRlcykge1xyXG5cdFx0XHR0aGlzLl9jb3JlW292ZXJyaWRlXSA9IHRoaXMuX292ZXJyaWRlc1tvdmVycmlkZV07XHJcblx0XHR9XHJcblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XHJcblx0XHRcdHR5cGVvZiB0aGlzW3Byb3BlcnR5XSAhPSAnZnVuY3Rpb24nICYmICh0aGlzW3Byb3BlcnR5XSA9IG51bGwpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFVwZGF0ZXMgdGhlIGludGVybmFsIHN0YXRlLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBpLCBqLCBrLFxyXG5cdFx0XHRsb3dlciA9IHRoaXMuX2NvcmUuY2xvbmVzKCkubGVuZ3RoIC8gMixcclxuXHRcdFx0dXBwZXIgPSBsb3dlciArIHRoaXMuX2NvcmUuaXRlbXMoKS5sZW5ndGgsXHJcblx0XHRcdG1heGltdW0gPSB0aGlzLl9jb3JlLm1heGltdW0odHJ1ZSksXHJcblx0XHRcdHNldHRpbmdzID0gdGhpcy5fY29yZS5zZXR0aW5ncyxcclxuXHRcdFx0c2l6ZSA9IHNldHRpbmdzLmNlbnRlciB8fCBzZXR0aW5ncy5hdXRvV2lkdGggfHwgc2V0dGluZ3MuZG90c0RhdGFcclxuXHRcdFx0XHQ/IDEgOiBzZXR0aW5ncy5kb3RzRWFjaCB8fCBzZXR0aW5ncy5pdGVtcztcclxuXHJcblx0XHRpZiAoc2V0dGluZ3Muc2xpZGVCeSAhPT0gJ3BhZ2UnKSB7XHJcblx0XHRcdHNldHRpbmdzLnNsaWRlQnkgPSBNYXRoLm1pbihzZXR0aW5ncy5zbGlkZUJ5LCBzZXR0aW5ncy5pdGVtcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHNldHRpbmdzLmRvdHMgfHwgc2V0dGluZ3Muc2xpZGVCeSA9PSAncGFnZScpIHtcclxuXHRcdFx0dGhpcy5fcGFnZXMgPSBbXTtcclxuXHJcblx0XHRcdGZvciAoaSA9IGxvd2VyLCBqID0gMCwgayA9IDA7IGkgPCB1cHBlcjsgaSsrKSB7XHJcblx0XHRcdFx0aWYgKGogPj0gc2l6ZSB8fCBqID09PSAwKSB7XHJcblx0XHRcdFx0XHR0aGlzLl9wYWdlcy5wdXNoKHtcclxuXHRcdFx0XHRcdFx0c3RhcnQ6IE1hdGgubWluKG1heGltdW0sIGkgLSBsb3dlciksXHJcblx0XHRcdFx0XHRcdGVuZDogaSAtIGxvd2VyICsgc2l6ZSAtIDFcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdFx0aWYgKE1hdGgubWluKG1heGltdW0sIGkgLSBsb3dlcikgPT09IG1heGltdW0pIHtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRqID0gMCwgKytrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRqICs9IHRoaXMuX2NvcmUubWVyZ2Vycyh0aGlzLl9jb3JlLnJlbGF0aXZlKGkpKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERyYXdzIHRoZSB1c2VyIGludGVyZmFjZS5cclxuXHQgKiBAdG9kbyBUaGUgb3B0aW9uIGBkb3RzRGF0YWAgd29udCB3b3JrLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS5kcmF3ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgZGlmZmVyZW5jZSxcclxuXHRcdFx0c2V0dGluZ3MgPSB0aGlzLl9jb3JlLnNldHRpbmdzLFxyXG5cdFx0XHRkaXNhYmxlZCA9IHRoaXMuX2NvcmUuaXRlbXMoKS5sZW5ndGggPD0gc2V0dGluZ3MuaXRlbXMsXHJcblx0XHRcdGluZGV4ID0gdGhpcy5fY29yZS5yZWxhdGl2ZSh0aGlzLl9jb3JlLmN1cnJlbnQoKSksXHJcblx0XHRcdGxvb3AgPSBzZXR0aW5ncy5sb29wIHx8IHNldHRpbmdzLnJld2luZDtcclxuXHJcblx0XHR0aGlzLl9jb250cm9scy4kcmVsYXRpdmUudG9nZ2xlQ2xhc3MoJ2Rpc2FibGVkJywgIXNldHRpbmdzLm5hdiB8fCBkaXNhYmxlZCk7XHJcblxyXG5cdFx0aWYgKHNldHRpbmdzLm5hdikge1xyXG5cdFx0XHR0aGlzLl9jb250cm9scy4kcHJldmlvdXMudG9nZ2xlQ2xhc3MoJ2Rpc2FibGVkJywgIWxvb3AgJiYgaW5kZXggPD0gdGhpcy5fY29yZS5taW5pbXVtKHRydWUpKTtcclxuXHRcdFx0dGhpcy5fY29udHJvbHMuJG5leHQudG9nZ2xlQ2xhc3MoJ2Rpc2FibGVkJywgIWxvb3AgJiYgaW5kZXggPj0gdGhpcy5fY29yZS5tYXhpbXVtKHRydWUpKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9jb250cm9scy4kYWJzb2x1dGUudG9nZ2xlQ2xhc3MoJ2Rpc2FibGVkJywgIXNldHRpbmdzLmRvdHMgfHwgZGlzYWJsZWQpO1xyXG5cclxuXHRcdGlmIChzZXR0aW5ncy5kb3RzKSB7XHJcblx0XHRcdGRpZmZlcmVuY2UgPSB0aGlzLl9wYWdlcy5sZW5ndGggLSB0aGlzLl9jb250cm9scy4kYWJzb2x1dGUuY2hpbGRyZW4oKS5sZW5ndGg7XHJcblxyXG5cdFx0XHRpZiAoc2V0dGluZ3MuZG90c0RhdGEgJiYgZGlmZmVyZW5jZSAhPT0gMCkge1xyXG5cdFx0XHRcdHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZS5odG1sKHRoaXMuX3RlbXBsYXRlcy5qb2luKCcnKSk7XHJcblx0XHRcdH0gZWxzZSBpZiAoZGlmZmVyZW5jZSA+IDApIHtcclxuXHRcdFx0XHR0aGlzLl9jb250cm9scy4kYWJzb2x1dGUuYXBwZW5kKG5ldyBBcnJheShkaWZmZXJlbmNlICsgMSkuam9pbih0aGlzLl90ZW1wbGF0ZXNbMF0pKTtcclxuXHRcdFx0fSBlbHNlIGlmIChkaWZmZXJlbmNlIDwgMCkge1xyXG5cdFx0XHRcdHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZS5jaGlsZHJlbigpLnNsaWNlKGRpZmZlcmVuY2UpLnJlbW92ZSgpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLl9jb250cm9scy4kYWJzb2x1dGUuZmluZCgnLmFjdGl2ZScpLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTtcclxuXHRcdFx0dGhpcy5fY29udHJvbHMuJGFic29sdXRlLmNoaWxkcmVuKCkuZXEoJC5pbkFycmF5KHRoaXMuY3VycmVudCgpLCB0aGlzLl9wYWdlcykpLmFkZENsYXNzKCdhY3RpdmUnKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBFeHRlbmRzIGV2ZW50IGRhdGEuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50IG9iamVjdCB3aGljaCBnZXRzIHRocm93bi5cclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS5vblRyaWdnZXIgPSBmdW5jdGlvbihldmVudCkge1xyXG5cdFx0dmFyIHNldHRpbmdzID0gdGhpcy5fY29yZS5zZXR0aW5ncztcclxuXHJcblx0XHRldmVudC5wYWdlID0ge1xyXG5cdFx0XHRpbmRleDogJC5pbkFycmF5KHRoaXMuY3VycmVudCgpLCB0aGlzLl9wYWdlcyksXHJcblx0XHRcdGNvdW50OiB0aGlzLl9wYWdlcy5sZW5ndGgsXHJcblx0XHRcdHNpemU6IHNldHRpbmdzICYmIChzZXR0aW5ncy5jZW50ZXIgfHwgc2V0dGluZ3MuYXV0b1dpZHRoIHx8IHNldHRpbmdzLmRvdHNEYXRhXHJcblx0XHRcdFx0PyAxIDogc2V0dGluZ3MuZG90c0VhY2ggfHwgc2V0dGluZ3MuaXRlbXMpXHJcblx0XHR9O1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgdGhlIGN1cnJlbnQgcGFnZSBwb3NpdGlvbiBvZiB0aGUgY2Fyb3VzZWwuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9XHJcblx0ICovXHJcblx0TmF2aWdhdGlvbi5wcm90b3R5cGUuY3VycmVudCA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGN1cnJlbnQgPSB0aGlzLl9jb3JlLnJlbGF0aXZlKHRoaXMuX2NvcmUuY3VycmVudCgpKTtcclxuXHRcdHJldHVybiAkLmdyZXAodGhpcy5fcGFnZXMsICQucHJveHkoZnVuY3Rpb24ocGFnZSwgaW5kZXgpIHtcclxuXHRcdFx0cmV0dXJuIHBhZ2Uuc3RhcnQgPD0gY3VycmVudCAmJiBwYWdlLmVuZCA+PSBjdXJyZW50O1xyXG5cdFx0fSwgdGhpcykpLnBvcCgpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgdGhlIGN1cnJlbnQgc3VjY2Vzb3IvcHJlZGVjZXNzb3IgcG9zaXRpb24uXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9XHJcblx0ICovXHJcblx0TmF2aWdhdGlvbi5wcm90b3R5cGUuZ2V0UG9zaXRpb24gPSBmdW5jdGlvbihzdWNjZXNzb3IpIHtcclxuXHRcdHZhciBwb3NpdGlvbiwgbGVuZ3RoLFxyXG5cdFx0XHRzZXR0aW5ncyA9IHRoaXMuX2NvcmUuc2V0dGluZ3M7XHJcblxyXG5cdFx0aWYgKHNldHRpbmdzLnNsaWRlQnkgPT0gJ3BhZ2UnKSB7XHJcblx0XHRcdHBvc2l0aW9uID0gJC5pbkFycmF5KHRoaXMuY3VycmVudCgpLCB0aGlzLl9wYWdlcyk7XHJcblx0XHRcdGxlbmd0aCA9IHRoaXMuX3BhZ2VzLmxlbmd0aDtcclxuXHRcdFx0c3VjY2Vzc29yID8gKytwb3NpdGlvbiA6IC0tcG9zaXRpb247XHJcblx0XHRcdHBvc2l0aW9uID0gdGhpcy5fcGFnZXNbKChwb3NpdGlvbiAlIGxlbmd0aCkgKyBsZW5ndGgpICUgbGVuZ3RoXS5zdGFydDtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHBvc2l0aW9uID0gdGhpcy5fY29yZS5yZWxhdGl2ZSh0aGlzLl9jb3JlLmN1cnJlbnQoKSk7XHJcblx0XHRcdGxlbmd0aCA9IHRoaXMuX2NvcmUuaXRlbXMoKS5sZW5ndGg7XHJcblx0XHRcdHN1Y2Nlc3NvciA/IHBvc2l0aW9uICs9IHNldHRpbmdzLnNsaWRlQnkgOiBwb3NpdGlvbiAtPSBzZXR0aW5ncy5zbGlkZUJ5O1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBwb3NpdGlvbjtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTbGlkZXMgdG8gdGhlIG5leHQgaXRlbSBvciBwYWdlLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3NwZWVkPWZhbHNlXSAtIFRoZSB0aW1lIGluIG1pbGxpc2Vjb25kcyBmb3IgdGhlIHRyYW5zaXRpb24uXHJcblx0ICovXHJcblx0TmF2aWdhdGlvbi5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uKHNwZWVkKSB7XHJcblx0XHQkLnByb3h5KHRoaXMuX292ZXJyaWRlcy50bywgdGhpcy5fY29yZSkodGhpcy5nZXRQb3NpdGlvbih0cnVlKSwgc3BlZWQpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNsaWRlcyB0byB0aGUgcHJldmlvdXMgaXRlbSBvciBwYWdlLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3NwZWVkPWZhbHNlXSAtIFRoZSB0aW1lIGluIG1pbGxpc2Vjb25kcyBmb3IgdGhlIHRyYW5zaXRpb24uXHJcblx0ICovXHJcblx0TmF2aWdhdGlvbi5wcm90b3R5cGUucHJldiA9IGZ1bmN0aW9uKHNwZWVkKSB7XHJcblx0XHQkLnByb3h5KHRoaXMuX292ZXJyaWRlcy50bywgdGhpcy5fY29yZSkodGhpcy5nZXRQb3NpdGlvbihmYWxzZSksIHNwZWVkKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTbGlkZXMgdG8gdGhlIHNwZWNpZmllZCBpdGVtIG9yIHBhZ2UuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBwb3NpdGlvbiAtIFRoZSBwb3NpdGlvbiBvZiB0aGUgaXRlbSBvciBwYWdlLlxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbc3BlZWRdIC0gVGhlIHRpbWUgaW4gbWlsbGlzZWNvbmRzIGZvciB0aGUgdHJhbnNpdGlvbi5cclxuXHQgKiBAcGFyYW0ge0Jvb2xlYW59IFtzdGFuZGFyZD1mYWxzZV0gLSBXaGV0aGVyIHRvIHVzZSB0aGUgc3RhbmRhcmQgYmVoYXZpb3VyIG9yIG5vdC5cclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS50byA9IGZ1bmN0aW9uKHBvc2l0aW9uLCBzcGVlZCwgc3RhbmRhcmQpIHtcclxuXHRcdHZhciBsZW5ndGg7XHJcblxyXG5cdFx0aWYgKCFzdGFuZGFyZCAmJiB0aGlzLl9wYWdlcy5sZW5ndGgpIHtcclxuXHRcdFx0bGVuZ3RoID0gdGhpcy5fcGFnZXMubGVuZ3RoO1xyXG5cdFx0XHQkLnByb3h5KHRoaXMuX292ZXJyaWRlcy50bywgdGhpcy5fY29yZSkodGhpcy5fcGFnZXNbKChwb3NpdGlvbiAlIGxlbmd0aCkgKyBsZW5ndGgpICUgbGVuZ3RoXS5zdGFydCwgc3BlZWQpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0JC5wcm94eSh0aGlzLl9vdmVycmlkZXMudG8sIHRoaXMuX2NvcmUpKHBvc2l0aW9uLCBzcGVlZCk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0JC5mbi5vd2xDYXJvdXNlbC5Db25zdHJ1Y3Rvci5QbHVnaW5zLk5hdmlnYXRpb24gPSBOYXZpZ2F0aW9uO1xyXG5cclxufSkod2luZG93LlplcHRvIHx8IHdpbmRvdy5qUXVlcnksIHdpbmRvdywgZG9jdW1lbnQpO1xyXG5cclxuLyoqXHJcbiAqIEhhc2ggUGx1Z2luXHJcbiAqIEB2ZXJzaW9uIDIuMy4zXHJcbiAqIEBhdXRob3IgQXJ0dXMgS29sYW5vd3NraVxyXG4gKiBAYXV0aG9yIERhdmlkIERldXRzY2hcclxuICogQGxpY2Vuc2UgVGhlIE1JVCBMaWNlbnNlIChNSVQpXHJcbiAqL1xyXG47KGZ1bmN0aW9uKCQsIHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlcyB0aGUgaGFzaCBwbHVnaW4uXHJcblx0ICogQGNsYXNzIFRoZSBIYXNoIFBsdWdpblxyXG5cdCAqIEBwYXJhbSB7T3dsfSBjYXJvdXNlbCAtIFRoZSBPd2wgQ2Fyb3VzZWxcclxuXHQgKi9cclxuXHR2YXIgSGFzaCA9IGZ1bmN0aW9uKGNhcm91c2VsKSB7XHJcblx0XHQvKipcclxuXHRcdCAqIFJlZmVyZW5jZSB0byB0aGUgY29yZS5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPd2x9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2NvcmUgPSBjYXJvdXNlbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEhhc2ggaW5kZXggZm9yIHRoZSBpdGVtcy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2hhc2hlcyA9IHt9O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVGhlIGNhcm91c2VsIGVsZW1lbnQuXHJcblx0XHQgKiBAdHlwZSB7alF1ZXJ5fVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLiRlbGVtZW50ID0gdGhpcy5fY29yZS4kZWxlbWVudDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFsbCBldmVudCBoYW5kbGVycy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2hhbmRsZXJzID0ge1xyXG5cdFx0XHQnaW5pdGlhbGl6ZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3Muc3RhcnRQb3NpdGlvbiA9PT0gJ1VSTEhhc2gnKSB7XHJcblx0XHRcdFx0XHQkKHdpbmRvdykudHJpZ2dlcignaGFzaGNoYW5nZS5vd2wubmF2aWdhdGlvbicpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdwcmVwYXJlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UpIHtcclxuXHRcdFx0XHRcdHZhciBoYXNoID0gJChlLmNvbnRlbnQpLmZpbmQoJ1tkYXRhLWhhc2hdJykuYWRkQmFjaygnW2RhdGEtaGFzaF0nKS5hdHRyKCdkYXRhLWhhc2gnKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoIWhhc2gpIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHRoaXMuX2hhc2hlc1toYXNoXSA9IGUuY29udGVudDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQnY2hhbmdlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgZS5wcm9wZXJ0eS5uYW1lID09PSAncG9zaXRpb24nKSB7XHJcblx0XHRcdFx0XHR2YXIgY3VycmVudCA9IHRoaXMuX2NvcmUuaXRlbXModGhpcy5fY29yZS5yZWxhdGl2ZSh0aGlzLl9jb3JlLmN1cnJlbnQoKSkpLFxyXG5cdFx0XHRcdFx0XHRoYXNoID0gJC5tYXAodGhpcy5faGFzaGVzLCBmdW5jdGlvbihpdGVtLCBoYXNoKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGl0ZW0gPT09IGN1cnJlbnQgPyBoYXNoIDogbnVsbDtcclxuXHRcdFx0XHRcdFx0fSkuam9pbigpO1xyXG5cclxuXHRcdFx0XHRcdGlmICghaGFzaCB8fCB3aW5kb3cubG9jYXRpb24uaGFzaC5zbGljZSgxKSA9PT0gaGFzaCkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0d2luZG93LmxvY2F0aW9uLmhhc2ggPSBoYXNoO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcylcclxuXHRcdH07XHJcblxyXG5cdFx0Ly8gc2V0IGRlZmF1bHQgb3B0aW9uc1xyXG5cdFx0dGhpcy5fY29yZS5vcHRpb25zID0gJC5leHRlbmQoe30sIEhhc2guRGVmYXVsdHMsIHRoaXMuX2NvcmUub3B0aW9ucyk7XHJcblxyXG5cdFx0Ly8gcmVnaXN0ZXIgdGhlIGV2ZW50IGhhbmRsZXJzXHJcblx0XHR0aGlzLiRlbGVtZW50Lm9uKHRoaXMuX2hhbmRsZXJzKTtcclxuXHJcblx0XHQvLyByZWdpc3RlciBldmVudCBsaXN0ZW5lciBmb3IgaGFzaCBuYXZpZ2F0aW9uXHJcblx0XHQkKHdpbmRvdykub24oJ2hhc2hjaGFuZ2Uub3dsLm5hdmlnYXRpb24nLCAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0dmFyIGhhc2ggPSB3aW5kb3cubG9jYXRpb24uaGFzaC5zdWJzdHJpbmcoMSksXHJcblx0XHRcdFx0aXRlbXMgPSB0aGlzLl9jb3JlLiRzdGFnZS5jaGlsZHJlbigpLFxyXG5cdFx0XHRcdHBvc2l0aW9uID0gdGhpcy5faGFzaGVzW2hhc2hdICYmIGl0ZW1zLmluZGV4KHRoaXMuX2hhc2hlc1toYXNoXSk7XHJcblxyXG5cdFx0XHRpZiAocG9zaXRpb24gPT09IHVuZGVmaW5lZCB8fCBwb3NpdGlvbiA9PT0gdGhpcy5fY29yZS5jdXJyZW50KCkpIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX2NvcmUudG8odGhpcy5fY29yZS5yZWxhdGl2ZShwb3NpdGlvbiksIGZhbHNlLCB0cnVlKTtcclxuXHRcdH0sIHRoaXMpKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdEhhc2guRGVmYXVsdHMgPSB7XHJcblx0XHRVUkxoYXNoTGlzdGVuZXI6IGZhbHNlXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGVzdHJveXMgdGhlIHBsdWdpbi5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0SGFzaC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGhhbmRsZXIsIHByb3BlcnR5O1xyXG5cclxuXHRcdCQod2luZG93KS5vZmYoJ2hhc2hjaGFuZ2Uub3dsLm5hdmlnYXRpb24nKTtcclxuXHJcblx0XHRmb3IgKGhhbmRsZXIgaW4gdGhpcy5faGFuZGxlcnMpIHtcclxuXHRcdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vZmYoaGFuZGxlciwgdGhpcy5faGFuZGxlcnNbaGFuZGxlcl0pO1xyXG5cdFx0fVxyXG5cdFx0Zm9yIChwcm9wZXJ0eSBpbiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0aGlzKSkge1xyXG5cdFx0XHR0eXBlb2YgdGhpc1twcm9wZXJ0eV0gIT0gJ2Z1bmN0aW9uJyAmJiAodGhpc1twcm9wZXJ0eV0gPSBudWxsKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQkLmZuLm93bENhcm91c2VsLkNvbnN0cnVjdG9yLlBsdWdpbnMuSGFzaCA9IEhhc2g7XHJcblxyXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7XHJcblxyXG4vKipcclxuICogU3VwcG9ydCBQbHVnaW5cclxuICpcclxuICogQHZlcnNpb24gMi4zLjNcclxuICogQGF1dGhvciBWaXZpZCBQbGFuZXQgU29mdHdhcmUgR21iSFxyXG4gKiBAYXV0aG9yIEFydHVzIEtvbGFub3dza2lcclxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXHJcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4gKi9cclxuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcclxuXHJcblx0dmFyIHN0eWxlID0gJCgnPHN1cHBvcnQ+JykuZ2V0KDApLnN0eWxlLFxyXG5cdFx0cHJlZml4ZXMgPSAnV2Via2l0IE1veiBPIG1zJy5zcGxpdCgnICcpLFxyXG5cdFx0ZXZlbnRzID0ge1xyXG5cdFx0XHR0cmFuc2l0aW9uOiB7XHJcblx0XHRcdFx0ZW5kOiB7XHJcblx0XHRcdFx0XHRXZWJraXRUcmFuc2l0aW9uOiAnd2Via2l0VHJhbnNpdGlvbkVuZCcsXHJcblx0XHRcdFx0XHRNb3pUcmFuc2l0aW9uOiAndHJhbnNpdGlvbmVuZCcsXHJcblx0XHRcdFx0XHRPVHJhbnNpdGlvbjogJ29UcmFuc2l0aW9uRW5kJyxcclxuXHRcdFx0XHRcdHRyYW5zaXRpb246ICd0cmFuc2l0aW9uZW5kJ1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSxcclxuXHRcdFx0YW5pbWF0aW9uOiB7XHJcblx0XHRcdFx0ZW5kOiB7XHJcblx0XHRcdFx0XHRXZWJraXRBbmltYXRpb246ICd3ZWJraXRBbmltYXRpb25FbmQnLFxyXG5cdFx0XHRcdFx0TW96QW5pbWF0aW9uOiAnYW5pbWF0aW9uZW5kJyxcclxuXHRcdFx0XHRcdE9BbmltYXRpb246ICdvQW5pbWF0aW9uRW5kJyxcclxuXHRcdFx0XHRcdGFuaW1hdGlvbjogJ2FuaW1hdGlvbmVuZCdcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0sXHJcblx0XHR0ZXN0cyA9IHtcclxuXHRcdFx0Y3NzdHJhbnNmb3JtczogZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0cmV0dXJuICEhdGVzdCgndHJhbnNmb3JtJyk7XHJcblx0XHRcdH0sXHJcblx0XHRcdGNzc3RyYW5zZm9ybXMzZDogZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0cmV0dXJuICEhdGVzdCgncGVyc3BlY3RpdmUnKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0Y3NzdHJhbnNpdGlvbnM6IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdHJldHVybiAhIXRlc3QoJ3RyYW5zaXRpb24nKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0Y3NzYW5pbWF0aW9uczogZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0cmV0dXJuICEhdGVzdCgnYW5pbWF0aW9uJyk7XHJcblx0XHRcdH1cclxuXHRcdH07XHJcblxyXG5cdGZ1bmN0aW9uIHRlc3QocHJvcGVydHksIHByZWZpeGVkKSB7XHJcblx0XHR2YXIgcmVzdWx0ID0gZmFsc2UsXHJcblx0XHRcdHVwcGVyID0gcHJvcGVydHkuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBwcm9wZXJ0eS5zbGljZSgxKTtcclxuXHJcblx0XHQkLmVhY2goKHByb3BlcnR5ICsgJyAnICsgcHJlZml4ZXMuam9pbih1cHBlciArICcgJykgKyB1cHBlcikuc3BsaXQoJyAnKSwgZnVuY3Rpb24oaSwgcHJvcGVydHkpIHtcclxuXHRcdFx0aWYgKHN0eWxlW3Byb3BlcnR5XSAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdFx0cmVzdWx0ID0gcHJlZml4ZWQgPyBwcm9wZXJ0eSA6IHRydWU7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblx0XHRyZXR1cm4gcmVzdWx0O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcHJlZml4ZWQocHJvcGVydHkpIHtcclxuXHRcdHJldHVybiB0ZXN0KHByb3BlcnR5LCB0cnVlKTtcclxuXHR9XHJcblxyXG5cdGlmICh0ZXN0cy5jc3N0cmFuc2l0aW9ucygpKSB7XHJcblx0XHQvKiBqc2hpbnQgLVcwNTMgKi9cclxuXHRcdCQuc3VwcG9ydC50cmFuc2l0aW9uID0gbmV3IFN0cmluZyhwcmVmaXhlZCgndHJhbnNpdGlvbicpKVxyXG5cdFx0JC5zdXBwb3J0LnRyYW5zaXRpb24uZW5kID0gZXZlbnRzLnRyYW5zaXRpb24uZW5kWyAkLnN1cHBvcnQudHJhbnNpdGlvbiBdO1xyXG5cdH1cclxuXHJcblx0aWYgKHRlc3RzLmNzc2FuaW1hdGlvbnMoKSkge1xyXG5cdFx0LyoganNoaW50IC1XMDUzICovXHJcblx0XHQkLnN1cHBvcnQuYW5pbWF0aW9uID0gbmV3IFN0cmluZyhwcmVmaXhlZCgnYW5pbWF0aW9uJykpXHJcblx0XHQkLnN1cHBvcnQuYW5pbWF0aW9uLmVuZCA9IGV2ZW50cy5hbmltYXRpb24uZW5kWyAkLnN1cHBvcnQuYW5pbWF0aW9uIF07XHJcblx0fVxyXG5cclxuXHRpZiAodGVzdHMuY3NzdHJhbnNmb3JtcygpKSB7XHJcblx0XHQvKiBqc2hpbnQgLVcwNTMgKi9cclxuXHRcdCQuc3VwcG9ydC50cmFuc2Zvcm0gPSBuZXcgU3RyaW5nKHByZWZpeGVkKCd0cmFuc2Zvcm0nKSk7XHJcblx0XHQkLnN1cHBvcnQudHJhbnNmb3JtM2QgPSB0ZXN0cy5jc3N0cmFuc2Zvcm1zM2QoKTtcclxuXHR9XHJcblxyXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7Il0sImZpbGUiOiJvd2wuY2Fyb3VzZWwuanMifQ==
