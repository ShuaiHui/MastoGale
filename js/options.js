$(function() {
	var bg_win = window;
	var PREFiX = bg_win.PREFiX;
	var lscache = bg_win.lscache;

	// --- Multi-Account Switching Support ---
	var accountsList = lscache.get('accounts_list') || [];
	if (!Array.isArray(accountsList)) {
		accountsList = [];
	}

	// Backward compatibility: if active account is logged in but list is empty, initialize list with active account
	if (accountsList.length === 0 && PREFiX.account && PREFiX.accessToken) {
		accountsList.push({
			instance: PREFiX.accessToken.instance,
			accessToken: PREFiX.accessToken,
			account: PREFiX.account
		});
		lscache.set('accounts_list', accountsList);
	}

	function renderAccounts() {
		var $container = $('#accounts-list-container');
		$container.empty();

		if (accountsList.length === 0) {
			$container.html('<div style="color: #94a3b8; font-size: 13px; padding: 10px 0;">您当前尚未登入任何长毛象账号，请点击下方按钮登入。</div>');
			return;
		}

		accountsList.forEach(function(item, idx) {
			var isActive = false;
			if (PREFiX.accessToken && 
				PREFiX.accessToken.instance === item.instance && 
				PREFiX.account && 
				String(PREFiX.account.id) === String(item.account.id)) {
				isActive = true;
			}

			var name = item.account.name || item.account.screen_name;
			var domain = item.instance.replace(/^https?:\/\//i, '');
			var avatar = item.account.profile_image_url || '/icons/48.png';

			var $item = $('<div class="account-item"></div>');
			
			var $avatarImg = $('<img />').attr('src', avatar).attr('alt', name);
			$item.append($avatarImg);

			var $info = $('<div class="account-item-info"></div>');
			$info.append($('<div class="account-item-name"></div>').text(name));
			$info.append($('<div class="account-item-instance"></div>').text('@' + item.account.screen_name + '@' + domain));
			$item.append($info);

			if (isActive) {
				$item.append($('<span class="account-active-badge">当前活跃</span>'));
			}

			var $actions = $('<div class="account-actions"></div>');
			if (!isActive) {
				var $switchBtn = $('<button class="account-btn account-btn-switch"></button>')
					.text('切换')
					.attr('data-index', idx);
				$actions.append($switchBtn);
			}

			var $logoutBtn = $('<button class="account-btn account-btn-logout"></button>')
				.text('退出')
				.attr('data-index', idx);
			$actions.append($logoutBtn);
			
			$item.append($actions);
			$container.append($item);
		});
	}

	// Switch Account Click Handler
	$(document).on('click', '.account-btn-switch', function() {
		var idx = parseInt($(this).attr('data-index'), 10);
		var targetAcc = accountsList[idx];
		if (targetAcc) {
			lscache.set('access_token', targetAcc.accessToken);
			lscache.set('account_details', targetAcc.account);
			location.reload();
		}
	});

	// Logout Click Handler
	$(document).on('click', '.account-btn-logout', function() {
		var idx = parseInt($(this).attr('data-index'), 10);
		var targetAcc = accountsList[idx];
		if (!targetAcc) return;

		var isActive = false;
		if (PREFiX.accessToken && 
			PREFiX.accessToken.instance === targetAcc.instance && 
			PREFiX.account && 
			String(PREFiX.account.id) === String(targetAcc.account.id)) {
			isActive = true;
		}

		// Remove from list
		accountsList.splice(idx, 1);
		lscache.set('accounts_list', accountsList);

		if (isActive) {
			if (accountsList.length > 0) {
				// Switch to first remaining account
				lscache.set('access_token', accountsList[0].accessToken);
				lscache.set('account_details', accountsList[0].account);
			} else {
				// No accounts left, clear active session
				lscache.remove('access_token');
				lscache.remove('account_details');
				PREFiX.reset();
			}
		}

		location.reload();
	});

	// Add Account Click Handler
	$('#add-account').click(function(e) {
		chrome.tabs.create({ url: 'login.html' });
	});

	renderAccounts();
	// ----------------------------------------
	$('#version').text(PREFiX.version);

	var current = PREFiX.settings.current;

	$('[key]').each(function() {
		var $item = $(this);
		var key = $item.attr('key');
		var value = current[key];
		switch ($item.attr('type')) {
			case 'checkbox':
				$item.prop('checked', value);
				break;
			case 'text':
			case 'select':
				$item.val(value);
				break;
			case 'range':
				$item.val(value + '');
				break;
		}
	});

	$('[foldable-src]').on('change', function(e) {
		var type = $(this).attr('foldable-src');
		$('[foldable-tgt="' + type + '"]').prop('hidden', ! this.checked);
	}).trigger('change');

	var $volume = $('#volume');
	$('[key="volume"]').on('change', function(e) {
		var volume = +$(this).val();
		$volume.text(parseInt(volume * 100, 10) + '%');
		PREFiX.settings.current.volume = volume;
	}).trigger('change');

	var $play_sound = $('[key="playSound"]');
	$play_sound.on('change', function(e) {
		var checked = $play_sound.prop('checked');
		$('[key="volume"]').prop('disabled', ! checked);
	}).trigger('change');

	$('#playSound').click(function(e) {
		bg_win.playSound(true);
	});

	var $auto_flush_cache = $('[key="autoFlushCache"]');
	var $cache_amount = $('[key="cacheAmount"]');

	$auto_flush_cache.on('change', function(e) {
		var checked = $auto_flush_cache.prop('checked');
		$cache_amount.prop('disabled', ! checked);
	}).trigger('change');

	$cache_amount.on('change', function(e) {
		$('#cacheAmount').text($cache_amount.val());
	}).trigger('change');

	// --- Debug Center Panel Handlers ---
	$('#show-debug-logs').click(function() {
		var $display = $('#debug-logs-display');
		if ($display.is(':visible')) {
			$display.hide();
			$(this).text('查看授权截获日志');
		} else {
			chrome.storage.local.get('debug_logs', function(data) {
				var logs = [];
				if (data.debug_logs) {
					try {
						logs = JSON.parse(data.debug_logs);
					} catch(e) {
						logs = [];
					}
				}
				if (logs.length === 0) {
					$display.text('暂无调试日志。若授权流程未自动完成，请点击“添加账号”并尝试。');
				} else {
					$display.text(logs.join('\n'));
				}
				$display.show();
				$display.scrollTop($display[0].scrollHeight);
			});
			$(this).text('收起调试日志');
		}
	});

	$('#test-api-conn').click(function() {
		var $display = $('#debug-logs-display');
		$display.show().text('⏳ 正在进行 API 联通性诊断测试，请稍候...\n');
		
		if (!PREFiX || !PREFiX.accessToken) {
			$display.append('❌ 诊断失败: 未检测到当前活跃账号。请先登录账号。\n');
			return;
		}
		
		var instance = PREFiX.accessToken.instance;
		var token = PREFiX.accessToken.token;
		
		$display.append('🔸 当前实例: ' + instance + '\n');
		$display.append('🔸 Token 密匙: ' + token.substring(0, 10) + '...\n');
		
		// 1. Test verify_credentials
		var verifyUrl = instance.replace(/\/$/, '') + '/api/v1/accounts/verify_credentials';
		$display.append('📡 1. 测试 verify_credentials 联通性 (' + verifyUrl + ')...\n');
		
		fetch(verifyUrl, {
			headers: { 'Authorization': 'Bearer ' + token }
		})
		.then(function(res) {
			$display.append('   -> 响应状态码: ' + res.status + ' ' + res.statusText + '\n');
			if (!res.ok) throw new Error('验证凭据失败: status ' + res.status);
			return res.json();
		})
		.then(function(userJson) {
			$display.append('   ✅ 验证成功! 用户名: @' + userJson.username + ', 昵称: ' + userJson.display_name + '\n');
			
			// 2. Test timelines/home
			var tlUrl = instance.replace(/\/$/, '') + '/api/v1/timelines/home?limit=3';
			$display.append('📡 2. 测试 Home Timeline 联通性 (' + tlUrl + ')...\n');
			
			return fetch(tlUrl, {
				headers: { 'Authorization': 'Bearer ' + token }
			})
			.then(function(res) {
				$display.append('   -> 响应状态码: ' + res.status + ' ' + res.statusText + '\n');
				if (!res.ok) throw new Error('获取 Timeline 失败: status ' + res.status);
				return res.json();
			})
			.then(function(tlJson) {
				$display.append('   ✅ 获取 Timeline 成功! 返回了 ' + tlJson.length + ' 条消息。\n');
				if (tlJson.length > 0) {
					$display.append('   📝 最新消息预览 (Author: @' + tlJson[0].account.username + '):\n');
					var textPreview = tlJson[0].content.replace(/<[^>]+>/g, '').substring(0, 80);
					$display.append('      "' + textPreview + '..."\n');
				}
				$display.append('\n🎉 API 联通性全部测试通过! 网络与实例连接 100% 正常。');
			});
		})
		.catch(function(err) {
			$display.append('❌ 诊断过程中发生异常: ' + err.message + '\n');
			$display.append('⚠️ 请确认您的网络是否能直连长毛象实例（中国大陆地区连接可能需要开启代理），或 Token 是否已失效。');
		});
	});

	$('#clear-debug-logs').click(function() {
		chrome.storage.local.remove('debug_logs', function() {
			$('#debug-logs-display').text('日志已成功清除！').hide();
			$('#show-debug-logs').text('查看授权截获日志');
		});
	});
	// -----------------------------------

	var last_used_page = lscache.get('last_used_page') || 0;
	var page_loading_timeout;
	$('#navbar li').each(function(i) {
		var $item = $(this);
		$item.click(function(e) {
			$('#navbar li').removeClass('current');
			$('.page').removeClass('current loading');
			$item.addClass('current');
			var page = $item.prop('id') + '-page';
			var $page = $('#' + page);
			$page.addClass('current loading');
			clearTimeout(page_loading_timeout);
			page_loading_timeout = setTimeout(function() {
				$page.removeClass('loading');
			}, 300);
			$('body').scrollTop(0);
			lscache.set('last_used_page', i);
		});
	}).eq(last_used_page).click();

	$('#repostFormat').change(function(e) {
		if (! this.value.trim()) {
			this.value = PREFiX.settings.default.repostFormat;
		}
	});

	var custom_consumer = lscache.get('custom_consumer');
	if (custom_consumer) {
		$('#key').val(custom_consumer.key);
		$('#secret').val(custom_consumer.secret);
	} else {
		custom_consumer = { };
	}
	$('#set-consumer').click(function(e) {
		var key = $('#key').val().trim();
		var secret = $('#secret').val().trim();
		if (! key || ! secret) return;
		if (key === custom_consumer.key ||
			secret === custom_consumer.secret) {
			alert('您已经成功设置了尾巴, 不需要重复设置. :)');
			return;
		}
		bg_win.enableCustomConsumer(key, secret);
	});
	$('#reset-consumer').click(function(e) {
		bg_win.disableCustomConsumer();
		location.reload();
	});

	var $usage_tip_list = $('#usage-tip-page ol').first();
	bg_win.usage_tips.forEach(function(tip) {
		if (! tip) return;
		var $li = $('<li />');
		$li.html(tip);
		$li.appendTo($usage_tip_list);
	});

	$('#status-count').text(bg_win.getStatusCount());
	$('#photo-count').text(bg_win.getPhotoCount());

	var install_time = lscache.get('install_time');
	install_time = bg_win.getYMD(install_time);
	$('#install-time').text(install_time);

	$('#show-updates').click(function(e) {
		var update = [];
		var history = bg_win.history;
		Object.keys(history).forEach(function(version) {
			update.push('# ' + version + ' #');
			update.push.apply(update, history[version]);
			update.push('');
		});
		alert(update.join('\n'));
	});

	$('#filters-overlay').click(function(e) {
		var $page = $(this).find('.page');
		$page.removeClass('pulse');
		setTimeout(function() {
			$page.addClass('pulse');
		});
	});

	$('#filters-area').click(function(e) {
		e.stopPropagation();
	});

	var timeout;
	var filters_model = avalon.define('filters', function(vm) {
		vm.items = [];
		vm.remove = function(e) {
			this.$vmodel.$remove();
		}
		vm.blur = function(e) {
			if (! this.value.trim()) {
				return vm.remove.call(this, e);
			}
		}
	});

	filters_model.items = current.filters;

	$('#show-filters').click(function(e) {
		$('#filters-overlay').
		show().
		css('animation', 'fadeIn .2s');
	});

	function addFilter() {
		var pattern = $pattern.val();
		var type = $type.val();
		if (pattern && pattern.trim().length) {
			filters_model.items.push({
				pattern: pattern,
				type: type
			});
			$pattern.val('');
		}
	}

	var $pattern = $('#filters-list .last .filter-pattern');
	$pattern.
	keyup(function(e) {
		if (e.keyCode === 13) {
			this.blur();
		}
	}).
	blur(function(e) {
		timeout = setTimeout(addFilter, 250);
	});

	$type = $('#filters-list .last .filter-type');
	$type.
	click(function(e) {
		clearTimeout(timeout);
	}).
	change(addFilter);

	$('#filters-overlay-confirm, #filters-overlay .close-button').
	click(function(e) {
		$('#filters-overlay').
		css('animation', 'fadeOut .2s').
		delay(200).
		hide(0);
	});

	function save(e) {
		$('[key]').each(function() {
			var $item = $(this);
			var key = $item.attr('key');
			var value;
			switch ($item.attr('type')) {
				case 'checkbox':
					value = $item.prop('checked');
					break;
				case 'select':
				case 'text':
					value = $item.val();
					break;
				case 'range':
					value = +$item.val();
					break;
			}
			current[key] = value;
		});

		var filters = filters_model.items.map(function(item) {
			return item.$model;
		});

		current.filters = filters;

		PREFiX.settings.save();
	}

	$('[key]').on('change', save);
	$('#filters-overlay .close-button, #filters-overlay-confirm').click(save);
	onunload = function(e) {
		save();
		PREFiX.settings.onSettingsUpdated();
	}
});
