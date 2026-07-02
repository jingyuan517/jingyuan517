(function() {
    const STORAGE_KEY = 'timelineRecords';
    const ACTIVITIES_KEY = 'timelineActivities';

    const DEFAULT_ACTIVITIES = [
        { id: 'act_learn', emoji: '📚', label: '学习中' },
        { id: 'act_work', emoji: '💼', label: '工作中' },
        { id: 'act_exercise', emoji: '🏋️', label: '运动中' },
        { id: 'act_rest', emoji: '😴', label: '休息中' },
        { id: 'act_eat', emoji: '🍽️', label: '吃饭中' },
        { id: 'act_play', emoji: '🎮', label: '娱乐中' },
        { id: 'act_slack', emoji: '☕', label: '摸鱼中' },
        { id: 'act_sleep', emoji: '🌙', label: '睡觉中' },
        { id: 'act_read', emoji: '📖', label: '阅读中' },
        { id: 'act_think', emoji: '💭', label: '想你中' },
    ];

    let records = [];
    let activities = [];
    let currentPersonFilter = 'all';
    let currentDateRange = 'today';

    function getKey(baseKey) {
        if (typeof window.getStorageKey === 'function') {
            try { return window.getStorageKey(baseKey); } catch (e) {}
        }
        return (window.APP_PREFIX || 'CHAT_APP_V3_') + (window.SESSION_ID || 'default') + '_' + baseKey;
    }

    function loadData() {
        if (typeof localforage === 'undefined') return Promise.resolve();
        return Promise.all([
            localforage.getItem(getKey(STORAGE_KEY)).then(v => { records = Array.isArray(v) ? v : []; }),
            localforage.getItem(getKey(ACTIVITIES_KEY)).then(v => {
                activities = Array.isArray(v) && v.length > 0 ? v : JSON.parse(JSON.stringify(DEFAULT_ACTIVITIES));
            })
        ]).catch(() => {
            records = [];
            activities = JSON.parse(JSON.stringify(DEFAULT_ACTIVITIES));
        });
    }

    function saveData() {
        if (typeof localforage === 'undefined') return Promise.resolve();
        return Promise.all([
            localforage.setItem(getKey(STORAGE_KEY), records),
            localforage.setItem(getKey(ACTIVITIES_KEY), activities)
        ]).catch(() => {});
    }

    function generateId() {
        return 'tl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function formatTime(ts) {
        const d = new Date(ts);
        const pad = n => String(n).padStart(2, '0');
        return pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function formatDate(ts) {
        const d = new Date(ts);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diff = Math.round((today - target) / 86400000);
        if (diff === 0) return '今天';
        if (diff === 1) return '昨天';
        if (diff === 2) return '前天';
        const pad = n => String(n).padStart(2, '0');
        return (d.getMonth() + 1) + '月' + d.getDate() + '日';
    }

    function getWeekRange() {
        const now = new Date();
        const day = now.getDay() || 7;
        const start = new Date(now);
        start.setDate(now.getDate() - day + 1);
        start.setHours(0, 0, 0, 0);
        return start.getTime();
    }

    function getMonthRange() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return start.getTime();
    }

    function getDayRange() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return start.getTime();
    }

    function getFilteredRecords() {
        let filtered = [...records];
        if (currentPersonFilter !== 'all') {
            filtered = filtered.filter(r => r.person === currentPersonFilter);
        }
        const now = Date.now();
        let rangeStart = 0;
        if (currentDateRange === 'today') rangeStart = getDayRange();
        else if (currentDateRange === 'week') rangeStart = getWeekRange();
        else if (currentDateRange === 'month') rangeStart = getMonthRange();
        else rangeStart = 0;
        if (rangeStart > 0) {
            filtered = filtered.filter(r => r.timestamp >= rangeStart);
        }
        return filtered.sort((a, b) => b.timestamp - a.timestamp);
    }

    function getActivityById(id) {
        return activities.find(a => a.id === id);
    }

    function addRecord(person, activityId, note) {
        records.unshift({
            id: generateId(),
            person: person,
            activityId: activityId,
            timestamp: Date.now(),
            note: note || ''
        });
        saveData();
        renderTimeline();
    }

    function deleteRecord(id) {
        records = records.filter(r => r.id !== id);
        saveData();
        renderTimeline();
    }

    function renderTimeline() {
        const container = document.getElementById('tl-entries');
        const empty = document.getElementById('tl-empty');
        const countEl = document.getElementById('tl-count');
        if (!container) return;

        const filtered = getFilteredRecords();
        countEl.textContent = '共 ' + filtered.length + ' 条记录';

        if (filtered.length === 0) {
            container.style.display = 'none';
            empty.style.display = 'flex';
            return;
        }

        container.style.display = 'block';
        empty.style.display = 'none';
        container.innerHTML = '';

        const myName = (typeof settings !== 'undefined') ? (settings.myName || '我') : '我';
        const partnerName = (typeof settings !== 'undefined') ? (settings.partnerName || '梦角') : '梦角';

        let lastDate = '';
        filtered.forEach((r) => {
            const dateLabel = formatDate(r.timestamp);
            const act = getActivityById(r.activityId);
            const emoji = act ? act.emoji : '📌';
            const label = act ? act.label : '未知';
            const personLabel = r.person === 'me' ? myName : partnerName;
            const personClass = r.person === 'me' ? 'tl-me' : 'tl-partner';

            if (dateLabel !== lastDate) {
                lastDate = dateLabel;
                const dateDiv = document.createElement('div');
                dateDiv.className = 'tl-date-header';
                dateDiv.textContent = dateLabel;
                container.appendChild(dateDiv);
            }

            const entry = document.createElement('div');
            entry.className = 'tl-entry ' + personClass;
            entry.innerHTML = `
                <div class="tl-line"></div>
                <div class="tl-dot ${personClass}"></div>
                <div class="tl-card">
                    <div class="tl-card-header">
                        <span class="tl-person">${r.person === 'me' ? '👤' : '💕'} ${escHtml(personLabel)}</span>
                        <span class="tl-time">${formatTime(r.timestamp)}</span>
                        <button class="tl-del-btn" data-id="${r.id}" title="删除">&times;</button>
                    </div>
                    <div class="tl-card-body">
                        <span class="tl-emoji">${emoji}</span>
                        <span class="tl-activity">${escHtml(label)}</span>
                    </div>
                    ${r.note ? '<div class="tl-note">' + escHtml(r.note) + '</div>' : ''}
                </div>
            `;
            container.appendChild(entry);
        });

        container.querySelectorAll('.tl-del-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm('确定删除这条记录吗？')) {
                    deleteRecord(id);
                }
            });
        });
    }

    function renderQuickActions() {
        const container = document.getElementById('tl-quick-actions');
        if (!container) return;
        container.innerHTML = '';

        activities.forEach((act) => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:relative;display:inline-flex;flex-direction:column;align-items:center;gap:2px;';

            const btn = document.createElement('button');
            btn.className = 'tl-quick-btn';
            btn.innerHTML = `<span class="tl-q-emoji">${act.emoji}</span><span class="tl-q-label">${escHtml(act.label)}</span>`;
            btn.title = '为自己打卡: ' + act.label;
            btn.onclick = () => addRecord('me', act.id);

            const partnerBtn = document.createElement('button');
            partnerBtn.className = 'tl-quick-partner';
            partnerBtn.innerHTML = '💕';
            partnerBtn.title = '为梦角打卡: ' + act.label;
            partnerBtn.onclick = (e) => {
                e.stopPropagation();
                addRecord('partner', act.id);
            };

            wrapper.appendChild(btn);
            wrapper.appendChild(partnerBtn);
            container.appendChild(wrapper);
        });
    }

    function renderActivitiesManager() {
        const old = document.getElementById('tl-act-mgr');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'tl-act-mgr';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);';
        overlay.innerHTML = `
            <div style="background:var(--primary-bg);border-radius:20px;padding:20px;width:min(380px,92vw);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.28);border:1px solid var(--border-color);">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                    <span style="font-size:15px;font-weight:700;color:var(--text-primary);"><i class="fas fa-cog"></i> 管理活动</span>
                    <button id="tlam-close" style="background:none;border:none;font-size:18px;color:var(--text-secondary);cursor:pointer;padding:2px 6px;border-radius:6px;">✕</button>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">可自定义打卡活动，点击删除</div>
                <div id="tlam-list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:12px;"></div>
                <div style="display:flex;gap:8px;">
                    <input id="tlam-new-emoji" type="text" maxlength="2" placeholder="emoji" style="width:48px;text-align:center;padding:7px 4px;border:1px solid var(--border-color);border-radius:8px;font-size:14px;background:var(--secondary-bg);color:var(--text-primary);outline:none;font-family:var(--font-family);">
                    <input id="tlam-new-label" type="text" placeholder="活动名称" maxlength="10" style="flex:1;padding:7px 10px;border:1px solid var(--border-color);border-radius:8px;font-size:12px;background:var(--secondary-bg);color:var(--text-primary);outline:none;font-family:var(--font-family);">
                    <button id="tlam-add-btn" class="modal-btn modal-btn-primary" style="padding:7px 12px;font-size:12px;">添加</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        function renderList() {
            const list = document.getElementById('tlam-list');
            if (!list) return;
            list.innerHTML = '';
            activities.forEach((act, idx) => {
                const item = document.createElement('div');
                item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--secondary-bg);border-radius:10px;border:1px solid var(--border-color);';
                item.innerHTML = `
                    <span style="font-size:20px;">${act.emoji}</span>
                    <span style="flex:1;font-size:13px;color:var(--text-primary);">${escHtml(act.label)}</span>
                    <button class="tlam-del-btn" data-idx="${idx}" style="background:none;border:none;color:#ff5050;cursor:pointer;font-size:14px;padding:4px 6px;border-radius:6px;transition:all 0.2s;">✕</button>
                `;
                item.querySelector('.tlam-del-btn').addEventListener('click', () => {
                    if (activities.length <= 1) {
                        if (typeof showNotification === 'function') showNotification('至少保留一个活动', 'warning', 1800);
                        return;
                    }
                    activities.splice(idx, 1);
                    saveData();
                    renderList();
                    renderQuickActions();
                });
                list.appendChild(item);
            });
        }

        renderList();

        document.getElementById('tlam-add-btn').addEventListener('click', () => {
            const emoji = document.getElementById('tlam-new-emoji').value.trim() || '📌';
            const label = document.getElementById('tlam-new-label').value.trim();
            if (!label) {
                if (typeof showNotification === 'function') showNotification('请输入活动名称', 'warning', 1800);
                return;
            }
            const id = 'act_' + Date.now();
            activities.push({ id, emoji, label });
            saveData();
            renderList();
            renderQuickActions();
            document.getElementById('tlam-new-emoji').value = '';
            document.getElementById('tlam-new-label').value = '';
            if (typeof showNotification === 'function') showNotification('已添加: ' + emoji + ' ' + label, 'success', 1500);
        });

        overlay.querySelector('#tlam-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    function escHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function initTimelineListeners() {
        const modal = document.getElementById('timeline-modal');
        if (!modal) return;

        const closeBtn = document.getElementById('close-timeline');
        if (closeBtn && !closeBtn.dataset.tlBound) {
            closeBtn.dataset.tlBound = 'true';
            closeBtn.addEventListener('click', () => {
                if (typeof hideModal === 'function') hideModal(modal);
                else modal.style.display = 'none';
            });
        }

        document.querySelectorAll('.tl-filter-btn').forEach(btn => {
            if (btn.dataset.tlBound) return;
            btn.dataset.tlBound = 'true';
            btn.addEventListener('click', function() {
                document.querySelectorAll('.tl-filter-btn').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                });
                this.style.background = 'var(--accent-color)';
                this.style.color = '#fff';
                currentPersonFilter = this.dataset.person;
                renderTimeline();
            });
        });

        document.querySelectorAll('.tl-date-btn').forEach(btn => {
            if (btn.dataset.tlBound) return;
            btn.dataset.tlBound = 'true';
            btn.addEventListener('click', function() {
                document.querySelectorAll('.tl-date-btn').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                });
                this.style.background = 'var(--accent-color)';
                this.style.color = '#fff';
                currentDateRange = this.dataset.range;
                renderTimeline();
            });
        });

        const manageBtn = document.getElementById('tl-manage-activities-btn');
        if (manageBtn && !manageBtn.dataset.tlBound) {
            manageBtn.dataset.tlBound = 'true';
            manageBtn.addEventListener('click', renderActivitiesManager);
        }
    }

    function openTimelineModal() {
        loadData().then(() => {
            const modal = document.getElementById('timeline-modal');
            if (!modal) return;
            renderQuickActions();
            renderTimeline();
            initTimelineListeners();
            if (typeof showModal === 'function') showModal(modal);
            else modal.style.display = 'flex';
        });
    }

    function installEntryButton() {
        const list = document.querySelector('#advanced-modal .settings-item-list');
        if (!list) return;
        const existing = document.getElementById('timeline-function');
        if (!existing) return;

        if (existing.dataset.tlBound) return;
        existing.dataset.tlBound = 'true';

        existing.addEventListener('click', () => {
            const advModal = document.getElementById('advanced-modal');
            if (advModal && typeof hideModal === 'function') hideModal(advModal);
            setTimeout(openTimelineModal, 120);
        });
    }

    var _partnerTimelineTimer = null;
    var PARTNER_TL_COOLDOWN_MIN = 2 * 60 * 60 * 1000;
    var PARTNER_TL_COOLDOWN_MAX = 6 * 60 * 60 * 1000;
    var PARTNER_TL_PROB = 0.4;

    function _scheduleNextPartnerCheck() {
        if (_partnerTimelineTimer) clearTimeout(_partnerTimelineTimer);
        var delay = PARTNER_TL_COOLDOWN_MIN + Math.random() * (PARTNER_TL_COOLDOWN_MAX - PARTNER_TL_COOLDOWN_MIN);
        _partnerTimelineTimer = setTimeout(function() {
            _partnerTimelineTimer = null;
            if (Math.random() < PARTNER_TL_PROB) {
                _triggerPartnerTimelineRecord();
            }
            _scheduleNextPartnerCheck();
        }, delay);
    }

    function _triggerPartnerTimelineRecord() {
        if (!activities || activities.length === 0) {
            activities = JSON.parse(JSON.stringify(DEFAULT_ACTIVITIES));
        }
        var act = activities[Math.floor(Math.random() * activities.length)];
        if (!act) return;
        var notes = ['偷偷记录一下', '今天也要加油', '梦角的小日常', '想你了', '开心的一天', '有点累但坚持', '晚安', '早安', '今天天气真好', '心情不错~'];
        var note = notes[Math.floor(Math.random() * notes.length)];
        records.unshift({
            id: 'tl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            person: 'partner',
            activityId: act.id,
            timestamp: Date.now(),
            note: note
        });
        saveData();
        renderTimeline();
        if (typeof showNotification === 'function') {
            var pn = (typeof settings !== 'undefined' && settings.partnerName) || '梦角';
            showNotification('💕 ' + pn + ' 打卡了: ' + act.emoji + ' ' + act.label, 'info', 2500);
        }
    }

    window._triggerPartnerTimelineRecord = _triggerPartnerTimelineRecord;

    document.addEventListener('DOMContentLoaded', () => {
        installEntryButton();
        setTimeout(_scheduleNextPartnerCheck, 3000);
    });
})();
