window.theme = window.theme || {};

theme.a11y = {

  /**
     * Traps the focus in a particular container
     *
     * @param {object} options - Options to be used
     * @param {jQuery} options.$container - Container to trap focus within
     * @param {jQuery} options.$elementToFocus - Element to be focused when focus leaves container
     * @param {string} options.namespace - Namespace used for new focus event handler
     */
    trapFocus: function(options) {
      var eventsName = {
        focusin: options.namespace ? 'focusin.' + options.namespace : 'focusin',
        focusout: options.namespace
          ? 'focusout.' + options.namespace
          : 'focusout',
        keydown: options.namespace
          ? 'keydown.' + options.namespace
          : 'keydown.handleFocus'
      };

      /**
       * Get every possible visible focusable element
       */
      var $focusableElements = options.$container.find(
        $(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex^="-"])'
        ).filter(':visible')
      );
      var firstFocusable = $focusableElements[0];
      var lastFocusable = $focusableElements[$focusableElements.length - 1];

      if (!options.$elementToFocus) {
        options.$elementToFocus = options.$container;
      }

      function _manageFocus(evt) {
        // Tab key
        if (evt.keyCode !== 9) return;

        /**
         * On the last focusable element and tab forward,
         * focus the first element.
         */
        if (evt.target === lastFocusable && !evt.shiftKey) {
          evt.preventDefault();
          firstFocusable.focus();
        }
        /**
         * On the first focusable element and tab backward,
         * focus the last element.
         */
        if (evt.target === firstFocusable && evt.shiftKey) {
          evt.preventDefault();
          lastFocusable.focus();
        }
      }

      options.$container.attr('tabindex', '-1');
      options.$elementToFocus.focus();

      $(document).off('focusin');

      $(document).on(eventsName.focusout, function() {
        $(document).off(eventsName.keydown);
      });

      $(document).on(eventsName.focusin, function(evt) {
        if (evt.target !== lastFocusable && evt.target !== firstFocusable) return;

        $(document).on(eventsName.keydown, function(evt) {
          _manageFocus(evt);
        });
      });
    },

  /**
   * Removes the trap of focus in a particular container
   *
   * @param {object} options - Options to be used
   * @param {jQuery} options.$container - Container to trap focus within
   * @param {string} options.namespace - Namespace used for new focus event handler
   */
  removeTrapFocus: function(options) {
    var eventName = options.namespace
      ? 'focusin.' + options.namespace
      : 'focusin';

    if (options.$container && options.$container.length) {
      options.$container.removeAttr('tabindex');
    }

    $(document).off(eventName);
  },

  lockMobileScrolling: function(namespace, $element) {
    if ($element) {
      var $el = $element;
    } else {
      var $el = $(document.documentElement).add('body');
    }
    $el.on('touchmove' + namespace, function () {
      return false;
    });
  },

  unlockMobileScrolling: function(namespace, $element) {
    if ($element) {
      var $el = $element;
    } else {
      var $el = $(document.documentElement).add('body');
    }
    $el.off(namespace);
  },

  promiseAnimationEnd: function($el) {
    var events = 'animationend webkitAnimationEnd oAnimationEnd';
    var properties = ['animation-duration', '-moz-animation-duration', '-webkit-animation-duration', '-o-animation-duration'];
    var duration = 0;
    var promise = $.Deferred().resolve();

    // check the various CSS properties to see if a duration has been set
    $.each(properties, function(index, value) {
      duration || (duration = parseFloat($el.css(value)));
    });

    if (duration > 0) {
      promise = $.Deferred(function(defer) {
        $el.on(events, function(evt) {
          if (evt.target !== $el[0]) return;
          $el.off(events);
          defer.resolve();
        });
      });
    }

    return promise;
  },

  promiseTransitionEnd: function($el) {
    var events = 'webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend';
    var properties = ['transition-duration', '-moz-transition-duration', '-webkit-transition-duration', '-o-transition-duration'];
    var duration = 0;
    var promise = $.Deferred().resolve();

    // check the various CSS properties to see if a duration has been set
    $.each(properties, function(index, value) {
      duration || (duration = parseFloat($el.css(value)));
    });

    if (duration > 0) {
      promise = $.Deferred(function(defer) {
        $el.on(events, function(evt) {
          if (evt.target !== $el[0]) return;
          $el.off(events);
          defer.resolve();
        });
      });
    }

    return promise;
  }
};

