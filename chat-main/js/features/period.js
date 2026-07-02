(function() {
  var STORAGE_KEY = 'periodRecords';
  var records = [];

  function getKey(baseKey) {
    if (typeof window.getStorageKey === 'function') {
      try { return window.getStorageKey(baseKey); } catch (e) {}
    }
    return (window.APP_PREFIX || 'CHAT_APP_V3_') + (window.SESSION_ID || 'default') + '_' + baseKey;
  }

  function loadData() {
    if (typeof localforage === 'undefined') return Promise.resolve();
    return localforage.getItem(getKey(STORAGE_KEY)).then(function(v) {
      records = Array.isArray(v) ? v : [];
    }).catch(function() { records = []; });
  }

  function saveData() {
    if (typeof localforage === 'undefined') return Promise.resolve();
    return localforage.setItem(getKey(STORAGE_KEY), records).catch(function() {});
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function renderRecords() {
    var container = document.getElementById('period-records-list');
    if (!container) return;
    records.sort(function(a, b) { return b.startDate.localeCompare(a.startDate); });
    if (records.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-secondary, #8b7d6b);font-size:14px;"><i class="fas fa- calendar" style="font-size:32px;opacity:0.3;margin-bottom:12px;display:block;"></i>暂无记录</div>';
      return;
    }
    var html = '';
    records.forEach(function(r) {
      html += '<div style="background:var(--secondary-bg,#fffbf5);border:1px solid var(--border-color,#d4c5a9);border-radius:10px;padding:12px 14px;margin-bottom:8px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<div><i class="fas fa-venus" style="color:#d44;margin-right:6px;"></i><strong>' + escHtml(r.startDate) + '</strong>';
      if (r.endDate) html += ' <span style="color:var(--text-secondary,#8b7d6b);font-size:13px;">→ ' + escHtml(r.endDate) + '</span>';
      html += '</div>';
      html += '<button class="period-del-btn" data-id="' + r.id + '" style="background:none;border:none;color:#d44;cursor:pointer;font-size:14px;padding:4px 8px;border-radius:6px;" title="删除记录"><i class="fas fa-trash-alt"></i></button>';
      html += '</div>';
      if (r.symptoms && r.symptoms.length) {
        html += '<div style="margin-top:6px;font-size:13px;color:var(--text-secondary,#8b7d6b);">';
        r.symptoms.forEach(function(s) { html += '<span style="display:inline-block;background:rgba(196,58,49,0.06);border:1px solid rgba(196,58,49,0.12);border-radius:4px;padding:1px 8px;margin:2px 4px 2px 0;font-size:12px;">' + escHtml(s) + '</span>'; });
        html += '</div>';
      }
      if (r.notes) {
        html += '<div style="margin-top:4px;font-size:13px;color:var(--text-primary,#2c2c2c);">📝 ' + escHtml(r.notes) + '</div>';
      }
      html += '</div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.period-del-btn').forEach(function(btn) {
      if (btn.dataset.periodBound) return;
      btn.dataset.periodBound = 'true';
      btn.addEventListener('click', function() {
        var id = btn.dataset.id;
        if (!confirm('确定删除这条记录吗？')) return;
        records = records.filter(function(r) { return r.id !== id; });
        saveData();
        renderRecords();
      });
    });
  }

  function openPeriodModal() {
    loadData().then(function() {
      var modal = document.getElementById('period-modal');
      if (!modal) return;
      renderRecords();
      if (typeof showModal === 'function') showModal(modal);
      else modal.style.display = 'flex';
    });
  }
  window.openPeriodModal = openPeriodModal;

  function initListeners() {
    var modal = document.getElementById('period-modal');
    if (!modal) return;

    var closeBtn = document.getElementById('period-close-btn');
    if (closeBtn && !closeBtn.dataset.periodBound) {
      closeBtn.dataset.periodBound = 'true';
      closeBtn.addEventListener('click', function() {
        if (typeof hideModal === 'function') hideModal(modal);
        else modal.style.display = 'none';
      });
    }

    var addBtn = document.getElementById('period-add-btn');
    if (addBtn && !addBtn.dataset.periodBound) {
      addBtn.dataset.periodBound = 'true';
      addBtn.addEventListener('click', function() {
        var startInput = document.getElementById('period-start');
        var endInput = document.getElementById('period-end');
        var symptomsSelect = document.getElementById('period-symptoms');
        var notesInput = document.getElementById('period-notes');
        if (!startInput || !startInput.value) { showNotification && showNotification('请选择开始日期', 'warning'); return; }
        var symptoms = [];
        if (symptomsSelect) {
          var opts = symptomsSelect.selectedOptions;
          for (var i = 0; i < opts.length; i++) { symptoms.push(opts[i].value); }
        }
        records.push({
          id: 'period_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
          startDate: startInput.value,
          endDate: endInput ? endInput.value : '',
          symptoms: symptoms,
          notes: notesInput ? notesInput.value.trim() : '',
          createdAt: Date.now()
        });
        saveData();
        renderRecords();
        startInput.value = '';
        if (endInput) endInput.value = '';
        if (notesInput) notesInput.value = '';
        if (symptomsSelect) symptomsSelect.selectedIndex = -1;
        showNotification && showNotification('记录已保存', 'success', 2000);
      });
    }

    var cancelBtn = document.getElementById('period-cancel-btn');
    if (cancelBtn && !cancelBtn.dataset.periodBound) {
      cancelBtn.dataset.periodBound = 'true';
      cancelBtn.addEventListener('click', function() {
        var startInput = document.getElementById('period-start');
        var endInput = document.getElementById('period-end');
        var notesInput = document.getElementById('period-notes');
        var symptomsSelect = document.getElementById('period-symptoms');
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        if (notesInput) notesInput.value = '';
        if (symptomsSelect) symptomsSelect.selectedIndex = -1;
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    initListeners();
    var plusBtn = document.getElementById('plus-period-btn');
    if (plusBtn && !plusBtn.dataset.periodBound) {
      plusBtn.dataset.periodBound = 'true';
      plusBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var popup = document.getElementById('plus-popup');
        if (popup) popup.classList.remove('active');
        openPeriodModal();
      });
    }
  });
})();