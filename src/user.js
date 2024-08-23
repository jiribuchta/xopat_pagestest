class XOpatUser extends OpenSeadragon.EventSource {

    login(id, name, icon="") {
        if (this.isLogged) throw "User needs to be first logged out!";

        if (!id) {
            throw "XOpatUser.login user ID not supplied!";
        }
        this._id = id;
        this._name = name;
        this._secret = {};
        $("#user-name").html(name);

        this.icon = icon;
        this.raiseEvent('login', {
            userId: id,
            userName: name
        });
    }

    logout() {
        if (!this.isLogged) return;
        this._id = null;
        this._name = $.t('user.anonymous');
        this._secret = {};
        $("#user-name").html(this.name);
        this.icon = null;
        this.secret = null;
        this.raiseEvent('logout', null);
    }

    get isLogged() {
        return !!this._id;
    }

    getSecret(type="jwt") {
        return this._secret && this._secret[type];
    }

    setSecret(secret, type="jwt") {
        if (!this.isLogged) throw "User needs to be first logged in to set a secret!";
        this._secret = this._secret || {};
        if (secret) {
            this._secret[type] = secret;
            this.raiseEvent('secret-updated', {secret: secret, type: type});
        } else if (this._secret[type]) {
            delete this._secret[type];
            this.raiseEvent('secret-removed', {type: type});
        }
    }

    async requestSecretUpdate(type="jtw") {
        await VIEWER.tools.raiseAwaitEvent(this, 'secret-needs-update', {type: type});
    }

    get id() {
        return this._id;
    }

    get name() {
        return this._name;
    }

    set icon(icon) {
        $("#user-icon").html(icon || `<span class="material-icons btn-pointer">account_circle</span>`);
    }

    onUserSelect() {
        if (this.isLogged) {
            //todo show some user info!! now it just logs out!
            this.logout();
            Dialogs.show('User logged out!');
        } else {
            Dialogs.show($.t('user.notConfigured'))
        }
    }

    /**
     * Get instance of the annotations manger, a singleton
     * (only one instance can run since it captures mouse events)
     * @static
     * @return {XOpatModuleSingleton} manager instance
     */
    static instance() {
        //this calls sub-class constructor, no args required
        this.__self = this.__self || new this();
        return this.__self;
    }

    /**
     * Check if instantiated
     * @return {boolean}
     */
    static instantiated() {
        return this.__self && true; //retype
    }

    static __self = undefined;
    constructor() {
        super();
        const staticContext = this.constructor;
        if (staticContext.__self) {
            throw `Trying to instantiate a singleton. Instead, use ${staticContext.name}::instance().`;
        }
        staticContext.__self = this;
        $("#user-panel").on('click', this.onUserSelect.bind(this));
    }
}