theme.Sections = function Sections() {
  this.constructors = {};
  this.instances = [];

  $(document)
    .on('shopify:section:load', this._onSectionLoad.bind(this))
    .on('shopify:section:unload', this._onSectionUnload.bind(this))
    .on('shopify:section:select', this._onSelect.bind(this))
    .on('shopify:section:deselect', this._onDeselect.bind(this))
    .on('shopify:block:select', this._onBlockSelect.bind(this))
    .on('shopify:block:deselect', this._onBlockDeselect.bind(this));
};

theme.Sections.prototype = $.extend({}, theme.Sections.prototype, {
  createInstance: function(container, constructor, customScope) {
    var $container = $(container);
    var id = $container.attr('data-section-id');
    var type = $container.attr('data-section-type');

    constructor = constructor || this.constructors[type];

    if (typeof constructor === 'undefined') {
      return;
    }

    // If custom scope passed, check to see if instance
    // is already initialized so we don't double up
    if (customScope) {
      var instanceExists = this._findInstance(id);
      if (instanceExists) {
        return;
      }
    }

    var instance = $.extend(new constructor(container), {
      id: id,
      type: type,
      container: container,
      namespace: '.' + type + '-' + id
    });

    this.instances.push(instance);
  },

  _onSectionLoad: function(evt, subSection, subSectionId) {
    if (AOS) {
      AOS.refreshHard();
    }

    var container = subSection ? subSection : $('[data-section-id]', evt.target)[0];

    if (!container) {
      return;
    }

    this.createInstance(container);

    var instance = subSection ? subSectionId : this._findInstance(evt.detail.sectionId);

    if (!subSection) {
      this.loadSubSections();
    }

    // Run JS only in case of the section being selected in the editor
    // before merchant clicks "Add"
    if (instance && typeof instance.onLoad === 'function') {
      instance.onLoad(evt);
    }
  },

  loadSubSections: function($context) {
    var $sections = $context ? $context.find('[data-subsection]') : $('[data-subsection]');

    $sections.each(function(evt, el) {
      this._onSectionLoad(null, el, $(el).data('section-id'));
    }.bind(this));

    if (AOS) {
      AOS.refreshHard();
    }
  },

  _onSectionUnload: function(evt) {
    var instance = this._removeInstance(evt.detail.sectionId);
    if (instance && typeof instance.onUnload === 'function') {
      instance.onUnload(evt);
    }
  },

  _onSelect: function(evt) {
    var instance = this._findInstance(evt.detail.sectionId);

    if (instance && typeof instance.onSelect === 'function') {
      instance.onSelect(evt);
    }
  },

  _onDeselect: function(evt) {
    var instance = this._findInstance(evt.detail.sectionId);

    if (instance && typeof instance.onDeselect === 'function') {
      instance.onDeselect(evt);
    }
  },

  _onBlockSelect: function(evt) {
    var instance = this._findInstance(evt.detail.sectionId);

    if (instance && typeof instance.onBlockSelect === 'function') {
      instance.onBlockSelect(evt);
    }
  },

  _onBlockDeselect: function(evt) {
    var instance = this._findInstance(evt.detail.sectionId);

    if (instance && typeof instance.onBlockDeselect === 'function') {
      instance.onBlockDeselect(evt);
    }
  },

  _findInstance: function(id) {
    for (var i = 0; i < this.instances.length; i++) {
      if (this.instances[i].id === id) {
        return this.instances[i];
      }
    }
  },

  _removeInstance: function(id) {
    var i = this.instances.length;
    var instance;

    while(i--) {
      if (this.instances[i].id === id) {
        instance = this.instances[i];
        this.instances.splice(i, 1);
        break;
      }
    }

    return instance;
  },

  reinitSection: function(section) {
    for (var i = 0; i < sections.instances.length; i++) {
      var instance = sections.instances[i];
      if (instance['type'] === section) {
        if (typeof instance.forceReload === 'function') {
          instance.forceReload();
        }
      }
    }
  },

  register: function(type, constructor, $scope) {
    var afterLoad = false;
    this.constructors[type] = constructor;
    var $sections = $('[data-section-type=' + type + ']');

    // Any section within the scope
    if ($scope) {
      $sections = $('[data-section-type=' + type + ']', $scope);
    }

    $sections.each(function(index, container) {
      this.createInstance(container, constructor, $scope);
    }.bind(this));
  }
});

