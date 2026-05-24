// Mastodon API Adapter for PREFiX (Replacing Ripple)
(function(Global) {
    'use strict';

    // 1. Core Event System mimicking Ripple.events
    var event_observers = {};
    var global_observers = [];

    var events = {
        register: function() {},
        registerSystemEvent: function() {},
        observe: function(event_type, func) {
            if (!event_observers[event_type]) event_observers[event_type] = [];
            event_observers[event_type].push(func);
            return this;
        },
        trigger: function(event_type, data, e) {
            var list = event_observers[event_type];
            if (list) {
                list.forEach(function(func) {
                    try { func(data, e); } catch (err) { console.error(err); }
                });
            }
            // Trigger global observers
            global_observers.forEach(function(func) {
                try { func(data, { type: 'after.' + event_type, srcEvent: e }); } catch (err) { console.error(err); }
            });
        },
        triggerWith: function(context, event_type, data, e) {
            var list = event_observers[event_type];
            if (list) {
                list.forEach(function(func) {
                    try { func.call(context, data, e); } catch (err) { console.error(err); }
                });
            }
            return data;
        },
        addGlobalObserver: function(phase, func) {
            global_observers.push(func);
        },
        addGlobalSystemObserver: function() {}
    };

    // 2. Data Mappers (Mastodon -> Fanfou)
    function mapUser(account) {
        if (!account) return null;
        return {
            id: account.id,
            name: account.display_name || account.username,
            screen_name: account.username,
            profile_image_url: account.avatar_static,
            profile_image_url_large: account.avatar,
            statuses_count: account.statuses_count,
            followers_count: account.followers_count,
            friends_count: account.following_count,
            description: account.note,
            protected: account.locked,
            url: account.url,
            following: false // Will be updated if relationships api is used
        };
    }

    function mapStatus(status) {
        if (!status) return null;
        
        // If it's a reblog, we map the nested status but keep the reblog context
        var is_reblog = !!status.reblog;
        var targetStatus = is_reblog ? status.reblog : status;
        
        var mapped = {
            id: targetStatus.id,
            created_at: targetStatus.created_at,
            text: targetStatus.content, // HTML format
            source: targetStatus.application ? targetStatus.application.name : 'Web',
            favorited: targetStatus.favourited,
            reposted: targetStatus.reblogged,
            in_reply_to_status_id: targetStatus.in_reply_to_id,
            in_reply_to_user_id: targetStatus.in_reply_to_account_id,
            user: mapUser(targetStatus.account),
            url: targetStatus.url,
            photo: (targetStatus.media_attachments && targetStatus.media_attachments.length > 0) ? {
                thumburl: targetStatus.media_attachments[0].preview_url || targetStatus.media_attachments[0].url,
                largeurl: targetStatus.media_attachments[0].url
            } : null
        };

        if (is_reblog) {
            mapped.repost_status = mapStatus(status.reblog);
            mapped.repost_status_id = status.reblog.id;
        }

        try {
            if (Global.Ripple && Global.Ripple.events) {
                Global.Ripple.events.trigger('process_status', mapped);
            } else {
                events.trigger('process_status', mapped);
            }
        } catch(e) {
            console.error('Error processing mapped status:', e);
        }

        return mapped;
    }

    function mapMessage(conv) {
        // Map conversation last_status to Direct Message format
        var status = conv.last_status;
        if (!status) return null;
        
        var mapped = {
            id: status.id,
            created_at: status.created_at,
            text: status.content,
            sender: mapUser(status.account),
            recipient: { id: 'me' }, // Mock recipient
            url: status.url,
            photo: (status.media_attachments && status.media_attachments.length > 0) ? {
                thumburl: status.media_attachments[0].preview_url || status.media_attachments[0].url,
                largeurl: status.media_attachments[0].url
            } : null
        };

        try {
            if (Global.Ripple && Global.Ripple.events) {
                Global.Ripple.events.trigger('process_status', mapped);
            } else {
                events.trigger('process_status', mapped);
            }
        } catch(e) {
            console.error('Error processing mapped message:', e);
        }

        return mapped;
    }

    // 3. Mastodon client object mimicking Ripple Account instance
    function MastodonClient(authConfig) {
        this.token = authConfig.token;
        this.instanceUrl = authConfig.instance;
        this.id = authConfig.userId || 'me';
    }

    MastodonClient.prototype = {
        // Helper to run raw fetch requests wrapped in Deferred
        _request: function(method, path, params, extraOptions) {
            var self = this;
            var d = new Deferred();
            var setupOptions = {};

            d.setupAjax = function(opts) {
                Object.assign(setupOptions, opts);
                return d;
            };

            setTimeout(function() {
                if (setupOptions.lock && setupOptions.lock._ajax_active_) {
                    return;
                }
                if (setupOptions.lock) {
                    setupOptions.lock._ajax_active_ = true;
                }

                if (setupOptions.onstart) {
                    try { setupOptions.onstart(); } catch(e){}
                }

                var url = self.instanceUrl.replace(/\/$/, '') + path;
                var headers = {
                    'Authorization': 'Bearer ' + self.token
                };

                var fetchOpts = {
                    method: method,
                    headers: headers
                };

                var progressTimer = null;
                if (extraOptions && extraOptions.multipart && setupOptions.onprogress) {
                    var percent = 0;
                    progressTimer = setInterval(function() {
                        percent = Math.min(95, percent + 15);
                        try {
                            setupOptions.onprogress({
                                lengthComputable: true,
                                loaded: percent,
                                total: 100
                            });
                        } catch(e){}
                    }, 150);
                }

                if (method === 'GET' && params) {
                    var query = new URLSearchParams();
                    for (var k in params) {
                        if (params[k] !== undefined && params[k] !== null) {
                            query.append(k, params[k]);
                        }
                    }
                    var queryString = query.toString();
                    if (queryString) url += '?' + queryString;
                } else if (method === 'POST') {
                    if (extraOptions && extraOptions.multipart) {
                        fetchOpts.body = params;
                    } else if (params) {
                        headers['Content-Type'] = 'application/json';
                        fetchOpts.body = JSON.stringify(params);
                    }
                }

                fetch(url, fetchOpts)
                    .then(function(res) {
                        if (progressTimer) clearInterval(progressTimer);
                        if (!res.ok) {
                            throw new Error('HTTP ' + res.status);
                        }
                        return res.json();
                    })
                    .then(function(json) {
                        if (setupOptions.lock) {
                            setupOptions.lock._ajax_active_ = false;
                        }
                        if (setupOptions.oncomplete) {
                            try { setupOptions.oncomplete(); } catch(e){}
                        }
                        
                        var result = json;
                        if (extraOptions && extraOptions.mapper) {
                            result = extraOptions.mapper(json);
                        }

                        // Emit fake ajax_success for count analytics in bg.js
                        var fakeEvent = { url: path };
                        events.trigger('ajax_success', result, fakeEvent);

                        d.call(result);
                    })
                    .catch(function(err) {
                        if (progressTimer) clearInterval(progressTimer);
                        if (setupOptions.lock) {
                            setupOptions.lock._ajax_active_ = false;
                        }
                        if (setupOptions.oncomplete) {
                            try { setupOptions.oncomplete(); } catch(e){}
                        }
                        d.fail({ status: 500, message: err.message });
                    });
            }, 0);

            return d;
        },

        verify: function() {
            var self = this;
            return this._request('GET', '/api/v1/accounts/verify_credentials', null, {
                mapper: function(json) {
                    var u = mapUser(json);
                    self.id = u.id;
                    return u;
                }
            });
        },

        getHomeTimeline: function(params) {
            var query = {};
            if (params && params.since_id) query.since_id = params.since_id;
            if (params && params.max_id) query.max_id = params.max_id;
            query.limit = 40;

            return this._request('GET', '/api/v1/timelines/home', query, {
                mapper: function(json) {
                    return json.map(mapStatus).filter(Boolean);
                }
            });
        },

        getMentions: function(params) {
            var query = { 'types[]': 'mention' };
            if (params && params.since_id) query.since_id = params.since_id;
            if (params && params.max_id) query.max_id = params.max_id;
            query.limit = 40;

            return this._request('GET', '/api/v1/notifications', query, {
                mapper: function(json) {
                    return json.map(function(item) {
                        return mapStatus(item.status);
                    }).filter(Boolean);
                }
            });
        },

        getUserTimeline: function(params) {
            var query = {};
            if (params && params.since_id) query.since_id = params.since_id;
            if (params && params.max_id) query.max_id = params.max_id;
            query.limit = 40;

            var userId = (params && params.id) || this.id;
            return this._request('GET', '/api/v1/accounts/' + userId + '/statuses', query, {
                mapper: function(json) {
                    return json.map(mapStatus).filter(Boolean);
                }
            });
        },

        getContextTimeline: function(params) {
            var statusId = params.id;
            return this._request('GET', '/api/v1/statuses/' + statusId + '/context', null, {
                mapper: function(json) {
                    var ancestors = json.ancestors || [];
                    var descendants = json.descendants || [];
                    return ancestors.concat(descendants).map(mapStatus).filter(Boolean);
                }
            });
        },

        showUser: function(params) {
            var self = this;
            var userId = params.id;
            var d = new Deferred();
            
            d.setupAjax = function(opts) {
                return d;
            };

            var userUrl = self.instanceUrl.replace(/\/$/, '') + '/api/v1/accounts/' + userId;
            var relUrl = self.instanceUrl.replace(/\/$/, '') + '/api/v1/accounts/relationships?id[]=' + userId;
            var headers = { 'Authorization': 'Bearer ' + self.token };

            Promise.all([
                fetch(userUrl, { headers: headers }).then(function(res) { return res.json(); }),
                fetch(relUrl, { headers: headers }).then(function(res) { return res.json(); }).catch(function() { return []; })
            ]).then(function(results) {
                var userJson = results[0];
                var relJson = results[1] || [];
                var rel = relJson[0] || {};

                var u = mapUser(userJson);
                if (u) {
                    u.following = rel.following || false;
                    u.status = (userJson.statuses_count > 0) ? {} : null;
                }
                d.call(u);
            }).catch(function(err) {
                d.fail({ status: 500, message: err.message });
            });

            return d;
        },

        showRelationshipById: function(targetId, sourceId) {
            var self = this;
            var d = new Deferred();
            d.setupAjax = function() { return d; };

            var relUrl = self.instanceUrl.replace(/\/$/, '') + '/api/v1/accounts/relationships?id[]=' + targetId;
            var headers = { 'Authorization': 'Bearer ' + self.token };

            fetch(relUrl, { headers: headers })
                .then(function(res) { return res.json(); })
                .then(function(json) {
                    var rel = json[0] || {};
                    d.call({
                        relationship: {
                            source: {
                                following: rel.followed_by ? 'true' : 'false'
                            }
                        }
                    });
                })
                .catch(function(err) {
                    d.fail({ status: 500, message: err.message });
                });

            return d;
        },

        showStatus: function(params) {
            return this._request('GET', '/api/v1/statuses/' + params.id, null, {
                mapper: mapStatus
            });
        },

        postStatus: function(params) {
            var payload = {
                status: params.status
            };
            if (params.in_reply_to_status_id) {
                payload.in_reply_to_id = params.in_reply_to_status_id;
            }
            return this._request('POST', '/api/v1/statuses', payload, {
                mapper: mapStatus
            });
        },

        postPhoto: function(params) {
            // Mastodon photo upload is two steps: 
            // 1. Upload to /api/v1/media
            // 2. Post status with media_ids
            var self = this;
            var d = new Deferred();
            var setupOptions = {};

            d.setupAjax = function(opts) {
                Object.assign(setupOptions, opts);
                return d;
            };

            setTimeout(function() {
                if (setupOptions.onstart) setupOptions.onstart();

                var fd = new FormData();
                fd.append('file', params.photo);

                var uploadUrl = self.instanceUrl.replace(/\/$/, '') + '/api/v1/media';
                
                fetch(uploadUrl, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + self.token },
                    body: fd
                })
                .then(function(res) {
                    if (!res.ok) throw new Error('Media upload failed');
                    return res.json();
                })
                .then(function(mediaJson) {
                    var payload = {
                        status: params.status,
                        media_ids: [mediaJson.id]
                    };
                    if (params.in_reply_to_status_id) {
                        payload.in_reply_to_id = params.in_reply_to_status_id;
                    }

                    return fetch(self.instanceUrl.replace(/\/$/, '') + '/api/v1/statuses', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + self.token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                })
                .then(function(res) {
                    if (!res.ok) throw new Error('Status posting failed');
                    return res.json();
                })
                .then(function(statusJson) {
                    if (setupOptions.oncomplete) setupOptions.oncomplete();
                    
                    var result = mapStatus(statusJson);
                    // Trigger fake photo upload event
                    events.trigger('ajax_success', result, { url: '/api/v1/media' });
                    d.call(result);
                })
                .catch(function(err) {
                    if (setupOptions.oncomplete) setupOptions.oncomplete();
                    d.fail({ status: 500, message: err.message });
                });
            }, 0);

            return d;
        },

        postDirectMessage: function(params) {
            // Mastodon direct messages are status updates with direct visibility.
            // We prepend user mention if not already present.
            var mention = '@' + params.username + ' ';
            var statusText = params.text;
            if (statusText.indexOf(mention) !== 0) {
                statusText = mention + statusText;
            }

            var payload = {
                status: statusText,
                visibility: 'direct'
            };
            if (params.in_reply_to_id) {
                payload.in_reply_to_id = params.in_reply_to_id;
            }

            return this._request('POST', '/api/v1/statuses', payload, {
                mapper: mapStatus
            });
        },

        destroyStatus: function(params) {
            return this._request('DELETE', '/api/v1/statuses/' + params.id);
        },

        destroyDirectMessage: function(params) {
            return this._request('DELETE', '/api/v1/statuses/' + params.id);
        },

        addFavorite: function(params) {
            return this._request('POST', '/api/v1/statuses/' + params.id + '/favourite', null, {
                mapper: mapStatus
            });
        },

        removeFavorite: function(params) {
            return this._request('POST', '/api/v1/statuses/' + params.id + '/unfavourite', null, {
                mapper: mapStatus
            });
        },

        repostStatus: function(params) {
            return this._request('POST', '/api/v1/statuses/' + params.id + '/reblog', null, {
                mapper: mapStatus
            });
        },

        showInbox: function(params) {
            var query = {};
            if (params && params.max_id) query.max_id = params.max_id;
            query.limit = 40;

            return this._request('GET', '/api/v1/conversations', query, {
                mapper: function(json) {
                    return json.map(mapMessage).filter(Boolean);
                }
            });
        },

        addFriend: function(params) {
            var userId = params.id;
            return this._request('POST', '/api/v1/accounts/' + userId + '/follow', null, {
                mapper: function(json) {
                    return {
                        id: userId,
                        following: json.following
                    };
                }
            });
        },

        removeFriend: function(params) {
            var userId = params.id;
            return this._request('POST', '/api/v1/accounts/' + userId + '/unfollow', null, {
                mapper: function(json) {
                    return {
                        id: userId,
                        following: json.following
                    };
                }
            });
        },

        getFavorites: function(params) {
            var query = {};
            if (params && params.since_id) query.since_id = params.since_id;
            if (params && params.max_id) query.max_id = params.max_id;
            query.limit = 40;

            return this._request('GET', '/api/v1/favourites', query, {
                mapper: function(json) {
                    return json.map(mapStatus).filter(Boolean);
                }
            });
        },

        getPublicTimeline: function(params) {
            var query = {};
            if (params && params.since_id) query.since_id = params.since_id;
            if (params && params.max_id) query.max_id = params.max_id;
            query.limit = 40;

            return this._request('GET', '/api/v1/timelines/public', query, {
                mapper: function(json) {
                    return json.map(mapStatus).filter(Boolean);
                }
            });
        },

        getNotification: function() {
            // Count recent notifications
            var self = this;
            var d = new Deferred();
            
            d.setupAjax = function() { return d; };

            setTimeout(function() {
                var url = self.instanceUrl.replace(/\/$/, '') + '/api/v1/notifications?limit=20';
                fetch(url, {
                    headers: { 'Authorization': 'Bearer ' + self.token }
                })
                .then(function(res) {
                    if (!res.ok) throw new Error();
                    return res.json();
                })
                .then(function(json) {
                    var lastSeenId = localStorage.getItem('last_seen_notification_id') || '0';
                    var unreadMentions = 0;
                    var unreadDMs = 0;
                    var maxId = lastSeenId;

                    function isGreater(a, b) {
                        if (a.length !== b.length) {
                            return a.length > b.length;
                        }
                        return a > b;
                    }

                    json.forEach(function(item) {
                        var itemId = String(item.id);
                        if (isGreater(itemId, maxId)) {
                            maxId = itemId;
                        }
                        if (isGreater(itemId, lastSeenId)) {
                            if (item.type === 'mention') {
                                if (item.status && item.status.visibility === 'direct') {
                                    unreadDMs++;
                                } else {
                                    unreadMentions++;
                                }
                            }
                        }
                    });

                    // Persist the latest notification ID globally
                    if (Global.PREFiX) {
                        Global.PREFiX.latest_notification_id = maxId;
                    }

                    // If the user is actively viewing mentions or direct messages, mark them as seen
                    if (Global.PREFiX) {
                        if (Global.PREFiX.current === 'mentions_model' && isGreater(maxId, lastSeenId)) {
                            localStorage.setItem('last_seen_notification_id', maxId);
                            unreadMentions = 0;
                        }
                        if (Global.PREFiX.current === 'privatemsgs_model' && isGreater(maxId, lastSeenId)) {
                            localStorage.setItem('last_seen_notification_id', maxId);
                            unreadDMs = 0;
                        }
                    }

                    d.call({
                        mentions: unreadMentions,
                        direct_messages: unreadDMs
                    });
                })
                .catch(function(err) {
                    console.error('getNotification error:', err);
                    d.call({ mentions: 0, direct_messages: 0 });
                });
            }, 0);

            return d;
        },

        getSavedSearches: function() {
            var d = new Deferred();
            setTimeout(function() { d.call([]); }, 0);
            return d;
        },

        searchPublicTimeline: function(params) {
            var query = { q: params.q, type: 'statuses', limit: 40 };
            return this._request('GET', '/api/v2/search', query, {
                mapper: function(json) {
                    var statuses = json.statuses || [];
                    return statuses.map(mapStatus).filter(Boolean);
                }
            });
        },

        getRateLimit: function() {
            var d = new Deferred();
            setTimeout(function() {
                d.call({
                    hourly_limit: 300,
                    remaining_hits: 300,
                    reset_time: new Date(Date.now() + 3600 * 1000).toISOString()
                });
            }, 0);
            return d;
        },

        streamingAPI: function() {
            var d = new Deferred();
            d.hold = function() { return d; };
            return d;
        }
    };

    // 4. Global Mock interface for Ripple
    var Ripple = function(authConfig) {
        if (!authConfig) return null;
        var configObj = authConfig;
        if (typeof authConfig === 'string') {
            try {
                configObj = JSON.parse(authConfig);
            } catch(e) {
                configObj = { token: authConfig, instance: 'https://mastodon.social' };
            }
        }
        return new MastodonClient(configObj);
    };

    Ripple.events = events;
    Ripple.helpers = Ripple.helpers || {};
    Ripple.OAuth = {
        timeCorrectionMsec: 0
    };
    Ripple.config = function() { return Ripple; };
    Ripple.getConfig = function() { return 0; };
    Ripple.helpers.isOnline = function() {
        return navigator.onLine;
    };
    Ripple.setupConsumer = function() { return Ripple; };
    Ripple.shorten = {};
    Ripple.ajax = {
        get: function() { return new Deferred(); },
        post: function() { return new Deferred(); }
    };
    Object.defineProperty(Ripple, 'Deferred', {
        get: function() {
            return Global.Deferred;
        }
    });

    Global.Ripple = Ripple;
    if (Global.R === undefined) Global.R = Ripple;

})(this);
