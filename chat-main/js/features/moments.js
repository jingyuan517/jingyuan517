(function() {
    var STORAGE_KEY = 'moments';
    var IMG_POOL_KEY = 'moments_partner_images';

    function getStorageKey(baseKey) {
        if (typeof window.getStorageKey === 'function') {
            try { return window.getStorageKey(baseKey); } catch (e) {}
        }
        var prefix = window.APP_PREFIX || 'CHAT_APP_V3_';
        var sessionId = window.SESSION_ID || 'default';
        return prefix + sessionId + '_' + baseKey;
    }

    var momentsData = [];
    var pendingImages = [];
    var partnerImagePool = [];
    var MOMENT_DELAY_MIN = 7200000;
    var MOMENT_DELAY_MAX = 10800000;

    function loadMoments() {
        if (typeof localforage === 'undefined') return Promise.resolve([]);
        return localforage.getItem(getStorageKey(STORAGE_KEY)).then(function(val) {
            if (!Array.isArray(val)) return [];
            momentsData = val;
            return val;
        }).catch(function() { return []; });
    }

    function saveMoments() {
        if (typeof localforage === 'undefined') return Promise.resolve();
        return localforage.setItem(getStorageKey(STORAGE_KEY), momentsData).catch(function() {});
    }

    function loadPartnerImagePool() {
        if (typeof localforage === 'undefined') return Promise.resolve([]);
        return localforage.getItem(getStorageKey(IMG_POOL_KEY)).then(function(val) {
            if (!Array.isArray(val)) { partnerImagePool = []; return []; }
            partnerImagePool = val;
            return val;
        }).catch(function() { partnerImagePool = []; return []; });
    }

    function savePartnerImagePool() {
        if (typeof localforage === 'undefined') return Promise.resolve();
        return localforage.setItem(getStorageKey(IMG_POOL_KEY), partnerImagePool).catch(function() {});
    }

    function getSettings() {
        if (typeof settings !== 'undefined') return settings;
        return {};
    }

    function getMyName() {
        var s = getSettings();
        return (s && s.myName) || '我';
    }

    function getPartnerName() {
        var s = getSettings();
        return (s && s.partnerName) || '对方';
    }

    function getReplyPool() {
        var pool = typeof window.customReplies !== 'undefined' && Array.isArray(window.customReplies) ? window.customReplies : [];
        pool = pool.filter(function(r) { return r && String(r).trim(); }).map(function(r) { return String(r).trim(); });
        if (pool.length === 0) {
            pool = ['嗯嗯', '好的', '知道了', '不错', '真好', '哈哈', 'OK', '收到', '明白', '对呀'];
        }
        return pool;
    }

    function formatTime(ts) {
        var d = new Date(ts);
        var now = new Date();
        var diff = now - d;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        if (diff < 172800000) return '昨天 ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
        var month = String(d.getMonth()+1).padStart(2,'0');
        var day = String(d.getDate()).padStart(2,'0');
        if (d.getFullYear() === now.getFullYear()) return month + '-' + day + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
        return d.getFullYear() + '-' + month + '-' + day + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    }

    function esc(s) {
        return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function getAvatar(sender) {
        if (sender === 'partner') {
            var av = document.getElementById('partner-avatar');
            return av ? av.src : '';
        }
        var av = document.getElementById('my-avatar');
        return av ? av.src : '';
    }

    function renderFeed() {
        var container = document.getElementById('moments-feed');
        if (!container) return;
        if (!momentsData || momentsData.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-secondary);"><i class="fas fa-square" style="font-size:48px;opacity:0.15;margin-bottom:16px;display:block;"></i><div style="font-size:15px;">还没有朋友圈动态</div><div style="font-size:13px;margin-top:6px;">在下方输入框分享你的新鲜事吧</div></div>';
            return;
        }
        var sorted = momentsData.slice().sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
        var html = '';
        sorted.forEach(function(moment) {
            var isMe = moment.sender === 'user';
            var name = isMe ? getMyName() : getPartnerName();
            var avatar = getAvatar(moment.sender);
            var timeStr = formatTime(moment.timestamp);
            var textHtml = moment.text ? '<div style="font-size:14px;line-height:1.6;color:var(--text-primary);margin-bottom:8px;white-space:pre-wrap;word-break:break-word;">' + esc(moment.text) + '</div>' : '';
            var imagesHtml = '';
            if (moment.images && moment.images.length > 0) {
                imagesHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:8px;max-width:240px;">';
                moment.images.forEach(function(img, idx) {
                    imagesHtml += '<div style="aspect-ratio:1;overflow:hidden;border-radius:6px;cursor:pointer;background:var(--secondary-bg);" onclick="window._openMomentsImg(\'' + esc(img) + '\')"><img src="' + esc(img) + '" style="width:100%;height:100%;object-fit:cover;display:block;"></div>';
                });
                imagesHtml += '</div>';
            }
            var commentsHtml = '';
            if (moment.comments && moment.comments.length > 0) {
                commentsHtml = '<div style="margin-top:8px;background:var(--secondary-bg);border-radius:8px;padding:8px 10px;">';
                moment.comments.forEach(function(c) {
                    var cName = c.sender === 'user' ? getMyName() : getPartnerName();
                    commentsHtml += '<div style="font-size:13px;line-height:1.6;color:var(--text-primary);"><strong style="font-weight:600;color:var(--accent-color);">' + esc(cName) + '：</strong>' + esc(c.text) + '</div>';
                });
                commentsHtml += '</div>';
            }
            html += '<div class="moments-card" data-id="' + moment.id + '" style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:14px;padding:14px;">';
            html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">';
            html += '<img src="' + esc(avatar) + '" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:1px solid var(--border-color);flex-shrink:0;">';
            html += '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:600;color:var(--text-primary);">' + esc(name) + '</div><div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">' + timeStr + '</div></div>';
            html += '</div>';
            html += textHtml;
            html += imagesHtml;
            html += commentsHtml;
            html += '<div style="margin-top:8px;display:flex;gap:12px;align-items:center;"><button class="moments-comment-btn" data-id="' + moment.id + '" style="padding:4px 12px;border:none;border-radius:6px;background:transparent;color:var(--text-secondary);cursor:pointer;font-size:12px;display:flex;align-items:center;gap:4px;"><i class="fas fa-comment" style="font-size:11px;"></i> 评论</button></div>';
            html += '<div class="moments-comment-box" data-id="' + moment.id + '" style="display:none;margin-top:8px;"><div style="display:flex;gap:6px;"><input type="text" class="moments-comment-input" placeholder="写评论…" style="flex:1;padding:8px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);font-size:13px;outline:none;font-family:var(--font-family);"><button class="moments-comment-submit" data-id="' + moment.id + '" style="padding:8px 14px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-family);">发送</button></div></div>';
            html += '</div>';
        });
        container.innerHTML = html;

        container.querySelectorAll('.moments-comment-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = this.dataset.id;
                var box = container.querySelector('.moments-comment-box[data-id="' + id + '"]');
                if (box) {
                    var isVisible = box.style.display !== 'none';
                    box.style.display = isVisible ? 'none' : 'block';
                    if (!isVisible) {
                        var input = box.querySelector('.moments-comment-input');
                        if (input) setTimeout(function() { input.focus(); }, 50);
                    }
                }
            });
        });

        container.querySelectorAll('.moments-comment-submit').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = this.dataset.id;
                var box = this.closest('.moments-comment-box');
                var input = box ? box.querySelector('.moments-comment-input') : null;
                if (!input) return;
                var text = input.value.trim();
                if (!text) return;
                addComment(id, text);
            });
        });

        container.querySelectorAll('.moments-comment-input').forEach(function(input) {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    var btn = this.closest('.moments-comment-box').querySelector('.moments-comment-submit');
                    if (btn) btn.click();
                }
            });
        });
    }

    function pickReplyFromPool() {
        var pool = getReplyPool();
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function addComment(momentId, text) {
        var moment = null;
        for (var i = 0; i < momentsData.length; i++) {
            if (momentsData[i].id === momentId) { moment = momentsData[i]; break; }
        }
        if (!moment) return;
        moment.comments = moment.comments || [];
        moment.comments.push({
            id: Date.now() + '_' + Math.random().toString(36).slice(2,6),
            sender: 'user',
            text: text,
            timestamp: new Date().toISOString()
        });
        saveMoments().then(function() {
            renderFeed();
            scrollFeedBottom();

            var randomDelay = MOMENT_DELAY_MIN + Math.random() * (MOMENT_DELAY_MAX - MOMENT_DELAY_MIN);
            setTimeout(function() {
                var reply = pickReplyFromPool();
                moment.comments.push({
                    id: Date.now() + '_' + Math.random().toString(36).slice(2,6),
                    sender: 'partner',
                    text: reply,
                    timestamp: new Date().toISOString()
                });
                saveMoments().then(function() {
                    renderFeed();
                    scrollFeedBottom();
                });
            }, randomDelay);
        });
    }

    function scrollFeedBottom() {
        var feed = document.getElementById('moments-feed');
        if (feed) setTimeout(function() { feed.scrollTop = feed.scrollHeight; }, 50);
    }

    function updateSendBtn() {
        var input = document.getElementById('moments-input');
        var sendBtn = document.getElementById('moments-send-btn');
        if (!input || !sendBtn) return;
        var hasText = input.value.trim().length > 0;
        var hasImages = pendingImages.length > 0;
        sendBtn.disabled = !(hasText || hasImages);
        sendBtn.style.opacity = sendBtn.disabled ? '0.5' : '1';
    }

    function renderPartnerImagePoolUI() {
        var container = document.getElementById('moments-img-pool-preview');
        if (!container) return;
        if (partnerImagePool.length === 0) {
            container.innerHTML = '<div style="font-size:12px;color:var(--text-secondary);padding:8px 0;">暂未提供图片，点击上方按钮上传</div>';
            return;
        }
        var html = '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
        partnerImagePool.forEach(function(img, idx) {
            html += '<div style="position:relative;width:48px;height:48px;border-radius:6px;overflow:hidden;border:1px solid var(--border-color);flex-shrink:0;">' +
                '<img src="' + esc(img) + '" style="width:100%;height:100%;object-fit:cover;display:block;">' +
                '<button class="moments-pool-del" data-idx="' + idx + '" style="position:absolute;top:-3px;right:-3px;width:16px;height:16px;border:none;border-radius:50%;background:rgba(0,0,0,0.5);color:#fff;font-size:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">✕</button></div>';
        });
        html += '</div>';
        container.innerHTML = html;
        container.querySelectorAll('.moments-pool-del').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var i = parseInt(this.dataset.idx);
                partnerImagePool.splice(i, 1);
                savePartnerImagePool().then(function() { renderPartnerImagePoolUI(); });
            });
        });
    }

    function openMomentsModal() {
        Promise.all([loadMoments(), loadPartnerImagePool()]).then(function() {
            var modal = document.getElementById('moments-modal');
            if (!modal) return;
            if (typeof showModal === 'function') showModal(modal);
            pendingImages = [];
            var input = document.getElementById('moments-input');
            if (input) input.value = '';
            var preview = document.getElementById('moments-attach-preview');
            if (preview) preview.style.display = 'none';
            var imgList = document.getElementById('moments-img-list');
            if (imgList) imgList.innerHTML = '';
            updateSendBtn();
            renderFeed();
            setTimeout(function() { scrollFeedBottom(); }, 100);
            renderPartnerImagePoolUI();
        });
    }

    function addPartnerMoment() {
        var replyPool = getReplyPool();
        var text = replyPool[Math.floor(Math.random() * replyPool.length)];
        var images = [];
        if (partnerImagePool.length > 0 && Math.random() < 0.3) {
            var count = Math.min(1 + Math.floor(Math.random() * 3), partnerImagePool.length);
            var shuffled = partnerImagePool.slice().sort(function() { return Math.random() - 0.5; });
            images = shuffled.slice(0, count);
        }
        momentsData.unshift({
            id: Date.now() + '_' + Math.random().toString(36).slice(2,6),
            sender: 'partner',
            text: text,
            images: images,
            timestamp: new Date().toISOString(),
            comments: []
        });
        saveMoments().then(function() { renderFeed(); });
    }

    function createMoment(text, images) {
        var moment = {
            id: Date.now() + '_' + Math.random().toString(36).slice(2,6),
            sender: 'user',
            text: text,
            images: images || [],
            timestamp: new Date().toISOString(),
            comments: []
        };
        momentsData.unshift(moment);
        return saveMoments().then(function() {
            renderFeed();
            scrollFeedBottom();

            var partnerDelay = MOMENT_DELAY_MIN + Math.random() * (MOMENT_DELAY_MAX - MOMENT_DELAY_MIN);

            setTimeout(function() {
                var reply = pickReplyFromPool();
                moment.comments.push({
                    id: Date.now() + '_' + Math.random().toString(36).slice(2,6),
                    sender: 'partner',
                    text: reply,
                    timestamp: new Date().toISOString()
                });
                saveMoments().then(function() { renderFeed(); });
            }, partnerDelay);

            setTimeout(function() {
                addPartnerMoment();
            }, partnerDelay + MOMENT_DELAY_MIN/2 + Math.random() * (MOMENT_DELAY_MAX - MOMENT_DELAY_MIN)/2);
        });
    }

    function installEntryButton() {
        var list = document.querySelector('#advanced-modal .settings-item-list');
        if (!list) return;
        var existing = document.getElementById('moments-function');
        if (!existing) return;
        if (existing.dataset.momentsBound) return;
        existing.dataset.momentsBound = 'true';
        existing.addEventListener('click', function() {
            var advModal = document.getElementById('advanced-modal');
            if (advModal && typeof hideModal === 'function') hideModal(advModal);
            setTimeout(openMomentsModal, 120);
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        installEntryButton();

        var sendBtn = document.getElementById('moments-send-btn');
        var input = document.getElementById('moments-input');
        var attachBtn = document.getElementById('moments-attach-btn');
        var clearImgs = document.getElementById('moments-clear-imgs');
        var closeBtn = document.getElementById('close-moments');
        var modal = document.getElementById('moments-modal');

        if (sendBtn) {
            sendBtn.addEventListener('click', function() {
                if (this.disabled) return;
                var text = input ? input.value.trim() : '';
                var images = pendingImages.slice();
                createMoment(text, images).then(function() {
                    if (input) input.value = '';
                    pendingImages = [];
                    var preview = document.getElementById('moments-attach-preview');
                    if (preview) preview.style.display = 'none';
                    var imgList = document.getElementById('moments-img-list');
                    if (imgList) imgList.innerHTML = '';
                    updateSendBtn();
                });
            });
        }

        if (input) {
            input.addEventListener('input', updateSendBtn);
        }

        if (attachBtn) {
            var fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.multiple = true;
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);

            attachBtn.addEventListener('click', function() {
                fileInput.click();
            });

            fileInput.addEventListener('change', function() {
                var files = Array.from(fileInput.files);
                fileInput.value = '';
                if (files.length === 0) return;
                var maxTotal = 9;
                var remaining = maxTotal - pendingImages.length;
                if (remaining <= 0) {
                    if (typeof showNotification === 'function') showNotification('最多添加9张图片', 'warning');
                    return;
                }
                var toAdd = files.slice(0, remaining);
                var promises = toAdd.map(function(file) {
                    if (file.size > 5 * 1024 * 1024) {
                        if (typeof showNotification === 'function') showNotification('图片大小不能超过5MB', 'error');
                        return Promise.resolve(null);
                    }
                    return new Promise(function(resolve) {
                        var reader = new FileReader();
                        reader.onload = function(e) { resolve(e.target.result); };
                        reader.onerror = function() { resolve(null); };
                        reader.readAsDataURL(file);
                    });
                });
                Promise.all(promises).then(function(results) {
                    results.forEach(function(r) { if (r) pendingImages.push(r); });
                    renderImagePreview();
                    updateSendBtn();
                });
            });
        }

        var poolUploadBtn = document.getElementById('moments-pool-upload');
        if (poolUploadBtn) {
            var poolFileInput = document.createElement('input');
            poolFileInput.type = 'file';
            poolFileInput.accept = 'image/*';
            poolFileInput.multiple = true;
            poolFileInput.style.display = 'none';
            document.body.appendChild(poolFileInput);

            poolUploadBtn.addEventListener('click', function() {
                poolFileInput.click();
            });

            poolFileInput.addEventListener('change', function() {
                var files = Array.from(poolFileInput.files);
                poolFileInput.value = '';
                if (files.length === 0) return;
                var promises = files.map(function(file) {
                    if (file.size > 5 * 1024 * 1024) {
                        if (typeof showNotification === 'function') showNotification('图片大小不能超过5MB', 'error');
                        return Promise.resolve(null);
                    }
                    return new Promise(function(resolve) {
                        var reader = new FileReader();
                        reader.onload = function(e) { resolve(e.target.result); };
                        reader.onerror = function() { resolve(null); };
                        reader.readAsDataURL(file);
                    });
                });
                Promise.all(promises).then(function(results) {
                    results.forEach(function(r) { if (r) partnerImagePool.push(r); });
                    savePartnerImagePool().then(function() {
                        renderPartnerImagePoolUI();
                        if (typeof showNotification === 'function') showNotification('已为梦角添加 ' + results.filter(Boolean).length + ' 张图片', 'success');
                    });
                });
            });
        }

        if (clearImgs) {
            clearImgs.addEventListener('click', function() {
                pendingImages = [];
                renderImagePreview();
                updateSendBtn();
            });
        }

        if (closeBtn && modal) {
            closeBtn.addEventListener('click', function() {
                if (typeof hideModal === 'function') hideModal(modal);
            });
        }
    });

    function renderImagePreview() {
        var preview = document.getElementById('moments-attach-preview');
        var list = document.getElementById('moments-img-list');
        if (!preview || !list) return;
        if (pendingImages.length === 0) {
            preview.style.display = 'none';
            return;
        }
        preview.style.display = 'block';
        list.innerHTML = '';
        pendingImages.forEach(function(img, idx) {
            var wrap = document.createElement('div');
            wrap.style.cssText = 'position:relative;width:64px;height:64px;border-radius:8px;overflow:hidden;border:1px solid var(--border-color);cursor:pointer;';
            wrap.innerHTML = '<img src="' + esc(img) + '" style="width:100%;height:100%;object-fit:cover;display:block;">' +
                '<button class="moments-del-img" data-idx="' + idx + '" style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;border:none;border-radius:50%;background:rgba(0,0,0,0.5);color:#fff;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">✕</button>';
            wrap.querySelector('.moments-del-img').addEventListener('click', function(e) {
                e.stopPropagation();
                var i = parseInt(this.dataset.idx);
                pendingImages.splice(i, 1);
                renderImagePreview();
                updateSendBtn();
            });
            wrap.addEventListener('click', function() {
                window._openMomentsImg(img);
            });
            list.appendChild(wrap);
        });
    }

    window._openMomentsImg = function(src) {
        var modal = document.getElementById('moments-preview-modal');
        var img = document.getElementById('moments-preview-img');
        if (!modal || !img) return;
        img.src = src;
        modal.style.display = 'flex';
        modal.addEventListener('click', function() {
            modal.style.display = 'none';
        }, { once: true });
    };

    window.openMomentsModal = openMomentsModal;
})();