theme.Modals = (function() {
  function Modal(id, name, options) {
    var defaults = {
      close: '.js-modal-close',
      open: '.js-modal-open-' + name,
      openClass: 'modal--is-active',
      bodyOpenClass: 'modal-open',
      closeOffContentClick: true
    };

    this.id = id;
    this.$modal = $('#' + id);

    if (!this.$modal.length) {
      return false;
    }

    this.nodes = {
      $parent: $('html').add('body'),
      $modalContent: this.$modal.find('.modal__inner')
    };

    this.config = $.extend(defaults, options);
    this.modalIsOpen = false;
    this.$focusOnOpen = this.config.focusOnOpen ? $(this.config.focusOnOpen) : this.$modal;

    this.init();
  }

  Modal.prototype.init = function() {
    var $openBtn = $(this.config.open);

    // Add aria controls
    $openBtn.attr('aria-expanded', 'false');

    $(this.config.open).on('click', this.open.bind(this));
    this.$modal.find(this.config.close).on('click', this.close.bind(this));

    // Close modal if a drawer is opened
    $('body').on('drawerOpen', function() {
      this.close();
    }.bind(this));
  };

  Modal.prototype.open = function(evt) {
    // Keep track if modal was opened from a click, or called by another function
    var externalCall = false;

    // don't open an opened modal
    if (this.modalIsOpen) {
      return;
    }

    // Prevent following href if link is clicked
    if (evt) {
      evt.preventDefault();
    } else {
      externalCall = true;
    }

    // Without this, the modal opens, the click event bubbles up to $nodes.page
    // which closes the modal.
    if (evt && evt.stopPropagation) {
      evt.stopPropagation();
      // save the source of the click, we'll focus to this on close
      this.$activeSource = $(evt.currentTarget).attr('aria-expanded', 'true');
    }

    if (this.modalIsOpen && !externalCall) {
      this.close();
    }

    this.$modal.addClass(this.config.openClass);
    this.nodes.$parent.addClass(this.config.bodyOpenClass);

    setTimeout(function() {
      this.$modal.addClass('aos-animate');
    }.bind(this), 0);

    this.modalIsOpen = true;

    theme.a11y.trapFocus({
      $container: this.$modal,
      $elementToFocus: this.$focusOnOpen,
      namespace: 'modal_focus'
    });

    $('body').trigger('modalOpen.' + this.id);

    this.bindEvents();
  };

  Modal.prototype.close = function() {
    // don't close a closed modal
    if (!this.modalIsOpen) {
      return;
    }

    // deselect any focused form elements
    $(document.activeElement).trigger('blur');

    this.$modal.removeClass(this.config.openClass).removeClass('aos-animate');
    this.nodes.$parent.removeClass(this.config.bodyOpenClass);

    this.modalIsOpen = false;

    theme.a11y.removeTrapFocus({
      $container: this.$modal,
      namespace: 'modal_focus'
    });

    if (this.$activeSource && this.$activeSource.attr('aria-expanded')) {
      this.$activeSource.attr('aria-expanded', 'false').focus();
    }

    $('body').trigger('modalClose.' + this.id);

    this.unbindEvents();
  };

  Modal.prototype.bindEvents = function() {
    // Pressing escape closes modal
    this.nodes.$parent.on('keyup.modal', function(evt) {
      if (evt.keyCode === 27) {
        this.close();
      }
    }.bind(this));

    if (this.config.closeOffContentClick) {
      // Clicking outside of the modal content also closes it
      this.$modal.on('click.modal', this.close.bind(this));

      // Exception to above: clicking anywhere on the modal content will NOT close it
      this.nodes.$modalContent.on('click.modal', function(evt) {
        evt.stopImmediatePropagation();
      });
    }
  };

  Modal.prototype.unbindEvents = function() {
    this.nodes.$parent.off('.modal');

    if (this.config.closeOffContentClick) {
      this.$modal.off('.modal');
      this.nodes.$modalContent.off('.modal');
    }
  };

  return Modal;
})();

theme.PasswordHeader = (function() {
  function PasswordHeader() {
    this.init();
  }

  PasswordHeader.prototype = $.extend({}, PasswordHeader.prototype, {
    init: function() {

      var $loginModal = $('#LoginModal');

      if (!$loginModal.length) {
        return;
      }

      var passwordModal = new theme.Modals('LoginModal', 'login-modal', {
        focusOnOpen: '#password',
        closeOffContentClick: false
      });

      // Open modal if errors exist
      if ($loginModal.find('.errors').length) {
        passwordModal.open();
      }
    }
  });

  return PasswordHeader;
})();


$(document).ready(function() {
  var sections = new theme.Sections();

  sections.register('password-header', theme.PasswordHeader);
});
