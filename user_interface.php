<?php
/**
 * Application User Interface Implementation
 *  - should be loaded as a first script after main HTML part of DOM
 *
 */
?>
<!-- APPLICATION UI COMPONENTS -->
<script type="text/javascript">
(function(window) {

    window.Dialogs = {
        MSG_INFO: { class: "", icon: '<path fill-rule="evenodd"d="M6.3 5.69a.942.942 0 0 1-.28-.7c0-.28.09-.52.28-.7.19-.18.42-.28.7-.28.28 0 .52.09.7.28.18.19.28.42.28.7 0 .28-.09.52-.28.7a1 1 0 0 1-.7.3c-.28 0-.52-.11-.7-.3zM8 7.99c-.02-.25-.11-.48-.31-.69-.2-.19-.42-.3-.69-.31H6c-.27.02-.48.13-.69.31-.2.2-.3.44-.31.69h1v3c.02.27.11.5.31.69.2.2.42.31.69.31h1c.27 0 .48-.11.69-.31.2-.19.3-.42.31-.69H8V7.98v.01zM7 2.3c-3.14 0-5.7 2.54-5.7 5.68 0 3.14 2.56 5.7 5.7 5.7s5.7-2.55 5.7-5.7c0-3.15-2.56-5.69-5.7-5.69v.01zM7 .98c3.86 0 7 3.14 7 7s-3.14 7-7 7-7-3.12-7-7 3.14-7 7-7z"/>' },
        MSG_WARN: { class: "Toast--warning", icon: '<path fill-rule="evenodd" d="M8.893 1.5c-.183-.31-.52-.5-.887-.5s-.703.19-.886.5L.138 13.499a.98.98 0 0 0 0 1.001c.193.31.53.501.886.501h13.964c.367 0 .704-.19.877-.5a1.03 1.03 0 0 0 .01-1.002L8.893 1.5zm.133 11.497H6.987v-2.003h2.039v2.003zm0-3.004H6.987V5.987h2.039v4.006z" />' },
        MSG_ERR: { class: "Toast--error", icon: '<path fill-rule="evenodd" d="M10 1H4L0 5v6l4 4h6l4-4V5l-4-4zm3 9.5L9.5 14h-5L1 10.5v-5L4.5 2h5L13 5.5v5zM6 4h2v5H6V4zm0 6h2v2H6v-2z" />' },
        _timer: null,
        _modals: {},

        init: function() {
            $("body").append(`<div id="dialogs-container" class="Toast popUpHide position-fixed" style='z-index: 5050; transform: translate(calc(50vw - 50%));'>
          <span class="Toast-icon"><svg width="12" height="16" id="notification-bar-icon" viewBox="0 0 12 16" class="octicon octicon-check" aria-hidden="true"></svg></span>
          <span id="system-notification" class="Toast-content v-align-middle height-full position-relative" style="max-width: 350px;"></span>
          <button class="Toast-dismissButton" onclick="Dialogs._hideImpl(false);">
          <svg width="12" height="16" viewBox="0 0 12 16" class="octicon octicon-x" aria-hidden="true"><path fill-rule="evenodd" d="M7.48 8l3.75 3.75-1.48 1.48L6 9.48l-3.75 3.75-1.48-1.48L4.52 8 .77 4.25l1.48-1.48L6 6.52l3.75-3.75 1.48 1.48L7.48 8z"/></svg>
          </button>
          </div>`);

            this._body = $("#dialogs-container");
            this._board = $("#system-notification");
            this._icon = $("#notification-bar-icon");

            const _this = this;

            //close all child modals if parent dies
            window.onunload = function () {
                for (let key in _this._modals) {
                    if (_this._modals.hasOwnProperty(key)) {
                        let context = _this._modals[key];
                        context.window.close();
                        _this._destroyModalWindow(key, context);
                    }
                }
            }
        },

        /**
         * Show notification
         * @param text notification, html-formatted support
         * @param delayMS miliseconds to wait before auto close
         *          use values < 1000 to not to close at all
         * @param importance Dialogs.MSG_[INFO/WARN/ERR] object
         */
        show: function (text, delayMS=5000, importance=Dialogs.MSG_INFO) {
            this._board.html(text);
            this._icon.html(importance.icon);
            this._body.removeClass(); //all
            this._body.addClass(`Toast position-fixed ${importance.class}`)
            this._body.removeClass("popUpHide");
            this._body.addClass("popUpEnter");

            if (delayMS > 1000) {
                this._timer = setTimeout(this.hide.bind(this), delayMS);
            }
        },

        /**
         * Hide notification
         */
        hide: function () {
            this._hideImpl(true);
        },

        _hideImpl: function(timeoutCleaned) {
            this._body.removeClass("popUpEnter");
            this._body.addClass("popUpHide");

            if (!timeoutCleaned && this._timer) {
                clearTimeout(this._timer);
            }
            this._timer = null;
        },

        /**
         * Show custom/dialog window
         * @param parentId unique ID of the dialog container, you can hide the window by removing this ID from DOM
         *  might not complete or remove existing ID if not unique
         * @param header HTML content to put in the header
         * @param content HTML content
         * @param footer HTML content to put to the footer
         * @param params
         * @param params.defaultHeight custom height, can be a CSS value (string) or a number (pixels)
         * @param params.allowClose whether to show 'close' button, default true
         * @param params.allowResize whether to allow user to change the window size, default false
         */
        showCustom: function(parentId, header, content, footer, params={allowClose:true}) {
            let result = this._buildComplexWindow(false, parentId, header, content, footer,
                `class="position-fixed" style="z-index:999; left: 50%;top: 50%;transform: translate(-50%,-50%);"`, params);
            if (result) $("body").append(result);
        },

        /**
         * Show custom/dialog in a separate browser window
         *  note: the window context does not have to be immediately available
         *  to get the window context, call getModalContext(..)
         *  to perform event-like calls, use the context and register appropriate events on the new window
         * @param parentId unique ID to the modals context (does not have to be unique in this DOM, it has a different one)
         * @param title non-formatted title string (for messages, window title tag...)
         * @param header HTML content to put in the header
         * @param content HTML content
         */
        showCustomModal: function(parentId, title, header, content) {
            if (this.getModalContext(parentId)) {
                console.warn("Modal window " + title + " with id '" + parentId + "' already exists.");
                return;
            }

            this._showCustomModalImpl(parentId, title, this._buildComplexWindow(true, parentId, header, content, '',
                `style="width: 100%; height: 100%"`, {defaultHeight: "100%"}));
        },

        /**
         * Gets the context of a modal window,
         * destroys and cleans the context if necessary (e.g. window was closed by the user)
         *
         * TODO sometimes ctx.window valid but does not have getElementByID etc... fix
         *
         * @param id id used to create the window
         * @returns {{self}|{window}|null} window context or undefined
         */
        getModalContext: function(id) {
            let ctx = this._modals[id];
            if (!ctx) return undefined;

            //for some reason does not work without checking 'opener' while inspector closed
            if (!ctx.window || !ctx.opener || !ctx.self) {
                this._destroyModalWindow(id, ctx);
                return null;
            }
            return ctx;
        },

        /**
         * Closes any dialog (modal or not)
         * @param id id used to create the window
         * @returns {boolean} true if managed to close
         */
        closeWindow: function(id) {
            if (!id) {
                console.error("Invalid form: unique container id not defined.");
                return false;
            }

            let node = document.getElementById(id);
            if (node && node.dataset.dialog !== "true") {
                console.error("Invalid form: identifier not unique.");
                return false;
            }
            if (node) $(node).remove();

            let ctx = this._modals[id];
            if (ctx) {
                if (ctx.window) ctx.window.close();
                this._destroyModalWindow(id, ctx);
            }
            return true;
        },

        _showCustomModalImpl: function(id, title, html, size='width=450,height=250') {
            //can be called recursively from message popup, that's why we cache it
            if (html) this._cachedHtml = html;
            else html = this._cachedHtml;
            if (!html) return;

            let win = this._openModalWindow(id, title, html, size);
            if (!win) {
                this.show(`An application modal window '${title}' was blocked by your browser. <a onclick="
Dialogs._showCustomModalImpl('${id}', '${title}', null, '${size}'); Dialogs.hide();" class='pointer'>Click here to open.</a>`,
                    15000, this.MSG_WARN);
            } else {
                this._modals[id] = win;
                delete this._cachedHtml;
            }
        },

        _openModalWindow: function(id, title, content, size) {
            //todo clean up also object URL? or is it freed automatically? revokeURL...
            return window.open(URL.createObjectURL(
                new Blob([`
<!DOCTYPE html>
<html lang="en">
    <head>
        <title>${title}</title>
        <link rel="stylesheet" href="<?php echo VISUALISATION_ROOT_ABS_PATH; ?>/style.css">
        <link rel="stylesheet" href="<?php echo VISUALISATION_ROOT_ABS_PATH; ?>/external/primer_css.css">
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
        <script src="https://code.jquery.com/jquery-3.5.1.min.js"><\/script>
        <script type="text/javascript">
            //route to the parent context
            window.confirm = function(message) {
                window.opener.focus();
                window.opener.confirm(message);
            };
        <\/script>
    </head>
    <body style="overflow: hidden; height: 100vh;">
    ${content}
    </body>
</html>
`], { type: "text/html" })), id, size);
        },

        _destroyModalWindow: function(id, context) {
            //important to clean up
            let body = context.document.getElementById("body");
            if (body) body.innerHTML = "";
            delete this._modals[id];
        },

        _buildComplexWindow: function(isModal, parentId, title, content, footer, positionStrategy, params) {
            //preventive close, applies to non-modals only
            if (!isModal && !this.closeWindow(parentId)) return;
            params = params || {};
            let height = params.defaultHeight === undefined ? "" :
                (typeof params.defaultHeight === "string" ? params.defaultHeight : params.defaultHeight+"px");

            let close = params.allowClose ? this._getCloseButton(parentId) : '';
            let resize = params.allowResize ? "resize:vertical;" : "";
            footer = footer ? `<div class="position-absolute bottom-0 right-0 left-0 border-top"
style="border-color: var(--color-border-primary);">${footer}</div>` : "";

            let limits = isModal ? "style='width: 100%; height: 100vh;'" : "style='max-width:80vw; max-height: 80vh'";
            let diaClasses = isModal ? "" : "Box Box--overlay";

            return `<div id="${parentId}" data-dialog="true" ${positionStrategy}>
<details-dialog class="${diaClasses} d-flex flex-column" ${limits}>
    <div class="Box-header" id="${parentId}-header">
      ${close}
      <h3 class="Box-title">${title}</h3>
    </div>
    <div class="overflow-auto position-relative" style="${resize} height: ${height}; min-height: 63px;">
      <div class="Box-body pr-2" style="padding-bottom: 45px; min-height: 100%">
	  ${content}
	  </div>
       ${footer}
    </div>
</details-dialog>
</div>`;
        },

        _getCloseButton: function(id) {
            return `<button class="Box-btn-octicon btn-octicon float-right" type="button"
aria-label="Close help" onclick="Dialogs.closeWindow('${id}')">
<svg class="octicon octicon-x" viewBox="0 0 12 16" version="1.1" width="12" height="16" aria-hidden="true">
<path fill-rule="evenodd" d="M7.48 8l3.75 3.75-1.48 1.48L6 9.48l-3.75 3.75-1.48-1.48L4.52 8 .77
4.25l1.48-1.48L6 6.52l3.75-3.75 1.48 1.48L7.48 8z"></path></svg></button>`;
        }
    }; // end of namespace Dialogs
    Dialogs.init();

    window.USER_INTERFACE = {
        /**
         * Workspace (canvas) margins
         */
        Margins : {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
        },

        /**
         * Dialog System
         */
        Dialogs: Dialogs,

        /**
         * Full screen Errors
         */
        Errors: {
            active: false,
            show: function(title, description, withHiddenMenu=false) {
                USER_INTERFACE.Tutorials._hideImpl(false); //preventive
                $("#system-message-title").html(title);
                $("#system-message-details").html(description);
                $("#system-message").removeClass("d-none");
                $("#viewer-container").addClass("disabled");
                if (withHiddenMenu) USER_INTERFACE.MainMenu.close();
                USER_INTERFACE.Tools.close();
                this.active = true;
            },
            hide: function() {
                $("#system-message").addClass("d-none");
                $("#viewer-container").removeClass("disabled");
                USER_INTERFACE.Tools.open();
                this.active = false;
            }
        },

        /**
         * Application Main Menu (left-side)
         */
        MainMenu: {
            context: $("#main-panel"),
            content: $("#main-panel-content"),
            opened: true,
            append: function(title, titleHtml, html, id, pluginId) {
                this.content.append(`<div id="${id}" class="inner-panel ${pluginId}-plugin-root inner-panel-simple"><div><h3 class="d-inline-block h3" style="padding-left: 15px;">${title}&emsp;</h3>${titleHtml}</div><div>${html}</div></div>`);
            },
            replace: function(title, titleHtml, html, id, pluginId) {
                $(`.${pluginId}-plugin-root`).remove();
                this.append(title, titleHtml, html, id, pluginId);
            },
            appendExtended: function(title, titleHtml, html, hiddenHtml, id, pluginId) {
                this.content.append(`<div id="${id}" class="inner-panel ${pluginId}-plugin-root"><div>
<span class="material-icons inline-arrow plugins-pin pointer" id="${id}-pin" onclick="APPLICATION_CONTEXT.UTILITIES.clickMenuHeader($(this), $(this).parent().parent().children().eq(2));" style="padding: 0;">navigate_next</span>
<h3 class="d-inline-block h3 pointer" onclick="APPLICATION_CONTEXT.UTILITIES.clickMenuHeader($(this.previousElementSibling), $(this).parent().parent().children().eq(2));">${title}&emsp;</h3>${titleHtml}
</div><div class="inner-panel-visible">${html}</div><div class="inner-panel-hidden">${hiddenHtml}</div></div>`);
            },
            replaceExtended: function(title, titleHtml, html, hiddenHtml, id, pluginId) {
                $(`.${pluginId}-plugin-root`).remove();
                this.appendExtended(title, titleHtml, html, hiddenHtml, id, pluginId);
            },
            appendRaw: function(html, id, pluginId) {
                this.content.append(`<div id="${id}" class="inner-panel ${pluginId}-plugin-root inner-panel-visible">${html}</div>`);
            },
            open() {
                this.context.css("right", "0");
                this.opened = true;
                USER_INTERFACE.Margins.right = 400;
                this._sync();
            },
            close() {
                this.context.css("right", "-400px");
                this.opened = false;
                USER_INTERFACE.Margins.right = 0;
                this._sync();
            },
            _sync() {
                let width = this.opened ? "calc(100% - 400px)" : "100%";
                USER_INTERFACE.AdvancedMenu.selfContext.context.style['max-width'] = width;
                if (PLUGINS.__toolsContext) {
                    PLUGINS.__toolsContext.context.style.width = width;
                }
                //todo settings menu
            }
        },

        /**
         * Tools menu by default invisible (top)
         */
        Tools: {
            setMenu(ownerPluginId, toolsMenuId, title, html, icon="") {
                let builder = PLUGINS.__toolsContext;
                if (!builder) {
                    builder = new UIComponents.Containers.PanelMenu("plugin-tools-menu");
                    let color = getComputedStyle(document.documentElement)
                        .getPropertyValue('--color-bg-primary');
                    PLUGINS.__toolsContext = builder;
                    //todo set these colors manually in CSS!!! for different themes
                    PLUGINS.__toolsContext.context.classList.add("bg-opacity");
                    USER_INTERFACE.MainMenu._sync();
                }
                builder.set(ownerPluginId, toolsMenuId, title, html, icon);
                if (PLUGINS.__toolsContext.isVisible) {
                    USER_INTERFACE.Margins.bottom = PLUGINS.__toolsContext.height;
                }
            },
            open(toolsId=undefined) {
                let builder = PLUGINS.__toolsContext;
                if (builder) {
                    USER_INTERFACE.Margins.bottom = builder.height;
                    builder.show(toolsId);
                }
            },
            notify(menuId, symbol=undefined) {
                let builder = PLUGINS.__toolsContext;
                if (builder) builder.setNotify(menuId, symbol);
            },
            close() {
                let builder = PLUGINS.__toolsContext;
                USER_INTERFACE.Margins.bottom = 0;
                if (builder) builder.hide();
            }
        },

        AdvancedMenu: {
            self: $("#fullscreen-menu"),
            selfContext: new UIComponents.Containers.PanelMenu("fullscreen-menu"),
            setMenu(ownerPluginId, toolsMenuId, title, html, icon="", withSubmenu=true, container=true) {
                //todo allow multiple main menus for plugin?
                let plugin = PLUGINS.each[ownerPluginId];
                if (!plugin || !ownerPluginId) return;
                this._buildMenu(plugin, "__selfMenu", ownerPluginId, plugin.name, ownerPluginId, toolsMenuId, title, html,
                    icon, withSubmenu, container);
            },
            openMenu(atPluginId=undefined) {
                this.selfContext.show(atPluginId);
                if (window.innerWidth < 1150) {
                    this._closedMm = true;
                    USER_INTERFACE.MainMenu.close();
                }
            },
            openSubmenu(atPluginId, atSubId=undefined) {
                this.openMenu(atPluginId);
                let plugin = PLUGINS.each[atPluginId];
                if (!plugin) return;
                let builder = plugin.__selfMenu;
                if (builder) builder.show(atSubId);
            },
            close() {
                this.selfContext.hide();
                if (this._closedMm) {
                    this._closedMm = false;
                    USER_INTERFACE.MainMenu.open();
                }
            },
            _build() {
                USER_INTERFACE.MainMenu._sync();
                this.selfContext.isHorizontal = false;
                this.selfContext.menuWith1Element = true;
                this.selfContext.isFullSize = true;

                this._buildMenu(this, "__pMenu", "", "", APPLICATION_CONTEXT.pluginsMenuId,
                    APPLICATION_CONTEXT.pluginsMenuId, "Plugins",  `<div class="d-flex flex-column-reverse">
<button onclick="USER_INTERFACE.AdvancedMenu._refreshPageWithSelectedPlugins();" class="btn">Load with selected</button>
</div><hr>
<div id='plug-list-content-inner'></div>
`, 'extension', false, true);

                //todo disable feature of plugin dependency between themselves
                this.__pBuilder = new UIComponents.Containers.RowPanel("plug-list-content-inner",
                    UIComponents.Elements.SelectableImageRow,
                    {multiselect: true, id: 'plug-list-content'});

                for (let pid in PLUGINS.each) {
                    if (!PLUGINS.each.hasOwnProperty(pid)) continue;
                    let plugin = PLUGINS.each[pid];
                    let errMessage = plugin.error ? `<div class="p-1 rounded-2 error-container">${plugin.error}</div>` : "";
                    let problematic = `<div id="error-plugin-${plugin.id}" class="mx-2 mb-3 text-small">${errMessage}</div>`;
                    let actionPart = `<div id="load-plugin-${plugin.id}"><button onclick="APPLICATION_CONTEXT.UTILITIES.loadPlugin('${plugin.id}');return false;" class="btn">Load</button></div>`;
                    this.__pBuilder.addRow({
                        title: plugin.name,
                        author: plugin.author,
                        details: plugin.description,
                        customContent: problematic + (plugin.html || ""),
                        icon: plugin.icon,
                        value: plugin.id,
                        selected: plugin.loaded,
                        contentAction:actionPart
                    });
                }

                this._buildMenu(this, "__sMenu", "", "", APPLICATION_CONTEXT.settingsMenuId, APPLICATION_CONTEXT.settingsMenuId, "Settings", this._settingsMenu(), 'settings', false, true);

                $(this.selfContext.head).prepend('<span class="material-icons pointer mb-2" onclick="USER_INTERFACE.AdvancedMenu.close();">close</span>');
                $(this.selfContext.head).append('<span class="width-full" style="height: 1px; border: solid; opacity: 0.1;"></span>');
            },
            _refreshPageWithSelectedPlugins() {
                let formData = [],
                    plugins = this.__pBuilder.builder.getSelected();

                for (let plugin of plugins) {
                    formData.push("<input type='hidden' name='", plugin.id ,"' value='1'>");
                }
                let pluginCookie = APPLICATION_CONTEXT.getOption("permaLoadPlugins") ? plugins.join(',') : "";
                document.cookie = `plugins=${pluginCookie}; <?php echo JS_COOKIE_SETUP ?>`;
                APPLICATION_CONTEXT.UTILITIES.refreshPage(formData.join(""), plugins);
            },
            _settingsMenu() {
                let inputs = UIComponents.Inputs;
                let notifyNeedRefresh = "$('#settings-notification').css('visibility', 'visible');";
                //todo what about non-string values...?!?
                let updateOption = name => `APPLICATION_CONTEXT.setup.params['${name}'] = $(this).val();`;
                let updateBool = name => `APPLICATION_CONTEXT.setup.params['${name}'] = this.checked;`;
                return `
<div class="position-absolute top-1 left-1 right-1" style="width: inherit; visibility: hidden;" id="settings-notification">
<div class="py-1 px-2 rounded-2"
style="background: var(--color-bg-warning); max-height: 70px; text-overflow: ellipsis;">
<span class='material-icons' style='font-size: initial; color: var( --color-icon-warning)'>warning</span>
To apply changes, please <a onclick="APPLICATION_CONTEXT.UTILITIES.refreshPage()" class="pointer">reload the page</a>.</div>
</div>
<span class="f3-light header-sep">Appearance</span>
Theme &emsp; ${inputs.select("select-sm", `${updateOption("theme")} APPLICATION_CONTEXT.UTILITIES.updateTheme();`, APPLICATION_CONTEXT.getOption("theme"), {auto: "Automatic", light: "Light Theme", dark_dimmed: "Dimmed Theme", dark: "Dark Theme"})}
<br> ${inputs.checkBox("", "Show ToolBar", "$('#plugin-tools-menu').toggleClass('d-none')", true)}
<br> ${inputs.checkBox("", "Show Scale", updateBool("scaleBar") + notifyNeedRefresh, APPLICATION_CONTEXT.getOption("scaleBar"))}
`
            },
            _buildMenu(context, builderId, parentMenuId, parentMenuTitle, ownerPluginId, toolsMenuId,
                       title, html, icon, withSubmenu, container) {

                let builder = context[builderId];

                if (!withSubmenu && builder) {
                    builder.remove();
                    delete context.__selfMenu;
                    builder = undefined;
                }
                html = container ? `<div class="height-full position-relative" style="padding: 30px 45px 12px 25px; width: 650px;">${html}</div>` : html;
                if (!builder) {
                    if (withSubmenu) {
                        this.selfContext.set(ownerPluginId, parentMenuId, parentMenuTitle,
                            `<div id='advanced-menu-${ownerPluginId}'></div>`);
                        builder = new UIComponents.Containers.PanelMenu(`advanced-menu-${ownerPluginId}`);
                        let color = getComputedStyle(document.documentElement)
                            .getPropertyValue('--color-bg-primary');
                        context.__selfMenu = builder;
                    } else {
                        this.selfContext.set(ownerPluginId, toolsMenuId, title, html, icon);
                        return;
                    }
                }
                builder.set(null, toolsMenuId, title, html, icon);
            }
        },

        /**
         * Tutorial system
         */
        Tutorials: {
            tutorials: $("#tutorials"),
            steps: [],
            prerequisites: [],

            show: function(title="Select a tutorial", description="The visualisation is still under development: components and features are changing. The tutorials might not work, missing or be outdated.") {
                if (USER_INTERFACE.Errors.active || this.running) return;

                $("#tutorials-container").removeClass("d-none");
                $("#viewer-container").addClass("disabled");
                $("#tutorials-title").html(title);
                $("#tutorials-description").html(description);
                USER_INTERFACE.MainMenu.close();
                USER_INTERFACE.Tools.close();
                USER_INTERFACE.AdvancedMenu.close();
                this.running = true;
            },

            hide: function() {
                this._hideImpl(true);
            },

            _hideImpl: function(reflectGUIChange) {
                $("#tutorials-container").addClass("d-none");
                if (reflectGUIChange) {
                    $("#viewer-container").removeClass("disabled");
                    USER_INTERFACE.MainMenu.open();
                    USER_INTERFACE.Tools.open();
                }
                this.running = false;
                document.cookie = 'shadersPin=false; expires=Fri, 31 Dec 9999 23:59:59 GMT; SameSite=None; Secure=false; path=/';
            },

            add: function(plugidId, name, description, icon, steps, prerequisites=undefined) {
                if (!icon) icon = "school";
                plugidId = plugidId ? `${plugidId}-plugin-root` : "";
                this.tutorials.append(`
<div class='d-inline-block px-2 py-2 m-1 pointer v-align-top rounded-2 tutorial-item ${plugidId}' onclick="USER_INTERFACE.Tutorials.run(${this.steps.length});">
<span class="d-block material-icons f1 text-center my-2">${icon}</span><p class='f3-light mb-0'>${name}</p><p>${description}</p></div>`);
                this.steps.push(steps);
                this.prerequisites.push(prerequisites);
            },

            run: function(index) {
                if (index >= this.steps.length || index < 0) return;
                USER_INTERFACE.MainMenu.open();

                //reset plugins visibility
                $(".plugins-pin").each(function() {
                    let pin = $(this);
                    let container = pin.parents().eq(1).children().eq(2);
                    pin.removeClass('pressed');
                    container.removeClass('force-visible');
                });
                //do prerequisite setup if necessary
                if(this.prerequisites[index]) this.prerequisites[index]();
                let enjoyhintInstance = new EnjoyHint({});
                enjoyhintInstance.set(this.steps[index]);
                this.hide();
                enjoyhintInstance.run();
                this.running = false;
            }
        }
    };
})(window);
</script>