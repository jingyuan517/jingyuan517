(function() {
    const STORAGE_KEY = 'questionnaires';
    const MAX_QUESTIONS = 5;
    const MAX_OPTIONS = 6;
    const MIN_OPTIONS = 2;
    const ANSWER_DEADLINE_MS = 60 * 60 * 1000;
    const ANSWER_MIN_DELAY_MS = 30 * 1000;
    const ANSWER_MAX_DELAY_MS = 55 * 60 * 1000;

    let questionnaires = [];
    let activeQuestionnaire = null;
    let timerId = null;

    function getStorageKey(baseKey) {
        if (typeof window.getStorageKey === 'function') {
            try { return window.getStorageKey(baseKey); } catch (e) { }
        }
        const prefix = window.APP_PREFIX || 'CHAT_APP_V3_';
        const sessionId = window.SESSION_ID || 'default';
        return prefix + sessionId + '_' + baseKey;
    }

    function formatDate(ts) {
        return new Date(ts).toLocaleString('zh-CN', { hour12: false });
    }

    function formatRemaining(expireAt) {
        const diff = expireAt - Date.now();
        if (diff <= 0) return '已过期';
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return `${minutes} 分 ${seconds} 秒`;
    }

    function loadQuestionnaires() {
        if (typeof localforage === 'undefined') return Promise.resolve([]);
        return localforage.getItem(getStorageKey(STORAGE_KEY)).then((value) => {
            if (!Array.isArray(value)) return [];
            return value.map((item) => ({
                ...item,
                createdAt: item.createdAt || Date.now(),
                updatedAt: item.updatedAt || item.createdAt || Date.now()
            }));
        }).catch(() => []);
    }

    function saveQuestionnaires() {
        if (typeof localforage === 'undefined') return Promise.resolve();
        return localforage.setItem(getStorageKey(STORAGE_KEY), questionnaires).catch((err) => {
            console.error('[问卷] 保存失败', err);
        });
    }

    function generateId() {
        return 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function createQuestion() {
        return {
            id: generateId(),
            text: '',
            options: ['选项一', '选项二'],
            mode: 'choice'
        };
    }

    function createDraft() {
        return {
            id: generateId(),
            title: '新问卷标题',
            questions: [createQuestion()],
            state: 'draft',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expireAt: null,
            answer: null,
            answerAt: null
        };
    }

    function normalizeQuestionnaire(q) {
        const result = { ...q };
        result.questions = Array.isArray(q.questions) ? q.questions.map((item) => ({
            id: item.id || generateId(),
            text: item.text || '',
            options: Array.isArray(item.options) ? item.options.slice(0, MAX_OPTIONS) : [],
            mode: item.mode === 'card' ? 'card' : 'choice'
        })) : [createQuestion()];
        result.answerAt = q.answerAt || null;
        return result;
    }

    function getCardReplies() {
        const pool = typeof customReplies !== 'undefined' && Array.isArray(customReplies)
            ? customReplies
            : (window._customReplies || []);
        return pool.filter(r => String(r || '').trim());
    }

    function generatePartnerAnswer(q) {
        if (!q || !Array.isArray(q.questions)) return null;
        const cardPool = getCardReplies();
        const responses = q.questions.map((question) => {
            if (question.mode === 'card') {
                const chosen = cardPool.length > 0
                    ? cardPool[Math.floor(Math.random() * cardPool.length)]
                    : '（字库为空）';
                return {
                    questionId: question.id,
                    answer: chosen,
                    source: 'card'
                };
            }
            const options = Array.isArray(question.options)
                ? question.options.map((opt) => opt.trim()).filter((opt) => opt)
                : [];
            const chosen = options.length > 0
                ? options[Math.floor(Math.random() * options.length)]
                : '已回答';
            return {
                questionId: question.id,
                answer: chosen,
                source: 'choice'
            };
        });
        return {
            submittedAt: Date.now(),
            responses
        };
    }

    function updateQuestionnaireState(q) {
        if (q.state === 'sent') {
            const now = Date.now();
            if (!q.answer && q.answerAt && now >= q.answerAt) {
                if (q.expireAt && now >= q.expireAt) {
                    q.state = 'expired';
                } else {
                    q.answer = generatePartnerAnswer(q);
                    q.state = 'answered';
                    q.updatedAt = now;
                }
            } else if (!q.answer && q.expireAt && now >= q.expireAt) {
                q.state = 'expired';
            }
        }
    }

    function markQuestionnaires() {
        questionnaires.forEach(updateQuestionnaireState);
    }

    function processPendingQuestionnaires() {
        let changed = false;
        questionnaires.forEach((q) => {
            const before = q.state;
            updateQuestionnaireState(q);
            if (q.state !== before) changed = true;
        });
        if (changed) {
            saveQuestionnaires();
        }
    }

    function sortQuestionnaires(items) {
        return items.slice().sort((a, b) => b.createdAt - a.createdAt);
    }

    function renderQuestionnaireList() {
        const listEl = document.getElementById('questionnaire-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        const sorted = sortQuestionnaires(questionnaires);
        if (sorted.length === 0) {
            listEl.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;line-height:1.8;">当前暂无问卷。点击右上角“新建”开始创建。</div>';
            return;
        }

        sorted.forEach((item) => {
            const status = item.state === 'draft' ? '草稿' : item.state === 'sent' ? (item.answer ? '已回答' : (item.expireAt && Date.now() >= item.expireAt ? '已过期' : '进行中')) : item.state === 'answered' ? '已回答' : '已过期';
            const wrapper = document.createElement('div');
            wrapper.className = 'questionnaire-list-item';
            wrapper.style.cssText = 'border:1px solid var(--border-color);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;background:var(--secondary-bg);cursor:pointer;';
            wrapper.innerHTML = `
                <div style="display:flex;justify-content:space-between;gap:8px;align-items:start;">
                    <div style="min-width:0;">
                        <div style="font-size:14px;font-weight:700;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.title)}</div>
                        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${item.questions.length} 个问题 · ${formatDate(item.createdAt)}</div>
                    </div>
                    <span style="font-size:11px;padding:4px 8px;border-radius:999px;background:rgba(var(--accent-color-rgb),0.12);color:var(--accent-color);font-weight:700;white-space:nowrap;">${status}</span>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                    <div style="font-size:11px;color:var(--text-secondary);">${item.state === 'sent' && item.expireAt ? `截止：${formatDate(item.expireAt)}` : '草稿问卷'}</div>
                    <button class="modal-btn modal-btn-secondary" style="padding:4px 10px;font-size:12px;">查看</button>
                </div>`;
            wrapper.addEventListener('click', () => {
                setActiveQuestionnaire(item.id);
            });
            listEl.appendChild(wrapper);
        });
    }

    function escapeHtml(value) {
        return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function setActiveQuestionnaire(id) {
        activeQuestionnaire = questionnaires.find((item) => item.id === id) || null;
        renderQuestionnaireMain();
        const empty = document.getElementById('questionnaire-empty');
        if (empty) empty.style.display = 'none';
    }

    function findActiveIndex() {
        return questionnaires.findIndex((item) => item.id === (activeQuestionnaire && activeQuestionnaire.id));
    }

    function updateActiveQuestionnaire(updates) {
        if (!activeQuestionnaire) return;
        const idx = findActiveIndex();
        if (idx === -1) return;
        questionnaires[idx] = normalizeQuestionnaire({ ...activeQuestionnaire, ...updates, updatedAt: Date.now() });
        activeQuestionnaire = questionnaires[idx];
        saveQuestionnaires();
        renderQuestionnaireList();
    }

    function canEditQuestionnaire(q) {
        return q && q.state === 'draft';
    }

    function saveDraft() {
        if (!activeQuestionnaire) return;
        if (!activeQuestionnaire.title.trim()) {
            showNotification('请填写问卷标题', 'warning', 1800);
            return;
        }
        if (!activeQuestionnaire.questions.length) {
            showNotification('请添加至少一个问题', 'warning', 1800);
            return;
        }
        const invalidChoice = activeQuestionnaire.questions.some((q) => !q.text.trim() || (q.mode !== 'card' && q.options.filter((o) => o.trim()).length < MIN_OPTIONS));
        if (invalidChoice) {
            showNotification('每个问题需填写内容，且选择模式至少保留两个答案选项', 'warning', 1800);
            return;
        }
        if (findActiveIndex() === -1) {
            questionnaires.unshift(activeQuestionnaire);
        } else {
            questionnaires[findActiveIndex()] = activeQuestionnaire;
        }
        saveQuestionnaires().then(() => {
            renderQuestionnaireList();
            showNotification('问卷草稿已保存', 'success', 1600);
        });
    }

    function sendQuestionnaire() {
        if (!activeQuestionnaire) return;
        if (!activeQuestionnaire.title.trim()) {
            showNotification('请填写问卷标题', 'warning', 1800);
            return;
        }
        if (!activeQuestionnaire.questions.length) {
            showNotification('请添加至少一个问题', 'warning', 1800);
            return;
        }
        const invalidSend = activeQuestionnaire.questions.some((q) => !q.text.trim() || (q.mode !== 'card' && q.options.filter((o) => o.trim()).length < MIN_OPTIONS));
        if (invalidSend) {
            showNotification('每个问题需填写内容，且选择模式至少保留两个答案选项', 'warning', 1800);
            return;
        }
        const now = Date.now();
        activeQuestionnaire = normalizeQuestionnaire({ ...activeQuestionnaire,
            state: 'sent',
            answer: null,
            answerAt: now + Math.floor(Math.random() * (ANSWER_MAX_DELAY_MS - ANSWER_MIN_DELAY_MS + 1)) + ANSWER_MIN_DELAY_MS,
            createdAt: activeQuestionnaire.createdAt || now,
            updatedAt: now,
            expireAt: now + ANSWER_DEADLINE_MS
        });
        const idx = findActiveIndex();
        if (idx === -1) questionnaires.unshift(activeQuestionnaire);
        else questionnaires[idx] = activeQuestionnaire;
        saveQuestionnaires().then(() => {
            renderQuestionnaireList();
            renderQuestionnaireMain();
            showNotification('问卷已发送，给予一小时填写时间', 'success', 2200);
        });
    }

    function submitAnswers() {
        if (!activeQuestionnaire) return;
        updateQuestionnaireFromEditor();
        if (activeQuestionnaire.state !== 'sent') return;
        updateQuestionnaireState(activeQuestionnaire);
        if (activeQuestionnaire.state === 'expired') {
            renderQuestionnaireMain();
            showNotification('问卷已过期，无法提交', 'warning', 2000);
            return;
        }
        const answers = [];
        const container = document.getElementById('questionnaire-answer-panel');
        if (!container) return;
        const invalid = activeQuestionnaire.questions.some((question) => {
            const input = container.querySelector(`[name="question-answer-${question.id}"]`);
            if (!input) return true;
            if (input.type === 'radio') {
                return !container.querySelector(`[name="question-answer-${question.id}"]:checked`);
            }
            return !input.value.trim();
        });
        if (invalid) {
            showNotification('请完成所有问题后提交', 'warning', 1800);
            return;
        }

        activeQuestionnaire.questions.forEach((question) => {
            const input = container.querySelector(`[name="question-answer-${question.id}"]`);
            const value = input.type === 'radio'
                ? (container.querySelector(`[name="question-answer-${question.id}"]:checked`) || {}).value || ''
                : input.value.trim();
            answers.push({ questionId: question.id, answer: value });
        });
        activeQuestionnaire = {
            ...activeQuestionnaire,
            state: 'answered',
            answer: {
                submittedAt: Date.now(),
                responses: answers
            },
            updatedAt: Date.now()
        };
        const idx = findActiveIndex();
        if (idx === -1) questionnaires.unshift(activeQuestionnaire);
        else questionnaires[idx] = activeQuestionnaire;
        saveQuestionnaires().then(() => {
            renderQuestionnaireList();
            renderQuestionnaireMain();
            showNotification('问卷已提交，无法再次作答', 'success', 2200);
        });
    }

    function updateQuestionnaireFromEditor() {
        if (!activeQuestionnaire) return;
        const titleInput = document.getElementById('questionnaire-title-input');
        if (titleInput) activeQuestionnaire.title = titleInput.value.trim() || '未命名问卷';
        activeQuestionnaire.questions = Array.from(document.querySelectorAll('.questionnaire-question-block')).map((block) => {
            const questionText = block.querySelector('.questionnaire-question-text');
            const optionsText = block.querySelector('.questionnaire-question-options');
            const id = block.dataset.questionId;
            const rawOptions = (optionsText ? optionsText.value.split('\n') : []).map((o) => o.trim()).filter((o) => o);
            const modeBtn = block.querySelector('.questionnaire-mode-btn[data-mode="card"]');
            const mode = modeBtn && modeBtn.style.background && modeBtn.style.background.includes('var(--accent-color)') ? 'card' : 'choice';
            return {
                id: id || generateId(),
                text: questionText ? questionText.value.trim() : '',
                options: rawOptions.length ? rawOptions.slice(0, MAX_OPTIONS) : ['是', '否'],
                mode: mode
            };
        }).slice(0, MAX_QUESTIONS);
        activeQuestionnaire.updatedAt = Date.now();
    }

    function renderQuestionnaireMain() {
        const editor = document.getElementById('questionnaire-editor');
        const empty = document.getElementById('questionnaire-empty');
        if (!editor) return;
        if (!activeQuestionnaire) {
            editor.innerHTML = '';
            if (empty) empty.style.display = 'flex';
            return;
        }
        if (empty) empty.style.display = 'none';
        updateQuestionnaireState(activeQuestionnaire);

        if (canEditQuestionnaire(activeQuestionnaire)) {
            renderEditorView();
        } else if (activeQuestionnaire.state === 'sent') {
            renderPendingAnswerView();
        } else {
            renderReadOnlyView();
        }
    }

    function renderEditorView() {
        if (!activeQuestionnaire) return;
        const editor = document.getElementById('questionnaire-editor');
        if (!editor) return;
        editor.style.display = 'flex';
        editor.style.flexDirection = 'column';
        editor.style.gap = '14px';
        editor.style.overflow = 'auto';
        editor.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                <div style="flex:1;min-width:180px;">
                    <div style="font-size:15px;font-weight:700;">编辑问卷</div>
                    <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">最多 ${MAX_QUESTIONS} 个问题，发送后一小时内可回答</div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button id="questionnaire-save-btn" class="modal-btn modal-btn-secondary" style="padding:7px 14px;font-size:12px;">保存草稿</button>
                    <button id="questionnaire-send-btn" class="modal-btn modal-btn-primary" style="padding:7px 14px;font-size:12px;">发送问卷</button>
                </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">
                <label style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--text-secondary);">
                    问卷标题
                    <input id="questionnaire-title-input" type="text" class="modal-input" value="${escapeHtml(activeQuestionnaire.title)}" placeholder="填写问卷标题，例如：节日小调查">
                </label>
            </div>
            <div id="questionnaire-questions-container" style="display:flex;flex-direction:column;gap:14px;min-height:220px;"></div>
            <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
                <button id="questionnaire-add-question" class="modal-btn modal-btn-primary" style="padding:7px 14px;font-size:12px;">添加问题</button>
                <span style="font-size:12px;color:var(--text-secondary);line-height:1.6;">已创建 ${activeQuestionnaire.questions.length} / ${MAX_QUESTIONS} 个问题</span>
            </div>
        `;
        const questionsContainer = document.getElementById('questionnaire-questions-container');
        activeQuestionnaire.questions.forEach((question, index) => {
            const isCard = question.mode === 'card';
            const block = document.createElement('div');
            block.className = 'questionnaire-question-block';
            block.dataset.questionId = question.id;
            block.style.cssText = 'border:1px solid var(--border-color);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px;background:var(--primary-bg);';
            block.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                    <div style="font-size:13px;font-weight:700;color:var(--text-primary);">问题 ${index + 1}</div>
                    <button class="modal-btn modal-btn-secondary questionnaire-remove-question" style="padding:4px 10px;font-size:12px;${activeQuestionnaire.questions.length <= 1 ? 'display:none;' : ''}">删除</button>
                </div>
                <div style="display:flex;gap:8px;align-items:center;font-size:12px;">
                    <span style="color:var(--text-secondary);">回答方式：</span>
                    <button class="questionnaire-mode-btn" data-mode="choice" style="padding:4px 12px;border-radius:999px;border:1px solid var(--border-color);background:${isCard ? 'var(--primary-bg)' : 'var(--accent-color)'};color:${isCard ? 'var(--text-secondary)' : '#fff'};cursor:pointer;font-size:12px;transition:all 0.2s;">选择模式</button>
                    <button class="questionnaire-mode-btn" data-mode="card" style="padding:4px 12px;border-radius:999px;border:1px solid var(--border-color);background:${isCard ? 'var(--accent-color)' : 'var(--primary-bg)'};color:${isCard ? '#fff' : 'var(--text-secondary)'};cursor:pointer;font-size:12px;transition:all 0.2s;">字卡模式</button>
                </div>
                <label style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--text-secondary);">
                    问题内容
                    <textarea class="modal-textarea questionnaire-question-text" rows="2" placeholder="输入问题内容">${escapeHtml(question.text)}</textarea>
                </label>
                <label id="options-label-${escapeHtml(question.id)}" class="questionnaire-options-label" style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--text-secondary);${isCard ? 'display:none;' : ''}">
                    选项（每行一个，至少 ${MIN_OPTIONS} 个）
                    <textarea class="modal-textarea questionnaire-question-options" rows="4" placeholder="每行一个答案选项">${escapeHtml(question.options.join('\n'))}</textarea>
                </label>
                <div id="card-hint-${escapeHtml(question.id)}" class="questionnaire-card-hint" style="font-size:12px;color:var(--text-secondary);padding:10px 12px;border-radius:10px;border:1px dashed var(--border-color);background:rgba(var(--accent-color-rgb),0.05);${isCard ? '' : 'display:none;'}">
                    <i class="fas fa-comment-dots" style="margin-right:4px;"></i>对方将从你的字卡回复库中随机选择一条作为回答。
                </div>
            `;
            questionsContainer.appendChild(block);
        });

        questionsContainer.querySelectorAll('.questionnaire-mode-btn').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                const mode = event.target.dataset.mode;
                const block = event.target.closest('.questionnaire-question-block');
                if (!block) return;
                const qId = block.dataset.questionId;
                const question = activeQuestionnaire.questions.find((q) => q.id === qId);
                if (!question) return;
                question.mode = mode;
                const parent = event.target.parentElement;
                parent.querySelectorAll('.questionnaire-mode-btn').forEach((b) => {
                    const isActive = b.dataset.mode === mode;
                    b.style.background = isActive ? 'var(--accent-color)' : 'var(--primary-bg)';
                    b.style.color = isActive ? '#fff' : 'var(--text-secondary)';
                });
                const optLabel = block.querySelector('.questionnaire-options-label');
                const hint = block.querySelector('.questionnaire-card-hint');
                if (optLabel) optLabel.style.display = mode === 'card' ? 'none' : 'flex';
                if (hint) hint.style.display = mode === 'card' ? 'block' : 'none';
            });
        });

        document.getElementById('questionnaire-save-btn').addEventListener('click', () => {
            updateQuestionnaireFromEditor();
            saveDraft();
        });
        document.getElementById('questionnaire-send-btn').addEventListener('click', () => {
            updateQuestionnaireFromEditor();
            sendQuestionnaire();
        });
        document.getElementById('questionnaire-add-question').addEventListener('click', () => {
            if (activeQuestionnaire.questions.length >= MAX_QUESTIONS) {
                showNotification(`最多只能创建 ${MAX_QUESTIONS} 个问题`, 'warning', 1800);
                return;
            }
            activeQuestionnaire.questions.push(createQuestion());
            renderEditorView();
        });

        questionsContainer.querySelectorAll('.questionnaire-remove-question').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                const block = event.target.closest('.questionnaire-question-block');
                if (!block) return;
                const id = block.dataset.questionId;
                activeQuestionnaire.questions = activeQuestionnaire.questions.filter((q) => q.id !== id);
                renderEditorView();
            });
        });
    }

    function renderPendingAnswerView() {
        if (!activeQuestionnaire) return;
        const editor = document.getElementById('questionnaire-editor');
        if (!editor) return;
        editor.style.display = 'flex';
        editor.style.flexDirection = 'column';
        editor.style.gap = '16px';
        editor.style.overflow = 'auto';

        const now = Date.now();
        const answerDue = activeQuestionnaire.answerAt && now < activeQuestionnaire.answerAt;
        const expired = activeQuestionnaire.expireAt && now >= activeQuestionnaire.expireAt;
        editor.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                <div>
                    <div style="font-size:15px;font-weight:700;">问卷：${escapeHtml(activeQuestionnaire.title)}</div>
                    <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${activeQuestionnaire.questions.length} 个问题 · 发送于 ${formatDate(activeQuestionnaire.createdAt)}</div>
                </div>
                <span style="font-size:12px;padding:5px 10px;border-radius:999px;background:rgba(var(--accent-color-rgb),0.12);color:var(--accent-color);font-weight:700;">${expired ? '已过期' : '等待对方回答'}</span>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);padding:10px 12px;border-radius:14px;border:1px solid var(--border-color);background:var(--secondary-bg);">
                <div>预计回答：${activeQuestionnaire.answerAt ? formatDate(activeQuestionnaire.answerAt) : '正在生成中'}</div>
                <div style="margin-top:6px;">剩余：<span id="questionnaire-countdown">${activeQuestionnaire.answerAt ? formatRemaining(activeQuestionnaire.answerAt) : '—'}</span></div>
            </div>
            <div id="questionnaire-answer-panel" style="display:flex;flex-direction:column;gap:16px;"></div>
        `;

        const form = document.getElementById('questionnaire-answer-panel');
        activeQuestionnaire.questions.forEach((question, index) => {
            const block = document.createElement('div');
            block.style.cssText = 'border:1px solid var(--border-color);border-radius:14px;padding:12px;background:var(--primary-bg);display:flex;flex-direction:column;gap:10px;';
            block.innerHTML = `
                <div style="font-size:13px;font-weight:700;color:var(--text-primary);">${index + 1}. ${escapeHtml(question.text)}</div>
                <div style="font-size:12px;color:var(--text-secondary);">对方正在选择一个答案，请稍候查看结果。</div>
            `;
            form.appendChild(block);
        });

        updateCountdown();
    }

    function renderReadOnlyView() {
        if (!activeQuestionnaire) return;
        const editor = document.getElementById('questionnaire-editor');
        if (!editor) return;
        editor.style.display = 'flex';
        editor.style.flexDirection = 'column';
        editor.style.gap = '14px';
        editor.style.overflow = 'auto';

        const answerTime = activeQuestionnaire.answer?.submittedAt ? `提交于 ${formatDate(activeQuestionnaire.answer.submittedAt)}` : '';
        const statusLabel = activeQuestionnaire.state === 'answered' ? '已回答' : '已过期';
        editor.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                <div>
                    <div style="font-size:15px;font-weight:700;">问卷：${escapeHtml(activeQuestionnaire.title)}</div>
                    <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${activeQuestionnaire.questions.length} 个问题 · ${answerTime}</div>
                </div>
                <span style="font-size:12px;padding:5px 10px;border-radius:999px;background:rgba(var(--accent-color-rgb),0.12);color:var(--accent-color);font-weight:700;">${statusLabel}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;">
            </div>
        `;

        const container = editor.querySelector('div:nth-child(2)');
        activeQuestionnaire.questions.forEach((question, index) => {
            const response = activeQuestionnaire.answer?.responses.find((r) => r.questionId === question.id);
            const value = response ? response.answer : '未作答';
            const isCard = question.mode === 'card';
            const block = document.createElement('div');
            block.style.cssText = 'border:1px solid var(--border-color);border-radius:14px;padding:12px;background:var(--primary-bg);';
            block.innerHTML = `
                <div style="font-size:13px;font-weight:700;color:var(--text-primary);">${index + 1}. ${escapeHtml(question.text)}</div>
                <div style="margin-top:8px;font-size:12px;color:var(--text-secondary);">${isCard ? '回答来源：字卡回复' : (question.options && question.options.length ? `选项：${escapeHtml(question.options.join('，'))}` : '文本回答')}</div>
                <div style="margin-top:10px;font-size:13px;color:var(--text-primary);">回答：${escapeHtml(value)}</div>
            `;
            container.appendChild(block);
        });
    }

    function updateCountdown() {
        const countdown = document.getElementById('questionnaire-countdown');
        if (!countdown || !activeQuestionnaire || !activeQuestionnaire.expireAt) return;
        const now = Date.now();
        const remaining = activeQuestionnaire.expireAt - now;
        if (remaining <= 0) {
            countdown.textContent = '已过期';
            activeQuestionnaire.state = 'expired';
            renderQuestionnaireMain();
            return;
        }
        countdown.textContent = formatRemaining(activeQuestionnaire.expireAt);
    }

    function renderQuestionnaireModal() {
        let modal = document.getElementById('questionnaire-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'questionnaire-modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:980px;max-height:92vh;padding:20px;overflow:hidden;display:flex;flex-direction:column;">
                <div class="modal-title">
                    <i class="fas fa-clipboard-list"></i><span>问卷</span>
                </div>
                <div style="display:flex;flex:1;gap:16px;overflow:hidden;flex-wrap:wrap;">
                    <div style="flex:0 0 320px;min-width:280px;max-height:calc(92vh - 160px);display:flex;flex-direction:column;border:1px solid var(--border-color);border-radius:18px;background:var(--secondary-bg);overflow:hidden;">
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border-color);">
                            <div style="font-size:14px;font-weight:700;">问卷列表</div>
                            <button id="questionnaire-new-btn" class="modal-btn modal-btn-primary" style="padding:6px 12px;font-size:12px;">新建</button>
                        </div>
                        <div id="questionnaire-list" style="flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px;"></div>
                    </div>
                    <div id="questionnaire-main" style="flex:1;min-width:320px;display:flex;flex-direction:column;overflow:hidden;">
                        <div id="questionnaire-empty" style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:14px;padding:10px;">请选择一个问卷查看，或点击“新建”开始。</div>
                        <div id="questionnaire-editor" style="flex:1;display:none;overflow:auto;padding-right:4px;"></div>
                    </div>
                </div>
                <div class="modal-buttons" style="position:sticky;bottom:0;background:var(--secondary-bg);border-top:1px solid var(--border-color);padding-top:12px;margin-top:12px;">
                    <button class="modal-btn modal-btn-secondary" id="questionnaire-close">关闭</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.querySelector('#questionnaire-close').addEventListener('click', () => {
            if (typeof hideModal === 'function') hideModal(modal);
            clearTimer();
        });
        modal.querySelector('#questionnaire-new-btn').addEventListener('click', () => {
            activeQuestionnaire = createDraft();
            renderQuestionnaireList();
            renderQuestionnaireMain();
        });
        return modal;
    }

    function openQuestionnaireModal() {
        loadQuestionnaires().then((items) => {
            questionnaires = items.map(normalizeQuestionnaire);
            markQuestionnaires();
            const modal = renderQuestionnaireModal();
            renderQuestionnaireList();
            if (!activeQuestionnaire && questionnaires.length) {
                activeQuestionnaire = questionnaires[0];
            }
            renderQuestionnaireMain();
            if (typeof showModal === 'function') showModal(modal);
            processPendingQuestionnaires();
            startTimer();
        });
    }

    function startTimer() {
        clearTimer();
        timerId = setInterval(() => {
            processPendingQuestionnaires();
            if (!activeQuestionnaire || activeQuestionnaire.state !== 'sent') return;
            updateCountdown();
        }, 1000);
    }

    function clearTimer() {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    function installEntryButton() {
        const list = document.querySelector('#advanced-modal .settings-item-list');
        if (!list) return;
        if (document.getElementById('questionnaire-function')) return;
        const item = document.createElement('div');
        item.className = 'settings-item';
        item.id = 'questionnaire-function';
        item.style.cursor = 'pointer';
        item.innerHTML = '<i class="fas fa-clipboard-list"></i><span>问卷</span>';
        const placeholder = document.getElementById('coming-soon-placeholder');
        if (placeholder) list.insertBefore(item, placeholder);
        else list.appendChild(item);
        item.addEventListener('click', () => {
            const advModal = document.getElementById('advanced-modal');
            if (advModal && typeof hideModal === 'function') hideModal(advModal);
            setTimeout(openQuestionnaireModal, 120);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        installEntryButton();
    });
})();
