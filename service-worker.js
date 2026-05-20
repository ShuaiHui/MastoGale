// Manifest V3 Service Worker for PREFiX

// 1. Setup mock environment before importing classic scripts
globalThis.isServiceWorker = true;
globalThis.window = globalThis;

class MockXMLHttpRequest {
    constructor() {
        this.readyState = 0;
        this.status = 0;
        this.statusText = '';
        this.responseText = '';
        this.responseXML = null;
        this.headers = {};
        this.responseHeaders = {};
        this.method = 'GET';
        this.url = '';
        this.async = true;
        this.timeout = 0;
        this.upload = {};
        
        this.onreadystatechange = null;
        this.onload = null;
        this.onerror = null;
        this.onabort = null;
        this.ontimeout = null;
    }

    open(method, url, async) {
        this.method = method || 'GET';
        this.url = url;
        this.async = async !== false;
        this.readyState = 1;
        if (this.onreadystatechange) this.onreadystatechange();
    }

    setRequestHeader(header, value) {
        this.headers[header.toLowerCase()] = value;
    }

    getResponseHeader(header) {
        return this.responseHeaders[header.toLowerCase()] || null;
    }

    getAllResponseHeaders() {
        let headersStr = '';
        for (let key in this.responseHeaders) {
            headersStr += key + ': ' + this.responseHeaders[key] + '\r\n';
        }
        return headersStr;
    }

    send(body) {
        let options = {
            method: this.method,
            headers: {}
        };

        for (let key in this.headers) {
            options.headers[key] = this.headers[key];
        }

        if (body) {
            options.body = body;
        }

        this.readyState = 2;
        if (this.onreadystatechange) this.onreadystatechange();

        this.readyState = 3;
        this.localTime = new Date();
        if (this.onreadystatechange) this.onreadystatechange();

        fetch(this.url, options)
            .then(response => {
                this.status = response.status;
                this.statusText = response.statusText;
                response.headers.forEach((value, key) => {
                    this.responseHeaders[key.toLowerCase()] = value;
                });
                return response.text();
            })
            .then(text => {
                this.responseText = text;
                this.readyState = 4;
                if (this.onreadystatechange) this.onreadystatechange();
                if (this.onload) {
                    this.onload();
                }
            })
            .catch(error => {
                this.readyState = 4;
                this.status = 0;
                this.statusText = error.message;
                if (this.onreadystatechange) this.onreadystatechange();
                if (this.onerror) {
                    this.onerror();
                }
            });
    }

    abort() {}
}
globalThis.XMLHttpRequest = MockXMLHttpRequest;

globalThis.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: (tag) => {
        if (tag === 'canvas') {
            return {
                getContext: () => ({
                    drawImage: () => {},
                    getImageData: () => ({ data: [] })
                })
            };
        }
        return {};
    },
    body: {
        appendChild: () => {},
        removeChild: () => {}
    },
    documentElement: {},
    getElementsByTagName: () => []
};

globalThis.navigator = {
    userAgent: 'Mozilla/5.0 (Chrome ServiceWorker)',
    platform: 'MacIntel'
};

globalThis.location = {
    protocol: 'chrome-extension:',
    href: 'chrome-extension://' + chrome.runtime.id + '/background.js',
    pathname: '/background.js'
};

// 2. Synchronous/Asynchronous localStorage Cache Proxy
var localStorageCache = {};
var localStorage = new Proxy(localStorageCache, {
    get: function(target, prop) {
        if (prop === 'setItem') {
            return function(key, val) {
                target[key] = String(val);
                chrome.storage.local.set({ [key]: target[key] });
            };
        }
        if (prop === 'getItem') {
            return function(key) {
                return key in target ? target[key] : null;
            };
        }
        if (prop === 'removeItem') {
            return function(key) {
                delete target[key];
                chrome.storage.local.remove(key);
            };
        }
        if (prop === 'clear') {
            return function() {
                for (var key in target) {
                    delete target[key];
                }
                chrome.storage.local.clear();
            };
        }
        if (prop === 'key') {
            return function(index) {
                var keys = Object.keys(target);
                return keys[index] || null;
            };
        }
        if (prop === 'length') {
            return Object.keys(target).length;
        }
        return target[prop];
    },
    set: function(target, prop, value) {
        target[prop] = String(value);
        chrome.storage.local.set({ [prop]: target[prop] });
        return true;
    },
    deleteProperty: function(target, prop) {
        delete target[prop];
        chrome.storage.local.remove(prop);
        return true;
    }
});
globalThis.localStorage = localStorage;

