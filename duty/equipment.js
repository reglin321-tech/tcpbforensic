const configs = [
    {
        "name": "槍擊案件",
        "items": [
            "鉛銅試劑", "彈道重建裝備(雷射、探棒、細繩、量角器、水平量角、鉛錘)",
            "GSR鋁錠", "測距儀", "箱尺", "三腳架", "金屬探測器", "內視鏡"
        ]
    },
    {
        "name": "毒品工廠",
        "items": [
            "手持式拉曼", "電子磅秤", "毒品初篩試劑", "酸鹼試紙",
            "採樣工具(閃爍瓶、塑膠瓶、空桶、滴管、刮勺、真空吸球、量杯)",
            "防護工具(防毒面具、主動式防護設備、護目鏡、抗酸鹼手套、防護衣、雨鞋)",
            "溶劑(甲醇或乙醇)", "紙製證物號碼牌", "秤重表", "抗化膠帶", "牛皮膠帶"
        ]
    },
    {
        "name": "爆裂物處理",
        "items": [
            "手持式拉曼", "爆裂物檢測試劑", "防爆毯", "訊號遮蔽器",
            "車底檢視器", "金屬探測器", "望遠相機", "內視鏡", "尼龍證物袋", "篩網"
        ]
    },
    {
        "name": "日常裝備檢查",
        "items": [
            "數字標籤", "箭頭標籤", "空白標籤", "捲尺", "比例尺", "證物紙袋(長)",
            "證物紙袋(中)", "證物紙袋(短)", "L比例尺", "證物清單", "垃圾袋", "封緘膠帶", 
            "工具盒", "口罩", "手套(L)", "手套(XL)", "頭套", "號碼牌", "塑膠證物袋", 
            "紙證物袋(中、大)", "指紋粉末", "氰丙烯酸酯", "鋁箔盒", "尼龍棉棒", 
            "棉棒", "生理食鹽水", "紗布", "酒精棉片", "DNA黏膠片", "鞋套", "指紋膠片"
        ]
    }
];

let selectedItems = [];
let currentIndex = 0;
let missingList = [];

// 初始化首頁按鈕
const listDiv = document.getElementById('button-list');
configs.forEach(config => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerText = config.name;
    btn.onclick = () => startCheck(config);
    listDiv.appendChild(btn);
});

function startCheck(config) {
    selectedItems = config.items;
    currentIndex = 0;
    missingList = [];
    document.getElementById('home-page').classList.add('hidden');
    document.getElementById('check-page').classList.remove('hidden');
    document.getElementById('current-scenario-name').innerText = config.name;
    showNextItem();
}

function showNextItem() {
    if (currentIndex < selectedItems.length) {
        document.getElementById('current-item-name').innerText = selectedItems[currentIndex];
        document.getElementById('progress-text').innerText = `進度：${currentIndex + 1} / ${selectedItems.length}`;
    } else {
        showResult();
    }
}

function handleCheck(isOk) {
    if (!isOk) { missingList.push(selectedItems[currentIndex]); }
    currentIndex++;
    showNextItem();
}

function showResult() {
    document.getElementById('check-page').classList.add('hidden');
    document.getElementById('result-page').classList.remove('hidden');
    const resultContent = document.getElementById('result-content');
    if (missingList.length === 0) {
        resultContent.innerHTML = "<h3 style='color: var(--primary-green);'>✅ 裝備齊全<br>祝出勤平安！</h3>";
    } else {
        let listHtml = "<h3 style='color: #e94560;'>⚠️ 缺失清單：</h3><ul style='padding: 0;'>";
        missingList.forEach(item => {
            listHtml += `<li class="missing-item">MISSING: ${item}</li>`;
        });
        listHtml += "</ul>";
        resultContent.innerHTML = listHtml;
    }
}