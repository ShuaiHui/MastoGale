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
    "js/lib/mastodon.js",
    "js/lib/ripple.helpers.js",
    "js/common.js",
    "js/bg.js",
    "js/versions.js",
    "js/shortening-url.js"
);

// 5.5. Out-of-Band (OOB) OAuth Code Interception with Robust Multi-Account Integration and Log Debugging
function logDebug(msg) {
    chrome.storage.local.get('debug_logs', function(data) {
        var logs = [];
        if (data.debug_logs) {
            try {
                logs = JSON.parse(data.debug_logs);
            } catch (e) {
                logs = [];
            }
        }
        if (!Array.isArray(logs)) {
            logs = [];
        }
        var timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        logs.push(timestamp + ': ' + msg);
        if (logs.length > 50) {
            logs.shift();
        }
        chrome.storage.local.set({ debug_logs: JSON.stringify(logs) });
    });
}

function exchangeToken(tabId, code) {
    logDebug("📡 开始为授权码 [" + code.substring(0, 8) + "...] 换取 Token...");
    chrome.storage.local.get(['temp_instance', 'temp_client_id', 'temp_client_secret'], function(items) {
        var instance = items.temp_instance;
        var clientId = items.temp_client_id;
        var clientSecret = items.temp_client_secret;
        
        if (instance && clientId && clientSecret) {
            var tokenUrl = instance.replace(/\/$/, '') + '/oauth/token';
            var payload = {
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
                code: code,
                grant_type: 'authorization_code'
            };
            
            logDebug("🔗 发起 Token 请求: " + tokenUrl);
            
            fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(function(res) {
                if (!res.ok) throw new Error('Token 交换请求失败: 状态码 ' + res.status);
                return res.json();
            })
            .then(function(tokenJson) {
                var accessToken = tokenJson.access_token;
                var tokenObj = {
                    token: accessToken,
                    instance: instance
                };
                
                logDebug("🔑 成功获取 Token! 正在向长毛象实例验证用户凭据...");
                var verifyUrl = instance.replace(/\/$/, '') + '/api/v1/accounts/verify_credentials';
                return fetch(verifyUrl, {
                    headers: { 'Authorization': 'Bearer ' + accessToken }
                })
                .then(function(res) {
                    if (!res.ok) throw new Error('验证用户凭据失败: 状态码 ' + res.status);
                    return res.json();
                })
                .then(function(userJson) {
                    var accountObj = {
                        id: userJson.id,
                        name: userJson.display_name || userJson.username,
                        screen_name: userJson.username,
                        profile_image_url: userJson.avatar_static,
                        profile_image_url_large: userJson.avatar,
                        statuses_count: userJson.statuses_count,
                        followers_count: userJson.followers_count,
                        friends_count: userJson.following_count,
                        description: userJson.note,
                        protected: userJson.locked
                    };
                    
                    logDebug("👤 用户验证成功: @" + accountObj.screen_name + " (" + accountObj.name + "). 正在合并到多账号列表中...");
                    
                    chrome.storage.local.get('lscache-accounts_list', function(data) {
                        var accountsList = [];
                        if (data['lscache-accounts_list']) {
                            try {
                                accountsList = JSON.parse(data['lscache-accounts_list']);
                            } catch (e) {
                                accountsList = [];
                            }
                        }
                        if (!Array.isArray(accountsList)) {
                            accountsList = [];
                        }
                        
                        var existsIdx = -1;
                        for (var i = 0; i < accountsList.length; i++) {
                            var acc = accountsList[i];
                            if (acc.account && acc.account.id === accountObj.id && acc.instance === instance) {
                                existsIdx = i;
                                break;
                            }
                        }
                        
                        var newAccEntry = {
                            instance: instance,
                            accessToken: tokenObj,
                            account: accountObj
                        };
                        
                        if (existsIdx > -1) {
                            accountsList[existsIdx] = newAccEntry;
                            logDebug("✏️ 已更新现有账号 @" + accountObj.screen_name + " (" + instance + ") 的 Access Token.");
                        } else {
                            accountsList.push(newAccEntry);
                            logDebug("➕ 已成功添加新账号 @" + accountObj.screen_name + " (" + instance + ") 到列表中.");
                        }
                        
                        chrome.storage.local.set({
                            'lscache-access_token': JSON.stringify(tokenObj),
                            'lscache-account_details': JSON.stringify(accountObj),
                            'lscache-accounts_list': JSON.stringify(accountsList),
                            'lscache-is_first_run': 'false'
                        }, function() {
                            chrome.storage.local.remove(['temp_instance', 'temp_client_id', 'temp_client_secret', 'last_processed_code'], function() {
                                logDebug("🎉 授权流程全部自动完成! 正在关闭授权标签页，并刷新扩展服务...");
                                // Close tab
                                chrome.tabs.remove(tabId, function() {
                                    if (chrome.runtime.lastError) {
                                        // Ignore tab close error if user closed it manually
                                    }
                                    // Reload extension
                                    chrome.runtime.reload();
                                });
                            });
                        });
                    });
                });
            })
            .catch(function(err) {
                logDebug("❌ Token 换取异常: " + err.message);
                chrome.storage.local.remove('last_processed_code');
            });
        } else {
            logDebug("⚠️ 授权码验证中止: 临时会话变量缺失。temp_instance=" + instance);
            chrome.storage.local.remove('last_processed_code');
        }
    });
}

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (tab.url && tab.url.indexOf('/oauth/authorize') > -1) {
        logDebug("🔄 监测到授权相关页面更新: ID=" + tabId + ", status=" + (changeInfo.status || 'unknown') + ", URL=" + tab.url);
        
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: function() {
                // 1. 优先检索所有的 input 和 textarea (长毛象 OOB 授权码常在 textarea[readonly] 中)
                var inputs = document.querySelectorAll('input, textarea');
                for (var i = 0; i < inputs.length; i++) {
                    var val = inputs[i].value ? inputs[i].value.trim() : '';
                    if (/^[a-zA-Z0-9_-]{30,80}$/.test(val)) {
                        return { code: val, source: 'input_or_textarea' };
                    }
                }
                
                // 2. 检索特殊的 <code> 或 <pre> 以及其他可能包含授权码的文本容器
                var codes = document.querySelectorAll('code, pre, p, span, div.oauth-code');
                for (var i = 0; i < codes.length; i++) {
                    var txt = codes[i].textContent ? codes[i].textContent.trim() : '';
                    if (/^[a-zA-Z0-9_-]{30,80}$/.test(txt)) {
                        return { code: txt, source: 'code_or_pre_or_span' };
                    }
                }
                
                // 3. 后备提取: 遍历 body 下的文本片段，寻找符合授权码正则的 30-80 位独立字符串
                var bodyText = document.body ? document.body.innerText : '';
                var matches = bodyText.match(/\b[a-zA-Z0-9_-]{40,75}\b/g);
                if (matches) {
                    for (var i = 0; i < matches.length; i++) {
                        var m = matches[i].trim();
                        // 忽略 URN 等内置关键字
                        if (m !== 'urn' && m !== 'ietf' && m !== 'oauth') {
                            return { code: m, source: 'body_regex_fallback' };
                        }
                    }
                }
                return null;
            }
        }, function(results) {
            if (chrome.runtime.lastError) {
                // 忽略加载过程中的上下文失效错误
                return;
            }
            if (!results || !results[0] || !results[0].result) {
                return;
            }
            
            var res = results[0].result;
            var code = res.code;
            logDebug("🎯 DOM 截获成功! 截获来源: " + res.source + ", 授权码: [" + code.substring(0, 8) + "...]");
            
            // 防止针对同一次页面状态重复触发换票
            chrome.storage.local.get('last_processed_code', function(stored) {
                if (stored.last_processed_code === code) {
                    return;
                }
                chrome.storage.local.set({ last_processed_code: code }, function() {
                    exchangeToken(tabId, code);
                });
            });
        });
    }
});

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
