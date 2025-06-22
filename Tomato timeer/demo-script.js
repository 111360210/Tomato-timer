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
        this.currentPeriod = '7';
        
        // DOM 元素
        this.initializeElements();
        this.initializeEventListeners();
        this.loadData();
        this.updateDisplay();
        this.updateStats();
    }

    initializeElements() {
        this.timeDisplay = document.getElementById('time-display');
        this.sessionType = document.getElementById('session-type');
        this.sessionCount = document.getElementById('session-count');
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
        });

        // 長休息時間設定
        this.longBreakInput.addEventListener('change', (e) => {
            this.longBreakTime = parseInt(e.target.value);
        });

        // 歷史記錄按鈕
        document.getElementById('view-history-btn').addEventListener('click', () => {
            this.showHistory();
        });
        document.getElementById('export-data-btn').addEventListener('click', () => {
            this.exportData();
        });        // 匯入數據按鈕
        document.getElementById('import-data-btn').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });
        
        // 檔案選擇事件
        document.getElementById('import-file-input').addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });

        // 清除測試數據按鈕（只在demo版本中有效）
        document.getElementById('clear-test-data-btn').addEventListener('click', () => {
            if (confirm('確定要清除所有測試數據嗎？此操作無法復原。')) {
                clearTestData();
            }
        });        // 測試計時器按鈕
        document.getElementById('start-test-timer-btn').addEventListener('click', () => {
            this.startTestTimer();
        });        // 測試鈴聲按鈕
        document.getElementById('test-sound-btn').addEventListener('click', () => {
            this.testSound();
        });

        // 音量控制滑塊
        const volumeControl = document.getElementById('volume-control');
        const volumeDisplay = document.getElementById('volume-display');
        
        volumeControl.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            volumeDisplay.textContent = `${volume}%`;
            window.notificationVolume = volume / 100; // 設置全域音量變數
            // 儲存到 localStorage
            localStorage.setItem('notificationVolume', (volume / 100).toString());
        });
        
        // 初始化音量 - 從 localStorage 讀取或使用預設值
        const savedVolume = localStorage.getItem('notificationVolume');
        const initialVolume = savedVolume ? parseFloat(savedVolume) : 0.3; // 預設30%
        window.notificationVolume = initialVolume;
        volumeControl.value = initialVolume * 100;
        volumeDisplay.textContent = `${Math.round(initialVolume * 100)}%`;

        // 更新常用任務按鈕
        document.getElementById('refresh-tasks-btn').addEventListener('click', () => {
            this.updateQuickTasks();
        });

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
    }

    start() {
        if (this.isPaused) {
            this.isPaused = false;
        } else {
            this.currentTime = this.modes[this.currentMode][this.currentSession] * 60;
            this.totalTime = this.currentTime;
        }
        
        this.isRunning = true;
        this.updateDisplay();
        this.updateProgress();
        
        this.timer = setInterval(() => {
            this.currentTime--;
            this.updateDisplay();
            this.updateProgress();
            
            if (this.currentTime <= 0) {
                this.complete();
            }
        }, 1000);
        
        this.startBtn.style.display = 'none';
        this.pauseBtn.style.display = 'inline-block';
    }

    pause() {
        this.isRunning = false;
        this.isPaused = true;
        clearInterval(this.timer);
        
        this.startBtn.style.display = 'inline-block';
        this.pauseBtn.style.display = 'none';
    }

    reset() {
        this.isRunning = false;
        this.isPaused = false;
        clearInterval(this.timer);
        
        this.currentTime = this.modes[this.currentMode].focus * 60;
        this.totalTime = this.currentTime;
        this.currentSession = 'focus';
        
        this.updateDisplay();
        this.updateProgress();
        
        this.startBtn.style.display = 'inline-block';
        this.pauseBtn.style.display = 'none';
    }

    complete() {
        this.isRunning = false;
        clearInterval(this.timer);
        
        // 播放提示音
        this.playNotificationSound();
        
        // 桌面通知
        this.showNotification();
        
        // 記錄完成的番茄
        if (this.currentSession === 'focus') {
            this.recordPomodoro();
            this.completedPomodoros++;
            this.sessionCount++;
        }
        
        // 切換到下一個階段
        this.switchSession();
        
        // 更新統計數據
        this.updateStats();
        this.updateQuickTasks();
        
        this.startBtn.style.display = 'inline-block';
        this.pauseBtn.style.display = 'none';
    }

    switchSession() {
        if (this.currentSession === 'focus') {
            if (this.completedPomodoros % 4 === 0) {
                this.currentSession = 'long-break';
                this.currentTime = this.longBreakTime * 60;
            } else {
                this.currentSession = 'break';
                this.currentTime = this.modes[this.currentMode].break * 60;
            }
        } else {
            this.currentSession = 'focus';
            this.currentTime = this.modes[this.currentMode].focus * 60;
        }
        
        this.totalTime = this.currentTime;
        this.updateDisplay();
        this.updateProgress();
    }

    updateDisplay() {
        const minutes = Math.floor(this.currentTime / 60);
        const seconds = this.currentTime % 60;
        this.timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const sessionTypes = {
            'focus': '專注時間',
            'break': '短休息',
            'long-break': '長休息'
        };
        this.sessionType.textContent = sessionTypes[this.currentSession];
        
        this.sessionCount.textContent = this.completedPomodoros + 1;
    }    updateProgress() {
        const progress = ((this.totalTime - this.currentTime) / this.totalTime) * 100;
        this.progressFill.style.width = `${progress}%`;
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

    recordPomodoro() {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const taskName = this.currentTask.value || '未命名任務';
        
        // 保存專注記錄
        const record = {
            date: today,
            time: now.toISOString(),
            task: taskName,
            duration: this.modes[this.currentMode].focus,
            mode: this.currentMode
        };
        
        const key = `pomodoro_${today}`;
        const todayRecords = JSON.parse(localStorage.getItem(key) || '[]');
        todayRecords.push(record);
        localStorage.setItem(key, JSON.stringify(todayRecords));
        
        // 更新今日任務記錄顯示
        this.updateTodayTasks();
    }

    updateTodayTasks() {
        const today = new Date().toISOString().split('T')[0];
        const key = `pomodoro_${today}`;
        const todayRecords = JSON.parse(localStorage.getItem(key) || '[]');
        
        if (todayRecords.length === 0) {
            this.taskList.innerHTML = '<p class="no-tasks">今日還沒有完成的番茄喔！</p>';
            return;
        }
        
        // 按任務分組
        const taskGroups = {};
        todayRecords.forEach(record => {
            if (!taskGroups[record.task]) {
                taskGroups[record.task] = [];
            }
            taskGroups[record.task].push(record);
        });
        
        let html = '';
        Object.entries(taskGroups).forEach(([task, records]) => {
            const totalTime = records.reduce((sum, record) => sum + record.duration, 0);
            html += `
                <div class="task-item">
                    <div class="task-name">${task}</div>
                    <div class="task-stats">
                        <span>${records.length} 個番茄</span>
                        <span>${totalTime} 分鐘</span>
                    </div>
                </div>
            `;
        });
        
        this.taskList.innerHTML = html;
    }

    updateStats() {
        const today = new Date().toISOString().split('T')[0];
        const key = `pomodoro_${today}`;
        const todayRecords = JSON.parse(localStorage.getItem(key) || '[]');
        
        const totalTime = todayRecords.reduce((sum, record) => sum + record.duration, 0);
        const totalPomodoros = todayRecords.length;
        
        this.todayFocusTime.textContent = `${totalTime}分鐘`;
        this.todayTomatoes.textContent = `${totalPomodoros}個`;
        
        this.updateTodayTasks();
    }

    updateQuickTasks() {
        const allRecords = this.getAllRecords();
        const taskCounts = {};
        
        // 統計所有任務的使用次數
        allRecords.forEach(record => {
            const task = record.task;
            taskCounts[task] = (taskCounts[task] || 0) + 1;
        });
        
        // 排序並取前5個最常用任務
        const topTasks = Object.entries(taskCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .filter(([task]) => task !== '未命名任務');
        
        // 生成快捷按鈕
        if (topTasks.length === 0) {
            this.quickTaskButtons.innerHTML = '<p class="no-quick-tasks">暫無常用任務，完成幾個番茄後會自動顯示！</p>';
            return;
        }
        
        let html = '';
        topTasks.forEach(([task, count]) => {
            html += `
                <button class="quick-task-btn" onclick="timer.setQuickTask('${task}')">
                    <span class="task-name">${task}</span>
                    <span class="task-count">${count}次</span>
                </button>
            `;
        });
        
        this.quickTaskButtons.innerHTML = html;
    }

    setQuickTask(taskName) {
        this.currentTask.value = taskName;
        // 如果沒有在運行，自動開始
        if (!this.isRunning && !this.isPaused) {
            this.start();
        }
    }    getAllRecords() {
        const records = [];
        const keys = Object.keys(localStorage);
        
        keys.forEach(key => {
            if (key.startsWith('pomodoro_') && key !== 'pomodoro_state') {
                try {
                    const dayRecords = JSON.parse(localStorage.getItem(key) || '[]');
                    if (Array.isArray(dayRecords)) {
                        // 過濾掉無效的記錄
                        const validRecords = dayRecords.filter(record => 
                            record && record.time && !isNaN(new Date(record.time).getTime())
                        );
                        records.push(...validRecords);
                    }
                } catch (error) {
                    console.warn('解析記錄失敗:', key, error);
                }
            }
        });
        
        return records.sort((a, b) => new Date(b.time) - new Date(a.time));
    }

    showHistory() {
        this.historyModal.style.display = 'block';
        this.filterHistory('7'); // 默認顯示近7天
    }

    filterHistory(period) {
        this.currentPeriod = period;
        const allRecords = this.getAllRecords();
        let filteredRecords = [];
        
        if (period === 'all') {
            filteredRecords = allRecords;
        } else {
            const days = parseInt(period);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            filteredRecords = allRecords.filter(record => 
                new Date(record.time) >= cutoffDate
            );
        }
        
        this.currentFilteredRecords = filteredRecords;
        this.displayHistory(filteredRecords);
        this.initializeCharts(filteredRecords);
    }

    displayHistory(records) {
        if (records.length === 0) {
            this.historyContent.innerHTML = '<p class="no-history">此時間範圍內沒有記錄。</p>';
            return;
        }
        
        // 計算統計數據
        const totalPomodoros = records.length;
        const totalTime = records.reduce((sum, record) => sum + record.duration, 0);
        const uniqueDays = new Set(records.map(record => record.date)).size;
        const avgPerDay = uniqueDays > 0 ? Math.round(totalTime / uniqueDays) : 0;
        
        // 按日期分組
        const groupedByDate = {};
        records.forEach(record => {
            if (!groupedByDate[record.date]) {
                groupedByDate[record.date] = [];
            }
            groupedByDate[record.date].push(record);
        });
        
        // 生成HTML
        let html = `
            <div class="history-summary">
                <div class="summary-stats">
                    <div class="summary-item">
                        <span class="summary-value">${totalPomodoros}</span>
                        <span class="summary-label">總番茄數</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-value">${totalTime}</span>
                        <span class="summary-label">總專注時間(分)</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-value">${uniqueDays}</span>
                        <span class="summary-label">活躍天數</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-value">${avgPerDay}</span>
                        <span class="summary-label">日均專注(分)</span>
                    </div>
                </div>
            </div>
            
            <div class="history-details">
        `;
        
        Object.entries(groupedByDate)
            .sort(([a], [b]) => new Date(b) - new Date(a))
            .forEach(([date, dayRecords]) => {
                const dayTotal = dayRecords.reduce((sum, record) => sum + record.duration, 0);
                const formattedDate = new Date(date).toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long'
                });
                
                html += `
                    <div class="history-day">
                        <div class="day-header">
                            <h4>${formattedDate}</h4>
                            <span class="day-summary">${dayRecords.length} 個番茄 · ${dayTotal} 分鐘</span>
                        </div>
                        <div class="day-records">
                `;
                
                dayRecords.forEach(record => {
                    const time = new Date(record.time).toLocaleTimeString('zh-TW', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    html += `
                        <div class="record-item">
                            <span class="record-time">${time}</span>
                            <span class="record-task">${record.task}</span>
                            <span class="record-duration">${record.duration}分</span>
                            <span class="record-mode">${record.mode}</span>
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            });
        
        html += '</div>';
        this.historyContent.innerHTML = html;
    }

    initializeCharts(records) {
        if (!this.chartsInitialized) {
            this.createCharts();
            this.chartsInitialized = true;
        }
        
        this.updateChart('focus-trend');
    }

    createCharts() {
        // 專注趨勢圖
        const focusTrendCtx = document.getElementById('focus-trend-chart');
        if (focusTrendCtx) {
            this.focusTrendChart = new Chart(focusTrendCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: '專注時間 (分鐘)',
                        data: [],
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: '每日專注時間趨勢'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: '專注時間 (分鐘)'
                            }
                        }
                    }
                }
            });
        }
        
        // 任務分布圖
        const taskDistributionCtx = document.getElementById('task-distribution-chart');
        if (taskDistributionCtx) {
            this.taskDistributionChart = new Chart(taskDistributionCtx, {
                type: 'pie',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: '任務時間分布'
                        },
                        legend: {
                            position: 'bottom'
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
                    labels: ['週日', '週一', '週二', '週三', '週四', '週五', '週六'],
                    datasets: [{
                        label: '平均專注時間 (分鐘)',
                        data: [],
                        backgroundColor: '#4CAF50',
                        borderColor: '#388E3C',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: '週間專注模式'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: '專注時間 (分鐘)'
                            }
                        }
                    }
                }
            });
        }
    }

    updateChart(chartType) {
        if (!this.currentFilteredRecords) return;
        
        const records = this.currentFilteredRecords;
        
        switch (chartType) {
            case 'focus-trend':
                this.updateFocusTrendChart(records);
                break;
            case 'task-distribution':
                this.updateTaskDistributionChart(records);
                break;
            case 'weekly-pattern':
                this.updateWeeklyPatternChart(records);
                break;
        }
    }

    updateFocusTrendChart(records) {
        if (!this.focusTrendChart) return;
        
        // 按日期分組並計算每日總時間
        const dailyData = {};
        records.forEach(record => {
            const date = record.date;
            dailyData[date] = (dailyData[date] || 0) + record.duration;
        });
        
        // 排序日期
        const sortedDates = Object.keys(dailyData).sort();
        const labels = sortedDates.map(date => 
            new Date(date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
        );
        const data = sortedDates.map(date => dailyData[date]);
        
        this.focusTrendChart.data.labels = labels;
        this.focusTrendChart.data.datasets[0].data = data;
        this.focusTrendChart.update('none');
    }

    updateTaskDistributionChart(records) {
        if (!this.taskDistributionChart) return;
        
        // 按任務分組並計算總時間
        const taskData = {};
        records.forEach(record => {
            const task = record.task;
            taskData[task] = (taskData[task] || 0) + record.duration;
        });
        
        const labels = Object.keys(taskData);
        const data = Object.values(taskData);
        
        this.taskDistributionChart.data.labels = labels;
        this.taskDistributionChart.data.datasets[0].data = data;
        this.taskDistributionChart.update('none');
    }

    updateWeeklyPatternChart(records) {
        if (!this.weeklyPatternChart) return;
        
        // 按星期分組
        const weeklyData = [0, 0, 0, 0, 0, 0, 0]; // 週日到週六
        const weeklyCounts = [0, 0, 0, 0, 0, 0, 0];
        
        records.forEach(record => {
            const date = new Date(record.date);
            const dayOfWeek = date.getDay(); // 0 = 週日
            weeklyData[dayOfWeek] += record.duration;
            weeklyCounts[dayOfWeek] += 1;
        });
        
        // 計算平均值
        const averageData = weeklyData.map((total, index) => 
            weeklyCounts[index] > 0 ? Math.round(total / weeklyCounts[index]) : 0
        );
        
        this.weeklyPatternChart.data.datasets[0].data = averageData;
        this.weeklyPatternChart.update('none');
    }

    exportData() {
        const allRecords = this.getAllRecords();
        
        if (allRecords.length === 0) {
            alert('沒有數據可以匯出！');
            return;
        }
        
        // 準備CSV數據
        const headers = ['日期', '時間', '任務', '專注時長(分鐘)', '計時模式'];
        const csvContent = [
            headers.join(','),
            ...allRecords.map(record => [
                record.date,
                new Date(record.time).toLocaleTimeString('zh-TW'),
                `"${record.task}"`,
                record.duration,
                record.mode
            ].join(','))
        ].join('\n');
        
        // 下載文件
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `番茄計時器數據_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert(`成功匯出 ${allRecords.length} 條記錄！`);
    }    playNotificationSound() {
        try {
            // 優先使用電子計時器鈴聲
            if (window.playElectronicBeep) {
                window.playElectronicBeep();
            } else {
                // 後備方案：使用HTML音效
                this.notificationSound.currentTime = 0;
                this.notificationSound.play().catch(e => {
                    console.log('無法播放提示音：', e);
                });
            }
        } catch (e) {
            console.log('提示音播放失敗：', e);
        }
    }

    playNotification() {
        // 播放提示音
        this.playNotificationSound();
        
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
        console.log('🔔 showNotification() 被呼叫');
        const message = this.currentSession === 'focus' ? 
            '🍅 專注時間結束！該休息一下了。' : 
            '⏰ 休息時間結束！準備開始下一個專注時段。';
        
        console.log('📝 通知訊息:', message);
        
        // 創建明顯的彈出通知
        console.log('🎯 呼叫 createPopupNotification()...');
        this.createPopupNotification(message);
        
        // 讓頁面閃爍提醒
        console.log('⚡ 呼叫 flashPage()...');
        this.flashPage();
        
        // 播放多次提示音
        console.log('🔊 呼叫 playRepeatedSound()...');
        this.playRepeatedSound();
        
        // 桌面通知
        if ('Notification' in window && Notification.permission === 'granted') {
            const sessionNames = {
                'focus': '專注時間結束！',
                'break': '休息時間結束！',
                'long-break': '長休息結束！'
            };
            
            new Notification('🍅 番茄計時器', {
                body: sessionNames[this.currentSession] || '時間到！',
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🍅</text></svg>'
            });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.showNotification();
                }
            });
        }
    }    createPopupNotification(message) {
        console.log('🎨 createPopupNotification() 開始執行');
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
        
        console.log('➕ 將通知添加到頁面...');
        document.body.appendChild(notification);
        console.log('✅ 通知彈窗已添加到頁面');
        
        // 5秒後自動關閉
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
                console.log('🗑️ 通知彈窗已自動關閉');
            }
        }, 5000);
    }    flashPage() {
        console.log('⚡ flashPage() 開始執行');
        // 讓頁面閃爍3次
        let flashCount = 0;
        const flashInterval = setInterval(() => {
            document.body.style.backgroundColor = flashCount % 2 === 0 ? '#ffeb3b' : '';
            flashCount++;
            console.log(`⚡ 閃爍 ${flashCount}/6`);
            if (flashCount >= 6) {
                clearInterval(flashInterval);
                document.body.style.backgroundColor = '';
                console.log('⚡ 頁面閃爍完成');
            }
        }, 300);
    }    playRepeatedSound() {
        console.log('🔊 playRepeatedSound() 開始執行');
        
        // 如果有新的電子嗶聲函數，使用它
        if (window.playElectronicBeep) {
            console.log('🎵 播放電子計時器鈴聲');
            window.playElectronicBeep();
        } else {
            // 後備方案：播放3次原始提示音
            let playCount = 0;
            const playInterval = setInterval(() => {
                this.notificationSound.currentTime = 0;
                this.notificationSound.play().then(() => {
                    console.log(`🔊 播放提示音 ${playCount + 1}/3`);
                }).catch(e => {
                    console.log('🚫 無法播放提示音:', e);
                });
                playCount++;
                if (playCount >= 3) {
                    clearInterval(playInterval);
                    console.log('🔊 提示音播放完成');
                }
            }, 500);
        }
    }

    // 測試計時器功能 - 僅在demo版本中可用
    startTestTimer() {
        const testInput = document.getElementById('test-timer-input');
        const testSeconds = parseInt(testInput.value) || 5;
        
        if (testSeconds < 1 || testSeconds > 300) {
            alert('請輸入 1-300 秒之間的數值');
            return;
        }
        
        // 如果當前正在運行，先停止
        if (this.isRunning) {
            this.reset();
        }
        
        // 暫存原始設定
        const originalSession = this.currentSession;
        const originalMode = this.currentMode;
        const originalTotalTime = this.totalTime;
        const originalCurrentTime = this.currentTime;
        
        // 設置測試計時器
        this.currentSession = 'focus';
        this.totalTime = testSeconds;
        this.currentTime = testSeconds;
        this.sessionType.textContent = '測試計時器';
        
        // 更新顯示
        this.updateDisplay();
        
        // 啟動計時器
        this.isRunning = true;
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        
        document.querySelector('.timer-display').classList.add('active');
          this.timer = setInterval(() => {
            console.log('測試計時器 tick，剩餘時間:', this.currentTime);
            this.currentTime--;
            this.updateDisplay();
            
            if (this.currentTime <= 0) {
                console.log('🚨 測試計時器時間到！開始執行通知...');
                
                // 測試計時結束
                this.isRunning = false;
                clearInterval(this.timer);                console.log('🔊 呼叫 playNotification()...');
                // 播放通知
                this.playNotification();
                
                console.log('📢 呼叫 showNotification()...');
                this.showNotification();
                
                // 恢復原始狀態
                this.currentSession = originalSession;
                this.currentMode = originalMode;
                this.totalTime = originalTotalTime;
                this.currentTime = originalCurrentTime;
                this.sessionType.textContent = '準備開始';
                
                this.updateDisplay();
                this.updateButtonStates();
                
                document.querySelector('.timer-display').classList.remove('active');
                
                console.log('🍅 測試計時器完成！通知效果測試結束。');
            }
        }, 1000);
        
        this.updateButtonStates();
          console.log(`🍅 測試計時器啟動：${testSeconds} 秒`);
    }

    // 測試鈴聲功能 - 僅在demo版本中可用
    testSound() {
        console.log('🔔 測試電子計時器鈴聲...');
        
        // 顯示測試提示
        const message = '🔊 電子計時器鈴聲測試';
        this.createPopupNotification(message);
        
        // 播放電子鈴聲
        if (window.playElectronicBeep) {
            window.playElectronicBeep();
            console.log('✅ 電子鈴聲播放完成');
        } else {
            console.log('❌ 電子鈴聲函數未初始化');
            // 後備方案
            this.playNotificationSound();
        }
    }

    loadData() {
        const savedState = localStorage.getItem('pomodoro_state');
        if (savedState) {
            const state = JSON.parse(savedState);
            this.completedPomodoros = state.completedPomodoros || 0;
            this.longBreakTime = state.longBreakTime || 30;
            this.currentMode = state.currentMode || '25-5';
            
            // 恢復UI狀態
            if (this.longBreakInput) {
                this.longBreakInput.value = this.longBreakTime;
            }
            
            const modeRadio = document.querySelector(`input[name="timer-mode"][value="${this.currentMode}"]`);
            if (modeRadio) {
                modeRadio.checked = true;
            }
        }
        
        this.reset();
    }

    saveData() {
        const state = {
            completedPomodoros: this.completedPomodoros,
            longBreakTime: this.longBreakTime,
            currentMode: this.currentMode
        };
        localStorage.setItem('pomodoro_state', JSON.stringify(state));
    }

    saveCurrentSession() {
        if (this.isRunning) {
            this.saveData();
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
                
                // 將匯入的數據保存到 localStorage
                data.records.forEach(record => {
                    const dateKey = record.date.split('T')[0]; // 只取日期部分
                    localStorage.setItem(`pomodoro_${dateKey}`, JSON.stringify(record));
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
        const state = {
            completedPomodoros: this.completedPomodoros,
            longBreakTime: this.longBreakTime,
            currentMode: this.currentMode
        };
        localStorage.setItem('pomodoro_state', JSON.stringify(state));
    }

    saveCurrentSession() {
        if (this.isRunning) {
            this.saveData();
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
                
                // 將匯入的數據保存到 localStorage
                data.records.forEach(record => {
                    const dateKey = record.date.split('T')[0]; // 只取日期部分
                    localStorage.setItem(`pomodoro_${dateKey}`, JSON.stringify(record));
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
        const state = {
            completedPomodoros: this.completedPomodoros,
            longBreakTime: this.longBreakTime,
            currentMode: this.currentMode
        };
        localStorage.setItem('pomodoro_state', JSON.stringify(state));
    }

    saveCurrentSession() {
        if (this.isRunning) {
            this.saveData();
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
                
                // 將匯入的數據保存到 localStorage
                data.records.forEach(record => {
                    const dateKey = record.date.split('T')[0]; // 只取日期部分
                    localStorage.setItem(`pomodoro_${dateKey}`, JSON.stringify(record));
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
}

// 創建提示音
function createNotificationSound() {
    // 創建更溫和的電子計時器鈴聲
    window.playElectronicBeep = function() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();        // 播放四聲活潑的提示音，逐漸提升音高
        const frequencies = [523, 659, 784, 988]; // 四段音階：C5, E5, G5, B5 (更活潑的音程)
        const duration = 0.2; // 更短促活潑
        const gap = 0.1; // 更緊湊的間隔
        
        // 使用用戶設定的音量，預設為15%
        const volume = (window.notificationVolume || 0.15) * 0.5; // 最大音量限制在50%
        
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
}

// 生成測試數據 - 僅在demo版本中可用
function generateTestData() {
    console.log('🍅 開始生成測試數據...');
    
    const tasks = [
        '學習程式設計', '閱讀書籍', '寫作練習', '運動健身', '冥想放鬆',
        '整理房間', '學習英語', '工作專案', '創作繪畫', '學習音樂',
        '編寫文檔', '市場研究', '產品設計', '客戶服務', '數據分析'
    ];
    
    const modes = ['25-5', '50-10'];
    const durations = { '25-5': 25, '50-10': 50 };
    
    // 生成過去90天的數據
    for (let i = 89; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // 每天隨機生成1-8個番茄時間
        const dailyCount = Math.floor(Math.random() * 8) + 1;
        const records = [];
        
        for (let j = 0; j < dailyCount; j++) {
            const randomHour = Math.floor(Math.random() * 12) + 8; // 8-19點
            const randomMinute = Math.floor(Math.random() * 60);
            const timestamp = new Date(date);
            timestamp.setHours(randomHour, randomMinute, 0, 0);
            
            const mode = modes[Math.floor(Math.random() * modes.length)];
            const task = tasks[Math.floor(Math.random() * tasks.length)];
            
            records.push({
                date: dateStr,
                time: timestamp.toISOString(),
                task: task,
                duration: durations[mode],
                mode: mode
            });
        }
        
        // 按時間排序
        records.sort((a, b) => new Date(a.time) - new Date(b.time));
        
        localStorage.setItem(`pomodoro_${dateStr}`, JSON.stringify(records));
    }
    
    console.log('✅ 測試數據生成完成！共生成90天的模擬記錄');
    console.log('📊 數據統計：');
    console.log('   - 時間範圍：過去90天');
    console.log('   - 任務類型：15種不同任務');
    console.log('   - 計時模式：25+5分鐘 和 50+10分鐘');
    console.log('   - 每日記錄：1-8個不等的番茄時間');
    
    alert('🍅 測試數據生成完成！\n\n包含過去90天的模擬專注記錄\n頁面將在2秒後重新整理...');
    
    // 自動重新整理頁面
    setTimeout(() => {
        window.location.reload();
    }, 2000);
}

// 清除測試數據 - 僅在demo版本中可用
function clearTestData() {
    const keys = Object.keys(localStorage);
    let deletedCount = 0;
    
    // 只清除以 pomodoro_ 開頭的數據（保留應用狀態）
    keys.forEach(key => {
        if (key.startsWith('pomodoro_') && key !== 'pomodoro_state') {
            localStorage.removeItem(key);
            deletedCount++;
        }
    });
    
    console.log(`🗑️ 已清除 ${deletedCount} 條測試數據！`);
    alert(`已清除 ${deletedCount} 條測試數據！\n頁面將在2秒後重新整理...`);
    
    // 自動重新整理頁面
    setTimeout(() => {
        window.location.reload();
    }, 2000);
}

// 顯示測試幫助信息 - 僅在demo版本中可用
function showTestHelp() {
    console.log('');
    console.log('🍅 ===== 番茄計時器測試工具 =====');
    console.log('');
    console.log('📊 可用函數：');
    console.log('   generateTestData() - 生成90天的測試數據');
    console.log('   clearTestData()    - 清除所有測試數據');
    console.log('   showTestHelp()     - 顯示此幫助信息');
    console.log('');
    console.log('🧪 測試功能：');
    console.log('   • 使用「測試計時器」快速測試通知效果');
    console.log('   • 建議設置 5-10 秒來測試所有通知功能');
    console.log('   • 測試完成後會自動恢復原始狀態');
    console.log('');
    console.log('🎯 測試步驟：');
    console.log('   1. 運行 generateTestData()');
    console.log('   2. 等待頁面自動重新整理');
    console.log('   3. 點擊「查看歷史記錄」按鈕');
    console.log('   4. 測試不同時間範圍和圖表類型');
    console.log('');
    console.log('💡 提示：測試完成後可運行 clearTestData() 清除數據');
    console.log('   或點擊「清除測試數據」按鈕');
    console.log('');
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
    
    // 顯示測試工具提示
    console.log('🍅 番茄計時器測試版已載入！');
    console.log('💡 輸入 showTestHelp() 查看測試工具使用說明');
});
