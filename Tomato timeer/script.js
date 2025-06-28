class PomodoroTimer {
    constructor() {
        this.currentTime = 0;
        this.totalTime = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.currentSession = 'focus'; // 'focus', 'break', 'long-break'
        this.sessionCount = 0;
        this.completedPomodoros = 0;
        this.timer = null;
        
        // 計時模式設定
        this.modes = {
            '25-5': { focus: 25, break: 5 },
            '50-10': { focus: 50, break: 10 }
        };
        
        this.currentMode = '25-5';
        this.longBreakTime = 30;
        
        // 圖表相關屬性
        this.chartsInitialized = false;
        this.currentFilteredRecords = null;
        this.currentPeriod = '7';        // DOM 元素
        this.initializeElements();
        this.initializeEventListeners();
        
        this.loadData();
        this.updateDisplay();
        this.updateStats();
        
        // 清理無效數據
        this.cleanInvalidData();
        
        // 初始化歷史記錄和圖表
        this.filterHistory('7'); // 預設顯示最近7天的數據
        this.initializeCharts();
    }    initializeElements() {
        this.timeDisplay = document.getElementById('time-display');
        this.sessionType = document.getElementById('session-type');
        this.sessionCountElement = document.getElementById('session-count');
        this.progressFill = document.getElementById('progress-fill');
        this.startBtn = document.getElementById('start-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.currentTask = document.getElementById('current-task');
        this.longBreakInput = document.getElementById('long-break-time');
        this.todayFocusTime = document.getElementById('today-focus-time');
        this.todayTomatoes = document.getElementById('today-tomatoes');
        this.taskList = document.getElementById('task-list');
        this.historyModal = document.getElementById('history-modal');
        this.historyContent = document.getElementById('history-content');
        this.notificationSound = document.getElementById('notification-sound');
        this.quickTaskButtons = document.getElementById('quick-task-buttons');
    }

    initializeEventListeners() {
        // 控制按鈕
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());

        // 模式選擇
        document.querySelectorAll('input[name="timer-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentMode = e.target.value;
                this.reset();
            });
        });        // 長休息時間設定
        this.longBreakInput.addEventListener('change', (e) => {
            this.longBreakTime = parseInt(e.target.value);
        });

        // 歷史記錄按鈕
        document.getElementById('view-history-btn').addEventListener('click', () => {
            this.showHistory();
        });
        document.getElementById('export-data-btn').addEventListener('click', () => {
            this.exportData();
        });

        // 匯入數據按鈕
        document.getElementById('import-data-btn').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });
        
        // 檔案選擇事件
        document.getElementById('import-file-input').addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });

        // 更新常用任務按鈕
        document.getElementById('refresh-tasks-btn').addEventListener('click', () => {
            this.updateQuickTasks();
        });

        // 音量控制滑塊
        const volumeControl = document.getElementById('volume-control');
        const volumeDisplay = document.getElementById('volume-display');
        
        if (volumeControl && volumeDisplay) {
            // 初始化音量顯示
            const savedVolume = localStorage.getItem('notificationVolume');
            const initialVolume = savedVolume ? parseFloat(savedVolume) * 100 : 60; // 轉換為百分比，預設60%
            volumeControl.value = initialVolume;
            volumeDisplay.textContent = `${initialVolume}%`;
            
            volumeControl.addEventListener('input', (e) => {
                const volume = parseInt(e.target.value);
                volumeDisplay.textContent = `${volume}%`;
                // 儲存到 localStorage (0-1 範圍)
                localStorage.setItem('notificationVolume', (volume / 100).toString());
            });
        }

        // 彈窗控制
        document.querySelector('.close').addEventListener('click', () => {
            this.historyModal.style.display = 'none';
        });
        window.addEventListener('click', (e) => {
            if (e.target === this.historyModal) {
                this.historyModal.style.display = 'none';
            }
        });

        // 歷史記錄篩選
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterHistory(e.target.dataset.period);
            });
        });

        // 圖表標籤切換
        document.querySelectorAll('.chart-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // 移除所有活動狀態
                document.querySelectorAll('.chart-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.chart-canvas').forEach(c => c.classList.remove('active'));
                
                // 添加當前選中的活動狀態
                e.target.classList.add('active');
                const chartId = `${e.target.dataset.chart}-chart`;
                const chartElement = document.getElementById(chartId);
                
                if (chartElement) {
                    // 確保所有圖表都是隱藏的
                    document.querySelectorAll('.chart-canvas').forEach(canvas => {
                        canvas.classList.remove('active');
                        canvas.style.zIndex = '1';
                    });
                    
                    // 顯示選中的圖表
                    chartElement.classList.add('active');
                    chartElement.style.zIndex = '10';
                    
                    // 延遲更新圖表以確保顯示正確
                    setTimeout(() => {
                        this.updateChart(e.target.dataset.chart);
                    }, 300);
                }
            });
        });

        // 頁面關閉前保存數據
        window.addEventListener('beforeunload', () => {
            this.saveData();
        });

        // 頁面可見性變化時的處理
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isRunning) {
                this.saveCurrentSession();
            }
        });
    }    start() {
        // 檢查是否有輸入專注項目（僅在專注時間時檢查）
        const currentTask = this.currentTask.value.trim();
        if (!currentTask && !this.isPaused && this.currentSession === 'focus') {
            // 如果沒有輸入專注項目且不是從暫停狀態恢復且是專注時間，顯示通知
            this.showTaskInputWarning();
            return;
        }

        if (this.isPaused) {
            // 從暫停狀態恢復
            this.isPaused = false;
        } else if (!this.isRunning) {
            // 開始新的計時
            this.setupSession();
            
            // 根據不同會話類型顯示相應的通知
            if (this.currentSession === 'focus') {
                this.showStartFocusNotification(currentTask || '未指定任務');
            } else if (this.currentSession === 'break') {
                this.showStartBreakNotification('短休息時間');
            } else if (this.currentSession === 'long-break') {
                this.showStartBreakNotification('長休息時間');
            }
        }

        this.isRunning = true;
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        
        document.querySelector('.timer-display').classList.add('active');

        this.timer = setInterval(() => {
            this.tick();
        }, 1000);

        this.updateButtonStates();
    }

    pause() {
        this.isRunning = false;
        this.isPaused = true;
        clearInterval(this.timer);
        
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        
        document.querySelector('.timer-display').classList.remove('active');
        this.updateButtonStates();
    }

    reset() {
        this.isRunning = false;
        this.isPaused = false;
        clearInterval(this.timer);
        
        this.sessionCount = 0;
        this.completedPomodoros = 0;
        this.currentSession = 'focus';
        
        this.setupSession();
        this.updateDisplay();
        this.updateButtonStates();
        
        document.querySelector('.timer-display').classList.remove('active', 'break', 'long-break');
    }    setupSession() {
        const mode = this.modes[this.currentMode];
        
        switch (this.currentSession) {
            case 'focus':
                this.totalTime = mode.focus * 60;
                this.sessionType.textContent = '專注時間';
                break;
            case 'break':
                this.totalTime = mode.break * 60;
                this.sessionType.textContent = '短休息';
                break;
            case 'long-break':
                this.totalTime = this.longBreakTime * 60;
                this.sessionType.textContent = '長休息';
                break;
        }
        
        this.currentTime = this.totalTime;
        this.updateDisplay();
    }tick() {
        this.currentTime--;
        this.updateDisplay();
        
        if (this.currentTime <= 0) {
            this.completeSession();
        }
    }

    completeSession() {
        this.isRunning = false;
        clearInterval(this.timer);
        
        this.playNotification();
        this.showNotification();
        
        // 記錄完成的專注時間
        if (this.currentSession === 'focus') {
            this.recordFocusSession();
            this.completedPomodoros++;
            this.sessionCount++;
        }
        
        // 決定下一個階段
        this.determineNextSession();
        this.setupSession();
        this.updateButtonStates();
        this.updateStats();
        
        document.querySelector('.timer-display').classList.remove('active');
    }

    determineNextSession() {
        if (this.currentSession === 'focus') {
            if (this.completedPomodoros % 4 === 0 && this.completedPomodoros > 0) {
                this.currentSession = 'long-break';
            } else {
                this.currentSession = 'break';
            }
        } else {
            this.currentSession = 'focus';
        }
        
        // 更新顯示樣式
        const timerDisplay = document.querySelector('.timer-display');
        timerDisplay.className = 'timer-display';
        if (this.currentSession === 'break') {
            timerDisplay.classList.add('break');
        } else if (this.currentSession === 'long-break') {
            timerDisplay.classList.add('long-break');
        }
    }

    recordFocusSession() {
        const today = new Date().toDateString();
        const task = this.currentTask.value.trim() || '未指定任務';
        const duration = this.modes[this.currentMode].focus;
        
        // 獲取今日記錄
        let todayRecords = this.getTodayRecords();
        
        // 添加新記錄
        const record = {
            task: task,
            duration: duration,
            completedAt: new Date().toLocaleTimeString(),
            mode: this.currentMode
        };
        
        todayRecords.sessions.push(record);
        todayRecords.totalFocusTime += duration;
        todayRecords.totalPomodoros++;
        
        // 保存到 localStorage
        localStorage.setItem(`pomodoro_${today}`, JSON.stringify(todayRecords));
          // 更新任務列表顯示
        this.updateTaskList();
        
        // 更新常用任務按鈕
        this.updateQuickTasks();
    }

    getTodayRecords() {
        const today = new Date().toDateString();
        const saved = localStorage.getItem(`pomodoro_${today}`);
        
        if (saved) {
            return JSON.parse(saved);
        } else {
            return {
                date: today,
                totalFocusTime: 0,
                totalPomodoros: 0,
                sessions: []
            };
        }
    }

    updateDisplay() {
        const minutes = Math.floor(this.currentTime / 60);
        const seconds = this.currentTime % 60;
        this.timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // 更新進度條
        const progress = ((this.totalTime - this.currentTime) / this.totalTime) * 100;
        this.progressFill.style.width = `${progress}%`;
          // 更新會話計數
        this.sessionCountElement.textContent = `第 ${this.sessionCount + 1} 個番茄`;
        
        // 更新頁面標題
        document.title = `${this.timeDisplay.textContent} - 番茄計時器`;
    }

    updateButtonStates() {
        if (this.isRunning) {
            this.startBtn.disabled = true;
            this.startBtn.innerHTML = '<i class="fas fa-play"></i> 進行中...';
            this.pauseBtn.disabled = false;
        } else if (this.isPaused) {
            this.startBtn.disabled = false;
            this.startBtn.innerHTML = '<i class="fas fa-play"></i> 繼續';
            this.pauseBtn.disabled = true;
        } else {
            this.startBtn.disabled = false;
            this.startBtn.innerHTML = '<i class="fas fa-play"></i> 開始';
            this.pauseBtn.disabled = true;
        }
    }

    updateStats() {
        const todayRecords = this.getTodayRecords();
        this.todayFocusTime.textContent = `${todayRecords.totalFocusTime}分鐘`;
        this.todayTomatoes.textContent = `${todayRecords.totalPomodoros}個`;
    }

    updateTaskList() {
        const todayRecords = this.getTodayRecords();
        this.taskList.innerHTML = '';
        
        if (todayRecords.sessions.length === 0) {
            this.taskList.innerHTML = '<p style="text-align: center; color: #6c757d;">今日尚無完成的任務</p>';
            return;
        }
        
        todayRecords.sessions.forEach(session => {
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            taskItem.innerHTML = `
                <div>
                    <div class="task-name">${session.task}</div>
                    <small style="color: #6c757d;">${session.mode === '25-5' ? '標準模式' : '長時間模式'}</small>
                </div>
                <div class="task-time">
                    ${session.duration}分鐘 - ${session.completedAt}
                </div>
            `;
            this.taskList.appendChild(taskItem);
        });
    }    playNotification() {
        // 播放提示音
        this.notificationSound.currentTime = 0;
        this.notificationSound.play().catch(e => {
            console.log('無法播放提示音:', e);
        });
        
        // 如果瀏覽器支持，發送桌面通知
        if ('Notification' in window && Notification.permission === 'granted') {
            const message = this.currentSession === 'focus' ? 
                '專注時間結束！該休息一下了。' : 
                '休息時間結束！準備開始下一個專注時段。';
            
            new Notification('番茄計時器', {
                body: message,
                icon: 'data:text/plain;base64,🍅'
            });
        }
    }

    showNotification() {
        const message = this.currentSession === 'focus' ? 
            '🍅 專注時間結束！該休息一下了。' : 
            '⏰ 休息時間結束！準備開始下一個專注時段。';
        
        // 創建明顯的彈出通知
        this.createPopupNotification(message);
        
        // 讓頁面閃爍提醒
        this.flashPage();
        
        // 播放多次提示音
        this.playRepeatedSound();
    }

    createPopupNotification(message) {
        // 創建通知彈窗
        const notification = document.createElement('div');
        notification.className = 'session-complete-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${this.currentSession === 'focus' ? '🍅' : '⏰'}</div>
                <div class="notification-message">${message}</div>
                <div class="notification-actions">
                    <button class="notification-btn" onclick="this.parentElement.parentElement.parentElement.remove()">
                        確定
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 5秒後自動關閉
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    flashPage() {
        // 讓頁面閃爍3次
        let flashCount = 0;
        const flashInterval = setInterval(() => {
            document.body.style.backgroundColor = flashCount % 2 === 0 ? '#ffeb3b' : '';
            flashCount++;
            if (flashCount >= 6) {
                clearInterval(flashInterval);
                document.body.style.backgroundColor = '';
            }
        }, 300);
    }    playRepeatedSound() {
        // 使用新的電子計時器鈴聲
        if (window.playElectronicBeep) {
            window.playElectronicBeep();
        } else {
            // 後備方案：播放3次原始提示音
            let playCount = 0;
            const playInterval = setInterval(() => {
                this.notificationSound.currentTime = 0;
                this.notificationSound.play().catch(e => {
                    console.log('無法播放提示音:', e);
                });
                playCount++;
                if (playCount >= 3) {
                    clearInterval(playInterval);
                }
            }, 500);
        }
    }    showHistory() {
        this.historyModal.style.display = 'block';
        this.filterHistory('7'); // 默認顯示近7天
    }filterHistory(period) {
        // 更新按鈕狀態
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.period === period) {
                btn.classList.add('active');
            }
        });

        const allRecords = this.getAllRecords();
        let filteredRecords = allRecords;
        
        if (period !== 'all') {
            const days = parseInt(period);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            filteredRecords = allRecords.filter(record => 
                new Date(record.date) >= cutoffDate
            );
        }
        
        this.currentFilteredRecords = filteredRecords;
        this.displayHistoryRecords(filteredRecords);
        this.displayStatsSummary(filteredRecords);
        this.updateAllCharts();
    }getAllRecords() {
        const records = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('pomodoro_')) {
                try {
                    const record = JSON.parse(localStorage.getItem(key));
                    
                    // 過濾掉無效的記錄
                    if (record && record.date && !isNaN(new Date(record.date).getTime())) {
                        records.push(record);
                    }
                } catch (error) {
                    console.warn('解析記錄失敗:', key, error);
                }
            }
        }
        
        return records.sort((a, b) => new Date(b.date) - new Date(a.date));
    }displayHistoryRecords(records) {
        // 先顯示統計摘要
        this.displayStatsSummary(records);
        
        this.historyContent.innerHTML = '';
        
        if (records.length === 0) {
            this.historyContent.innerHTML = '<p style="text-align: center; color: #6c757d;">暫無記錄</p>';
            return;
        }
        
        records.forEach(record => {
            const recordDiv = document.createElement('div');
            recordDiv.style.cssText = 'margin-bottom: 20px; padding: 15px; border: 1px solid #e9ecef; border-radius: 8px;';
            
            recordDiv.innerHTML = `
                <h4 style="margin-bottom: 10px; color: var(--primary-color);">${new Date(record.date).toLocaleDateString()}</h4>
                <p><strong>專注時間:</strong> ${record.totalFocusTime}分鐘</p>
                <p><strong>完成番茄:</strong> ${record.totalPomodoros}個</p>
                <details style="margin-top: 10px;">
                    <summary style="cursor: pointer; color: var(--secondary-color);">查看詳細任務</summary>
                    <div style="margin-top: 10px;">                        ${(record.sessions || []).map(session => `
                            <div style="margin: 5px 0; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                                <strong>${session.task || '未指定任務'}</strong> - ${session.duration}分鐘 (${session.completedAt})
                            </div>
                        `).join('')}
                    </div>
                </details>
            `;
            
            this.historyContent.appendChild(recordDiv);
        });
    }

    displayStatsSummary(records) {
        if (records.length === 0) return;
        
        // 計算統計數據
        const totalFocusTime = records.reduce((sum, record) => sum + record.totalFocusTime, 0);
        const totalPomodoros = records.reduce((sum, record) => sum + record.totalPomodoros, 0);
        const avgDailyFocus = Math.round(totalFocusTime / records.length);
        const mostProductiveDay = records.reduce((max, record) => 
            record.totalFocusTime > max.totalFocusTime ? record : max, records[0]);
        
        // 計算趨勢
        const recentDays = records.slice(0, Math.min(7, records.length));
        const previousDays = records.slice(7, Math.min(14, records.length));
        const recentAvg = recentDays.length > 0 ? 
            recentDays.reduce((sum, r) => sum + r.totalFocusTime, 0) / recentDays.length : 0;
        const previousAvg = previousDays.length > 0 ? 
            previousDays.reduce((sum, r) => sum + r.totalFocusTime, 0) / previousDays.length : 0;
        const trend = recentAvg > previousAvg ? 'up' : recentAvg < previousAvg ? 'down' : 'stable';
        const trendText = trend === 'up' ? '↗ 上升趨勢' : trend === 'down' ? '↘ 下降趨勢' : '→ 保持穩定';
        
        // 創建統計卡片
        const statsHtml = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>總專注時間</h4>
                    <div class="value">${totalFocusTime}</div>
                    <div>分鐘</div>
                </div>
                <div class="stat-card">
                    <h4>完成番茄</h4>
                    <div class="value">${totalPomodoros}</div>
                    <div>個</div>
                </div>
                <div class="stat-card">
                    <h4>平均每日專注</h4>
                    <div class="value">${avgDailyFocus}</div>
                    <div>分鐘/天</div>
                </div>
                <div class="stat-card">
                    <h4>最高效一天</h4>
                    <div class="value">${mostProductiveDay.totalFocusTime}</div>
                    <div>${new Date(mostProductiveDay.date).toLocaleDateString()}</div>
                </div>
                <div class="stat-card">
                    <h4>週間趨勢</h4>
                    <div class="trend ${trend}">${trendText}</div>
                </div>
            </div>
        `;
        
        // 插入到歷史內容前面
        const existingStats = document.querySelector('.stats-grid');
        if (existingStats) {
            existingStats.remove();
        }        
        this.historyContent.insertAdjacentHTML('beforebegin', statsHtml);
    }

    // 初始化圖表
    initializeCharts() {
        if (this.chartsInitialized) {
            return;
        }
        
        // 等待DOM完全載入
        setTimeout(() => {
            try {
                // 專注時間趨勢圖
                const focusTrendCtx = document.getElementById('focus-trend-chart');
                
                if (focusTrendCtx) {
                    this.focusTrendChart = new Chart(focusTrendCtx, {
                        type: 'line',
                        data: {
                            labels: [],
                            datasets: [{
                                label: '每日專注時間（分鐘）',
                                data: [],
                                borderColor: '#ff6b6b',
                                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                                borderWidth: 3,
                                tension: 0.4,
                                fill: true,
                                pointBackgroundColor: '#ff6b6b',
                                pointBorderColor: '#fff',
                                pointBorderWidth: 2,
                                pointRadius: 5
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'top'
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    title: {
                                        display: true,
                                        text: '分鐘'
                                    }
                                },
                                x: {
                                    title: {
                                        display: true,
                                        text: '日期'
                                    }
                                }
                            }
                        }
                    });
                }                // 任務時間分布圖
                const taskBreakdownCtx = document.getElementById('task-breakdown-chart');
                
                if (taskBreakdownCtx) {
                    this.taskBreakdownChart = new Chart(taskBreakdownCtx, {
                        type: 'doughnut',
                        data: {
                            labels: [],
                            datasets: [{
                                data: [],
                                backgroundColor: [
                                    '#ff6b6b', '#4ecdc4', '#51cf66', '#ffd43b', 
                                    '#74c0fc', '#f783ac', '#91a7ff', '#ffa8a8',
                                    '#69db7c', '#74c0fc', '#ffdeeb', '#d0ebff'
                                ],
                                borderWidth: 2,
                                borderColor: '#fff'
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'right',
                                    labels: {
                                        boxWidth: 12,
                                        padding: 15
                                    }
                                }
                            }
                        }
                    });
                }

                // 週間模式圖
                const weeklyPatternCtx = document.getElementById('weekly-pattern-chart');
                if (weeklyPatternCtx) {
                    this.weeklyPatternChart = new Chart(weeklyPatternCtx, {
                        type: 'bar',
                        data: {
                            labels: ['週一', '週二', '週三', '週四', '週五', '週六', '週日'],
                            datasets: [{
                                label: '平均專注時間（分鐘）',
                                data: [0, 0, 0, 0, 0, 0, 0],
                                backgroundColor: [
                                    '#ff6b6b', '#4ecdc4', '#51cf66', '#ffd43b',
                                    '#74c0fc', '#f783ac', '#91a7ff'
                                ],
                                borderRadius: 6,
                                borderSkipped: false
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    display: true
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    title: {
                                        display: true,
                                        text: '分鐘'
                                    }
                                }
                            }
                        }
                    });
                }                this.chartsInitialized = true;
                
                // 確保只有第一個圖表顯示
                document.querySelectorAll('.chart-canvas').forEach((canvas, index) => {
                    if (index === 0) {
                        canvas.classList.add('active');
                        canvas.style.zIndex = '10';
                    } else {
                        canvas.classList.remove('active');
                        canvas.style.zIndex = '1';
                    }
                });
                
                this.updateAllCharts();
            } catch (error) {
                console.error('❌ 初始化圖表時發生錯誤:', error);
            }
        }, 500);
    }    // 更新所有圖表
    updateAllCharts() {
        if (!this.chartsInitialized || !this.currentFilteredRecords) {
            return;
        }
        
        this.updateFocusTrendChart();
        this.updateTaskBreakdownChart();
        this.updateWeeklyPatternChart();
        
        // 調整圖表大小
        this.resizeCharts();
    }

    // 調整圖表大小
    resizeCharts() {
        setTimeout(() => {
            if (this.focusTrendChart) this.focusTrendChart.resize();
            if (this.taskBreakdownChart) this.taskBreakdownChart.resize();
            if (this.weeklyPatternChart) this.weeklyPatternChart.resize();
        }, 100);
    }    // 更新專注時間趨勢圖
    updateFocusTrendChart() {
        if (!this.focusTrendChart) return;
        
        try {
            const records = this.currentFilteredRecords || [];
            const sortedRecords = records.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            const labels = sortedRecords.map(record => {
                const date = new Date(record.date);
                return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
            });
            
            const data = sortedRecords.map(record => record.totalFocusTime);
            
            this.focusTrendChart.data.labels = labels;
            this.focusTrendChart.data.datasets[0].data = data;
            this.focusTrendChart.update();
        } catch (error) {
            console.error('更新趨勢圖時發生錯誤:', error);
        }
    }    // 更新任務時間分布圖
    updateTaskBreakdownChart() {
        if (!this.taskBreakdownChart) return;
        
        try {
            const records = this.currentFilteredRecords || [];
            const taskTimes = {};
            
            // 統計每個任務的總時間
            records.forEach(record => {
                if (record.sessions && Array.isArray(record.sessions)) {
                    record.sessions.forEach(session => {
                        const task = session.task || '未指定任務';
                        taskTimes[task] = (taskTimes[task] || 0) + (session.duration || 0);
                    });
                }
            });
            
            const sortedTasks = Object.entries(taskTimes)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 12); // 只顯示前12個任務
            
            const labels = sortedTasks.map(([task]) => 
                task.length > 15 ? task.substring(0, 15) + '...' : task);
            const data = sortedTasks.map(([, time]) => time);
            
            this.taskBreakdownChart.data.labels = labels;
            this.taskBreakdownChart.data.datasets[0].data = data;
            this.taskBreakdownChart.update();
        } catch (error) {
            console.error('更新任務分布圖時發生錯誤:', error);
        }
    }

    // 更新週間模式圖
    updateWeeklyPatternChart() {
        if (!this.weeklyPatternChart) return;
        
        try {
            const records = this.currentFilteredRecords || [];
            const weeklyData = [0, 0, 0, 0, 0, 0, 0]; // 週一到週日
            const weeklyCount = [0, 0, 0, 0, 0, 0, 0];
            
            records.forEach(record => {
                const date = new Date(record.date);
                const dayOfWeek = (date.getDay() + 6) % 7; // 轉換為週一=0的格式
                weeklyData[dayOfWeek] += record.totalFocusTime;
                weeklyCount[dayOfWeek]++;
            });
            
            // 計算平均值
            const averageData = weeklyData.map((total, index) => 
                weeklyCount[index] > 0 ? Math.round(total / weeklyCount[index]) : 0);
            
            this.weeklyPatternChart.data.datasets[0].data = averageData;
            this.weeklyPatternChart.update();
        } catch (error) {
            console.error('更新週間模式圖時發生錯誤:', error);
        }
    }    // 更新特定圖表
    updateChart(chartType) {
        if (!this.chartsInitialized) return;
        
        try {
            // 強制重繪所有圖表以確保正確顯示
            switch (chartType) {
                case 'focus-trend':
                    if (this.focusTrendChart) {
                        this.updateFocusTrendChart();
                        this.focusTrendChart.resize();
                    }
                    break;
                case 'task-breakdown':
                    if (this.taskBreakdownChart) {
                        this.updateTaskBreakdownChart();
                        this.taskBreakdownChart.resize();
                    }
                    break;
                case 'weekly-pattern':
                    if (this.weeklyPatternChart) {
                        this.updateWeeklyPatternChart();
                        this.weeklyPatternChart.resize();
                    }
                    break;
            }
        } catch (error) {
            console.error('更新圖表時發生錯誤:', error);
        }
    }    exportData() {
        try {
            const allRecords = this.getAllRecords();
            
            // 創建更詳細的匯出數據
            const exportData = {
                exportDate: new Date().toISOString(),
                totalRecords: allRecords.length,
                dateRange: {
                    earliest: allRecords.length > 0 ? allRecords[allRecords.length - 1].date : null,
                    latest: allRecords.length > 0 ? allRecords[0].date : null
                },                summary: {
                    totalFocusTime: allRecords.reduce((sum, record) => sum + (record.totalFocusTime || 0), 0),
                    totalPomodoros: allRecords.reduce((sum, record) => sum + (record.totalPomodoros || 0), 0),
                    totalSessions: allRecords.reduce((sum, record) => sum + (record.sessions ? record.sessions.length : 0), 0)
                },
                records: allRecords
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `pomodoro_data_${new Date().toISOString().split('T')[0]}.json`;
            
            // 添加到頁面並點擊
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 釋放URL對象
            URL.revokeObjectURL(link.href);
            
            console.log('✅ 數據匯出成功！');
            alert('數據匯出成功！檔案已下載。');
        } catch (error) {
            console.error('匯出數據時發生錯誤:', error);
            alert('匯出數據失敗，請稍後再試。');
        }
    }

    importData(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // 驗證數據格式
                if (!data.records || !Array.isArray(data.records)) {
                    throw new Error('無效的數據格式');
                }
                
                // 先清理要匯入日期範圍內的既有數據，避免重複
                const importDates = data.records.map(record => record.date);
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('pomodoro_')) {
                        try {
                            const existingRecord = JSON.parse(localStorage.getItem(key));
                            if (existingRecord && existingRecord.date && importDates.includes(existingRecord.date)) {
                                localStorage.removeItem(key);
                                console.log(`清理既有數據: ${key}`);
                                i--; // 因為移除了項目，需要調整索引
                            }
                        } catch (error) {
                            console.warn(`清理數據時出錯: ${key}`, error);
                        }
                    }
                }
                
                // 將匯入的數據保存到 localStorage
                data.records.forEach(record => {
                    // 只處理有 date 屬性的記錄，跳過狀態記錄
                    if (record.date && typeof record.date === 'string') {
                        // 直接使用完整的日期字串作為key的一部分
                        const dateKey = record.date;
                        localStorage.setItem(`pomodoro_${dateKey}`, JSON.stringify(record));
                        console.log(`匯入數據: pomodoro_${dateKey}`);
                    }
                });
                
                alert('數據匯入成功！');
                
                // 重新載入頁面以顯示匯入的數據
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } catch (error) {
                console.error('匯入數據時發生錯誤:', error);
                alert('匯入數據失敗，請確保檔案格式正確。');
            }
        };
        
        reader.readAsText(file);
    }

    saveData() {
        // 保存當前狀態
        const state = {
            currentTime: this.currentTime,
            totalTime: this.totalTime,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            currentSession: this.currentSession,
            sessionCount: this.sessionCount,
            completedPomodoros: this.completedPomodoros,
            currentMode: this.currentMode,
            longBreakTime: this.longBreakTime
        };
        
        localStorage.setItem('pomodoro_state', JSON.stringify(state));
    }

    loadData() {
        // 載入保存的狀態
        const saved = localStorage.getItem('pomodoro_state');
        if (saved) {
            const state = JSON.parse(saved);
            this.currentTime = state.currentTime || 0;
            this.totalTime = state.totalTime || 0;
            this.currentSession = state.currentSession || 'focus';
            this.sessionCount = state.sessionCount || 0;
            this.completedPomodoros = state.completedPomodoros || 0;
            this.currentMode = state.currentMode || '25-5';
            this.longBreakTime = state.longBreakTime || 30;
            
            // 更新UI
            document.querySelector(`input[value="${this.currentMode}"]`).checked = true;
            this.longBreakInput.value = this.longBreakTime;
        }
          // 載入今日任務列表
        this.updateTaskList();
        
        // 載入常用任務
        this.updateQuickTasks();
        
        // 請求通知權限
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }    }

    saveCurrentSession() {
        this.saveData();
    }

    // 清理無效數據的方法
    cleanInvalidData() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('pomodoro_') && key !== 'pomodoro_state') {
                try {
                    const record = JSON.parse(localStorage.getItem(key));
                    if (!record || !record.date || isNaN(new Date(record.date).getTime())) {
                        keysToRemove.push(key);
                        console.log('標記要清理的無效數據:', key, record);
                    }
                } catch (error) {
                    keysToRemove.push(key);
                    console.log('標記要清理的損壞數據:', key);
                }
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log('已清理無效數據:', key);
        });
        
        if (keysToRemove.length > 0) {
            console.log(`✅ 清理完成，共清理 ${keysToRemove.length} 個無效記錄`);
            // 清理後重新更新統計
            this.updateStats();
        }
    }

    // 獲取常用任務統計
    getPopularTasks() {
        const allRecords = this.getAllRecords();
        const taskFrequency = {};
        
        // 確保 allRecords 是陣列
        if (!Array.isArray(allRecords)) {
            console.warn('getAllRecords 沒有返回陣列:', allRecords);
            return [];
        }
        
        // 統計所有任務的使用頻率
        allRecords.forEach(record => {
            if (record && record.sessions && Array.isArray(record.sessions)) {
                record.sessions.forEach(session => {
                    const task = session.task;
                    if (task && task !== '未指定任務') {
                        taskFrequency[task] = (taskFrequency[task] || 0) + 1;
                    }
                });
            }
        });
        
        // 排序並返回前8個最常用的任務
        return Object.entries(taskFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([task, count]) => ({ task, count }));
    }

    // 更新常用任務按鈕
    updateQuickTasks() {
        const popularTasks = this.getPopularTasks();
        this.quickTaskButtons.innerHTML = '';
        
        if (popularTasks.length === 0) {
            this.quickTaskButtons.innerHTML = `
                <div class="empty-tasks-hint">
                    <i class="fas fa-info-circle"></i> 
                    完成一些專注時段後，這裡會顯示您的常用任務快捷按鈕
                </div>
            `;
            return;
        }
        
        popularTasks.forEach(({ task, count }) => {
            const button = document.createElement('button');
            button.className = `quick-task-btn ${count >= 3 ? 'popular' : ''}`;
            button.innerHTML = `
                <i class="fas fa-play"></i>
                <span title="${task}">${task.length > 12 ? task.substring(0, 12) + '...' : task}</span>
                <small>(${count})</small>
            `;
            
            button.addEventListener('click', () => {
                this.selectQuickTask(task);
            });
            
            this.quickTaskButtons.appendChild(button);
        });
    }

    // 選擇常用任務
    selectQuickTask(task) {
        this.currentTask.value = task;
        
        // 如果當前不在運行狀態，直接開始
        if (!this.isRunning && !this.isPaused) {
            this.start();
        }
        
        // 視覺反饋
        this.currentTask.style.background = '#e8f5e8';
        setTimeout(() => {
            this.currentTask.style.background = '';
        }, 1000);
        
        console.log(`✅ 已選擇任務: ${task}`);
    }

    // 顯示任務輸入警告通知
    showTaskInputWarning() {
        const notification = document.createElement('div');
        notification.className = 'task-warning-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">⚠️</div>
                <div class="notification-message">請先輸入您要專注的任務項目</div>
                <div class="notification-actions">
                    <button class="notification-btn focus-input-btn" onclick="this.parentElement.parentElement.parentElement.remove(); document.getElementById('current-task').focus();">
                        好的，去輸入
                    </button>
                    <button class="notification-btn secondary" onclick="this.parentElement.parentElement.parentElement.remove();">
                        稍後再說
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 10秒後自動關閉
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
    }

    // 顯示開始專注的通知
    showStartFocusNotification(taskName) {
        const notification = document.createElement('div');
        notification.className = 'start-focus-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">🍅</div>
                <div class="notification-message">
                    <div class="focus-title">開始專注時間！</div>
                    <div class="focus-task">${taskName}</div>
                </div>
                <div class="notification-actions">
                    <button class="notification-btn" onclick="this.parentElement.parentElement.parentElement.remove();">
                        專注開始
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 3秒後自動關閉
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    // 顯示開始休息的通知
    showStartBreakNotification(breakType) {
        const notification = document.createElement('div');
        notification.className = 'start-break-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${breakType.includes('長') ? '😴' : '☕'}</div>
                <div class="notification-message">
                    <div class="break-title">休息時間開始！</div>
                    <div class="break-type">${breakType}</div>
                </div>
                <div class="notification-actions">
                    <button class="notification-btn" onclick="this.parentElement.parentElement.parentElement.remove();">
                        好的，休息一下
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 3秒後自動關閉
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
}

// 創建提示音檔案（使用 Web Audio API）
function createNotificationSound() {
    // 創建更溫和的電子計時器鈴聲
    window.playElectronicBeep = function() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();        // 播放四聲活潑的提示音，逐漸提升音高
        const frequencies = [523, 659, 784, 988]; // 四段音階：C5, E5, G5, B5 (更活潑的音程)
        const duration = 0.2; // 更短促活潑
        const gap = 0.1; // 更緊湊的間隔
        
        // 使用儲存的音量設定，預設為60%
        const savedVolume = localStorage.getItem('notificationVolume');
        const volume = (savedVolume ? parseFloat(savedVolume) : 0.6) * 0.5; // 最大音量限制在50%
        
        frequencies.forEach((freq, index) => {
            const startTime = audioContext.currentTime + (index * (duration + gap));
            
            // 創建振盪器
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            // 連接音頻節點
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // 設置頻率（較低頻率更溫和）
            oscillator.frequency.setValueAtTime(freq, startTime);
            oscillator.type = 'sine'; // 正弦波更柔和
            
            // 設置音量包絡（漸進式音量變化）
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.05); // 用戶設定音量，慢速上升
            gainNode.gain.linearRampToValueAtTime(volume, startTime + duration - 0.1); // 保持
            gainNode.gain.linearRampToValueAtTime(0, startTime + duration); // 漸進下降
            
            // 開始和停止
            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
        });
    };
    
    // 重寫HTML音頻元素的播放方法
    const audio = document.getElementById('notification-sound');
    if (audio) {
        const originalPlay = audio.play.bind(audio);
        
        audio.play = function() {
            // 使用新的電子鈴聲
            if (window.playElectronicBeep) {
                window.playElectronicBeep();
            }
            return Promise.resolve();
        };
    }
}

// 測試數據生成器 - 用於演示歷史記錄和圖表功能
function generateTestData() {
    const testData = [];
    const tasks = [
        '學習JavaScript', '閱讀技術文章', '工作專案開發', '英語學習',
        '運動健身', '寫程式作業', '看線上課程', '整理筆記',
        '研究新技術', '編寫文檔', '程式碼重構', '學習算法',
        '準備考試', '會議討論', '客戶溝通', '設計思考',
        '市場調研', '寫博客文章', '學習新框架', '代碼審查'
    ];
    
    console.log('🚀 開始生成測試數據...');
    
    // 生成過去90天的測試數據
    for (let i = 90; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateString = date.toDateString();
        
        // 週末降低活動概率
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const activityProbability = isWeekend ? 0.6 : 0.9;
        
        if (Math.random() > activityProbability) {
            continue; // 跳過這一天
        }
        
        // 隨機生成1-8個番茄鐘的數據
        const pomodoroCount = Math.floor(Math.random() * 8) + 1;
        const sessions = [];
        let totalFocusTime = 0;
        
        for (let j = 0; j < pomodoroCount; j++) {
            const task = tasks[Math.floor(Math.random() * tasks.length)];
            const duration = Math.random() > 0.7 ? 50 : 25; // 30%機率是長時間模式
            const baseTime = new Date(date);
            baseTime.setHours(9 + Math.floor(Math.random() * 10)); // 9AM-7PM
            baseTime.setMinutes(Math.floor(Math.random() * 60));
            
            sessions.push({
                task: task,
                duration: duration,
                completedAt: baseTime.toLocaleTimeString(),
                mode: duration === 50 ? '50-10' : '25-5'
            });
            
            totalFocusTime += duration;
        }
        
        const dayRecord = {
            date: dateString,
            totalFocusTime: totalFocusTime,
            totalPomodoros: pomodoroCount,
            sessions: sessions
        };
        
        // 儲存到 localStorage
        localStorage.setItem(`pomodoro_${dateString}`, JSON.stringify(dayRecord));
    }
    
    console.log('✅ 已生成90天的測試數據！');
    console.log('📊 數據包含：');
    console.log('   - 90天的專注記錄');
    console.log('   - 20種不同的任務類型');
    console.log('   - 混合25分鐘和50分鐘模式');
    console.log('   - 模擬真實的工作模式（週末較少活動）');
    console.log('');
    console.log('🎯 現在您可以：');
    console.log('   1. 重新整理頁面');
    console.log('   2. 點擊「查看歷史記錄」按鈕');
    console.log('   3. 嘗試不同的時間範圍和圖表類型');
    
    // 自動重新整理頁面
    setTimeout(() => {        window.location.reload();
    }, 2000);
}

// 全域變量供快捷按鈕使用
let timer;

// 初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    // 創建提示音
    createNotificationSound();
    
    // 初始化番茄計時器
    timer = new PomodoroTimer();
    
    // 定期保存數據
    setInterval(() => {
        timer.saveData();
    }, 30000); // 每30秒保存一次
      console.log('🍅 番茄計時器已載入！');
});