// 3. Synchronous Event Listener Proxies for chrome.* APIs
// Since MV3 Service Workers require event listeners to be registered synchronously at startup,
// we intercept addListener/removeListener calls from bg.js and route events to them.

let messageListeners = [];
let omniboxStartedListeners = [];
let omniboxChangedListeners = [];
let omniboxEnteredListeners = [];

// Intercept runtime messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Check if message is for offscreen
    if (request.target === 'offscreen') return;

    let keepsChannelOpen = false;
    for (const listener of messageListeners) {
        const result = listener(request, sender, sendResponse);
        if (result === true) {
            keepsChannelOpen = true;
        }
    }
    return keepsChannelOpen;
});

// Mock runtime addListener
chrome.runtime.onMessage.addListener = (listener) => {
    messageListeners.push(listener);
};

// Intercept omnibox events
chrome.omnibox.onInputStarted.addListener((...args) => {
    omniboxStartedListeners.forEach(l => l(...args));
});
chrome.omnibox.onInputChanged.addListener((...args) => {
    omniboxChangedListeners.forEach(l => l(...args));
});
chrome.omnibox.onInputEntered.addListener((...args) => {
    omniboxEnteredListeners.forEach(l => l(...args));
});

// Mock omnibox addListener/removeListener
chrome.omnibox.onInputStarted.addListener = (l) => omniboxStartedListeners.push(l);
chrome.omnibox.onInputChanged.addListener = (l) => omniboxChangedListeners.push(l);
chrome.omnibox.onInputEntered.addListener = (l) => omniboxEnteredListeners.push(l);

chrome.omnibox.onInputStarted.removeListener = (l) => {
    omniboxStartedListeners = omniboxStartedListeners.filter(x => x !== l);
};
chrome.omnibox.onInputChanged.removeListener = (l) => {
    omniboxChangedListeners = omniboxChangedListeners.filter(x => x !== l);
};
chrome.omnibox.onInputEntered.removeListener = (l) => {
    omniboxEnteredListeners = omniboxEnteredListeners.filter(x => x !== l);
};

// 4. Audio Playback via Offscreen Document helper
globalThis.playAudioViaOffscreen = async function(src, volume) {
    const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (contexts.length === 0) {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Play sound notifications when new mentions or messages are received'
        });
    }
    chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'play-audio',
        src: src,
        volume: volume
    });
};

// 5. Load and run the background scripts
importScripts(
    "js/lib/underscore-min.js",
    "js/lib/ripple.js",
    "js/lib/ripple.helpers.js",
    "js/lib/ripple.api.js",
    "js/common.js",
    "js/bg.js",
    "js/versions.js",
    "js/shortening-url.js"
);

// 6. Asynchronously initialize background scripts when storage is loaded
chrome.storage.local.get(null, function(items) {
    // Populate localStorageCache
    for (var key in items) {
        localStorageCache[key] = items[key];
    }
    
    // Set up active properties and versions check
    globalThis.is_first_run = lscache.get('is_first_run') !== false;
    lscache.set('is_first_run', false);
    
    PREFiX.account = lscache.get('account_details');
    PREFiX.accessToken = lscache.get('access_token');
    
    // Check version updates
    if (globalThis.checkVersion) {
        checkVersion();
    }
    
    // Run the main background initialization
    if (globalThis.initialize) {
        initialize();
    }
});
