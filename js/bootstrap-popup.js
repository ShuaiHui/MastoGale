// Dynamic Bootstrap Loader for PREFiX Popup (Manifest V3)

(function() {
    // Override window.Function to provide a CSP-safe evaluator fallback for avalon.js
    var originalFunction = window.Function;
    window.Function = function() {
        var args = Array.prototype.slice.call(arguments);
        var body = args[args.length - 1];
        var params = args.slice(0, args.length - 1);
        
        try {
            return originalFunction.apply(this, arguments);
        } catch (e) {
            if (e instanceof EvalError || e.message.includes('CSP') || e.message.includes('eval')) {
                return createInterpreterFunction(params, body);
            } else {
                throw e;
            }
        }
    };

    function createInterpreterFunction(params, body) {
        var varMappings = {};
        var paramIndices = {};
        params.forEach(function(pName, index) {
            paramIndices[pName] = index;
        });

        var declRegex = /\b([\w$]+)\s*=\s*([\w$]+)\.([\w$]+)/g;
        var match;
        while ((match = declRegex.exec(body)) !== null) {
            var localVar = match[1];
            var paramName = match[2];
            var propName = match[3];
            if (paramName in paramIndices) {
                varMappings[localVar] = {
                    paramIndex: paramIndices[paramName],
                    path: propName
                };
            }
        }

        if (body.indexOf('return function(vvv)') !== -1) {
            var duplexTarget = null;
            var duplexMatch = /([\w$.]+)\s*=\s*vvv/.exec(body);
            if (duplexMatch) {
                duplexTarget = duplexMatch[1];
            }

            return function() {
                var callArgs = arguments;

                function resolvePath(pathStr) {
                    pathStr = pathStr.trim();
                    var parts = pathStr.split('.');
                    var first = parts[0];
                    var baseObj = null;
                    var remainingPath = [];

                    if (first in varMappings) {
                        var mapping = varMappings[first];
                        baseObj = callArgs[mapping.paramIndex];
                        if (baseObj) {
                            baseObj = baseObj[mapping.path];
                        }
                        remainingPath = parts.slice(1);
                    } else if (first in paramIndices) {
                        baseObj = callArgs[paramIndices[first]];
                        remainingPath = parts.slice(1);
                    } else {
                        for (var i = 0; i < callArgs.length; i++) {
                            var vm = callArgs[i];
                            if (vm && first in vm) {
                                baseObj = vm[first];
                                remainingPath = parts.slice(1);
                                break;
                            }
                        }
                        if (!baseObj) {
                            baseObj = window[first];
                            remainingPath = parts.slice(1);
                        }
                    }

                    var cur = baseObj;
                    for (var i = 0; i < remainingPath.length; i++) {
                        if (cur == null) return undefined;
                        cur = cur[remainingPath[i]];
                    }
                    return cur;
                }

                var resolveVal = function() {
                    if (!duplexTarget) return null;
                    var lastDot = duplexTarget.lastIndexOf('.');
                    if (lastDot === -1) {
                        if (duplexTarget in varMappings) {
                            var mapping = varMappings[duplexTarget];
                            return { obj: callArgs[mapping.paramIndex], prop: mapping.path };
                        }
                        for (var i = 0; i < callArgs.length; i++) {
                            var vm = callArgs[i];
                            if (vm && duplexTarget in vm) {
                                return { obj: vm, prop: duplexTarget };
                            }
                        }
                        return { obj: window, prop: duplexTarget };
                    } else {
                        var parentPath = duplexTarget.substring(0, lastDot);
                        var prop = duplexTarget.substring(lastDot + 1);
                        var parentObj = resolvePath(parentPath);
                        return { obj: parentObj, prop: prop };
                    }
                };

                return function() {
                    var target = resolveVal();
                    if (arguments.length === 0) {
                        return (target && target.obj) ? target.obj[target.prop] : undefined;
                    } else {
                        var val = arguments[0];
                        if (target && target.obj) {
                            target.obj[target.prop] = val;
                        }
                    }
                };
            };
        }

        var expr = '';
        var returnMatch = /return\s+([^;}\n]+)/.exec(body);
        if (returnMatch) {
            expr = returnMatch[1].trim();
        }

        return function() {
            var callArgs = arguments;

            function resolvePath(pathStr) {
                pathStr = pathStr.trim();
                var parts = pathStr.split('.');
                var first = parts[0];
                var baseObj = null;
                var remainingPath = [];

                if (first in varMappings) {
                    var mapping = varMappings[first];
                    baseObj = callArgs[mapping.paramIndex];
                    if (baseObj) {
                        baseObj = baseObj[mapping.path];
                    }
                    remainingPath = parts.slice(1);
                } else if (first in paramIndices) {
                    baseObj = callArgs[paramIndices[first]];
                    remainingPath = parts.slice(1);
                } else {
                    for (var i = 0; i < callArgs.length; i++) {
                        var vm = callArgs[i];
                        if (vm && first in vm) {
                            baseObj = vm[first];
                            remainingPath = parts.slice(1);
                            break;
                        }
                    }
                    if (!baseObj) {
                        baseObj = window[first];
                        remainingPath = parts.slice(1);
                    }
                }

                var cur = baseObj;
                for (var i = 0; i < remainingPath.length; i++) {
                    if (cur == null) return undefined;
                    cur = cur[remainingPath[i]];
                }
                return cur;
            }

            if (expr.indexOf('!!') === 0) {
                var targetExpr = expr.substring(2).trim();
                return !!resolvePath(targetExpr);
            }

            if (expr.indexOf('+') !== -1) {
                var parts = expr.split('+');
                var result = '';
                for (var i = 0; i < parts.length; i++) {
                    var part = parts[i].trim();
                    if ((part.indexOf("'") === 0 && part.lastIndexOf("'") === part.length - 1) || 
                        (part.indexOf('"') === 0 && part.lastIndexOf('"') === part.length - 1)) {
                        result += part.substring(1, part.length - 1);
                    } else {
                        var resolved = resolvePath(part);
                        result += (resolved !== undefined ? resolved : '');
                    }
                }
                return result;
            }

            return resolvePath(expr);
        };
    }

    chrome.storage.local.get(null, function(items) {
        // 1. Shim localStorage synchronously
        var localStorageCache = {};
        for (var key in items) {
            localStorageCache[key] = items[key];
        }
        var localStorageProxy = new Proxy(localStorageCache, {
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
        
        Object.defineProperty(window, 'localStorage', {
            value: localStorageProxy,
            configurable: true,
            enumerable: true,
            writable: false
        });

        // 2. Define global environment variables
        window.bg_win = window;

        // 3. Load popup scripts sequentially
        var scripts = [
            "js/lib/jquery-min.js",
            "js/lib/jquery.easing-min.js",
            "js/lib/jquery.mousewheel.js",
            "js/lib/underscore-min.js",
            "js/lib/at.js",
            "js/lib/avalon.js",
            "js/lib/mastodon.js",
            "js/lib/ripple.helpers.js",
            "js/lib/others.js",
            "js/lyrics.js",
            "js/common.js",
            "js/shortening-url.js",
            "js/bg.js",
            "js/versions.js",
            "js/popup.js"
        ];

        function loadNext() {
            if (scripts.length === 0) return;
            var src = scripts.shift();
            var script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.onload = loadNext;
            document.head.appendChild(script);
        }
        
        loadNext();
    });
})();
