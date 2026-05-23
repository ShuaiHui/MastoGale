(function() {
    'use strict';

    var authBtn = document.getElementById('auth-btn');
    var instanceInput = document.getElementById('instance-input');
    var loginForm = document.getElementById('login-form');
    var statusContainer = document.getElementById('status-container');
    var statusText = document.getElementById('status-text');
    var msgDiv = document.getElementById('msg');

    function showError(err) {
        msgDiv.textContent = err;
        msgDiv.classList.add('error');
        loginForm.style.display = 'block';
        statusContainer.style.display = 'none';
        authBtn.disabled = false;
    }

    function showStatus(text) {
        statusText.textContent = text;
        loginForm.style.display = 'none';
        statusContainer.style.display = 'block';
        msgDiv.textContent = '';
        msgDiv.classList.remove('error');
    }

    var redirectUri = 'urn:ietf:wg:oauth:2.0:oob';

    // Listen to dropdown select change to update input text
    var instanceSelect = document.getElementById('instance-select');
    if (instanceSelect) {
        instanceSelect.addEventListener('change', function() {
            instanceInput.value = instanceSelect.value;
        });
    }

    // Step 1: Request authorization code
    authBtn.addEventListener('click', function() {
        var instance = instanceInput.value.trim();
        if (!instance) {
            showError('请输入长毛象实例地址');
            return;
        }

        // Clean domain and protocol
        if (!/^https?:\/\//i.test(instance)) {
            instance = 'https://' + instance;
        }
        // Ensure no trailing slashes or path
        try {
            var urlObj = new URL(instance);
            instance = urlObj.origin;
        } catch(e) {
            showError('无效的实例地址');
            return;
        }

        authBtn.disabled = true;
        showStatus('正在向实例注册应用...');

        // Register App
        var registerUrl = instance + '/api/v1/apps';
        var payload = {
            client_name: 'MastoGale',
            redirect_uris: redirectUri,
            scopes: 'read write follow',
            website: 'https://github.com/ShuaiHui/MastoGale'
        };

        fetch(registerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(res) {
            if (!res.ok) throw new Error('向长毛象注册应用失败，请检查实例是否支持动态注册或网络是否连通');
            return res.json();
        })
        .then(function(appJson) {
            var clientId = appJson.client_id;
            var clientSecret = appJson.client_secret;

            // Save temporary values to storage
            chrome.storage.local.set({
                temp_instance: instance,
                temp_client_id: clientId,
                temp_client_secret: clientSecret
            }, function() {
                var authUrl = instance + '/oauth/authorize?client_id=' + clientId + 
                              '&redirect_uri=' + encodeURIComponent(redirectUri) + 
                              '&response_type=code&scope=read+write+follow';
                
                // Open authorize page in a new tab instead of changing window location
                chrome.tabs.create({ url: authUrl });
                
                // Display manual paste area in current page as fallback
                showStatus('已在新标签页中打开授权页面！');
                document.getElementById('manual-code-container').style.display = 'block';
                authBtn.disabled = false;
            });
        })
        .catch(function(err) {
            showError(err.message);
        });
    });

    // Step 2: Handle manual paste fallback
    var manualLoginBtn = document.getElementById('manual-login-btn');
    var manualCodeInput = document.getElementById('manual-code-input');

    manualLoginBtn.addEventListener('click', function() {
        var code = manualCodeInput.value.trim();
        if (!code) {
            showError('请输入粘贴的授权码');
            return;
        }

        manualLoginBtn.disabled = true;
        showStatus('正在验证授权码，请稍候...');

        chrome.storage.local.get(['temp_instance', 'temp_client_id', 'temp_client_secret'], function(items) {
            var instance = items.temp_instance;
            var clientId = items.temp_client_id;
            var clientSecret = items.temp_client_secret;

            if (!instance || !clientId || !clientSecret) {
                showError('登录临时会话丢失，请返回重新发起授权');
                manualLoginBtn.disabled = false;
                return;
            }

            var tokenUrl = instance.replace(/\/$/, '') + '/oauth/token';
            var payload = {
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                code: code,
                grant_type: 'authorization_code'
            };

            fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(function(res) {
                if (!res.ok) throw new Error('Token 换取失败，请检查授权码是否正确或已过期');
                return res.json();
            })
            .then(function(tokenJson) {
                var accessToken = tokenJson.access_token;
                var tokenObj = {
                    token: accessToken,
                    instance: instance
                };

                var verifyUrl = instance.replace(/\/$/, '') + '/api/v1/accounts/verify_credentials';
                return fetch(verifyUrl, {
                    headers: { 'Authorization': 'Bearer ' + accessToken }
                })
                .then(function(res) {
                    if (!res.ok) throw new Error('凭据验证失败');
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
                        } else {
                            accountsList.push(newAccEntry);
                        }

                        chrome.storage.local.set({
                            'lscache-access_token': JSON.stringify(tokenObj),
                            'lscache-account_details': JSON.stringify(accountObj),
                            'lscache-accounts_list': JSON.stringify(accountsList),
                            'lscache-is_first_run': 'false'
                        }, function() {
                            chrome.storage.local.remove(['temp_instance', 'temp_client_id', 'temp_client_secret'], function() {
                                showStatus('🎉 登录成功！正在重新载入 PREFiX...');
                                setTimeout(function() {
                                    // Switch focus back or refresh
                                    chrome.runtime.reload();
                                    window.close();
                                }, 1000);
                            });
                        });
                    });
                });
            })
            .catch(function(err) {
                showError(err.message);
                manualLoginBtn.disabled = false;
            });
        });
    });
})();
